# Node Webkit Agent
This module is an implementation of 
[Chrome developer tools protocol](http://code.google.com/chrome/devtools/docs/protocol/1.0/index.html).
It is still pretty much a work in progress and only the heap and CPU profilers are working right now. Debugger, console
and networking will be added soon.

##Features
This module allows you to debug and profile remotely your nodejs applications
leveraging the following features by re-using the [built-in devtools front-end](http://code.google.com/chrome/devtools/docs/overview.html)
that comes with any webkit-based browser such as Chrome and Safari.

* Remote debugging
* Remote heap and CPU profiling
* Remote console
* Network monitoring

##Installation
`npm install webkit-devtools-agent`

##Example
```javascript
var agent = require('webkit-devtools-agent');
var http = require('http');
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(8080, '127.0.0.1');
console.log('[%s] Server running at http://127.0.0.1:8080/', process.pid);
```
##Debugging your application

Since we want to use [Chrome remote debugging](http://code.google.com/chrome/devtools/docs/remote-debugging.html)
capabilities to serve the devtools front-end from it, we'll need to follow the next steps: 

1. Start a *host* Chrome instance with remote-debugging-port command line switch, in OSX it will be something like this:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`

2. Start a *client* Chrome instance using a separate user profile:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=<some directory>`

3. Activate the agent, in your nodejs application, by sending a SIGUSR2 signal to its process id. To de-activate send the signal once again.
`kill -SIGUSR2 <the process id of your nodejs app>`

4. In your *client* Chrome instance, open up devtools using the following URL: 
`http://localhost:9222/devtools/devtools.html?host=localhost:1337&page=0`

You can also change the agent port by setting up the DEBUG_PORT environment variable.

For more documentation about how to use and interpret devtools, please go to the [Devtools official documentation](http://code.google.com/chrome/devtools/docs/overview.html)

##Screenshots
### CPU profiling
![Screenshot](http://i.imgur.com/XLFG5.png)

### Heap Profiling
![Screenshot](http://i.imgur.com/2jkme.png)


Happy Debugging!
