/**
 * @fileoverview
 * Resolves references to objects in the heap.
 */
var logger = require('./logger');

function resolve(frame, refs) {
    for (var p in frame) {
        var refId = frame[p].ref;
        if (!refId) {
            continue;
        }

        for (var i = 0, len = refs.length; i < len; i++) {
            var handle = refs[i].handle;
            if (handle === refId) {
                frame[p] = refs[i];
                break;
            }
        }
    }
}

module.exports = function resolver(frames, refs) {
    for (var i = 0, len = frames.length; i < len; i++) {
        resolve(frames[i], refs);
    }
};
