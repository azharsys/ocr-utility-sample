const MaerskQuotes = require('./../shippers/maersk_quotes');

class PostProcess {
  
  constructor (executionFor, extactedData = {}) {
    this._extactedData = extactedData;
    this._executionFor = executionFor;
    this._postProcessData = null;
    this._executor = {
      "MaerskQuotes": new MaerskQuotes(extactedData)
    }
  }
  
  get postProcessData() {
    return this._postProcessData;
  }
  
  get extactedData() {
    return this._extactedData;
  }
  
  set extactedData(value) {
    this._extactedData = value;
  }
  
  async process () {
    const executor = this._executor[this._executionFor];
    if (executor) {
      executor.data = this.extactedData;
      this._postProcessData = await executor.process();
      return this._postProcessData;
    }
    return null;
  }
  
}

module.exports = PostProcess;
