var util = require('util');

function ConsoleAgent(notify, runtimeAgent) {
    var self = this;
    this.notify = notify;
    this.runtimeAgent = runtimeAgent;
    this.enabled = false;
    this.messages = [];

    ['log', 'warn', 'info', 'error', 'dir'].forEach(function(level) {
        var ref = console[level];
        console[level] = function() {
            ref.apply(this, arguments);

            var message = {
                method: 'Console.messageAdded',
                params: {
                    message: {
                        text: util.format.apply(this, arguments),
                        level: level == 'warn' ? 'warning' : level,
                        source: 'console-api'
                    }
                }
            };

            //TODO make it aware of RemoteObjects so
            //that the console in the frontend can show us its shinny
            //dropdown
            /*if (level == 'dir') {
                message.params.message.type = level;
            }*/

            //TODO save messages when this agent is disabled.
            //self.messages.push(message);
            notify(message);
        };
    });
}

(function() {
    this.enable = function(params, sendResult) {
        for(var i = 0, len = this.messages.length; i < len; i++) {
            this.notify(this.messages[i]);
        }
        sendResult({result: this.enabled});
    };

    this.disable = function(params, sendResult) {
        this.enabled = false;
        sendResult({});
    };

    this.clearMessages = function(params, sendResult) {
        this.messages = [];
        sendResult({});
    };

    this.setMonitoringXHREnabled = function(params, sendResult) {
        sendResult({});
    };

    this.addInspectedHeapObject = function(params, sendResult) {
        sendResult({});
    };

}).call(ConsoleAgent.prototype);

module.exports = ConsoleAgent;

