try {

    function formatError(err) {
        console.error(err)
        if (typeof (err) == "object") return JSON.stringify(err)
        if (typeof (err) == "string") return err.toString()
        return "Unknown Error"

    }

    function loadPayTableList() {

        function addPayItem(amount, account, hash) {
            const blockCell = document.createElement("tr")
            blockCell.innerHTML = '\
                    <td class="amount">' + toMegaNano(amount) + '</td> \
                    <td class="account">' + account + '</td> \
                    <td class="block"><a href="https://nanocrawler.cc/explorer/block/' + hash + '" target="_blank">Explorer</a></td>'
            document.querySelector("#payTable tbody").prepend(blockCell)
        }

        function listen_websockets() {
            start_websockets(["nano_3m6o1ti4og5s1rwj174qpb1m58pops9eg3xt79c3io791srem74nd471j7ho"], function (res) {
                addPayItem(res.amount, res.account, res.hash)
            })
        }

        getJson("/api/history")
            .then((txs) => {
                for (let n in txs) {
                    tx = txs[(txs.length - 1) - n] //invert
                    addPayItem(tx.amount, tx.account, tx.hash)
                }

                listen_websockets()

            }).catch((err) => {
                console.error("/api/history Error: " + formatError(err.error))
            })
    }

    function loadSentPercentage() {

        getJson("/api/info")
            .then((info) => {
                $(".already_paid span").text(info.total_sent_percentage + "%")
                $(".progress").fadeIn()
                $(".progress-bar-striped").attr("aria-valuenow", info.total_sent_percentage)
                $(".progress-bar-striped").css("width", info.total_sent_percentage + "%")
            }).catch((err) => {
                console.error("/api/info Error: " + formatError(err.error))
            })
    }

    loadPayTableList()
    loadSentPercentage()


    $("#copyLink").click(function () {
        copyToClipboard("https://nanodrop.io")
        document.querySelector("input#inputLink").select()
        document.execCommand("copy")
        $(".message").text("link copied")
    })

    function awaitNanoDrop() {
        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        return new Promise (async function (resolve, reject) {
            for (let i = 0; i < 300; i++){
                if (typeof(nanodrop) == "object" && "rendered" in nanodrop && nanodrop.rendered === true) {
                    return resolve(rendered)
                }
                await sleep(200)
            }
            reject("timeout")
        })
    }

    $(document).ready(function () {

        function changeTheme(theme, isSwitch = false) {
            if (theme == 'dark') {
                darkMode = true
                if (!isSwitch) $("#themeSwitch").prop("checked", true)
                $("body").addClass("dark")
                awaitNanoDrop().then(() => nanodrop.changeTheme('dark'))
            } else if (theme == 'light') {
                darkMode = false
                if (!isSwitch) $("#themeSwitch").prop("checked", false)
                $("body").removeClass("dark")
                awaitNanoDrop().then(() => nanodrop.changeTheme('light'))
            }
        }

        let darkMode = false
        $("#themeSwitch-label").click(function () {
            if (darkMode) {
                changeTheme('light', true)
            } else {
                changeTheme('dark', true)
            }
        })

        // Detect Dark Theme
        const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)")
        if (darkThemeMq.matches) changeTheme('dark')
        darkThemeMq.addListener(e => {
            if (e.matches) {
                changeTheme('dark')
            } else {
                changeTheme('light')
            }
        })

        $('#addNanoAddress').on('input', function () {
            const val = $(this).val()
            if (val == "") {
                $(".input-group-account").removeClass("error")
                $(".input-group").removeClass("ok")
                nanodrop.setAccount(null)
                return
            }
            if (isNanoAddress(val)) {
                $(".input-group-account").removeClass("error")
                $(".input-group").addClass("ok")
                awaitNanoDrop().then(() => nanodrop.setAccount(val))
            } else {
                $(".input-group-account").removeClass("ok")
                $(".input-group-account").addClass("error")
                awaitNanoDrop().then(() => nanodrop.setAccount(null))
            }
        })
    })

} catch (err) {
    alert(err)
}