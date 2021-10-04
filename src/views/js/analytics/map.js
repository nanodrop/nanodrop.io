let countriesNames = {
    "AF": "Afghanistan",
    "AX": "Åland Islands",
    "AL": "Albania",
    "DZ": "Algeria",
    "AS": "American Samoa",
    "AD": "Andorra",
    "AO": "Angola",
    "AI": "Anguilla",
    "AQ": "Antarctica",
    "AG": "Antigua and Barbuda",
    "AR": "Argentina",
    "AM": "Armenia",
    "AW": "Aruba",
    "AU": "Australia",
    "AT": "Austria",
    "AZ": "Azerbaijan",
    "BS": "Bahamas",
    "BH": "Bahrain",
    "BD": "Bangladesh",
    "BB": "Barbados",
    "BY": "Belarus",
    "BE": "Belgium",
    "BZ": "Belize",
    "BJ": "Benin",
    "BM": "Bermuda",
    "BT": "Bhutan",
    "BO": "Bolivia",
    "BA": "Bosnia and Herzegovina",
    "BW": "Botswana",
    "BV": "Bouvet Island",
    "BR": "Brazil",
    "BQ": "Bonaire, Sint Eustatius and Saba",
    "IO": "British Indian Ocean Territory",
    "BN": "Brunei Darussalam",
    "BG": "Bulgaria",
    "BF": "Burkina Faso",
    "BI": "Burundi",
    "KH": "Cambodia",
    "CM": "Cameroon",
    "CA": "Canada",
    "CV": "Cape Verde",
    "KY": "Cayman Islands",
    "CF": "Central African Republic",
    "TD": "Chad",
    "CL": "Chile",
    "CN": "China",
    "CX": "Christmas Island",
    "CC": "Cocos (Keeling) Islands",
    "CO": "Colombia",
    "KM": "Comoros",
    "CG": "Congo",
    "CD": "Congo, The Democratic Republic of the",
    "CK": "Cook Islands",
    "CR": "Costa Rica",
    "CI": "Cote D'Ivoire",
    "HR": "Croatia",
    "CU": "Cuba",
    "CY": "Cyprus",
    "CZ": "Czech Republic",
    "DK": "Denmark",
    "DJ": "Djibouti",
    "DM": "Dominica",
    "DO": "Dominican Republic",
    "EC": "Ecuador",
    "EG": "Egypt",
    "SV": "El Salvador",
    "GQ": "Equatorial Guinea",
    "ER": "Eritrea",
    "EE": "Estonia",
    "ET": "Ethiopia",
    "FK": "Falkland Islands (Malvinas)",
    "FO": "Faroe Islands",
    "FJ": "Fiji",
    "FI": "Finland",
    "FR": "France",
    "GF": "French Guiana",
    "PF": "French Polynesia",
    "TF": "French Southern Territories",
    "GA": "Gabon",
    "GM": "Gambia",
    "GE": "Georgia",
    "DE": "Germany",
    "GH": "Ghana",
    "GI": "Gibraltar",
    "GR": "Greece",
    "GL": "Greenland",
    "GD": "Grenada",
    "GP": "Guadeloupe",
    "GU": "Guam",
    "GT": "Guatemala",
    "GG": "Guernsey",
    "GN": "Guinea",
    "GW": "Guinea-Bissau",
    "GY": "Guyana",
    "HT": "Haiti",
    "HM": "Heard Island and Mcdonald Islands",
    "VA": "Holy See (Vatican City State)",
    "HN": "Honduras",
    "HK": "Hong Kong",
    "HU": "Hungary",
    "IS": "Iceland",
    "IN": "India",
    "ID": "Indonesia",
    "IR": "Iran, Islamic Republic Of",
    "IQ": "Iraq",
    "IE": "Ireland",
    "IM": "Isle of Man",
    "IL": "Israel",
    "IT": "Italy",
    "JM": "Jamaica",
    "JP": "Japan",
    "JE": "Jersey",
    "JO": "Jordan",
    "KZ": "Kazakhstan",
    "KE": "Kenya",
    "KI": "Kiribati",
    "KP": "Democratic People's Republic of Korea",
    "KR": "Korea, Republic of",
    "XK": "Kosovo",
    "KW": "Kuwait",
    "KG": "Kyrgyzstan",
    "LA": "Lao People's Democratic Republic",
    "LV": "Latvia",
    "LB": "Lebanon",
    "LS": "Lesotho",
    "LR": "Liberia",
    "LY": "Libyan Arab Jamahiriya",
    "LI": "Liechtenstein",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "MO": "Macao",
    "MK": "Macedonia, The Former Yugoslav Republic of",
    "MG": "Madagascar",
    "MW": "Malawi",
    "MY": "Malaysia",
    "MV": "Maldives",
    "ML": "Mali",
    "MT": "Malta",
    "MH": "Marshall Islands",
    "MQ": "Martinique",
    "MR": "Mauritania",
    "MU": "Mauritius",
    "YT": "Mayotte",
    "MX": "Mexico",
    "FM": "Micronesia, Federated States of",
    "MD": "Moldova, Republic of",
    "MC": "Monaco",
    "MN": "Mongolia",
    "ME": "Montenegro",
    "MS": "Montserrat",
    "MA": "Morocco",
    "MZ": "Mozambique",
    "MM": "Myanmar",
    "NA": "Namibia",
    "NR": "Nauru",
    "NP": "Nepal",
    "NL": "Netherlands",
    "AN": "Netherlands Antilles",
    "NC": "New Caledonia",
    "NZ": "New Zealand",
    "NI": "Nicaragua",
    "NE": "Niger",
    "NG": "Nigeria",
    "NU": "Niue",
    "NF": "Norfolk Island",
    "MP": "Northern Mariana Islands",
    "NO": "Norway",
    "OM": "Oman",
    "PK": "Pakistan",
    "PW": "Palau",
    "PS": "Palestinian Territory, Occupied",
    "PA": "Panama",
    "PG": "Papua New Guinea",
    "PY": "Paraguay",
    "PE": "Peru",
    "PH": "Philippines",
    "PN": "Pitcairn",
    "PL": "Poland",
    "PT": "Portugal",
    "PR": "Puerto Rico",
    "QA": "Qatar",
    "RE": "Reunion",
    "RO": "Romania",
    "RU": "Russian Federation",
    "RW": "Rwanda",
    "SH": "Saint Helena",
    "KN": "Saint Kitts and Nevis",
    "LC": "Saint Lucia",
    "PM": "Saint Pierre and Miquelon",
    "VC": "Saint Vincent and the Grenadines",
    "WS": "Samoa",
    "SM": "San Marino",
    "ST": "Sao Tome and Principe",
    "SA": "Saudi Arabia",
    "SN": "Senegal",
    "RS": "Serbia",
    "SC": "Seychelles",
    "SL": "Sierra Leone",
    "SG": "Singapore",
    "SK": "Slovakia",
    "SI": "Slovenia",
    "SB": "Solomon Islands",
    "SO": "Somalia",
    "ZA": "South Africa",
    "GS": "South Georgia and the South Sandwich Islands",
    "ES": "Spain",
    "LK": "Sri Lanka",
    "SD": "Sudan",
    "SR": "Suriname",
    "SJ": "Svalbard and Jan Mayen",
    "SZ": "Swaziland",
    "SE": "Sweden",
    "CH": "Switzerland",
    "SY": "Syrian Arab Republic",
    "TW": "Taiwan",
    "TJ": "Tajikistan",
    "TZ": "Tanzania, United Republic of",
    "TH": "Thailand",
    "TL": "Timor-Leste",
    "TG": "Togo",
    "TK": "Tokelau",
    "TO": "Tonga",
    "TT": "Trinidad and Tobago",
    "TN": "Tunisia",
    "TR": "Turkey",
    "TM": "Turkmenistan",
    "TC": "Turks and Caicos Islands",
    "TV": "Tuvalu",
    "UG": "Uganda",
    "UA": "Ukraine",
    "AE": "United Arab Emirates",
    "GB": "United Kingdom",
    "US": "United States",
    "UM": "United States Minor Outlying Islands",
    "UY": "Uruguay",
    "UZ": "Uzbekistan",
    "VU": "Vanuatu",
    "VE": "Venezuela",
    "VN": "Viet Nam",
    "VG": "Virgin Islands, British",
    "VI": "Virgin Islands, U.S.",
    "WF": "Wallis and Futuna",
    "EH": "Western Sahara",
    "YE": "Yemen",
    "ZM": "Zambia",
    "ZW": "Zimbabwe"
}

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

function loadDropsMap(theme = "light") {
    document.getElementById("svgMapDrops").innerHTML = ""
    getJson("/api/history?drops=bycountry")
        .then((res) => {

            // Define Map Data
            let dropsData = {
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
                values: res
            }

            // Create map
            new svgMap({
                targetElementID: 'svgMapDrops',
                data: dropsData,
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
                    let countryName = countriesNames[cc] ? countriesNames[cc] : 'UNKNOWN'
                    let country = '<div class="country">\
                        <span class="ranking_position">' + position + 'º</span>\
                        <span class="country_name">' + countryName + '\
                        </span><span class="users">' + ranking[cc].drops + '</span>\
                    </div>'
                    $("#countries_ranking_body").append(country)
                    if (countriesNames[cc] == undefined) console.log(cc + " not found!")
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

async function country_drop(countryCode) {

    countryCode = countryCode.toUpperCase()

    // Country SVG element ID
    let country_id = '#svgMapDrops-map-country-' + countryCode

    // Get current color
    const originallFill = $(country_id).css("fill")

    // Show message box
    $("#country_new_drop_alert .countryName").text(countriesNames[countryCode])
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
