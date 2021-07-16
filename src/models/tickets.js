const wallet = require("./nano-wallet/wallet")
const { parseNanoAddress, signBlock, rawsToHex, blakeChecksum } = require("./nano-wallet/nano-keys")
const { isHex } = require("./nano-wallet/check")

function ip2int(ip) {
    return ip.split('.').reduce(function (ipInt, octet) { return (ipInt << 8) + parseInt(octet, 10) }, 0) >>> 0;
}

//Creates a signed ticket to guarantee the validity of the user's request.
function createTicket(amount, ip, account = "unknown") {

    // If the account is present, use its checksum.
    let accountChecksum = "0000000000"
    if (account != "unknown") {
        const parse = parseNanoAddress(account)
        accountChecksum = parse.checksum
    }

    // Build the ticket
    const expires = parseInt(Date.now() / 1000 + 60 * 5) // now + 5 minutes
    const expiresHex = expires.toString(16).padStart(8, '0')
    const amountHex = rawsToHex(amount)
    const ipHex = ip2int(ip).toString(16)
    const ticket = amountHex + accountChecksum + expiresHex + ipHex

    // Sign the ticket
    const ticketSigned = signBlock(ticket.padEnd(64, '0'), wallet.myWallet.privateKey)
    const ticketSignedChecksum = blakeChecksum(ticketSigned)

    // Formated ticket
    let formatedTicket = amountHex.replace(/^0+/, '') + '-' + expiresHex + '-' + ticketSignedChecksum
    if (formatedTicket.startsWith('-')) formatedTicket = '0' + formatedTicket // when amount == 0

    console.log("Created ticket: " + formatedTicket.toUpperCase())

    return formatedTicket.toUpperCase()
}

//Checks the signed ticket
function checkTicket(ticket, account, ip, auth = false) {

    ticket = ticket.toUpperCase()

    console.log("Checking ticket: " + ticket)

    // Check ticket format
    const ticket_data = ticket.split('-')
    if (ticket_data.length != 3) return "Ticket Invalid Format"
    if (!isHex(ticket_data[0] + ticket_data[1] + ticket_data[2])) return "Ticket Invalid Format"
    if (ticket_data[1].toString(10) > parseInt(Date.now() / 1000 + 60 * 5)) return "Ticket Expired"

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
    const ticket_sign = ticket_data[2]
    const ticket_rec = (amountHex + accountChecksum + expiresHex + ipHex).toUpperCase()

    // Check if the signature is valid
    const ticketSigned = signBlock(ticket_rec.padEnd(64, '0'), wallet.myWallet.privateKey)
    const ticketSignedChecksum = blakeChecksum(ticketSigned)
    if (ticketSignedChecksum != ticket_sign) return "Invalid Ticket Signature"

    return "valid"
}

module.exports = { createTicket, checkTicket }