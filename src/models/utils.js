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

// Creates a new object that inherits the Error constructor through the prototype.
function CustomError(name, message) {
    this.name = name || 'Error';
    this.message = message || "Check log!";
  }
  CustomError.prototype = Object.create(CustomError.prototype);
  CustomError.prototype.constructor = CustomError;

exports.CustomError = CustomError