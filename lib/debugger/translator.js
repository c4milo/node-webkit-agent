/**
 * @fileoverview 
 * Transforms http://code.google.com/p/v8/wiki/DebuggerProtocol
 * to https://developers.google.com/chrome-developer-tools/docs/protocol/1.0
 **/

/*var formatScript = function(script) {
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
};*/

var formatScript = function(script) {
    var endLine = script.lineOffset + script.lineCount - 1;
    var endColumn = 0;

    // V8 will not count last line if script source ends with \n.
    if (script.source[script.sourceLength - 1] === '\n') {
        endLine += 1;
    } else {
        if (script.lineCount === 1) {
            endColumn = script.sourceLength + script.columnOffset;
        } else {
            endColumn = script.sourceLength - (script.source[script.lineCount - 2].length);
        }
    }

    return {
        scriptId: script.id.toString(),
        url: script.name,
        startLine: script.lineOffset,
        startColumn: script.columnOffset,
        endLine: endLine,
        endColumn: endColumn,
        isContentScript: false
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

    scripts: function(response) {
        var scripts = [];
        var scripts_ = response.body;

        for (var i = 0, len = scripts_.length; i < len; i++) {
            var script = scripts_[i];

            scripts.push({
                method: 'Debugger.scriptParsed',
                params: formatScript(script)
            });
        }

        return scripts;
    },

    /**
     * Naming exceptions in order to translate the v8 protocol
     * dynamicaly, based on the field `command` of
     */
    setexceptionbreak: function(response) {
        return {};
    },

    scriptCollected: function(script) {
        console.log(script);
    }
};
