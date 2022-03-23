require('dotenv/config')
const api = require('../models/api')
const rpc = require("../models/nano-wallet/rpc.js")
const { lastWeek, dropsByCountry } = require("../models/analytics.js")
const { createQRCode } = require('../models/qr_code');
const { toMegaNano } = require("../models/nano-wallet/convert")
const { walletHistory } = require("../models/cache")
const CONFIG = require("../../config/config.json")
const WHITELIST = require("../../config/whitelist.json")
const { parseURL } = require("../models/utils")
const { deriveWallet } = require('../models/nano-wallet/wallet.js');
const ipFromReq = require('./utils/ipFromReq');

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
        res.status(200).json({ success: true })
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
      url_websocket: CONFIG.url_websocket,
      block_explorer: CONFIG.block_explorer[CONFIG.block_explorer.length - 1] == '/' ? CONFIG.block_explorer : CONFIG.block_explorer + '/',
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

exports.countries = (req, res) => {
  res.render('embedded/countries', {
    theme: 'light',
    google_gtag_analytics: GTAG_ANALYTICS
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

  const ip = ipFromReq(req)

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
    authorizedDomain: true,
    theme: "light",
    contact: CONFIG.contact,
    block_explorer: CONFIG.block_explorer
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
  if (req.query.last != undefined) {
    if (!isNaN(req.query.last)) {
      const last = Number(req.query.last)
      if (last == 1000) {
        res.status(200).json(walletHistory())
      } else {
        rpc.account_history(myWallet.account, {
          raw: true,
          count: 1000,
          offset: last,
          reverse: true
        })
          .then((history) => res.status(200).json(history))
          .catch((error) => res.status(400).json({ error }))
      }
    } else {

    }
  } else if (req.query.drops != undefined) {
    if (req.query.drops.toLowerCase() == "bycountry") {
      dropsByCountry()
        .then((data) => res.status(200).json(data))
        .catch((error) => res.status(200).json({ error }))
    } else if (req.query.drops.toLowerCase() == "weekly") {
      lastWeek().then((data) => res.status(200).json(data))
    } else {
      res.status(400).json({
        error: "invalid query"
      })
    }
  } else {
    res.status(400).json({
      error: "invalid param"
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