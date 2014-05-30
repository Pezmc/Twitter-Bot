var EventEmitter = require('events').EventEmitter;

var TwitterEventEmitter = module.exports = function Parser() {
  EventEmitter.call(this); // call EventEmitter constructor
  return this;
};

// The parser emits events!
TwitterEventEmitter.prototype = Object.create(EventEmitter.prototype);