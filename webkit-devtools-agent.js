var Debugger = require('./lib/debugger');
var WebSocketServer = require('ws').Server;
var wss;

var port = process.env.DEBUG_PORT || 9999;
var host = process.env.DEBUG_HOST || '127.0.0.1';

function start() {
    wss = new WebSocketServer({
        port: port,
        host: host
    });

    console.log('webkit-devtools-agent started on %s:%s', host, port);

    wss.on('connection', function(socket) {
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
}

function stop() {
    if (wss) {
        wss.close();
        wss = null;
        console.log('webkit-devtools-agent stopped');
    }
}

process.on('SIGUSR2', function() {
    if (wss) {
        stop();
    } else {
        start();
    }
});

process.on('uncaughtException', function (err) {
    console.error('webkit-devtools-agent: uncaughtException: ');
    console.error(err);
    console.error(err.stack);
});

