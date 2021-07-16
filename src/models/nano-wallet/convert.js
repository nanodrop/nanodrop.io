const BigNumber = require('bignumber.js')

const TunedBigNumber = BigNumber.clone({
    EXPONENTIAL_AT: 1e9,
    DECIMAL_PLACES: 36,
})

const megaNano = "1000000000000000000000000000000" //raws

const toRaws = function (meganano) {
    return TunedBigNumber(megaNano).multipliedBy(meganano).toString(10)
}

const toMegaNano = function (raws) {
    return TunedBigNumber(raws).dividedBy(megaNano).toString(10)
}

module.exports = {
    megaNano,
    TunedBigNumber,
    toRaws,
    toMegaNano
}