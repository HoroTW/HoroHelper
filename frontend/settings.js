// Settings page functionality

document.addEventListener('DOMContentLoaded', () => {
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' || window.location.protocol === 'file:';
    const apiUrl = isLocal ? 'http://127.0.0.1:8000' : '';

    const saveBtn = document.getElementById('save-settings-btn');
    const resetBtn = document.getElementById('reset-settings-btn');
    const saveMessage = document.getElementById('save-message');

    // Setting keys mapping
    const settingKeys = {
        'hide-jabs-tracker': 'hide_jabs_tracker',
        'hide-health-tracker': 'hide_health_tracker',
        'hide-body-tracker': 'hide_body_tracker',
        'hide-jabs-stats': 'hide_jabs_stats',
        'hide-health-stats': 'hide_health_stats',
        'hide-body-stats': 'hide_body_stats'
    };

    // Load settings from API
    async function loadSettings() {
        try {
            const response = await fetch(`${apiUrl}/api/settings`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to load settings');
            }

            const settings = await response.json();

            // Apply settings to checkboxes
            for (const [checkboxId, settingKey] of Object.entries(settingKeys)) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    // Setting value is stored as string "true" or "false"
                    checkbox.checked = settings[settingKey] === 'true';
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showMessage('Failed to load settings', 'error');
        }
    }

    // Save settings to API
    async function saveSettings() {
        try {
            const settings = {};

            // Gather all checkbox values
            for (const [checkboxId, settingKey] of Object.entries(settingKeys)) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    settings[settingKey] = checkbox.checked.toString();
                }
            }

            const response = await fetch(`${apiUrl}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(settings)
            });

            if (!response.ok) {
                throw new Error('Failed to save settings');
            }

            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving settings:', error);
            showMessage('Failed to save settings', 'error');
        }
    }

    // Reset settings to defaults
    async function resetSettings() {
        if (!confirm('Are you sure you want to reset all settings to defaults?')) {
            return;
        }

        try {
            const defaultSettings = {};

            // Set all to false (default: show everything)
            for (const settingKey of Object.values(settingKeys)) {
                defaultSettings[settingKey] = 'false';
            }

            const response = await fetch(`${apiUrl}/api/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(defaultSettings)
            });

            if (!response.ok) {
                throw new Error('Failed to reset settings');
            }

            // Uncheck all checkboxes
            for (const checkboxId of Object.keys(settingKeys)) {
                const checkbox = document.getElementById(checkboxId);
                if (checkbox) {
                    checkbox.checked = false;
                }
            }

            showMessage('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('Error resetting settings:', error);
            showMessage('Failed to reset settings', 'error');
        }
    }

    // Show message helper
    function showMessage(message, type) {
        saveMessage.textContent = message;
        saveMessage.className = `save-message ${type}`;
        saveMessage.style.display = 'block';

        setTimeout(() => {
            saveMessage.style.display = 'none';
        }, 5000);
    }

    // Event listeners
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);

    // Load settings on page load
    loadSettings();
});
