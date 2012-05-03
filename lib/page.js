function PageAgent() {
    this._enable = false;
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this._enable});
    };

    this.canOverrideDeviceMetrics = function(params, sendResult) {
        sendResult({result: false});
    };
}).call(PageAgent.prototype);

module.exports = new PageAgent();
