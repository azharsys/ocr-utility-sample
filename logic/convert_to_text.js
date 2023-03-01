const Pdf2Text = require('./pdf_to_text');
const Xls2Text = require('./xls_to_text');

class TextConverter {
  constructor (file, pdfExtractor) {
    this._file = file;
    this._supportedFormats = {
      'PDF': new Pdf2Text(file, pdfExtractor),
      'XLSX': new Xls2Text(file),
      'XLS': new Xls2Text(file)
    };
  }
  
  get file() {
    return this._file;
  }
  
  set file(value) {
    this._file = value;
  }
  
  get supportedFormats() {
    return this._supportedFormats;
  }
  
  set supportedFormats(value) {
    this._supportedFormats = value;
  }
  
  async process () {
    // could've used path.extname, but this one is mush faster and cheaper
    const type = this.file.slice((this.file.lastIndexOf(".") - 1 >>> 0) + 2);
    const executor = this.supportedFormats[type.toUpperCase()];
    if (executor) {
      return await executor.process();
    }
  }
  
}
module.exports = TextConverter;
