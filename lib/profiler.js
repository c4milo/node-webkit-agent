var profiler = require('./v8-profiler');
var fs = require('fs');

var HeapProfileType = 'HEAP';
var CPUProfileType  = 'CPU';

function ProfilerAgent(notify) {
    this.notify = notify;
    this.profiles = {
        HEAP: {},
        CPU: {}
    };

    this.enabled = false;
    this.isProfilingCPU = false;
}

(function(){
    this.enable = function (params, sendResult) {
        sendResult({result: this.enabled});
    };

    this.causesRecompilation = function (params, sendResult) {
        sendResult({result: false});
    };

    this.isSampling = function (params, sendResult) {
        sendResult({result: this.isProfilingCPU});
    };

    this.hasHeapProfiler = function (params, sendResult) {
        sendResult({result: true});
    };

    this.getProfileHeaders = function (params, sendResult) {
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

    this.takeHeapSnapshot = function (params, sendResult) {
        var self = this;
        var snapshot = profiler.takeSnapshot(function(done, total) {
            self.notify({
                method: 'Profiler.reportHeapSnapshotProgress',
                params:{
                    done: done,
                    total: total
                }
            });
        });

        this.profiles[HeapProfileType][snapshot.uid] = snapshot;

        this.notify({
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

    this.getHeapSnapshot = function (params, sendResult) {
        var self = this;
        var snapshot = this.profiles[HeapProfileType][params.uid];

        snapshot.serialize({
            onData: function (chunk, size) {
                chunk = chunk + '';
                self.notify({
                    method: 'Profiler.addHeapSnapshotChunk',
                    params: {
                        uid: snapshot.uid,
                        chunk: chunk
                    }
                });
            },

            onEnd: function () {
                self.notify({
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
    };

    this.getCPUProfile = function (params, sendResult) {
        var self = this;
        var profile = this.profiles[CPUProfileType][params.uid];
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
    };

    //Backwards support for v8 versions coming in nodejs 0.6.x and 0.8.x
    this.getProfile = function (params, sendResult) {
        if (params.type === HeapProfileType) {
            this.getHeapSnapshot(params, sendResult);
        } else if (params.type === CPUProfileType) {
            this.getCPUProfile(params, sendResult);
        }
    };

    this.clearProfiles = function (params, sendResult) {
        this.profiles.HEAP = {};
        this.profiles.CPU = {};
        profiler.deleteAllSnapshots();
        profiler.deleteAllProfiles();
    };

    this.start = function (params, sendResult) {
        /* TODO
        {   "method":"Console.messageAdded",
            "params":{"message":{"source":"javascript","level":"log","text":"Profile \"Profile 1" started.","type":"log","line":0,"url":"","repeatCount":1}}}
        */

        profiler.startProfiling();

        this.notify({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: true
            }
        });

        sendResult({});
    };

    this.stop = function (params, sendResult) {
        var profile = profiler.stopProfiling();

        this.profiles[CPUProfileType][profile.uid] = profile;

        this.notify({
            method: 'Profiler.addProfileHeader',
            params: {
                header: {
                    title: profile.title,
                    uid: profile.uid,
                    typeId: CPUProfileType
                }
            }
        });

        this.notify({
            method: 'Profiler.setRecordingProfile',
            params: {
                isProfiling: false
            }
        });

         sendResult({});
    };

    this.collectGarbage = function (params, sendResult) {
        if (typeof gc === 'function') {
            gc();
        } else {
            console.warn('ProfilerAgent: ' +
            'you need to run your nodejs app using --expose_gc ' +
            'in order to `"force`" garbage collection.');
        }
        sendResult({});
    };
}).call(ProfilerAgent.prototype);

module.exports = ProfilerAgent;
