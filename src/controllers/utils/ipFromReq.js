function ipFromReq(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip
}

module.exports = ipFromReq