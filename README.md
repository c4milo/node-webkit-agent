# Node Webkit Agent
This module is an implementation of 
[Chrome developer tools protocol](http://code.google.com/chrome/devtools/docs/protocol/1.0/index.html).
It is still pretty much a work in progress and only the heap and CPU profilers are working right now. Debugger, console
and networking will be added soon.

##Features
This module allows you to debug and profile remotely your nodejs applications
leveraging the following features by re-using the [built-in devtools frontend](http://code.google.com/chrome/devtools/docs/overview.html)
that comes with any webkit-based browser such as Chrome and Safari.

* Remote debugging
* Remote heap and CPU profiling
* Remote console to inject code in your node applications while debugging.
* Network monitoring

##Installation
`npm install webkit-devtools-agent`

Then proceed to require the module from your nodejs application and that's it.

##Usage:

1. Start a *host* Chrome instance with remote-debugging-port command line switch, in OSX it will be something like this:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222`

2. Start a *client* Chrome instance using a separate user profile:
`Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --user-data-dir=<some directory>`

3. Activate the agent by sending a SIGUSR1 signal to the process id of your application. To de-activate send the signal once again.
`kill -SIGUSR1 <the process id>`

4. In your *client* instance, open up devtools using the following URL: 
`http://localhost:9222/devtools/devtools.html?host=localhost:1337&page=0`

You can also change the agent port by setting up the DEBUG_PORT environment variable.

Happy Debugging!