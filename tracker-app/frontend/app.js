document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracker-form');
    const messageEl = document.getElementById('message');
    
    // Set API URL based on hostname or if it's a local file
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    function setupSpinners() {
        document.querySelectorAll('.number-picker').forEach(picker => {
            const minusBtn = picker.querySelector('.spinner-btn.minus');
            const plusBtn = picker.querySelector('.spinner-btn.plus');
            const valueEl = picker.querySelector('.spinner-value');
            const min = parseInt(valueEl.getAttribute('min'), 10);
            const max = parseInt(valueEl.getAttribute('max'), 10);

            minusBtn.addEventListener('click', () => {
                let currentValue = parseInt(valueEl.value, 10);
                if (currentValue > min) {
                    valueEl.value = currentValue - 1;
                }
            });

            plusBtn.addEventListener('click', () => {
                let currentValue = parseInt(valueEl.value, 10);
                if (currentValue < max) {
                    valueEl.value = currentValue + 1;
                }
            });
        });
    }

    setupSpinners();

    // Fetch the last log to pre-fill the form
    fetch(`${apiUrl}/api/logs/last`)
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('No previous logs.');
        })
        .then(data => {
            // Pre-fill logic for spinners
            ['weight', 'body_fat', 'muscle', 'sleep'].forEach(field => {
                if (data[field] !== null) {
                    const [intPart, decPart] = data[field].toString().split('.');
                    const container = document.querySelector(`.compound-spinner[data-field="${field}"]`);
                    if (container) {
                        container.querySelector('[data-part="int"]').value = intPart || '0';
                        container.querySelector('[data-part="dec"]').value = decPart || '0';
                    }
                }
            });
            if (data.visceral_fat !== null) {
                const container = document.querySelector(`.number-picker[data-field="visceral_fat"]`);
                if (container) {
                    container.querySelector('[data-part="int"]').value = data.visceral_fat;
                }
            }
        })
        .catch(error => {
            console.info(error.message); // Info, not an error if no logs exist yet
        });

    // Handle form submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        messageEl.textContent = '';

        const data = {};
        // Gather data from spinners
        document.querySelectorAll('.compound-spinner').forEach(container => {
            const field = container.dataset.field;
            const intVal = container.querySelector('[data-part="int"]').value;
            const decVal = container.querySelector('[data-part="dec"]').value;
            data[field] = `${intVal}.${decVal}`;
        });
        const visceralFatContainer = document.querySelector('.number-picker[data-field="visceral_fat"]');
        if (visceralFatContainer) {
            data.visceral_fat = visceralFatContainer.querySelector('[data-part="int"]').value;
        }
        data.notes = document.getElementById('notes').value;

        // Convert empty strings to null
        for (const key in data) {
            if (data[key] === '') {
                data[key] = null;
            }
        }

        fetch(`${apiUrl}/api/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Network response was not ok.');
        })
        .then(savedData => {
            messageEl.textContent = 'Log saved successfully!';
            messageEl.style.color = 'green';
            console.log('Success:', savedData);
        })
        .catch(error => {
            messageEl.textContent = 'Failed to save log.';
            messageEl.style.color = 'red';
            console.error('Error:', error);
        });
    });
});
