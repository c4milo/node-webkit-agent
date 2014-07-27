var underscore = require('underscore');

var helpers = underscore;
module.exports = helpers;

var primitiveTypes = {
    undefined: true,
    boolean: true,
    number: true,
    string: true
};

var isPrimitiveValue = function(object) {
    return primitiveTypes[typeof object];
};

helpers.mixin({ isPrimitiveValue: isPrimitiveValue });

var subtype = function(obj) {
    if (obj === null) return "null";

    var type = typeof obj;
    if (helpers.isPrimitiveValue(obj)) return null;

    if (helpers.isArray(obj)) return "array";
    if (helpers.isRegExp(obj)) return "regexp";
    if (helpers.isDate(obj)) return "date";

    // FireBug's array detection.
    try {
        if (Object.prototype.toString.call(obj) === "[object Arguments]" &&
            isFinite(obj.length)) {
            return "array";
        }
    } catch (e) {
    }
  return null;
};

helpers.mixin({ subtype: subtype });

var describe = function(obj) {
    if (helpers.isPrimitiveValue(obj)) return null;

    var subtype = helpers.subtype(obj);

    if (subtype === "regexp") return '' + obj;
    if (subtype === "date") return '' + obj;

    if (subtype === "array") {
        var className = 'array ';
        if (typeof obj.length === "number")
            className += "[" + obj.length + "]";
        return className;
    }

    if (typeof obj === "function") return "" + obj;

    if (helpers.isObject(obj)) {
        // In Chromium DOM wrapper prototypes will have Object as their constructor name,
        // get the real DOM wrapper name from the constructor property.
        var constructorName = obj.constructor && obj.constructor.name;
        if (constructorName)
            return constructorName;
    }
    return '' + obj;
};

var decycle = function(object, recursive) {
'use strict';

//Taken from https://github.com/douglascrockford/JSON-js/blob/master/cycle.js

// Make a deep copy of an object or array, assuring that there is at most
// one instance of each object or array in the resulting structure. The
// duplicate references (which might be forming cycles) are replaced with
// an object of the form
//      {$ref: PATH}
// where the PATH is a JSONPath string that locates the first occurance.
// So,
//      var a = [];
//      a[0] = a;
//      return JSON.stringify(JSON.decycle(a));
// produces the string '[{"$ref":"$"}]'.

// JSONPath is used to locate the unique object. $ indicates the top level of
// the object or array. [NUMBER] or [STRING] indicates a child member or
// property.

    var objects = [],   // Keep a reference to each unique object or array
        paths = [];     // Keep the path to each unique object or array

    return (function derez(value, path, deep) {

// The derez recurses through the object, producing the deep copy.

    var i,          // The loop counter
        name,       // Property name
        nu;         // The new object or array

    switch (typeof value) {
        case 'object':

// typeof null === 'object', so get out if this value is not really an object.

            if (!value) {
                return null;
            }

// If the value is an object or array, look to see if we have already
// encountered it. If so, return a $ref/path object. This is a hard way,
// linear search that will get slower as the number of unique objects grows.

            for (i = 0; i < objects.length; i += 1) {
                if (objects[i] === value) {
                    return {$ref: paths[i]};
                }
            }

// Otherwise, accumulate the unique value and its path.

            objects.push(value);
            paths.push(path);

// If it is an array, replicate the array.

            if (Object.prototype.toString.apply(value) === '[object Array]') {
              nu = [];
                if (deep !== undefined){
                  deep++;
                }
                if (deep === undefined || deep < 2) {
                  for (i = 0; i < value.length; i += 1) {
                    try {
                      typeof value[i]
                    } catch (err) {
                      continue;
                    }
                    nu[i] = derez(value[i], path + '[' + i + ']',deep);
                  }
                }
            } else {

// If it is an object, replicate the object.

                nu = {};
                if (deep !== undefined){
                  deep++;
                }

                if (deep === undefined || deep < 2) {
                  for (name in value) {
                    try {
                      typeof value[name]
                    } catch (err) {
                      continue;
                    }
                    if (Object.prototype.hasOwnProperty.call(value, name)) {
                      nu[name] = derez(value[name],
                          path + '[' + JSON.stringify(name) + ']',deep);
                    }
                  }
                }
            }
            return nu;
            case 'number':
            case 'string':
            case 'boolean':
                return value;
            }
        }(object, '$', ((recursive == false) ? 0 : undefined)));
};

helpers.mixin({ decycle: decycle });
helpers.mixin({ describe: describe });


