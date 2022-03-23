const mapColors = {
    light: {
        colorMin: "#cee1f7",
        colorMax: "#1f69c1",
        colorNoData: "#F4FAFF",
        colorOcean: "#d9ecff",
        colorBorder: "transparent"
    },
    dark: {
        colorMin: "#cee1f7",
        colorMax: "#1f69c1",
        colorNoData: "#34323D",
        colorOcean: "transparent",
        colorBorder: "#333"
    }
}

function destroyMap() {
    document.getElementById("svgMapDrops").innerHTML = ""
}

function createMap(theme = "light", data) {
    // Create map
    new svgMap({
        targetElementID: 'svgMapDrops',
        data: data,
        colorMax: mapColors[theme].colorMax,
        colorMin: mapColors[theme].colorMin,
        colorNoData: mapColors[theme].colorNoData
    });

    // Set Map container and ocean color
    $(".countries_container").css({
        background: mapColors[theme].colorOcean,
        border: "1px solid " + mapColors[theme].colorBorder,
        borderRadius: '6px'
    })
    $(".svgMap-map-wrapper").css({
        background: mapColors[theme].colorOcean,
        borderRadius: '6px'
    })
}

function loadDropsMap(theme = "light") {

    destroyMap()

    // Define Map Data
    const dropsData = {
        data: {
            drops: {
                name: 'Drops',
                thousandSeparator: ','
            },
            users: {
                name: 'Users',
                format: '{0} (by IP)',
                thousandSeparator: ','
            }
        },
        applyData: 'drops',
        values: {}
    }

    createMap(theme, dropsData)
    // Set Ranking color
    $(".countries_ranking").css({
        background: mapColors[theme].colorOcean,
        borderRadius: '6px'
    })

    getJson("/api/history?drops=bycountry")
        .then((res) => {

            dropsData.values = res

            destroyMap()
            createMap(theme, dropsData)

            // Change the color of countries with zero drop
            for (let code in dropsData.values) {
                if (dropsData.values[code].drops == 0) $('#svgMapDrops-map-country-' + code).css("fill", mapColors[theme].colorNoData)
            }

            // Create Ranking
            let ranking = Object.fromEntries(
                Object.entries(dropsData.values).sort((a, b) => b[1].drops - a[1].drops)
            );
            let position = 0
            for (let cc in ranking) {
                if (ranking[cc].drops > 0) {
                    position++;
                    let countryName = res[cc].name
                    let country = '<div class="country">\
                        <span class="ranking_position">' + position + 'º</span>\
                        <span class="country_name">' + countryName + '\
                        </span><span class="users">' + ranking[cc].drops + '</span>\
                    </div>'
                    $("#countries_ranking_body").append(country)
                }
            }

            // Set Ranking color
            $(".countries_ranking").css({
                background: mapColors[theme].colorOcean,
                borderRadius: '6px'
            })

        })
        .catch((err) => {
            console.error(err)
        })
}

async function country_drop(countryCode, countryName) {

    countryCode = countryCode.toUpperCase()

    // Country SVG element ID
    let country_id = '#svgMapDrops-map-country-' + countryCode

    // Get current color
    const originallFill = $(country_id).css("fill")

    // Show message box
    $("#country_new_drop_alert .countryName").text(countryName)
    $("#country_new_drop_alert").fadeIn(700)

    // Change country color fill, duration 2 seconds
    $(country_id).css({ fill: "#070836", transition: "2.0s" });

    // Await 2.2 seconds
    await sleep(2200)

    // Fill the country to the original color, duration 1.5 seconds
    $(country_id).css({ fill: originallFill, transition: "1.5s" });

    // Hide message box
    $("#country_new_drop_alert").fadeOut(1200)
}
