function RuntimeAgent() {

}

(function() {
	this.evaluate = function(params, sendResult, sendEvent) {
		console.log(params);
	};

}).call(RuntimeAgent.prototype);

module.exports = new RuntimeAgent();
