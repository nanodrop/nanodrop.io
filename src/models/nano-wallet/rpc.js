const axios = require("axios")
const { node, worker } = require("../../../config/config.json")
const { BASE_DIFFICULTY, BASE_DIFFICULTY_RECEIVE, work_validate } = require('./work')
const BigNumber = require('bignumber.js')

const postRPC = function (data, nodeAddress = node) {
    if (typeof (nodeAddresses) == "string") nodeAddresses = [nodeAddresses]
    return new Promise(async function (resolve, reject) {
        let i = 0
        await axios.post(nodeAddress, data)
            .then((res) => {
                if (typeof res.data === 'object') {
                    if ("error" in res.data) {
                        reject(res.data)
                    } else {
                        resolve(res.data)
                    }
                } else {
                    reject("invalid node response")
                }
            }).catch((err) => {
                if (err.response) {
                    reject(err.response.data);
                } else if (err.request) {
                    reject("no response from node")
                } else {
                    reject(err.message)
                }
            })
    })
}

//Reads the entire history to allow extra information: total_received, total_sent
function balance_history(account, advanced = false) {
    return new Promise((resolve, reject) => {
        const data = {
            "action": "account_history",
            "account": account,
            "count": -1,
        }
        postRPC(data)
            .then((res) => {
                try {
                    let block, total_received = "0", total_sent = "0"
                    for (let i in res.history) {
                        block = res.history[i]
                        if (block.type == "receive") total_received = BigNumber(total_received).plus(block.amount).toString(10)
                        if (block.type == "send") total_sent = BigNumber(total_sent).plus(block.amount).toString(10)
                    }
                    resolve({ balance: res.history[0].balance, total_received: total_received, total_sent: total_sent })
                } catch (err) {
                    reject(err)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

let accounts_info = {}
function account_info(account) {
    if (!(account in accounts_info)) accounts_info[account] = {}
    return new Promise((resolve, reject) => {
        const data = {
            "action": "account_info",
            "account": account,
            "representative": "true",
            "weight": "true",
            "pending": "true"
        }

        postRPC(data)
            .then((res) => {
                try {
                    let info = {
                        account: account,
                        frontier: res.frontier,
                        open_block: res.open_block,
                        representative_block: res.representative_block,
                        balance: res.balance,
                        modified_timestamp: res.modified_timestamp,
                        block_count: res.block_count,
                        representative: res.representative,
                        weight: res.weight,
                        pending: res.pending
                    }

                    if (accounts_info[account].pending != info.pending || accounts_info[account].balance != info.balance) {
                        balance_history(account)
                            .then((res) => {
                                info.total_received = res.total_received
                                info.total_sent = res.total_sent
                                accounts_info[account] = info
                                resolve(info)
                            })
                            .catch((err) => {
                                reject(err)
                            })
                    } else {
                        info.total_received = accounts_info[account].total_received
                        info.total_sent = accounts_info[account].total_sent
                        accounts_info[account] = info
                        resolve(info)
                    }

                } catch (err) {
                    reject(err)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

function account_history(account) {
    return new Promise((resolve, reject) => {
        const data = {
            "action": "account_history",
            "account": account,
            "count": -1
        }
        postRPC(data)
            .then((res) => {
                try {
                    resolve(res.history)
                } catch (err) {
                    reject(err)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

function pending_blocks(account, threshold = 0) {
    return new Promise((resolve, reject) => {
        const data = {
            "action": "pending",
            "account": account,
            "count": -1,
            "threshold": threshold
        }

        postRPC(data)
            .then((res) => {
                if (!("blocks" in res)) return reject("invalid node response")
                try {
                    resolve(res.blocks)
                } catch (err) {
                    reject(err)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

function block_info(hash) {
    return new Promise((resolve, reject) => {
        let data = {
            "action": "block_info",
            "json_block": "true",
            "hash": hash
        }
        postRPC(data)
            .then((res) => {
                if ("contents" in res) {
                    try {
                        let block = res.contents
                        block.amount = res.amount
                        block.hash = hash
                        block.local_timestamp = res.local_timestamp
                        resolve(block)
                    } catch (err) {
                        reject(err)
                    }
                } else {
                    reject("block not found")
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

function work_generate(hash, difficulty = BASE_DIFFICULTY) {
    return new Promise((resolve, reject) => {
        const data = {
            action: "work_generate",
            hash: hash,
            difficulty: difficulty
        }
        postRPC(data, worker)
            .then((res) => {
                resolve(res)
            }).catch((err) => {
                reject(err)
            })
    })
}

function broadcast(block_json) {
    return new Promise((resolve, reject) => {
        const data = {
            "action": "process",
            "json_block": "true",
            "block": block_json
        }
        postRPC(data)
            .then((res) => {
                if ("hash" in res) {
                    resolve(res)
                } else {
                    reject(res)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

function telemetry(account) {
    return new Promise((resolve, reject) => {
        const data = {
            "action": "telemetry"
        }
        postRPC(data)
            .then((res) => {
                try {
                    resolve(res)
                } catch (err) {
                    reject(err)
                }
            }).catch((err) => {
                reject(err)
            })
    })
}

module.exports = {
    account_info,
    account_history,
    pending_blocks,
    block_info,
    broadcast,
    work_generate,
    telemetry
}