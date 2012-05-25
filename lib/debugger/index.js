/**
 * Module dependencies.
 */
var DebuggerClient = require('./debugger-client');

/**
 * DebuggerAgent
 *
 * This file implements
 * https://developers.google.com/chrome-developer-tools/docs/protocol/1.0/debugger
 *
 * @param {Number} debuggee Process ID of the debuggee nodejs process.
 * @constructor
 */
var DebuggerAgent = module.exports = function(debuggee) {
    this.enabled = false;
    this.debuggee = debuggee; //process being debugged
    this.pauseOnExceptions = 'none'; //possible values are: none, all, uncaught
};

(function(){
    /**
     * Initializes agent.
     * @api public
     */
    this.initialize = function(notify) {
        this.notify = notify;
        this.client = new DebuggerClient(this.notify);
    };

    this.setPauseOnExceptions = function(params, sendResult) {
        var self = this;
        this.pauseOnExceptions = params.state;

        self.client.setExceptionBreak(this.pauseOnExceptions, function(data) {
            sendResult(data);
        });
    };

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
        if (this.enabled) {
            return;
        }

        process.kill(this.debuggee, 'SIGUSR1');

        setTimeout(function() {
            self.client.connect(function(data) {
                self.client.getScripts();
                self.enabled = true;
            });
        }, 1000);
    };

    this.disable = function(params, sendResult) {
        var self = this;
        this.client.disconnect(function(result) {
            self.enabled = false;
            sendResult(result);
        });
    };

    this.setBreakpointByUrl = function(params, sendResult) {
        var self = this;
        this.client.setBreakpoint(params, function(breakId) {
            sendResult();
        });
    };


}).call(DebuggerAgent.prototype);

