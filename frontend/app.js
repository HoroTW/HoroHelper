document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracker-form');
    const messageEl = document.getElementById('message');
    const dateInput = document.getElementById('current-date');
    const timeInput = document.getElementById('current-time');
    const submitBtn = document.getElementById('submit-btn');
    const healthFields = document.getElementById('health-fields');
    const jabFields = document.getElementById('jab-fields');
    const measurementFields = document.getElementById('measurement-fields');
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const ITEM_HEIGHT = 20; // Corresponds to .roller-item height in CSS
    const ROLLER_HEIGHT = 55; // Corresponds to .roller height in CSS

    let currentMode = 'health'; // 'health', 'jab', or 'measurements'

    function setCurrentDateTime() {
        const now = new Date();
        dateInput.value = now.toISOString().split('T')[0];
        timeInput.value = now.toTimeString().split(' ')[0].substring(0, 5);
    }

    function switchMode(mode) {
        currentMode = mode;
        
        // Update button states
        modeButtons.forEach(btn => {
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Hide all field groups
        healthFields.style.display = 'none';
        jabFields.style.display = 'none';
        measurementFields.style.display = 'none';
        
        // Show appropriate fields and update button text
        if (mode === 'health') {
            healthFields.style.display = 'block';
            submitBtn.textContent = 'Save Log';
        } else if (mode === 'jab') {
            jabFields.style.display = 'block';
            submitBtn.textContent = 'Save Jab';
        } else if (mode === 'measurements') {
            measurementFields.style.display = 'block';
            submitBtn.textContent = 'Save Measurements';
        }
    }

    // Add click listeners to mode buttons
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchMode(btn.dataset.mode);
        });
    });

    function setupRollers() {
        document.querySelectorAll('.roller').forEach(roller => {
            const min = parseInt(roller.dataset.min, 10);
            const max = parseInt(roller.dataset.max, 10);
            let value = parseInt(roller.dataset.value, 10);

            const content = document.createElement('div');
            content.className = 'roller-content';
            roller.appendChild(content);

            for (let i = min; i <= max; i++) {
                const item = document.createElement('div');
                item.className = 'roller-item';
                item.textContent = i;
                content.appendChild(item);
            }

            function snapToValue(val, animate = true) {
                const index = val - min;
                const targetY = -(index * ITEM_HEIGHT);
                
                content.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
                content.style.transform = `translateY(${targetY}px)`;

                roller.dataset.value = val;

                // Update active class
                content.querySelectorAll('.roller-item').forEach((item, idx) => {
                    item.classList.toggle('active', idx === index);
                });
            }

            let isDragging = false;
            let startY;
            let startTransformY;

            function onStart(e) {
                isDragging = true;
                startY = e.pageY || e.touches[0].pageY;
                startTransformY = parseFloat(content.style.transform.replace('translateY(', '')) || 0;
                content.style.transition = 'none';
                roller.style.cursor = 'grabbing';
            }

            function onMove(e) {
                if (!isDragging) return;
                e.preventDefault();
                const currentY = e.pageY || e.touches[0].pageY;
                const deltaY = currentY - startY;
                let newY = startTransformY + deltaY;

                // Clamp dragging
                const maxTranslateY = 0;
                const minTranslateY = -((max - min) * ITEM_HEIGHT);
                newY = Math.max(minTranslateY, Math.min(maxTranslateY, newY));

                content.style.transform = `translateY(${newY}px)`;
            }

            function onEnd() {
                if (!isDragging) return;
                isDragging = false;
                roller.style.cursor = 'grab';

                const currentTransformY = parseFloat(content.style.transform.replace('translateY(', '')) || 0;
                const closestIndex = Math.round(-currentTransformY / ITEM_HEIGHT);
                const newValue = min + closestIndex;
                
                snapToValue(newValue);
            }

            roller.addEventListener('mousedown', onStart);
            roller.addEventListener('touchstart', onStart, { passive: false });

            window.addEventListener('mousemove', onMove);
            window.addEventListener('touchmove', onMove, { passive: false });

            window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchend', onEnd);
            
            // Initial setup - use constant ROLLER_HEIGHT instead of clientHeight
            // to avoid issues when parent has display:none
            const initialOffset = (ROLLER_HEIGHT - ITEM_HEIGHT) / 2;
            content.style.paddingTop = `${initialOffset}px`;
            content.style.paddingBottom = `${initialOffset}px`;
            snapToValue(value, false);
        });
    }

    // Helper function to set compound roller values (decimal fields)
    function setCompoundRollerValue(field, value) {
        if (value === null || value === undefined) return;
        const [intPart, decPart = '0'] = value.toString().split('.');
        const intRoller = document.querySelector(`.compound-roller[data-field="${field}"] .roller[data-part="int"]`);
        const decRoller = document.querySelector(`.compound-roller[data-field="${field}"] .roller[data-part="dec"]`);
        if (intRoller) intRoller.dispatchEvent(new CustomEvent('setValue', { detail: parseInt(intPart, 10) }));
        if (decRoller) decRoller.dispatchEvent(new CustomEvent('setValue', { detail: parseInt(decPart, 10) }));
    }

    // Helper function to set single roller values (integer fields)
    function setSingleRollerValue(field, value) {
        if (value === null || value === undefined) return;
        const roller = document.querySelector(`.roller[data-field="${field}"]`);
        if (roller) roller.dispatchEvent(new CustomEvent('setValue', { detail: value }));
    }

    // Helper function to populate form fields from data object
    function populateFields(data, fields) {
        fields.forEach(field => {
            if (field.type === 'compound') {
                setCompoundRollerValue(field.name, data[field.name]);
            } else if (field.type === 'single') {
                setSingleRollerValue(field.name, data[field.name]);
            }
        });
    }

    setCurrentDateTime();
    setupRollers();
    switchMode('health'); // Initialize mode display

    // Fetch all last entries to pre-fill the forms
    Promise.all([
        fetch(`${apiUrl}/api/logs/last`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch(`${apiUrl}/api/jabs/last`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch(`${apiUrl}/api/body-measurements/last`, { credentials: 'include' }).then(r => r.ok ? r.json() : null)
    ])
    .then(([lastLog, lastJab, lastMeasurement]) => {
        // Populate health log fields
        if (lastLog) {
            populateFields(lastLog, [
                { name: 'weight', type: 'compound' },
                { name: 'body_fat', type: 'compound' },
                { name: 'muscle', type: 'compound' },
                { name: 'sleep', type: 'compound' },
                { name: 'visceral_fat', type: 'single' }
            ]);
        }

        // Populate jab fields
        if (lastJab) {
            populateFields(lastJab, [
                { name: 'dose', type: 'compound' }
            ]);
        }

        // Populate body measurement fields
        if (lastMeasurement) {
            populateFields(lastMeasurement, [
                { name: 'upper_arm_left', type: 'compound' },
                { name: 'upper_arm_right', type: 'compound' },
                { name: 'chest', type: 'compound' },
                { name: 'waist', type: 'compound' },
                { name: 'thigh_left', type: 'compound' },
                { name: 'thigh_right', type: 'compound' },
                { name: 'face', type: 'compound' },
                { name: 'neck', type: 'compound' }
            ]);
        }
    })
    .catch(error => console.info('Error loading previous data:', error.message));

    // Helper function to collect compound roller values
    function getCompoundRollerValues(selector) {
        const data = {};
        document.querySelectorAll(selector).forEach(container => {
            const field = container.dataset.field;
            const intVal = container.querySelector('.roller[data-part="int"]').dataset.value;
            const decVal = container.querySelector('.roller[data-part="dec"]').dataset.value;
            data[field] = `${intVal}.${decVal}`;
        });
        return data;
    }

    // Handle form submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        messageEl.textContent = '';

        let data = {};
        
        if (currentMode === 'health') {
            data = getCompoundRollerValues('#health-fields .compound-roller');
            const visceralFatRoller = document.querySelector('.roller[data-field="visceral_fat"]');
            if (visceralFatRoller) {
                data.visceral_fat = visceralFatRoller.dataset.value;
            }
        } else if (currentMode === 'jab') {
            data = getCompoundRollerValues('#jab-fields .compound-roller');
        } else if (currentMode === 'measurements') {
            data = getCompoundRollerValues('#measurement-fields .compound-roller');
        }
        
        data.notes = document.getElementById('notes').value;
        data.date = dateInput.value;
        data.time = timeInput.value;

        for (const key in data) {
            if (data[key] === '' || data[key] === 'undefined.undefined') {
                data[key] = null;
            }
        }

        const endpoints = {
            health: '/api/logs',
            jab: '/api/jabs',
            measurements: '/api/body-measurements'
        };
        
        const successMessages = {
            health: 'Log saved successfully!',
            jab: 'Jab saved successfully!',
            measurements: 'Body measurements saved successfully!'
        };

        fetch(`${apiUrl}${endpoints[currentMode]}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',  // Include cookies for authentication
            body: JSON.stringify(data),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok.');
            return response.json();
        })
        .then(savedData => {
            messageEl.textContent = successMessages[currentMode];
            messageEl.style.color = 'green';
            console.log('Success:', savedData);
        })
        .catch(error => {
            messageEl.textContent = `Failed to save ${currentMode}.`;
            messageEl.style.color = 'red';
            console.error('Error:', error);
        });
    });

    // Custom event to set roller value externally
    document.querySelectorAll('.roller').forEach(roller => {
        roller.addEventListener('setValue', e => {
            const min = parseInt(roller.dataset.min, 10);
            const content = roller.querySelector('.roller-content');
            const index = e.detail - min;
            const targetY = -(index * ITEM_HEIGHT);
            content.style.transition = 'none';
            content.style.transform = `translateY(${targetY}px)`;
            roller.dataset.value = e.detail;
            content.querySelectorAll('.roller-item').forEach((item, idx) => {
                item.classList.toggle('active', idx === index);
            });
        });
    });
});
