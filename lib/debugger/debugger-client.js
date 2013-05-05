/**
 * Module dependencies.
 */
var net = require('net');
var translator = require('./translator');
var logger = require('./logger');
var V8Protocol = require('_debugger').Protocol;
/**
 * DebuggerClient
 * This file and the translator object
 * implements http://code.google.com/p/v8/wiki/DebuggerProtocol
 *
 * @param {Function} notify Notification function to send events
 * straight to DevTools frontend.
 * @constructor
 */

var DebuggerClient = module.exports = function(notify) {
    this.connection = null;
    this.connected = false;
    this.reqSequence = 0;

    /**
     * Stores callback functions so that
     * they can be invoked once a response
     * to a request arrives from v8
     */
    this.requests = {};

    this.notify = notify;
    this.queue = [];
    this.port = 5858;
    this.protocol = null;

    /**
     * This object keeps track
     * of the breakpoints identifiers
     * betweeen Chrome DevTools frontend and
     * the internal V8 Debugger Agent.
     *
     * Example:
     *  {
     *      't.js:6:0': 1,
     *      't.js:8:0': 2
     *  }
     */
    this.breakpoints = {};
};

(function() {
    /**
     * Callback function that gets invoked once
     * a connection to the debuggee process is established.
     *
     * @api private
     */
    this.onConnect = function() {
        this.connected = true;
        this.flushQueue();
    };

    /**
     * Handle v8 debug events, sending back to the
     * frontend the proper translated data object
     * through the notification mechanism.
     *
     * @param {Object} payload The payload of the v8 debug event
     * @api private
     */
    this.handleEvent = function(payload) {
        var self = this;

        if (payload.event != 'break' &&
            payload.event != 'exception') {

            if (!translator[payload.event]) {
                logger.log('webkit-devtools-agent: Translator function ' +
                ' not found for event: ' + payload.event);
                return;
            }

            translator[payload.event](payload, this, this.notify);
            return;
        }

        if (payload.event == 'exception') {

        } else {
            //notify breakpoint resolved
            translator.breakpointResolved(payload.body, this, this.notify);
        }

        //Gets stack frames
        this.getBacktrace(function(result) {
            logger.log(result);
            self.notify(result);
        });
    };

    /**
     * This callback function gets invoked by
     * nodejs v8 protocol implementation
     * once it receives the entire response
     * from the internal v8 debug agent.
     *
     * @param {Object} response The response serialized
     * by the nodejs implementation of the v8 remote debugger protocol.
     * @api private
     */
    this.onV8Response = function(response) {
        var self = this;
        var payload = response.body;
        //logger.log(response);
        if (payload.type == 'event') {
            this.handleEvent(payload);
        } else if (payload.type == 'response') {
            var callback = this.requests[payload.request_seq];
            if (callback) {
                translator[payload.command](payload, this, function(data)  {
                  callback(data);
                  delete self.requests[payload.request_seq];
                });
            } else {
                logger.log('webkit-devtools-agent: Unexpected '+
                'message was received, there is no callback function '+
                ' to handle it :( :');
                logger.log(response);
            }
        } else if ( response.headers.Type == 'connect') {
            logger.log(response.headers);
        } else {
            logger.log('webkit-devtools-agent: Unrecognized ' +
            'message type received by DebuggerAgent: ');
            logger.log(response);
        }
    };
    /**
     * Callback function to receive debug data coming out of
     * the debugee process.
     *
     * @param {Buffer} data Data sent by v8 debug agent
     * @api private
     */

    this.onData = function(data) {
        //logger.log(data + '');
        this.protocol.execute(data);
    };

    /**
     * Callback function for `close` events in the
     * connection to the debugee process.
     *
     * @api private
     */
    this.onClose = function() {
        this.connected = false;
        this.connection = null;
        logger.log('webkit-devtools-agent: Debugger ' +
        'client has closed the connection to the internal v8 debug agent');
    };

    /**
     * Callback function for `error` events in the
     * connection to the debuggee process.
     *
     * @param {Buffer} error JSON containing the error.
     * @api private
     */
    this.onError = function(error) {
        logger.log('webkit-devtools-agent: ');
        logger.log(error);
    };

    /**
     * Flushes the internal queue, sending
     * all the queued messages if
     * there is a valid connection to the
     * debugee process.
     *
     * @api private
     */
    this.flushQueue = function() {
        if (!this.connected) {
            return;
        }

        var queue = this.queue;
        for (var i = 0, len = queue.length; i < len; i++) {
            var message = JSON.stringify(queue[i]);

            this.connection.write('Content-Length: ' +
                message.length + '\r\n\r\n' + message)

            //removes message from the queue
            queue.splice(i, 1);
            i--;
            len--;
        }
    };

    /**
     * Sends out message to the debugee process
     * through an internal queue.
     *
     * @param {Object} data Object to be sent
     * @param {Function} callback Callback function
     * to invoke once the debug agent, in the debugee process,
     * get back to us with a response.
     *
     * @api public
     */
    this.send = function(data, callback) {
        this.reqSequence++;
        data.seq = this.reqSequence;

        /**
         * Once the response comes back, the
         * `callback` function is going to be invoked and
         * removed from the list of pending response handlers.
         */
        this.requests[data.seq] = callback;

        /**
         * This queue avoids some race conditions,
         * especially in the devtools front-end
         * initialization.
         */
        this.queue.push(data);

        //Flushes only if this.connected is true
        this.flushQueue();

        if (this.queue.length > 50) {
            logger.log('webkit-devtools-agent: Debugger client ' +
            'queue is too big. It could mean that the client was unable ' +
            'to establish a connection with the v8 debug agent. ' +
            'Restart the agent and start your debugging session again.');
        }
    };

    /**
     * Establishes a connection to the
     * internal v8 Debug Agent of the
     * debuggee process and sets up
     * the callbacks to some events.
     *
     * @param {Function} callback Callback function
     * @api public
     */
    this.connect = function(callback) {
        var self = this;
        this.protocol = new V8Protocol();
        this.protocol.onResponse = this.onV8Response.bind(this);

        this.connection = net.connect(this.port);
        this.connection.setEncoding('utf8');

        this.connection.on('connect', this.onConnect.bind(this));
        this.connection.on('data', this.onData.bind(this));
        this.connection.on('close', this.onClose.bind(this));
        this.connection.on('error', this.onError.bind(this));

        translator.emptyResult(callback);
    };

    /**
     * Disconnects from the debuggee process
     *
     * @param {Function} callback Callback function
     * @api public
     */
    this.disconnect = function(callback) {
        this.connection.end();
        callback();
    };

    /**
     * Defines pause-on-exception states.
     * Can be set to stop on `all` exceptions,
     * `uncaught` exceptions or no exceptions.
     * The initial state is none.
     *
     * Gotcha: V8 remote debugger protocol doesn't understand `none` as
     * break type, so we need to send `uncaught` and `enabled` as false
     * to represent `none`.
     *
     * @param {String} exceptionBreak Type of exception break
     * it can be `all` or `uncaught`.
     * @param {Function} callback Callback function to send back
     * the answer to this command. The response is returned
     * in the DevTools Remote Protocol format specified in:
     *  https://developers.google.com/chrome-developer-tools/docs/protocol/1.0/debugger#command-setPauseOnExceptions
     * @api public
     */
    this.setExceptionBreak = function(exceptionBreak, callback) {
        var request = {
            type: 'request',
            command: 'setexceptionbreak',
            arguments: {
                type: exceptionBreak === 'none' ? 'uncaught': exceptionBreak,
                enabled: exceptionBreak == 'none' ? false : true
            }
        };

        this.send(request, callback);
    };

    this.getScripts = function(scriptId, callback) {
        var self = this;
        var request = {
            type: 'request',
            command: 'scripts',
            arguments: {
                types: 4, //normal scripts
                includeSource: false
            }
        };

        if (scriptId) {
            request.arguments.ids = [scriptId];
            request.arguments.includeSource = true;
        }

        this.send(request, function(scripts) {
            if (scriptId) {
                callback(scripts);
            } else {
                for (var i = 0, len = scripts.length; i < len; i++) {
                    self.notify(scripts[i]);
                }
            }
        });
    };

    this.getScriptSource = function(params, callback) {
        var scriptId = params.scriptId;
        this.getScripts(scriptId, callback);
    };

    this.setBreakpoint = function(params, callback) {
        var self = this;
        var request = {
            type: 'request',
            command: 'setbreakpoint',
            arguments: {
                type: 'script',
                target: params.url,
                line: params.lineNumber,
                column: params.columnNumber,
                condition: params.condition
            }
        };

        this.send(request, function(result) {
            self.breakpoints[result.breakpointId] = result.breakpoint;
            delete result.breakpoint;
            callback(result);
        });
    };

    this.removeBreakpoint = function(params, callback) {
        var self = this;
        var request = {
            type: 'request',
            command: 'clearbreakpoint',
            arguments: {
                breakpoint: this.breakpoints[params.breakpointId]
            }
        };

        this.send(request, function(result) {
            delete self.breakpoints[params.breakpointId];
            callback(result);
        });
    };

    this.getBacktrace = function(callback) {
        var request = {
            type: 'request',
            command: 'backtrace',
            arguments: {
                inlineRefs: true,
                toFrame: 4 //After 3 stackframes v8 takes forever to return the frames.
            }
        };

        this.send(request, function(result) {
            logger.log(result);
            callback(result);
        });
    };
}).call(DebuggerClient.prototype);

