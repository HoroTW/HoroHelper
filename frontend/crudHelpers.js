// Generic CRUD helper functions for form and button operations

// Generic function to handle edit button clicks
function setupEditButton(buttonSelector, dataArray, idField, modal, fieldMappings) {
    document.querySelectorAll(buttonSelector).forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = e.target.dataset.id;
            const itemToEdit = dataArray.find(item => item.id == itemId);
            if (itemToEdit) {
                // Set the ID field
                document.getElementById(idField).value = itemToEdit.id;
                // Set all other fields from mappings
                Object.entries(fieldMappings).forEach(([dataKey, inputId]) => {
                    const element = document.getElementById(inputId);
                    if (element) {
                        element.value = itemToEdit[dataKey] || '';
                    }
                });
                modal.style.display = "block";
            }
        });
    });
}

// Generic function to handle delete button clicks
function setupDeleteButton(buttonSelector, apiEndpoint, entityName, apiUrl, fetchDataCallback) {
    document.querySelectorAll(buttonSelector).forEach(button => {
        button.addEventListener('click', (e) => {
            const itemId = e.target.dataset.id;
            if (confirm(`Are you sure you want to delete this ${entityName} entry?`)) {
                fetch(`${apiUrl}${apiEndpoint}/${itemId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to delete ${entityName}`);
                    }
                    fetchDataCallback(); // Refresh data on the page
                })
                .catch(error => {
                    console.error(`Error deleting ${entityName}:`, error);
                    alert(`Failed to delete ${entityName}.`);
                });
            }
        });
    });
}

// Generic function to handle form submission for updating entries
function setupFormSubmit(form, idField, modal, apiEndpoint, entityName, fieldMappings, apiUrl, fetchDataCallback) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemId = document.getElementById(idField).value;
        const updatedData = {};
        
        // Gather data from form fields
        Object.entries(fieldMappings).forEach(([dataKey, inputId]) => {
            const element = document.getElementById(inputId);
            if (element) {
                updatedData[dataKey] = element.value || null;
            }
        });

        fetch(`${apiUrl}${apiEndpoint}/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(updatedData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to update ${entityName}`);
            }
            modal.style.display = "none";
            fetchDataCallback(); // Refresh data on the page
        })
        .catch(error => {
            console.error(`Error updating ${entityName}:`, error);
            alert('Failed to save changes.');
        });
    });
}
