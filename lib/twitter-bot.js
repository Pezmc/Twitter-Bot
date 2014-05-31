// Internal
var Pjson = require('../package.json');
var TwitterEventEmitter = require('./twitter-event-emitter');
var merge = require('./merge');
var tweetLib = require('./tweet-lib');

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
    var defaultConfig = merge.clone(DEFAULT_CONFIG, true);  
          
    // Special case as Merge is recursive
    var optionsDefined = options && typeof options !== undefined;
    if(optionsDefined && typeof options.search_terms !== undefined) {
        defaultConfig.search_terms = [];
    }
     
    var config = merge.merge(defaultConfig, options, true);
    var defaultObjects = {
        twitter: new Twitter(config.twitter_config),
        dbi: new DBWrapper(config.dbi_config.type, config.dbi_config.params),
        express: new Express()
    };
    
    this.config = merge.merge(defaultObjects, config);    
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
    var authTwitter = authenticateTwitter.bind(this);
    
    var authCallback = function() {
        var begin = start.bind(this);
        begin(readyCallback, newTweetCallback);
    }.bind(this);
    
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
    ], authTwitter(authCallback));

};

function authenticateTwitter(callback) {
    var me = this; // using bind ends up very nested
    var getAPIDetails = getAPILoginDetails.bind(me);
    getAPIDetails(function(err, result) {
        
        if(result) {
            //console.info('Using stored authentication');
            var twit = me.getTwitter();
            twit.options.access_token_key = result.access_token_key;
            twit.options.access_token_secret = result.access_token_secret;

            callback();
        } else {
            //console.info('Authentication is needed before bot can start.');
            (requireAuthentication.bind(me))(callback);
        }
    });    
}

function getAPILoginDetails(callback) {
    var select = this.getDB().getSelect().from(this.getTableName('api_login'))
                   .order('id', 'DESC')
                   .limit(1);

    this.getDB().fetchOne(select, function(err, result) {
        callback(err, result);
    });
};

// Connect to a twitter stream
TwitterBot.prototype.streamTweets = function(type, params, dataCallback, reconnectSleepSeconds) {
    if(typeof reconnectSleepSeconds === 'undefined')
        reconnectSleepSeconds = this.config.stream.wait_seconds_on_disconnect;
  
    var botInstance = this;
  
    this.config.twitter.stream(type, params, function(stream) {
        console.info("Connected to twitter stream");
        
        var resetStream = setTimeout(function() {
            console.info("Restarting stream as it has been open for " + botInstance.config.stream.force_reconnect_minutes + "minutes");
            stream.destroy();
        }, botInstance.config.stream.force_reconnect_minutes * 60000);
        
        stream.on('data', function(data) {
        
            // reset done here as 'connect' fires even on rejection
            reconnectSleepSeconds = botInstance.stream.wait_seconds_on_disconnect;
             
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
                botInstance.streamTweets(type, params, dataCallback, reconnectSleepSeconds * 2);
            }, reconnectSleepSeconds * 1000);
        });
        
    });   

}

TwitterBot.prototype.getTrackedList = function(returnArray) {
    return tweetLib.arrayToTwitterParams(this.config.search_terms, returnArray);
}

// emitters: newTweet, existingTweet, newMention, newDirectMessage 

// -- private
function requireAuthentication(callback) {

    var express = this.config.express;
    var twitter = this.config.twitter;
    
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

  return result;
}
function streamKeywordTweets(newTweetCallback, reconnectSleepSeconds) {
TwitterBot.prototype.isMatchingTweet = function(tweet) {
    if(!tweet || !tweet.text) return false;
    
    return tweetMatchesArray(tweet.text, this.getTrackedList(true), true);/*
           && !arrayInTweetString(tweet.user.screen_name, ignored_users)
           && !arrayInTweetString(tweet.text, ignored_keywords)    */
}
    
    
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

