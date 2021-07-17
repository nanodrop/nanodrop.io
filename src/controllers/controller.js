require('dotenv/config')
const api = require('../models/api')
const rpc = require("../models/nano-wallet/rpc.js")
const { createQRCode } = require('../models/qr_code');
const { toMegaNano } = require("../models/nano-wallet/convert")
const { deriveKeyPair } = require("../models/nano-wallet/nano-keys")
const { checkNanoAddress } = require("../models/nano-wallet/check")
const { dropsCount } = require("../models/data")
const whitelist = require("../../config/whitelist.json")

const myAccount = deriveKeyPair(process.env.SEED, parseInt(process.env.INDEX)).address
const donateQR = createQRCode(myAccount)

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID
const RECAPTCHA_V2_SITE_KEY = process.env.RECAPTCHA_V2_SITE_KEY
const RECAPTCHA_V3_SITE_KEY = process.env.RECAPTCHA_V3_SITE_KEY

exports.index = (req, res) => {
  res.render('index', {
    faucet: {
      account: myAccount
    },
    google_reCaptcha: {
      v2: {
        siteKey: RECAPTCHA_V2_SITE_KEY
      },
      v3: {
        siteKey: RECAPTCHA_V3_SITE_KEY
      }
    }
  })
}

exports.faucet = (req, res) => {
  res.render('embedded/faucet', {
    google_reCaptcha: {
      v2: {
        siteKey: RECAPTCHA_V2_SITE_KEY
      },
      v3: {
        siteKey: RECAPTCHA_V3_SITE_KEY
      }
    },
    options: {
      progressBar: false
    }
  })
}

exports.ticket = function (req, res) {
  let json = {}
  try {
    json = JSON.parse(req.body)
  } catch (e) {
    res.status(400).json({
      error: "Unable to parse JSON"
    });
    return
  }

  if (!("action" in json)) res.status(400).json({
    error: "action not found"
  })

  let account = 'unknown'
  if ("account" in json) {
    //validate account
    account = json.account
  }

  const ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);

  if (json.action == "create") {
    const amount = api.dropAmount()
    const ticket = api.createTicket(amount, ip, account)
    res.status(200).json({
      ticket: ticket,
      amount: amount,
      megaAmount: toMegaNano(amount)
    })
  }

}

exports.drop = function (req, res) {
  let json = {}
  try {
    json = JSON.parse(req.body)
  } catch (e) {
    res.status(400).json({
      error: "Unable to parse JSON"
    });
    return
  }

  json.ip = req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null);

  // Checks if the inputs are present and are valid
  if (!("account" in json)) return res.status(400).json({ success: false, error: "account missing" })
  if (!checkNanoAddress(json.account)) return res.status(400).json({ success: false, error: "nano account invalid" })
  if (!("ticket" in json)) return res.status(400).json({ success: false, error: "ticket missing" })


  // Apply Drops Limits
  let dropData = {}

  // Exclude values present in whitelist
  if (!whitelist.accounts.includes(json.account)) dropData.account = json.account
  if (!whitelist.ip.includes(json.ip)) dropData.ip = json.ip
  if ("oauth_token" in json) {
    if (!("email" in json)) return res.status(400).json({ success: false, error: "email missing" })
    if (!whitelist.emails.includes(json.email)) dropData.email = json.email
  }

  if (Object.keys(dropData)) {
    const dropsHistory = dropsCount(dropData)
    if (dropsHistory.account >= 1) return res.status(400).json({ success: false, error: "limit reached for this account, sorry" })
    if (dropsHistory.ip >= 7) return res.status(400).json({ success: false, error: "limit reached for this ip, sorry" })
    if (dropsHistory.email >= 3) return res.status(400).json({ success: false, error: "limit reached for this email, sorry" })
  }

  api.drop(json, function (code, response) {
    res.status(code).json(response)
  })
}

exports.challenge = (req, res) => {
  res.render('embedded/challenge', {
    google_reCaptcha: {
      v2: {
        siteKey: RECAPTCHA_V2_SITE_KEY
      },
      v3: {
        siteKey: RECAPTCHA_V3_SITE_KEY
      }
    }
  })
}

exports.checkbox = (req, res) => {
  // Set default config
  let config = {
    theme: "light"
  }
  if (req.query.theme != undefined){
    if (req.query.theme.toLowerCase() == "light" || req.query.theme.toLowerCase() == "dark"){
      config.theme = req.query.theme.toLowerCase()
    }
  }
  res.render('embedded/checkbox', {
    config: config
  })
}

exports.oauth = (req, res) => {
  res.render('embedded/oauth', {
    oauth: {
      clientId: OAUTH_CLIENT_ID
    }
  })
}

exports.apiJS = (req, res) => {

  // Set default config
  let config = {
    defaultElRenderName: "nanodrop-checkbox",
    theme: "light",
    render: "default",
    width: "300px",
    height: "85px",
    onloadCallback: null,
    onsuccessCallback: null,
    onerrorCallback: null
  }

  // Set available configs query
  if (req.query.theme != undefined){
    if (req.query.theme.toLowerCase() == "light" || req.query.theme.toLowerCase() == "dark"){
      config.theme = req.query.theme.toLowerCase()
    } else {
      res.status(400).json({
        error: "invalid theme"
      })
    }
  }
  if (req.query.onload != undefined){
    config.onloadCallback = req.query.onload
  }
  if (req.query.onsuccess != undefined){
    config.onsuccessCallback = req.query.onsuccess
  }
  if (req.query.onerror != undefined){
    config.onerrorCallback = req.query.onerror
  }
  if (req.query.render != undefined){
    config.onloadCallback = req.query.onload
    if (req.query.render.toLowerCase() == "default" || req.query.render.toLowerCase() == "explicit"){
      config.render = req.query.render.toLowerCase()
    } else {
      res.status(400).json({
        error: "invalid render"
      })
    }
  }

  // Set javascript header
  res.set({
    'content-type': 'text/javascript; charset=utf-8'
  })

  res.render('embedded/api', {
    config: config
  })
}

exports.info = function (req, res) {
  res.status(200).json(api.info())
}

exports.history = function (req, res) {
  rpc.account_history(myAccount)
    .then((response) => {
      res.status(200).json(response)
    }).catch((err) => {
      res.status(503).json(err)
    })
}

exports.node = function (req, res) {
  rpc.telemetry(myAccount)
    .then((response) => {
      res.status(200).json(response)
    }).catch((err) => {
      res.status(503).json(err)
    })
}

exports.qrcode = function (req, res) {
  res.set({
    'content-type': 'image/svg+xml; charset=utf-8',
    'content-length': donateQR.lenght
  })
  res.status(200).send(donateQR)
}

exports.privacy = (req, res) => {
  res.render('static/privacyPolicy')
};

exports.legal = (req, res) => {
  res.render('static/termsOfUse')
};

exports.notAllowed = (req, res) => {
  res.status(400).json({
    error: "Can only POST requests"
  })
}