const fs = require('fs');
const path = require('path')

const { sleep, timestamp } = require('./utils.js')

const filesPath = {
    wallet: {
        info: path.join(__dirname, "../../data/wallet/info.json"),
        history: path.join(__dirname, "../../data/wallet/history.json")
    },
    drops: {
        ipList: path.join(__dirname, "../../data/drops/ip.json"),
        nanoAccounts: path.join(__dirname, "../../data/drops/nano-accounts.json"),
        emails: path.join(__dirname, "../../data/drops/emails.json")
    },
    analytics: {
        ipInfoList: path.join(__dirname, "../../data/analytics/ip-info.json"),
        proxiesList: path.join(__dirname, "../../data/analytics/proxy-usage.json"),
        countriesDropsList: path.join(__dirname, "../../data/analytics/drops-by-country.json")
    }
}

let walletInfo = require(filesPath.wallet.info)
let walletHistory = require(filesPath.wallet.history)

let ip_list = require(filesPath.drops.ipList)
let nanoAccounts_list = require(filesPath.drops.nanoAccounts)
let emails_list = require(filesPath.drops.emails)

let ip_info_list = require(filesPath.analytics.ipInfoList)
let proxies_list = require(filesPath.analytics.proxiesList)
let countries_drops = require(filesPath.analytics.countriesDropsList)

// Count drops
let totalDrops = {sent: 0, received: 0}
walletHistory.forEach((block) => {
    if (block.subtype == "send") totalDrops.sent++
    if (block.subtype == "receive") totalDrops.received++
})

let write_promises = []

async function updateFile(file, data){
    try {
        while (write_promises.includes(file)) await sleep(50) 
        write_promises.push(file)
        const dataJSON = JSON.stringify(data, null, 2)
        const write = fs.writeFileSync(file, dataJSON)
        return write
    } catch (err) {
        console.error("Failed Upating File " + file)
        throw new Error(err)
    } finally {
        write_promises.splice(write_promises.indexOf(file), 1)
    }
}

function updateWalletInfo(info){
    updateFile(filesPath.wallet.info, info)    
}

function updateWalletHistory(data){
    if (data[0].previous == ''.padStart(64, 0)) { // if open block is present, save all history
        walletHistory = [...data]
        totalDrops = 0
        walletHistory.forEach((block) => {
            if (block.subtype == "send") totalDrops++
        })        
    } else { // save only new blocks
        if (walletHistory[walletHistory.length - 1].hash != data[data.length - 1].previous) { // if previous is wrong, return false
            return false
        } else {
            walletHistory.push(...data)
        }
        data.forEach((block) => {
            if (block.subtype == "send") totalDrops++
        })      
    }
    updateFile(filesPath.wallet.history, walletHistory)
    return true   
}

function updateNanoAccountsList(account){
    if (!(account in nanoAccounts_list)) nanoAccounts_list[account] = []
    nanoAccounts_list[account].push(timestamp())
    updateFile(filesPath.drops.nanoAccounts, nanoAccounts_list)    
}

function updateIPList(ip, ts = timestamp()) {
    if (! (ip in ip_list)) ip_list[ip] = []
    ip_list[ip].push(ts)
    updateFile(filesPath.drops.ipList, ip_list)
}

function updateEmailsList(email){
    if (! (email in emails_list)) emails_list[email] = []
    emails_list[email].push(timestamp())
    updateFile(filesPath.drops.emails, emails_list)  
}

function updateIPInfoList(ip, info){
    ip_info_list[ip] = info
    updateFile(filesPath.analytics.ipInfoList, ip_info_list)
}

function ipInfo(ip) {
    return ip_info_list[ip]
}

function updateProxiesUsage(proxyIP, realIP){
    if (! (proxyIP in proxies_list)) proxies_list[proxyIP] = []
    proxies_list[proxyIP].push(realIP)
    updateFile(filesPath.analytics.proxiesList, proxies_list)
}

function updateCountriesDrops(ip, realIP = false){
    const countryCode = ip_info_list[ip].countryCode
    if (!(countryCode in countries_drops)) countries_drops[countryCode] = {
        "drops": 0,
        "users": [],
        "proxyServers": [],
        "proxyUsers": {
            natives: [],
            foreigners: []
        }
    }
    countries_drops[countryCode].drops += 1

    // As we don't always know the real IP behind the proxy, it's important to save it as a 'user'.
    // Thus allowing for more statistics and control.
    if (!countries_drops[countryCode].users.includes(ip)) countries_drops[countryCode].users.push(ip)
    
    // Here we try to associate proxy usage with real IP and region.
    // This allows for the creation of statistics for smarter access control policies.
    if (ip_info_list[ip].proxy == true && !countries_drops[countryCode].proxyServers.includes(ip)) {
        countries_drops[countryCode].proxyServers.push(ip)

        // If we got real IP, we can save as a 'foreigner' in the current country and as a 'native' in their resident country.
        if (realIP){
            const realCountryCode = ip_info_list[realIP].countryCode
            if (!(realCountryCode in countries_drops)) countries_drops[realCountryCode] = {
                "drops": 0,
                "users": [],
                "proxyServers": [],
                "proxyUsers": {
                    natives: [],
                    foreigners: []
                },
            }
            if (countryCode == realCountryCode){ // the user is native from the same country proxy
                if (!countries_drops[countryCode].proxyUsers.natives.includes(realIP)) countries_drops[countryCode].proxyUsers.natives.push(realIP)
            } else { // the proxy user is from another country (foreign)
                if (!countries_drops[countryCode].proxyUsers.foreigners.includes(realIP)) countries_drops[countryCode].proxyUsers.foreigners.push(realIP)
                if (!countries_drops[realCountryCode].proxyUsers.natives.includes(realIP)) countries_drops[realCountryCode].proxyUsers.natives.push(realIP)
            }
        }
    } 
    updateFile(filesPath.analytics.countriesDropsList, countries_drops)
}

function dropsCount(data){
    let result = {}
    if ("total" in data){
        if (data.total == "sent") {
            result.sent = totalDrops.sent
        } else if (data.total == "received") {
            result.received = totalDrops.received
        }
    }
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
    walletInfo,
    walletHistory,
    ip_list,
    updateIPList,
    updateNanoAccountsList,
    updateEmailsList,
    updateWalletHistory,
    updateWalletInfo,
    dropsCount,
    updateIPInfoList,
    ipInfo,
    updateProxiesUsage,
    countries_drops,
    updateCountriesDrops
}
