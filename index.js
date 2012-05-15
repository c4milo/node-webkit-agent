var agents = require('./lib');
var spawn = require('child_process').spawn;
var WebSocketServer = require('ws').Server;

var DevToolsAgent = function() {
    this.proxy = null;
    this.server = null;
    this.socket = null;
    this.agents = {};
};

(function() {
    //Private variables
    var proxyPID = 0;

    //Private functions
    var spawnProxy = function() {
        var self = this;

        this.proxy = spawn(__dirname + '/webkit-devtools-agent.js', process.argv, {
            env: process.env,
            cwd: __dirname
        });
        proxyPID = this.proxy.pid;

        this.proxy.stderr.setEncoding('utf8');
        this.proxy.stderr.on('data', function (data) {
            console.error(data);
        });

        this.proxy.stdout.setEncoding('utf8');
        this.proxy.stdout.on('data', function (data) {
            console.log(data);
        });
    }.bind(this);

    var onProxyConnection = function(socket) {
        console.log('webkit-devtools-agent: A proxy got connected.');
        console.log('webkit-devtools-agent: Waiting for commands...');

        this.socket = socket;
        this.socket.on('message', onProxyData);
        this.socket.on('error', function(error) {
            console.error(error);
        });
    }.bind(this);

    var onProxyData = function(message) {
        var self = this;

        try {
            data = JSON.parse(message);
        } catch(e) {
            console.log(e);
            console.log(e.stack);
            return;
        }

        var id = data.id;
        var command = data.method.split('.');
        var domain = this.agents[command[0]];
        var method = command[1];
        var params = data.params;

        if (!domain || !domain[method]) {
            console.warn('%s is not implemented', data.method);
            return;
        }

        domain[method](params, function(result) {
            var response = {
                id: id,
                result: result
            };

            self.socket.send(JSON.stringify(response));
        });
    }.bind(this);

    var loadAgents = function() {
        var self = this;

        var sendEvent = function(data) {
            self.socket.send(JSON.stringify(data));
        };

        var runtimeAgent = new agents.Runtime(sendEvent);
        this.agents = {};

        for (var agent in agents) {
            if (typeof agents[agent] == 'function' && agent != 'Runtime') {
                this.agents[agent] = new agents[agent](sendEvent, runtimeAgent);
            }
        }
        this.agents.Runtime = runtimeAgent;
    }.bind(this);

    // Public functions
    this.start = function() {
        var self = this;

        if (this.server) return;

        this.server = new WebSocketServer({
            port: 3333,
            host: 'localhost'
        });

        this.server.on('listening', function() {
            console.log('webkit-devtools-agent: Spawning websocket ' +
            'service process...');

            //Spawns webkit devtools proxy / websockets server
            spawnProxy();

            loadAgents();
        });
        this.server.on('connection', onProxyConnection);
    };

    this.stop = function() {
        console.log('webkit-devtools-agent: Terminating websockets service' +
        ' with PID: ' + proxyPID + '...');

        if (this.socket) {
            this.socket.end();
        }

        if (proxyPID) {
            process.kill(proxyPID, 'SIGTERM');
            proxyPID = 0;
        }

        if (this.server) {
            this.server.close();
            this.server = null;
        }
    };
}).call(DevToolsAgent.prototype);

var nodeAgent = new DevToolsAgent();

//Prepares signal handler to activate the agent
if (!module.parent) {
    nodeAgent.start();
} else {
    process.on('SIGUSR2', function() {
        if (nodeAgent.server) {
            nodeAgent.stop();
        } else {
            nodeAgent.start();
        }
    });
}

['exit', 'uncaughtException'].forEach(function(e) {
    process.on(e, function(e) {
        if (e) {
            console.log(e);
        }
        nodeAgent.stop();
    });
});

