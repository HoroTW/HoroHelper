document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const modal = document.getElementById('editModal');
    const editForm = document.getElementById('edit-form');
    const closeModal = document.querySelector('.close-button');

    const jabModal = document.getElementById('editJabModal');
    const editJabForm = document.getElementById('edit-jab-form');
    const closeJabModal = document.querySelector('.close-jab-button');

    let allLogs = []; // Store all logs to find the one being edited
    let allJabs = []; // Store all jabs to find the one being edited

    closeModal.onclick = () => modal.style.display = "none";
    closeJabModal.onclick = () => jabModal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        if (event.target == jabModal) {
            jabModal.style.display = "none";
        }
    };

    // created Tetradic color scheme
    main_color = '#805AD5';
    secondary_color = '#D55A72';
    thrid_color = '#AFD55A';
    fourth_color = '#5AD5BD';

    // Interpolate color based on jab dose using HSV
    function getJabColor(dose) {
        // 2.5mg -> #D55A72 (348°, 58%, 84%)
        // 15mg -> #5a75d6 (227°, 58%, 84%)
        const minDose = 2.5;
        const maxDose = 15;
        const minHue = 348;
        const maxHue = 227;
        
        // Clamp dose to range
        const clampedDose = Math.max(minDose, Math.min(maxDose, dose));
        
        // Calculate hue rotation (from 348° to 227° going backwards)
        // That's a -121° rotation, but we want to wrap around through 360
        // So 348 -> 360 -> 0 -> 227 is actually +239° or equivalently -121°
        const hueRange = (360 + maxHue - minHue) % 360; // 239°
        const t = (clampedDose - minDose) / (maxDose - minDose);
        const hue = (minHue + hueRange * t) % 360;
        
        // Fixed saturation and value
        const saturation = 58;
        const value = 84;
        
        return hsvToHex(hue, saturation, value);
    }
    
    function hsvToHex(h, s, v) {
        s = s / 100;
        v = v / 100;
        
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        
        let r, g, b;
        if (h < 60) {
            [r, g, b] = [c, x, 0];
        } else if (h < 120) {
            [r, g, b] = [x, c, 0];
        } else if (h < 180) {
            [r, g, b] = [0, c, x];
        } else if (h < 240) {
            [r, g, b] = [0, x, c];
        } else if (h < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        
        const toHex = (n) => {
            const hex = Math.round((n + m) * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

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

    function createChart(ctx, label, labels, data, movingAverageData = null, jabInfo = null, medicationLevels = null) {
        if (window.myCharts && window.myCharts[ctx.canvas.id]) {
            window.myCharts[ctx.canvas.id].destroy();
        }
        window.myCharts = window.myCharts || {};

        // Initiate datasets array
        const datasets = [];
        
        // Convert labels to datetime objects for time scale
        const parseDateTime = (label) => {
            // Label format: "YYYY-MM-DD HH:MM"
            return new Date(label.replace(' ', 'T') + ':00');
        };
        
        if (movingAverageData) {
            // Split the moving average into actual and projected data
            const actualLength = data.length;
            const actualAverage = movingAverageData.slice(0, actualLength);
            const projectedAverage = movingAverageData.slice(actualLength - 1); // Include last point for continuity
            
            // If we have jab info, create segmented lines with different colors
            if (jabInfo && jabInfo.segments && jabInfo.segments.length > 0) {
                // Create a dataset for each segment with its own color
                jabInfo.segments.forEach((segment, idx) => {
                    const segmentData = [];
                    // Fill in the data for this segment
                    for (let i = segment.startIndex; i <= segment.endIndex && i < actualLength; i++) {
                        if (actualAverage[i] !== null) {
                            segmentData.push({
                                x: parseDateTime(labels[i]),
                                y: actualAverage[i]
                            });
                        }
                    }
                    
                    datasets.push({
                        label: segment.dose ? `${segment.dose}mg` : 'Pre-jab',
                        data: segmentData,
                        borderColor: segment.color,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        hoverBorderWidth: 2,
                        segment: {
                            borderColor: segment.color
                        }
                    });
                });
            } else {
                // No jabs, use default color for entire smoothed line
                const smoothedData = actualAverage.map((val, i) => ({
                    x: parseDateTime(labels[i]),
                    y: val
                })).filter(point => point.y !== null);
                
                datasets.push({
                    label: 'Smoothed',
                    data: smoothedData,
                    borderColor: secondary_color,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hoverBorderWidth: 2
                });
            }
            
            // Projected moving average (dashed line)
            if (projectedAverage.length > 1) {
                const projectedData = projectedAverage.map((val, i) => ({
                    x: parseDateTime(labels[actualLength - 1 + i]),
                    y: val
                })).filter(point => point.y !== null);
                
                // Use the color of the last segment if available
                const projectionColor = (jabInfo && jabInfo.segments && jabInfo.segments.length > 0) 
                    ? jabInfo.segments[jabInfo.segments.length - 1].color 
                    : secondary_color;
                
                datasets.push({
                    label: 'Projected',
                    data: projectedData,
                    borderColor: projectionColor,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    hoverBorderWidth: 2
                });
            }
        }

        // Add medication levels dataset if provided (for weight chart)
        if (medicationLevels && medicationLevels.length > 0) {
            // Create a map of medication levels by datetime for quick lookup
            // For each log entry (with date + time), find the closest medication level
            const actualLabels = labels.slice(0, data.length); // Only use labels where we have weight data
            const medData = actualLabels.map((label, idx) => {
                // Parse the label back to date and time
                const [dateStr, timeStr] = label.split(' ');
                
                // Find medication levels for this date
                const dateMatches = medicationLevels.filter(m => m.datetime.startsWith(dateStr));
                
                if (dateMatches.length === 0) return null;
                
                // If we have time info, find the closest one by time
                if (timeStr) {
                    const targetTime = timeStr.split(':').map(Number); // [HH, MM]
                    const targetMinutes = targetTime[0] * 60 + targetTime[1];
                    
                    let closest = dateMatches[0];
                    let minDiff = Infinity;
                    
                    dateMatches.forEach(m => {
                        const medTime = m.datetime.split('T')[1].split(':').map(Number); // [HH, MM, SS]
                        const medMinutes = medTime[0] * 60 + medTime[1];
                        const diff = Math.abs(medMinutes - targetMinutes);
                        
                        if (diff < minDiff) {
                            minDiff = diff;
                            closest = m;
                        }
                    });
                    
                    return {
                        x: parseDateTime(label),
                        y: closest.level
                    };
                }
                
                // Fallback: return average for the day
                const sum = dateMatches.reduce((acc, m) => acc + m.level, 0);
                return {
                    x: parseDateTime(label),
                    y: sum / dateMatches.length
                };
            }).filter(point => point !== null);
            
            datasets.push({
                label: 'Medication Level (mg)',
                data: medData,
                borderColor: fourth_color,
                backgroundColor: 'rgba(90, 213, 189, 0.1)',
                fill: false,
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 4,
                yAxisID: 'y1',
                borderWidth: 2
            });
        }

        // Push main dataset with x/y format
        const mainData = data.map((val, i) => ({
            x: parseDateTime(labels[i]),
            y: val
        })).filter(point => point.y !== null);
        
        datasets.push({
            label: label,
            data: mainData,
            borderColor: main_color,
            backgroundColor: 'rgba(128, 90, 213, 0.2)',
            fill: true,
            tension: 0.3
        });

        window.myCharts[ctx.canvas.id] = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d'
                            },
                            tooltipFormat: 'MMM d, HH:mm'
                        },
                        ticks: { 
                            color: '#A0AEC0',
                            maxRotation: 45,
                            minRotation: 0
                        },
                        grid: { color: '#2D3748' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        ticks: { color: '#A0AEC0' },
                        grid: { color: '#2D3748' }
                    },
                    y1: {
                        type: 'linear',
                        display: medicationLevels && medicationLevels.length > 0,
                        position: 'right',
                        ticks: { 
                            color: fourth_color,
                            callback: function(value) {
                                return value.toFixed(2);
                            }
                        },
                        grid: {
                            drawOnChartArea: false, // Don't draw grid lines for second axis
                        },
                        title: {
                            display: true,
                            text: 'Medication Level (mg)',
                            color: fourth_color
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#E2E8F0',
                            generateLabels: function(chart) {
                                const datasets = chart.data.datasets;
                                const uniqueLabels = new Map(); // Use Map to track unique labels and their colors
                                
                                // Helper function to convert hex to rgba with alpha
                                const hexToRgba = (hex, alpha) => {
                                    const r = parseInt(hex.slice(1, 3), 16);
                                    const g = parseInt(hex.slice(3, 5), 16);
                                    const b = parseInt(hex.slice(5, 7), 16);
                                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                };
                                
                                // Collect unique labels (doses) with their colors
                                datasets.forEach((dataset, i) => {
                                    const label = dataset.label;
                                    // Skip these labels entirely
                                    if (label === 'Projected' || label === 'Smoothed' || label === 'Pre-jab') {
                                        return;
                                    }
                                    
                                    // Only add if we haven't seen this label before
                                    if (!uniqueLabels.has(label)) {
                                        const borderColor = dataset.borderColor;
                                        uniqueLabels.set(label, {
                                            text: label,
                                            fillStyle: hexToRgba(borderColor, 0.2),
                                            strokeStyle: borderColor,
                                            fontColor: '#E2E8F0',
                                            lineWidth: 2,
                                            hidden: false,
                                            index: i
                                        });
                                    }
                                });
                                
                                // Also add the main weight dataset
                                const weightDataset = datasets.find(d => d.label && d.label.includes('kg'));
                                if (weightDataset) {
                                    const borderColor = weightDataset.borderColor;
                                    uniqueLabels.set(weightDataset.label, {
                                        text: weightDataset.label,
                                        fillStyle: hexToRgba(borderColor, 0.2),
                                        strokeStyle: borderColor,
                                        fontColor: '#E2E8F0',
                                        lineWidth: 2,
                                        hidden: false,
                                        index: datasets.indexOf(weightDataset)
                                    });
                                }
                                
                                // Also add medication level dataset if present
                                const medDataset = datasets.find(d => d.label && d.label.includes('Medication'));
                                if (medDataset) {
                                    const borderColor = medDataset.borderColor;
                                    uniqueLabels.set(medDataset.label, {
                                        text: medDataset.label,
                                        fillStyle: hexToRgba(borderColor, 0.2),
                                        strokeStyle: borderColor,
                                        fontColor: '#E2E8F0',
                                        lineWidth: 2,
                                        hidden: false,
                                        index: datasets.indexOf(medDataset)
                                    });
                                }
                                
                                return Array.from(uniqueLabels.values());
                            }
                        }
                    },
                }
            }
        });
    }

    function populateJabsTable(jabs) {
        const tableBody = document.querySelector('#jabsTable tbody');
        tableBody.innerHTML = ''; // Clear existing data

        jabs.forEach(jab => {
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${jab.date}</td>
                <td>${jab.time.substring(0, 5)}</td>
                <td>${jab.dose}</td>
                <td>${jab.notes || '-'}</td>
                <td>
                    <button class="edit-jab-btn" data-id="${jab.id}">Edit</button>
                    <button class="delete-jab-btn" data-id="${jab.id}">Delete</button>
                </td>
            `;
        });

        document.querySelectorAll('.edit-jab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const jabId = e.target.dataset.id;
                const jabToEdit = allJabs.find(jab => jab.id == jabId);
                if (jabToEdit) {
                    document.getElementById('edit-jab-id').value = jabToEdit.id;
                    document.getElementById('edit-jab-dose').value = jabToEdit.dose;
                    document.getElementById('edit-jab-notes').value = jabToEdit.notes;
                    jabModal.style.display = "block";
                }
            });
        });

        document.querySelectorAll('.delete-jab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const jabId = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this jab entry?')) {
                    fetch(`${apiUrl}/api/jabs/${jabId}`, {
                        method: 'DELETE',
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Failed to delete jab');
                        }
                        fetchData(); // Refresh data on the page
                    })
                    .catch(error => {
                        console.error('Error deleting jab:', error);
                        alert('Failed to delete jab.');
                    });
                }
            });
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
        // Fetch logs, jabs, and medication levels
        Promise.all([
            fetch(`${apiUrl}/api/logs`).then(r => r.ok ? r.json() : []),
            fetch(`${apiUrl}/api/jabs`).then(r => r.ok ? r.json() : []),
            fetch(`${apiUrl}/api/medication-levels`).then(r => r.ok ? r.json() : [])
        ])
            .then(([logs, jabs, medicationLevels]) => {
                allLogs = logs; // Store for editing
                allJabs = jabs; // Store for editing
                
                // Create labels with date and time to handle multiple entries per day
                const labels = logs.map(log => `${log.date} ${log.time.substring(0, 5)}`);

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

                // Map jabs to create color segments for the smoothed line
                const jabSegments = [];
                
                // Sort jabs by date
                const sortedJabs = [...jabs].sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Create segments based on jab dates
                if (sortedJabs.length > 0) {
                    let currentStartIndex = 0;
                    
                    sortedJabs.forEach((jab, jabIndex) => {
                        const jabDate = jab.date;
                        // Find the first label that matches this jab date (could be multiple entries per day)
                        const jabIndexInLabels = labels.findIndex(label => label.startsWith(jabDate));
                        
                        if (jabIndexInLabels !== -1) {
                            // Find the next jab index or use the end of the data
                            const nextJabDate = jabIndex < sortedJabs.length - 1 ? sortedJabs[jabIndex + 1].date : null;
                            const nextJabIndex = nextJabDate 
                                ? labels.findIndex(label => label.startsWith(nextJabDate))
                                : -1;
                            
                            // End this segment at the next jab (inclusive) or at the end of data
                            const endIndex = nextJabIndex !== -1 ? nextJabIndex : labels.length - 1;
                            
                            jabSegments.push({
                                startIndex: jabIndexInLabels,
                                endIndex: endIndex,
                                dose: jab.dose,
                                color: getJabColor(jab.dose)
                            });
                        }
                    });
                    
                    // If there's data before the first jab, add a default colored segment
                    if (jabSegments.length > 0 && jabSegments[0].startIndex > 0) {
                        jabSegments.unshift({
                            startIndex: 0,
                            endIndex: jabSegments[0].startIndex,  // Include the overlap point
                            dose: null,
                            color: secondary_color
                        });
                    }
                } else {
                    // No jabs, use default color for entire range
                    jabSegments.push({
                        startIndex: 0,
                        endIndex: labels.length - 1,
                        dose: null,
                        color: secondary_color
                    });
                }
                
                const jabInfo = {
                    segments: jabSegments
                };

                const charts = {
                    weight: { ctx: 'weightChart', label: 'Weight (kg)', data: logs.map(l => l.weight), includeJabs: true, includeMedication: true },
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
                    const jabData = chart.includeJabs ? jabInfo : null;
                    const medData = chart.includeMedication ? medicationLevels : null;
                    createChart(ctx, chart.label, extendedLabels, chart.data, movingAverage, jabData, medData);
                }

                populateTable(logs);
                populateJabsTable(jabs);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                const tableBody = document.querySelector('#logsTable tbody');
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Could not load data.</td></tr>`;
                const jabTableBody = document.querySelector('#jabsTable tbody');
                jabTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Could not load data.</td></tr>`;
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

    editJabForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const jabId = document.getElementById('edit-jab-id').value;
        const updatedData = {
            dose: document.getElementById('edit-jab-dose').value,
            notes: document.getElementById('edit-jab-notes').value || null,
        };

        fetch(`${apiUrl}/api/jabs/${jabId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to update jab');
            }
            jabModal.style.display = "none";
            fetchData(); // Refresh data on the page
        })
        .catch(error => {
            console.error('Error updating jab:', error);
            alert('Failed to save changes.');
        });
    });

    fetchData();
});
