var profiler = require('v8-profiler');
var fs = require('fs');

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
        //sendResult({result: true});
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
        var headers = [];
        
        for (var type in this.profiles) {
            for (var profileId in this.profiles[type]) {
                var profile = this.profiles[type][profileId];
                headers.push({
                    title: profile.title,
                    uid: profile.uid,
                    typeId: type
                });
            }
        }

        sendResult({
            headers: headers
        });
    };

    this.takeHeapSnapshot = function(params, sendResult, sendEvent) {
        var snapshot = profiler.takeSnapshot(function(done, total) {
            sendEvent({
                method: 'Profiler.reportHeapSnapshotProgress',
                params:{ 
                    done: done,
                    total: total
                }
            });
        });

        //var snapshot = profiler.takeSnapshot();
        
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

    this.clearProfiles = function(params, sendResult, sendEvent) {
        this.profiles.HEAP = {};
        this.profiles.CPU = {};
        profiler.deleteAllSnapshots();
        profiler.deleteAllProfiles();
    };

}).call(ProfilerAgent.prototype);

module.exports = new ProfilerAgent();