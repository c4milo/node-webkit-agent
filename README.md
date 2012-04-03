# Node Webkit Agent
This module is an implementation of 
[Chrome developer tools protocol](http://code.google.com/chrome/devtools/docs/protocol/1.0/index.html).
It is still pretty much a work in progress and only the heap profiler is working right now. 

##Features
This module allows you to debug and profile remotely your nodejs applications
leveraging the following features by re-using the [built-in devtools frontend](http://code.google.com/chrome/devtools/docs/overview.html)
that comes with any webkit-based browser such as Chrome and Safari.

* Remote debugging
* Remote heap and CPU profiling
* Remote console to inject code in your node applications while debugging.
* Network monitoring

##Usage: