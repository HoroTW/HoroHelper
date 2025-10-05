// Settings utility module for reading and applying visibility settings

const SettingsUtil = {
    // Cache for settings
    _settingsCache: null,

    // Get API URL based on environment
    getApiUrl() {
        const isLocal = window.location.hostname === '127.0.0.1' || 
                       window.location.hostname === 'localhost' || 
                       window.location.protocol === 'file:';
        return isLocal ? 'http://127.0.0.1:8000' : '';
    },

    // Load settings from API
    async loadSettings() {
        if (this._settingsCache) {
            return this._settingsCache;
        }

        try {
            const response = await fetch(`${this.getApiUrl()}/api/settings`, {
                credentials: 'include'
            });

            if (!response.ok) {
                console.warn('Failed to load settings, using defaults');
                return {};
            }

            this._settingsCache = await response.json();
            return this._settingsCache;
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    },

    // Get a specific setting (returns false if not set)
    async getSetting(key) {
        const settings = await this.loadSettings();
        return settings[key] === 'true';
    },

    // Apply tracker visibility settings
    async applyTrackerVisibility() {
        const hideJabs = await this.getSetting('hide_jabs_tracker');
        const hideHealth = await this.getSetting('hide_health_tracker');
        const hideBody = await this.getSetting('hide_body_tracker');

        // Get mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');

        modeButtons.forEach(btn => {
            const mode = btn.dataset.mode;

            if (mode === 'jab' && hideJabs) {
                btn.style.display = 'none';
            } else if (mode === 'health' && hideHealth) {
                btn.style.display = 'none';
            } else if (mode === 'measurements' && hideBody) {
                btn.style.display = 'none';
            }
        });

        // If current mode is hidden, switch to first visible mode
        const activeBtn = document.querySelector('.mode-btn.active');
        if (activeBtn && activeBtn.style.display === 'none') {
            const firstVisible = document.querySelector('.mode-btn:not([style*="display: none"])');
            if (firstVisible) {
                // Trigger click on first visible mode
                firstVisible.click();
            }
        }
    },

    // Apply stats visibility settings
    async applyStatsVisibility() {
        const hideJabs = await this.getSetting('hide_jabs_stats');
        const hideHealth = await this.getSetting('hide_health_stats');
        const hideBody = await this.getSetting('hide_body_stats');

        // Hide health charts and tables
        if (hideHealth) {
            // Hide health charts
            const healthCharts = document.querySelectorAll('#weightChart, #bodyFatChart, #muscleChart, #visceralFatChart, #sleepChart');
            healthCharts.forEach(chart => {
                const container = chart.closest('.chart-container');
                if (container) container.style.display = 'none';
            });

            // Hide health logs table
            const logsSection = document.querySelector('h2:has(+ #logsTable), h2:contains("Health Logs")');
            if (logsSection) {
                logsSection.style.display = 'none';
                const logsTable = document.getElementById('logsTable');
                if (logsTable) logsTable.style.display = 'none';
            }

            // Better approach: find by adjacent table
            const logsTable = document.getElementById('logsTable');
            if (logsTable) {
                logsTable.style.display = 'none';
                // Hide the h2 before the table
                let prevElement = logsTable.previousElementSibling;
                while (prevElement && prevElement.tagName !== 'H2') {
                    prevElement = prevElement.previousElementSibling;
                }
                if (prevElement && prevElement.tagName === 'H2') {
                    prevElement.style.display = 'none';
                }
            }

            // Hide the modal
            const logsModal = document.getElementById('editModal');
            if (logsModal) logsModal.style.display = 'none';
        }

        // Hide jab tables
        if (hideJabs) {
            const jabsTable = document.getElementById('jabsTable');
            if (jabsTable) {
                jabsTable.style.display = 'none';
                // Hide the h2 before the table
                let prevElement = jabsTable.previousElementSibling;
                while (prevElement && prevElement.tagName !== 'H2') {
                    prevElement = prevElement.previousElementSibling;
                }
                if (prevElement && prevElement.tagName === 'H2') {
                    prevElement.style.display = 'none';
                }
            }

            // Hide the modal
            const jabModal = document.getElementById('editJabModal');
            if (jabModal) jabModal.style.display = 'none';
        }

        // Hide body measurement charts and tables
        if (hideBody) {
            // Hide body measurement charts section
            const bodyChartsHeading = Array.from(document.querySelectorAll('h2'))
                .find(h2 => h2.textContent.includes('Body Measurements'));
            if (bodyChartsHeading) {
                bodyChartsHeading.style.display = 'none';
            }

            const bodyCharts = document.querySelectorAll('#upperArmChart, #chestWaistChart, #thighChart, #faceNeckChart');
            bodyCharts.forEach(chart => {
                const container = chart.closest('.chart-container');
                if (container) container.style.display = 'none';
            });

            // Hide body measurements table
            const measurementsTable = document.getElementById('measurementsTable');
            if (measurementsTable) {
                measurementsTable.style.display = 'none';
                // Hide the h2 before the table
                let prevElement = measurementsTable.previousElementSibling;
                while (prevElement && prevElement.tagName !== 'H2') {
                    prevElement = prevElement.previousElementSibling;
                }
                if (prevElement && prevElement.tagName === 'H2') {
                    prevElement.style.display = 'none';
                }
            }

            // Hide the modal
            const measurementModal = document.getElementById('editMeasurementModal');
            if (measurementModal) measurementModal.style.display = 'none';
        }
    }
};

// Export for use in other scripts
window.SettingsUtil = SettingsUtil;
