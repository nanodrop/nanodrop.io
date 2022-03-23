const { ip_list } = require("./cache")
const axios = require("axios")
const DropsTable = require('../models/database/drops');
const { Op } = require('sequelize');

const Drops = new DropsTable()

const lastWeek = () => new Promise(async (resolve, reject) => {

    const rangeTime = 1000 * 60 * 60 * 24 * 7 // 1 week in ms
    const drops = {}
    const weekday = new Array(7);
    weekday[0] = "Sun";
    weekday[1] = "Mon";
    weekday[2] = "Tue";
    weekday[3] = "Wed";
    weekday[4] = "Thu";
    weekday[5] = "Fri";
    weekday[6] = "Sat";

    let { count, rows } = await Drops.findAndCountAll({
        timestamp: {
            [Op.gt]: Date.now() - rangeTime
        }
    })

    for (let dropRow of rows) {
        let timestamp = Number(dropRow.dataValues.timestamp)
        let mDay = new Date(timestamp).getDate()
        let wDay = weekday[new Date(timestamp).getDay()]
        let key = `${wDay} ${mDay}`
        if (!(key in drops)) drops[key] = 0
        drops[key] += 1
    }

    resolve(drops)
})

const dropsByCountry = () => new Promise(async (resolve, reject) => {
    const countries = require("../../data/countries.json")
    const data = {}
    try {
        let { count, rows } = await Drops.findAndCountAll({ country: Object.keys(countries) })
        const countriesDrops = {}
        rows.forEach((row) => {
            const ip = row.dataValues.ip
            const is_proxy = row.dataValues.is_proxy
            const country_code = row.dataValues.country

            if (!(country_code in countriesDrops)) countriesDrops[country_code] = {
                drops: 0,
                ip_list: [],
                is_proxy: []
            }
            countriesDrops[country_code].drops++
            if (!countriesDrops[country_code].ip_list.includes(ip)) countriesDrops[country_code].ip_list.push(ip)
            if (is_proxy && !countriesDrops[country_code].is_proxy.includes(ip)) countriesDrops[country_code].is_proxy.push(ip)
        })
        Object.keys(countriesDrops).forEach((country_code) => {
            data[country_code] = {
                name: countries[country_code],
                drops: countriesDrops[country_code].drops,
                users: countriesDrops[country_code].ip_list.length,
                proxies: countriesDrops[country_code].is_proxy.length
            }
        })
        resolve(data)
    } catch (err) {
        console.log(err)
        reject(err)
    }
})

const ipInfo = (ip, fallback = false) => {
    return new Promise((resolve, reject) => {

        const invalid_ip = ['::1', '127.0.0.1']
        if (invalid_ip.includes(ip)) return resolve({
            api: 'invalid-ip',
            continent: 'unknown',
            continentCode: 'unknown',
            country: 'unknown',
            countryCode: 'unknown',
            region: 'unknown',
            regionCode: 'unknown',
            proxy: 'unknown'
        })

        // Default API
        let apiName = "ip-api.com"
        let endpoint = 'http://ip-api.com/json/'
        let path = ip + '?fields=status,message,continent,continentCode,country,countryCode,region,regionName,proxy'

        // Use alternative API when the first fails
        if (fallback) {
            apiName = "geoplugin.net"
            endpoint = 'http://www.geoplugin.net/json.gp'
            path = '?ip=' + ip
        }

        axios.get(endpoint + path)
            .then((res) => {

                if (res.headers["content-type"].indexOf("application/json") != -1) {
                    try {
                        const data = res.data
                        if (!fallback) {
                            resolve({
                                api: apiName,
                                continent: data.continent ? data.continent : 'unknown',
                                continentCode: data.continentCode ? data.continentCode : 'unknown',
                                country: data.country ? data.country : 'unknown',
                                countryCode: data.countryCode ? data.countryCode : 'unknown',
                                region: data.regionName ? data.regionName : 'unknown',
                                regionCode: data.region ? data.region : 'unknown',
                                proxy: (typeof (data.proxy) === 'boolean') ? data.proxy : 'unknown'
                            })
                        } else {
                            resolve({
                                api: apiName,
                                continent: data.geoplugin_continentName ? data.geoplugin_continentName : 'unknown',
                                continentCode: data.geoplugin_continentCode ? data.geoplugin_continentCode : 'unknown',
                                country: data.geoplugin_countryName ? data.geoplugin_countryName : 'unknown',
                                countryCode: data.geoplugin_countryCode ? data.geoplugin_countryCode : 'unknown',
                                region: data.geoplugin_region ? data.geoplugin_region : 'unknown',
                                regionCode: data.geoplugin_regionCode ? data.geoplugin_regionCode : 'unknown',
                                proxy: 'unknown' // fallback api (geoplugin) does not support proxy detection
                            })
                        }
                    } catch (err) {
                        if (!fallback) {
                            ipInfo(ip, true)
                                .then((res) => resolve(res))
                                .catch((res) => reject(res))
                        } else {
                            reject("IP API error")
                        }
                    }
                } else {
                    if (!fallback) {
                        ipInfo(ip, true)
                            .then((res) => resolve(res))
                            .catch((res) => reject(res))
                    } else {
                        reject("IP API JSON error")
                    }
                }

            }).catch((err) => {
                if (!fallback) {
                    ipInfo(ip, true)
                        .then((res) => resolve(res))
                        .catch((res) => reject(res))
                } else {
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
                }
            })
    })
}

module.exports = {
    lastWeek,
    dropsByCountry,
    ipInfo
}
