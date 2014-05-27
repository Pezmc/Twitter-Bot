// To enablecoverage testing set the environment variable TWITTER_BOT_COV = 1 
var libPath = process.env['TWITTER_BOT_COV'] ? './lib-cov' : './lib';

module.exports = require(libPath + '/twitter-bot');