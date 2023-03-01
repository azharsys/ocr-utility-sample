'use strict';
const fs = require('fs');
const tmpdir = require('os').tmpdir(); // let the os take care of removing zombie tmp files
const uuid = require('node-uuid');
const path = require('path');
const nodeUtil = require('util');
const exec = nodeUtil.promisify(require('child_process').exec);

class Tesseract {
  
  constructor(options) {
    this._options = Object.assign({
      'l': 'eng',
      'psm': 3,
      'config': path.join(__dirname, '..', 'tess.config'),
      'binary': 'tesseract',
      'oem': 2,
      'dpi': 300
    }, options);
    this._outFile = path.resolve(tmpdir, `tesseract-${uuid.v4()}`);
  }
  
  get outFile() {
    return this._outFile;
  }
  
  set outFile(value) {
    this._outFile = value;
  }
  
  get options() {
    return this._options;
  }
  
  set options(value) {
    this._options = value;
  }
  
  get tmpFiles() {
    return this._tmpFiles;
  }
  
  set tmpFiles(value) {
    this._tmpFiles = value;
  }
  
  async process(image) {
    let command = [this.options.binary, image, this.outFile];
    
    if (this.options.l) {
      command.push('-l ' + this.options.l);
    }
    if (this.options.oem !== null && this.options.oem !== undefined) {
      command.push('--oem ' + this.options.oem);
    }
    if (this.options.psm) {
      command.push('--psm ' + this.options.psm);
    }
    if (this.options.dpi) {
      command.push('--dpi ' + this.options.dpi);
    }
    if (this.options.dir) {
      command.push('--tessdata-dir ' + this.options.dir);
    }
    if (this.options.config !== null) {
      command.push(this.options.config);
    }
    command = command.join(' ');
    console.log(command);
    const opts = this.options.env || {};
    return exec(command, opts);
  }
  
}

/**
 * Module exports.
 */
module.exports = Tesseract;
