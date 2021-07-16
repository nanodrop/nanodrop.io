const fs = require('fs');
const path = require('path')

const filesPath = {
    wallet: {
        info: path.join(__dirname, "../../data/wallet/info.json"),
        history: path.join(__dirname, "../../data/wallet/history.json")
    },
    drops: {
        ipList: path.join(__dirname, "../../data/drops/ip.json"),
        nanoAccounts: path.join(__dirname, "../../data/drops/nano-accounts.json"),
        emails: path.join(__dirname, "../../data/drops/emails.json")
    }
}

let ip_list = require(filesPath.drops.ipList)
let nanoAccounts_list = require(filesPath.drops.nanoAccounts)
let emails_list = require(filesPath.drops.emails)

function updateFile(file, data){
    try {
        const dataJSON = JSON.stringify(data, null, 2)
        const write = fs.writeFileSync(file, dataJSON)
        return write
    } catch (err) {
        console.error("Failed Upating File " + file)
        throw new Error(err)
    }
}

function timestamp () {
    return Date.now()
}
function updateWalletInfo(info){
    updateFile(filesPath.wallet.info, info)    
}

function updateWalletHistory(history){
    updateFile(filesPath.wallet.history, history)    
}

function updateNanoAccountsList(account){
    if (!(account in nanoAccounts_list)) nanoAccounts_list[account] = []
    nanoAccounts_list[account].push(timestamp())
    updateFile(filesPath.drops.nanoAccounts, nanoAccounts_list)    
}

function updateIPList(ip){
    if (! (ip in ip_list)) ip_list[ip] = []
    ip_list[ip].push(timestamp())
    updateFile(filesPath.drops.ipList, ip_list)
}

function updateEmailsList(email){
    if (! (email in emails_list)) emails_list[email] = []
    emails_list[email].push(timestamp())
    updateFile(filesPath.drops.emails, emails_list)  
}

function dropsCount(data){
    let result = {}
    if ("account" in data) {
        if (data.account in nanoAccounts_list) {
            result.account = nanoAccounts_list[data.account].length
        } else {
            result.account = 0
        }
    }
    if ("ip" in data) {
        if (data.ip in ip_list) {
            result.ip = ip_list[data.ip].length
        } else {
            result.ip = 0
        }
    }
    if ("email" in data) {
        if (data.email in emails_list) {
            result.email = emails_list[data.email].length
        } else {
            result.email = 0
        }
    }
    return result
}

module.exports = {
    updateIPList,
    updateNanoAccountsList,
    updateEmailsList,
    updateWalletHistory,
    updateWalletInfo,
    dropsCount
}