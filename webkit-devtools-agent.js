#!/usr/bin/env node
var Debugger = require('./lib/debugger');
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;

var DevToolsAgentProxy = function() {
    this.wss = null;
    this.port = process.env.DEBUG_PORT || 9999;
    this.host = process.env.DEBUG_HOST || '127.0.0.1';
};

(function() {
    var self = this;
    process.on('uncaughtException', function (err) {
        console.error('webkit-devtools-agent: Websockets service uncaught exception: ');
        console.error(err);
        console.error(err.stack);
    });

    this.start = function() {
        var self = this;

        var backend = new WebSocket('ws://localhost:3333');
        backend.on('open', function() {
            //Starts websockets server for devtools front-end
            self.wss = new WebSocketServer({
                port: self.port,
                host: self.host
            });

            console.log('webkit-devtools-agent: Websockets ' +
            'service started on %s:%s', self.host, self.port);

            self.wss.on('connection', function(socket) {
                backend.on('message', function(message) {
                    socket.send(message);
                });

                socket.on('message', function(message) {
                    backend.send(message);
                });
            });
        });
    };

    this.stop = function() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            console.log('webkit-devtools-agent: Websockets service with PID ' +
            process.pid + ' stopped');
        }
    };
}).call(DevToolsAgentProxy.prototype);

var proxy = new DevToolsAgentProxy();

proxy.start();

['exit', 'SIGTERM', 'SIGHUP'].forEach(function(s) {
    process.on(s, function() {
        proxy.stop();
    });
});

