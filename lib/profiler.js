function ProfilerAgent() {}

(function(){
	this.causesRecompilation = function(params, callback) {
		callback({result: false});
	};

	this.isSampling = function(params, callback) {
		callback({result: false});
	};

	this.hasHeapProfiler = function(params, callback) {
		callback({result: true});
	}
}).call(ProfilerAgent.prototype);

module.exports = new ProfilerAgent();