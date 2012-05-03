function ConsoleAgent() {
    this.enable = false;
    this.messages = [];
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this.enable});
    };

    this.disable = function(params, sendResult) {
        this.enable = false;
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

module.exports = new ConsoleAgent();

