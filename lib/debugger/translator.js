/**
 * @fileoverview
 * Transforms http://code.google.com/p/v8/wiki/DebuggerProtocol
 * to https://developers.google.com/chrome-developer-tools/docs/protocol/1.0
 **/

var async = require('async');
var RuntimeAgent = require('../runtime');
var runtimeAgent = new RuntimeAgent();
//var resolveReferences = require('./ref-resolver');
var logger = require('./logger');

var formatScript = function(script) {
    var endLine = script.lineOffset + script.lineCount - 1;
    var endColumn = 0;

    return {
        scriptId: script.id.toString(),
        url: script.name,
        startLine: script.lineOffset,
        startColumn: script.columnOffset,
        endLine: endLine,
        endColumn: endColumn
    };
};

/**
 * Wraps stack frames in devtools front-end format
 * @param {Array} callFrames The array with stack frames.
 **/
var wrapCallFrames = function(callFrames) {
    var result = [];
    for (var i = 0, len = callFrames.length; i < len; i++) {
        result.push(new CallFrameProxy(i, callFrames[i]));
    }
    return result;
};

var CallFrameProxy = function(ordinal, callFrame) {
    this.callFrameId = "{\"ordinal\":" + ordinal + ",\"injectedScriptId\":" + callFrame.func.scriptId + "}";

    this.functionName =
        (callFrame.func.type === "function" ?
            callFrame.func.name : callFrame.func.inferredName);

    this.location = {
        scriptId: String(callFrame.func.scriptId),
        lineNumber: callFrame.line,
        columnNumber: callFrame.column
    };

    this.scopeChain = this._wrapScopeChain(callFrame);
    this.this = runtimeAgent.wrapObject(callFrame.thisObject, "backtrace");
}

CallFrameProxy.prototype = {
    _wrapScopeChain: function(callFrame) {
        const GLOBAL_SCOPE = 0;
        const LOCAL_SCOPE = 1;
        const WITH_SCOPE = 2;
        const CLOSURE_SCOPE = 3;
        const CATCH_SCOPE = 4;

        var scopeTypeNames = {};
        scopeTypeNames[GLOBAL_SCOPE] = "global";
        scopeTypeNames[LOCAL_SCOPE] = "local";
        scopeTypeNames[WITH_SCOPE] = "with";
        scopeTypeNames[CLOSURE_SCOPE] = "closure";
        scopeTypeNames[CATCH_SCOPE] = "catch";

        var scopeChain = callFrame.scopes;
        var scopeChainProxy = [];
        var foundLocalScope = false;

        for (var i = 0; i < scopeChain.length; i++) {
            var _scope = scopeChain[i];
            var scope = {};
            scope.object = runtimeAgent.wrapObject(_scope, "backtrace");

            scope.type = scopeTypeNames[_scope.type];
            scopeChainProxy.push(scope);
        }
        return scopeChainProxy;
    }
};


module.exports = {
    emptyResult: function(callback) {
        var devtoolsFormat = {};
        callback(devtoolsFormat);
    },

    afterCompile: function(response, client, callback) {
        var script = response.body.script;
        callback({
            method: 'Debugger.scriptParsed',
            params: formatScript(script)
        });
    },

    scripts: function(response, client, callback) {
        var scripts = [];
        var scripts_ = response.body;

        for (var i = 0, len = scripts_.length; i < len; i++) {
            var script = scripts_[i];

            if (script.source) {
                 //It gets here if getScriptSource was the invoked function
                callback({
                    scriptSource: script.source
                });
                return;
            }

            scripts.push({
                method: 'Debugger.scriptParsed',
                params: formatScript(script)
            });
        }

        callback(scripts);
    },

    /**
     * breaking JS naming convention
     * in order to dynamicly translate
     * the v8 protocol based on the field `command`
     */
    setexceptionbreak: function(response, client, callback) {
        if (!response.success) {
            callback({
                error: {
                    description: 'Unable to schedule break in V8'
                }
            });
            return;
        }

        callback({});
    },

    setbreakpoint: function(response, client, callback) {
        if (!response.success) {
            logger.log('Error on setbreakpoint');
            callback();
            return;
        }

        var data = response.body;
        var result = {
            breakpoint: data.breakpoint, // for internal use
            breakpointId: data.script_name + ':' + data.line + ':' + data.column,
            locations: []
        };

        var locations = data.actual_locations;
        for (var i = 0, len = locations.length; i < len; i++) {
            var location = locations[i];
            result.locations.push({
                scriptId: location.script_id,
                lineNumber: location.line,
                columnNumber: location.column
            });
        }

        callback(result);
    },

    clearbreakpoint: function(response, client, callback) {
        //TODO Handle errors
        callback({});
    },

    breakpointResolved: function(response, client, callback) {
        var breakpointId = response.script.name + ':' +
        response.sourceLine + ':' + response.sourceColumn;

        callback({
            'method': 'Debugger.breakpointResolved',
            'params': {
                'breakpointId': breakpointId,
                'location': {
                    scriptId: response.script.id,
                    lineNumber: response.sourceLine,
                    columnNumber: response.sourceColumn
                }
            }
        });
    },

    scriptCollected: function(script, client, callback) {
        callback({
            //method: 'Debugger.script',
            //params: formatScript(script)
        });
    },


    backtrace: function(response, client, callback) {
        var body = response.body;

        var result = {
            method: 'Debugger.paused',
            params: {
                callFrames: [],
                reason: 'other'
            }
        };

        var requestScopes = {
            type: 'request',
            command: 'scopes',
            arguments: {
              inlineRefs: true
            }
        };

        //logger.log(body.frames);
        async.series({
            frames: function(callback) {
                for (var i = 0, len1 = body.frames.length; i < len1; i++) {
                    (function(index, l1) {
                        var frame = body.frames[index];

                        requestScopes.arguments.frameNumber = frame.index;

                        client.send(requestScopes, function(result) {
                            body.frames[index].scopes = result.body.scopes;
                            if (index == l1 - 1) {
                                callback(null, body.frames);
                            }
                        });
                    })(i, len1);
                }
            }
        }, function(err, results) {
            if (err) logger.log(err);
            result.params.callFrames = wrapCallFrames(results.frames);
            callback(result);
        });

        /*async.series({
            frames: function(callback) {
                for (var i = 0, len1 = body.frames.length; i < len1; i++) {
                    (function(index, l1) {
                        var frame = body.frames[index];
                        requestScopes.arguments.frameNumber = frame.index;

                        for (var j = 0, len2 = frame.scopes.length; j < len2; j++) {
                            (function(index2, l2) {
                                var scope = frame.scopes[index2];
                                requestScopes.arguments.number = scope.index;
                                //logger.log(requestScopes);
                                client.send(requestScopes, function(result) {
                                    body.frames[index].scopes[index2] = result.body;

                                    if (index == l1-1 && index2 == l2-1) {
                                        logger.log('ESOOOOOOOOOOOOOOOOO');
                                        callback(null, body.frames);
                                    }
                                    logger.log('Frame #' + index);
                                    logger.log(body.frames[index].scopes[index2].object.properties);
                                });
                           })(j, len2);
                        }
                    })(i, len1);
                }
            }
        },
        function(err, results) {
            results.frames.forEach(function(f) {
                logger.log(f.scopes);
            });
            //logger.log(results.frames);
            result.params.callFrames = wrapCallFrames(results.frames);
            return result;
        });*/
        //return result;
    },

    scope: function(response, client, callback) {
        callback(response);
    },

    scopes: function(response, client, callback) {
        callback(response);
    },

    break: function(evt, client, callback) {
        callback();
      /*
      received: {"method":"Debugger.breakpointResolved","params":{"breakpointId":"http://cdn.onswipe.com/swipecore/swipecore-0.5.6.js:4:0","location":{"scriptId":"230","lineNumber":4,"columnNumber":1}}}

received: {"method":"Debugger.paused","params":{"callFrames":
  [{"callFrameId":"{\"ordinal\":0,\"injectedScriptId\":5}",
    "functionName":"Utils",
    "location":{"scriptId":"230","lineNumber":4,"columnNumber":1},
    "scopeChain":[{ "object":{ "type":"object",
                              "objectId":"{\"injectedScriptId\":5,\"id\":1}",
                              "className":"Object",
                              "description":"Object"},
                    "type":"local"
                  },
                  {"object":{ "type":"object",
                              "objectId":"{\"injectedScriptId\":5,\"id\":2}",
                              "className":"Window",
                              "description":"Window"},
                   "type":"global"
                  }],
    "this":{"type":"object",
            "objectId":"{\"injectedScriptId\":5,\"id\":3}",
            "className":"Window",
            "description":"Window"}
    },
    {"callFrameId":"{\"ordinal\":1,\"injectedScriptId\":5}",
     "functionName":"",
     "location":{"scriptId":"230","lineNumber":711,"columnNumber":2},
     "scopeChain":[{"object":{  "type":"object",
                                "objectId":"{\"injectedScriptId\":5,\"id\":4}",
                                "className":"Window",
                                "description":"Window"},
                    "type":"global"
                  }],
      "this":{"type":"object",
              "objectId":"{\"injectedScriptId\":5,\"id\":5}",
              "className":"Window",
              "description":"Window"}
    }],
    "reason":"other"}}*/
    }
};
