
var WebSocketServer = require('ws').Server;
var agents = require('./lib');
var wss;

var port = process.env.DEBUG_PORT || 1337;

function start() {
    wss = new WebSocketServer({port: port});

    wss.on('connection', function(socket) {
        socket.on('message', function(message) {
           //console.log(message);
           try {
              message = JSON.parse(message);
           } catch(e) {
              console.log(e);
              return;
           }
           
           var id = message.id;
           var command = message.method.split('.');
           var domain = agents[command[0]];
           var method = command[1];
           var params = message.params;
        
            if (!domain || !domain[method]) {
                console.error('%s is not implemented', message.method);
                return;
            }

            domain[method](params, function(result) {
                socket.send(JSON.stringify({ id: id, result: result }));
            }, function(event) {
                socket.send(JSON.stringify(event));
            });
        });
    });
}

function stop() {
    if (wss) {
        wss.close();
        wss = null;
    } 
}

if (!module.parent) {
    start();
} else {
    process.on('SIGUSR1', function() {
        if (ws) {
            stop();
        } else {
            start();
        }
    });
}

process.on('uncaughtException', function (err) {
  console.error('Node inspector agent uncaughtException: ');
  console.error(err.stack);
});
