document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const modal = document.getElementById('editModal');
    const editForm = document.getElementById('edit-form');
    const closeModal = document.querySelector('.close-button');

    let allLogs = []; // Store all logs to find the one being edited

    closeModal.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    // created Tetradic color scheme
    main_color = '#805AD5';
    secondary_color = '#D55A72';
    thrid_color = '#AFD55A';
    fourth_color = '#5AD5BD';

    function calculateMovingAverage(data, points = 7) {
        // Return an array of nulls if data is too short for a moving average
        if (data.length < points) {
            return new Array(data.length).fill(null);
        }
    
        const movingAverage = new Array(data.length).fill(null);
        const halfPoints = Math.floor(points / 2);
    
        // Calculate the core moving average, ignoring null/undefined values in the window
        for (let i = halfPoints; i < data.length - halfPoints; i++) {
            const window = data.slice(i - halfPoints, i + halfPoints + 1).filter(v => v != null);
            if (window.length > 0) {
                const sum = window.reduce((acc, val) => acc + val, 0);
                movingAverage[i] = sum / window.length;
            }
        }
    
        // --- Padding ---
        const firstMAIndex = halfPoints;
        const lastMAIndex = data.length - halfPoints - 1;
    
        // Start Padding
        if (movingAverage[firstMAIndex] !== null && data[firstMAIndex] !== null) {
            const startDelta = movingAverage[firstMAIndex] - data[firstMAIndex];
            for (let i = 0; i < firstMAIndex; i++) {
                if (data[i] !== null) {
                    movingAverage[i] = data[i] + startDelta;
                }
            }
        }
    
        // End Padding
        if (movingAverage[lastMAIndex] !== null && data[lastMAIndex] !== null) {
            const endDelta = movingAverage[lastMAIndex] - data[lastMAIndex];
            for (let i = lastMAIndex + 1; i < data.length; i++) {
                if (data[i] !== null) {
                    movingAverage[i] = data[i] + endDelta;
                }
            }
        }
    
        return movingAverage;
    }

    function createChart(ctx, label, labels, data, movingAverageData = null) {
        if (window.myCharts && window.myCharts[ctx.canvas.id]) {
            window.myCharts[ctx.canvas.id].destroy();
        }
        window.myCharts = window.myCharts || {};

        // Initiate datasets array
        const datasets = [];
        
        if (movingAverageData) {
            datasets.push({
                label: '1W Average',
                data: movingAverageData,
                borderColor: secondary_color,
                fill: false,
                tension: 0.3,
                pointRadius: 0 // Hide points for the average line
            });
        }

        // Push main dataset
        datasets.push({
            label: label,
            data: data,
            borderColor: main_color,
            backgroundColor: 'rgba(128, 90, 213, 0.2)',
            fill: true,
            tension: 0.3
        });

        window.myCharts[ctx.canvas.id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
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
                <td>
                    <button class="edit-btn" data-id="${log.id}">Edit</button>
                    <button class="delete-btn" data-id="${log.id}">Delete</button>
                </td>
                <td>${log.notes || '-'}</td>
            `;
        });

        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const logId = e.target.dataset.id;
                const logToEdit = allLogs.find(log => log.id == logId);
                if (logToEdit) {
                    document.getElementById('edit-log-id').value = logToEdit.id;
                    document.getElementById('edit-weight').value = logToEdit.weight;
                    document.getElementById('edit-body_fat').value = logToEdit.body_fat;
                    document.getElementById('edit-muscle').value = logToEdit.muscle;
                    document.getElementById('edit-visceral_fat').value = logToEdit.visceral_fat;
                    document.getElementById('edit-sleep').value = logToEdit.sleep;
                    document.getElementById('edit-notes').value = logToEdit.notes;
                    modal.style.display = "block";
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const logId = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this log entry?')) {
                    fetch(`${apiUrl}/api/logs/${logId}`, {
                        method: 'DELETE',
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to delete log');
                        }
                        fetchData(); // Refresh data on the page
                    })
                    .catch(error => {
                        console.error('Error deleting log:', error);
                        alert('Failed to delete log.');
                    });
                }
            });
        });
    }

    function fetchData() {
        fetch(`${apiUrl}/api/logs`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(logs => {
                allLogs = logs; // Store for editing
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
                    let movingAverage = null;
                    if (['weight', 'muscle', 'bodyFat'].includes(key)) {
                        movingAverage = calculateMovingAverage(chart.data);
                    }
                    createChart(ctx, chart.label, labels, chart.data, movingAverage);
                }

                populateTable(logs);
            })
            .catch(error => {
                console.error('Error fetching log data:', error);
                const tableBody = document.querySelector('#logsTable tbody');
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Could not load data.</td></tr>`;
            });
    }

    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const logId = document.getElementById('edit-log-id').value;
        const updatedData = {
            weight: document.getElementById('edit-weight').value || null,
            body_fat: document.getElementById('edit-body_fat').value || null,
            muscle: document.getElementById('edit-muscle').value || null,
            visceral_fat: document.getElementById('edit-visceral_fat').value || null,
            sleep: document.getElementById('edit-sleep').value || null,
            notes: document.getElementById('edit-notes').value || null,
        };

        fetch(`${apiUrl}/api/logs/${logId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update log');
            }
            modal.style.display = "none";
            fetchData(); // Refresh data on the page
        })
        .catch(error => {
            console.error('Error updating log:', error);
            alert('Failed to save changes.');
        });
    });

    fetchData();
});
