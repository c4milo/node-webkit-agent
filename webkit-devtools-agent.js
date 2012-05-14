var Debugger = require('./lib/debugger');
var WebSocketServer = require('ws').Server;

var DevToolsAgent = function() {
    this.wss = null;
    this.port = process.env.DEBUG_PORT || 9999;
    this.host = process.env.DEBUG_HOST || '127.0.0.1';
};

(function() {
    var self = this;
    process.on('SIGUSR2', function() {
        if (self.wss) {
            self.stop();
        } else {
            self.start();
        }
    });

    process.on('uncaughtException', function (err) {
        console.error('webkit-devtools-agent: uncaughtException: ');
        console.error(err);
        console.error(err.stack);
    });

    this.start = function() {
        this.wss = new WebSocketServer({
            port: this.port,
            host: this.host
        });

        console.log('webkit-devtools-agent started on %s:%s', host, port);

        this.wss.on('connection', function(socket) {
            process.send({
                event: 'connection'
            });

            process.on('message', function(message) {
                var data = message.data;

                switch(message.event) {
                    case 'event':
                    case 'result':
                        socket.send(JSON.stringify(data));
                }
            });

            socket.on('message', function(message) {
                try {
                    message = JSON.parse(message);
                } catch(e) {
                    console.error(e);
                    return;
                }

                process.send({
                    event: 'method',
                    data: message
                });
            });
        });
    };

    this.stop = function() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
            console.log('webkit-devtools-agent stopped');
        }
    };
}).call(DevToolsAgent.prototype);

module.exports = new DevToolsAgent();


