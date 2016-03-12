var port = 8081;

function $(id) {
    return document.getElementById(id);
}

function log(text) {
    console.log(text);

    //$('log').value += text + '\n';
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

        wsServer.addEventListener('request', function (req) {
            log('Client connected');
            var socket = req.accept();
            connectedSockets.push(socket);

            // When a message is received on one socket, rebroadcast it on all
            // connected sockets.
            socket.addEventListener('message', function (e) {
                for (var i = 0; i < connectedSockets.length; i++)
                    connectedSockets[i].send(e.data);
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
    log('This is a test of an HTTP and WebSocket server. This application is ' +
        'serving its own source code on port ' + port + '. Each client ' +
        'connects to the server on a WebSocket and all messages received on ' +
        'one WebSocket are echoed to all connected clients - i.e. a chat ' +
        'server. Enjoy!');
    initWebSocket();

});