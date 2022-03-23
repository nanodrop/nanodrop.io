const { exit } = require('process')
const wallet = require('./models/nano-wallet/wallet.js')
const { startHTTPServer, startWSServer } = require('./server')

const http_port = process.env.PORT || 3000

function formatError(err) {
    console.error(err)
    if (typeof (err) == "object") return JSON.stringify(err)
    if (typeof (err) == "string") return err.toString()
    return "Unknown, check log"
}

function waitForSync(i = 0) {
    const wait_seconds = 30
    const attemps = 20
    return new Promise((resolve, reject) => {
        wallet.sync()
            .then((res) => resolve(res))
            .catch((err) => {
                console.error("Wallet Sync Failed: " + formatError(err))
                if (attemps - i == 0) {
                    console.info("Attempts exceeded!. Exiting...")
                    exit()
                }
                console.log("Trying again in " + wait_seconds + " seconds")
                setTimeout(function () {
                    waitForSync(i++)
                        .then((res) => resolve(res))
                        .catch((err) => reject(err))
                }, wait_seconds * 1000)
            })
    })
}

async function init() {
    try {

        const FAUCET_ACCOUNT = wallet.deriveWallet().account
        console.info("Imported account: " + FAUCET_ACCOUNT)

        await waitForSync()
        console.info("Wallet Sync Ok!")

        wallet.selfReceive()
        const server = startHTTPServer()
        startWSServer(server)
        server.listen(http_port, function () {
            console.log(`Listening on http://localhost:${http_port}`);
        });

    } catch (err) {
        console.error("Error: " + err)
    }
}

init()
