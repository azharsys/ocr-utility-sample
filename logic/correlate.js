'use strict';
const grok = require('node-grok');
const fs = require('fs');
const _ = require('lodash');
const logger = require('./../logger');
const path = require('path');
const grokFile = path.join(__dirname, '..', 'grok.patterns');

class Correlate {
  
  constructor() {
    this._text = '';
    this._data2Correlate = [];
    this._requiredFieldsMatch = new Set();
    this._lines = [];
    this._extractedData = {};
    this._template = '';
    this._requiredFields = [];
  }
  
  get requiredFields() {
    return this._requiredFields;
  }
  
  set requiredFields(value) {
    this._requiredFields = value;
  }
  
  get template() {
    return this._template;
  }
  
  set template(value) {
    this._template = value;
  }
  
  get extractedData() {
    return this._extractedData;
  }
  
  get text() {
    return this._text;
  }
  
  set text(value) {
    this._text = value;
  }
  
  get data2Correlate() {
    return this._data2Correlate;
  }
  
  set data2Correlate(value) {
    this._data2Correlate = value.map(val => {
      const token = val.split('=');
      const obj = {};
      obj[token[0]] = token[1];
      return obj;
    });
  }
  
  process() {
    this._lines = _.split(this.text, '\n');
    this.searchPatterns(this._template['patterns']);
    this.cleanFields(this._template['clean_fields'], this._extractedData.extractedRootPatternData);
    this.mergeExtractedData(this._extractedData.extractedRootPatternData);
    this.checkRequiredFieldMatch(this._extractedData.extractedRootPatternData || {});
    this.matchValues(this._extractedData.extractedRootPatternData || {});
    this.searchSections();
    this.cleanRequiredFields();
    this._extractedData.requiredFields = this._requiredFieldsMatch;
  }
  
  mergeExtractedData (data) {
    if (!data) return;
    const fields = Object.keys(data);
    const mergeFields = this._template['merge_fields'];
    if (!mergeFields) return;
    mergeFields.forEach(rule => {
      const value = fields.reduce((acc, field) => {
        if (rule.merge.fields.indexOf(field) > -1) {
          acc.push(data[field]);
        }
        return acc;
      }, []);
      if (value.length > 0) data[rule.merge.add] = value.join(rule.merge.string);
    });
  }
  
  checkRequiredFieldMatch (data) {
    Object.keys(data).forEach(key => {
      if (data[key].length) {
        const fIndex = this._requiredFields.findIndex(f => f.fieldName === key);
        if (fIndex > - 1) {
          this._requiredFieldsMatch.add({
            key: key,
            value: data[key],
            id: this._requiredFields[fIndex].id
          });
        }
      }
    });
  }
  
  cleanRequiredFields () {
    const aggregate = this._template['aggregate'];
    const ignoreDuplicate = this._template['ignore_duplicate'] || [];
    const joinMultiValueFields = Object.keys(this._template['join_multi_value_field'] || {});
    this._requiredFieldsMatch = [...this._requiredFieldsMatch]
      .filter(_a => _a.value.length > 0)
      .reduce((acc, element) => {
        const index = acc.findIndex(_a => _a.key === element.key);
        if (index < 0 ) {
          acc.push({key: element.key, values: [element.value.trim().replace(/\\n/g, '\n')], id: element.id});
        } else {
          acc[index].values.push(element.value.trim().replace(/\\n/g, '\n'));
        }
        return acc;
      },[])
      .map(_a => {
        if (aggregate && aggregate.sum) {
          const keyIndex = aggregate.sum.indexOf(_a.key);
          if (keyIndex > -1) {
            _a.values = [(_a.values
              .map(v => parseFloat(v.replace(/,/g, '')))
              .reduce((acc, element) => acc + element)).toFixed(2)];
          }
        }
        return _a;
      })
      .map(_a => {
        const index = joinMultiValueFields.indexOf(_a.key);
        const duplicate = ignoreDuplicate.indexOf(_a.key);
        let joinChar = ',';
        if (index > -1) {
          joinChar = this._template['join_multi_value_field'][_a.key];
        }
        if (duplicate > -1) {
          _a.values = _a.values.join(`${joinChar}`);
        } else {
          _a.values = [...new Set(_a.values)].join(`${joinChar}`);
        }
        if (_a.key === 'material') logger.info(_a.values);
        return _a;
      });
  }
  
  get requiredFieldsFoundPercentage () {
    return this._requiredFieldsMatch.length / ( this._requiredFields.length || 1);
  }
  
  searchPatterns (patterns) {
    if (!patterns) return;
    const extracted = {};
    const grokPatterns = grok.loadDefaultSync();
    grokPatterns.loadSync(grokFile);
    patterns.forEach(pattern => {
      const grokPattern = grokPatterns.createPattern(pattern);
      this._lines.forEach(line => {
        if (line) { // if its not empty
          const result = grokPattern.parseSync(line);
          if (result) {
            Object.assign(extracted, result);
          }
        }
      });
    });
    this.extractedData.extractedRootPatternData = extracted;
  }
  
  cleanFields (cleanFields, fieldsData) {
    if (!cleanFields) return;
    Object.keys(cleanFields).forEach(key => {
      (cleanFields[key].remove || []).forEach(rem => {
        const remRegex = new RegExp(rem);
        if (fieldsData[key]) {
          fieldsData[key] = fieldsData[key].replace(remRegex, '');
        }
      });
      if (cleanFields[key].replace) {
        const repRegex = new RegExp(cleanFields[key].replace.this, 'g');
        fieldsData[key] = fieldsData[key].replace(repRegex, cleanFields[key].replace.with);
      }
    });
  }
  
  static applyStartAndEndRuleOnLine (params) {
    let { line, lineRules } = params;
    const start = (lineRules || {}).start || {};
    const end = (lineRules || {}).end || {};
    let eIndex = -1;
    let sIndex = 0;
    let match = {};
    let indexes = [];
    if (start.pattern) {
      const regex = new RegExp(start.pattern, 'g');
      while ((match = regex.exec(line)) !== null) {
        indexes.push(match.index);
      }
      if (start.last_index) sIndex = indexes[indexes.length - 1] || 0;
      else if (start.index) sIndex = indexes[start.index - 1] || 0;
      else sIndex = indexes[0] || 0;
    }
    if (end.pattern) {
      const regex = new RegExp(end.pattern, 'g');
      indexes = [];
      while ((match = regex.exec(line.substr(sIndex + (start.pattern ? 1 : 0), line.length))) !== null) {
        indexes.push(match.index + sIndex);
        if (end.include_pattern) indexes[indexes.length - 1] += match[0].length;
      }
      if (end.last_index) eIndex = isNaN(indexes[indexes.length - 1]) ? -1 : indexes[indexes.length - 1];
      else if (end.index) eIndex = indexes[end.index - 1] || 0;
      else eIndex = isNaN(indexes[0]) ? -1 : indexes[0];
    }
    line = line.substring(sIndex, eIndex > -1 ? eIndex + 1 : line.length);
    if (start.replace !== undefined) {
      const regex = new RegExp(start.pattern);
      return line.replace(regex, start.replace);
    }
    return line;
  }
  
  static getLineSubstring (params) {
    const { line, patternFound } = Correlate.applyDisableRules(params);
    if (patternFound) {
      return line;
    } else {
      return Correlate.applyStartAndEndRuleOnLine(params);
    }
  }
  
  static applyDisableRules (params) {
    let { line, lineIndex, lineRules } = params;
    const disableCondition = _.get(lineRules, 'disable.condition');
    let runPatterns = false;
    let patternFound = false;
    if (disableCondition && disableCondition.for_line) {
      runPatterns =
        (typeof disableCondition.for_line === 'number' && disableCondition.for_line === -1)
        || (typeof disableCondition.for_line === 'number' && disableCondition.for_line - 1 === lineIndex)
        || (typeof disableCondition.for_line === 'string' && new RegExp(disableCondition.for_line, 'g').test(line));
    }
    if (runPatterns) {
      if ((disableCondition.patterns || []).some(pattern => {
          const regex = new RegExp(pattern, 'g');
          return regex.test(line);
        })) {
        line = Correlate.applyStartAndEndRuleOnLine({
          lineRules: disableCondition.line,
          line
        });
        patternFound = true;
      }
    }
    return { line, patternFound };
  }
  
  applyPattern (line, grokPattern, data) {
    const result = grokPattern.parseSync(line);
    if (result && Object.keys(result).length > 0) {
      this.checkRequiredFieldMatch(result);
      data.push(result);
    }
  }

  static applyMergeCondition (params) {
    const { line, lineIndex, mergeCondition } = params;
    let runPatterns = false;
    if (mergeCondition && mergeCondition.for_line) {
      runPatterns = typeof mergeCondition.for_line === 'number'
        && mergeCondition.for_line - 1 === lineIndex;
      if (!runPatterns) {
        runPatterns = typeof mergeCondition.for_line === 'string'
          && new RegExp(mergeCondition.for_line, 'g').test(line);
      }
    }
    if (runPatterns) {
      if ((mergeCondition.patterns || []).some(pattern => {
          const regex = new RegExp(pattern, 'g');
          return regex.test(line);
        })) {
        return line;
      } else {
        return '';
      }
    }
    return line;
  }
  
  searchSectionPatterns (params) {
    const { start, end, patterns, encapsulateKey, lineRules } = params;
    const data = [];    
    if (!patterns) return;
    const grokPatterns = grok.loadDefaultSync();
    grokPatterns.loadSync(grokFile);
    patterns.forEach(pattern => {
      const grokPattern = grokPatterns.createPattern(pattern);
      if (lineRules && lineRules.merge) {
        const mergeCondition = _.get(lineRules, 'merge.condition');
        const line = this._lines
          .slice(start, end)
          .map((line, lineIndex) => {
            line = Correlate.getLineSubstring({ line, lineIndex, lineRules });
            return Correlate.applyMergeCondition({ line, lineIndex, mergeCondition });
          })
          .filter(line => line.length)
          .join(lineRules.merge.string ? lineRules.merge.string : '');
        this.applyPattern(line, grokPattern, data);
      } else {
        this._lines.slice(start, end).forEach((line, lineIndex) => {
          if (line) { // if its not empty
            this.applyPattern(Correlate.getLineSubstring({ line, lineIndex, lineRules }), grokPattern, data);
          }
        });
      }
    });
    this._extractedData.sections = this._extractedData.sections || {};
    this._extractedData.sections[encapsulateKey] = this._extractedData.sections[encapsulateKey] || [];
    this._extractedData.sections[encapsulateKey].push(...data);
  }
  
  getStartAndEndIndexes (rule) {
    let startIndexes = [];
    let endIndexes = [];
    let endRegex = null;
    let startRegex = null;
    const { start, end } = rule.section;    
    if (start.pattern) {
      startRegex = new RegExp(start.pattern);
    }
    if (end.pattern) {
      endRegex = new RegExp(end.pattern);
    }
    if (startRegex && endRegex) {
      this._lines.forEach((line, sindex) => {
        if (startRegex.test(line)) {
          const endFound = this._lines.slice(sindex + 1, this._lines.length).some((line, eindex) => {
            if (endRegex.test(line)) {
              endIndexes.push(eindex + sindex + 1);
              return true;
            }
            return false;
          });
          if (endFound) {
            startIndexes.push(sindex);
          }
        }
      });
    }
    if (start.from_end_index !== undefined) {
      endIndexes = this._lines.reduce(function(arr, str, index) {
        if (endRegex.test(str))
          arr.push(index);
        return arr;
      }, []);
      startIndexes = endIndexes.map(index => index + parseInt(start.from_end_index));
    }
    if (end.from_start_index !== undefined) {
      startIndexes = this._lines.reduce(function(arr, str, index) {
        if (startRegex.test(str))
          arr.push(index);
        return arr;
      }, []);
      endIndexes = startIndexes.map(index => index + parseInt(end.from_start_index));
    }
    return {
      startIndexes,
      endIndexes
    }
  }
  
  searchSections () {
    const sections = this._template['sections'];
    if (!sections) return;
    sections.forEach(rule => {
      const { startIndexes, endIndexes } = this.getStartAndEndIndexes(rule);
      const startInclusive = rule.section.start.inclusive ? 0 : 1;
      const endInclusive = rule.section.end.inclusive ? 1 : 0;
      const startSkip = rule.section.start.skip_lines || 0;
      const endSkip = rule.section.end.skip_lines || 0;
      for (let index = 0; index < startIndexes.length && endIndexes.length; index ++) {
        this.searchSectionPatterns({          
          start: startIndexes[index] + startInclusive + (+startSkip),
          end: endIndexes[index] + endInclusive - (+endSkip),
          patterns: rule.section.patterns,
          lineRules: rule.section.lines,
          encapsulateKey: `${rule.section.encapsulate_key}-${index + 1}`
        });
        this.extractedData.sections[`${rule.section.encapsulate_key}-${index + 1}`].forEach(entry => {
          this.cleanFields(rule.section.clean_fields, entry);
          this.matchValues(entry);
        });
      }
    });
  }
  
  matchValues (data) {
    Object.keys(data).forEach(field => {
      const filter = this.data2Correlate.filter(o => o[field]);
      data[field] = data[field].trim();
      if (filter.length && data[field] == filter[0][key]) {
        filter[0].matched = true;
      }
    });
  }
  
}

module.exports = Correlate;
