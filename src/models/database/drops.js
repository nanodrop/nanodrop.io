const Sequelize = require('sequelize');

const database = require('./db')
const TABLE_DROPS_NAME = 'drops'
const SYNC = true
const FORCE_SYNC = false

class Drops {

    constructor() {
        this.drops = database.define(TABLE_DROPS_NAME, {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                allowNull: false,
                primaryKey: true
            },
            hash: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            height: {
                type: Sequelize.INTEGER,
                unique: true
            },
            account: {
                type: Sequelize.STRING
            },
            amount: {
                type: Sequelize.STRING
            },
            ip: {
                type: Sequelize.STRING
            },
            timestamp: {
                type: Sequelize.BIGINT
            },
            email: {
                type: Sequelize.STRING
            },
            proxy_ip: {
                type: Sequelize.STRING(15)
            },
            is_proxy: {
                type: Sequelize.BOOLEAN
            },
            country: {
                type: Sequelize.STRING(2)
            },
        },
            {
                freezeTableName: true,
                timestamps: true
            }
        )

        if (SYNC) this.sync()
    }

    synced = false

    sync = () => new Promise((resolve, reject) => {
        if (this.synced) resolve(this.synced)
        database.sync({ force: FORCE_SYNC })
            .then((res) => {
                this.synced = true
                resolve(res)
            })
            .catch((err) => {
                this.synced = false
                reject(err)
            })
    })

    create = (data) => new Promise((resolve, reject) => {
        this.drops.create(data)
            .then((res) => resolve(res.dataValues))
            .catch((err) => {
                if (typeof err === "object") {
                    if ("errors" in err) {
                        reject(err.errors[0].message)
                    } else {
                        console.error(err)
                        reject("Database error")
                    }
                }
            })
    })

    update = (data, where) => new Promise((resolve, reject) => {
        this.drops.update(data, { where })
            .then((res) => {
                if (res[0] == 0) return reject("nothing changed")
                resolve(res[0])
            })
            .catch((err) => {
                if (typeof err === "object") {
                    if ("errors" in err) {
                        reject(err.errors[0].message)
                    } else {
                        console.error(err)
                        reject("Database error")
                    }
                }
            })
    })

    findAndCountAll = (data) => this.drops.findAndCountAll({ where: data })

    findOne = (data) => new Promise((resolve, reject) => {
        this.drops.findOne({ where: data })
            .then((entry) => entry ? resolve(entry.dataValues) : resolve('not found'))
            .catch(reject)
    })
}

module.exports = Drops