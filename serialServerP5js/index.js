var port = 8081;

function $(id) {
    return document.getElementById(id);
}

function log(text) {
    $('LogView').innerHTML += text + '<br>';
}


function initWebSocket() {
    if (http.Server && http.WebSocketServer) {
        // Listen for HTTP connections.
        var server = new http.Server();
        var wsServer = new http.WebSocketServer(server);
        server.listen(port);

        server.addEventListener('serverReady', function (socketInfo) {
            AddOpenedSocketId(socketInfo.socketId);
        });

        server.addEventListener('request', function (req) {
            var url = req.headers.url;
            if (url == '/')
                url = '/index.html';
            // Serve the pages of this chrome application.
            req.serveUrl(url);
            return true;
        });

        // A list of connected websockets.
        var connectedSockets = [];
        var serialPort = null;
        var serialPortName = "";
        var serialConnectionId = -1;

        var openSerial = function (serialport, serialoptions) {
            log("openSerial: " + serialport);
            if (serialConnectionId < 0) {
                console.log("serialPort == null || !serialPort.isOpen()");

                serialPortName = serialport;
                var options = serialoptions;

                chrome.serial.connect(serialport, options, function (connectionInfo) {
                    if (!connectionInfo) {
                        console.log("Couldn't open port: " + serialport);
                        sendit({
                            method: 'error'
                            , data: "Couldn't open port: " + serialport
                        });
                        return;
                    }

                    console.log(connectionInfo);
                    sendit({
                        method: 'openserial'
                        , data: {}
                    });
                    serialConnectionId = connectionInfo.connectionId;
                    chrome.serial.onReceive.addListener(function (receiveInfo) {
                        if (receiveInfo.connectionId !== serialConnectionId) {
                            return;
                        }
                        //{"type":"Buffer","data":[10]}
                        for (var i = 0; i < receiveInfo.data.length; i++) {
                            sendit({
                                method: 'data'
                                , data: receiveInfo.data[i]
                            });
                        }
                    });
                    chrome.serial.onReceiveError.addListener();
                });


                serialPort.on('data', function (incoming) {
                    //{"type":"Buffer","data":[10]}
                    for (var i = 0; i < incoming.length; i++) {
                        sendit({
                            method: 'data'
                            , data: incoming[i]
                        });
                    }
                });

                serialPort.on('close', function (data) {
                    logit("serialPort.on close " + data);
                    sendit({
                        method: 'close'
                        , data: data
                    });
                });

                serialPort.on('error', function (data) {
                    logit("serialPort.on error " + data, true);
                    sendit({
                        method: 'error'
                        , data: data
                    });
                });


            } else {

                if (serialport == serialPortName) {

                    sendit({
                        method: 'error'
                        , data: "Already open"
                    });
                    log("serialPort is already open");
                    sendit({
                        method: 'openserial'
                        , data: {}
                    });

                } else {

                    // Trying to open a second port
                    sendit({
                        method: 'error'
                        , data: "Unsupported operation, " + serialPortName + " is already open. You will receive data from that port."
                    });
                    log("Unsupported operation, " + serialPortName + " is already open.");
                }
            }
        };

        var closeSerial = function () {
            logit("closeSerial");
            if (serialPort != null && serialPort.isOpen()) {
                logit("serialPort != null && serialPort.isOpen so close");
                logit("serialPort.flush, drain, close");

                serialPort.flush();
                serialPort.drain();
                serialPort.close(
                    function (error) {
                        if (error) {
                            sendit({
                                method: 'error'
                                , data: error
                            });
                            console.log(error);
                        }
                    }
                );
            }

            // Let's try to close a different way
            if (serialPort != null && serialPort.isOpen()) {
                logit("serialPort != null && serialPort.isOpen() is true so serialPort = null");

                serialPort = null;
            }

        };

        var sendit = function (toSend) {
            var dataToSend = JSON.stringify(toSend);
            //console.log("sendit: " + dataToSend + " to " + clients.length + " clients");
            try {
                for (var i = 0; i < connectedSockets.length; i++) {
                    connectedSockets[i].send(dataToSend);
                }
            } catch (e) {
                //console.log("Error Sending: " + e);
            }
        };



        wsServer.addEventListener('request', function (req) {
            log('Client connected');
            var socket = req.accept();
            connectedSockets.push(socket);

            // When a message is received on one socket, rebroadcast it on all
            // connected sockets.
            socket.addEventListener('message', function (e) {
                var inmessage = e.data;
                var message = JSON.parse(inmessage);
                //console.log("on message: " + JSON.stringify(message));
                if (typeof message !== "undefined" && typeof message.method !== "undefined" && typeof message.data !== "undefined") {
                    if (message.method === "echo") {
                        //console.log("echo " + message.data);
                        sendit({
                            method: 'echo'
                            , data: message.data
                        });
                    } else if (message.method === "list") {
                        chrome.serial.getDevices(function (ports) {
                            var portNames = [];
                            ports.forEach(function (port) {
                                //console.log(port.path);
                                portNames.push(port.path);
                                //console.log(port.displayName);
                                //console.log(port.vendorId);
                                //console.log(port.productId);
                            });
                            sendit({
                                method: 'list'
                                , data: portNames
                            });
                        });
                    } else if (message.method === "openserial") {

                        console.log("message.method === openserial");

                        // Open up
                        if (typeof message.data.serialport === 'string') {
                            console.log("new SerialPort.SerialPort");

                            openSerial(message.data.serialport, message.data.serialoptions);

                        } else {
                            log("User didn't specify a port to open");
                            sendit({
                                method: 'error'
                                , data: "You must specify a serial port to open"
                            });
                        }

                    } else if (message.method === "write") {

                        serialPort.write(message.data);

                    } else if (message.method === "close") {
                        logit("message.method === close");
                        closeSerial();
                    }
                } else {
                    console.log("Not a message I understand: " + JSON.stringify(message));
                }





            });

            // When a socket is closed, remove it from the list of connected sockets.
            socket.addEventListener('close', function () {
                log('Client disconnected');
                for (var i = 0; i < connectedSockets.length; i++) {
                    if (connectedSockets[i] == socket) {
                        connectedSockets.splice(i, 1);
                        break;
                    }
                }
            });
            return true;
        });
    } else {
        log('HTTP server is not ready');
    }
}




document.addEventListener('DOMContentLoaded', function () {
    log('This is a test of an HTTP and WebSocket server on port ' + port);
    initWebSocket();

});