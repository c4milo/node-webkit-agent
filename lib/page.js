function PageAgent() {
    this.enabled = false;
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this.enabled});
    };

    this.canOverrideDeviceMetrics = function(params, sendResult) {
        sendResult({result: false});
    };
}).call(PageAgent.prototype);

module.exports = PageAgent;
