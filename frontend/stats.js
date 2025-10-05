// Main stats page orchestration and data fetching

document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const modal = document.getElementById('editModal');
    const editForm = document.getElementById('edit-form');
    const closeModal = document.querySelector('.close-button');

    const jabModal = document.getElementById('editJabModal');
    const editJabForm = document.getElementById('edit-jab-form');
    const closeJabModal = jabModal.querySelector('.close-button');

    const measurementModal = document.getElementById('editMeasurementModal');
    const editMeasurementForm = document.getElementById('edit-measurement-form');
    const closeMeasurementModal = measurementModal.querySelector('.close-button');

    let allLogs = []; // Store all logs to find the one being edited
    let allJabs = []; // Store all jabs to find the one being edited
    let allMeasurements = []; // Store all measurements to find the one being edited

    closeModal.onclick = () => modal.style.display = "none";
    closeJabModal.onclick = () => jabModal.style.display = "none";
    closeMeasurementModal.onclick = () => measurementModal.style.display = "none";
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
        }
        if (event.target == jabModal) {
            jabModal.style.display = "none";
        }
        if (event.target == measurementModal) {
            measurementModal.style.display = "none";
        }
    };

    function fetchData() {
        // Fetch logs, jabs, body measurements, and medication levels
        Promise.all([
            fetch(`${apiUrl}/api/logs`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
            fetch(`${apiUrl}/api/jabs`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
            fetch(`${apiUrl}/api/medication-levels`, { credentials: 'include' }).then(r => r.ok ? r.json() : []),
            fetch(`${apiUrl}/api/body-measurements`, { credentials: 'include' }).then(r => r.ok ? r.json() : [])
        ])
            .then(([logs, jabs, medicationLevels, measurements]) => {
                allLogs = logs; // Store for editing
                allJabs = jabs; // Store for editing
                allMeasurements = measurements; // Store for editing

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

                // Create body measurement charts
                if (measurements.length > 0) {
                    const measurementLabels = measurements.map(m => `${m.date} ${m.time.substring(0, 5)}`);

                    // Upper Arms Chart
                    const upperArmCtx = document.getElementById('upperArmChart').getContext('2d');
                    createMultiLineChart(upperArmCtx, 'Upper Arms (cm)', measurementLabels, [
                        { label: 'Left', data: measurements.map(m => m.upper_arm_left) },
                        { label: 'Right', data: measurements.map(m => m.upper_arm_right) }
                    ]);

                    // Chest and Waist Chart
                    const chestWaistCtx = document.getElementById('chestWaistChart').getContext('2d');
                    createMultiLineChart(chestWaistCtx, 'Chest & Waist (cm)', measurementLabels, [
                        { label: 'Chest', data: measurements.map(m => m.chest) },
                        { label: 'Waist', data: measurements.map(m => m.waist) }
                    ]);

                    // Thighs Chart
                    const thighCtx = document.getElementById('thighChart').getContext('2d');
                    createMultiLineChart(thighCtx, 'Thighs (cm)', measurementLabels, [
                        { label: 'Left', data: measurements.map(m => m.thigh_left) },
                        { label: 'Right', data: measurements.map(m => m.thigh_right) }
                    ]);

                    // Face and Neck Chart
                    const faceNeckCtx = document.getElementById('faceNeckChart').getContext('2d');
                    createMultiLineChart(faceNeckCtx, 'Face & Neck (cm)', measurementLabels, [
                        { label: 'Face', data: measurements.map(m => m.face) },
                        { label: 'Neck', data: measurements.map(m => m.neck) }
                    ]);
                }

                // Wrap delete button setup with API URL and fetchData callback
                const setupDeleteButtonWrapper = (selector, endpoint, entityName) => {
                    setupDeleteButton(selector, endpoint, entityName, apiUrl, fetchData);
                };

                populateTable(logs, allLogs, modal, setupEditButton, setupDeleteButtonWrapper);
                populateJabsTable(jabs, allJabs, jabModal, setupEditButton, setupDeleteButtonWrapper);
                populateMeasurementsTable(measurements, allMeasurements, measurementModal, setupEditButton, setupDeleteButtonWrapper);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                const tableBody = document.querySelector('#logsTable tbody');
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Could not load data.</td></tr>`;
                const jabTableBody = document.querySelector('#jabsTable tbody');
                jabTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Could not load data.</td></tr>`;
                const measurementsTableBody = document.querySelector('#measurementsTable tbody');
                measurementsTableBody.innerHTML = `<tr><td colspan="12" style="text-align:center;">Could not load data.</td></tr>`;
            });
    }

    // Setup all form submissions with wrapped callback
    const setupFormSubmitWrapper = (form, idField, modal, endpoint, entityName, fieldMappings) => {
        setupFormSubmit(form, idField, modal, endpoint, entityName, fieldMappings, apiUrl, fetchData);
    };

    setupFormSubmitWrapper(editForm, 'edit-log-id', modal, '/api/logs', 'log', {
        weight: 'edit-weight',
        body_fat: 'edit-body_fat',
        muscle: 'edit-muscle',
        visceral_fat: 'edit-visceral_fat',
        sleep: 'edit-sleep',
        notes: 'edit-notes'
    });

    setupFormSubmitWrapper(editJabForm, 'edit-jab-id', jabModal, '/api/jabs', 'jab', {
        dose: 'edit-jab-dose',
        notes: 'edit-jab-notes'
    });

    setupFormSubmitWrapper(editMeasurementForm, 'edit-measurement-id', measurementModal, '/api/body-measurements', 'measurement', {
        upper_arm_left: 'edit-upper_arm_left',
        upper_arm_right: 'edit-upper_arm_right',
        chest: 'edit-chest',
        waist: 'edit-waist',
        thigh_left: 'edit-thigh_left',
        thigh_right: 'edit-thigh_right',
        face: 'edit-face',
        neck: 'edit-neck',
        notes: 'edit-measurement-notes'
    });

    fetchData();
});
