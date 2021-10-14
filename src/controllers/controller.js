require('dotenv/config')
const api = require('../models/api')
const rpc = require("../models/nano-wallet/rpc.js")
const { lastWeek } = require("../models/analytics.js")
const { createQRCode } = require('../models/qr_code');
const { toMegaNano } = require("../models/nano-wallet/convert")
const { checkNanoAddress } = require("../models/nano-wallet/check")
const { dropsCount, walletHistory, countries_drops } = require("../models/data")
const whitelist = require("../../config/whitelist.json")
const CONFIG = require("../../config/config.json")
const { parseURL } = require("../models/utils")
const { deriveWallet } = require('../models/nano-wallet/wallet.js')

const FAUCET_ACCOUNT = deriveWallet().account

const donateQR = createQRCode(FAUCET_ACCOUNT)

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID
const RECAPTCHA_V2_SITE_KEY = process.env.RECAPTCHA_V2_SITE_KEY
const RECAPTCHA_V3_SITE_KEY = process.env.RECAPTCHA_V3_SITE_KEY
const GTAG_ANALYTICS = process.env.GTAG_ANALYTICS

exports.index = (req, res) => {

  let config = {
    theme: 'light default-theme',
  }
  session = req.session;

  // Define theme
  if (req.query.theme != undefined) {
    if (req.query.theme.toLowerCase() == "light" || req.query.theme.toLowerCase() == "dark") {
      config.theme = req.query.theme.toLowerCase()
      session.theme = config.theme
      if (req.query.onlySet != undefined) {
        res.status(200).json({success: true})
        return
      }
    } else {
      res.status(400).json({
        error: "invalid theme"
      });
      return
    }
  } else if (session.theme != undefined) {
    if (session.theme.toLowerCase() == "light" || session.theme.toLowerCase() == "dark") {
      config.theme = session.theme.toLowerCase()
      session.theme = session.theme // Update cookie
    }
  }

  res.render('index', {
    config: {
      rootUrl: CONFIG.url,
      urlWS: CONFIG.urlWS,
      blockExplorer: CONFIG.blockExplorer[CONFIG.blockExplorer.length - 1] == '/' ? CONFIG.blockExplorer : CONFIG.blockExplorer + '/',
      contact: CONFIG.contact,
      faucet: {
        account: FAUCET_ACCOUNT
      }
    },
    google_gtag_analytics: GTAG_ANALYTICS,
    google_reCaptcha: {
      v2: {
        siteKey: RECAPTCHA_V2_SITE_KEY
      },
      v3: {
        siteKey: RECAPTCHA_V3_SITE_KEY
      }
    },
    theme: config.theme
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

  const ip = req.headers['x-forwarded-for']

  if (json.action == "create") {
    const amount = api.dropAmount()
    api.createTicket(amount, ip, account)
      .then((ticket) => {
        res.status(200).json({
          ticket: ticket,
          amount: amount,
          megaAmount: toMegaNano(amount)
        })
      })
      .catch((err) => {
        res.status(400).json({
          error: err
        });
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

  json.ip = req.headers['x-forwarded-for']

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
    if (dropsHistory.account >= CONFIG.limits.account) return res.status(400).json({ success: false, error: "limit reached for this account, sorry" })
    if (dropsHistory.ip >= CONFIG.limits.ip) return res.status(400).json({ success: false, error: "limit reached for this ip, sorry" })
    if (dropsHistory.email >= CONFIG.limits.email) return res.status(400).json({ success: false, error: "limit reached for this email, sorry" })
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
    rootUrl: parseURL(CONFIG.url),
    theme: "light",
    contact: CONFIG.contact,
    blockExplorer: CONFIG.blockExplorer
  }
  if (req.query.theme != undefined) {
    if (req.query.theme.toLowerCase() == "light" || req.query.theme.toLowerCase() == "dark") {
      config.theme = req.query.theme.toLowerCase()
    }
  }
  res.render('embedded/checkbox', {
    config: config,
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
    rootUrl: parseURL(CONFIG.url),
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
  if (req.query.theme != undefined) {
    if (req.query.theme.toLowerCase() == "light" || req.query.theme.toLowerCase() == "dark") {
      config.theme = req.query.theme.toLowerCase()
    } else {
      res.status(400).json({
        error: "invalid theme"
      })
    }
  }
  if (req.query.onload != undefined) {
    config.onloadCallback = req.query.onload
  }
  if (req.query.onsuccess != undefined) {
    config.onsuccessCallback = req.query.onsuccess
  }
  if (req.query.onerror != undefined) {
    config.onerrorCallback = req.query.onerror
  }
  if (req.query.render != undefined) {
    config.onloadCallback = req.query.onload
    if (req.query.render.toLowerCase() == "default" || req.query.render.toLowerCase() == "explicit") {
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

  // Set available configs query
  if (req.query.period != undefined) {
    if (req.query.period.toLowerCase() == "all") {
      res.status(200).json(walletHistory)
    }
  } else if (req.query.drops != undefined) {
    if (req.query.drops.toLowerCase() == "bycountry") {
      let dropsByCountry = {}

      // Get only the size of the IP list, ensuring user privacy
      for (let countryCode in countries_drops) {
        dropsByCountry[countryCode] = {
          "drops": countries_drops[countryCode].drops,
          "users": countries_drops[countryCode].users.length,
          "proxyServers": countries_drops[countryCode].proxyServers.length,
          "proxyUsers": {
              natives: countries_drops[countryCode].proxyUsers.natives.length,
              foreigners: countries_drops[countryCode].proxyUsers.foreigners.length
          }
        }
      }
      res.status(200).json(dropsByCountry)
    } else if (req.query.drops.toLowerCase() == "weekly") {
      res.status(200).json(lastWeek())
    } else {
      res.status(400).json({
        error: "invalid query"
      })
    }
  } else {
    res.status(400).json({
      error: "invalid period"
    })
  }
}

exports.node = function (req, res) {
  rpc.telemetry(FAUCET_ACCOUNT)
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