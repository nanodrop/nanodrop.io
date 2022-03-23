const Sequelize = require('sequelize')
require('dotenv/config')

const database = new Sequelize (process.env.DB_ACCESS_URL);

module.exports = database;