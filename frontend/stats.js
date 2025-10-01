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

    function calculateMovingAverage(data, options = {}) {
        const {
            bandwidth = 0.43,       // Smoothing bandwidth (0-1, higher = smoother)
            projectionDays = 3,    // Number of future points to project
            minDataPoints = 3      // Minimum data points needed
        } = options;

        // Filter out null/undefined values and track indices
        const validPoints = [];
        const validIndices = [];
        data.forEach((val, idx) => {
            if (val != null && !isNaN(val)) {
                validPoints.push(val);
                validIndices.push(idx);
            }
        });

        if (validPoints.length < minDataPoints) {
            return new Array(data.length + projectionDays).fill(null);
        }

        // LOWESS (Locally Weighted Scatterplot Smoothing)
        // Very smooth, follows trends naturally, resistant to outliers
        const smoothed = new Array(validPoints.length);
        const n = validPoints.length;
        const span = Math.max(3, Math.floor(bandwidth * n));

        // Tricube weight function
        const tricube = (x) => {
            const absX = Math.abs(x);
            return absX < 1 ? Math.pow(1 - Math.pow(absX, 3), 3) : 0;
        };

        // Fit local linear regression at each point
        for (let i = 0; i < n; i++) {
            // Determine the window of points to use
            const distances = validIndices.map((_, j) => Math.abs(j - i));
            const sortedDists = [...distances].sort((a, b) => a - b);
            const maxDist = sortedDists[Math.min(span, n - 1)];

            if (maxDist === 0) {
                smoothed[i] = validPoints[i];
                continue;
            }

            // Calculate weights using tricube function
            const weights = distances.map(d => tricube(d / maxDist));
            
            // Weighted linear regression
            let sumW = 0, sumWX = 0, sumWY = 0, sumWX2 = 0, sumWXY = 0;
            for (let j = 0; j < n; j++) {
                const w = weights[j];
                if (w > 0) {
                    sumW += w;
                    sumWX += w * j;
                    sumWY += w * validPoints[j];
                    sumWX2 += w * j * j;
                    sumWXY += w * j * validPoints[j];
                }
            }

            // Solve for line: y = a + b*x
            const denom = sumW * sumWX2 - sumWX * sumWX;
            if (Math.abs(denom) > 1e-10) {
                const a = (sumWX2 * sumWY - sumWX * sumWXY) / denom;
                const b = (sumW * sumWXY - sumWX * sumWY) / denom;
                smoothed[i] = a + b * i;
            } else {
                // Fallback to weighted mean
                smoothed[i] = sumWY / sumW;
            }
        }

        // Map back to original data indices
        const result = new Array(data.length).fill(null);
        validIndices.forEach((originalIdx, smoothedIdx) => {
            result[originalIdx] = smoothed[smoothedIdx];
        });

        // Interpolate missing values
        for (let i = 0; i < result.length - 1; i++) {
            if (result[i] !== null) {
                let nextIdx = i + 1;
                while (nextIdx < result.length && result[nextIdx] === null) {
                    nextIdx++;
                }
                if (nextIdx < result.length) {
                    const gap = nextIdx - i;
                    const step = (result[nextIdx] - result[i]) / gap;
                    for (let j = i + 1; j < nextIdx; j++) {
                        result[j] = result[i] + step * (j - i);
                    }
                }
            }
        }

        // Simple linear projection for future values
        if (projectionDays > 0 && smoothed.length >= 2) {
            // Use last few points to estimate trend
            const lookback = Math.min(10, smoothed.length);
            const recentSmoothed = smoothed.slice(-lookback);
            
            // Linear regression on recent smoothed values
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (let i = 0; i < lookback; i++) {
                sumX += i;
                sumY += recentSmoothed[i];
                sumXY += i * recentSmoothed[i];
                sumX2 += i * i;
            }
            const slope = (lookback * sumXY - sumX * sumY) / (lookback * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / lookback;
            const lastValue = smoothed[smoothed.length - 1];
            
            for (let i = 1; i <= projectionDays; i++) {
                result.push(lastValue + slope * i);
            }
        }

        return result;
    }

    function createChart(ctx, label, labels, data, movingAverageData = null) {
        if (window.myCharts && window.myCharts[ctx.canvas.id]) {
            window.myCharts[ctx.canvas.id].destroy();
        }
        window.myCharts = window.myCharts || {};

        // Initiate datasets array
        const datasets = [];
        
        if (movingAverageData) {
            // Split the moving average into actual and projected data
            const actualLength = data.length;
            const actualAverage = movingAverageData.slice(0, actualLength);
            const projectedAverage = movingAverageData.slice(actualLength - 1); // Include last point for continuity
            
            // Actual moving average (solid line)
            datasets.push({
                label: 'Smoothed',
                data: actualAverage,
                borderColor: secondary_color,
                fill: false,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 0,
                hoverBorderWidth: 2
            });
            
            // Projected moving average (dashed line)
            if (projectedAverage.length > 1) {
                // Pad the beginning with nulls to align with the chart
                const paddedProjection = new Array(actualLength - 1).fill(null).concat(projectedAverage);
                datasets.push({
                    label: 'Projected',
                    data: paddedProjection,
                    borderColor: secondary_color,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hoverBorderWidth: 2
                });
            }
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
                // interaction: {
                //     mode: 'none',
                //     intersect: false,
                // },
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
                            color: '#E2E8F0',
                            filter: function(item, chart) {
                                // Hide "Projected" from legend
                                // return item.text !== 'Projected';
                                // to also hide "Smoothed", use:
                                return item.text !== 'Projected' && item.text !== 'Smoothed';
                            }
                        }
                    },
                    // tooltip: {
                    //     callbacks: {
                    //         label: function(context) {
                    //             // Hide tooltip for average and projected lines
                    //             // if (context.dataset.label === '1W Average' || context.dataset.label === 'Projected') {
                    //             //     return null;
                    //             // }
                    //             let label = context.dataset.label || '';
                    //             if (label) {
                    //                 label += ': ';
                    //             }
                    //             if (context.parsed.y !== null) {
                    //                 label += context.parsed.y;
                    //             }
                    //             return label;
                    //         }
                    //     }
                    // }
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

                // Extend labels for projection (5 days ahead)
                const projectionDays = 5;
                const extendedLabels = [...labels];
                if (logs.length > 0) {
                    const lastDate = new Date(logs[logs.length - 1].date);
                    for (let i = 1; i <= projectionDays; i++) {
                        const futureDate = new Date(lastDate);
                        futureDate.setDate(lastDate.getDate() + i);
                        extendedLabels.push(futureDate.toISOString().split('T')[0]);
                    }
                }

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
                    if (['weight', 'muscle', 'bodyFat', 'sleep'].includes(key)) {
                        movingAverage = calculateMovingAverage(chart.data);
                    }
                    createChart(ctx, chart.label, extendedLabels, chart.data, movingAverage);
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
