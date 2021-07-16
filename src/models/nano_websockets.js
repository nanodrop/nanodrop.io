const WebSocket = require('ws')

const { websockets_api } = require("../../config/config.json")

const DEBUG = false
let SOCKET = false

/* Nano websockets */
function new_websocket(url, ready_callback, message_callback) {
    let socket = new WebSocket(url);
    socket.onopen = function () {
        if (DEBUG) console.log('WebSocket is now open');
        if (ready_callback !== undefined) ready_callback(this);
    }
    socket.onclose = function (e) {
        if (DEBUG) console.log("WebSocket is closed now.");
    }
    socket.onerror = function (e) {
        if (DEBUG) console.error('WebSocket error');
        if (DEBUG) console.error(e);
    }
    socket.onmessage = function (msg) {
        if (DEBUG) console.log('New message from: ' + url);
        if (message_callback !== undefined) message_callback(msg);
    }
    return socket;
}

function start_websockets(accounts, params, callback) {
    new_websocket(websockets_api, function (socket) {

        SOCKET = socket

        callback("opened")

        //Subscribe websocket
        SOCKET.send(JSON.stringify(params))

    }, function (response) {
        // onmessage
        let data = JSON.parse(response.data);
        if (data.topic != 'confirmation') return
        handle_block_dump(data, callback);
    });
}

async function keepAlive () {
    if (SOCKET === false) return
    SOCKET.send(JSON.stringify({ "action": "ping" }))
    setTimeout(keepAlive, 60000)
}

function handle_block_dump(data, callback) {
    let fdata;
    try {
        const message = data.message
        fdata = {
            topic: data.topic,
            time: data.time,
            message: {
                account: message.account,
                block: message.block,
                hash: message.hash,
                amount: message.amount
            }
        }
    } catch (e) {
        console.error('In index.handle_block_dump: error parsing received WebSocket data.');
        console.error(e);
        return;
    }
    callback(fdata)
}

const callbacks = {}

function accounts_monitor(accounts, callback) {

    return new Promise((resolve, reject) => {
        function return_receives(res) {

            const block_subtype = res.message.block.subtype
            const link_as_account = res.message.block.link_as_account

            if (block_subtype == "send" && Object.keys(callbacks).includes(link_as_account)) {

                callbacks[link_as_account].forEach(callback => callback(res))

            }
        }

        // Associate callbacks to accounts
        accounts.forEach(account => {
            if (!(account in callbacks)) callbacks[account] = []
            callbacks[account].push(callback)
        })

        // Set Params
        let params = {
            action: "subscribe",
            topic: "confirmation"
        }

        if (SOCKET === false) {

            if (DEBUG) console.log("Creating Nano websockets")

            // Params options
            params.options = {
                all_local_accounts: true,
                accounts: accounts
            }
            start_websockets(accounts, params, function(res){
                if (res == "opened") {
                    resolve("opened")
                } else {
                    return_receives(res)
                }

            keepAlive()

            })
        } else {
            console.log("Updating Nano websockets")

            // Params options (only updates)
            params.action = "update"
            params.options = {
                accounts_add: accounts
            }
            SOCKET.send(JSON.stringify(params));
        }
    })

}

module.exports = { accounts_monitor }