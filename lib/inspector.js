function InspectorAgent() {
    this.enabled = false;
}

(function () {
    this.enable = function (params, sendResult) {
        sendResult({result: this.enabled});
    };
}).call(InspectorAgent.prototype);

module.exports = InspectorAgent;
