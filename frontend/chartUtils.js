// Chart utility functions for data visualization

// Color scheme
const main_color = '#805AD5';
const secondary_color = '#D55A72';
const thrid_color = '#AFD55A';
const fourth_color = '#5AD5BD';

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
        // Get the date range from the weight data
        const firstWeightDate = data.length > 0 ? parseDateTime(labels[0]) : null;
        const lastWeightDate = data.length > 0 ? parseDateTime(labels[data.length - 1]) : null;
        
        // Include all medication level data points within the date range of weight data
        const medData = medicationLevels
            .map(m => {
                const datetime = new Date(m.datetime);
                return {
                    x: datetime,
                    y: m.level
                };
            })
            .filter(point => {
                // Only include points within the range of weight measurements
                if (!firstWeightDate || !lastWeightDate) return false;
                return point.x >= firstWeightDate && point.x <= lastWeightDate;
            })
            .sort((a, b) => a.x - b.x); // Sort by time
        
        datasets.push({
            label: 'Medication Level (mg)',
            data: medData,
            borderColor: fourth_color,
            backgroundColor: 'rgba(90, 213, 189, 0.1)',
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBorderWidth: 2,
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

function createMultiLineChart(ctx, title, labels, datasets) {
    if (window.myCharts && window.myCharts[ctx.canvas.id]) {
        window.myCharts[ctx.canvas.id].destroy();
    }
    window.myCharts = window.myCharts || {};

    const colors = [main_color, secondary_color, thrid_color, fourth_color];
    
    const chartDatasets = datasets.map((dataset, idx) => {
        const data = dataset.data.map((val, i) => ({
            x: new Date(labels[i].replace(' ', 'T') + ':00'),
            y: val
        })).filter(point => point.y !== null);

        return {
            label: dataset.label,
            data: data,
            borderColor: colors[idx % colors.length],
            backgroundColor: `${colors[idx % colors.length]}33`,
            fill: false,
            tension: 0.3,
            pointRadius: 3,
            pointHoverRadius: 5
        };
    });

    window.myCharts[ctx.canvas.id] = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: chartDatasets
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
                    ticks: { color: '#A0AEC0' },
                    grid: { color: '#2D3748' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#E2E8F0'
                    }
                },
                title: {
                    display: true,
                    text: title,
                    color: '#E2E8F0',
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}
