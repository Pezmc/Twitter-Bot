var libPath = require('../lib/_libPath.js');
var tweetLib = require('../' + libPath + '/tweet-lib');

describe('tweet-lib', function() {

    describe('+tweetMatchesArray', function() {
        it('should match a tweets text to a simple array', function() {
            var tweet = { text: "This is a test" }
            tweetLib.tweetMatchesArray(tweet, [ 'test' ]).should.be.true;
            tweetLib.tweetMatchesArray(tweet, [ 'invalid' ]).should.be.false;
        });
        
        it('should match a tweets text to a complex array', function() {
            var tweet = { text: "It is going to rain today?" }
            var match = [ [ 'rain', 'rainy' ], 'today' ]
            tweetLib.tweetMatchesArray(tweet, match).should.be.true;
            
            tweet.text = "Is it going to be sunny today?";
            tweetLib.tweetMatchesArray(tweet, match).should.be.false;
        }); 
        
        it('should match a tweets text to a nested array', function() {
            var tweet = { text: "It is going to rain today?" }
            var match = [ [ [ 'rain', 'rainy' ], [ 'sun', 'sunny' ] ], 'today' ];
            tweetLib.tweetMatchesArray(tweet, match).should.be.true;
            
            tweet.text = "Is it going to be sunny today?";
            tweetLib.tweetMatchesArray(tweet, match).should.be.true;
            
            tweet.text = "Is it going to be stormy today?";
            tweetLib.tweetMatchesArray(tweet, match).should.be.false;
        });        

        it('should ignore mentions (@keyword) if speficied', function() {
            var tweet = { text: "@brain How's the weather?" }
            var match = [ [ [ 'rain', 'rainy' ] ], 'weather' ];
            tweetLib.tweetMatchesArray(tweet, match, true).should.be.false;
            
            tweet.text = "@brain Is the weather rainy?";
            tweetLib.tweetMatchesArray(tweet, match, true).should.be.true;
            
            tweet.text = "How is the @weather is it rainy?";
            tweetLib.tweetMatchesArray(tweet, match, true).should.be.false;
        }); 
       
    });
    
    describe('+arrayToTwitterParams', function() {
    
        it('should return an array of the tracked terms suitable for use with streaming', function() {
            var input = ["twitter", "bot", "#node.js"];
            tweetLib.arrayToTwitterParams(input).should.containDeep(["twitter bot #node.js"]);
        });
        
        it('should merge each term together for and\'s', function() {
            var input = [
                ['#node', '#node.js'],
                ['#twitter-bot'], '#test'];
            var expected = ["#node #twitter-bot #test", "#node.js #twitter-bot #test"];
            tweetLib.arrayToTwitterParams(input).should.containDeep(expected);
        });
        
        it('should return all possible combinations of or\'s', function() {
            var input = [
                ['sun', 'sunny', 'warm'],
                ['weather', 'sky', 'here']
            ];
            var expected = ['sun weather', 'sunny weather', 'warm weather', 
                            'sun sky', 'sunny sky', 'warm sky', 'sun here',
                            'sunny here', 'warm here'];
                            
            var output = tweetLib.arrayToTwitterParams(input);
            output.should.containDeep(expected);
            output.length.should.equal(expected.length);
        });
        
        it('should handle nested arrays of or\'s', function() {
            var input = [
                [
                    ['sun', 'sunny'],
                    ['rain', 'rainy']
                ], 'weather'];
            var expected = ['sun weather', 'sunny weather', 'rain weather', 'rainy weather'];
            
            var output = tweetLib.arrayToTwitterParams(input);
            output.should.containDeep(expected);
            output.length.should.equal(expected.length);
        });
        
        it('should return an array of parameters if true is passed', function() {
            var input = [
                ['sun', 'sunny', 'warm'], 'weather'];
            var expected = [
                ['sun', 'weather'],
                ['sunny', 'weather'],
                ['warm', 'weather']
            ];
            
            var output = tweetLib.arrayToTwitterParams(input, true);
            output.should.containDeep(expected);
            output.length.should.equal(expected.length);
        });
    });
});