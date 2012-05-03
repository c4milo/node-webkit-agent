var util = require('util');

function ConsoleAgent(sendEvent) {
    var self = this;
    this.sendEvent = sendEvent;
    this.enabled = false;
    this.messages = [];

    ['log', 'warn', 'info', 'error'].forEach(function(level) {
        var ref = console[level];
        console[level] = function() {
            ref.apply(this, arguments);

            var message = {
                method: 'Console.messageAdded',
                params: {
                    message: {
                        text: util.format.apply(this, arguments),
                        level: level == 'warn' ? 'warning' : level,
                        source: 'nodejs'
                    }
                }
            };

            if (!self.enabled) {
                self.messages.push(message);
                return;
            }

            sendEvent(message);
        };
    });
}

(function() {
    this.enable = function(params, sendResult) {
        for(var i = 0, len = this.messages.length; i < len; i++) {
            this.sendEvent(this.messages[i]);
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

