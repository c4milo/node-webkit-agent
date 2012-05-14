var agent = require('./index');

var http = require('http');
http.createServer(function (req, res) {
    console.log('boooo');
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
console.log('nooooooooooooooooo');
}).listen(9000, '127.0.0.1');

/*var i = 0;
setInterval(function() {
    console.log(i++);
}, 3000);*/
console.log('Server running at http://127.0.0.1:9000/ , pid-> ' + process.pid);
