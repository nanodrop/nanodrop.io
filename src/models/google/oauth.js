
require('dotenv/config')
const { OAuth2Client } = require('google-auth-library');

const OAUTH_CLIENT_ID = process.env.OAUTH_CLIENT_ID
const OAUTH_SECRET_KEY = process.env.OAUTH_SECRET_KEY

const client = new OAuth2Client(OAUTH_CLIENT_ID);

async function oAuthVerify(token, email) {
  return new Promise((resolve, reject) => {
    client.verifyIdToken({
      idToken: token,
      audience: OAUTH_CLIENT_ID,
    })
      .then((ticket) => {
        const payload = ticket.getPayload()
        const userid = payload['sub']
        if (email != payload.email) {
          console.info("oAuth email not match: " + email)
          return reject("email not match")
        }
        console.info("oAuth email match: " + email)
        resolve(userid)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

module.exports = { oAuthVerify }


