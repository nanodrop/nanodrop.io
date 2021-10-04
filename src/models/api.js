const { TunedBigNumber, toRaws } = require('./nano-wallet/convert')

const { reCaptchaV2, reCaptchaV3 } = require('./google/recaptcha');
const { oAuthVerify } = require('./google/oauth')

const rpc = require('./nano-wallet/rpc')

const wallet = require("./nano-wallet/wallet")
const data = require("./data.js")

const { hexToRaws } = require("./nano-wallet/nano-keys")

const { createTicket, checkTicket } = require("./tickets")

const CONFIG = require('../../config/config.json')

const MIN_AMOUNT = toRaws(CONFIG.minAmount)
const MAX_AMOUNT = toRaws(CONFIG.maxAmount)
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
    let data_info = {...wallet.info}
    data_info.drops = data.dropsCount({total: "sent"}).sent
    data_info.amount = dropAmount(data_info.balance)
    if (data_info.total_received == '0' || data_info.total_sent == '0') {
        data_info.total_sent_percentage = 0
    } else {
        data_info.total_sent_percentage = TunedBigNumber(100).dividedBy(TunedBigNumber(data_info.total_received).dividedBy(data_info.total_sent)).toFixed(2).toString(10)
    }
    console.log(data_info)
    return data_info
}

function drop(req, callback) {

    //function to send the amount to the user after all data has been validated
    function sendSomeNano(account, amount) {
        wallet.send(account, amount)
            .then((res) => {
                console.info("Sent! Block: " + res.hash)

                // When using some proxies, we have this format: "[PROXY_IP], [USER_IP]"
                const parseIp = req.ip.split(", ")
                parseIp.forEach((ip) => data.updateIPList(req.ip))

                const ip1 = parseIp[0]
                if (parseIp.length > 1) {
                    const realIP = parseIp[parseIp.length - 1]
                    data.updateProxiesUsage(parseIp[0], realIP)
                    data.updateCountriesDrops(ip1, realIP)
                } else {
                    data.updateCountriesDrops(ip1)
                }

                data.updateNanoAccountsList(req.account)
                if ("oauth_token" in req) data.updateEmailsList(req.email)

                callback(200, { success: true, hash: res.hash, amount: res.amount })
            }).catch((err) => {
                console.error(err)
                callback(400, { success: false, error: err })
            })
    }

    const amountHex = req.ticket.split('-')[0].padStart(32, '0')
    const amount = hexToRaws(amountHex)

    // oauth_token is used when the recaptcha v3 score is low.
    // So it's always a second request and contains:
    // the ticket with signed account, amount and expiration to be validated
    if ("oauth_token" in req) {
        const check = checkTicket(req.ticket, req.account, req.ip, true)
        if (check != "valid") return callback(400, { success: false, error: check })
        oAuthVerify(req.oauth_token, req.email)
            .then((res) => {
                sendSomeNano(req.account, amount)
            })
            .catch((err) => {
                return callback(400, { success: false, error: err })
            });

    } else {

        // The first request checks if the ticket contains a valid amount and expiration,
        // checks if the recaptcha v2 has been resolved
        // and if the recaptcha v3 gave a good score to the user

        if (!("recaptchaV2_token" in req)) return callback(400, { error: "recaptchaV2_token missing" })
        if (!("recaptchaV3_token" in req)) return callback(400, { error: "recaptchaV3_token missing" })

        const check = checkTicket(req.ticket, req.account, req.ip, false)
        if (check != "valid") return callback(400, { success: false, error: check })

        reCaptchaV2(req.recaptchaV2_token).then(res => {
            reCaptchaV3(req.recaptchaV3_token)
                .then(res => {

                    // Anti-proxy extra barrier
                    const parseIp = req.ip.split(", ")
                    const ip_info = data.ipInfo(parseIp[0])
                    const isProxy = parseIp.length > 1 || ip_info.proxy == true || (ip_info.api == "ip-api.com" && ip_info.proxy == "unknown")

                    if (isProxy) {
                        return callback(400, { success: false, error: "proxy detected", ticket: ticket })
                    } else {
                        sendSomeNano(req.account, amount)
                    }

                }).catch(err => {
                    if (err.includes("low score")) {
                        const amount = hexToRaws(req.ticket.split('-')[0].padStart(32, '0'))
                        const ticket = createTicket(amount, req.ip, req.account)
                        return callback(400, { success: false, error: err, ticket: ticket })
                    } else {
                        return callback(400, { success: false, error: err })
                    }
                })
        }).catch(err => {
            return callback(400, { success: false, error: err })
        })
    }
}

module.exports = { createTicket, info, drop, dropAmount }