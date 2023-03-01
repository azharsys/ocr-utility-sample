'use strict';
const ImageConverter = require('./convert_to_image');
const path = require('path');
const Correlate = require('./correlate');
const TextConverter = require('./convert_to_text');
const nodeUtil = require('util');
const glob = nodeUtil.promisify(require('glob'));
const readFile = nodeUtil.promisify(require('fs').readFile);
const logger = require('./../logger');
const projUtil = require('./utils');
const PostProcess = require('./post_process');
const GoogleVision = require('./google_vision');
const Tesseract = require('./tesseract_wrapper');
const _ = require('lodash');

class OCR {
  
  constructor(params) {
    this._file = params.filePath;
    this._template = projUtil.getTemplate(params.template); // this will load template if not loaded
    this._hasImage = +params.hasImage;
    this._data2Correlate = params.data2Correlate || [];
    this._output = params.output;
    this._requiredFields = params.requiredFields;
    this._imageConverter = new ImageConverter(this._file, params.output, this._template.extractor.image_density);
    this._textConverter = new TextConverter(this._file, this._template.extractor.pdf);
    this._correlate = new Correlate();
    this.postProcess = new PostProcess(this._template['post_process']);
    this._vision = new GoogleVision(this._textConverter);
    this._tesseract = new Tesseract({
      psm: 3,
      oem: 2,
      // dpi: 300
    });
  }
  
  get template() {
    return this._template;
  }
  
  get data2Correlate() {
    return this._data2Correlate;
  }
  
  set data2Correlate(value) {
    this._data2Correlate = value;
  }
  
  get correlate() {
    return this._correlate;
  }
  
  set correlate(value) {
    this._correlate = value;
  }
  
  get output() {
    return this._output;
  }
  
  set output(value) {
    this._output = value;
  }
  
  get file() {
    return this._file;
  }
  
  set file(value) {
    this._file = value;
  }
  
  get imageConverter() {
    return this._imageConverter;
  }
  
  set imageConverter(value) {
    this._imageConverter = value;
  }
  
  fileExtension () {
    return this.file.slice((this.file.lastIndexOf(".") - 1 >>> 0) + 2);
  }
  
  isAlreadyImage () {
    return ['png', 'jpg', 'jpeg', 'tiff'].indexOf(this.fileExtension()) > -1;
  }
  
  requiresTextParsing () {
    return ['pdf', 'xls', 'xlsx'].indexOf(this.fileExtension().toLowerCase()) > -1;
  }
  
  templateRequiresImageProcess () {
    return _.get(this.template, 'extractor.tesseract') || _.get(this.template, 'extractor.google_vision')
  }
  
  async processText () {
    logger.info('extracting text from ' + this.file);
    return await this._textConverter.process();
  }
  
  async processImage () {
    logger.info('converting document to image and than running image processing on ' + this.file);
    const file = await this.imageConverter.convert();
    return await this.processOCR(file);
  }
  
  async processOCR (file) {
    logger.info('processing image ocr on ' + this.file);
    await this._tesseract.process(`"${file || this.file}"`);
    const files = await glob(this._tesseract.outFile + '.+(html|hocr|txt)');
    const text = await readFile(files[0], 'UTF-8');
    return text.split('\n').filter(l => l.trim().length > 0).join('\n');
    // return await this._vision.process(`${file || this.file}`);
  }
  
  async process() {
    logger.info('checking file type');
    let text = '';
    let filePath = this.file;
    if (this.isAlreadyImage()) { // just ocr it
      text = await this.processOCR();
    } else if (this.requiresTextParsing()
      && !this._hasImage
      && !this.templateRequiresImageProcess()) { // just read text
      text = await this.processText();
    } else { // we need to convert to image and than ocr it
      text = await this.processImage();
    }
    // text = text.replace(/\\n/g, '\n');
    // text = text.replace(/\\t/g, '\t');
    // console.log('\n\n-------------------------------------------------------------------------------------\n\n');
    // console.log(text);
    // console.log('\n\n-------------------------------------------------------------------------------------\n\n');
    this.correlate.text = text;
    this.correlate.data2Correlate = this.data2Correlate;
    this.correlate.template = this.template;
    this.correlate.requiredFields = this._requiredFields || [];
    logger.info('processing correlation of the text extracted for file ' + filePath);
    this.correlate.process();
    logger.info('post processing of the text extracted for file ' + filePath);
    this.postProcess.extactedData = this.correlate.extractedData;
    await this.postProcess.process();
    logger.info('post processing complete');
    logger.info(JSON.stringify(this.correlate.extractedData, null, 2));
    return this;
  }
  
}

module.exports = OCR;
