// Table rendering functions for different data types

function populateTable(logs, allLogs, modal, setupEditButton, setupDeleteButton) {
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

    setupEditButton('.edit-btn', allLogs, 'edit-log-id', modal, {
        weight: 'edit-weight',
        body_fat: 'edit-body_fat',
        muscle: 'edit-muscle',
        visceral_fat: 'edit-visceral_fat',
        sleep: 'edit-sleep',
        notes: 'edit-notes'
    });

    setupDeleteButton('.delete-btn', '/api/logs', 'log');
}

function populateJabsTable(jabs, allJabs, jabModal, setupEditButton, setupDeleteButton) {
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

    setupEditButton('.edit-jab-btn', allJabs, 'edit-jab-id', jabModal, {
        dose: 'edit-jab-dose',
        notes: 'edit-jab-notes'
    });

    setupDeleteButton('.delete-jab-btn', '/api/jabs', 'jab');
}

function populateMeasurementsTable(measurements, allMeasurements, measurementModal, setupEditButton, setupDeleteButton) {
    const tableBody = document.querySelector('#measurementsTable tbody');
    tableBody.innerHTML = ''; // Clear existing data

    measurements.forEach(measurement => {
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${measurement.date}</td>
            <td>${measurement.time.substring(0, 5)}</td>
            <td>${measurement.upper_arm_left || '-'}</td>
            <td>${measurement.upper_arm_right || '-'}</td>
            <td>${measurement.chest || '-'}</td>
            <td>${measurement.waist || '-'}</td>
            <td>${measurement.thigh_left || '-'}</td>
            <td>${measurement.thigh_right || '-'}</td>
            <td>${measurement.face || '-'}</td>
            <td>${measurement.neck || '-'}</td>
            <td>${measurement.notes || '-'}</td>
            <td>
                <button class="edit-measurement-btn" data-id="${measurement.id}">Edit</button>
                <button class="delete-measurement-btn" data-id="${measurement.id}">Delete</button>
            </td>
        `;
    });

    setupEditButton('.edit-measurement-btn', allMeasurements, 'edit-measurement-id', measurementModal, {
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

    setupDeleteButton('.delete-measurement-btn', '/api/body-measurements', 'measurement');
}
