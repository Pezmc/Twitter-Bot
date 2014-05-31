var libPath = require('../lib/_libPath.js');
var tweetLib = require('../' + libPath + '/tweet-lib');

describe('tweet-lib', function() {

    describe('+tweetMatchesArray', function() {});
    
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