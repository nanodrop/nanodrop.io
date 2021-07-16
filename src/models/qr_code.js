const qr = require('qr-image');

exports.createQRCode = function (address){
     return qr.imageSync('nano:' + address, { type: 'svg' })
}