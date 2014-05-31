// Internal
var Pjson = require('../package.json');
var TwitterEventEmitter = require('./twitter-event-emitter');
var Merge = require('./merge');

// https://github.com/visionmedia/should.js/
var DBWrapper = require('node-dbi').DBWrapper;

// https://github.com/caolan/async
var Async = require('async');

// https://github.com/jdub/node-twitter/
var Twitter = require('twitter');

// http://expressjs.com/
var Express = require('express');

// Util
var Util = require('util');

var TWEET_TYPE = {
  POLLED: 'polled',
  STREAMED: 'streamed'
};

var DEFAULT_CONFIG = {
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
    search_location: '',
    account_name: 'twitterbot',
    twitter_config: {
        /*consumer_key: '',
        consumer_secret: '',
        access_token_key: '',
        access_token_secret: ''*/
        headers: {
            'User-Agent': 'twitter-bot/'+Pjson.version
        }
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

function TwitterBot(options) {
    if(!(this instanceof TwitterBot)) { return new TwitterBot(options); }
    
    // Should probably do this a better way
    var defaultConfig = Merge.clone(DEFAULT_CONFIG, true);  
          
    // Special case as Merge is recursive
    var optionsDefined = options && typeof options !== undefined;
    if(optionsDefined && typeof options.search_terms !== undefined) {
        defaultConfig.search_terms = [];
    }
     
    var config = Merge.merge(defaultConfig, options, true);
    var defaultObjects = {
        twitter: new Twitter(config.twitter_config),
        dbi: new DBWrapper(config.dbi_config.type, config.dbi_config.params),
        express: Express()
    };
    
    this.config = Merge.merge(defaultObjects, config);    
    this.sql = getSQL(this.config.dbi_config.tables);
    this.eventEmitter = new TwitterEventEmitter();
}
module.exports = TwitterBot;

TwitterBot.prototype.getDB = function() {
    return this.config.dbi;    
};

TwitterBot.prototype.getTwitter = function() {
    return this.config.twitter;    
};

TwitterBot.prototype.getTableName = function(name) {
    return this.config.dbi_config.tables[name];
};

TwitterBot.prototype.start = function(readyCallback, newTweetCallback) {
    
    // Ensure the database is ready for use
    var sql = this.sql;
    var db = this.getDB();
    var me = this;
    
    db.connect();

    Async.parallel([
        function(callback) {
            db.query(sql.createSeenTweets, callback);
        },
        function(callback) {
            db.query(sql.createSentTweets, callback);
        },
        function(callback) {
            db.query(sql.createAPILogin, callback);
        }
    ], function() {
    
        var select = db.getSelect().from(me.getTableName('api_login'))
                       .order('id', 'DESC')
                       .limit(1);
        db.fetchOne(select, function(err, result) {
            if(result) {
                //console.info('Using stored authentication');
                
                var twit = me.getTwitter();
                twit.options.access_token_key = result.access_token_key;
                twit.options.access_token_secret = result.access_token_secret;
              
                var begin = start.bind(me);
                begin(readyCallback, newTweetCallback);
            } else {
                //console.info('Authentication is needed before bot can start.');
                requireAuthentication(me.config.express, me.getTwitter(), function() {
                  var begin = start.bind(me);
                  begin(readyCallback, newTweetCallback);
                });
            }
        });
    });
    
    // params = { 'since_id': (result.id - 1500) } // -1500 to ensure overlap
};

// Connect to a twitter stream
TwitterBot.prototype.streamTweets = function(params, dataCallback, reconnectSleepSeconds) {
    if(typeof reconnectSleepSeconds === 'undefined')
        reconnectSleepSeconds = this.stream.wait_seconds_on_disconnect;
  
    this.config.twitter.stream(type, params, function(stream) {
        console.info("Connected to twitter stream");
        
        var resetStream = setTimeout(function() {
            console.info("Restarting stream as it has been open for 30 minutes");
            stream.destroy();
        }, this.config.stream.force_reconnect_minutes * 60000);
        
        stream.on('data', function(data) {
        
            // reset done here as 'connect' fires even on rejection
            reconnectSleepSeconds = DEFAULT_STREAM_SLEEP_SECONDS;
             
            dataCallback(data);
              
        });
        
        stream.on('error', function(error) {
            if(error.errorSource) console.error("Twitter "+type+" stream error:", error);
            else console.error("Other Twitter "+type+" stream error", error);
            
            // To be safe force, else we may be stuck with error but no end firing
            stream.destroy();
        });
        
        stream.on('end', function(end) {
            console.info("Stream ended, will attempt to reconnect in "+reconnectSleepSeconds+" seconds");
            clearTimeout(resetStream);
            setTimeout(function() {
              streamTweets(type, params, dataCallback, reconnectSleepSeconds * 2);
            }, reconnectSleepSeconds * 1000);
        });
        
    });   

}

TwitterBot.prototype.getTrackedList = function() {
    /* https://dev.twitter.com/docs/streaming-apis/parameters#track 
     * "A comma-separated list of phrases used to determine what Tweets will be delivered 
     * A phrase may be one or more terms separated by spaces, it will match if all of the terms in the phrase are present
     * Regardless of order and ignoring case
     * Commas as logical ORs, while spaces are equivalent to logical ANDs 
     */
      
    return allPossibleCombinations(this.config.search_terms);
}

// emitters: newTweet, existingTweet, newMention, newDirectMessage 

// -- private
function requireAuthentication(express, twitter, callback) {

    var server;
    express.get('/', twitter.gatekeeper('/login'), function(req, res){
        res.send('Authentification successfull');
        //console.info('Auth complete, closing authentication server.');
        server.close();
        if(typeof callback === 'function') {
            callback();
        }
    });
    express.get('/twauth', twitter.login());
    
    //console.info('Listening on 1200 for auth requests to Twitter');
    server = express.listen(1200);
}

function start(readyCallback, newTweetCallback) {
    (startPollingTweets.bind(this))(newTweetCallback);
    (streamKeywordTweets.bind(this))(newTweetCallback);
    (streamUserReplies.bind(this))(newTweetCallback);
    if(typeof readyCallback === 'function') {
        readyCallback(this.eventEmitter);
    }
} 
function allPossibleCombinations(array) {
  if (array.length === 0) {
    return [];
  }
   
  if (array.length === 1) {
    return array[0];
  }
  
  // Prevent parsing strings letter by letter
  array = array.map(function (item) {
      return item instanceof Array ? item : [ item ];
  });
  
  var result = [];
  var allOtherCombinations = allPossibleCombinations(array.slice(1));  // recur with the rest of array
  var current = array[0];
  
  for (var c in allOtherCombinations) {
    for (var i = 0; i < current.length; i++) {
      result.push(current[i] + " " + allOtherCombinations[c]);
    }
  }

  return result;
}
function streamKeywordTweets(newTweetCallback, reconnectSleepSeconds) {
    
    
    
}

function streamUserReplies(newTweetCallback) {
  
  
}



function getSQL(tableNames) {
  
    /* jshint ignore:start */
    var sql = [];
    sql['createSeenTweets'] = Util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.seen_tweets,
                              '(id INTEGER PRIMARY KEY, time DATETIME DEFAULT current_timestamp, text TEXT, ', 
                                'user_id INTEGER, username TEXT, action_taken TEXT, streamed BOOLEAN DEFAULT 0, ', 
                                'polled BOOLEAN DEFAULT 0, mention BOOLEAN DEFAULT 0)');
    sql['createSentTweets'] = Util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.sent_tweets,
                              '(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, related_tweet_id INTEGER)');
    sql['createAPILogin'] =   Util.format('CREATE TABLE IF NOT EXISTS %s ', tableNames.api_login,
                              '(id INTEGER PRIMARY KEY AUTOINCREMENT, access_token_key TEXT, access_token_secret TEXT)');
    
    /*sql['selectNewestAPI'] =     Util.format('SELECT * FROM %s ORDER BY id DESC LIMIT 1', table_names.api_login);                     
    sql['selectNewestTweet'] =   Util.format('SELECT id FROM %s WHERE streamed = 0 OR polled = 1 ORDER BY id DESC LIMIT 1', table_names.seen_tweets);
    sql['selectExistingTweet'] = Util.format("SELECT 1 as 'exist' FROM seen_tweets WHERE id = $tweet_id LIMIT 1";*/
    
    sql['updateActionTaken'] = Util.format('UPDATE %s SET action_taken = $action WHERE id = $id', tableNames.seen_tweets);
    sql['updatePolled'] =      Util.format('UPDATE %s SET polled = $polled WHERE id = $id', tableNames.seen_tweets);
    
    
    sql['insertSeenTweet'] = Util.format('INSERT INTO %s (id, text, user_id, username, streamed, polled, mention) ', tableNames.seen_tweets,
                             'VALUES ($id, $text, $user_id, $username, $streamed, $polled, $mention)');
    sql['logSentTweet'] =    Util.format('INSERT INTO %s (text, related_tweet_id) VALUES ($text, $related_id)', tableNames.sent_tweets);
    sql['insertAPILogin'] =  Util.format('INSERT INTO %s (access_token_key, access_token_secret) VALUES ($key, $secret)', tableNames.api_login);
    /* jshint ignore:end */
    
    return sql;
}

