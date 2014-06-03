[![Build Status](https://travis-ci.org/Pezmc/Twitter-Bot.svg?branch=master)](https://travis-ci.org/Pezmc/Twitter-Bot)
[![Coverage Status](https://coveralls.io/repos/Pezmc/Twitter-Bot/badge.png)](https://coveralls.io/r/Pezmc/Twitter-Bot)
[![Code Climate](https://codeclimate.com/github/Pezmc/Twitter-Bot.png)](https://codeclimate.com/github/Pezmc/Twitter-Bot)
[![Dependency Status](https://gemnasium.com/Pezmc/Twitter-Bot.svg)](https://gemnasium.com/Pezmc/Twitter-Bot)

Twitter-Bot
===========

A twitter bot module for node.js, this is a work in process.

The key objective is to wrap the twitter search and user polling and streaming API with an event driven system for simplictic bot building.

####For example

```javascript
var searchTerms = ["node.js", "#nodejs"];
TwitterBot.start(searchTerms, function() {
  TwitterBot.on('NewTweetSeen', function(tweet) {
    console.log(tweet);
    TwitterBot.sendReply(tweet, 'Hi there, nice to meet you.');
  });
  
  TwitterBot.on('OldTweetSeen', function(tweet) {
    console.log(tweet);
  });
});
```
