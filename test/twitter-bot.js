var should = require("should");

var DBWrapper = require('node-dbi').DBWrapper; 
var Twitter = require('twitter');

describe('twitter-bot', function() {
    var TwitterBot = require('../index.js');
    var testbot = new TwitterBot({
                dbi_config: {
                    type: 'sqlite3',
                    params: {
                        path: ':memory:'
                    }
                }
    });

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
            var configbot = new TwitterBot({
                dbi_config: {
                    type: 'sqlite3',
                    params: {
                        path: ':memory:'
                    }
                }
            })
            
            configbot.config.dbi_config.type.should.equal('sqlite3');
            configbot.config.dbi_config.params.path.should.equal(':memory:');
          
        });
        
        it('should use the passed classes instead of defaults', function() {
            function TestClass(input) {
                this.input = input;    
            }
        
            var dependencybot = new TwitterBot({
                dbi: new TestClass('test'),
                twitter: new TestClass('test2')
            });
            
            (dependencybot.config.twitter instanceof TestClass).should.be.true;
            (dependencybot.config.dbi instanceof TestClass).should.be.true;
            
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

    function forEachKey(object) {
        for(key in object)
            if(object.hasOwnProperty(key))
                callback(key);
    }

    describe("+getTableName", function() {
        it('should return the current table name for the passed table', function() {
            var tables = getDatabaseTables();
            forEachKey(function(key) {
                testbot.getTableName(key).should.equal(tables[key]); 
            });
        });
    });

    describe("+start", function() {
        it('should create empty tables', function(done) {
            testbot.start(function() {
                testbot.getDB().fetchAll('SELECT name FROM sqlite_master WHERE type = "table"', function(err, results) {
                    (err === null).should.be.true;
                    
                    var tables = getDatabaseTables();
                    forEachKey(function(key) {
                        results.should.containEql({ name: tables[key] });
                    });
                    
                    done();
                });
            });
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