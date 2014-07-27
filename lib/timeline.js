var probes = require('./probes');

function TimelineAgent(sendEvent, runtimeAgent) {
    this.sendEvent = sendEvent;
    this.runtimeAgent = runtimeAgent;
    this.enabled = false;
    this.maxCallStackDepth = 5;
    this.includeMemoryDetails = true;
}

(function() {
    this.enable = function (params, sendResult) {
        this.enabled = true;
        sendResult({result: this.enabled});
        probes.start();
    };

    this.disable = function (params, sendResult) {
        this.enabled = false;
        probes.stop();
        sendResult({result: this.enabled});
    };

    this.timeStamp = function (params, sendResult, sendEvent) {
        var memory = process.memoryUsage();
        sendEvent({
            method: 'Timeline.eventRecorded',
            params: {
                record: {
                    startTime: Date.now(),
                    endTime: Date.now(),
                    data: { 'message': message || '' },
                    type: 'TimeStamp',
                    usedHeapSize: memory.heapUsed,
                    totalHeapSize: memory.heapTotal
                }
            }
        });
    };

    this.start = function (params, sendResult) {
        this.maxCallStackDepth = params.maxCallStackDepth || 5;
        sendResult({});
    };

    this.stop = function (params, sendResult) {
        sendResult({});
    };

    this.setIncludeMemoryDetails = function (params, sendResult) {
        this.includeMemoryDetails = params.enabled || true;
        sendResult({});
    };
}).call(TimelineAgent.prototype);

module.exports = TimelineAgent;

