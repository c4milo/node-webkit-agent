/**
 * Module dependencies.
 */
var net = require('net');
var util = require('util');
var translator = require('./translator');
var V8Protocol = require('_debugger').Protocol;

/**
 * DebuggerClient
 * This file implements http://code.google.com/p/v8/wiki/DebuggerProtocol
 * along with the `translator` object
 *
 * @param {Function} notify Notification function to send events
 * straight to DevTools frontend.
 * @constructor
 */

var DebuggerClient = module.exports = function(notify) {
    this.connection = null;
    this.connected = false;
    this.reqSequence = 0;
    this.requests = {};
    this.notify = notify;
    this.queue = [];
    this.port = 5858;
    this.protocol = null;
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
     * This callback function gets invoked by
     * nodejs v8 protocol implementation
     * once it receives the entire response
     * from v8 debug agent.
     *
     * @param {Object} response The response serialized
     * by the nodejs implementation of the v8 remote debugger protocol.
     * @api private
     */
    this.onV8Response = function(response) {
        var payload = response.body;
        //console.log(payload);

        if (payload.type == 'event') {
            if (!translator[payload.event]) {
                console.warn('webkit-devtools-agent: Translator function ' +
                ' not found for event: ' + payload.event);
                return;
            }

            this.notify(translator[payload.event](payload));
        } else if (payload.type == 'response') {
            var callback = this.requests[payload.request_seq];
            if (callback) {
                callback(translator[payload.command](payload));

                delete this.requests[payload.request_seq];
            } else {
                console.warn('webkit-devtools-agent: Unexpected '+
                'message was received, there is no callback function '+
                ' to handle it :( :');
                console.warn(payload);
            }
        } else {
            console.warn('webkit-devtools-agent: Unrecognized ' +
            'message type received by DebuggerAgent: ');
            console.warn(payload);
        }
    };
    /**
     * Callback function to received debug data coming out of
     * the debugee process.
     *
     * @param {Buffer} data Data sent by v8 debug agent
     * @api private
     */

    this.onData = function(data) {
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
    };

    /**
     * Callback function for `error` events in the
     * connection to the debuggee process.
     *
     * @param {Buffer} error JSON containing the error.
     * @api private
     */
    this.onError = function(error) {
        console.error(error);
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
            console.warn('webkit-devtools-agent: Debugger client ' +
            'queue is too big. It could mean that the client was unable ' +
            'to establish a connection with the v8 debug agent. ' +
            'Restart the agent and start your debugging session again.');
        }
    };

    /**
     * Establishes a connection to the
     * Debug Agent of the debuggee process and
     * sets up the callbacks to some events.
     *
     * @param {Function} callback Callback function
     * @api public
     */
    this.connect = function(callback) {
        this.protocol = new V8Protocol();
        this.protocol.onResponse = this.onV8Response.bind(this);

        this.connection = net.connect(this.port);
        this.connection.setEncoding('utf8');

        this.connection.on('connect', this.onConnect.bind(this));
        this.connection.on('data', this.onData.bind(this));
        this.connection.on('close', this.onClose.bind(this));
        this.connection.on('error', this.onError.bind(this));

        callback(translator.emptyResult());
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
     * Defines pause on exceptions state.
     * Can be set to stop on `all` exceptions,
     * `uncaught` exceptions or no exceptions.
     * Initial pause on exceptions state is none.
     *
     * Gotcha: V8 remote debugger protocol doesn't understand `none` as
     * break type, so we need to send `uncaught` and `enabled` equaling false
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

    this.getScripts = function() {
        var self = this;
        var request = {
            type: 'request',
            command: 'scripts',
            arguments: {
                types: 4, //normal scripts
                includeSource: true
            }
        };

        this.send(request, function(scripts) {
            for (var i = 0, len = scripts.length; i < len; i++) {
                self.notify(scripts[i]);
            }
        });
    };
}).call(DebuggerClient.prototype);

