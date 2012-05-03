var helpers = require('./helpers');

//Code was based on /WebKit/Source/WebCore/inspector/InjectedScriptSource.js
var _objectId = 0;
var RemoteObject = function(object) {
    this.type = typeof object;

    if (helpers.isPrimitiveValue(object) ||
        object === null) {
        // We don't send undefined values over JSON.
        if (typeof object !== "undefined") {
            this.value = object;
        }

        // Null object is object with 'null' subtype'
        if (object === null) {
            this.subtype = "null";
        }

        // Provide user-friendly number values.
        if (typeof object === "number") {
            this.description = object + "";
        }
        return;
    }

    this.objectId = JSON.stringify({ injectedScriptId: 0, id: _objectId++});
    var subtype = helpers.subtype(object);
    if (subtype) {
        this.subtype = subtype;
    }
    this.className = '';
    this.description = helpers.describe(object);
    this.value = helpers.decycle(object);
};

var getPropertyDescriptors = function(object, ownProperties) {
    var descriptors = [];
    var nameProcessed = {};
    nameProcessed.__proto__ = null;

    for (var o = object; helpers.isObject(o); o = o.__proto__) {
        var names = Object.getOwnPropertyNames(o);
        for (var i = 0; i < names.length; ++i) {
            var name = names[i];
            if (nameProcessed[name]) {
                continue;
            }

            var descriptor = {};
            try {
                nameProcessed[name] = true;
                descriptor = Object.getOwnPropertyDescriptor(object, name);
                if (!descriptor) {
                    try {
                        descriptors.push({
                            name: name,
                            value: object[name],
                            writable: false,
                            configurable: false,
                            enumerable: false
                        });
                    } catch (e) {
                        // Silent catch.
                    }
                    continue;
                }
            } catch (e) {
                descriptor = {};
                descriptor.value = e;
                descriptor.wasThrown = true;
            }

            descriptor.name = name;
            descriptors.push(descriptor);
        }

        if (ownProperties) {
            if (object.__proto__) {
                descriptors.push({
                    name: "__proto__",
                    value: object.__proto__,
                    writable: true,
                    configurable: true,
                    enumerable: false
                });
            }
            break;
        }
    }
    return descriptors;
};

function RuntimeAgent() {
    this.objects = {};
}

(function() {
    this.evaluate = function(params, sendResult) {
        var err, result;

        try {
            result = eval.call(global, "with ({}) {\n" + params.expression + "\n}");
        } catch (e) {
            return sendResult(this.createThrownValue(e));
        }

        sendResult({
            result: this.wrapObject(result, params.objectGroup),
            wasThrown: err ? true : false
        });
    };

    this.getProperties = function(params, sendResult) {
        var object = this.objects[params.objectId];

        if (helpers.isUndefined(object)) {
            return sendResult(new Error('Unknown object'));
        }

        object = object.value;

        var descriptors = getPropertyDescriptors(object, params.ownProperties);
        var len = descriptors.length;

        if (len === 0 &&
            "arguments" in object) {
            for (var key in object) {
                descriptors.push({
                    name: key,
                    value: object[key],
                    writable: false,
                    configurable: false,
                    enumerable: true
                });
            }
        }

        for (var i = 0; i < len; ++i) {
            var descriptor = descriptors[i];
            if ("get" in descriptor) {
                descriptor.get = this.wrapObject(descriptor.get);
            }

            if ("set" in descriptor) {
                descriptor.set = this.wrapObject(descriptor.set);
            }

            if ("value" in descriptor) {
                descriptor.value = this.wrapObject(descriptor.value);
            }

            if (!("configurable" in descriptor)) {
                descriptor.configurable = false;
            }

            if (!("enumerable" in descriptor)) {
                descriptor.enumerable = false;
            }
        }

        sendResult({
            result: descriptors
        });
    };

    this.wrapObject = function(object, objectGroup) {
        var remoteObject;

        try {
            remoteObject = new RemoteObject(object);
        } catch (e) {
            var description = "<failed to convert exception to string>";
            try {
                description = helpers.describe(e);
            } catch (ex) {}
            remoteObject = new RemoteObject(description);
        }

        this.objects[remoteObject.objectId] = {
            objectGroup: objectGroup,
            value: object
        };
        return remoteObject;
    };

    this.createThrownValue = function(value) {
        var remoteObject = this.wrapObject(value);
        try {
            remoteObject.description = '' + value;
        } catch (e) {}

        return {
            wasThrown: true,
            result: remoteObject
        };
    };

    this.callFunctionOn = function(params, sendResult) {
        var object = this.objects[params.objectId];

        if (helpers.isUndefined(object)) {
            return sendResult(new Error('Unknown object'));
        }

        object = object.value;
        var resolvedArgs = [];

        var args = params.arguments;

        if (args) {
            for (var i = 0; i < args.length; ++i) {
                var objectId = args[i].objectId;
                if (objectId) {
                    var resolvedArg = this.objects[objectId];
                    if (!resolvedArg) {
                         return sendResult(new Error('Unknown object'));
                    }

                    resolvedArgs.push(resolvedArg.value);
                } else if ("value" in args[i]) {
                    resolvedArgs.push(args[i].value);
                } else {
                    resolvedArgs.push(undefined);
                }
            }
        }

        try {
            var func = eval("(" + params.functionDeclaration + ")");
            if (typeof func !== "function") {
                return sendResult(new Error("Expression does not evaluate to a function"));
            }

            return sendResult({
                result: {
                    result: {
                        type: 'object',
                        value: func.apply(object, resolvedArgs)
                    },
                    wasThrown: false
                }
            });
        } catch (e) {
            return sendResult(this.createThrownValue(e));
        }
    };

    this.releaseObjectGroup = function(params, sendResult) {
        for (var key in this.objects) {
            var value = this.objects[key];
            if (value.objectGroup === params.objectGroup) {
                delete this.objects[key];
            }
        }
        sendResult({});
    };

    this.releaseObject = function(params, sendResult) {
        delete this.objects[params.objectId];
        sendResult({});
    };
}).call(RuntimeAgent.prototype);

module.exports = new RuntimeAgent();

