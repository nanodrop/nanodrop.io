const websockets_api = "wss://ws.nanodrop.io"

/* Nano websockets */
function new_websocket(url, ready_callback, message_callback) {
    let socket = new WebSocket(url);
    socket.onopen = function () {
        console.log('WebSocket is now open');
        if (ready_callback !== undefined) ready_callback(this);
    }
    socket.onerror = function (e) {
        console.error('WebSocket error');
        console.error(e);
    }
    socket.onmessage = function (response) {
        console.log('New message from: ' + url);
        if (message_callback !== undefined) message_callback(response);
    }

    return socket;
}

function start_websockets(callback) {
    new_websocket(websockets_api, function (socket) {

        // Set Params
        let params = {
            action: "subscribe",
            topic: "confirmation"
          }
        
        //Subscribe websocket
        socket.send(JSON.stringify(params));

    }, function (response) {
        // onmessage
        let data = JSON.parse(response.data);
        if (data.topic != 'confirmation' && data.topic != 'pending') {
            console.log("different topic: ")
            console.log(data)
            return
        };
        handle_block_dump(data, callback);
    });
}


function handle_block_dump(data, callback) {
    let fdata;
    try {
        const message = data.message
        fdata = {
            topic: data.topic,
            dtg: new Date(parseInt(data.time)),
            account: message.account,
            block: message.block,
            hash: message.hash,
            amount: message.amount
        }
        callback(fdata)
    } catch (e) {
        console.error('In index.handle_block_dump: error parsing received WebSocket data.');
        console.error(e);
        return;
    }
}