function InspectorAgent() {}

(function() {
	this.enable = function(params, sendResult) {
		sendResult({result: false});
	};
}).call(InspectorAgent.prototype);

module.exports = new InspectorAgent();