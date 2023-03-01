'use strict';
const fs = require('fs');
const OCR = require('./ocr');
const {FileWriter, JSONWriter} = require('./file_write');
const logger = require('./../logger');
const BATCH_SIZE = 1;

const _tempFiles = [];

class FileReader {
  
  static tempFiles () { return _tempFiles };
  
  static async process(file, output) {
    const writer = new FileWriter(output);
    const jsonWriter = new JSONWriter(output);
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(line => line.length).map(l => l.split(','));
    let promises = [];
    let extractedData = [];
    let index = 0;
    let batch = lines.slice(index, index + BATCH_SIZE);
    while(batch.length) {
      logger.info('creating batch of size ' + BATCH_SIZE);
      promises = batch.map(line => {
        const ocr = new OCR({
          filePath: line[0],
          template: line[1],
          docType: undefined,
          hasImage: line[2],
          requiredFields: line.slice(3).map(f => { return {fieldName: f} }),
          output
        });
        logger.info(`adding file ${line[0]} to the batch`);
        return ocr.process();
      });
      logger.info('processing batch of ' + BATCH_SIZE);
      const results = await Promise.all(promises);
      logger.info('processing of batch complete');
      logger.info('writing results to the file');
      results.forEach(ocr => {
        const obj = {};
        obj[ocr.file] = ocr.correlate.info;
        extractedData.push(obj);
        writer.write(ocr.file, ocr.correlate.data2Correlate);
      });
      index = index + BATCH_SIZE;
      batch = lines.slice(index, index + BATCH_SIZE);
    }
    writer.close();
    jsonWriter.write(JSON.stringify(extractedData, null, 2));
    jsonWriter.close();
  }
  
}

module.exports = FileReader;
