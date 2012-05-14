var agents = require('./lib');
var fork = require('child_process').fork;

var child = fork('./webkit-devtools-agent.js', process.argv);

initializeAgents();

child.on('message', function(message) {
    var data = message.data;
    switch(message.event) {
        case 'connection':
            //initializeAgents();
            break;
        case 'method':
            var id = data.id;
            var command = data.method.split('.');
            var domain = agents[command[0]];
            var method = command[1];
            var params = data.params;

            if (!domain || !domain[method]) {
                console.warn('%s is not implemented', data.method);
                return;
            }

            domain[method](params, function(result) {
                var sent = child.send({
                    event: 'result',
                    data: {
                        id: id,
                        result: result
                    }
                });
                if (!sent) {
                    console.log('PUTA !!!');
                    console.log(result);
                }
            });
            break;
    }
});

function initializeAgents() {
    var sendEvent = function(data) {
        child.send({
            event: 'event',
            data: data
        });
    };

    var runtimeAgent = new agents.Runtime(sendEvent);

    for (var agent in agents) {
        if (typeof agents[agent] == 'function' &&
            agent != 'Runtime') {
                agents[agent] = new agents[agent](sendEvent, runtimeAgent);
        }
    }
    agents['Runtime'] = runtimeAgent;
}

if (!module.parent) {
    child.kill('SIGUSR2');
} else {
    process.on('SIGUSR2', function() {
        child.kill('SIGUSR2');
    });
}

child.on('exit', function(code, signal) {
    console.log(code);
    console.log(signal);
    //TODO: re-spawn it
});

process.on('exit', function() {
    child.kill('SIGTERM');
});

