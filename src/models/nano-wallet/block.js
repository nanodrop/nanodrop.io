
const { blake2b, blake2bFinal, blake2bInit, blake2bUpdate } = require('blakejs')
const { parseNanoAddress, hexToByteArray, byteArrayToHex, signBlock, rawsToHex } = require("./nano-keys")

const STATE_BLOCK_PREAMBLE_BYTES = new Uint8Array(32)
STATE_BLOCK_PREAMBLE_BYTES[31] = 6

function hashBlock(params) {
    const accountBytes = parseNanoAddress(params.account).publicKeyBytes
    const previousBytes = hexToByteArray(params.previous)
    const representativeBytes = parseNanoAddress(params.representative).publicKeyBytes
    const balanceBytes = hexToByteArray(rawsToHex(params.balance)) //hexToByteArray(balanceHex)
    let linkBytes = Uint8Array
    if ("linkAsAccount" in params) {
        linkBytes = parseNanoAddress(params.linkAsAccount).publicKeyBytes
    } else {
        linkBytes = hexToByteArray(params.link)
    }

    const context = blake2bInit(32)
    blake2bUpdate(context, STATE_BLOCK_PREAMBLE_BYTES)
    blake2bUpdate(context, accountBytes)
    blake2bUpdate(context, previousBytes)
    blake2bUpdate(context, representativeBytes)
    blake2bUpdate(context, balanceBytes)
    blake2bUpdate(context, linkBytes)
    const hashBytes = blake2bFinal(context)

    return byteArrayToHex(hashBytes)
}

function createBlock (contents, secretKey){
    try {
      if (contents.previous == "") {
        contents.previous = "0000000000000000000000000000000000000000000000000000000000000000"
      }
      const balance = contents.balance.toString(10) //if bignumber, convert to string number
      if ("linkAsAccount" in contents){
        contents.link = parseNanoAddress(contents.linkAsAccount).publicKey
      }
      let block = {
        "type": "state",
        "account": contents.account,
        "representative": contents.representative,
        "previous": contents.previous,
        "balance": contents.balance,
        "link": contents.link,
        "signature": "",
        "work": "FFFFFFFFFFFFFFFF"
      }
      const hash = hashBlock(block)
      block.signature = signBlock(hash, secretKey)
      return {hash: hash, block: block}
    } catch (err) {
        console.error("Error creating block")
        throw new Error(err)
    }
}

module.exports = {
    createBlock,
    hashBlock
}