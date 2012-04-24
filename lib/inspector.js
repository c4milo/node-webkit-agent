function InspectorAgent() {
    this.enable = false;
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this.enable});
    };
}).call(InspectorAgent.prototype);

module.exports = new InspectorAgent();
