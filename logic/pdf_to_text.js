const pdfjsLib = require('pdfjs-dist');
const pdfToText = require('pdf-to-text').pdfToText;
const fs = require('fs');
const _ = require('lodash');
const nodeUtil = require('util');
const pdfUtil = nodeUtil.promisify(pdfToText);

class Pdf2Text {
  
  constructor (file, pdfExtractor) {
    this._pdfExtractor = pdfExtractor;
    this._file = file;
  }
  
  get file() {
    return this._file;
  }
  
  set file(value) {
    this._file = value;
  }
  
  async process () {
    const self = this;
  
    if (this._pdfExtractor === 'xpdf') {
      const text = await pdfUtil(this.file);
      return text
        .split('\n')
        .filter(l => l.length > 0)
        .map(l => l.replace(/\s{4,}/g, '\t'))
        .join('\n');
    } else {
      const instance = await pdfjsLib.getDocument(this.file);
      // Create an array that will contain our promises
      const pagesPromises = [];
      for (let i = 0; i < instance.numPages; i++) {
        // Required to prevent that i is always the total of pages
        (function (pageNumber) {
          // Store the promise of getPageText that returns the text of a page
          pagesPromises.push(self.getPageText(pageNumber, instance));
        })(i + 1);
      }
      // Execute all the promises
      return (await Promise.all(pagesPromises)).join('\n');
    }
  }
  
  async getPageText(pageNum, PDFDocumentInstance) {
    const x = 5;
    const page = await PDFDocumentInstance.getPage(pageNum);
    const text = await page.getTextContent({
      normalizeWhitespace: true
    });
    const textItems = text.items;
    const rows = {};
    textItems.forEach(item => {
      const y = item.transform[item.transform.length - 1];
      const group = Object.keys(rows).filter(_y => parseFloat(_y) - x <= y && y <= parseFloat(_y) + x)[0];
      (rows[group || y] = rows[group] || []).push(item);
    });
    return Object
      .keys(rows)
      .sort((y1, y2) => parseFloat(y2) - parseFloat(y1))
      .map(_y => {
        rows[_y].sort((i1, i2) => i1.transform[i1.transform.length - 2] - i2.transform[i2.transform.length - 2]);
        return _y;
      })
      .map(y => rows[y].map(o => o.str).join('\t')).join('\n');
  }
  
}
module.exports = Pdf2Text;
