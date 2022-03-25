const { TunedBigNumber, toRaws } = require('./nano-wallet/convert')

const { reCaptchaV2, reCaptchaV3 } = require('./google/recaptcha');
const { oAuthVerify } = require('./google/oauth')

const rpc = require('./nano-wallet/rpc')

const wallet = require("./nano-wallet/wallet")
const data = require("./cache.js")

const { hexToRaws } = require("./nano-wallet/nano-keys")

const { createTicket, checkTicket } = require("./tickets")

const CONFIG = require('../../config/config.json');
const DropsTable = require('./database/drops');
const ipFromReq = require('../controllers/utils/ipFromReq');
const { ipInfo } = require('./analytics');

const Drops = new DropsTable()

const MIN_AMOUNT = toRaws(CONFIG.min_amount)
const MAX_AMOUNT = toRaws(CONFIG.max_amount)
const DROP_PERCENTAGE = TunedBigNumber(CONFIG.percentage).dividedBy(100).toString(10)

//Returns a percentage of the balance, rounded down.
//Example: With a balance of 2.145 Nano and 0.01%, returns 0.0001 instead 0.0002145
//Or returns the maximum configured amount
function dropAmount(balance = wallet.info.balance) {
    if (!TunedBigNumber(balance).isGreaterThanOrEqualTo(MIN_AMOUNT)) return "0"
    let amount = TunedBigNumber(balance).multipliedBy(DROP_PERCENTAGE).toString(10)
    let amountFixed = TunedBigNumber(amount).minus(amount.substr(1, amount.length)).toString(10).replace(/[2-9]/g, 1)
    return TunedBigNumber(amountFixed).isGreaterThan(MAX_AMOUNT) ? MAX_AMOUNT : amountFixed
}

function info() {
    let data_info = { ...wallet.info }
    data_info.drops = 100000 //data.dropsCount({ total: "sent" }).sent
    data_info.amount = dropAmount(data_info.balance)
    if (data_info.total_received == '0' || data_info.total_sent == '0') {
        data_info.total_sent_percentage = 0
    } else {
        data_info.total_sent_percentage = TunedBigNumber(100).dividedBy(TunedBigNumber(data_info.total_received).dividedBy(data_info.total_sent)).toFixed(2).toString(10)
    }
    return data_info
}

function drop(reqData, callback) {

    // Save Drop Info
    function logDrop(account, amount, hash) {
        const dropData = {
            account,
            amount,
            hash,
            timestamp: Date.now()
        }

        // When using some proxies, we have this format: "[PROXY_IP], [USER_IP]"
        const parseIp = reqData.ip.split(", ")
        const realIP = parseIp[parseIp.length - 1]
        const firstIP = parseIp[0] // may be a proxy

        // Store the user IP, 
        dropData.ip = realIP

        // Check Proxy
        const usingProxy = parseIp.length > 1 || (CONFIG.enable_analytics && data.ipInfo(firstIP).proxy === true)
        dropData.is_proxy = CONFIG.enable_analytics && data.ipInfo(realIP).proxy === true

        // If using proxy, we need to store the proxy ip
        if (usingProxy) dropData.proxy_ip = firstIP
                
        // If using oAuth, we need to store the email
        if ("oauth_token" in reqData) dropData.proxy = reqData.email

        // If Analytics is enabled, store the IP country code
        if (CONFIG.enable_analytics) dropData.country = data.ipInfo(realIP).countryCode

        if (typeof dropData.country != 'string' || dropData.country.length != 2) dropData.country = "00"

        Drops.create(dropData)
            .catch(console.error)
    }

    //function to send the amount to the user after all data has been validated
    function sendNano(account, amount) {
        wallet.send(account, amount)
            .then((res) => {
                console.info("Sent! Block: " + res.hash)
                callback(200, { success: true, hash: res.hash, amount: res.amount })
                logDrop(account, amount, res.hash)
            })
            .catch((err) => {
                console.error(err)
                callback(400, { success: false, error: err })
            })
    }

    const amountHex = reqData.ticket.split('-')[0].padStart(32, '0')
    const amount = hexToRaws(amountHex)

    // oauth_token is used when the recaptcha v3 score is low.
    // So it's always a second request and contains:
    // the ticket with signed account, amount and expiration to be validated
    if ("oauth_token" in reqData) {
        const check = checkTicket(reqData.ticket, reqData.account, reqData.ip, true)
        if (check != "valid") return callback(400, { success: false, error: check })
        oAuthVerify(reqData.oauth_token, reqData.email)
            .then((res) => {
                sendNano(reqData.account, amount)
            })
            .catch((err) => {
                return callback(400, { success: false, error: err })
            });

    } else {
        // The first request checks if the ticket contains a valid amount and expiration,
        // checks if the recaptcha v2 has been resolved
        // and if the recaptcha v3 gave a good score to the user

        if (!("recaptchaV2_token" in reqData)) return callback(400, { error: "recaptchaV2_token missing" })
        if (!("recaptchaV3_token" in reqData)) return callback(400, { error: "recaptchaV3_token missing" })

        const check = checkTicket(reqData.ticket, reqData.account, reqData.ip, false)
        if (check != "valid") return callback(400, { success: false, error: check })

        reCaptchaV2(reqData.recaptchaV2_token).then(res => {
            reCaptchaV3(reqData.recaptchaV3_token)
                .then(res => {

                    // Anti-proxy extra barrier
                    const parseIp = reqData.ip.split(", ")
                    let isProxy = parseIp.length > 1

                    if (CONFIG.enable_analytics) {
                        const ip_info = data.ipInfo(parseIp[0])
                        isProxy = ip_info.proxy === true || (ip_info.api == "ip-api.com" && ip_info.proxy == "unknown")
                    }

                    if (isProxy) {
                        const amount = hexToRaws(reqData.ticket.split('-')[0].padStart(32, '0'))
                        createTicket(amount, reqData.ip, reqData.account)
                            .then((newTicket) => callback(400, { success: false, error: "proxy detected", ticket: newTicket }))
                            .catch((err) => callback(400, { success: false, error: err }))
                    } else {
                        sendNano(reqData.account, amount)
                    }
                }).catch(err => {
                    console.error(err)
                    if (typeof (err) === "string" && err.includes("low score")) {
                        const amount = hexToRaws(reqData.ticket.split('-')[0].padStart(32, '0'))
                        createTicket(amount, reqData.ip, reqData.account)
                            .then((newTicket) => callback(400, { success: false, error: err, ticket: newTicket }))
                            .catch((err) => callback(400, { success: false, error: err }))
                    } else {
                        callback(400, { success: false, error: err })
                    }
                })
        }).catch(err => {
            return callback(400, { success: false, error: err })
        })
    }
}

module.exports = { createTicket, info, drop, dropAmount }