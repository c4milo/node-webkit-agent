var profiler = require('./profiler');

var heapProfiler 	= profiler.HeapProfler;
var cpuProfiler		= profiler.CpuProfiler;

function ProfilerAgent() {}

(function(){
	this.enable = function(params, callback) {
		//TODO
	};

	this.causesRecompilation = function(params, callback) {
		callback({result: false});
	};

	this.isSampling = function(params, callback) {
		callback({result: true});
	};

	this.hasHeapProfiler = function(params, callback) {
		callback({result: true});
	}

	this.takeHeapSnapshot = function(params, callback) {
		var snapshot = heapProfiler.takeSnapshot();

		snapshot.on('chunk', function(chunk) {
			callback({
				method: 'Profiler.addHeapSnapshotChunk',
				params: {
					uid: snapshot.uid, 
					chunk: JSON.stringify(chunk) 
				} 
			});
		});

		snapshot.on('finish', function() {
			callback({
				method: 'Profiler.finishHeapSnapshot',
				params: {uid: snapshot.uid}
			});
		});

		snapshot.on('done', function() {
			callback({
				result: { 
					profile: {
						title: snapshot.title,
						uid: snapshot.uid,
						typeId: 'HEAP'
					} 
				}
			});
		});

		snapshot.toJson();
	}
}).call(ProfilerAgent.prototype);

module.exports = new ProfilerAgent();