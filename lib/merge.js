exports.merge = function(defaults, options, recursive) {
    if (recursive === undefined) {
        recursive = false;
    }
    defaults = defaults || {};
    if (options && typeof options === 'object') {
        var keys = Object.keys(options);
        for (var i = 0, len = keys.length; i < len; i++) {
            var k = keys[i];
            if (options[k] !== undefined) {
                if (recursive && (options[k].isArray || arrayLikeObject(options[k]))) {
                    defaults[k] = exports.merge(defaults[k], options[k], recursive);
                } else {
                    defaults[k] = options[k];
                }
            }
        }
    }
    return defaults;
}

// array like objects (objects that are not another class)
function arrayLikeObject(o) {
    return !!(typeof o === 'object' && o.constructor.name === 'Object');
}

exports.clone = function(x, recursive) {
    if (x === null || x === undefined) {
        return x;
    }
    if (x.clone) {
        return x.clone();
    }
    if (x.constructor == Array) {
        var r = [];
        for (var i = 0, n = x.length; i < n; i++) {
            r.push(clone(x[i]));
        }
        return r;
    }
    if (typeof x === 'object') {
        var copy = {};
        var keys = Object.keys(x);
        for (var i = 0, len = keys.length; i < len; i++) {
            var k = keys[i];
            if (recursive && (x[k].isArray || arrayLikeObject(x[k]))) {
                copy[k] = exports.clone(x[k], recursive);
            } else {
                copy[k] = x[k];
            }
        }
        return copy;
    }
}