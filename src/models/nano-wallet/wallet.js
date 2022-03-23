const path = require('path')
require('dotenv/config')

const { deriveKeyPair, deriveAddress, derivePublicKey } = require("./nano-keys")
const { createBlock, hashBlock } = require("./block")
const { getWork } = require("./work")
const rpc = require("./rpc");
const { checkKey, checkIndex } = require('./check');
const { toMegaNano, toRaws, TunedBigNumber } = require('./convert')
const { accounts_monitor } = require('../nano_websockets')
const { updateWalletInfo, walletInfo, walletHistory, pushToWalletHistory } = require('../cache')

const { sleep, CustomError } = require('../utils.js')

const config = require(path.join(__dirname, '../../../config/config.json'))
let info = { ...walletInfo }

const MIN_AMOUNT = toRaws(config.min_amount)
const WAIT_RECEIVE_PENDINGS = false

let myWallet = {}
function deriveWallet() {
    try {
        let keyPair = {}
        if (checkKey(process.env.PRIVATE_KEY)) {
            keyPair.privateKey = process.env.PRIVATE_KEY
            keyPair.publicKey = derivePublicKey(process.env.PRIVATE_KEY)
            keyPair.address = deriveAddress(keyPair.publicKey)
        } else {
            if (!isNaN(process.env.INDEX) && checkIndex(parseInt(process.env.INDEX))) {
                if (checkKey(process.env.SEED)) {
                    keyPair = deriveKeyPair(process.env.SEED, parseInt(process.env.INDEX))
                } else {
                    throw new Error("Invalid SEED in env file")
                }
            } else {
                throw new Error("Invalid INDEX in env file")
            }
        }
        myWallet.account = keyPair.address
        myWallet.privateKey = keyPair.privateKey
        myWallet.publicKey = keyPair.publicKey
        return {
            account: myWallet.account,
            publicKey: myWallet.publicKey
        }
    } catch (e) {
        throw new CustomError("Deriving wallet", e.message)
    }
}

function receive(blockHash, amount, syncing = false) {
    console.info("Receiving " + toMegaNano(amount) + " Nano. Block: " + blockHash)
    return new Promise((resolve, reject) => {
        const newBalance = TunedBigNumber(info.balance).plus(amount).toString(10)
        const receiveBlock = createBlock({
            account: myWallet.account,
            balance: newBalance,
            link: blockHash,
            previous: info.frontier,
            representative: config.representative,
        }, myWallet.privateKey)
        getWork(info.frontier, "receive")
            .then((work) => {
                receiveBlock.block.work = work
                rpc.broadcast(receiveBlock.block)
                    .then((res) => {

                        // Update wallet info
                        info.pending = TunedBigNumber(info.pending).minus(amount).toString(10)
                        info.balance = newBalance
                        info.frontier = receiveBlock.hash
                        info.total_received = TunedBigNumber(info.total_received).plus(amount).toString(10)
                        updateWalletInfo(info)

                        // Get more info from node (like local_timestamp) and save block in history
                        rpc.block_info(receiveBlock.hash)
                            .then((res) => pushToWalletHistory([res]))
                            .catch((err) => console.error(err))

                        if (!syncing) {
                            // Cache PoW
                            getWork(receiveBlock.hash)
                                .then((res) => {
                                    console.info("Next work pre-cached!")
                                })
                                .catch((err) => {
                                    console.info("Error pre-caching...")
                                })
                        }

                        resolve({ hash: receiveBlock.hash, amount: amount })
                    })
                    .catch((err) => reject("Error broadcasting: " + JSON.stringify(err)))
            })
            .catch((err) => reject("Error in Proof of Work: " + JSON.stringify(err)))
    })
}

function send(to, amount) {
    console.info("Sending " + toMegaNano(amount) + " Nano to " + to)
    return new Promise((resolve, reject) => {
        const newBalance = TunedBigNumber(info.balance).minus(amount).toString(10)
        const sendBlock = createBlock({
            account: myWallet.account,
            balance: newBalance,
            linkAsAccount: to,
            previous: info.frontier,
            representative: config.representative,
        }, myWallet.privateKey)
        getWork(info.frontier, "all")
            .then((work) => {
                sendBlock.block.work = work
                rpc.broadcast(sendBlock.block)
                    .then((res) => {
                        if ("hash" in res && res.hash == sendBlock.hash) {

                            // update wallet info
                            info.balance = newBalance
                            info.frontier = sendBlock.hash
                            info.total_sent = TunedBigNumber(info.total_sent).plus(amount).toString(10)
                            updateWalletInfo(info)

                            // Get more info from node (like local_timestamp) and save block in history
                            rpc.block_info(sendBlock.hash)
                                .then((res) => pushToWalletHistory([res]))
                                .catch((err) => console.error(err))

                            // Cache PoW
                            getWork(sendBlock.hash)
                                .then((res) => {
                                    console.info("Next work pre-cached!")
                                })
                                .catch((err) => {
                                    console.info("Error pre-caching...")
                                })

                            resolve({ hash: sendBlock.hash, amount: amount })
                        } else {
                            reject("Invalid response broadcasting")
                        }
                    })
                    .catch((err) => reject("Error broadcasting: " + JSON.stringify(err)))
            })
            .catch((err) => reject("Error in Proof of Work: " + JSON.stringify(err)))
    })
}

//Reads the entire history to allow extra information: total_received, total_sent, pending_valid
function balance_history(account, history) {
    let amount, pendingBlocks = {}, pending_valid = 0, total_received = "0", total_sent = "0"
    return new Promise((resolve, reject) => {
        rpc.pending_blocks(account, MIN_AMOUNT)
            .then((pendings) => {

                // Get only valid pending balance (all-tx-amount => MIN_AMOUNT)
                for (let blockHash in pendings) {
                    amount = pendings[blockHash]
                    pending_valid = TunedBigNumber(pending_valid).plus(amount).toString(10)
                    pendingBlocks[blockHash] = amount
                }

                if (history != "") {
                    history.forEach((block) => {
                        if (block.subtype == "receive") total_received = TunedBigNumber(total_received).plus(block.amount).toString(10)
                        if (block.subtype == "send") total_sent = TunedBigNumber(total_sent).plus(block.amount).toString(10)
                    })
                    resolve({ balance: history[0].balance, pending_valid: pending_valid, pending_blocks: pendingBlocks, total_received: total_received, total_sent: total_sent })
                } else {
                    // Unopened Account
                    resolve({ balance: 0, total_received: total_received, total_sent: total_sent, pending_valid: pending_valid, pending_blocks: pendingBlocks})
                }
            })
            .catch(reject)
    })
}

function syncHistory() {
    return new Promise((resolve, reject) => {
        if (walletHistory.length) { // start from previous block saved
            let historyPrevious = walletHistory[walletHistory.length - 1].hash
            if (historyPrevious != info.frontier) {
                console.info("Updating wallet history from previous")
                rpc.account_history(myWallet.account, {
                    raw: true,
                    head: historyPrevious,
                    offset: 1,
                    count: 1000,
                    reverse: true
                })
                    .then((history) => pushToWalletHistory(history) && resolve(history))
                    .catch(reject)
            } else {
                resolve(walletHistory)
            }
        } else { // start from scratch
            console.info("Updating wallet history from scratch")
            rpc.account_history(myWallet.account, {
                raw: true,
                reverse: true,
                count: 1000
            })
                .then((history) => {
                    if (history.length) {
                        pushToWalletHistory(history)
                        resolve(history)
                    } else {
                        resolve([])
                    }
                })
                .catch(reject)
        }
    })
}

// If there is pending balance,
// receives tx with amounts greater than minimum
function receivePendings(blocks) {
    return new Promise(async (resolve) => {
        let result = {totalReceived: 0, sucess: [], fail: []}
        for (let hash in blocks) {
            let amount = blocks[hash]
            await receive(hash, amount, true)
                .then((res) => {
                    result.totalReceived = TunedBigNumber(result.totalReceived).plus(amount)
                    result.sucess.push({hash: hash, amount: amount})
                    info.pending_valid = TunedBigNumber(info.pending_valid).minus(amount)
                    console.info("Received " + toMegaNano(amount) + " Nano! Hash: " + res.hash)

                    //pre cache next work, if exists more pending blocks use DIFFICULTY_RECEIVE
                    let nextPoWDiff = "all"
                    if (Object.keys(blocks).length > (Object.keys(result.sucess).length + Object.keys(result.fail).length)) {
                        nextPoWDiff = "receive"
                    }
                    getWork(res.hash, nextPoWDiff)
                        .then((res) => {
                            console.info("Next work pre-cached!")
                        }).catch((err) => {
                            console.error(err)
                        })
                })
                .catch(async function (err) {
                    console.error("Error receiving: " + err)
                    result.fail.push({hash: hash, amount: amount})
                })
        }
        resolve(result)
    })
}

async function sync() {
    return new Promise((resolve, reject) => {

        console.info("Syncing Wallet...")

        rpc.account_info(myWallet.account)
            .then((res) => {

                // Save wallet state
                info.balance = res.balance
                info.pending = res.pending
                info.frontier = res.frontier
                info.representative = res.representative
                info.open_block = res.open_block
                info.modified_timestamp = res.modified_timestamp
                info.block_count = res.block_count
                info.weight = res.weight
                updateWalletInfo(info)

                syncHistory()
                    .then((history) => {
                        if (history.length) {

                            // Get total_received, total_sent, pending_valid
                            balance_history(myWallet.account, history)
                                .then((res) => {

                                    info.total_received = res.total_received
                                    info.total_sent = res.total_sent
                                    info.pending_valid = res.pending_valid
                                    updateWalletInfo(info)

                                    // Receive pendings
                                    if (WAIT_RECEIVE_PENDINGS){
                                        receivePendings(res.pending_blocks)
                                        .then(() => resolve())
                                    } else {
                                        receivePendings(res.pending_blocks)
                                        resolve()
                                    }

                                })
                                .catch(reject)
                        } else {
                            info.total_received = 0
                            info.total_sent = 0
                            info.pending_valid = 0
                            resolve()
                        }
                    })
                    .catch(reject)
            })
            .catch((err) => {
                if (err == "Account not found") {
                    resolve()
                } else {
                    reject(err)
                }
            })
    })
}

function selfReceive() {
    accounts_monitor([myWallet.account], function (res) {

        if (res.message.block.subtype == "send" && res.message.block.link_as_account == myWallet.account) {
            const amount = res.message.amount
            const hash = res.message.hash

            // Check if amount is >= minimum amount
            if (!TunedBigNumber(amount).isGreaterThanOrEqualTo(MIN_AMOUNT)) return

            // Receive funds
            receive(hash, amount)
                .then((response) => {
                    console.error("Received " + toMegaNano(amount) + " Nano. Hash: " + response.hash)
                })
                .catch((err) => {
                    console.error("Fail receiving: " + hash)
                    console.error(err)
                })
        }

    })
}

module.exports = {
    deriveWallet,
    myWallet,
    info,
    sync,
    send,
    receive,
    selfReceive
}