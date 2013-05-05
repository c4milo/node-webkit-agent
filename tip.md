function (message) { console.log('received: ' + message); InspectorBackend.dispatch(message.data); }
WebInspector.socket.onmessage = function(message) { console.log('received: ' + message.data); InspectorBackend.dispatch(message.data); }
