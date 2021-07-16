const BigNumber = require('bignumber.js')

const MIN_INDEX = 0
const MAX_INDEX = Math.pow(2, 32) - 1
const MAX_AMOUNT = new BigNumber('0xffffffffffffffffffffffffffffffff')

function isHex(str) {
  return /^[0-9A-F]+$/i.test(str)
}

function checkKey (key) {
  if (/^([0-9A-F]){64}$/i.test(key)) {
    return true
  } else {
    return false
  }
}

function checkNanoAddress (address){
  const { parseNanoAddress } = require('./nano-keys')
  const parseResult = parseNanoAddress(address)
  return parseResult.valid
}

function checkAmount (amount){
  if (isNaN(amount)) return false
  if (BigNumber(amount).isLessThan(MIN_AMOUNT) || BigNumber(amount).isGreaterThan(MAX_AMOUNT) ) return false
  return true
}

function checkIndex (index) {
  return Number.isInteger(index) && index >= MIN_INDEX && index <= MAX_INDEX
}

function checkBlob (blob){
  return (blob instanceof Blob)
}

function checkString (candidate) {
  return typeof candidate === 'string'
}

function compareArrays(array1, array2) {
  for (let i = 0; i < array1.length; i++) {
    if (array1[i] !== array2[i]) return false
  }
  return true
}


module.exports = {
    isHex,
    checkKey,
    checkString,
    checkNanoAddress,
    checkIndex,
    checkAmount,
    checkBlob,
    compareArrays
}
