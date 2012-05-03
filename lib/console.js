function ConsoleAgent() {
    this._enable = false;
    this.messages = [];
    this.console = console;
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this._enable});
    };

    this.disable = function(params, sendResult) {
        this._enable = false;
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

