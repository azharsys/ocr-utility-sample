const fs = require('fs');

class FileWriter {
  
  constructor (output) {
    const path = `${output}/results.csv`;
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
    this._file = fs.createWriteStream(path, {flags: 'a'});
  }
  
  write (fileName, extractedData) {
    let arr = [];
    let count = 0;
    extractedData.forEach(item => {
      const isExtracted = item.matched;
      delete item.matched;
      const entries = Object.entries(item).map(i => i.join('='));
      let status = '(NOT_MATCHED)';
      if (isExtracted) {
        count += 1;
        status = '(MATCHED)';
      }
      arr.push(`${entries[0]} ${status}`);
    });
    this._file.write([fileName, `${count} out of ${extractedData.length} MATCHED`, ...arr].join() + '\n');
  }
  
  close () {
    this._file.end();
  }
  
}

class JSONWriter {
  constructor (output) {
    const path = `${output}/results.json`;
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
    this._file = fs.createWriteStream(path);
  }
  
  write (json) {
    this._file.write(json);
  }
  
  close () {
    this._file.end();
  }
}

module.exports = {
  FileWriter,
  JSONWriter
};
