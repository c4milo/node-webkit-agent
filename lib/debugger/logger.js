var fs = require('fs');
var util = require('util');

var logfd;
module.exports = {
    log: function log(message) {
        if (!logfd) {
            logfd = fs.openSync('/tmp/nodejs-debug.log', 'a+');
        }

        if (typeof message != 'string') {
            message = util.inspect(message);
        }
        message = new Buffer(message + '\n');
        fs.write(logfd, message, 0, message.length);
    }
};

