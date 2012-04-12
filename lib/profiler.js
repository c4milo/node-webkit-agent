var profiler = require('v8-profiler');
var fs = require('fs');

var HeapProfileType = 'HEAP';
var CPUProfileType  = 'CPU';

function ProfilerAgent() {
    this.profiles = { 
        HEAP: {},
        CPU: {}
    };

    this.isProfilingCPU = false;
}

(function(){
    this.enable = function(params, sendResult) {
        sendResult({result: true});
    };

    this.causesRecompilation = function(params, sendResult) {
        sendResult({result: false});
    };

    this.isSampling = function(params, sendResult) {
        console.log('ProfilerAgent.isSampling');
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
        } else if (params.type == CPUProfileType) {
            var profile = this.profiles[params.type][params.uid];
            profile.typeId = CPUProfileType;

            sendResult({
                profile: {
                    title: profile.title,
                    uid: profile.uid,
                    typeId: CPUProfileType,
                    head: profile.getTopDownRoot(),
                    bottomUpHead: profile.getBottomUpRoot()
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

    this.start = function(params, sendResult, sendEvent) {
        /* TODO
        {   "method":"Console.messageAdded",
            "params":{"message":{"source":"javascript","level":"log","text":"Profile \"Profile 1" started.","type":"log","line":0,"url":"","repeatCount":1}}}
        */

        profiler.startProfiling();

        sendEvent({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: true
            }
        });

        sendResult({});
    };

    this.stop = function(params, sendResult, sendEvent) {
        var profile = profiler.stopProfiling();

        this.profiles[CPUProfileType][profile.uid] = profile;

        sendEvent({
            method: 'Profiler.addProfileHeader',
            params: {
                header: {
                    title: profile.title,
                    uid: profile.uid,
                    typeId: CPUProfileType
                }
            }
        });

        sendEvent({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: false
            }
        });

         sendResult({});
    };
}).call(ProfilerAgent.prototype);

module.exports = new ProfilerAgent();
