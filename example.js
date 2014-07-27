var agent = require('./index');

// Assume this HTTP service is your service
var http = require('http');
http.createServer(function (req, res) {
    console.log('boooo');
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Hello World\n');
}).listen(9000, '127.0.0.1');
console.log('Server running at http://127.0.0.1:9000/ , pid-> ' + process.pid);

// Now let's have a signal handler for SIGUSR2 that is going
// to activate the devtools agent. You can use any other means to activate
// the agent, not just signal handlers.
process.on('SIGUSR2', function () {
  if (agent.server) {
    agent.stop();
  } else {
    agent.start({
        port: 9999,
        bind_to: '0.0.0.0',
        ipc_port: 3333,
        verbose: true
    });
  }
});


