function setPaidFunds(n) {
    $('.ko-progress-circle').attr('data-progress', parseInt(n));
    $('.ko-progress-circle .message .value').text(n + '%');
}

async function setDropsCounter(n) {
    $('#drops_counter .message .value').text(n)
    $('#drops_counter').attr('data-progress', 100);
    await sleep(2000)
    $('#drops_counter').attr('data-progress', 0);
}

function loadWeekly() {
    getJson("/api/history?drops=weekly")
        .then((res) => {
            var ctx = document.getElementById('myChart').getContext('2d');
            var myChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Object.keys(res),
                    datasets: [{
                        label: 'Drops',
                        data: Object.values(res),
                        backgroundColor: [
                            'rgba(66, 143, 222, 0.2)'
                        ],
                        borderColor: [
                            'rgba(66, 143, 222, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        yAxes: [{
                            ticks: {
                                beginAtZero: true
                            }
                        }]
                    }
                }
            });
        })
        .catch((err) => {
            console.error("/api/info Error: " + formatError(err.error))
        })
}

