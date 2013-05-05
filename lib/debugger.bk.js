function DebuggerAgent(sendEvent, runtimeAgent) {
    this.sendEvent = sendEvent;
    this.enabled = false;
    this.runtimeAgent = runtimeAgent;

    if (typeof v8debugger != 'object') {
        var msg = 'DebuggerAgent: you need to run ' +
        'your nodejs app using --expose_debug_as=v8debugger to be able ' +
        'to use the debugger.';

        console.warn(msg);
    }
    this.executionState = null;
    this.pauseOnExceptions = 'none';
    this.Debug = v8debugger.Debug;
    this.paused = false;
}

var formatScript = function(script) {
    var lineEnds = script.line_ends;
    var lineCount = lineEnds.length;
    var endLine = script.line_offset + lineCount - 1;
    var endColumn;
    // V8 will not count last line if script source ends with \n.
    if (script.source[script.source.length - 1] === '\n') {
        endLine += 1;
        endColumn = 0;
    } else {
        if (lineCount === 1)
            endColumn = script.source.length + script.column_offset;
        else
            endColumn = script.source.length - (lineEnds[lineCount - 2] + 1);
    }

    return {
        scriptId: script.id.toString(),
        url: script.nameOrSourceURL(),
        startLine: script.line_offset,
        startColumn: script.column_offset,
        endLine: endLine,
        endColumn: endColumn,
        isContentScript: !!script.context_data && script.context_data.indexOf("injected") === 0
    };
};

var frameMirrorToJSCallFrame = function(frameMirror, callerFrame) {
       // Get function name.
    var func;
    try {
        func = frameMirror.func();
    } catch(e) {
    }
    var functionName;
    if (func) {
        functionName = func.name() || func.inferredName();
    }

    // Get script ID.
    var script = func.script();
    var scriptId = script && script.id();

    // Get location.
    var location  = frameMirror.sourceLocation();

    // Get this object.
    var thisObject = frameMirror.details_.receiver();

    // Get scope chain array in format: [<scope type>, <scope object>, <scope type>, <scope object>,...]
    var scopeChain = [];
    var scopeType = [];
    var ScopeType = v8debugger.ScopeType;

    for (var i = 0; i < frameMirror.scopeCount(); i++) {
        var scopeMirror = frameMirror.scope(i);
        var scopeObjectMirror = scopeMirror.scopeObject();

        var scopeObject;
        switch (scopeMirror.scopeType()) {
        case ScopeType.Local:
        case ScopeType.Closure:
            // For transient objects we create a "persistent" copy that contains
            // the same properties.
            scopeObject = {};
            // Reset scope object prototype to null so that the proto properties
            // don't appear in the local scope section.
            scopeObject.__proto__ = null;
            var properties = scopeObjectMirror.properties();
            for (var j = 0; j < properties.length; j++) {
                var name = properties[j].name();
                if (name.charAt(0) === ".")
                    continue; // Skip internal variables like ".arguments"
                scopeObject[name] = properties[j].value_;
            }
            break;
        case ScopeType.Global:
        case ScopeType.With:
        case ScopeType.Catch:
            scopeObject = scopeMirror.details_.object();
            break;
        }

        scopeType.push(scopeMirror.scopeType());
        scopeChain.push(scopeObject);
    }

    function evaluate(expression) {
        return frameMirror.evaluate(expression, false).value();
    }

    return {
        "scriptId": scriptId,
        "line": location ? location.line : 0,
        "column": location ? location.column : 0,
        "functionName": functionName,
        "thisObject": thisObject,
        "scopeChain": scopeChain,
        "scopeType": scopeType,
        "evaluate": evaluate,
        "caller": callerFrame
    };
};

var wrapCallFrames = function(callFrame, runtimeAgent) {
    if (!callFrame) {
        return false;
    }

    var result = [];
    var depth = 0;
    do {
        result.push(new CallFrameProxy(depth++, callFrame, runtimeAgent));
        callFrame = callFrame.caller;
    } while (callFrame);

    return result;
};

var CallFrameProxy = function(ordinal, callFrame, runtimeAgent) {
    this.callFrameId = "{\"ordinal\":" + ordinal + ",\"injectedScriptId\":" + callFrame.scriptId + "}";

    this.functionName =
        (callFrame.type === "function" ? 
            callFrame.functionName : "");

    this.location = {
        scriptId: String(callFrame.scriptId),
        lineNumber: callFrame.line,
        columnNumber: callFrame.column
    };

    this.scopeChain = this._wrapScopeChain(callFrame, runtimeAgent);
    this.this = runtimeAgent.wrapObject(callFrame.thisObject, "backtrace");
}

CallFrameProxy.prototype = {
    _wrapScopeChain: function(callFrame, runtimeAgent) {
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

        var scopeChain = callFrame.scopeChain;
        var scopeChainProxy = [];
        var foundLocalScope = false;
        for (var i = 0; i < scopeChain.length; i++) {
            var scope = {};
            scope.object = runtimeAgent.wrapObject(scopeChain[i], "backtrace");

            var scopeType = callFrame.scopeType[i];
            scope.type = scopeTypeNames[scopeType];
            scopeChainProxy.push(scope);
        }
        return scopeChainProxy;
    }
};

(function() {

    this.causesRecompilation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.supportsNativeBreakpoints = function(params, sendResult) {
        sendResult({result: false});
    };

    this.canSetScriptSource = function(params, sendResult) {
        sendResult({result: true});
    };

    this.enable = function(params, sendResult) {
        var self = this;
        this.enabled = true;

        var scripts = this.Debug.scripts();

        for (var i = 0, len = scripts.length; i < len; i++) {
            var script = scripts[i];
            if (!script.name) {
                continue;
            }

            this.sendEvent({
                method: 'Debugger.scriptParsed',
                params: formatScript(script)
            });
        }
        sendResult({result: this.enabled});

        this.Debug.setListener(function(eventType, executionState, eventData, data) {
            var DebugEvent = self.Debug.DebugEvent;
            if (self.paused) { return; }
            self.executionState = eventData.executionState();
            switch(eventType) {
                case DebugEvent.AfterCompile:
                case DebugEvent.BeforeCompile:
                case DebugEvent.NewFunction:
                case DebugEvent.ScriptCollected:
                    break;
                case DebugEvent.Break:
                    try {
                    console.log('por aqui 1');
                    console.log(self.currentCallFrame());
                    console.log('por aqui 2');
                    self.sendEvent({
                        method: 'Debugger.paused',
                        params: {
                            callFrames: wrapCallFrames(self.currentCallFrame(), self.runtimeAgent),
                            reason: 'other'
                        }
                    });

                    self.sendEvent({
                        method: 'Debugger.breakpointResolved',
                        params: {
                            breakpointId: eventData.breakPointsHit()[0].script_break_point().number().toString(),
                            location: {
                                columnNumber: eventData.sourceColumn(),
                                lineNumber: eventData.sourceLine(),
                                scriptId: eventData.func().script().id().toString()
                            }
                        }
                    });
                    } catch(e) {
                        console.log('exceptionnnnnnnnn');
                        console.log(e);
                        console.log(e.stack);
                    }

                    break;
                case DebugEvent.Exception:
                    self.sendEvent({
                        method: 'Debugger.paused',
                        params: {
                            callFrames: wrapCallFrames(self.currentCallFrame(), self.runtimeAgent),
                            reason: 'exception'
                        }
                    });
                    break;
            }
            console.log('Is break on execution? ' + self.Debug.isBreakOnException());
            if (!self.paused) {
                process.nextTick(self.pause());
            }
            console.log('Is break on execution? ' + self.Debug.isBreakOnException());

        });
    };

    this.disable = function(params, sendResult) {
        this.enabled = false;
        sendResult({});
    };

    this.setBreakpointsActive = function(params, sendResult) {
        this.Debug.debuggerFlags().breakPointsActive.setValue(params.active);
        sendResult(this.Debug.debuggerFlags().breakPointsActive.getValue());
    };

    this.setBreakpointByUrl = function(params, sendResult) {
        var breakId = this.Debug.setScriptBreakPointByName( params.url,
                                                            params.lineNumber,
                                                            params.columnNumber,
                                                            params.condition,
                                                            1);
        var locations = this.Debug.findBreakPointActualLocations(breakId);
        if (!locations.length) {
            console.log('Unable to set breakpoint by URL');
            return;
        }

        sendResult({
            breakpointId: breakId.toString(),
            locations: [{
                lineNumber: locations[0].line,
                columnNumber: locations[0].column,
                scriptId: locations[0].script_id.toString()
            }]
        });
    };

    this.setBreakpoint = function(params, sendResult) {
        var breakId = this.Debug.setScriptBreakPointById(params.scriptId,
                                                         params.lineNumber,
                                                         params.columnNumber,
                                                         params.condition);

        var locations = Debug.findBreakPointActualLocations(breakId);
        if (!locations.length) {
            console.log('Unable to set breakpoint');
            return;
        }

        sendResult({
            breakpointId: breakId.toString(),
            locations: [{
                lineNumber: locations[0].line,
                columnNumber: locations[0].column,
                scriptId: locations[0].script_id.toString()
            }]
        });
    };

    this.removeBreakpoint = function(params, sendResult) {
        var removed = this.Debug.findBreakPoint(params.breakpointId, true);
        if (removed) {
            sendResult({result: true});
        } else {
            sendResult({result: false});
        }
    };

    this.continueToLocation = function(params, sendResult) {
        this.setBreakpoint(params, sendResult);
    };

    this.stepOver = function(params, sendResult) {
        if (!this.paused || !this.executionState) {
            return;
        }
        console.log(this.executionState);
        this.executionState.prepareStep(this.Debug.StepAction.StepNext, 1);
        sendResult({});
    };

    this.stepInto = function(params, sendResult) {
        this.executionState.prepareStep(this.Debug.StepAction.StepIn, 1);
        sendResult({});
    };

    this.stepOut = function(params, sendResult) {
        this.executionState.prepareStep(this.Debug.StepAction.StepOut, 1);
        sendResult({});
    };

    this.pauseOnNextStatement = function(pause) {
        //this.paused = true;
        //this.Debug.breakExecution();
    };

    this.pause = function(params, sendResult) {
        var self = this;
        return function() {
            self.paused = true;
            if (typeof sendResult == 'function') {
                sendResult({});
            }
            self.Debug.breakExecution();
        };
    };

    this.resume = function(params, sendResult) {
        //releaseObjectGroup "backtrace"
        this.executionState = null;
        this.paused = false;
        sendResult({});
        this.sendEvent({
            method: 'Debugger.resumed'
        });
    };


    this.setScriptSource = function(params, sendResult) {
        var scripts = this.Debug.scripts();
        var scriptToEdit = null;

        for (var i = 0, len = scripts.length; i < len; i++) {
            if (scripts[i].id == params.scriptId) {
                scriptToEdit = scripts[i];
                break;
            }
        }

        if (!scriptToEdit) {
            console.warn('Debugger.setScriptSource: Script not found');
            return;
        }

        var changeLog = [];
        var result = this.Debug.LiveEdit.SetScriptSource( scriptToEdit,
                                                    params.scriptSource,
                                                    params.preview, changeLog);
        sendResult({
            result: result,
            callFrames: wrapCallFrames(this.currentCallFrame(), this.runtimeAgent),
        });
    };

    this.getScriptSource = function(params, sendResult) {
         var scripts = this.Debug.scripts();

        for (var i = 0, len = scripts.length; i < len; i++) {
            var script = scripts[i];
            if (params.scriptId == script.id) {
                sendResult({ scriptSource: script.source });
                return;
            }
        }
    };

    this.setPauseOnExceptions = function(params, sendResult) {
        this.pauseOnExceptions = params.state;

        if (this.pauseOnExceptions == 'uncaught') {
            this.Debug.setBreakOnUncaughtException();
        } else {
            this.Debug.clearBreakOnUncaughtException();
        }

        if (this.pauseOnExceptions == 'all') {
            this.Debug.setBreakOnException();
        } else {
            this.Debug.clearBreakOnException();
        }

        sendResult({});
    };

    this.evaluateOnCallFrame = function(params, sendResult) {
        
    };

    this.currentCallFrame = function() {
        var frameCount = this.executionState.frameCount();
        if (frameCount === 0) {
            console.warn('DebuggerAgent.evaluateOnCallFrame: ' +
            'There a not stack frames to evaluate the expression');
            return;
         }

        var topFrame;
        for (var i = frameCount - 1; i >= 0; i--) {
            var frameMirror = this.executionState.frame(i);
            topFrame = frameMirrorToJSCallFrame(frameMirror, topFrame);
        }

        return topFrame;
    };

}).call(DebuggerAgent.prototype);

module.exports = DebuggerAgent;
