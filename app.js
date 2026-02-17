// Storage management using IndexedDB
class MedTrackStorage {
    constructor() {
        this.dbName = 'MedTrackDB';
        this.version = 2;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            console.log('Initializing MedTrack database, version:', this.version);
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database initialization error:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database initialized successfully');
                console.log('Available stores:', Array.from(this.db.objectStoreNames));
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('Database upgrade needed from version', event.oldVersion, 'to', event.newVersion);
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('people')) {
                    console.log('Creating people store');
                    db.createObjectStore('people', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('medications')) {
                    console.log('Creating medications store');
                    db.createObjectStore('medications', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    console.log('Creating settings store');
                    db.createObjectStore('settings', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('doseLogs')) {
                    console.log('Creating doseLogs store');
                    db.createObjectStore('doseLogs', { keyPath: 'id' });
                }
                
                console.log('Database upgrade complete');
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

    async updateMedication(medication) {
        return new Promise((resolve, reject) => {
            if (!this.db) { reject(new Error('Database not initialized')); return; }
            const transaction = this.db.transaction('medications', 'readwrite');
            const store = transaction.objectStore('medications');
            const request = store.put(medication);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async exportData() {
        const people = await this.getPeople();
        const medications = await this.getMedications();
        const doseLogs = await this.getDoseLogs();
        return { people, medications, doseLogs };
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
        await this.clearAll('doseLogs');
    }

    async getDoseLogs() {
        try {
            const logs = await this.getAll('doseLogs');
            console.log('Retrieved dose logs:', logs.length);
            return logs;
        } catch (error) {
            console.error('Error getting dose logs:', error);
            return [];
        }
    }

    async addDoseLog(doseLog) {
        try {
            console.log('Adding dose log:', doseLog);
            const result = await this.add('doseLogs', doseLog);
            console.log('Dose log added successfully');
            return result;
        } catch (error) {
            console.error('Error adding dose log:', error);
            throw error;
        }
    }

    async deleteDoseLog(id) {
        return this.delete('doseLogs', id);
    }

    async getLogsForMedication(medicationId) {
        const allLogs = await this.getDoseLogs();
        return allLogs.filter(log => log.medicationId === medicationId);
    }

    async getLogsForDate(date) {
        const allLogs = await this.getDoseLogs();
        const dateStr = new Date(date).toDateString();
        return allLogs.filter(log => new Date(log.timestamp).toDateString() === dateStr);
    }

    async importData(data) {
        // Clear existing data
        await this.clearAll('people');
        await this.clearAll('medications');
        await this.clearAll('doseLogs');

        // Import new data
        for (const person of data.people) {
            await this.addPerson(person);
        }
        for (const medication of data.medications) {
            await this.addMedication(medication);
        }
        if (data.doseLogs) {
            for (const log of data.doseLogs) {
                await this.addDoseLog(log);
            }
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

// Notification Manager
class ReminderManager {
    // Check if Web Share API is available (works on iOS Safari, Chrome Android, etc.)
    canShare() {
        return navigator.share !== undefined;
    }

    // Detect iOS
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    // Share a single medication schedule to the system share sheet
    async shareMedication(medication, person) {
        const times = medication.times.map(t => this.formatTime(t)).join(', ');
        const personLabel = person && person.name !== 'Me' ? ` for ${person.name}` : '';
        const scheduleLabel = medication.frequency !== 'asneeded'
            ? `\nSchedule: ${this.getRecurrenceText(medication)}\nAt: ${times}`
            : '';

        let text;
        if (medication.frequency === 'asneeded') {
            text = `💊 ${medication.name} ${medication.dosage}${personLabel}\nTake as needed${medication.notes ? '\n' + medication.notes : ''}`;
        } else {
            text = `💊 ${medication.name} ${medication.dosage}${personLabel}${scheduleLabel}${medication.notes ? '\n' + medication.notes : ''}`;
        }

        if (this.canShare()) {
            try {
                await navigator.share({ title: `Reminder: ${medication.name}`, text });
                return { success: true };
            } catch (err) {
                if (err.name !== 'AbortError') {
                    return { success: false, error: err.message };
                }
                return { success: false, cancelled: true };
            }
        } else {
            // Fallback: return text for manual copy
            return { success: false, text, noShareAPI: true };
        }
    }

    // Share ALL medications for a person at once
    async shareAllMedications(medications, person) {
        const personLabel = person.name !== 'Me' ? ` for ${person.name}` : '';
        const lines = medications.map(med => {
            if (med.frequency === 'asneeded') {
                return `• ${med.name} ${med.dosage} – as needed`;
            }
            const times = med.times.map(t => this.formatTime(t)).join(', ');
            const schedule = this.getRecurrenceText(med);
            return `• ${med.name} ${med.dosage} – ${schedule} at ${times}`;
        });

        const text = `💊 Medication Reminders${personLabel}\n\n${lines.join('\n')}`;

        if (this.canShare()) {
            try {
                await navigator.share({ title: `Medication Reminders`, text });
                return { success: true };
            } catch (err) {
                if (err.name !== 'AbortError') {
                    return { success: false, error: err.message };
                }
                return { success: false, cancelled: true };
            }
        } else {
            return { success: false, text, noShareAPI: true };
        }
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
}

// Main App
class MedTrackApp {
    constructor() {
        this.storage = new MedTrackStorage();
        this.reminders = new ReminderManager();
        this.currentPersonId = null;
        this.people = [];
        this.medications = [];
        this.doseLogs = [];
    }

    async init() {
        await this.storage.init();
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
        this.backupHelpModal = document.getElementById('backupHelpModal');
        this.medicationForm = document.getElementById('medicationForm');
        this.personForm = document.getElementById('personForm');
        this.timeInputsContainer = document.getElementById('timeInputs');
    }

    attachEventListeners() {
        // Null-safe helper — silently skips if the element doesn't exist
        // (guards against stale cached HTML serving against newer JS)
        const on = (id, event, fn, opts) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener(event, fn, opts);
            else console.warn(`[MedTrack] element #${id} not found — skipping listener`);
        };

        // Welcome Modal
        on('getStartedBtn', 'click', async () => {
            await this.storage.updateSetting('hasSeenWelcome', true);
            this.closeModal(this.welcomeModal);
        });

        // Settings Button
        on('settingsBtn', 'click', () => {
            this.openSettingsModal();
        });

        on('closeSettingsModal', 'click', () => {
            this.closeModal(this.settingsModal);
        });

        // Settings actions
        on('exportFromSettings', 'click', () => {
            this.handleExport();
        });

        on('importFromSettings', 'click', () => {
            this.closeModal(this.settingsModal);
            this.openModal(this.importModal);
        });

        on('backupReminderToggle', 'change', async (e) => {
            await this.storage.updateSetting('backupReminder', e.target.checked);
            if (e.target.checked) {
                await this.storage.updateSetting('lastBackupReminder', Date.now());
            }
        });

        on('shareAllRemindersBtn', 'click', async () => {
            const currentMeds = this.medications.filter(m => m.personId === this.currentPersonId);
            const person = this.people.find(p => p.id === this.currentPersonId);
            if (!currentMeds.length) {
                alert('No medications added yet.');
                return;
            }
            const result = await this.reminders.shareAllMedications(currentMeds, person);
            if (result.noShareAPI) {
                this.showCopyFallback(result.text);
            }
        });

        on('resetAppBtn', 'click', () => {
            this.handleResetApp();
        });

        // Where's my backup help
        on('whereIsBackupBtn', 'click', () => {
            this.closeModal(this.settingsModal);
            this.openModal(this.backupHelpModal);
        });

        on('closeBackupHelpModal', 'click', () => {
            this.closeModal(this.backupHelpModal);
        });

        // FAB
        on('fabBtn', 'click', () => {
            if (!this.currentPersonId) {
                alert('Please add a person first');
                this.openModal(this.addPersonModal);
            } else {
                this.openModal(this.addMedicationModal);
                this.initScheduleForm();
            }
        });

        // Add Person Button
        on('addPersonBtn', 'click', () => {
            this.openModal(this.addPersonModal);
        });

        // Person Form
        this.personForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddPerson();
        });

        on('cancelPersonBtn', 'click', () => {
            this.closeModal(this.addPersonModal);
        });

        on('closePersonModal', 'click', () => {
            this.closeModal(this.addPersonModal);
        });

        // Medication Form
        this.medicationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddMedication();
        });

        on('cancelMedicationBtn', 'click', () => {
            this.closeModal(this.addMedicationModal);
        });

        on('closeMedicationModal', 'click', () => {
            this.closeModal(this.addMedicationModal);
        });

        // Schedule type toggle (Scheduled / As needed)
        document.querySelectorAll('input[name="scheduleType"]').forEach(radio => {
            radio.addEventListener('change', () => this.updateScheduledSection());
        });

        // Recurrence type dropdown
        on('recurrenceType', 'change', () => this.updateRecurrenceSections());

        // Monthly mode toggle
        document.querySelectorAll('input[name="monthlyMode"]').forEach(r =>
            r.addEventListener('change', () => this.updateMonthlyMode()));

        // "Add time" button
        on('addTimeBtn', 'click', () => this.addTimeRow());

        // Export (click)
        on('exportBtn', 'click', () => {
            this.handleExport();
        });

        // Import - show import modal on long press (supports both mouse and touch)
        let pressTimer;
        let longPressTriggered = false;

        const startLongPress = () => {
            longPressTriggered = false;
            pressTimer = setTimeout(() => {
                longPressTriggered = true;
                this.openModal(this.importModal);
            }, 800);
        };

        const cancelLongPress = () => {
            clearTimeout(pressTimer);
        };

        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('mousedown', startLongPress);
            exportBtn.addEventListener('mouseup', cancelLongPress);
            exportBtn.addEventListener('mouseleave', cancelLongPress);
            exportBtn.addEventListener('touchstart', (e) => { startLongPress(); }, { passive: true });
            exportBtn.addEventListener('touchend', cancelLongPress);
            exportBtn.addEventListener('touchcancel', cancelLongPress);
        }

        on('confirmImportBtn', 'click', () => {
            this.handleImport();
        });

        on('cancelImportBtn', 'click', () => {
            this.closeModal(this.importModal);
        });

        on('closeImportModal', 'click', () => {
            this.closeModal(this.importModal);
        });

        // Close modals on background click
        [this.addMedicationModal, this.addPersonModal, this.importModal, this.settingsModal, this.backupHelpModal].forEach(modal => {
            if (!modal) return;
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
        this.doseLogs = await this.storage.getDoseLogs();

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
        const currentMeds = this.medications
            .filter(m => m.personId === this.currentPersonId)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        if (currentMeds.length === 0) {
            this.emptyState.classList.add('show');
            this.medicationsList.innerHTML = '';
            return;
        }

        this.emptyState.classList.remove('show');
        if (this._dragCleanup) { this._dragCleanup(); this._dragCleanup = null; }
        this.medicationsList.innerHTML = '';

        currentMeds.forEach(med => {
            const card = document.createElement('div');
            card.className = 'medication-card';
            card.dataset.medId = med.id;

            const frequencyText = this.getRecurrenceText(med);

            // Get today's dose logs for this medication
            const today = new Date();
            const todayStr = today.toDateString();
            const todayLogs = this.doseLogs.filter(log => 
                log.medicationId === med.id && 
                new Date(log.timestamp).toDateString() === todayStr
            );

            // Get recent logs (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentLogs = this.doseLogs.filter(log => 
                log.medicationId === med.id && 
                new Date(log.timestamp) >= sevenDaysAgo
            );

            card.innerHTML = `
                <div class="medication-header">
                    <div class="drag-handle" title="Drag to reorder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="8" y1="6" x2="16" y2="6"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                            <line x1="8" y1="18" x2="16" y2="18"/>
                        </svg>
                    </div>
                    <div class="medication-info">
                        <h3>${med.name}</h3>
                        <div class="medication-dosage">${med.dosage} • ${frequencyText}</div>
                    </div>
                    <div class="medication-actions">
                        <button class="btn-med-action share" data-med-id="${med.id}" title="Send to Reminders">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                        </button>
                        <button class="btn-med-action edit" data-med-id="${med.id}" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-med-action history" data-med-id="${med.id}" title="View History">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </button>
                        <button class="btn-med-action delete" data-med-id="${med.id}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                ${med.frequency !== 'asneeded' ? (() => {
                    const today = new Date();
                    const todayDow = today.getDay();
                    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                    const scheduledToday = this.isScheduledOn(med, today);

                    if (!scheduledToday) {
                        // Find the next scheduled day (search up to 60 days ahead)
                        let nextLabel = '';
                        for (let i = 1; i <= 60; i++) {
                            const d = new Date(today);
                            d.setDate(today.getDate() + i);
                            if (this.isScheduledOn(med, d)) {
                                const diff = i === 1 ? 'Tomorrow' : i <= 6
                                    ? dayNames[d.getDay()]
                                    : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                                nextLabel = diff;
                                break;
                            }
                        }
                        return `
                            <div class="dose-tracker dose-not-today">
                                <span class="dose-not-today-msg">
                                    Not scheduled today${nextLabel ? ` · Next: ${nextLabel}` : ''}
                                </span>
                            </div>
                        `;
                    }

                    return `
                        <div class="dose-tracker">
                            <div class="dose-tracker-header">
                                <span class="dose-tracker-title">Today's Doses</span>
                                <span class="dose-tracker-count">${todayLogs.length}/${med.times.length}</span>
                            </div>
                            <div class="dose-checkboxes">
                                ${med.times.map((time) => {
                                    const isTaken = todayLogs.some(log => log.scheduledTime === time);
                                    const matchingLog = todayLogs.find(log => log.scheduledTime === time);
                                    return `
                                        <label class="dose-checkbox ${isTaken ? 'checked' : ''}">
                                            <input type="checkbox"
                                                   data-med-id="${med.id}"
                                                   data-time="${time}"
                                                   data-log-id="${matchingLog ? matchingLog.id : ''}"
                                                   ${isTaken ? 'checked' : ''}>
                                            <span class="checkbox-custom"></span>
                                            <span class="dose-time">${this.formatTime(time)}</span>
                                            ${isTaken && matchingLog ? `
                                                <span class="dose-taken-time">✓ ${this.formatTimestamp(matchingLog.timestamp)}</span>
                                            ` : ''}
                                        </label>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                })() : `
                    <div class="dose-tracker">
                        <button class="btn-log-dose" data-med-id="${med.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 5v14M5 12h14"/>
                            </svg>
                            Log Dose Taken
                        </button>
                        ${todayLogs.length > 0 ? `
                            <div class="asneeded-log-list">
                                <div class="asneeded-log-header">Today's doses (tap × to remove)</div>
                                ${todayLogs.map(log => `
                                    <div class="asneeded-log-entry">
                                        <span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:0.875rem;height:0.875rem;vertical-align:-2px;margin-right:0.25rem;">
                                                <circle cx="12" cy="12" r="10"/>
                                                <polyline points="12 6 12 12 16 14"/>
                                            </svg>
                                            ${this.formatTimestamp(log.timestamp)}
                                        </span>
                                        <button class="btn-remove-dose" data-log-id="${log.id}" title="Remove this dose">×</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `}
                
                ${med.notes ? `
                    <div class="medication-notes">${med.notes}</div>
                ` : ''}
            `;

            // Share / Reminders button
            const shareBtn = card.querySelector('.btn-med-action.share');
            shareBtn?.addEventListener('click', async () => {
                const person = this.people.find(p => p.id === this.currentPersonId);
                const result = await this.reminders.shareMedication(med, person);
                if (result.noShareAPI) {
                    this.showCopyFallback(result.text);
                }
            });

            // Edit button
            const editBtn = card.querySelector('.btn-med-action.edit');
            editBtn?.addEventListener('click', () => {
                this.openEditModal(med);
            });

            // Delete button
            const deleteBtn = card.querySelector('.btn-med-action.delete');
            deleteBtn?.addEventListener('click', async () => {
                if (confirm(`Delete ${med.name}?`)) {
                    await this.storage.deleteMedication(med.id);
                    this.medications = this.medications.filter(m => m.id !== med.id);
                    this.render();
                }
            });

            // History button
            const historyBtn = card.querySelector('.btn-med-action.history');
            historyBtn?.addEventListener('click', () => {
                this.showMedicationHistory(med, recentLogs);
            });

            // Dose checkboxes for scheduled medications
            const checkboxes = card.querySelectorAll('.dose-checkbox input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', async (e) => {
                    await this.handleDoseToggle(e.target);
                });
            });

            // Log dose button for as-needed medications
            const logDoseBtn = card.querySelector('.btn-log-dose');
            logDoseBtn?.addEventListener('click', async () => {
                await this.logAsNeededDose(med.id);
            });

            // Remove individual as-needed dose entries
            const removeDoseBtns = card.querySelectorAll('.btn-remove-dose');
            removeDoseBtns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    const logId = btn.dataset.logId;
                    await this.storage.deleteDoseLog(logId);
                    this.doseLogs = this.doseLogs.filter(log => log.id !== logId);
                    this.render();
                });
            });

            this.medicationsList.appendChild(card);
        });

        this.initDragAndDrop();
    }

    initDragAndDrop() {
        const list = this.medicationsList;
        let dragState = null;

        const getCardAt = (x, y) => {
            for (const card of list.querySelectorAll('.medication-card:not(.dragging)')) {
                const rect = card.getBoundingClientRect();
                if (y >= rect.top && y <= rect.bottom) return card;
            }
            return null;
        };

        const onStart = (handle, e) => {
            const card = handle.closest('.medication-card');
            if (!card) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const rect = card.getBoundingClientRect();

            const ghost = card.cloneNode(true);
            ghost.className = 'medication-card drag-ghost';
            ghost.style.cssText = [
                'position:fixed',
                'top:' + rect.top + 'px',
                'left:' + rect.left + 'px',
                'width:' + rect.width + 'px',
                'z-index:1000',
                'pointer-events:none',
                'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
                'opacity:0.95',
                'transform:scale(1.02) rotate(1deg)',
                'transition:transform 0.1s'
            ].join(';');
            document.body.appendChild(ghost);
            card.classList.add('dragging');

            dragState = { card, ghost, offsetX: clientX - rect.left, offsetY: clientY - rect.top };
        };

        const onMove = (e) => {
            if (!dragState) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            dragState.ghost.style.top  = (clientY - dragState.offsetY) + 'px';
            dragState.ghost.style.left = (clientX - dragState.offsetX) + 'px';
            const target = getCardAt(clientX, clientY);
            if (target && target !== dragState.card) {
                const targetRect = target.getBoundingClientRect();
                if (clientY > targetRect.top + targetRect.height / 2) {
                    target.after(dragState.card);
                } else {
                    target.before(dragState.card);
                }
            }
        };

        const onEnd = async () => {
            if (!dragState) return;
            dragState.ghost.remove();
            dragState.card.classList.remove('dragging');
            const newOrder = [...list.querySelectorAll('.medication-card')];
            const updates = newOrder.map((el, i) => {
                const med = this.medications.find(m => m.id === el.dataset.medId);
                if (med) med.sortOrder = i;
                return med;
            }).filter(Boolean);
            await Promise.all(updates.map(m => this.storage.updateMedication(m)));
            dragState = null;
        };

        list.querySelectorAll('.drag-handle').forEach(handle => {
            handle.addEventListener('mousedown', e => onStart(handle, e));
            handle.addEventListener('touchstart', e => onStart(handle, e), { passive: false });
        });

        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);

        if (this._dragCleanup) this._dragCleanup();
        this._dragCleanup = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchend', onEnd);
        };
    }

    updateScheduledSection() {
        const isScheduled = document.querySelector('input[name="scheduleType"]:checked')?.value === 'scheduled';
        const section = document.getElementById('scheduledSection');
        if (section) section.style.display = isScheduled ? 'block' : 'none';
        if (isScheduled) this.updateRecurrenceSections();
    }

    updateRecurrenceSections() {
        const type = document.getElementById('recurrenceType')?.value;
        document.getElementById('weeklySection').style.display      = type === 'weekly'       ? 'block' : 'none';
        document.getElementById('everyNWeeksSection').style.display = type === 'everyNWeeks'  ? 'block' : 'none';
        document.getElementById('monthlySection').style.display     = type === 'monthly'      ? 'block' : 'none';
        if (type === 'monthly') this.updateMonthlyMode();
    }

    updateMonthlyMode() {
        const mode = document.querySelector('input[name="monthlyMode"]:checked')?.value;
        document.getElementById('monthlyDateSection').style.display    = mode === 'date'    ? 'block' : 'none';
        document.getElementById('monthlyWeekdaySection').style.display = mode === 'weekday' ? 'block' : 'none';
    }

    // Build a recurrence object from the current form state
    readRecurrenceFromForm() {
        const isScheduled = document.querySelector('input[name="scheduleType"]:checked')?.value === 'scheduled';
        if (!isScheduled) return null;

        const type = document.getElementById('recurrenceType').value;

        if (type === 'daily') {
            return { type: 'daily' };
        }

        if (type === 'weekly') {
            const days = [...document.querySelectorAll('input[name="weeklyDay"]:checked')]
                .map(cb => Number(cb.value));
            return { type: 'weekly', days };
        }

        if (type === 'everyNWeeks') {
            const n = Number(document.getElementById('nWeeksCount').value);
            const days = [...document.querySelectorAll('input[name="nWeeksDay"]:checked')]
                .map(cb => Number(cb.value));
            return { type: 'everyNWeeks', n, days, anchor: Date.now() };
        }

        if (type === 'monthly') {
            const mode = document.querySelector('input[name="monthlyMode"]:checked').value;
            if (mode === 'date') {
                return { type: 'monthly', mode: 'date',
                         dayOfMonth: Number(document.getElementById('monthlyDayOfMonth').value) };
            } else {
                return { type: 'monthly', mode: 'weekday',
                         week: Number(document.getElementById('monthlyWeek').value),
                         dow:  Number(document.getElementById('monthlyWeekday').value) };
            }
        }
        return { type: 'daily' };
    }

    // Populate the form from a saved recurrence object
    applyRecurrenceToForm(rec) {
        if (!rec) { rec = { type: 'daily' }; }

        // Migrate legacy days-array format
        if (!rec.type) {
            rec = rec.days && rec.days.length > 0 && rec.days.length < 7
                ? { type: 'weekly', days: rec.days }
                : { type: 'daily' };
        }

        const sel = document.getElementById('recurrenceType');
        sel.value = rec.type;
        this.updateRecurrenceSections();

        if (rec.type === 'weekly') {
            document.querySelectorAll('input[name="weeklyDay"]').forEach(cb => {
                cb.checked = rec.days && rec.days.includes(Number(cb.value));
            });
        }

        if (rec.type === 'everyNWeeks') {
            document.getElementById('nWeeksCount').value = rec.n || 2;
            document.querySelectorAll('input[name="nWeeksDay"]').forEach(cb => {
                cb.checked = rec.days && rec.days.includes(Number(cb.value));
            });
        }

        if (rec.type === 'monthly') {
            const mode = rec.mode || 'date';
            document.querySelector(`input[name="monthlyMode"][value="${mode}"]`).checked = true;
            this.updateMonthlyMode();
            if (mode === 'date') {
                document.getElementById('monthlyDayOfMonth').value = rec.dayOfMonth || 1;
            } else {
                document.getElementById('monthlyWeek').value    = rec.week ?? 1;
                document.getElementById('monthlyWeekday').value = rec.dow  ?? 1;
            }
        }
    }

    // Returns true if the medication is scheduled on a given Date (default today)
    isScheduledOn(med, date = new Date()) {
        const rec = med.recurrence;
        if (!rec) {
            // Legacy: old days-array model
            const days = med.days;
            if (!days || days.length === 0) return true;
            return days.includes(date.getDay());
        }

        if (rec.type === 'daily') return true;

        if (rec.type === 'weekly') {
            if (!rec.days || rec.days.length === 0) return true;
            return rec.days.includes(date.getDay());
        }

        if (rec.type === 'everyNWeeks') {
            if (!rec.days || !rec.days.includes(date.getDay())) return false;
            // Determine which week of the cycle we're in
            const anchor = new Date(rec.anchor || med.createdAt || Date.now());
            const anchorMonday = new Date(anchor);
            anchorMonday.setHours(0, 0, 0, 0);
            anchorMonday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7)); // back to Mon
            const targetMonday = new Date(date);
            targetMonday.setHours(0, 0, 0, 0);
            targetMonday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
            const weeksDiff = Math.round((targetMonday - anchorMonday) / (7 * 86400000));
            return weeksDiff % rec.n === 0;
        }

        if (rec.type === 'monthly') {
            if (rec.mode === 'date') {
                const dom = date.getDate();
                const target = rec.dayOfMonth;
                // ±1 day window; also handle months shorter than target date
                const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                const effective = Math.min(target, lastDay);
                return Math.abs(dom - effective) <= 1;
            }
            if (rec.mode === 'weekday') {
                if (date.getDay() !== rec.dow) return false;
                const week = rec.week;
                if (week === -1) {
                    // Last occurrence: check if adding 7 days goes into next month
                    const next = new Date(date);
                    next.setDate(date.getDate() + 7);
                    return next.getMonth() !== date.getMonth();
                }
                // nth occurrence: which occurrence of this weekday is this?
                const occurrence = Math.ceil(date.getDate() / 7);
                return occurrence === week;
            }
        }
        return false;
    }

    // Human-readable recurrence summary for the medication card
    getRecurrenceText(med) {
        if (med.frequency === 'asneeded') return 'As needed';

        const rec = med.recurrence;
        const timeCount = med.times && med.times.length > 0 ? med.times.length : 1;
        const tx = timeCount === 1 ? '1×' : `${timeCount}×`;
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        const ordinals = ['', 'First','Second','Third','Fourth','Last'];

        if (!rec) {
            // Legacy days-array
            const days = med.days;
            if (!days || days.length === 0 || days.length === 7) return `${tx} daily`;
            const sorted = [...days].sort((a,b) => a-b);
            if (sorted.join(',') === '1,2,3,4,5') return `${tx} weekdays`;
            if (sorted.join(',') === '0,6')       return `${tx} weekends`;
            return `${tx} · ${sorted.map(d => dayNames[d]).join(', ')}`;
        }

        if (rec.type === 'daily') return `${tx} daily`;

        if (rec.type === 'weekly') {
            if (!rec.days || rec.days.length === 0 || rec.days.length === 7) return `${tx} daily`;
            const sorted = [...rec.days].sort((a,b) => a-b);
            if (sorted.join(',') === '1,2,3,4,5') return `${tx} weekdays`;
            if (sorted.join(',') === '0,6')       return `${tx} weekends`;
            return `${tx} · ${sorted.map(d => dayNames[d]).join(', ')}`;
        }

        if (rec.type === 'everyNWeeks') {
            const dayList = rec.days && rec.days.length
                ? rec.days.sort((a,b)=>a-b).map(d => dayNames[d]).join(', ')
                : '—';
            return `${tx} every ${rec.n}wks · ${dayList}`;
        }

        if (rec.type === 'monthly') {
            if (rec.mode === 'date') {
                const ord = this.ordinal(rec.dayOfMonth);
                return `${tx} monthly · ${ord}`;
            }
            if (rec.mode === 'weekday') {
                const wk  = rec.week === -1 ? 'Last' : (ordinals[rec.week] || `${rec.week}.`);
                return `${tx} monthly · ${wk} ${dayNames[rec.dow]}`;
            }
        }
        return `${tx} scheduled`;
    }

    ordinal(n) {
        const s = ['th','st','nd','rd'];
        const v = n % 100;
        return n + (s[(v-20)%10] || s[v] || s[0]);
    }

    initScheduleForm() {
        this.updateScheduledSection();
        this.updateRecurrenceSections();
        if (this.timeInputsContainer.children.length === 0) {
            this.addTimeRow('08:00');
        }
        this.updateTimeRemoveButtons();
    }

    addTimeRow(value = '08:00') {
        const row = document.createElement('div');
        row.className = 'time-input-row';
        row.innerHTML = `
            <input type="time" value="${value}">
            <button type="button" class="btn-remove-time" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        row.querySelector('.btn-remove-time').addEventListener('click', () => {
            row.remove();
            this.updateTimeRemoveButtons();
        });
        this.timeInputsContainer.appendChild(row);
        this.updateTimeRemoveButtons();
        row.querySelector('input[type="time"]').focus();
    }

    updateTimeRemoveButtons() {
        const rows = this.timeInputsContainer.querySelectorAll('.time-input-row');
        rows.forEach(row => {
            const btn = row.querySelector('.btn-remove-time');
            if (btn) btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
        });
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

    openEditModal(med) {
        // Switch modal to edit mode
        document.getElementById('medicationModalTitle').textContent = 'Edit Medication';
        document.getElementById('medicationSubmitBtn').textContent = 'Save Changes';
        document.getElementById('editMedId').value = med.id;

        // Pre-fill fields
        document.getElementById('medName').value = med.name;
        document.getElementById('medDosage').value = med.dosage;
        document.getElementById('medNotes').value = med.notes || '';

        // Set schedule type radio
        const isAsNeeded = med.frequency === 'asneeded';
        document.querySelectorAll('input[name="scheduleType"]').forEach(r => {
            r.checked = (r.value === (isAsNeeded ? 'asneeded' : 'scheduled'));
        });
        this.updateScheduledSection();

        // Restore recurrence
        this.applyRecurrenceToForm(med.recurrence || (med.days ? { type: 'weekly', days: med.days } : { type: 'daily' }));

        // Restore time rows
        this.timeInputsContainer.innerHTML = '';
        const timesToRestore = med.times && med.times.length > 0 ? med.times : ['08:00'];
        timesToRestore.forEach(t => this.addTimeRow(t));

        this.openModal(this.addMedicationModal);
    }

    async handleAddMedication() {
        if (!this.currentPersonId) return;

        const editId = document.getElementById('editMedId').value;
        const nameInput = document.getElementById('medName');
        const dosageInput = document.getElementById('medDosage');
        const notesInput = document.getElementById('medNotes');

        const times = [];
        const timeInputs = this.timeInputsContainer.querySelectorAll('input[type="time"]');
        timeInputs.forEach(input => { if (input.value) times.push(input.value); });

        const isScheduled = document.querySelector('input[name="scheduleType"]:checked')?.value === 'scheduled';
        const frequency  = isScheduled ? 'scheduled' : 'asneeded';
        const recurrence = isScheduled ? this.readRecurrenceFromForm() : null;

        if (editId) {
            // --- EDIT existing medication ---
            const existing = this.medications.find(m => m.id === editId);
            if (!existing) return;

            existing.name       = nameInput.value.trim();
            existing.dosage     = dosageInput.value.trim();
            existing.frequency  = frequency;
            existing.times      = times;
            existing.recurrence = recurrence;
            existing.notes      = notesInput.value.trim() || undefined;

            await this.storage.updateMedication(existing);
        } else {
            // --- ADD new medication ---
            // Assign sortOrder as one past the current last for this person
            const personMeds = this.medications.filter(m => m.personId === this.currentPersonId);
            const maxOrder = personMeds.reduce((max, m) => Math.max(max, m.sortOrder ?? 0), 0);

            const medication = {
                id: this.generateId(),
                personId: this.currentPersonId,
                name: nameInput.value.trim(),
                dosage: dosageInput.value.trim(),
                frequency: frequency,
                times,
                recurrence,
                createdAt: Date.now(),
                sortOrder: maxOrder + 1,
                notes: notesInput.value.trim() || undefined
            };

            await this.storage.addMedication(medication);
            this.medications.push(medication);
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
                this.doseLogs = await this.storage.getDoseLogs();
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
    }

    closeModal(modal) {
        modal.classList.remove('show');
        if (modal === this.addMedicationModal) {
            this.medicationForm.reset();
            document.getElementById('editMedId').value = '';
            document.getElementById('medicationModalTitle').textContent = 'Add Medication';
            document.getElementById('medicationSubmitBtn').textContent = 'Add Medication';
            // Reset schedule type to Scheduled
            const scheduledRadio = document.querySelector('input[name="scheduleType"][value="scheduled"]');
            if (scheduledRadio) scheduledRadio.checked = true;
            this.updateScheduledSection();
            // Reset recurrence to daily
            const recSel = document.getElementById('recurrenceType');
            if (recSel) { recSel.value = 'daily'; this.updateRecurrenceSections(); }
            // Reset to one empty time row
            if (this.timeInputsContainer) {
                this.timeInputsContainer.innerHTML = '';
                this.addTimeRow('08:00');
            }
        }
        if (modal === this.addPersonModal) {
            this.personForm.reset();
        }
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    async handleDoseToggle(checkbox) {
        const medId = checkbox.dataset.medId;
        const time = checkbox.dataset.time;
        const logId = checkbox.dataset.logId;

        if (checkbox.checked) {
            // Log the dose
            const doseLog = {
                id: this.generateId(),
                medicationId: medId,
                scheduledTime: time,
                timestamp: Date.now()
            };

            await this.storage.addDoseLog(doseLog);
            this.doseLogs.push(doseLog);
        } else {
            // Remove the dose log
            if (logId) {
                await this.storage.deleteDoseLog(logId);
                this.doseLogs = this.doseLogs.filter(log => log.id !== logId);
            }
        }

        this.render();
    }

    async logAsNeededDose(medId) {
        const doseLog = {
            id: this.generateId(),
            medicationId: medId,
            scheduledTime: null,
            timestamp: Date.now()
        };

        await this.storage.addDoseLog(doseLog);
        this.doseLogs.push(doseLog);
        this.render();
    }

    showMedicationHistory(med, recentLogs) {
        // Group logs by date
        const logsByDate = {};
        recentLogs.forEach(log => {
            const dateStr = new Date(log.timestamp).toDateString();
            if (!logsByDate[dateStr]) {
                logsByDate[dateStr] = [];
            }
            logsByDate[dateStr].push(log);
        });

        // Build history HTML
        let historyHTML = `
            <div class="history-header">
                <h3>${med.name} - Last 7 Days</h3>
                <p class="history-subtitle">${med.dosage} • ${this.getRecurrenceText(med)}</p>
            </div>
        `;

        const dates = Object.keys(logsByDate).sort((a, b) => new Date(b) - new Date(a));
        
        if (dates.length === 0) {
            historyHTML += '<p class="no-history">No doses logged in the last 7 days</p>';
        } else {
            historyHTML += '<div class="history-timeline">';
            dates.forEach(dateStr => {
                const logs = logsByDate[dateStr];
                const date = new Date(dateStr);
                const isToday = date.toDateString() === new Date().toDateString();
                const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
                
                let displayDate = dateStr;
                if (isToday) displayDate = 'Today';
                else if (isYesterday) displayDate = 'Yesterday';
                else displayDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

                historyHTML += `
                    <div class="history-day">
                        <div class="history-date">${displayDate}</div>
                        <div class="history-doses">
                            ${logs.map(log => `
                                <div class="history-dose">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                        <circle cx="12" cy="12" r="10"/>
                                        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" fill="none"/>
                                    </svg>
                                    <span>${log.scheduledTime ? this.formatTime(log.scheduledTime) + ' dose' : 'Dose'} taken at ${this.formatTimestamp(log.timestamp)}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="history-count">${logs.length} dose${logs.length > 1 ? 's' : ''}</div>
                    </div>
                `;
            });
            historyHTML += '</div>';
        }

        // Show in a simple alert for now (could be enhanced with a modal)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = historyHTML;
        const textContent = tempDiv.textContent;
        
        // Create a better display using confirm
        alert(`${med.name} - Dose History\n\nLast 7 Days: ${recentLogs.length} total doses\n\n${dates.map(dateStr => {
            const logs = logsByDate[dateStr];
            const date = new Date(dateStr);
            const isToday = date.toDateString() === new Date().toDateString();
            const displayDate = isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `${displayDate}: ${logs.length} dose${logs.length > 1 ? 's' : ''}`;
        }).join('\n')}`);
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async openSettingsModal() {
        // Update backup reminder toggle
        const backupReminder = await this.storage.getSetting('backupReminder');
        document.getElementById('backupReminderToggle').checked = backupReminder || false;
        this.openModal(this.settingsModal);
    }

    showCopyFallback(text) {
        // Used when Web Share API isn't available (e.g. desktop browsers)
        const modal = document.getElementById('copyFallbackModal');
        document.getElementById('copyFallbackText').value = text;
        modal.classList.add('show');

        document.getElementById('closeCopyFallback').onclick = () => modal.classList.remove('show');
        document.getElementById('copyTextBtn').onclick = () => {
            navigator.clipboard.writeText(text).then(() => {
                document.getElementById('copyTextBtn').textContent = 'Copied!';
                setTimeout(() => {
                    document.getElementById('copyTextBtn').textContent = 'Copy to Clipboard';
                }, 2000);
            });
        };
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
            '• All dose history\n' +
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
            this.doseLogs = [];
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
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // Service worker registration failed - not critical for basic functionality
        });
    });
}
