# Node Webkit Agent
[![Stories in Ready](https://badge.waffle.io/c4milo/node-webkit-agent.png?label=ready)](https://waffle.io/c4milo/node-webkit-agent)
<a href="http://flattr.com/thing/799265/c4milonode-webkit-agent-on-GitHub" target="_blank">
<img src="http://api.flattr.com/button/flattr-badge-large.png" alt="Flattr this" title="Flattr this" border="0" /></a>


This module is an implementation of
[Chrome developer tools protocol](http://code.google.com/chrome/devtools/docs/protocol/1.0/index.html).
It is still pretty much a work in progress and only heap and CPU profilers are working right now. Help is wanted to finish implementing debugger, networking and console agents as well as a implementing from scratch a flamegraphs agent.

## Features
This module allows you to debug and profile remotely your nodejs applications
leveraging the following features by re-using the [built-in devtools front-end](http://code.google.com/chrome/devtools/docs/overview.html)
that comes with any webkit-based browsers such as Chrome or Safari.

* Remote heap and CPU profiling
* More agents are coming.

## Installation
`npm install webkit-devtools-agent`

## Usage
From within your Node application, just require the module as usual, and start the agent. For example:

```javascript
var agent = require('webkit-devtools-agent');
agent.start()
```

Once the agent is initiated, use any of the following hosted Devtools UIs to profile your application.

**Node v0.6.x:** http://c4milo.github.io/node-webkit-agent/19.0.1084.46/inspector.html?host=localhost:9999&page=0

**Node v0.8.x and v0.10.x:** http://c4milo.github.io/node-webkit-agent/26.0.1410.65/inspector.html?host=localhost:9999&page=0

You can also use your browser's devtools frontend. It's important to make sure your browser supports websockets, otherwise the UI won't be able to connect to the node agent whatsoever.

You can also change the agent port and binding address where it listen to by setting up the following parameters:

* **port:** The port for the Devtools UI to connect to using websockets. Set to `9999` by default
* **bind_to:** The host or IP address where the websockets service is going to be bound to. Set to `0.0.0.0` by default
* **ipc_port:** IPC port for internal use. Set to `3333` by default
* **verbose:** Whether to log more information or not. Set to `false` by default

See the example below to understand better how to set these parameters.

### Example
A more elaborated example looks like: 

```javascript

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


```

## ABI compatibility
[ABI](http://en.wikipedia.org/wiki/Application_binary_interface) compatibility breaks between Node v0.6.x and v0.8.x. Therefore, if you switch Node versions you would have to re-install `webkit-devtools-agent` again. See issue [#11](https://github.com/c4milo/node-webkit-agent/issues/11).

## Screenshots
### CPU profiling
![Screenshot](https://i.cloudup.com/YysNMMGE3a.png)

### Heap Profiling
![Screenshot](https://i.cloudup.com/WR5MKG6i02.png)


Happy Debugging!

## License
(The MIT License)

Copyright 2014 Camilo Aguilar. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to
deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
