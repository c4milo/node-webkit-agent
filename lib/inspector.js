function InspectorAgent() {
    this._enable = false;
}

(function() {
    this.enable = function(params, sendResult) {
        sendResult({result: this._enable});
    };
}).call(InspectorAgent.prototype);

module.exports = new InspectorAgent();
