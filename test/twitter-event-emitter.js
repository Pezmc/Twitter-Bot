var libPath = require('../lib/_libPath.js');
var TwitterEventEmitter = require('../' + libPath + '/twitter-event-emitter');
var EventEmitter = require('events').EventEmitter;

describe('twitter-event-emitter', function() {
    describe('+constructor()', function() {
        var testemitter = new TwitterEventEmitter();  
    
        it('should return an instance of EventEmitter', function() {          
            (testemitter instanceof EventEmitter).should.be.true;  
        });
        
        it('should provide on and emit functions', function() {
            testemitter.on.should.be.type('function'); 
            testemitter.emit.should.be.type('function');            
        });
    });
});