'use strict';
const Pdf2Image = require('./pdf_to_image');
const path = require('path');

class ImageConverter {
  
  constructor(file, saveDir, density = 300) {
    this._supportedFormats = {
      'PDF': new Pdf2Image(file, `${saveDir}/${path.basename(file)}.jpeg`, density)
    };
    this._saveDir = saveDir;
    this._file = file;
  }
  
  get supportedFormats() {
    return this._supportedFormats;
  }
  
  set supportedFormats(value) {
    this._supportedFormats = value;
  }
  
  get file() {
    return this._file;
  }
  
  set file(value) {
    this._file = value;
  }
  
  async convert() {
    // could've used path.extname, but this one is mush faster and cheaper
    const type = this.file.slice((this.file.lastIndexOf(".") - 1 >>> 0) + 2);
    const executor = this.supportedFormats[type.toUpperCase()];
    if (executor) {
      return await executor.process();
    }
  }
  
}

module.exports = ImageConverter;
