
var DBWrapper = require('node-dbi').DBWrapper; 
var Twitter = require('twitter');
var express = require('express');
var pjson = require('../package.json');
var util = require('util');
var async = require('async');
var merge = require('./merge');

var TWEET_TYPE = { 
  POLLED: 'polled',
  STREAMED: 'streamed'
};

function TwitterBot(options) {
    if(!(this instanceof TwitterBot)) { return new TwitterBot(options); }
	
    var defaultConfig = {
        stream: {
            wait_seconds_on_disconnect: 5,
            force_reconnect: true,
            force_reconnect_minutes: 30            
        },
        poll: {
            frequency_seconds: 180,
            countdown: true
        },
        log_ignored_tweets: true,
        log_ignored_tweets_file: 'ignoredtweets.txt',
        search_terms: [
          [
            '#node', '#node.js'
          ],
          [
            '#twitter-bot'
          ],
          '#test'
        ],
        account_name: 'twitterbot',
        twitter_config: {
            /*consumer_key: '',
            consumer_secret: '',
            access_token_key: '',
            access_token_secret: ''*/
        },
        dbi_config: {
            type: 'sqlite3',
            params: {
                path: 'twitter-bot.sqlite'   
            },
            tables: {
                seen_tweets: 'seen_tweets',
                sent_tweets: 'sent_tweets',
                api_login: 'api_login'
            }   
        }
    };
    defaultConfig.twitter_config.headers = {
        'User-Agent': 'twitter-bot/'+pjson.version
    };
        
    
    // Should probably do this a better way
    var defaultConfig = merge.clone(DEFAULT_CONFIG, true);  
          
    // Special case as merge is recursive
    var optionsDefined = options && typeof options !== undefined;
    if(optionsDefined && typeof options.search_terms !== undefined) {
        defaultConfig.search_terms = [];
    }
     
    var config = merge.merge(defaultConfig, options, true);
    var defaultObjects = {
        twitter: new Twitter(config.twitter_config),
        dbi: new DBWrapper(config.dbi_config.type, config.dbi_config.params),
        express: express()
    };
    
    this.config = merge.merge(defaultObjects, config);    
    this.sql = getSQL(this.config.dbi_config.tables);
}
module.exports = TwitterBot;

TwitterBot.prototype.getDB = function() {
    return this.config.dbi;    
}

TwitterBot.prototype.getTwitter = function() {
    return this.config.twitter;    
}

TwitterBot.prototype.getTableName = function(name) {
    return this.config.dbi_config.tables[name];
}

TwitterBot.prototype.start = function(callback) {
    
    // Ensure the database is ready for use
    var sql = this.sql;
    var db = this.getDB();
    var me = this;
    
    db.connect();

    async.parallel([
        function(callback) {
            db.query(sql.createSeenTweets, callback)
        },
        function(callback) {
            db.query(sql.createSentTweets, callback)
        },
        function(callback) {
            db.query(sql.createAPILogin, callback)
        }
    ], function() {
    
        var select = db.getSelect().from(me.getTableName('api_login'))
                       .order('id', 'DESC')
                       .limit(1);
        db.fetchOne(select, function(err, result) {
            if(result) {
                console.info("Using stored authentication");
                
                var twit = me.getTwitter();
                twit.options.access_token_key = result.access_token_key;
                twit.options.access_token_secret = result.access_token_secret;
              
                callback();
            } else {
                console.info("Authentication is needed before bot can start.");
                requireAuthentication(me.config.express, me.getTwitter(), callback);
            }
        });
    });
    
    // params = { 'since_id': (result.id - 1500) } // -1500 to ensure overlap
}

// -- private
function requireAuthentication(express, twitter, callback) {

    var server;
    express.get('/', twitter.gatekeeper('/login'), function(req, res){
      res.send('Authentification successfull');
      console.info("Auth complete, closing authentication server.");
      server.close();
      if(typeof callback === 'function')
          callback();
    });
    express.get('/twauth', twitter.login());
    
    console.info('Listening on 1200 for auth requests to Twitter');
    server = express.listen(1200);
}

function getSQL(table_names) {
  
  /* jshint ignore:start */
  var sql = [];
  sql['createSeenTweets'] = util.format('CREATE TABLE IF NOT EXISTS %s ', table_names.seen_tweets,
                            '(id INTEGER PRIMARY KEY, time DATETIME DEFAULT current_timestamp, text TEXT, ', 
                              'user_id INTEGER, username TEXT, action_taken TEXT, streamed BOOLEAN DEFAULT 0, ', 
                              'polled BOOLEAN DEFAULT 0, mention BOOLEAN DEFAULT 0)');
  sql['createSentTweets'] = util.format('CREATE TABLE IF NOT EXISTS %s ', table_names.sent_tweets,
                            '(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, related_tweet_id INTEGER)');
  sql['createAPILogin'] =   util.format('CREATE TABLE IF NOT EXISTS %s ', table_names.api_login,
                            '(id INTEGER PRIMARY KEY AUTOINCREMENT, access_token_key TEXT, access_token_secret TEXT)');
  
  
  
  
function getSQL(tableNames) {
  
    /* jshint ignore:start */
    var sql = [];
    sql['createSeenTweets'] = util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.seen_tweets,
                              '(id INTEGER PRIMARY KEY, time DATETIME DEFAULT current_timestamp, text TEXT, ', 
                                'user_id INTEGER, username TEXT, action_taken TEXT, streamed BOOLEAN DEFAULT 0, ', 
                                'polled BOOLEAN DEFAULT 0, mention BOOLEAN DEFAULT 0)');
    sql['createSentTweets'] = util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.sent_tweets,
                              '(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, related_tweet_id INTEGER)');
    sql['createAPILogin'] =   util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.api_login,
                              '(id INTEGER PRIMARY KEY AUTOINCREMENT, access_token_key TEXT, access_token_secret TEXT)');
    
    /*sql['selectNewestAPI'] =     util.format('SELECT * FROM %s ORDER BY id DESC LIMIT 1', table_names.api_login);                     
    sql['selectNewestTweet'] =   util.format('SELECT id FROM %s WHERE streamed = 0 OR polled = 1 ORDER BY id DESC LIMIT 1', table_names.seen_tweets);
    sql['selectExistingTweet'] = util.format("SELECT 1 as 'exist' FROM seen_tweets WHERE id = $tweet_id LIMIT 1";*/
    
    sql['updateActionTaken'] = util.format('UPDATE %s SET action_taken = $action WHERE id = $id', tableNames.seen_tweets);
    sql['updatePolled'] =      util.format('UPDATE %s SET polled = $polled WHERE id = $id', tableNames.seen_tweets);
    
    
    sql['insertSeenTweet'] = util.format('INSERT INTO %s (id, text, user_id, username, streamed, polled, mention) ', tableNames.seen_tweets,
                             'VALUES ($id, $text, $user_id, $username, $streamed, $polled, $mention)');
    sql['logSentTweet'] =    util.format('INSERT INTO %s (text, related_tweet_id) VALUES ($text, $related_id)', tableNames.sent_tweets);
    sql['insertAPILogin'] =  util.format('INSERT INTO %s (access_token_key, access_token_secret) VALUES ($key, $secret)', tableNames.api_login);
    /* jshint ignore:end */
    
    return sql;
}
