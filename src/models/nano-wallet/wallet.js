const BigNumber = require('bignumber.js')
const path = require('path')
const fs = require('fs')
require('dotenv/config')

const { deriveKeyPair, deriveAddress, derivePublicKey } = require("./nano-keys")
const { createBlock, hashBlock } = require("./block")
const { getWork } = require("./work")
const rpc = require("./rpc");
const { checkKey, checkIndex } = require('./check');
const { toMegaNano, TunedBigNumber } = require('./convert')
const { accounts_monitor } = require('../nano_websockets')
const { updateWalletInfo, walletInfo, walletHistory, updateWalletHistory } = require('../data')

const { sleep, CustomError } = require('../utils.js')

const config = require(path.join(__dirname, '../../../config/config.json'))
let info = { ...walletInfo }

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

function receive(blockHash, amount) {
    console.info("Receiving " + toMegaNano(amount) + " Nano. Block: " + blockHash)
    return new Promise((resolve, reject) => {
        const newBalance = BigNumber(info.balance).plus(amount).toString(10)
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
                        info.pending -= amount
                        info.balance = newBalance
                        info.frontier = receiveBlock.hash
                        info.total_received = BigNumber(info.total_received).plus(amount).toString(10)
                        updateWalletInfo(info)

                        // Get more info from node (like local_timestamp) and save block in history
                        rpc.block_info(receiveBlock.hash)
                            .then((res) => updateWalletHistory([res]))
                            .catch((err) => console.error(err))

                        // Cache PoW
                        getWork(sendBlock.hash)
                            .then((res) => {
                                console.info("Next work pre-cached!")
                            })
                            .catch((err) => {
                                console.info("Error pre-caching...")
                            })

                        resolve({ hash: receiveBlock.hash, amount: amount })
                    })
                    .catch((err) => {
                        reject("Error broadcasting: " + JSON.stringify(err))
                    })
            })
            .catch((err) => {
                reject("Error in Proof of Work: " + JSON.stringify(err))
            })
    })
}

function send(to, amount) {
    console.info("Sending " + toMegaNano(amount) + " Nano to " + to)
    return new Promise((resolve, reject) => {
        const newBalance = BigNumber(info.balance).minus(amount).toString(10)
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
                            info.total_sent = BigNumber(info.total_sent).plus(amount).toString(10)
                            updateWalletInfo(info)

                            // Get more info from node (like local_timestamp) and save block in history
                            rpc.block_info(sendBlock.hash)
                                .then((res) => updateWalletHistory([res]))
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
                    .catch((err) => {
                        reject("Error broadcasting: " + JSON.stringify(err))
                    })
            })
            .catch((err) => {
                reject("Error in Proof of Work: " + JSON.stringify(err))
            })
    })
}

function syncHistory() {
    return new Promise((resolve, reject) => {
        if (walletHistory.length) { // start from previous block saved
            let historyPrevious = walletHistory[walletHistory.length - 1].hash
            if (historyPrevious != info.frontier) {
                console.info("Updating wallet history")
                rpc.account_history(myWallet.account, {
                    raw: true,
                    head: historyPrevious,
                    offset: 1,
                    reverse: true
                })
                    .then((history) => {
                        if (history.length) {
                            if (updateWalletHistory(history)) {
                                resolve()
                            } else {
                                reject("history saving error")
                            }
                        } else {
                            resolve()
                        }
                    })
                    .catch((err) => reject(err))
            } else {
                resolve()
            }
        } else { // start from scratch
            console.info("Updating wallet history")
            rpc.account_history(myWallet.account, {
                raw: true,
                reverse: true
            })
                .then((history) => {
                    if (history.length) {
                        if (updateWalletHistory(history)) {
                            resolve()
                        } else {
                            reject("history saving error")
                        }
                    } else {
                        resolve()
                    }
                })
                .catch((err) => reject(err))
        }
    })
}

// If there is pending balance,
// receives tx with amounts greater than minimum
function receivePendings() {
    if (info.pending >= config.minAmount && info.pending != old_pending) {
        rpc.pending_blocks(myWallet.account, config.minAmount)
            .then(async function (blocks) {
                let received = 0
                for (let hash in blocks) {
                    let amount = blocks[hash]
                    await receive(hash, amount)
                        .then((res) => {
                            received++
                            console.info("Received " + toMegaNano(amount) + " Nano! Hash: " + res.hash)

                            //pre cache next work, if exists more pending blocks use DIFFICULTY_RECEIVE
                            let nextPoWDiff = "all"
                            if (Object.keys(blocks).length > received) {
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
                            console.log("Error receiving: " + err)
                            await sleep(5000)
                        })
                }
            })
            .catch((err) => {
                console.log("Error receiving: " + err)
            })
    }
}

async function sync() {
    return new Promise((resolve, reject) => {

        console.info("Syncing Wallet...")

        let old_pending = info.pending

        rpc.account_info(myWallet.account)
            .then((res) => {

                // Save wallet state
                info.balance = res.balance
                info.pending = res.pending
                info.frontier = res.frontier
                info.representative = res.representative
                info.total_received = res.total_received
                info.total_sent = res.total_sent
                info.open_block = res.open_block
                info.modified_timestamp = res.modified_timestamp
                info.block_count = res.block_count
                info.weight = res.weight
                updateWalletInfo(info)

                syncHistory(info.frontier)
                    .then(() => {
                        resolve()
                        receivePendings()
                    })
                    .catch((err) => reject(err))
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
            if (!TunedBigNumber(amount).isGreaterThanOrEqualTo(config.minAmount)) return

            // Receive funds
            receive(hash, amount)
                .then((response) => {
                    console.log("Received " + toMegaNano(amount) + " Nano. Hash: " + response.hash)
                })
                .catch((err) => {
                    console.log("Fail receiving: " + hash)
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