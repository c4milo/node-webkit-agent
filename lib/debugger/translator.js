/**
 * @fileoverview 
 * Transforms http://code.google.com/p/v8/wiki/DebuggerProtocol
 * to https://developers.google.com/chrome-developer-tools/docs/protocol/1.0
 **/

var formatScript = function(script) {
    var lineEnds = script.line_ends;
    var lineCount = lineEnds.length;
    var endLine = script.line_offset + lineCount - 1;
    var endColumn;
    // V8 will not count last line if script source ends with \n.
    if (script.source[script.source.length - 1] === '\n') {
        endLine += 1;
        endColumn = 0;
    } else {
        if (lineCount === 1)
            endColumn = script.source.length + script.column_offset;
        else
            endColumn = script.source.length - (lineEnds[lineCount - 2] + 1);
    }

    return {
        id: script.id,
        name: script.nameOrSourceURL(),
        source: script.source,
        startLine: script.line_offset,
        startColumn: script.column_offset,
        endLine: endLine,
        endColumn: endColumn,
        isContentScript: !!script.context_data && script.context_data.indexOf("injected") == 0
    };
};

module.exports = {
    emptyResult: function() {
        var devtoolsFormat = {};
        return devtoolsFormat;
    },

    afterCompile: function(eventData) {
        return {
            method: 'Debugger.afterCompile',
            params:{}
        };
    },

    setexceptionbreak: function(response) {
        return {};
    }
};
