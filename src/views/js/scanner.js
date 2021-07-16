function showCameraSwitch() {
    document.getElementById("cameraSwitch").style.display = "block"
}

function showCameraError(err) {
    document.getElementById("cameraError").innerText = err
    document.getElementById("cameraError").style.display = "block"
}


function scanQR() {
    function onScanSuccess(decodedText, decodedResult) {
        // Handle on success condition with the decoded text or result.
        console.log(`Scan result: ${decodedText}`, decodedResult);
        let nanoAddress = hasNanoAddress(decodedText)
        if (nanoAddress) {
            $('#addNanoAddress').val(nanoAddress).trigger('input');  
            stopScan()
        } else {
            alert("Invalid Address! " + decodedText)
        }
    }

    function onScanError(errorMessage) {
        console.error(errorMessage)
    }

    function stopScan(){
        document.querySelector(".qr-modal").style.display = "none"
        if (scanner) {
            scanner.stop().then((ignore) => {
                // QR Code scanning is stopped.
            }).catch((err) => {
                // Stop failed, handle it.
                alert("stop failed")
            });
        }
    }

    document.querySelector(".qr-modal").style.display = "block"

    const scanner = new Html5Qrcode("qr-reader");
    const config = { fps: 6, qrbox: 250 }


    scanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanError)
        .catch((err) => {
            alert(err)
        })

    document.querySelector(".qr-modal .close").addEventListener("click", stopScan, false)

}

document.getElementById("qr_button").addEventListener("click", scanQR, false)
