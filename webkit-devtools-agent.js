#!/usr/bin/env node
//var Debugger = require('./lib/debugger');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

var DevToolsAgentProxy = module.exports = function () {
    this.wss = null;
    this.backend = null;
    this.frontend = null;
    this.debuggerAgent = null;
    this.port = process.argv[2] || 9999;
    this.bind_to = process.argv[3] || '0.0.0.0';
    this.ipc_port = process.argv[4] || 3333;
    this.verbose = process.argv[5] || false;
};

(function () {
    process.on('uncaughtException', function (err) {
        console.error('webkit-devtools-agent: Websockets service uncaught exception: ');
        console.error(err.stack);
    });

    this.onFrontendMessage = function (message) {
        var self = this;
        var data;
        try {
            data = JSON.parse(message);
        } catch(e) {
            console.log(e.stack);
        }
        var command = data.method.split('.');
        var domainName = command[0];

        if (domainName !== 'Debugger') {
            this.backend.send(message);
            return;
        }

        var id = data.id;
        var method = command[1];
        var params = data.params;

        /*if (!this.debuggerAgent[method]) {
            console.warn('%s is not implemented', data.method);
            return;
        }

        this.debuggerAgent[method](params, function(result) {
            var response = {
                id: id,
                result: result
            };
            self.frontend.send(JSON.stringify(response));
        });*/
    };
    this.frontends = [];
    this.onFrontendConnection = function(socket) {
        var self = this;
        socket.on('message', this.onFrontendMessage.bind(this));
        socket.on('close', (function(){
          for(var i =0; i<this.frontends.length;i++){
            if (this.frontends[i] === socket){
              this.frontends.splice(i,1);
            }
          }
        }).bind(this));
        this.frontends.push(socket);

        if (this.verbose) {
            console.log('webkit-devtools-agent: new frontend connection!');
        }

        //this.debuggerAgent = new Debugger(process.env.PARENT_PID);

        /*this.debuggerAgent.initialize(function(notification) {
            self.frontend.send(JSON.stringify(notification));
        });*/
    };

    /**
     * Callback function invoked once
     * a connection has been established
     * with the backend process. It also
     * initializes the websocket service
     * for DevTools frontend to connect with.
     *
     * @api private
     */
    this.onBackendOpen = function () {
        //Starts websockets server for DevTools frontend
        this.wss = new WebSocketServer({
            port: this.port,
            host: this.bind_to
        });

        if (this.verbose) {
            console.log('webkit-devtools-agent: Websockets ' +
            'service started on %s:%s', this.bind_to, this.port);
        }

        this.wss.on('connection', this.onFrontendConnection.bind(this));
    };

    /**
     * Callback function that forwards agent responses
     * to DevTools frontend except for the Debugger
     * agent which lives in the current process.
     *
     * @param {String} message JSON message as it comes from
     * the main process.
     * @api private
     */
    this.onBackendMessage = function(message) {
        this.frontends.forEach(function(socket){socket.send(message)});
    };

    /**
     * Starts proxy process.
     * This process is in charge of receiving
     * messages from DevTools frontend and forward them
     * to the main process.
     *
     * DebuggerAgent is an exception to the rule of having
     * all the agents in the main process. Given
     * that the main process is going to be in debug mode
     * we need the DebuggerAgent to live in a different process
     * so that it can continue working and be responsive
     * with DevTools frontend.
     *
     * @api public
     **/
    this.start = function () {
        this.backend = new WebSocket('ws://localhost:' + this.ipc_port);
        this.backend.on('open', this.onBackendOpen.bind(this));
        this.backend.on('message', this.onBackendMessage.bind(this));
        this.frontends = [];
    };

    /**
     * Stops proxy process
     *
     * @api public
     **/
    this.stop = function () {
        if (this.wss) {
            this.frontends = [];
            this.wss.close();
            this.wss = null;
            if (this.verbose) {
                console.log('webkit-devtools-agent: Websockets service with PID ' +
                process.pid + ' has stopped');
            }
        }
    };
}).call(DevToolsAgentProxy.prototype);

var proxy = new DevToolsAgentProxy();
proxy.start();

['exit', 'SIGTERM', 'SIGHUP'].forEach(function (s) {
    process.on(s, function() {
        proxy.stop();
    });
});

