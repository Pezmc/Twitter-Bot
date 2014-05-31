var should = require("should");
var request = require('supertest'); 

var Merge = require("../lib/merge.js");

var DBWrapper = require('node-dbi').DBWrapper; 
var Twitter = require('twitter');
  
function MockTwitter() {  
    var key = "key";
    var secret = "secret";
    this.options = {};      
    this.gatekeeper = function(options) {
        return function(req, res, next) {
            if(typeof next !== 'undefined') {
                return next(); // skip to next
                
            }
        }
    }
    this.login = function() {
        this.options.access_token_key = key;
        this.options.access_token_secret = secret;
        return function(req, res, next) {
            if(typeof next !== 'undefined') 
                return next(); // skip to next
        } 
    }
}

function MockResponse() {
    this.send = function() {};
}

function MockServer(next) {
    this.close = function(){};
    setTimeout(function(){
      next(null, new MockResponse())
    }, 1);
}

function MockExpress() {
    var _next;
    this.get = function(path, callback, next) {
        callback();
        if(typeof next !== 'undefined') {
            _next = next;
        }
    }
    
    this.listen = function() {
        return new MockServer(_next);
    }
}

function forEachKey(object) {
    for(key in object)
        if(object.hasOwnProperty(key))
            callback(key);
}

describe('twitter-bot', function() {
    var TwitterBot = require('../index.js');
    
    var defaultTwitterConfig = {
        dbi_config: {
          type: 'sqlite3',
          params: {
              path: ':memory:'
          }
        }
    }
    
    var testbot = new TwitterBot(defaultTwitterConfig);

    describe('+constructor(options)', function() {
        it('should return an instance of TwitterBot', function() {            
            (testbot instanceof TwitterBot).should.be.true;            
        })
        
        it('should use default config if no params are passed', function() {
            (testbot.config.dbi instanceof DBWrapper).should.be.true;
            (testbot.config.twitter instanceof Twitter).should.be.true;
            testbot.config.dbi_config.type.should.equal('sqlite3');
        });
        
        it('should set the default user agent to twitter-bot', function() {
            testbot.config.twitter_config.headers['User-Agent'].should.startWith('twitter-bot/')
        });
        
        it('should pass twitter config to the twitter class', function() {
            var configbot = new TwitterBot({
                twitter_config: {
                    consumer_key: 'test',
                    consumer_secret: 'test',
                    access_token_key: 'test',
                    access_token_secret: 'test'
                }
            });
            
            configbot.config.twitter.options.consumer_key.should.equal('test');
            configbot.config.twitter.options.consumer_secret.should.equal('test');
            configbot.config.twitter.options.access_token_key.should.equal('test');
            configbot.config.twitter.options.access_token_secret.should.equal('test');
          
        });
        
        it('should pass dbi config to the dbi clas', function() {
    
            testbot.config.dbi_config.type.should.equal('sqlite3');
            testbot.config.dbi_config.params.path.should.equal(':memory:');
          
        });
        
        it('should use the passed classes instead of defaults', function() {
            function TestClass(input) {
                this.input = input;    
            }
        
            var dependencybot = new TwitterBot({
                dbi: new TestClass('test'),
                twitter: new TestClass('test2'),
                express: new TestClass('test3')
            });
            
            (dependencybot.config.twitter instanceof TestClass).should.be.true;
            (dependencybot.config.dbi instanceof TestClass).should.be.true;
            (dependencybot.config.express instanceof TestClass).should.be.true;
            
            var twit = new Twitter({ consumer_key: 'test-key' });
            dependencybot = new TwitterBot({
                twitter: twit
            });
            dependencybot.config.twitter.options.consumer_key.should.equal('test-key');
            (dependencybot.config.twitter instanceof Twitter).should.be.true;            
            
        });
        
        it('should merge provided options with the defaults', function() {
            var testbot = new TwitterBot({
                search_terms: ['test'], // special case
                log_ignored_tweets: false,
                dbi_config: {
                    tables: {
                        api_login: 'test'
                    }
                }
            });
            
            testbot.config.search_terms.length.should.equal(1);
            testbot.config.search_terms[0].should.equal('test');
            testbot.config.log_ignored_tweets.should.be.false;
            testbot.config.dbi_config.tables.api_login.should.equal('test');
          
        });
    });
    
    describe("+getDB", function() {
        it('should return current database instance', function() {
            (testbot.getDB() instanceof DBWrapper).should.be.true;
        });
    });
    
    
    describe("+getTwitter", function() {
        it('should return current twitter instance', function() {
            (testbot.getTwitter() instanceof Twitter).should.be.true;
        });
    });
    
    function getDatabaseTables() {
        return testbot.config.dbi_config.tables;
    }

    describe("+getTableName", function() {
        it('should return the current table name for the passed table', function() {
            var tables = getDatabaseTables();
            forEachKey(function(key) {
                testbot.getTableName(key).should.equal(tables[key]); 
            });
        });
    });
    
    var mockconfig = Merge.clone(defaultTwitterConfig);
    mockconfig.twitter = new MockTwitter();
    mockconfig.express = new MockExpress();

    describe("+start", function() {
        it('should create empty tables', function(done) {
               
            var mockbot = new TwitterBot(mockconfig);
        
            mockbot.start(function() {
                mockbot.getDB().fetchAll('SELECT name FROM sqlite_master WHERE type = "table"', function(err, results) {
                    (err === null).should.be.true;
                    
                    var tables = getDatabaseTables();
                    forEachKey(function(key) {
                        results.should.containEql({ name: tables[key] });
                    });
                    
                    done();
                });
            });
        });
        
        it('should require and wait for authentication', function(done) {
          
            var mocktwitterconfig = JSON.parse(JSON.stringify(defaultTwitterConfig));
            mocktwitterconfig.twitter = new MockTwitter();
            
            var mocktwitterbot = new TwitterBot(mocktwitterconfig)
            
            mocktwitterbot.start();   
            
            setTimeout(function() {
                request(mocktwitterbot.config.express)
                      .get('/')
                      .expect(200)
                      .end(done);  
            }, 10);
            
        });
        
        it('should pass authentication keys to the twitter object', function(done) {
          
            var mockbot = new TwitterBot(mockconfig);
            
            mockbot.start(function() {
                mockbot.getTwitter().options.access_token_key.should.equal('key');
                mockbot.getTwitter().options.access_token_secret.should.equal('secret');
                done();
            });
        });
        
        it('should return an instance of the event emitter with \'on\' defined', function(done) {
            
            var mockbot = new TwitterBot(mockconfig);
            mockbot.start(function(emitter) {
                emitter.constructor.name.should.equal('EventEmitter');
                emitter.on.should.be.type('function');
                emitter.emit.should.be.type('function');
                done();
            });

            
        });
    });
    
    describe('+getTrackedList()', function() {
        it('should return an array of the tracked terms suitable for use with streaming', function() {
            var mockbot = new TwitterBot(mockconfig);
            
            mockbot.config.search_terms = [ "twitter", "bot", "#node.js" ];
            mockbot.getTrackedList().should.containDeep([ "twitter bot #node.js" ]);           
        });
        
        it('should merge each term together for and\'s', function() {
            var mockbot = new TwitterBot(mockconfig);
                       
            var input = [
                          [
                            '#node', '#node.js'
                          ],
                          [
                            '#twitter-bot'
                          ],
                          '#test'
                        ];           
            
            mockbot.config.search_terms = input;
            mockbot.getTrackedList().should.containDeep([ "#node #twitter-bot #test", "#node.js #twitter-bot #test" ]);                  
        });
        
        it('should return all possible combinations of or\'s', function() {          
            var mockbot = new TwitterBot(mockconfig);
            
            var input = [['sun', 'sunny', 'warm'], ['weather', 'sky', 'here']];
            var expected = ['sun weather', 'sunny weather', 'warm weather',
                            'sun sky', 'sunny sky', 'warm sky',
                            'sun here', 'sunny here', 'warm here']; 
            mockbot.config.search_terms = input;
            mockbot.getTrackedList().should.containDeep(expected);
            mockbot.getTrackedList().length.should.equal(expected.length);
          
        });
    });
    
    /*describe('+start()', function() {
        it('should start the bot', function(done) {
            tb.start(function() {
                done();
            });
        }
    }*/
});