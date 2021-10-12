
const MAX_DECIMALS = 8

try {

    function loadPayTableList() {

        function addPayItem(type, amount, account, hash, timestamp) {
            const blockCell = document.createElement("tr")
            blockCell.innerHTML = '\
                    <td class="type">' + type + '</td> \
                    <td class="amount">' + ( type == "change" ? '---' : friendlyAmount(amount, MAX_DECIMALS, true)) + '</td> \
                    <td class="account tAccount">' + account + '</td> \
                    <td class="block"><a href="https://nanocrawler.cc/explorer/block/' + hash + '" target="_blank">Explorer</a></td> \
                    <td class="time">' + timeDifference(Date.now(), timestamp * 1000) + '</td>'
            document.querySelector("#payTable tbody").prepend(blockCell)
        }

        function listen_websockets() {
            start_websockets(CONFIG.urlWS, function (res) {
                if (res.block.link_as_account != config.faucet.account) {
                    addPayItem(res.block.subtype, res.amount, res.block.link_as_account, res.hash)
                }
            })
        }

        getJson("/api/history?period=all")
            .then((blocks) => {
                blocks.forEach((block) => {
                    if (block.subtype == "change" ) {
                        addPayItem(block.subtype, '---', block.representative, block.hash, block.local_timestamp)
                    } else {
                        addPayItem(block.subtype, block.amount, block.account, block.hash, block.local_timestamp)
                    }
                })
                getPagination('#payTable');
                $('#maxRows').trigger('change');
                listen_websockets()
            }).catch((err) => {
                console.log(err)
                console.error("/api/history Error: " + formatError(err.error))
            })
    }

    function loadDropsInfo() {

        getJson("/api/info")
            .then((info) => {
                setPaidFunds(info.total_sent_percentage)
                setDropsCounter(info.drops)
            }).catch((err) => {
                console.error("/api/info Error: " + formatError(err.error))
            })
    }

    loadPayTableList()
    loadDropsInfo()


    $("#copyLink").click(function () {
        copyToClipboard("https://nanodrop.io")
        document.querySelector("input#inputLink").select()
        document.execCommand("copy")
        $(".message").text("link copied")
    })

    function awaitNanoDrop() {
        console.log("awaiting nanodrop")
        return new Promise(async function (resolve, reject) {
            for (let i = 0; i < 300; i++) {
                if (typeof (nanodrop) == "object" && "rendered" in nanodrop && nanodrop.rendered === true) {
                    return resolve(true)
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
                loadDropsMap("dark")
                getJson("/?theme=dark&setOnly")
                awaitNanoDrop().then(() => nanodrop.changeTheme('dark'))
            } else if (theme == 'light') {
                darkMode = false
                if (!isSwitch) $("#themeSwitch").prop("checked", false)
                $("body").removeClass("dark")
                loadDropsMap("light")
                getJson("/?theme=light&setOnly")
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

        // Auto detect saved theme
        if ($("body").hasClass("dark")) {
            changeTheme("dark")
        }

        // Detect Dark Mode
        if ($("body").hasClass("default-theme")) {
            const darkThemeMq = window.matchMedia("(prefers-color-scheme: dark)")
            if (darkThemeMq.matches) changeTheme('dark')
            darkThemeMq.addListener(e => {
                if (e.matches) {
                    changeTheme('dark')
                } else {
                    changeTheme('light')
                }
            })
        }

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

        loadWeekly()

        loadDropsMap()

    })

} catch (err) {
    alert(err)
}