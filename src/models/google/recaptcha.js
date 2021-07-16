const axios = require("axios")
require('dotenv/config')

const RECAPTCHA_V2_SECRET_KEY = process.env.RECAPTCHA_V2_SECRET_KEY
const RECAPTCHA_V3_SECRET_KEY = process.env.RECAPTCHA_V3_SECRET_KEY

function reCaptchaV2(recaptcha_token) {
    return new Promise((resolve, reject) => {

        const endpoint = 'https://www.google.com/recaptcha/api/siteverify'
        const path = '?secret=' + RECAPTCHA_V2_SECRET_KEY + '&response=' + recaptcha_token

        axios.get(endpoint + path)
            .then((res) => {

                if (res.headers["content-type"].indexOf("application/json") != -1) {

                    console.log("Recaptcha v2 success: " + res.data.success)

                    if (res.data.success === true) {
                        resolve("ok")
                    } else {
                        reject("Invalid recaptcha_token")
                    }

                } else {
                    reject("Google reCaptcha V2 API error")
                }

            }).catch((err) => {
                if (err.response) {
                    // Request made and server responded
                    reject(err.response.data);
                } else if (err.request) {
                    // The request was made but no response was received
                    reject("no response");
                } else {
                    // Something happened in setting up the request that triggered an Error
                    reject('Error', err.message);
                }
            })
    })
}

function reCaptchaV3(recaptcha_token) {
    return new Promise((resolve, reject) => {

        const endpoint = 'https://www.google.com/recaptcha/api/siteverify'
        const path = '?secret=' + RECAPTCHA_V3_SECRET_KEY + '&response=' + recaptcha_token

        axios.get(endpoint + path)
            .then((res) => {

                if (res.headers["content-type"].indexOf("application/json") != -1) {

                    console.log("Recaptcha v3 score: " + res.data.score)

                    if (res.data.success === true) {
                        if (Number(res.data.score) >= 0.5) {
                            resolve("good score: " + res.data.score)
                        } else {
                            reject("low score: " + res.data.score)
                        }
                    } else {
                        reject("invalid recaptcha_token")
                    }

                } else {
                    reject("google reCaptcha V3 API error")
                }

            }).catch((err) => {
                if (err.response) {
                    // Request made and server responded
                    reject(err.response.data);
                } else if (err.request) {
                    // The request was made but no response was received
                    reject("no response");
                } else {
                    // Something happened in setting up the request that triggered an Error
                    reject('Error', err.message);
                }
            })
    })
}

module.exports = { reCaptchaV2, reCaptchaV3 }
