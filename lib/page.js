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

    this.canShowDebugBorders = function(params, sendResult) {
        sendResult({result: false});
    };

    this.canShowFPSCounter = function(params, sendResult) {
        sendResult({result: false});
    };

    this.canContinuouslyPaint = function(params, sendResult) {
        sendResult({result: false});
    };

    this.canOverrideGeolocation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.canOverrideDeviceOrientation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.setTouchEmulationEnabled = function(params, sendResult) {
        sendResult({result: false});
    };
}).call(PageAgent.prototype);

module.exports = PageAgent;
