require('dotenv/config');
const path = require('path');
const blake2b = require('blakejs').blake2b;

const BASE_DIFFICULTY = "fffffff800000000"
const BASE_DIFFICULTY_RECEIVE = "fffffffe00000000"

function getWorkThreshold(hash, nonce) {
    const input = new ArrayBuffer(8 + 32);
    const input8 = new Uint8Array(input);
    input8.set(hash, 8);
    const bytes64 = new BigUint64Array(input);
    bytes64[0] = BigInt(nonce);
    const out8 = blake2b(input8, null, 8);
    const out64 = new BigUint64Array(out8.buffer);
    return out64[0];
}

const LIVE_DIFFICULTY = BigInt("0xfffffff800000000");
const DIFFICULTY_LIMIT = BigInt(1) << BigInt(64);

function invert(difficulty) {
    if (difficulty === BigInt(0)) {
        return difficulty;
    }
    return DIFFICULTY_LIMIT - difficulty;
}

function thresholdToMultiplier(threshold, base_difficulty) {
    return Number(invert(base_difficulty)) / Number(invert(threshold));
}

function fromHex(s) {
    return new Uint8Array(s.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

function workValidate(hash, work, type = "all") {
    let base_difficulty = LIVE_DIFFICULTY //BigInt('0x' + BASE_DIFFICULTY)
    if (type == "receive") base_difficulty = LIVE_DIFFICULTY //BigInt('0x' + BASE_DIFFICULTY_RECEIVE)
    const threshold = getWorkThreshold(fromHex(hash), '0x' + work, base_difficulty);
    const multiplier = thresholdToMultiplier(threshold, base_difficulty);
    return { difficulty: threshold.toString(16), multiplier: multiplier }
}

let currentWork = {
    hash: "0000000000000000000000000000000000000000000000000000000000000000",
    work: "FFFFFFFFFFFFFFFF",
    type: "all"
}

function getWork(hash, type = "all"){
    if (hash == "0000000000000000000000000000000000000000000000000000000000000000"){
        const { deriveWallet } = require('./wallet')
        hash = deriveWallet().publicKey
    }
    return new Promise((resolve, reject) => {
        if (currentWork.hash == hash && (currentWork.type == "all" || currentWork.type == type)) {
            console.info("Work already exists. Using it!")
            return resolve(currentWork.work)
        }
        const { work_generate } = require("./rpc")
        let difficulty = BASE_DIFFICULTY
        if (type == "receive") difficulty = BASE_DIFFICULTY_RECEIVE
        work_generate(hash, difficulty)
            .then((res) => {
                try {
                    const validate = workValidate(hash, res.work)
                } catch (err) {
                    reject(err)
                }
                currentWork.hash = hash
                currentWork.work = res.work
                currentWork.difficulty = difficulty
                resolve(res.work)
            })
            .catch((err) => {
                reject(err)
            })
    })
}

module.exports = { 
    BASE_DIFFICULTY,
    BASE_DIFFICULTY_RECEIVE,
    workValidate,
    getWork
}