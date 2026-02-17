// Storage management using IndexedDB
class MedTrackStorage {
    constructor() {
        this.dbName = 'MedTrackDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('people')) {
                    db.createObjectStore('people', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('medications')) {
                    db.createObjectStore('medications', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
            };
        });
    }

    async getPeople() {
        return this.getAll('people');
    }

    async getMedications() {
        return this.getAll('medications');
    }

    async addPerson(person) {
        return this.add('people', person);
    }

    async addMedication(medication) {
        return this.add('medications', medication);
    }

    async deletePerson(id) {
        await this.delete('people', id);
        // Also delete all medications for this person
        const medications = await this.getMedications();
        for (const med of medications) {
            if (med.personId === id) {
                await this.delete('medications', med.id);
            }
        }
    }

    async deleteMedication(id) {
        return this.delete('medications', id);
    }

    async exportData() {
        const people = await this.getPeople();
        const medications = await this.getMedications();
        return { people, medications };
    }

    async getSettings() {
        return this.getAll('settings');
    }

    async saveSetting(key, value) {
        return this.add('settings', { id: key, value });
    }

    async updateSetting(key, value) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction('settings', 'readwrite');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ id: key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        const transaction = this.db.transaction('settings', 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllData() {
        await this.clearAll('people');
        await this.clearAll('medications');
    }

    async importData(data) {
        // Clear existing data
        await this.clearAll('people');
        await this.clearAll('medications');

        // Import new data
        for (const person of data.people) {
            await this.addPerson(person);
        }
        for (const medication of data.medications) {
            await this.addMedication(medication);
        }
    }

    getAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    add(storeName, data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    delete(storeName, id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    clearAll(storeName) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// OCR Handler
class OCRHandler {
    constructor(statusElement) {
        this.statusElement = statusElement;
    }

    async processImage(file) {
        this.showStatus('processing', 'Reading medication label...');

        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        this.showStatus('processing', `Processing... ${progress}%`);
                    }
                }
            });

            const result = this.extractMedicationInfo(text);
            
            if (result.name || result.dosage) {
                this.showStatus('success', 'Successfully scanned! Review the information below.');
                return result;
            } else {
                this.showStatus('error', 'Could not detect medication information. Please enter manually.');
                return {};
            }
        } catch (error) {
            this.showStatus('error', 'Error scanning image. Please try again or enter manually.');
            return {};
        }
    }

    extractMedicationInfo(text) {
        const result = {};

        // Common medication name patterns
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Look for dosage patterns (e.g., "10mg", "20 mg", "500mg")
        const dosagePattern = /(\d+\.?\d*)\s*(mg|mcg|g|ml|units?)/i;
        for (const line of lines) {
            const match = line.match(dosagePattern);
            if (match) {
                result.dosage = match[0];
                break;
            }
        }

        // Try to find medication name (usually in first few lines, capitalized)
        for (const line of lines) {
            // Skip common label words
            if (line.match(/^(rx|take|medication|drug|warning|prescription|caution|may|use)/i)) {
                continue;
            }
            // Look for capitalized words that might be medication names
            if (line.match(/^[A-Z][a-zA-Z]+/) && line.length > 3 && line.length < 30) {
                result.name = line;
                break;
            }
        }

        return result;
    }

    showStatus(type, message) {
        this.statusElement.className = `ocr-status show ${type}`;
        this.statusElement.textContent = message;

        if (type !== 'processing') {
            setTimeout(() => {
                this.statusElement.classList.remove('show');
            }, 5000);
        }
    }
}

// Notification Manager
class NotificationManager {
    constructor() {
        this.hasPermission = false;
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.hasPermission = true;
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.hasPermission = permission === 'granted';
            return this.hasPermission;
        }

        return false;
    }

    scheduleReminder(medication, person) {
        if (!this.hasPermission) {
            return;
        }

        // Note: For a production app, you'd use Service Workers for persistent notifications
        // This is a simplified version using Web Notifications API
        medication.times.forEach(time => {
            const [hours, minutes] = time.split(':').map(Number);
            const now = new Date();
            const scheduledTime = new Date();
            scheduledTime.setHours(hours, minutes, 0, 0);

            if (scheduledTime <= now) {
                scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            const timeUntilNotification = scheduledTime.getTime() - now.getTime();

            setTimeout(() => {
                new Notification(`Time to take ${medication.name}`, {
                    body: `${person.name} - ${medication.dosage}`,
                    icon: '/icon.png',
                    tag: medication.id
                });
            }, timeUntilNotification);
        });
    }
}

// Main App
class MedTrackApp {
    constructor() {
        this.storage = new MedTrackStorage();
        this.notifications = new NotificationManager();
        this.currentPersonId = null;
        this.people = [];
        this.medications = [];
    }

    async init() {
        await this.storage.init();
        await this.notifications.requestPermission();
        
        this.cacheDOMElements();
        this.attachEventListeners();
        await this.loadData();
        this.render();
    }

    cacheDOMElements() {
        this.personPills = document.getElementById('personPills');
        this.medicationsList = document.getElementById('medicationsList');
        this.emptyState = document.getElementById('emptyState');
        this.addMedicationModal = document.getElementById('addMedicationModal');
        this.addPersonModal = document.getElementById('addPersonModal');
        this.importModal = document.getElementById('importModal');
        this.settingsModal = document.getElementById('settingsModal');
        this.welcomeModal = document.getElementById('welcomeModal');
        this.medicationForm = document.getElementById('medicationForm');
        this.personForm = document.getElementById('personForm');
        this.timeInputsContainer = document.getElementById('timeInputs');
        this.frequencySelect = document.getElementById('medFrequency');
    }

    attachEventListeners() {
        // Welcome Modal
        document.getElementById('getStartedBtn').addEventListener('click', async () => {
            await this.storage.updateSetting('hasSeenWelcome', true);
            this.closeModal(this.welcomeModal);
        });

        // Settings Button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.getElementById('closeSettingsModal').addEventListener('click', () => {
            this.closeModal(this.settingsModal);
        });

        // Settings actions
        document.getElementById('exportFromSettings').addEventListener('click', () => {
            this.handleExport();
        });

        document.getElementById('importFromSettings').addEventListener('click', () => {
            this.closeModal(this.settingsModal);
            this.openModal(this.importModal);
        });

        document.getElementById('backupReminderToggle').addEventListener('change', async (e) => {
            await this.storage.updateSetting('backupReminder', e.target.checked);
            if (e.target.checked) {
                await this.storage.updateSetting('lastBackupReminder', Date.now());
            }
        });

        document.getElementById('requestNotifications').addEventListener('click', async () => {
            const granted = await this.notifications.requestPermission();
            this.updateNotificationStatus();
            if (granted) {
                alert('Notifications enabled! You will receive medication reminders.');
            }
        });

        document.getElementById('resetAppBtn').addEventListener('click', () => {
            this.handleResetApp();
        });

        // FAB
        document.getElementById('fabBtn').addEventListener('click', () => {
            if (!this.currentPersonId) {
                alert('Please add a person first');
                this.openModal(this.addPersonModal);
            } else {
                this.openModal(this.addMedicationModal);
            }
        });

        // Add Person Button
        document.getElementById('addPersonBtn').addEventListener('click', () => {
            this.openModal(this.addPersonModal);
        });

        // Person Form
        this.personForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddPerson();
        });

        document.getElementById('cancelPersonBtn').addEventListener('click', () => {
            this.closeModal(this.addPersonModal);
        });

        document.getElementById('closePersonModal').addEventListener('click', () => {
            this.closeModal(this.addPersonModal);
        });

        // Medication Form
        this.medicationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddMedication();
        });

        document.getElementById('cancelMedicationBtn').addEventListener('click', () => {
            this.closeModal(this.addMedicationModal);
        });

        document.getElementById('closeMedicationModal').addEventListener('click', () => {
            this.closeModal(this.addMedicationModal);
        });

        // Frequency change updates time inputs
        this.frequencySelect.addEventListener('change', () => {
            this.updateTimeInputs();
        });

        // Camera
        const cameraBtn = document.getElementById('cameraBtn');
        const cameraInput = document.getElementById('cameraInput');
        
        cameraBtn.addEventListener('click', () => {
            cameraInput.click();
        });

        cameraInput.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (file) {
                const ocrStatus = document.getElementById('ocrStatus');
                const ocr = new OCRHandler(ocrStatus);
                const result = await ocr.processImage(file);

                if (result.name) {
                    document.getElementById('medName').value = result.name;
                }
                if (result.dosage) {
                    document.getElementById('medDosage').value = result.dosage;
                }
            }
        });

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.handleExport();
        });

        // Import - show import modal on long press
        let pressTimer;
        document.getElementById('exportBtn').addEventListener('mousedown', () => {
            pressTimer = setTimeout(() => {
                this.openModal(this.importModal);
            }, 1000);
        });

        document.getElementById('exportBtn').addEventListener('mouseup', () => {
            clearTimeout(pressTimer);
        });

        document.getElementById('exportBtn').addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });

        document.getElementById('confirmImportBtn').addEventListener('click', () => {
            this.handleImport();
        });

        document.getElementById('cancelImportBtn').addEventListener('click', () => {
            this.closeModal(this.importModal);
        });

        document.getElementById('closeImportModal').addEventListener('click', () => {
            this.closeModal(this.importModal);
        });

        // Close modals on background click
        [this.addMedicationModal, this.addPersonModal, this.importModal, this.settingsModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }

    async loadData() {
        this.people = await this.storage.getPeople();
        this.medications = await this.storage.getMedications();

        // Check if user has seen welcome modal
        const hasSeenWelcome = await this.storage.getSetting('hasSeenWelcome');
        if (hasSeenWelcome) {
            this.closeModal(this.welcomeModal);
        }

        // Check backup reminder
        this.checkBackupReminder();

        // Create default person if none exist
        if (this.people.length === 0) {
            const defaultPerson = {
                id: this.generateId(),
                name: 'Me'
            };
            await this.storage.addPerson(defaultPerson);
            this.people.push(defaultPerson);
        }

        // Set current person to first person
        if (this.people.length > 0) {
            this.currentPersonId = this.people[0].id;
        }
    }

    render() {
        this.renderPeople();
        this.renderMedications();
    }

    renderPeople() {
        this.personPills.innerHTML = '';

        this.people.forEach(person => {
            const medCount = this.medications.filter(m => m.personId === person.id).length;
            
            const pill = document.createElement('div');
            pill.className = `person-pill ${person.id === this.currentPersonId ? 'active' : ''}`;
            
            pill.innerHTML = `
                <span>${person.name}</span>
                ${medCount > 0 ? `<span class="badge">${medCount}</span>` : ''}
                ${this.people.length > 1 ? `
                    <button class="btn-delete-person" data-person-id="${person.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                ` : ''}
            `;

            pill.addEventListener('click', (e) => {
                // Don't switch person if clicking delete button
                if (e.target.closest('.btn-delete-person')) {
                    return;
                }
                this.currentPersonId = person.id;
                this.render();
            });

            const deleteBtn = pill.querySelector('.btn-delete-person');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Delete ${person.name} and all their medications?`)) {
                        await this.storage.deletePerson(person.id);
                        this.people = this.people.filter(p => p.id !== person.id);
                        if (this.currentPersonId === person.id) {
                            this.currentPersonId = this.people[0]?.id || null;
                        }
                        this.medications = await this.storage.getMedications();
                        this.render();
                    }
                });
            }

            this.personPills.appendChild(pill);
        });
    }

    renderMedications() {
        const currentMeds = this.medications.filter(m => m.personId === this.currentPersonId);

        if (currentMeds.length === 0) {
            this.emptyState.classList.add('show');
            this.medicationsList.innerHTML = '';
            return;
        }

        this.emptyState.classList.remove('show');
        this.medicationsList.innerHTML = '';

        currentMeds.forEach(med => {
            const card = document.createElement('div');
            card.className = 'medication-card';

            const frequencyText = this.getFrequencyText(med.frequency);

            card.innerHTML = `
                <div class="medication-header">
                    <div class="medication-info">
                        <h3>${med.name}</h3>
                        <div class="medication-dosage">${med.dosage} • ${frequencyText}</div>
                    </div>
                    <div class="medication-actions">
                        <button class="btn-med-action delete" data-med-id="${med.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${med.times.length > 0 && med.frequency !== 'asneeded' ? `
                    <div class="medication-schedule">
                        ${med.times.map(time => `
                            <div class="schedule-time">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                ${this.formatTime(time)}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${med.notes ? `
                    <div class="medication-notes">${med.notes}</div>
                ` : ''}
            `;

            const deleteBtn = card.querySelector('.btn-med-action.delete');
            deleteBtn?.addEventListener('click', async () => {
                if (confirm(`Delete ${med.name}?`)) {
                    await this.storage.deleteMedication(med.id);
                    this.medications = this.medications.filter(m => m.id !== med.id);
                    this.render();
                }
            });

            this.medicationsList.appendChild(card);
        });
    }

    updateTimeInputs() {
        const frequency = this.frequencySelect.value;
        let count = 0;

        switch (frequency) {
            case 'once': count = 1; break;
            case 'twice': count = 2; break;
            case 'three': count = 3; break;
            case 'four': count = 4; break;
            case 'asneeded': count = 0; break;
        }

        this.timeInputsContainer.innerHTML = '';

        if (count === 0) {
            const container = document.getElementById('timesContainer');
            container.style.display = 'none';
            return;
        }

        const container = document.getElementById('timesContainer');
        container.style.display = 'block';

        for (let i = 0; i < count; i++) {
            const row = document.createElement('div');
            row.className = 'time-input-row';

            const defaultTime = this.getDefaultTime(i, count);

            row.innerHTML = `
                <input type="time" value="${defaultTime}" required>
                ${count > 1 ? `
                    <button type="button" class="btn-remove-time">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                ` : ''}
            `;

            const removeBtn = row.querySelector('.btn-remove-time');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    row.remove();
                });
            }

            this.timeInputsContainer.appendChild(row);
        }
    }

    getDefaultTime(index, total) {
        const defaults = {
            1: ['08:00'],
            2: ['08:00', '20:00'],
            3: ['08:00', '14:00', '20:00'],
            4: ['08:00', '12:00', '17:00', '21:00']
        };

        return defaults[total]?.[index] || '08:00';
    }

    async handleAddPerson() {
        const nameInput = document.getElementById('personName');
        const name = nameInput.value.trim();

        if (!name) return;

        const person = {
            id: this.generateId(),
            name
        };

        await this.storage.addPerson(person);
        this.people.push(person);
        this.currentPersonId = person.id;

        nameInput.value = '';
        this.closeModal(this.addPersonModal);
        this.render();
    }

    async handleAddMedication() {
        if (!this.currentPersonId) return;

        const nameInput = document.getElementById('medName');
        const dosageInput = document.getElementById('medDosage');
        const notesInput = document.getElementById('medNotes');

        const times = [];
        const timeInputs = this.timeInputsContainer.querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => {
            times.push(input.value);
        });

        const medication = {
            id: this.generateId(),
            personId: this.currentPersonId,
            name: nameInput.value.trim(),
            dosage: dosageInput.value.trim(),
            frequency: this.frequencySelect.value,
            times: times,
            notes: notesInput.value.trim() || undefined
        };

        await this.storage.addMedication(medication);
        this.medications.push(medication);

        // Schedule notifications
        const person = this.people.find(p => p.id === this.currentPersonId);
        if (person) {
            this.notifications.scheduleReminder(medication, person);
        }

        this.medicationForm.reset();
        this.closeModal(this.addMedicationModal);
        this.render();
    }

    async handleExport() {
        const data = await this.storage.exportData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Generate filename with date and time
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `medtrack-backup-${dateStr}-${timeStr}.json`;
        a.click();
        
        URL.revokeObjectURL(url);

        // Update last backup time
        await this.storage.updateSetting('lastBackup', Date.now());
        await this.storage.updateSetting('lastBackupReminder', Date.now());
    }

    handleImport() {
        const fileInput = document.getElementById('importInput');
        const file = fileInput.files?.[0];

        if (!file) {
            alert('Please select a file to import');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                await this.storage.importData(data);
                
                this.people = await this.storage.getPeople();
                this.medications = await this.storage.getMedications();
                this.currentPersonId = this.people[0]?.id || null;

                this.closeModal(this.importModal);
                this.render();
                
                alert('Data imported successfully!');
            } catch (error) {
                alert('Error importing data. Please check the file format.');
            }
        };

        reader.readAsText(file);
    }

    openModal(modal) {
        modal.classList.add('show');
        if (modal === this.addMedicationModal) {
            this.updateTimeInputs();
        }
    }

    closeModal(modal) {
        modal.classList.remove('show');
        if (modal === this.addMedicationModal) {
            this.medicationForm.reset();
            const ocrStatus = document.getElementById('ocrStatus');
            ocrStatus.classList.remove('show');
        }
        if (modal === this.addPersonModal) {
            this.personForm.reset();
        }
    }

    getFrequencyText(frequency) {
        const map = {
            once: 'Once daily',
            twice: 'Twice daily',
            three: '3 times daily',
            four: '4 times daily',
            asneeded: 'As needed'
        };
        return map[frequency] || frequency;
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async openSettingsModal() {
        // Update backup reminder toggle
        const backupReminder = await this.storage.getSetting('backupReminder');
        document.getElementById('backupReminderToggle').checked = backupReminder || false;

        // Update notification status
        this.updateNotificationStatus();

        this.openModal(this.settingsModal);
    }

    updateNotificationStatus() {
        const statusEl = document.getElementById('notificationStatus');
        const btnEl = document.getElementById('requestNotifications');

        if (Notification.permission === 'granted') {
            statusEl.textContent = 'Enabled';
            statusEl.style.color = 'var(--accent-600)';
            btnEl.style.display = 'none';
        } else if (Notification.permission === 'denied') {
            statusEl.textContent = 'Blocked - Enable in browser settings';
            statusEl.style.color = 'var(--error)';
            btnEl.style.display = 'none';
        } else {
            statusEl.textContent = 'Not enabled';
            statusEl.style.color = 'var(--text-secondary)';
            btnEl.style.display = 'flex';
        }
    }

    async checkBackupReminder() {
        const backupReminderEnabled = await this.storage.getSetting('backupReminder');
        if (!backupReminderEnabled) return;

        const lastReminder = await this.storage.getSetting('lastBackupReminder');
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        if (!lastReminder || Date.now() - lastReminder > thirtyDaysInMs) {
            // Show backup reminder
            setTimeout(() => {
                if (confirm('⏰ Backup Reminder\n\nIt\'s been 30 days since your last backup. Would you like to backup your medication data now?')) {
                    this.handleExport();
                } else {
                    // Snooze for another 30 days
                    this.storage.updateSetting('lastBackupReminder', Date.now());
                }
            }, 2000); // Show after 2 seconds of app load
        }
    }

    async handleResetApp() {
        const confirmation = confirm(
            '⚠️ WARNING: Delete All Data?\n\n' +
            'This will permanently delete:\n' +
            '• All people\n' +
            '• All medications\n' +
            '• All settings\n\n' +
            'This action CANNOT be undone!\n\n' +
            'Are you sure you want to continue?'
        );

        if (!confirmation) return;

        const doubleConfirmation = confirm(
            'This is your LAST CHANCE!\n\n' +
            'Type confirmation: Are you absolutely certain you want to delete everything?'
        );

        if (!doubleConfirmation) return;

        try {
            // Clear all data
            await this.storage.clearAllData();

            // Reset app state
            this.people = [];
            this.medications = [];
            this.currentPersonId = null;

            // Create default person
            const defaultPerson = {
                id: this.generateId(),
                name: 'Me'
            };
            await this.storage.addPerson(defaultPerson);
            this.people.push(defaultPerson);
            this.currentPersonId = defaultPerson.id;

            // Close settings and render
            this.closeModal(this.settingsModal);
            this.render();

            alert('✓ All data has been deleted. Starting fresh!');
        } catch (error) {
            alert('Error resetting app: ' + error.message);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const app = new MedTrackApp();
        app.init();
    });
} else {
    const app = new MedTrackApp();
    app.init();
}

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker registration failed - not critical for basic functionality
        });
    });
}
