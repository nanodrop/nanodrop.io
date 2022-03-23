const { checkNanoAddress } = require("../models/nano-wallet/check")
const ipFromReq = require('./utils/ipFromReq');
const api = require('../models/api')
const DropsTable = require('../models/database/drops')

const Drops = new DropsTable()
const whitelist = require("../../config/whitelist.json")

async function usageCounter(data, period) {
    const { count } = await Drops.findAndCountAll({
        ...data,
        timestamp: {
            [Op.gt]: Date.now() - period
        }
    })
    return count
}

const drop = async function (req, res) {
    let json = {}
    try {
        json = JSON.parse(req.body)
    } catch (e) {
        res.status(400).json({
            error: "Unable to parse JSON"
        });
        return
    }

    json.ip = ipFromReq(req)

    // Checks if the inputs are present and are valid
    if (!("account" in json)) return res.status(400).json({ success: false, error: "account missing" })
    if (!checkNanoAddress(json.account)) return res.status(400).json({ success: false, error: "nano account invalid" })
    if (!("ticket" in json)) return res.status(400).json({ success: false, error: "ticket missing" })


    // Limit account usage
    if (!whitelist.accounts.includes(json.account)) { // Exclude values present in whitelist
        const accountUsage = await usageCounter({ account: json.account }, CONFIG.limits.account.period)
        if (accountUsage >= CONFIG.limits.account.times) {
            return res.status(400).json({ success: false, error: "limit reached for this account, sorry" })
        }
    }

    // Limit ip usage
    if (!whitelist.ip.includes(json.ip)) {
        const ipUsage = await usageCounter({ ip: json.ip }, CONFIG.limits.ip.period)
        if (ipUsage >= CONFIG.limits.ip.times) {
            return res.status(400).json({ success: false, error: "limit reached for this IP, sorry" })
        }
    }

    // Limit email usage
    if ("oauth_token" in json) {
        if (!("email" in json)) return res.status(400).json({ success: false, error: "email missing" })
        if (!whitelist.emails.includes(json.email)) {
            const emailUsage = await usageCounter({ ip: json.email }, CONFIG.limits.email.period)
            if (emailUsage >= CONFIG.limits.email.times)
                return res.status(400).json({ success: false, error: "limit reached for this email, sorry" })
        }
    }

    // Everything is ok, sending...
    api.drop(json, function (code, response) {
        res.status(code).json(response)
    })
}

module.exports = drop