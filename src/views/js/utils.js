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

function toMegaNano(raws) {
    raws = raws.toString()
    let megaNano
    if (raws == "0") return "0"
    if ((raws.length - 30) > 0) {
        megaNano = raws.substr(0, raws.length - 30)
        fraction = raws.substr(raws.length - 30, raws.length - (raws.length - 30))
        if (fraction.length && parseInt(fraction) != 0) megaNano += '.' + fraction
    } else {
        megaNano = "0." + "0".repeat(30 - raws.length) + raws
    }
    while (megaNano[megaNano.length - 1] == '0') {
        megaNano = megaNano.substr(0, megaNano.length - 1)
    }
    return megaNano
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
