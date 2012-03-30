function DebuggerAgent() {}

(function(){
	this.enable = function(params, callback) {
		//TODO
	};

	this.causesRecompilation = function(params, callback) {
		callback({result: false});
	};

	this.supportsNativeBreakpoints = function(params, callback) {
		callback({result: false});
	};

	this.canSetScriptSource = function(params, callback) {
		callback({result: false});
	};
	
}).call(DebuggerAgent.prototype);

module.exports = new DebuggerAgent();