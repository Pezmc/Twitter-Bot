
var DBWrapper = require('node-dbi').DBWrapper; 
var Twitter = require('twitter');
var pjson = require('../package.json');
var util = require('util');

function merge(defaults, options, recursive) {
  if(recursive === undefined) {
      recursive = false;
  }
      
	defaults = defaults || {};
	if (options && typeof options === 'object') {
		var keys = Object.keys(options);
		for (var i = 0, len = keys.length; i < len; i++) {
			var k = keys[i];
			if (options[k] !== undefined) {			
        // array like objects (objects that are not another class)
        arrayLikeObject = (typeof options[k] === 'object' && 
                          options[k].constructor.name === 'Object');
        
        if (recursive && (options[k].isArray || arrayLikeObject)) {
           defaults[k] = merge(defaults[k], options[k], recursive);
        } else {
           defaults[k] = options[k];
        }
		  }
		}
	}
	return defaults;
}

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
        
    // Special case as merge is recursive
    var optionsDefined = options && typeof options !== undefined;
    if(optionsDefined && typeof options.search_terms !== undefined) {
        defaultConfig.search_terms = [];
    }
     
    var config = merge(defaultConfig, options, true);
    var defaultObjects = {
        twitter: new Twitter(config.twitter_config),
        dbi: new DBWrapper(config.dbi_config.type, config.dbi_config.params)
    };
    
    this.config = merge(defaultObjects, config);    
    this.sql = getSQL(this.config.dbi_config.tables);
}
module.exports = TwitterBot;

TwitterBot.prototype.getDB = function() {
    return this.config.dbi;    
}

TwitterBot.prototype.getTwitter = function() {
    return this.config.twitter;    
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
  
  /*sql['selectNewestAPI'] =     util.format('SELECT * FROM %s ORDER BY id DESC LIMIT 1', table_names.api_login);                     
  sql['selectNewestTweet'] =   util.format('SELECT id FROM %s WHERE streamed = 0 OR polled = 1 ORDER BY id DESC LIMIT 1', table_names.seen_tweets);
  sql['selectExistingTweet'] = util.format("SELECT 1 as 'exist' FROM seen_tweets WHERE id = $tweet_id LIMIT 1";*/
  
  sql['updateActionTaken'] = util.format('UPDATE %s SET action_taken = $action WHERE id = $id', table_names.seen_tweets);
  sql['updatePolled'] =      util.format('UPDATE %s SET polled = $polled WHERE id = $id', table_names.seen_tweets);
  
  
  sql['insertSeenTweet'] = util.format('INSERT INTO %s (id, text, user_id, username, streamed, polled, mention) ', table_names.seen_tweets,
                           'VALUES ($id, $text, $user_id, $username, $streamed, $polled, $mention)');
  sql['logSentTweet'] =    util.format('INSERT INTO %s (text, related_tweet_id) VALUES ($text, $related_id)', table_names.sent_tweets);
  sql['insertAPILogin'] =  util.format('INSERT INTO %s (access_token_key, access_token_secret) VALUES ($key, $secret)', table_names.api_login);
  /* jshint ignore:end */
  
  return sql;
}