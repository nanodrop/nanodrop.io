let walletInfo = {
    balance: "0",
    pending: "0",
    frontier: "0000000000000000000000000000000000000000000000000000000000000000",
    representative: "nano_3kc8wwut3u8g1kwa6x4drkzu346bdbyqzsn14tmabrpeobn8igksfqkzajbb",
    open_block: "0000000000000000000000000000000000000000000000000000000000000000",
    modified_timestamp: "0",
    block_count: 0,
    weight: 0,
    total_received: "0",
    total_sent: "0",
    total_sent_percentage: 0,
    pending_valid: 0
}

function updateWalletInfo(info) {
    walletInfo = info
}

// Keeps the history of last 1000 transaction
let walletHistoryData = []

function walletHistory() {
    return walletHistoryData
}

const dropsCount = { sent: 0, received: 0 }

function pushToWalletHistory(blocks) {
    blocks.forEach((block) => {
        if ("link_as_account" in block) {
            block.account = block.link_as_account
            delete (block.link_as_account)
        }
    })
    walletHistoryData = [...walletHistoryData, ...blocks].splice(0, 1000)
    blocks.forEach((block) => {
        if (block.subtype == "send") dropsCount.sent++
        if (block.subtype == "receive") dropsCount.received++
    })
}

const ip_info_list = {}

function updateIPInfoList(ip, info) {
    ip_info_list[ip] = info
}

function ipInfo(ip) {
    return ip_info_list[ip]
}

module.exports = {
    walletInfo,
    walletHistory,
    pushToWalletHistory,
    updateWalletInfo,
    updateIPInfoList,
    ipInfo
}
