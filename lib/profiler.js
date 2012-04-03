var profiler = require('./profiler');
var fs = require('fs');

//var heapProfiler    = profiler.HeapProfler;
var heapProfiler = require('/Users/aguilarlopez/Dropbox/Development/cloudescape/v8-profiler/v8-profiler');
var cpuProfiler     = profiler.CpuProfiler;

var HeapProfileType = 'HEAP';
var CPUProfileType  = 'CPU';

function ProfilerAgent() {
    this.profiles = { 
        HEAP: {},
        CPU: {}
    };
}

(function(){
    this.enable = function(params, sendResult) {
        //TODO
    };

    this.causesRecompilation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.isSampling = function(params, sendResult) {
        sendResult({result: true});
    };

    this.hasHeapProfiler = function(params, sendResult) {
        sendResult({result: true});
    };

    this.getProfileHeaders = function(params, sendResult) {
        console.log('getProfileHeaders!');
        //sendResult(this.snapshots);
    };

    this.takeHeapSnapshot = function(params, sendResult, sendEvent) {
        var snapshot = heapProfiler.takeSnapshot(function(done, total) {
            sendEvent({
                method: 'Profiler.reportHeapSnapshotProgress',
                params:{ 
                    done: done,
                    total: total
                }
            });
        });

        //var snapshot = heapProfiler.takeSnapshot();
        
        this.profiles[HeapProfileType][snapshot.uid] = snapshot;

        sendEvent({
            method: 'Profiler.addProfileHeader',
            params: {
                header: {
                    title: snapshot.title,
                    uid: snapshot.uid,
                    typeId: HeapProfileType
                }
            }
        });

        sendResult({});
    };

    this.getProfile = function(params, sendResult, sendEvent) {
        if (params.type == HeapProfileType) {
            var snapshot = this.profiles[params.type][params.uid];

            //var data = '';
            snapshot.serialize({
                onData: function(chunk, size) {
                    chunk = chunk + '';
                    //data += chunk;
                    sendEvent({
                        method: 'Profiler.addHeapSnapshotChunk',
                        params: {
                            uid: snapshot.uid, 
                            chunk: chunk 
                        } 
                    });
                },
            
                onEnd: function() {
                    sendEvent({
                        method: 'Profiler.finishHeapSnapshot',
                        params: {uid: snapshot.uid}
                    });
                    
                    sendResult({
                        profile: {
                            title: snapshot.title,
                            uid: snapshot.uid,
                            typeId: HeapProfileType
                        } 
                    });
                }
            });
        }
    };
}).call(ProfilerAgent.prototype);

module.exports = new ProfilerAgent();