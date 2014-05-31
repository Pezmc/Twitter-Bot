exports.tweetMatchesArray = function(tweet, array, ignoreMentions) {
    var string = tweet.text;

    if(typeof ignoreMentions === 'undefined')
        ignoreMentions = false;

    var match = true;
    for(var i=0; i<array.length; i++) {
        
        // every item in array, should match against the tweet
        match = match && arrayInString(array[i], string, ignoreMentions);
                
    }
    
    return match;
};

function arrayInString(array, string, ignoreMentions) {
  
  if(!(array instanceof Array)) {
      array = [ array ];
  }
  
  for(var i = 0; i < array.length; i++) {
  
    // item is an array, one of the array items can match
    var item = array[i];
    
    if(item instanceof Array) {
        if(arrayInString(item, string, ignoreMentions)) {
            return true;
        }
    } else {
        if(stringInString(item, string)) {
          if(!ignoreMentions) return true;
          else { 
            // note double escape and trim due to trailing spaces
            var re = new RegExp('@\\w*' + item.trim(),'i');
            if(!re.test(string))
                return true;
          }
        }
    }
    
  }
  
  return false;
}

function stringInString(needle, haystack) {  
    return haystack.toLowerCase().indexOf(needle.toLowerCase()) != -1;
}

/* https://dev.twitter.com/docs/streaming-apis/parameters#track 
 * A comma-separated list of phrases used to determine what Tweets will be delivered 
 * A phrase may be one or more terms separated by spaces, it will match if all of the terms in the phrase are present
 * Regardless of order and ignoring case
 * Commas as logical ORs, while spaces are equivalent to logical ANDs 
 */
exports.arrayToTwitterParams  = function(array, returnArray) {
    return allPossibleCombinations(array, returnArray);
}

// Adapted from http://stackoverflow.com/questions/4331092/finding-all-combinations-of-javascript-array-values
function allPossibleCombinations(array, returnArray) {
  if(typeof returnArray === undefined)
      returnArray = false;

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
      var val = current[i];
      // prevent string itteration
      if(!(val instanceof Array)) {
          val = [ val ];
      }
      
      for(var j = 0; j < val.length; j++) {
        if(returnArray) {
          result.push([val[j]].concat(allOtherCombinations[c]));
        } else {  
          result.push(val[j] + " " + allOtherCombinations[c]);
        }  
      }
    }
  }

  return result;
}
