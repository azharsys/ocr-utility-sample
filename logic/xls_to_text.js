const XLSX = require('xlsx');
const fs = require('fs');

class Xls2Text {
  constructor (file) {
    this._file = file;
  }
  
  get file() {
    return this._file;
  }
  
  set file(value) {
    this._file = value;
  }
  
  async process () {
    const buffer = fs.readFileSync(`${this.file}`);
    const workBook = XLSX.read(buffer, {type:'buffer'});
    const sheets = [];
    workBook.SheetNames.forEach(sheetName => {
      sheets.push(XLSX.utils.sheet_to_csv(workBook.Sheets[sheetName], {
        FS: '\t'
      }));
    });
    return sheets.join('\n');
  }
}

module.exports = Xls2Text;
