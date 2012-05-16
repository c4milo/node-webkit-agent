var translator = require('./translator');

function DebuggerClient() {

}

(function() {
    this.connect = function(callback) {
        callback(translator.result({}));
    };
}).call(DebuggerClient.prototype);

module.exports = DebuggerClient;
