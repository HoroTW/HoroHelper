document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('tracker-form');
    const messageEl = document.getElementById('message');
    
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const ITEM_HEIGHT = 20; // Corresponds to .roller-item height in CSS

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
            
            // Initial setup
            const initialOffset = (roller.clientHeight - ITEM_HEIGHT) / 2;
            content.style.paddingTop = `${initialOffset}px`;
            content.style.paddingBottom = `${initialOffset}px`;
            snapToValue(value, false);
        });
    }

    setupRollers();

    // Fetch the last log to pre-fill the form
    fetch(`${apiUrl}/api/logs/last`)
        .then(response => {
            if (response.ok) return response.json();
            throw new Error('No previous logs.');
        })
        .then(data => {
            ['weight', 'body_fat', 'muscle', 'sleep'].forEach(field => {
                if (data[field] !== null && data[field] !== undefined) {
                    const [intPart, decPart] = data[field].toString().split('.');
                    const intRoller = document.querySelector(`.compound-roller[data-field="${field}"] .roller[data-part="int"]`);
                    const decRoller = document.querySelector(`.compound-roller[data-field="${field}"] .roller[data-part="dec"]`);
                    if (intRoller) intRoller.dispatchEvent(new CustomEvent('setValue', { detail: parseInt(intPart, 10) }));
                    if (decRoller) decRoller.dispatchEvent(new CustomEvent('setValue', { detail: parseInt(decPart, 10) }));
                }
            });
            if (data.visceral_fat !== null && data.visceral_fat !== undefined) {
                const roller = document.querySelector(`.roller[data-field="visceral_fat"]`);
                if (roller) roller.dispatchEvent(new CustomEvent('setValue', { detail: data.visceral_fat }));
            }
        })
        .catch(error => console.info(error.message));

    // Handle form submission
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        messageEl.textContent = '';

        const data = {};
        document.querySelectorAll('.compound-roller').forEach(container => {
            const field = container.dataset.field;
            const intVal = container.querySelector('.roller[data-part="int"]').dataset.value;
            const decVal = container.querySelector('.roller[data-part="dec"]').dataset.value;
            data[field] = `${intVal}.${decVal}`;
        });
        const visceralFatRoller = document.querySelector('.roller[data-field="visceral_fat"]');
        if (visceralFatRoller) {
            data.visceral_fat = visceralFatRoller.dataset.value;
        }
        data.notes = document.getElementById('notes').value;

        for (const key in data) {
            if (data[key] === '' || data[key] === 'undefined.undefined') {
                data[key] = null;
            }
        }

        fetch(`${apiUrl}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok.');
            return response.json();
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
