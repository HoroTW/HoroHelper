document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    function createChart(ctx, label, labels, data) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: '#805AD5',
                    backgroundColor: 'rgba(128, 90, 213, 0.2)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#A0AEC0' },
                        grid: { color: '#2D3748' }
                    },
                    y: {
                        ticks: { color: '#A0AEC0' },
                        grid: { color: '#2D3748' }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#E2E8F0'
                        }
                    }
                }
            }
        });
    }

    function populateTable(logs) {
        const tableBody = document.querySelector('#logsTable tbody');
        tableBody.innerHTML = ''; // Clear existing data

        logs.forEach(log => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${log.date}</td>
                <td>${log.time.substring(0, 5)}</td>
                <td>${log.weight || '-'}</td>
                <td>${log.body_fat || '-'}</td>
                <td>${log.muscle || '-'}</td>
                <td>${log.visceral_fat || '-'}</td>
                <td>${log.sleep || '-'}</td>
                <td>${log.notes || '-'}</td>
            `;
        });
    }

    fetch(`${apiUrl}/api/logs`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(logs => {
            const labels = logs.map(log => log.date);

            const charts = {
                weight: { ctx: 'weightChart', label: 'Weight (kg)', data: logs.map(l => l.weight) },
                bodyFat: { ctx: 'bodyFatChart', label: 'Body Fat (%)', data: logs.map(l => l.body_fat) },
                muscle: { ctx: 'muscleChart', label: 'Muscle (%)', data: logs.map(l => l.muscle) },
                visceralFat: { ctx: 'visceralFatChart', label: 'Visceral Fat', data: logs.map(l => l.visceral_fat) },
                sleep: { ctx: 'sleepChart', label: 'Sleep (hours)', data: logs.map(l => l.sleep) }
            };

            for (const key in charts) {
                const chart = charts[key];
                const ctx = document.getElementById(chart.ctx).getContext('2d');
                createChart(ctx, chart.label, labels, chart.data);
            }

            populateTable(logs);
        })
        .catch(error => {
            console.error('Error fetching log data:', error);
            const tableBody = document.querySelector('#logsTable tbody');
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Could not load data.</td></tr>`;
        });
});
