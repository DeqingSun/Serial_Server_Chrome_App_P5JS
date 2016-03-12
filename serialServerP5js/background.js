/**
 * Listens for the app launching then creates the window
 *
 * @see http://developer.chrome.com/apps/app.runtime.html
 * @see http://developer.chrome.com/apps/app.window.html
 */
chrome.app.runtime.onLaunched.addListener(function () {
    new ControlPanelWindow();
});

var ControlPanelWindow = function () {

    var openedSocketID = null;

    // Center window on screen.
    var screenWidth = screen.availWidth;
    var screenHeight = screen.availHeight;
    var width = 500;
    var height = 300;

    chrome.app.window.create('index.html', {
            id: "helloWorldID"
            , outerBounds: {
                width: width
                , height: height
                , left: Math.round((screenWidth - width) / 2)
                , top: Math.round((screenHeight - height) / 2)
            }
        }
        , function (windowObj) { //callback
            console.log("createWindow callback");
            windowObj.contentWindow.AddOpenedSocketId = function (id) {
                openedSocketID = id;
            };
            windowObj.onClosed.addListener(function () {
                console.log("onClosed callback");
                if (openedSocketID) {
                    chrome.sockets.tcpServer.close(openedSocketID, function () {
                        if (chrome.runtime.lastError) {
                            console.warn("chrome.sockets.tcpServer.close:", chrome.runtime.lastError);
                        }
                    });
                }
            });
        }
    );
}
