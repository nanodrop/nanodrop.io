const express = require('express')
const router = express.Router()
const controller = require('../controllers/controller')
const drop = require("../controllers/drop")

router.get('/', controller.index)

router.post('/', controller.notAllowed)

router.put('/', controller.notAllowed)

router.delete('/', controller.notAllowed)

router.get('/api/faucet', controller.faucet)

router.get('/api/countries', controller.countries)

router.post('/api/drop', drop)

router.post('/api/ticket', controller.ticket)

router.get('/api/api.js', controller.apiJS)

router.get('/api/checkbox', controller.checkbox)

router.get('/api/drop', controller.notAllowed)

router.get('/api/qrcode', controller.qrcode)

router.get('/api/info', controller.info)

router.get('/api/history', controller.history)

router.get('/api/node', controller.node)

router.get('/api/challenge', controller.challenge)

router.get('/api/oauth', controller.oauth)

router.get('/privacy', controller.privacy)

router.get('/legal', controller.legal)

module.exports = router
