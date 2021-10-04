exports.parseURL = (url) => {
    if (!url.includes("http")) url = "http://" + url
    let constructedUrl = new URL(url)
    if (typeof(constructedUrl) === "undefined") return "invalid"
    return constructedUrl.origin
}

exports.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

exports.timestamp = () => {
    return Date.now()
}