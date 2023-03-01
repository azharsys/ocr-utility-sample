'use strict';

const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
let template = {};

const loadTemplate = (name) => {
  const file = fs.readFileSync(path.join(__dirname, '..', 'templates/', `${name}.yml`), 'utf8');
  template[name] = yaml.safeLoad(file);
};

const getTemplate = (name) => {
  if (!template[name]) {
    loadTemplate(name);
  }
  return template[name];
};

/**
 * {
 *    "document_type": [template_names]
 * }
 * */
const TEMPLATE_MAP = {
  "BILL_OF_LADING": [
    'bol_cmacgm',
    'bol_safmarine',
    'bol_apl',
    'bol_hamburg',
    'bol_hapag',
    'bol_hapag_2',
    'bol_indo',
    'bol_maersk',
    'bol_medsc',
    'bol_one',
    'bol_rcl',
    'bol_new_golden', 'bol_new_golden_1',
    'bol_seaway'
  ],
  "PACKING_LIST": ['pl_uni_1', 'pl_uni_2', 'pl_uni_3', 'pl_uni_4'],
  "INVOICE": ['inv_uni_1', 'inv_uni_2'],
  "S32_INVOICE": ['inv_cmacgm']
};

module.exports = {
  getTemplate,
  TEMPLATE_MAP
};
