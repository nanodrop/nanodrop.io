const TunedBigNumber = BigNumber.clone({
    EXPONENTIAL_AT: 1e9,
    DECIMAL_PLACES: 36,
})

function getJson(url) {
    return new Promise((resolve, reject) => {
        fetch(url, {
            method: 'GET',
        }).then(function (response) {
            var contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json().then(function (json) {
                    // process your JSON further
                    resolve(json)
                });
            } else {
                reject({ error: "We haven't got JSON!" });
            }
        }).catch((err) => {
            reject({ error: err });
        });
    })
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatError(err) {
    console.error(err)
    if (typeof (err) == "object") return JSON.stringify(err)
    if (typeof (err) == "string") return err.toString()
    return "Unknown Error"

}

function hasNanoAddress(content = "") {

    function isNanoAddress(address) {
        return /^(xrb_|nano_)[13][13-9a-km-uw-z]{59}$/.test(address)
    }

    if (!content || typeof content !== 'string') return false;

    if (content.startsWith("nano:")) {
        if (content.length >= 70) {
            const address = content.substring(5, 70)
            if (isNanoAddress(address)) return address
        }
    } else if (content.startsWith("nano_")) {
        const address = content.substring(0, 70)
        if (isNanoAddress(address)) return address
    }

    return false
}

const megaNano = "1000000000000000000000000000000" //raws

const toRaws = function (meganano) {
    return TunedBigNumber(megaNano).multipliedBy(meganano).toString(10)
}

const toMegaNano = function (raws) {
    return TunedBigNumber(raws).dividedBy(megaNano).toString(10)
}

function friendlyAmount(amount, decimals = 8, padWhenZero = false){
    const formated = TunedBigNumber(toMegaNano(amount)).decimalPlaces(decimals).toString(10)
    return padWhenZero && formated == '0' && amount > 0 ? `${formated}.${''.padEnd(decimals, 0)}` : formated
}

function timeDifference(current, previous) {

    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current - previous;

    if (elapsed < msPerMinute) {
         return Math.round(elapsed/1000) + ' seconds ago';   
    } else if (elapsed < msPerHour) {
         return Math.round(elapsed/msPerMinute) + ' minutes ago';   
    } else if (elapsed < msPerDay ) {
         return Math.round(elapsed/msPerHour ) + ' hours ago';   
    } else if (elapsed < msPerMonth) {
        return '~ ' + Math.round(elapsed/msPerDay) + ' days ago';   
    } else if (elapsed < msPerYear) {
        return '~ ' + Math.round(elapsed/msPerMonth) + ' months ago';   
    } else {
        return '~ ' + Math.round(elapsed/msPerYear ) + ' years ago';   
    }
}