var agents = require('./lib');
var spawn = require('child_process').spawn;
var WebSocketServer = require('ws').Server;

/**
 * DevToolsAgent
 * @constructor
 **/
var DevToolsAgent = module.exports = function() {
    this.loadedAgents = {};
    this.proxy = null;
    this.server = null;
    this.socket = null;
};

(function() {
    /**
     * Spawns a new process with a websockets service proxy
     * to serve devtools front-end requests.
     *
     * All the messages but debugging messages
     * are sent to the main process. Debugger Agent lives in this proxy.
     *
     * @api private
     **/
    this.spawnProxy = function() {
        var self = this;

        //Parent PID for the proxy to know to whom to send the SIGUSR1 signal
        process.env.PARENT_PID = process.pid;

        this.proxy = spawn(__dirname + '/webkit-devtools-agent.js', process.argv, {
            env: process.env,
            cwd: __dirname
        });

        this.proxy.stderr.setEncoding('utf8');
        this.proxy.stderr.on('data', function (data) {
            console.error(data);
        });

        this.proxy.stdout.setEncoding('utf8');
        this.proxy.stdout.on('data', function (data) {
            console.log(data);
        });
    };

    /**
     * Proxy connection handler
     *
     * @param {net.Socket} socket The just opened network socket.
     * @api private
     **/
    this.onProxyConnection = function(socket) {
        console.log('webkit-devtools-agent: A proxy got connected.');
        console.log('webkit-devtools-agent: Waiting for commands...');

        this.socket = socket;
        this.socket.on('message', this.onProxyData.bind(this));
        this.socket.on('error', function(error) {
            console.error(error);
        });
    };

    /**
     * Handler for data events coming from the proxy process.
     *
     * @param {String} message A message coming from the proxy process.
     * @api private
     **/
    this.onProxyData = function(message) {
        var self = this;

        try {
            data = JSON.parse(message);
        } catch(e) {
            console.log(e.stack);
            return;
        }

        var id = data.id;
        var command = data.method.split('.');
        var domain = this.loadedAgents[command[0]];
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
    };

    /**
     * Notification function in charge of sending events
     * to the front-end following the protocol specified
     * at https://developers.google.com/chrome-developer-tools/docs/protocol/1.0
     *
     * @param {Object} A notification object that follows devtools protocol 1.0
     * @api private
     **/
    this.notify = function(notification) {
        if (!this.socket) return;
        this.socket.send(JSON.stringify(notification));
    };

    /**
     * Loads every agent required at the top of this file.
     * @private
     **/

    this.loadAgents = function() {
        var runtimeAgent = new agents.Runtime(this.notify.bind(this));

        for (var agent in agents) {
            if (typeof agents[agent] == 'function' && agent != 'Runtime') {
                this.loadedAgents[agent] = new agents[agent](this.notify.bind(this), runtimeAgent);
            }
        }
        this.loadedAgents.Runtime = runtimeAgent;
    };

    /**
     * Starts node-webkit-agent
     *
     * @api public
     **/
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
            self.spawnProxy();

            self.loadAgents();
        });
        this.server.on('connection', this.onProxyConnection.bind(this));
    };

    /**
     * Stops node-webkit-agent
     *
     * @api public
     **/
    this.stop = function() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        if (this.proxy && this.proxy.pid) {
            console.log('webkit-devtools-agent: Terminating websockets service' +
            ' with PID: ' + this.proxy.pid + '...');
            process.kill(this.proxy.pid, 'SIGTERM');
        }

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        console.log('webkit-devtools-agent: stopped');
    };
}).call(DevToolsAgent.prototype);

/**
 * Creates an instance of the main function.
 **/
var nodeAgent = new DevToolsAgent();

/**
 * Prepares signal handler to activate the agent
 * upon `SIGUSR2` signal which usually is triggered by `kill -SIGUSR2`
 * in unix environments.
 **/
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

/**
 * Avoids process termination due to uncaught exceptions
 **/
['exit', 'uncaughtException'].forEach(function(e) {
    process.on(e, function(e) {
        if (e) {
            console.error(e.stack);
        }
        nodeAgent.stop();
    });
});

