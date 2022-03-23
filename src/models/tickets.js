const wallet = require("./nano-wallet/wallet")
const { parseNanoAddress, signBlock, rawsToHex, blakeChecksum, verifySignature } = require("./nano-wallet/nano-keys")
const { enable_analytics } = require("../../config/config.json")
const { isHex } = require("./nano-wallet/check")
const { ipInfo } = require("./analytics")
const data = require("./cache")

const TICKET_EXPIRTATION = 60 * 5 // 5 minutes

function ip2int(ip) {
    return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
}

function now() {
    return Math.round(Date.now() / 1000)
}

//Creates a signed ticket to guarantee the validity of the user's request.
function createTicket(amount, ip, account = "unknown") {
    return new Promise((resolve, reject) => {

        try {
            function create() {
                // If the account is present, use its checksum.
                let accountChecksum = "0000000000"
                if (account != "unknown") {
                    const parse = parseNanoAddress(account)
                    accountChecksum = parse.checksum
                }

                // Build the ticket
                const expires = now() + TICKET_EXPIRTATION
                const expiresHex = expires.toString(16).padStart(16, '0')
                const amountHex = rawsToHex(amount)
                const ipHex = ip2int(ip).toString(16)
                const ticket = amountHex + accountChecksum + expiresHex + ipHex

                // Sign the ticket
                const ticketSigned = signBlock(ticket.padEnd(64, '0'), wallet.myWallet.privateKey)

                // Formated ticket
                let formatedTicket = amountHex.replace(/^0+/, '') + '-' + expiresHex + '-' + ticketSigned
                if (formatedTicket.startsWith('-')) formatedTicket = '0' + formatedTicket // when amount == 0

                return formatedTicket.toUpperCase()
            }

            const ticket = create()

            if (!enable_analytics) return resolve(ticket)

            // If Analytics is enabled, cache the IP info before return the ticket
            if (data.ipInfo(ip) !== undefined) {
                resolve(ticket)
            } else {
                ipInfo(ip)
                    .then((info) => {
                        data.updateIPInfoList(ip, info)
                        resolve(ticket)
                    })
                    .catch(reject)
            }

        } catch (err) {
            console.error(err)
        }
    })
}

//Checks the signed ticket
function checkTicket(ticket, account, ip, auth = false) {

    // Check ticket format
    const ticket_data = ticket.split('-')
    if (ticket_data.length != 3) return "Ticket Invalid Format"
    if (!isHex(ticket_data[0] + ticket_data[1] + ticket_data[2])) return "Ticket Invalid Format"

    // If using oauth is because score is slow and therefore the ticket must count the nano account checksum
    let accountChecksum = "0000000000"
    if (auth == true) {
        const parse = parseNanoAddress(account)
        accountChecksum = parse.checksum
    }

    // Rebuild the ticket
    const ipHex = ip2int(ip).toString(16)
    const amountHex = ticket_data[0].padStart(32, '0')
    const expiresHex = ticket_data[1]
    const ticketSignature = ticket_data[2]
    const ticketRec = amountHex + accountChecksum + expiresHex + ipHex

    // Check Expiration
    if (Number(expiresHex.toString(10)) > (now() + TICKET_EXPIRTATION)) return "Ticket Expired"

    // Check if the signature is valid
    if (!verifySignature(ticketRec.padEnd(64, '0'), ticketSignature, wallet.myWallet.publicKey)) return "Invalid Ticket Signature"

    return "valid"
}

module.exports = { createTicket, checkTicket }