'use strict';

import bytewise from 'bytewise';
import clone from 'lodash.clone';

export class AbstractStoreLayer {
  constructor({ keyEncoding = 'bytewise', valueEncoding = 'json' } = {}) {
    this.keyEncoding = keyEncoding;
    this.valueEncoding = valueEncoding;
    this.root = this;
  }

  get insideTransaction() {
    return this !== this.root;
  }

  encode(value, encoding) {
    switch (encoding) {
      case 'bytewise':
        return new Buffer(bytewise.encode(value)); // bytewise.encode return a Uint8Array in the browser
      case 'json':
        if (typeof value === 'undefined') return undefined;
        return new Buffer(JSON.stringify(value));
      default:
        throw new Error('Unknown encoding');
    }
  }

  encodeKey(key) {
    if (!key) throw new Error('Undefined, null or empty key');
    return this.encode(key, this.keyEncoding);
  }

  encodeValue(value) {
    if (value == null) return undefined;
    return this.encode(value, this.valueEncoding);
  }

  decode(value, encoding) {
    switch (encoding) {
      case 'bytewise':
        return bytewise.decode(value);
      case 'json':
        return JSON.parse(value);
      default:
        throw new Error('Unknown encoding');
    }
  }

  decodeKey(key) {
    if (!key) throw new Error('Undefined, null or empty key');
    return this.decode(key, this.keyEncoding);
  }

  decodeValue(value) {
    if (value == null) return undefined;
    return this.decode(value, this.valueEncoding);
  }

  getPreviousKey(key) {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    let keys = clone(key);
    if (!keys.length) return keys;
    key = keys.pop();
    key = this._getPreviousKey(key);
    keys.push(key);
    return keys;
  }

  _getPreviousKey(key) {
    if (typeof key === 'number') {
      return key - 0.000001; // TODO: try to increase precision
    } else if (typeof key === 'string') {
      if (!key.length) return key;
      let end = key.substr(-1);
      key = key.substr(0, key.length - 1);
      end = String.fromCharCode(end.charCodeAt(0) - 1);
      end += '\uFFFF';
      return key + end;
    } else {
      return key;
    }
  }

  getNextKey(key) {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    let keys = clone(key);
    if (!keys.length) return keys;
    key = keys.pop();
    key = this._getNextKey(key);
    keys.push(key);
    return keys;
  }

  _getNextKey(key) {
    if (typeof key === 'number') {
      return key + 0.000001; // TODO: try to increase precision
    } else if (typeof key === 'string') {
      if (!key.length) return key;
      let end = key.substr(-1);
      key = key.substr(0, key.length - 1);
      end += '\u0001';
      return key + end;
    } else {
      return key;
    }
  }

  getEmptyKey() {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    return [];
  }

  getMinimumKey() {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    return [null];
  }

  getMaximumKey() {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    return [undefined];
  }

  normalizeKey(key) {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    if (!Array.isArray(key)) key = [key];
    return key;
  }

  concatKeys(key1, key2) {
    if (this.keyEncoding !== 'bytewise') throw new Error('Unimplemented encoding');
    return key1.concat(key2);
  }

  normalizeKeySelectors(options) {
    options = clone(options);

    if (options.hasOwnProperty('value')) {
      if (options.hasOwnProperty('start')) throw new Error('Invalid key selector');
      if (options.hasOwnProperty('end')) throw new Error('Invalid key selector');
      options.start = options.value;
      options.end = options.value;
    }

    let key;

    if (options.hasOwnProperty('start')) {
      if (options.hasOwnProperty('startAfter')) throw new Error('Invalid key selector');
      options.start = this.normalizeKey(options.start);
    }
    if (options.hasOwnProperty('startAfter')) {
      key = this.normalizeKey(options.startAfter);
      key = options.reverse ? this.getPreviousKey(key) : this.getNextKey(key);
      options.start = key;
      delete options.startAfter;
    }
    if (!options.hasOwnProperty('start')) {
      options.start = this.getEmptyKey();
    }
    if (options.reverse) {
      options.start = this.concatKeys(options.start, this.getMaximumKey());
    }

    if (options.hasOwnProperty('end')) {
      if (options.hasOwnProperty('endBefore')) throw new Error('Invalid key selector');
      options.end = this.normalizeKey(options.end);
    }
    if (options.hasOwnProperty('endBefore')) {
      key = this.normalizeKey(options.endBefore);
      key = options.reverse ? this.getNextKey(key) : this.getPreviousKey(key);
      options.end = key;
      delete options.endBefore;
    }
    if (!options.hasOwnProperty('end')) {
      options.end = this.getEmptyKey();
    }
    if (!options.reverse) {
      options.end = this.concatKeys(options.end, this.getMaximumKey());
    }

    if (options.hasOwnProperty('prefix')) {
      let prefix = this.normalizeKey(options.prefix);
      options.start = this.concatKeys(prefix, options.start);
      options.end = this.concatKeys(prefix, options.end);
      delete options.prefix;
    }

    if (options.reverse) {
      let tmp = options.start;
      options.start = options.end;
      options.end = tmp;
    }

    return options;
  }
}

export default AbstractStoreLayer;
