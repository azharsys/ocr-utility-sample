const fs = require('fs');
const _ = require('lodash');
const PDF2Pic = require('pdf2pic').default;
const nodeUtil = require('util');
const glob = nodeUtil.promisify(require("glob"));
const path = require('path');
const gm = require('gm');
const logger = require('./../logger');

class Pdf2Image {
  
  constructor (file, saveToPath, density = 300) {
    this._outputFilePath = saveToPath;
    this._pdfFilePath = file;
    this._density = density;
  }
  
  async process () {
    const converter = new PDF2Pic({
      density: this._density,
      savename: path.basename(this._pdfFilePath),
      savedir: path.dirname(this._outputFilePath),
      format: "jpeg",
      quality: 100,
      compression: 'lossless'
    });
    if (fs.existsSync(this._outputFilePath)) {
      fs.unlinkSync(this._outputFilePath);
    }
    await converter.convertBulk(this._pdfFilePath, -1);
    const convertedImgFiles = await glob(this.createPattern());
    await this.mergePages(convertedImgFiles);
    this.deleteFiles(convertedImgFiles);
    return this._outputFilePath;
  }
  
  async mergePages (convertedImgFiles) {
    const image = gm(convertedImgFiles[0]);
    for (let index = 1; index < convertedImgFiles.length; index++) {
      image.append(convertedImgFiles[index]);
    }
    await new Promise((resolve, reject) => {
      image.write(this._outputFilePath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  createPattern () {
    return this._outputFilePath.substr(0, this._outputFilePath.lastIndexOf(".")) +
      '*' + this._outputFilePath.substr(this._outputFilePath.lastIndexOf("."));
  }
  
  deleteFiles (files) {
    files.forEach(f => {
      fs.unlink(f, _.noop);
    });
  }
  

}

module.exports = Pdf2Image;
