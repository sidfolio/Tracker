// ============================================================
// BLUEPRINT — APP.JS
// Firebase Firestore for cross-device sync + Daily Archive
// ============================================================

const USER_DOC_ID = 'siddharth'; // Unique ID for your data in Firestore

// ======================== DATA LAYER ========================
// Falls back to localStorage if Firebase isn't configured yet

let _localData = null;
let _firebaseConfigured = false;

function getDefaultData() {
    return {
        settings: {
            startDate: "2026-06-01T00:00:00",
            endDate: "2027-02-28T23:59:59",
            totalHours: 6480,
            userName: "Siddharth",
        },
        goals: [
            { id: "g1", type: "daily",   text: "Apply to 3 NYC Design Roles",             completed: false },
            { id: "g2", type: "daily",   text: "1 Hour React / TypeScript Practice",       completed: false },
            { id: "g3", type: "weekly",  text: "Attend 1 Networking Event or Webinar",      completed: false },
            { id: "g4", type: "weekly",  text: "Publish 1 LinkedIn update or post",         completed: false },
            { id: "g5", type: "monthly", text: "Complete 1 High-Fidelity B2B Dashboard Prototype", completed: false }
        ],
        archive: [],  // { id, text, type, completedAt (ISO string) }
        companies: [
            { name: "Notion", link: "https://linkedin.com/company/notion", description: "Design-first product, gold standard for visual craft." },
            { name: "Figma", link: "https://linkedin.com/company/figma", description: "Market leader in design tools. Exceptional systems design." },
            { name: "Spotify", link: "https://linkedin.com/company/spotify", description: "Music and media player. Premium consumer design." },
            { name: "Linear", link: "https://linkedin.com/company/linear-app", description: "High-performance issue tracker. Obsessed with speed & detail." },
            { name: "Ramp", link: "https://linkedin.com/company/ramp-card", description: "Fintech innovator, fast product cycles." },
            { name: "Airbnb", link: "https://linkedin.com/company/airbnb", description: "Pioneering travel marketplace, visual excellence." },
            { name: "Vercel", link: "https://linkedin.com/company/vercel", description: "Frontend deployment platform. High engineering bar." }
        ],
        people: [
            { name: "Design Director @ Figma", link: "https://linkedin.com/in/siddharth-srivastava", description: "Reach out via warm intro regarding systems team." }
        ],
        portals: [
            { name: "LinkedIn Jobs", link: "https://linkedin.com/jobs", description: "Set alerts for 'Senior Product Designer' + 'Design Engineer' in NYC." },
            { name: "Read.cv", link: "https://read.cv/explore", description: "Excellent source for highly visual and craft-obsessed startup roles." }
        ],
        coach: {
            weaknesses: ["ADHD Distractions", "Time Management", "React / Coding Skills", "Math", "Imposter Syndrome"],
            strengths:  ["High Visual Craft", "Systems Mindset", "UX Research", "Creative Output"],
            reminders: [
                "Your ADHD means it takes 1–3 hours to focus. Start your block EARLY.",
                "You want that $200k in NYC? Put the guitar down for just one more hour.",
                "Maintain >3.5 GPA. Current: 3.7. Don't let it slip.",
                "You are a stellar designer. Don't let imposter syndrome win today.",
                "Cold emails are your unfair advantage. Send 5 before lunch."
            ]
        },
        skills: { hard: [], moderate: [], soft: [] }
    };
}

function migrateData(data) {
    if (!data) return false;
    let changed = false;

    // 1. Migrate companies if in old tiered format
    if (data.companies && !Array.isArray(data.companies)) {
        const old = data.companies;
        const newComps = [];
        const seen = new Set();
        const extract = (arr) => {
            if (Array.isArray(arr)) {
                arr.forEach(name => {
                    if (name && typeof name === 'string' && !seen.has(name)) {
                        seen.add(name);
                        newComps.push({ name, link: '', description: '' });
                    }
                });
            }
        };
        extract(old.dream);
        extract(old.ideal);
        extract(old.sweetSpot);
        extract(old.safeZone);
        extract(old.danger);
        data.companies = newComps;
        changed = true;
    } else if (!data.companies) {
        data.companies = [];
        changed = true;
    }

    // 2. Initialize people if missing
    if (!data.people) {
        data.people = [
            { name: "Design Director @ Figma", link: "https://linkedin.com/in/siddharth-srivastava", description: "Targeting Systems Team. Reached out." }
        ];
        changed = true;
    }

    // 3. Initialize portals if missing
    if (!data.portals) {
        data.portals = [
            { name: "LinkedIn Jobs", link: "https://linkedin.com/jobs", description: "Primary job hunting portal." },
            { name: "Read.cv", link: "https://read.cv/explore", description: "Great for design-centric startups." }
        ];
        changed = true;
    }

    return changed;
}

function getData() {
    if (_localData) {
        if (migrateData(_localData)) saveData(_localData);
        return _localData;
    }
    const storedV2 = localStorage.getItem('nycTrackerData_v2');
    const storedV1 = localStorage.getItem('nycTrackerData');
    
    if (storedV2) {
        _localData = JSON.parse(storedV2);
        const changed = migrateData(_localData);
        
        // Force recovery of skills if empty (e.g. wiped during initial Firebase sync)
        if ((!_localData.skills.hard || _localData.skills.hard.length === 0) && storedV1) {
            const v1Data = JSON.parse(storedV1);
            if (v1Data.skills && v1Data.skills.hard && v1Data.skills.hard.length > 0) {
                _localData.skills = v1Data.skills;
                _localData.coach = v1Data.coach;
                _localData.companies = v1Data.companies;
            }
        }
        if (changed) saveData(_localData);
        return _localData;
    }
    
    // Fallback: migrate from old data.js
    if (storedV1) {
        const v1Data = JSON.parse(storedV1);
        _localData = { ...getDefaultData(), ...v1Data };
        if (!_localData.archive) _localData.archive = [];
        migrateData(_localData);
        localStorage.setItem('nycTrackerData_v2', JSON.stringify(_localData));
        return _localData;
    }

    _localData = getDefaultData();
    if (!_localData.archive) _localData.archive = [];
    migrateData(_localData);
    return _localData;
}

function saveData(data) {
    _localData = data;
    localStorage.setItem('nycTrackerData_v2', JSON.stringify(data));

    // Also push to Firebase if configured
    if (_firebaseConfigured && window._firebaseDb) {
        const db = window._firebaseDb;
        const docRef = window._firebaseDoc(db, 'trackers', USER_DOC_ID);
        window._firebaseSetDoc(docRef, data).catch(e => console.warn('Firebase save failed:', e));
    }
}

// ======================== FIREBASE SYNC ========================
function initFirebase() {
    if (!window._firebaseReady || !window._firebaseDb) return;

    const db = window._firebaseDb;
    const docRef = window._firebaseDoc(db, 'trackers', USER_DOC_ID);

    // Check if config is still placeholder
    try {
        window._firebaseGetDoc(docRef).then(snap => {
            if (snap.exists()) {
                _localData = snap.data();
                
                // CRITICAL FIX: If Cloud data has empty skills, but data.js has them, rescue the Cloud data
                const storedV1 = localStorage.getItem('nycTrackerData');
                if ((!_localData.skills.hard || _localData.skills.hard.length === 0) && storedV1) {
                    const v1Data = JSON.parse(storedV1);
                    if (v1Data.skills && v1Data.skills.hard && v1Data.skills.hard.length > 0) {
                        _localData.skills = v1Data.skills;
                        _localData.coach = v1Data.coach;
                        _localData.companies = v1Data.companies;
                        window._firebaseSetDoc(docRef, _localData); // Push rescued data back to Cloud
                        console.log('Rescued empty skills and pushed to Firebase! ✅');
                    }
                }

                // V3 MIGRATION: If Cloud data is old (not version 3), overwrite it with the newly condensed skills
                if (_localData.version !== 3) {
                    console.log('Migrating Cloud Data to V3 (Condensed Skills)...');
                    _localData = getData(); // This has the new V3 skills from data.js
                    window._firebaseSetDoc(docRef, _localData);
                }
                
                const migrated = migrateData(_localData);
                if (migrated) {
                    window._firebaseSetDoc(docRef, _localData);
                }
                
                localStorage.setItem('nycTrackerData_v2', JSON.stringify(_localData));
                console.log('Loaded data from Firebase ✅');
            } else {
                const localData = getData();
                window._firebaseSetDoc(docRef, localData);
                console.log('Pushed initial data to Firebase ✅');
            }
            _firebaseConfigured = true;
            document.getElementById('firebase-banner').style.display = 'none';

            handleHashChange();

            window._firebaseOnSnapshot(docRef, (snapshot) => {
                if (snapshot.exists()) {
                    _localData = snapshot.data();
                    localStorage.setItem('nycTrackerData_v2', JSON.stringify(_localData));
                    handleHashChange();
                    calculateZone();
                }
            });
        }).catch(err => {
            console.warn('Firebase not configured or connection failed:', err.message);
            document.getElementById('firebase-banner').style.display = 'block';
        });
    } catch(e) {
        document.getElementById('firebase-banner').style.display = 'block';
    }
}

// ======================== INIT ========================
document.addEventListener('DOMContentLoaded', () => {

    const searchBtn = document.getElementById('topbar-search-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const modal = document.getElementById('command-palette-modal');
            if (modal) {
                modal.style.display = 'flex';
                document.getElementById('palette-search').value = '';
                filteredCommands = [...COMMANDS];
                selectedCommandIdx = 0;
                renderCommandPalette();
                document.getElementById('palette-search').focus();
            }
        });
    }

    // Firebase banner dismiss
    document.getElementById('dismiss-banner').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('firebase-banner').style.display = 'none';
    });

    // Routing
    initAccessibilityOverlays();
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    // Countdown
    updateCountdown();
    setInterval(updateCountdown, 1000 * 60);

    // Zone
    calculateZone();

    // Zone modal
    document.getElementById('overall-zone').addEventListener('click', showZoneModal);
    document.getElementById('close-zone-modal').addEventListener('click', () => {
        document.getElementById('zone-modal').style.display = 'none';
    });
    document.getElementById('zone-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('zone-modal'))
            document.getElementById('zone-modal').style.display = 'none';
    });

    // Firebase (fires when module loaded)
    if (window._firebaseReady) {
        initFirebase();
    } else {
        window.addEventListener('firebaseReady', initFirebase);
        // Show banner after short delay if Firebase never fires
        setTimeout(() => {
            if (!_firebaseConfigured) {
                document.getElementById('firebase-banner').style.display = 'block';
            }
        }, 3000);
    }
});

// ======================== ROUTING ========================
const views = {
    dashboard: renderDashboard,
    contacts:  renderContacts,
    coach:     renderCoach,
    skills:    renderSkills,
    archive:   renderArchive,
    news:      renderNews,
    journal:   renderJournal
};

function handleHashChange() {
    let hash = window.location.hash.replace('#', '') || 'dashboard';
    if (!views[hash]) hash = 'dashboard';

    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
        el.removeAttribute('aria-current');
    });
    const activeNav = document.getElementById(`nav-${hash}`);
    if (activeNav) {
        activeNav.classList.add('active');
        activeNav.setAttribute('aria-current', 'page');
    }

    const container = document.getElementById('view-container');
    container.innerHTML = '';
    views[hash](container);
    
    // Announce route transition to screen readers
    announce(`Navigated to ${hash.charAt(0).toUpperCase() + hash.slice(1)} page.`);
}

// ======================== COUNTDOWN ========================
function updateCountdown() {
    const data = getData();
    const end = new Date(data.settings.endDate).getTime();
    const diff = Math.max(0, end - Date.now());
    const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
    const el = document.getElementById('hours-remaining');
    if (el) el.innerHTML = `${hoursLeft.toLocaleString()} <span class="unit">hrs</span>`;
}

// ======================== ZONE ========================
function calculateZone() {
    const data = getData();
    const completed = data.goals.filter(g => g.completed).length;
    const total = data.goals.length;
    const ratio = total === 0 ? 0 : completed / total;

    const zoneEl = document.getElementById('overall-zone');
    const zoneText = document.getElementById('zone-text');
    if (!zoneEl) return;

    zoneEl.className = 'zone-indicator';
    let cls, text;
    if (ratio >= 0.7)      { cls = 'safe';   text = 'Safe Zone'; }
    else if (ratio >= 0.4) { cls = 'mod';    text = 'Moderate Zone'; }
    else                   { cls = 'danger'; text = 'Danger Zone'; }

    zoneEl.classList.add(cls);
    zoneText.textContent = text;
}

function showZoneModal() {
    const data = getData();
    const completed = data.goals.filter(g => g.completed).length;
    const total = data.goals.length;
    const ratio = total === 0 ? 0 : completed / total;

    const modal  = document.getElementById('zone-modal');
    const title  = document.getElementById('zone-modal-title');
    const reason = document.getElementById('zone-modal-reason');
    const sol    = document.getElementById('zone-modal-solution');

    if (ratio >= 0.7) {
        title.textContent = '✅ Safe Zone';
        title.style.color = 'var(--safe)';
        reason.textContent = `You have completed ${completed} of ${total} targets (${Math.round(ratio*100)}%). Excellent consistency — you are on track toward that $200k offer.`;
        sol.textContent = "Keep the momentum. Rest is not the enemy — burnout is. Reward yourself with an hour of jazz guitar tonight.";
    } else if (ratio >= 0.4) {
        title.textContent = '⚠️ Moderate Zone';
        title.style.color = 'var(--mod)';
        reason.textContent = `You have completed ${completed} of ${total} targets (${Math.round(ratio*100)}%). Progress exists but ADHD distractions or procrastination are pulling you off course.`;
        sol.textContent = "Start a strict 2-hour Focus Block right now. Silence your phone, close non-essential tabs, and complete at least one high-priority goal to push into Safe Zone.";
    } else {
        title.textContent = '🚨 Danger Zone';
        title.style.color = 'var(--danger)';
        reason.textContent = `You have only completed ${completed} of ${total} targets (${Math.round(ratio*100)}%). At this rate, the $200k NYC offer by February will NOT happen. Your ADHD may be paralyzing you or you are over-allocating time to distractions.`;
        sol.innerHTML = "<strong>1.</strong> Stop everything. Take a 10-min cold shower or walk.<br><strong>2.</strong> Delete all daily goals except the easiest one.<br><strong>3.</strong> Complete that single easiest goal <em>right now</em> to break the paralysis. Then add one more.";
    }

    modal.style.display = 'flex';
}

// ======================== TOAST ========================
function showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    const icon = type === 'success' ? 'ph-check-circle' : type === 'error' ? 'ph-warning' : 'ph-info';
    t.innerHTML = `<i class="ph-fill ${icon}" style="color:var(--accent)"></i> ${msg}`;
    c.appendChild(t);
    // Extend timeout to 4500ms when there is an undo button to give user time to click it!
    const delay = msg.includes('Undo') ? 4500 : 3000;
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, delay);
}

window._lastArchivedGoal = null;
window._undoLastArchive = function() {
    if (!window._lastArchivedGoal) return;
    const { originalGoal, archiveId } = window._lastArchivedGoal;
    const d = getData();
    
    // Add back to active goals
    d.goals = d.goals || [];
    d.goals.push(originalGoal);
    
    // Remove from archive
    if (d.archive) {
        d.archive = d.archive.filter(x => x.id !== archiveId);
    }
    
    // Clear last archived pointer
    window._lastArchivedGoal = null;
    
    saveData(d);
    renderGoalLists();
    calculateZone();
    
    const container = document.getElementById('view-container');
    if (container) renderDashboard(container);
    
    showToast('Goal restored successfully!', 'success');
};

// ======================== DASHBOARD ========================
function renderDashboard(container) {
    const data = getData();
    const totalGoals = data.goals.length;
    const completedGoals = data.goals.filter(g => g.completed).length;
    const remaining = totalGoals - completedGoals;
    const archive  = data.archive || [];
    const archivedTotal = archive.length;
    const end = new Date(data.settings.endDate).getTime();
    const start = new Date(data.settings.startDate).getTime();
    const now = Date.now();
    const daysLeft = Math.max(0, Math.floor((end - now) / (1000*60*60*24)));
    const totalDays = Math.ceil((end - start) / (1000*60*60*24));
    const daysElapsed = Math.max(0, totalDays - daysLeft);
    const pct = totalGoals === 0 ? 0 : Math.round((completedGoals / totalGoals) * 100);
    const dailyGoals   = data.goals.filter(g => g.type === 'daily').length;
    const weeklyGoals  = data.goals.filter(g => g.type === 'weekly').length;
    const monthlyGoals = data.goals.filter(g => g.type === 'monthly').length;

    // Archive wins per last 7 days
    const dayLabels = [];
    const dayWins   = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dayLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        dayWins.push(archive.filter(a => new Date(a.completedAt).toDateString() === d.toDateString()).length);
    }

    container.innerHTML = `
        <!-- STAT ROW -->
        <div class="stat-row">
            <div class="stat-card">
                <i class="ph ph-arrow-up-right stat-arrow"></i>
                <div class="stat-label">Active Goals</div>
                <div class="stat-number">${totalGoals}</div>
            </div>
            <div class="stat-card">
                <i class="ph ph-arrow-up-right stat-arrow"></i>
                <div class="stat-label">Completed Today</div>
                <div class="stat-number">${completedGoals}</div>
            </div>
            <div class="stat-card">
                <i class="ph ph-arrow-up-right stat-arrow"></i>
                <div class="stat-label">Days Remaining</div>
                <div class="stat-number">${daysLeft}</div>
            </div>
            <div class="stat-card">
                <i class="ph ph-arrow-up-right stat-arrow"></i>
                <div class="stat-label">Wins Archived</div>
                <div class="stat-number">${archivedTotal}</div>
            </div>
            <div class="stat-card accent">
                <i class="ph ph-arrow-up-right stat-arrow"></i>
                <div class="stat-label">Goal Completion</div>
                <div class="stat-number">${pct}%</div>
            </div>
        </div>

        <!-- CHART ROW -->
        <div class="content-grid" style="margin-bottom:20px;">
            <!-- DONUT -->
            <div class="chart-card">
                <div class="chart-title"><i class="ph ph-chart-pie-slice"></i> Goal Breakdown</div>
                <div style="display:flex; align-items:center; gap:32px;">
                    <div class="donut-wrap" style="width:180px; height:180px; flex-shrink:0;">
                        <canvas id="goal-donut" width="180" height="180" role="img" aria-label="Goal completion donut chart. Current completion: ${pct}%. Daily goals: ${dailyGoals}, Weekly goals: ${weeklyGoals}, Monthly goals: ${monthlyGoals}."></canvas>
                        <div class="donut-center">
                            <div class="big-num">${pct}%</div>
                            <div class="small-label">Done</div>
                        </div>
                    </div>
                    <div style="flex:1;">
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label"><span class="legend-dot" style="background:#e8a020"></span>Daily</span>
                                <span class="progress-value">${dailyGoals} goals</span>
                            </div>
                            <div class="progress-track"><div class="progress-fill" style="width:${totalGoals?Math.round(dailyGoals/totalGoals*100):0}%; background:#e8a020;"></div></div>
                        </div>
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label"><span class="legend-dot" style="background:#3b82f6"></span>Weekly</span>
                                <span class="progress-value">${weeklyGoals} goals</span>
                            </div>
                            <div class="progress-track"><div class="progress-fill" style="width:${totalGoals?Math.round(weeklyGoals/totalGoals*100):0}%; background:#3b82f6;"></div></div>
                        </div>
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label"><span class="legend-dot" style="background:#8b5cf6"></span>Monthly</span>
                                <span class="progress-value">${monthlyGoals} goals</span>
                            </div>
                            <div class="progress-track"><div class="progress-fill" style="width:${totalGoals?Math.round(monthlyGoals/totalGoals*100):0}%; background:#8b5cf6;"></div></div>
                        </div>
                        <div class="progress-item" style="margin-bottom:0;">
                            <div class="progress-header">
                                <span class="progress-label"><span class="legend-dot" style="background:#22c55e"></span>Timeline</span>
                                <span class="progress-value">${daysElapsed}/${totalDays} days</span>
                            </div>
                            <div class="progress-track"><div class="progress-fill" style="width:${Math.round(daysElapsed/totalDays*100)}%; background:#22c55e;"></div></div>
                        </div>
                    </div>
                </div>
                <!-- Offscreen text summary for screen readers -->
                <div class="sr-only">
                    <h4>Active goal completion statistics:</h4>
                    <ul>
                        <li>Daily goals total count: ${dailyGoals}</li>
                        <li>Weekly goals total count: ${weeklyGoals}</li>
                        <li>Monthly goals total count: ${monthlyGoals}</li>
                        <li>Total goals active: ${totalGoals}</li>
                        <li>Total active goals completed: ${completedGoals}</li>
                        <li>Goal completion percentage: ${pct}%</li>
                    </ul>
                </div>
            </div>

            <!-- BAR CHART: Wins per day -->
            <div class="chart-card">
                <div class="chart-title"><i class="ph ph-chart-bar"></i> Wins per Day (Last 7 Days)</div>
                <div class="chart-wrap" style="height:180px;">
                    <canvas id="wins-bar" role="img" aria-label="Wins per day bar chart for the last 7 days. Day wins: ${dayWins.join(', ')} for days ${dayLabels.join(', ')}."></canvas>
                </div>
                <div class="sr-only">
                    <h4>Win stats details table:</h4>
                    <table>
                        <thead>
                            <tr><th>Day</th><th>Wins Completed</th></tr>
                        </thead>
                        <tbody>
                            ${dayLabels.map((lbl, idx) => `<tr><td>${lbl}</td><td>${dayWins[idx]} wins</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- ADD GOAL (AT THE TOP) -->
        <div class="card" style="margin-bottom:20px;">
            <div class="card-title"><i class="ph ph-plus"></i> Add New Goal</div>
            <div class="input-group" style="display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end;">
                <div style="display:flex; flex-direction:column; gap:4px; flex:0 0 120px;">
                    <label for="new-goal-type" style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Goal Type</label>
                    <select id="new-goal-type" style="width:100%; box-sizing:border-box;">
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                    <label for="new-goal-text" style="font-size:0.75rem; font-weight:600; color:var(--text-secondary);">Goal Description</label>
                    <input type="text" id="new-goal-text" placeholder="e.g., Cold email 5 recruiters at Ramp" style="width:100%; box-sizing:border-box; height:38px; padding:8px 12px;">
                </div>
                <button id="add-goal-btn" style="height:38px;">Add Goal</button>
            </div>
        </div>

        <!-- GOAL CARDS -->
        <div class="content-grid-3" style="margin-bottom:20px;">
            <section class="card" aria-labelledby="daily-goals-title">
                <div class="card-title" id="daily-goals-title"><i class="ph ph-sun"></i> Daily Goals</div>
                <ul class="goal-list" id="daily-goals"></ul>
            </section>
            <section class="card" aria-labelledby="weekly-goals-title">
                <div class="card-title" id="weekly-goals-title"><i class="ph ph-calendar-blank"></i> Weekly Goals</div>
                <ul class="goal-list" id="weekly-goals"></ul>
            </section>
            <section class="card" aria-labelledby="monthly-goals-title">
                <div class="card-title" id="monthly-goals-title"><i class="ph ph-calendar"></i> Monthly Goals</div>
                <ul class="goal-list" id="monthly-goals"></ul>
            </section>
        </div>
    `;

    renderGoalLists();

    // Destroy previous chart instances if they exist to prevent Chart.js reuse errors
    if (window.goalDonutChart) {
        window.goalDonutChart.destroy();
    }
    if (window.winsBarChart) {
        window.winsBarChart.destroy();
    }

    // --- Donut chart ---
    const isDark = !document.body.classList.contains('light');
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const labelColor = isDark ? '#8a8a9a' : '#666678';

    window.goalDonutChart = new Chart(document.getElementById('goal-donut'), {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Remaining'],
            datasets: [{ data: [completedGoals || 0.01, remaining || 0.01], backgroundColor: ['#e8a020', isDark ? '#252530' : '#e8e8e4'], borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            cutout: '72%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } }, animation: { duration: 700 }
        }
    });

    // --- Bar chart: wins per day ---
    window.winsBarChart = new Chart(document.getElementById('wins-bar'), {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{ label: 'Wins', data: dayWins, backgroundColor: 'rgba(232,160,32,0.8)', borderRadius: 6, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11 } } },
                y: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11 }, stepSize: 1, precision: 0 }, beginAtZero: true }
            },
            animation: { duration: 700 }
        }
    });

    document.getElementById('add-goal-btn').addEventListener('click', () => {
        const text = document.getElementById('new-goal-text').value.trim();
        const type = document.getElementById('new-goal-type').value;
        if (!text) return showToast('Enter a goal first.', 'error');
        const d = getData();
        d.goals.push({ id: 'g' + Date.now(), type, text, completed: false });
        saveData(d);
        document.getElementById('new-goal-text').value = '';
        renderGoalLists();
        calculateZone();
        renderDashboard(container);
        showToast('New goal added.', 'success');
    });

    document.getElementById('new-goal-text').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('add-goal-btn').click();
        }
    });
}

function renderGoalLists() {
    const data = getData();
    ['daily', 'weekly', 'monthly'].forEach(type => {
        const list = document.getElementById(`${type}-goals`);
        if (!list) return;
        list.innerHTML = '';

        const goals = data.goals.filter(g => g.type === type);
        if (goals.length === 0) {
            list.innerHTML = `<li style="color:var(--text-muted); font-size:0.82rem; padding:8px 12px;">No ${type} goals yet.</li>`;
            return;
        }

        goals.forEach(g => {
            const li = document.createElement('li');
            li.className = `goal-item${g.completed ? ' completed' : ''}`;
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'listitem');
            li.setAttribute('aria-label', `Goal: ${g.text}. Press Space to toggle, E or F2 to inline edit, Del to remove.`);
            li.innerHTML = `
                <input type="checkbox" id="chk-${g.id}" ${g.completed ? 'checked' : ''} aria-labelledby="goal-text-${g.id}">
                <span class="goal-text" id="goal-text-${g.id}" contenteditable="true" data-goal-id="${g.id}" style="cursor: text; user-select: text;">${g.text}</span>
                <i class="ph ph-trash" style="cursor:pointer;color:var(--text-muted);font-size:0.9rem;" title="Delete" aria-label="Delete goal: ${g.text.replace(/"/g, '&quot;')}" tabindex="0" role="button"></i>
            `;

            // Edit inline
            const span = li.querySelector('.goal-text');
            span.addEventListener('blur', (e) => {
                const newText = e.target.innerText.trim();
                if (newText && newText !== g.text) {
                    const d = getData();
                    const goal = d.goals.find(x => x.id === g.id);
                    if (goal) {
                        goal.text = newText;
                        saveData(d);
                        showToast('Goal description updated.', 'success');
                        announce(`Goal updated: ${newText}`);
                    }
                }
            });
            span.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });

            li.querySelector('input').addEventListener('change', (e) => {
                const d = getData();
                const goal = d.goals.find(x => x.id === g.id);
                if (!goal) return;

                if (e.target.checked) {
                    const archiveId = goal.id + '_arc_' + Date.now();
                    // Store details for Undo
                    window._lastArchivedGoal = {
                        originalGoal: { ...goal },
                        archiveId: archiveId
                    };

                    // Archive it
                    goal.completed = true;
                    d.archive = d.archive || [];
                    d.archive.push({
                        id: archiveId,
                        text: goal.text,
                        type: goal.type,
                        completedAt: new Date().toISOString()
                    });
                    d.goals = d.goals.filter(x => x.id !== g.id);
                    saveData(d);
                    
                    showToast('Goal completed! 🏆 <span onclick="window._undoLastArchive()" style="text-decoration:underline; font-weight:700; margin-left:8px; cursor:pointer; color:var(--accent);">Undo</span>', 'success');
                    announce(`Completed goal: ${goal.text}.`);
                    
                    renderGoalLists();
                    calculateZone();

                    const container = document.getElementById('view-container');
                    if (container) renderDashboard(container);
                } else {
                    goal.completed = false;
                    saveData(d);
                    renderGoalLists();
                    calculateZone();
                }
            });

            // Trash action
            const trash = li.querySelector('.ph-trash');
            const doDelete = () => {
                const d = getData();
                d.goals = d.goals.filter(x => x.id !== g.id);
                saveData(d);
                renderGoalLists();
                calculateZone();
                const container = document.getElementById('view-container');
                if (container) renderDashboard(container);
                showToast('Goal removed.', 'info');
                announce(`Goal removed: ${g.text}`);
            };
            trash.addEventListener('click', doDelete);
            trash.addEventListener('keydown', (e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    doDelete();
                }
            });

            list.appendChild(li);
        });
    });
}

// ======================== ARCHIVE ========================
function renderArchive(container) {
    const data = getData();
    const archive = (data.archive || []).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    if (archive.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:60px;">
                <i class="ph ph-archive" style="font-size:3rem; color:var(--text-muted);"></i>
                <p style="color:var(--text-secondary); margin-top:16px; font-size:0.95rem;">
                    No archived goals yet. Complete a goal on the Dashboard to see it here.
                </p>
            </div>`;
        return;
    }

    // Group by date
    const groups = {};
    archive.forEach(item => {
        const d = new Date(item.completedAt);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        let label;
        if (d.toDateString() === today.toDateString()) label = 'Today';
        else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
        else label = d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
    });

    let html = `
        <div style="margin-bottom:24px;">
            <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Daily Archive</h2>
            <p style="color:var(--text-secondary); font-size:0.85rem;">${archive.length} goals completed so far. Every win counts.</p>
        </div>`;

    for (const [dateLabel, items] of Object.entries(groups)) {
        html += `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-title" style="margin-bottom:16px;">
                    <i class="ph ph-calendar-check"></i> ${dateLabel}
                    <span style="margin-left:auto; background:var(--accent-soft); color:var(--accent); padding:2px 8px; border-radius:20px; font-size:0.7rem;">${items.length} wins</span>
                </div>
                <ul class="goal-list">
                    ${items.map(item => `
                        <li class="goal-item completed">
                            <i class="ph-fill ph-check-circle" style="color:var(--safe); font-size:1rem; flex-shrink:0;"></i>
                            <span class="goal-text">${item.text}</span>
                            <span class="goal-type-badge">${item.type}</span>
                            <span style="font-size:0.72rem; color:var(--text-muted);">${new Date(item.completedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
                        </li>`).join('')}
                </ul>
            </div>`;
    }

    container.innerHTML = html;
}

// ======================== COMPANIES & SOURCES ========================
function getIconForLink(link) {
    if (!link) return 'ph-link';
    const l = link.toLowerCase();
    if (l.includes('linkedin.com')) return 'ph-linkedin-logo';
    return 'ph-link';
}

function formatURL(link) {
    if (!link) return '#';
    const l = link.trim();
    if (!/^https?:\/\//i.test(l)) {
        return 'https://' + l;
    }
    return l;
}

function getIconForFieldLabel(label, value) {
    if (label === 'LinkedIn') return 'ph-linkedin-logo';
    if (label === 'Email') return 'ph-envelope';
    if (label === 'Phone') return 'ph-phone';
    if (label === 'GitHub') return 'ph-github-logo';
    if (label === 'Twitter') return 'ph-twitter-logo';
    if (label === 'Link') return getIconForLink(value);
    return 'ph-link';
}

function getFieldURL(label, value) {
    if (!value) return '';
    const clean = value.trim();
    if (label === 'Email') return `mailto:${clean}`;
    if (label === 'Phone') return `tel:${clean}`;
    return formatURL(clean);
}

function migrateFields(item, key) {
    if (!item.fields) {
        item.fields = [];
    }
    if (item.fields.length === 0) {
        // Migrate old singular properties if they exist
        if (item.link) {
            item.fields.push({ label: 'LinkedIn', value: item.link });
            delete item.link;
        }
        if (item.email) {
            item.fields.push({ label: 'Email', value: item.email });
            delete item.email;
        }
        if (item.phone) {
            item.fields.push({ label: 'Phone', value: item.phone });
            delete item.phone;
        }
    }
    
    // If still empty, populate sensible default fields
    if (item.fields.length === 0) {
        if (key === 'people') {
            item.fields.push({ label: 'LinkedIn', value: '' });
            item.fields.push({ label: 'Email', value: '' });
            item.fields.push({ label: 'Phone', value: '' });
        } else {
            item.fields.push({ label: 'Link', value: '' });
        }
    }
    return item.fields;
}

function renderContacts(container) {
    const data = getData();
    const categories = [
        { key: 'companies', label: 'Companies',      icon: 'ph-buildings',     placeholder: 'Add company...' },
        { key: 'people',    label: 'Key Contacts',   icon: 'ph-users-three',   placeholder: 'Add contact...' },
        { key: 'portals',   label: 'Job Portals',    icon: 'ph-browser',       placeholder: 'Add portal...' }
    ];

    const activeKey = window._activeTargetTab || 'companies';
    const activeCat = categories.find(c => c.key === activeKey) || categories[0];
    const items = data[activeCat.key] || [];

    let html = `
        <div style="margin-bottom:24px;">
            <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Target Board & Sources</h2>
            <p style="color:var(--text-secondary); font-size:0.85rem;">Manage your target companies, key outreach contacts, and job search portals in one place.</p>
        </div>
        
        <!-- BOARD TABS -->
        <div class="board-tabs-wrapper">
            ${categories.map(cat => {
                const count = (data[cat.key] || []).length;
                return `
                    <button class="board-tab-btn ${cat.key === activeKey ? 'active' : ''}" data-tab="${cat.key}">
                        <i class="ph ${cat.icon}"></i> ${cat.label}
                        <span class="board-tab-badge">${count}</span>
                    </button>
                `;
            }).join('')}
        </div>
        
        <div id="col-${activeCat.key}" style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; width:100%; box-sizing:border-box; margin-bottom:20px;">
                    ${items.length === 0 ? `
                        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 0.9rem; border: 1px dashed var(--border); border-radius: var(--radius-md);">
                            <i class="ph ph-folder-open" style="font-size: 2rem; margin-bottom: 8px; display: block; color: var(--text-muted);"></i>
                            No items yet. Type a name below to add your first ${activeCat.label.toLowerCase().slice(0, -1)}!
                        </div>
                    ` : items.map((item, idx) => {
                        const fields = migrateFields(item, activeCat.key);
                        const isPicked = window._pickedContactIndex === idx && window._pickedContactKey === activeCat.key;
                        return `
                            <article class="target-card${isPicked ? ' keyboard-picked' : ''}" draggable="true" data-key="${activeCat.key}" data-idx="${idx}" tabindex="0" role="listitem" aria-roledescription="draggable card" aria-label="${item.name || 'Unnamed contact'}. Press Space to select for keyboard reordering. Use Up/Down arrows to swap. Press E or Enter to edit name.">
                                <div class="target-card-header">
                                    <div class="target-card-name" contenteditable="true" placeholder="Name" data-field="name">${item.name || ''}</div>
                                    <div class="target-card-controls" style="display:flex; align-items:center; gap:6px;">
                                        <i class="ph ph-push-pin target-card-control pin-btn" title="Move to Top" style="cursor:pointer; font-size:0.85rem;" tabindex="0" role="button" aria-label="Pin ${item.name || 'item'} to top"></i>
                                        <i class="ph ph-caret-up target-card-control up-btn" title="Move Up" style="cursor:pointer; font-size:0.95rem;" tabindex="0" role="button" aria-label="Move ${item.name || 'item'} up"></i>
                                        <i class="ph ph-caret-down target-card-control down-btn" title="Move Down" style="cursor:pointer; font-size:0.95rem;" tabindex="0" role="button" aria-label="Move ${item.name || 'item'} down"></i>
                                        <i class="ph ph-trash target-card-delete" title="Delete" tabindex="0" role="button" aria-label="Delete ${item.name || 'item'}"></i>
                                    </div>
                                </div>

                                <!-- DYNAMIC FIELDS (UP TO 10) -->
                                <div class="target-card-fields" style="display:flex; flex-direction:column; gap:8px; margin-top:6px; margin-bottom:6px;">
                                    ${fields.map((f, fIdx) => `
                                        <div class="target-card-field-row" data-fidx="${fIdx}">
                                            <i class="ph ${getIconForFieldLabel(f.label, f.value)} target-card-link-icon"></i>
                                            <select class="target-card-field-label">
                                                <option value="LinkedIn" ${f.label === 'LinkedIn' ? 'selected' : ''}>LinkedIn</option>
                                                <option value="Link" ${f.label === 'Link' ? 'selected' : ''}>Link</option>
                                                <option value="Email" ${f.label === 'Email' ? 'selected' : ''}>Email</option>
                                                <option value="Phone" ${f.label === 'Phone' ? 'selected' : ''}>Phone</option>
                                                <option value="GitHub" ${f.label === 'GitHub' ? 'selected' : ''}>GitHub</option>
                                                <option value="Twitter" ${f.label === 'Twitter' ? 'selected' : ''}>Twitter</option>
                                                <option value="Other" ${f.label === 'Other' ? 'selected' : ''}>Other</option>
                                            </select>
                                            <div class="target-card-link-text" contenteditable="true" placeholder="Enter details..." data-field="field-value">${f.value || ''}</div>
                                            <div style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; flex-shrink:0;">
                                                ${f.value ? `<a href="${getFieldURL(f.label, f.value)}" target="_blank" class="target-card-link-go" title="Open Link"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                                            </div>
                                            <div style="display:flex; align-items:center; justify-content:center; width:24px; height:24px; flex-shrink:0;">
                                                <i class="ph ph-x remove-field-btn" title="Remove field"></i>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>

                                <div class="target-card-footer" style="display:flex; align-items:center; justify-content:space-between; margin-top:2px; margin-bottom:8px; padding:0 4px;">
                                    ${fields.length < 10 ? `
                                        <div class="add-field-btn" style="cursor:pointer; font-size:0.72rem; color:var(--accent); font-weight:600; display:inline-flex; align-items:center; gap:4px;" title="Add input field (up to 10)">
                                            <i class="ph ph-plus-circle"></i> Add Field
                                        </div>
                                    ` : '<div style="font-size:0.68rem; color:var(--text-muted); font-weight:500;">Max 10 fields reached</div>'}
                                </div>

                                <div class="target-card-desc" contenteditable="true" placeholder="Add description..." data-field="description">${item.description || ''}</div>
                            </article>
                        `;
                    }).join('')}
        </div>

        <!-- ADD BAR -->
        <div style="padding-top:16px; border-top:1px solid var(--border); display:flex; gap:8px; max-width:480px; width:100%;">
            <input type="text" id="add-${activeCat.key}" placeholder="${activeCat.placeholder}" style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:8px 12px; flex:1; box-sizing:border-box;">
            <button data-cat="${activeCat.key}" class="add-target-btn">
                <i class="ph ph-plus" style="font-weight:700;"></i> Add Item
            </button>
        </div>`;

    container.innerHTML = html;

    // Re-apply grid via JS to ensure nothing overrides it
    const _grid = document.getElementById('col-' + activeKey);
    if (_grid) {
        _grid.style.setProperty('display',               'grid',                      'important');
        _grid.style.setProperty('grid-template-columns', 'repeat(3,minmax(0,1fr))',   'important');
        _grid.style.setProperty('gap',                   '20px',                      'important');
        _grid.style.setProperty('width',                 '100%',                      'important');
        _grid.style.setProperty('box-sizing',            'border-box',                'important');
    }

    // Event delegation for blur (auto-saving)
    container.addEventListener('blur', (e) => {
        const target = e.target;
        if (!target.hasAttribute('data-field')) return;

        const card = target.closest('.target-card');
        if (!card) return;

        const key = card.dataset.key;
        const idx = parseInt(card.dataset.idx);
        const field = target.dataset.field;
        const val = target.textContent.trim();

        const d = getData();
        if (d[key] && d[key][idx]) {
            if (field === 'field-value') {
                const fIdx = parseInt(target.closest('.target-card-field-row').dataset.fidx);
                const fields = migrateFields(d[key][idx], key);
                if (fields[fIdx]) {
                    const oldVal = fields[fIdx].value || '';
                    if (oldVal !== val) {
                        fields[fIdx].value = val;
                        d[key][idx].fields = fields;
                        saveData(d);
                        renderContacts(container);
                    }
                }
            } else {
                const oldVal = d[key][idx][field] || '';
                if (oldVal !== val) {
                    d[key][idx][field] = val;
                    saveData(d);
                }
            }
        }
    }, true);

    // Tab switching event listeners
    container.querySelectorAll('.board-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            window._activeTargetTab = tab;
            renderContacts(container);
        });
    });

    // Event listeners for Card Rearrangement Controls
    container.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            const d = getData();
            if (d[key] && d[key][idx]) {
                const item = d[key].splice(idx, 1)[0];
                d[key].unshift(item);
                saveData(d);
                renderContacts(container);
                showToast(`Pinned "${item.name || 'item'}" to top.`, 'success');
                announce(`Pinned ${item.name || 'item'} to top.`);
            }
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    container.querySelectorAll('.up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            if (idx > 0) {
                const d = getData();
                if (d[key] && d[key][idx]) {
                    const temp = d[key][idx];
                    d[key][idx] = d[key][idx - 1];
                    d[key][idx - 1] = temp;
                    saveData(d);
                    renderContacts(container);
                    const nextCard = container.querySelector(`.target-card[data-key="${key}"][data-idx="${idx - 1}"]`);
                    nextCard?.focus();
                    announce(`Moved ${temp.name || 'item'} up to position ${idx}.`);
                }
            }
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    container.querySelectorAll('.down-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            const d = getData();
            if (d[key] && idx < d[key].length - 1) {
                const temp = d[key][idx];
                d[key][idx] = d[key][idx + 1];
                d[key][idx + 1] = temp;
                saveData(d);
                renderContacts(container);
                const nextCard = container.querySelector(`.target-card[data-key="${key}"][data-idx="${idx + 1}"]`);
                nextCard?.focus();
                announce(`Moved ${temp.name || 'item'} down to position ${idx + 2}.`);
            }
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    // Event listeners for Delete Buttons
    container.querySelectorAll('.target-card-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);

            const d = getData();
            if (d[key] && d[key][idx]) {
                const removedName = d[key][idx].name || 'item';
                d[key].splice(idx, 1);
                saveData(d);
                renderContacts(container);
                showToast(`Removed "${removedName}".`, 'success');
                announce(`Removed ${removedName}.`);
            }
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                btn.click();
            }
        });
    });

    // HTML5 Drag and Drop Sorting within sections
    let dragSrcEl = null;

    container.querySelectorAll('.target-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            // Check if focus is in input or contenteditable to avoid breaking typing selection
            if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') {
                e.preventDefault();
                return;
            }
            dragSrcEl = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.idx);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            container.querySelectorAll('.target-card').forEach(c => c.classList.remove('drag-over'));
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        });

        card.addEventListener('dragenter', (e) => {
            if (dragSrcEl && dragSrcEl !== card && dragSrcEl.dataset.key === card.dataset.key) {
                card.classList.add('drag-over');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (dragSrcEl && dragSrcEl !== card && dragSrcEl.dataset.key === card.dataset.key) {
                const key = card.dataset.key;
                const fromIdx = parseInt(dragSrcEl.dataset.idx);
                const toIdx = parseInt(card.dataset.idx);
                
                const d = getData();
                if (d[key]) {
                    const item = d[key].splice(fromIdx, 1)[0];
                    d[key].splice(toIdx, 0, item);
                    saveData(d);
                    renderContacts(container);
                    showToast(`Reordered successfully.`, 'success');
                }
            }
            return false;
        });
    });

    // Change select label
    container.querySelectorAll('.target-card-field-label').forEach(select => {
        select.addEventListener('change', () => {
            const card = select.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            const fIdx = parseInt(select.closest('.target-card-field-row').dataset.fidx);
            
            const d = getData();
            if (d[key] && d[key][idx]) {
                const fields = migrateFields(d[key][idx], key);
                if (fields[fIdx]) {
                    fields[fIdx].label = select.value;
                    d[key][idx].fields = fields;
                    saveData(d);
                    renderContacts(container);
                }
            }
        });
    });

    // Add field button
    container.querySelectorAll('.add-field-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            
            const d = getData();
            if (d[key] && d[key][idx]) {
                const fields = migrateFields(d[key][idx], key);
                if (fields.length < 10) {
                    const defaultLabel = key === 'people' ? 'Email' : 'Link';
                    fields.push({ label: defaultLabel, value: '' });
                    d[key][idx].fields = fields;
                    saveData(d);
                    renderContacts(container);
                }
            }
        });
    });

    // Remove field button
    container.querySelectorAll('.remove-field-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.target-card');
            const key = card.dataset.key;
            const idx = parseInt(card.dataset.idx);
            const fIdx = parseInt(btn.closest('.target-card-field-row').dataset.fidx);
            
            const d = getData();
            if (d[key] && d[key][idx]) {
                const fields = migrateFields(d[key][idx], key);
                fields.splice(fIdx, 1);
                d[key][idx].fields = fields;
                saveData(d);
                renderContacts(container);
            }
        });
    });

    // Event listeners for Add Buttons (Defensive Sibling Fallback included)
    container.querySelectorAll('.add-target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            const input = document.getElementById(`add-${cat}`) || btn.previousElementSibling;
            const val = input.value.trim();
            if (!val) return;
            const d = getData();
            if (!d[cat]) d[cat] = [];
            
            const newItem = { name: val, description: '', fields: [] };
            if (cat === 'people') {
                newItem.fields = [
                    { label: 'LinkedIn', value: '' },
                    { label: 'Email', value: '' },
                    { label: 'Phone', value: '' }
                ];
            } else {
                newItem.fields = [
                    { label: 'Link', value: '' }
                ];
            }
            
            d[cat].push(newItem);
            saveData(d);
            input.value = '';
            renderContacts(container);
            showToast(`Added "${val}" successfully.`, 'success');
        });
    });

    // Enter Key on Inputs to Add Item (Defensive Sibling Fallback included)
    container.querySelectorAll('input[id^="add-"]').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cat = input.id ? input.id.replace('add-', '') : '';
                const val = input.value.trim();
                if (!val) return;
                const d = getData();
                if (!cat) return;
                if (!d[cat]) d[cat] = [];
                
                const newItem = { name: val, description: '', fields: [] };
                if (cat === 'people') {
                    newItem.fields = [
                        { label: 'LinkedIn', value: '' },
                        { label: 'Email', value: '' },
                        { label: 'Phone', value: '' }
                    ];
                } else {
                    newItem.fields = [
                        { label: 'Link', value: '' }
                    ];
                }
                
                d[cat].push(newItem);
                saveData(d);
                input.value = '';
                renderContacts(container);
                showToast(`Added "${val}" successfully.`, 'success');
            }
        });
    });
}

// ======================== LIFE COACH ========================
function renderCoach(container) {
    const data = getData();
    const reminder = data.coach.reminders[Math.floor(Math.random() * data.coach.reminders.length)];
    container.innerHTML = `
        <div class="card" style="border-left:3px solid var(--accent); margin-bottom:20px;">
            <div class="card-title"><i class="ph-fill ph-lightning" style="color:var(--accent)"></i> Daily Reality Check</div>
            <p style="font-size:1.05rem; font-weight:500; line-height:1.6;">"${reminder}"</p>
        </div>

        <div class="content-grid" style="margin-bottom:20px;">
            <div class="card">
                <div class="card-title"><i class="ph ph-warning-circle" style="color:var(--danger)"></i> Known Constraints</div>
                <ul style="list-style:none; display:flex; flex-direction:column; gap:8px;">
                    ${data.coach.weaknesses.map(w => `
                        <li style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:var(--bg-surface); border-radius:8px; font-size:0.87rem;">
                            <i class="ph-fill ph-x-circle" style="color:var(--danger); font-size:1rem; flex-shrink:0;"></i>${w}
                        </li>`).join('')}
                </ul>
            </div>
            <div class="card">
                <div class="card-title"><i class="ph ph-shooting-star" style="color:var(--accent)"></i> Core Strengths</div>
                <ul style="list-style:none; display:flex; flex-direction:column; gap:8px;">
                    ${data.coach.strengths.map(s => `
                        <li style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:var(--bg-surface); border-radius:8px; font-size:0.87rem;">
                            <i class="ph-fill ph-check-circle" style="color:var(--safe); font-size:1rem; flex-shrink:0;"></i>${s}
                        </li>`).join('')}
                </ul>
            </div>
        </div>

        <div class="card">
            <div class="card-title"><i class="ph ph-timer"></i> ADHD Focus Block Protocol</div>
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:4px;">
                <div style="background:var(--bg-surface); padding:16px; border-radius:10px; border-left:3px solid var(--accent);">
                    <strong style="font-size:0.85rem;">Phase 1 — Warm Up (30 min)</strong>
                    <p style="color:var(--text-secondary); font-size:0.83rem; margin-top:4px;">Put phone away, close irrelevant tabs. Start a micro-task: set up Figma grids, read a JD, organize your Notion.</p>
                </div>
                <div style="background:var(--bg-surface); padding:16px; border-radius:10px; border-left:3px solid var(--safe);">
                    <strong style="font-size:0.85rem;">Phase 2 — Engagement (1 hr)</strong>
                    <p style="color:var(--text-secondary); font-size:0.83rem; margin-top:4px;">Build momentum. Start working on the real task. Ignore urge to switch apps.</p>
                </div>
                <div style="background:var(--bg-surface); padding:16px; border-radius:10px; border-left:3px solid var(--mod);">
                    <strong style="font-size:0.85rem;">Phase 3 — Deep Work (2+ hrs)</strong>
                    <p style="color:var(--text-secondary); font-size:0.83rem; margin-top:4px;">Do not interrupt for 2 hours. Communicate boundaries with your girlfriend for this block. This is your $200k session.</p>
                </div>
            </div>
        </div>`;
}

// ======================== SKILLS ========================
function categorizeSkills(allSkills) {
    const cats = {
        'Coding Language':  { icon: 'ph-code',               color: '#3b82f6', items: [] },
        'Design Skills':    { icon: 'ph-pen-nib',            color: '#ec4899', items: [] },
        'Tools & Software': { icon: 'ph-wrench',             color: '#e8a020', items: [] },
        'Hard Skills':      { icon: 'ph-brain',              color: '#8b5cf6', items: [] },
        'Soft Skills':      { icon: 'ph-users',              color: '#22c55e', items: [] },
        'Traits & Habits':  { icon: 'ph-repeat',             color: '#06b6d4', items: [] },
        'Personality':      { icon: 'ph-person-arms-spread', color: '#f43f5e', items: [] },
        'Other':            { icon: 'ph-dots-three',         color: '#64748b', items: [] }
    };
    const kw = {
        coding:  ['react','typescript','html','css','javascript','swift','api','github','code','llm','gpt','tailwind'],
        design:  ['design system','component','ui','ux','user research','prototyp','animation','motion','brand','visual','seo'],
        tools:   ['figma','framer','amplitude','cursor','claude','software'],
        hard:    ['analytics','b2b','saas','metrics','domain','enterprise','tech','strategy','data','platform','qa','testing'],
        soft:    ['communication','collaboration','leadership','ownership','empathy','storytell','influence','feedback','agile'],
        traits:  ['ambiguous','drive','curiosity','self-starter','nimble','scrappy','iterate','ship','urgency','action'],
        person:  ['culture','excitement','ambitious','kind','mentality','mindset']
    };
    allSkills.forEach(s => {
        const l = s.text.toLowerCase();
        if      (kw.coding.some(k => l.includes(k))) cats['Coding Language'].items.push(s);
        else if (kw.tools.some(k  => l.includes(k))) cats['Tools & Software'].items.push(s);
        else if (kw.design.some(k => l.includes(k))) cats['Design Skills'].items.push(s);
        else if (kw.soft.some(k   => l.includes(k))) cats['Soft Skills'].items.push(s);
        else if (kw.traits.some(k => l.includes(k))) cats['Traits & Habits'].items.push(s);
        else if (kw.person.some(k => l.includes(k))) cats['Personality'].items.push(s);
        else if (s.priority === 'hard' || kw.hard.some(k => l.includes(k))) cats['Hard Skills'].items.push(s);
        else cats['Other'].items.push(s);
        
        // Save the matched category into the skill object for filtering later
        s.category = Object.keys(cats).find(key => cats[key].items.includes(s)) || 'Other';
    });
    return cats;
}

function renderSkills(container) {
    const data = getData();
    if (!data.skills.completed) data.skills.completed = [];
    const completedList = data.skills.completed;

    const allSkills = [
        ...(data.skills.hard     || []).map(s => ({ text: s, priority: 'hard', completed: completedList.includes(s) })),
        ...(data.skills.moderate || []).map(s => ({ text: s, priority: 'mod', completed: completedList.includes(s) })),
        ...(data.skills.soft     || []).map(s => ({ text: s, priority: 'soft', completed: completedList.includes(s) }))
    ];
    const categories = categorizeSkills(allSkills);
    const catNames   = Object.keys(categories);
    const catCounts  = catNames.map(n => categories[n].items.length);
    const catColors  = catNames.map(n => categories[n].color);
    const mustCount  = allSkills.filter(s => s.priority === 'hard').length;
    const shouldCount= allSkills.filter(s => s.priority === 'mod').length;
    const niceCount  = allSkills.filter(s => s.priority === 'soft').length;
    const savedKey   = localStorage.getItem('geminiApiKey') || '';
    const isDark     = !document.body.classList.contains('light');
    const gridColor  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const labelColor = isDark ? '#8a8a9a' : '#666678';

    if (!localStorage.getItem('geminiApiKey')) {
        localStorage.setItem('geminiApiKey', 'AIzaSyDM8nW-nKZH1c8JlxIX7Gywvvybd5CqGiY');
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
            <div>
                <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Skills & Gaps</h2>
                <p style="color:var(--text-secondary); font-size:0.85rem;">${allSkills.length} gaps across job descriptions — here's your exact roadmap.</p>
            </div>
        </div>

        <!-- JD PARSER (Concise & Top) -->
        <div class="card" style="margin-bottom:24px; display:flex; gap:12px; align-items:flex-start; padding:12px 16px; border: 1px solid rgba(232, 160, 32, 0.2); background: linear-gradient(145deg, var(--bg-surface) 0%, rgba(232, 160, 32, 0.05) 100%);">
            <i class="ph ph-magic-wand" style="color:var(--accent); font-size:1.4rem; margin-top:10px;"></i>
            <div style="flex:1;">
                <textarea id="jd-input" style="width:100%; height:44px; resize:vertical; min-height:44px; margin-bottom:0; background:transparent; border:none; padding:12px 0; color:var(--text-primary); font-size:0.9rem;" placeholder="Paste a new Job Description here to instantly extract missing skills with Gemini AI..."></textarea>
            </div>
            <button id="analyze-jd-btn" class="primary-btn" style="flex-shrink:0; height:40px; padding:0 20px; display:flex; align-items:center; gap:8px; margin-top:2px;">
                Analyze
            </button>
        </div>

        <!-- CHART ROW -->
        <div class="content-grid" style="margin-bottom:20px;">
            <div class="chart-card">
                <div class="chart-title"><i class="ph ph-chart-pie-slice"></i> Gap Distribution by Type</div>
                <div style="display:flex; align-items:center; gap:24px;">
                    <div style="position:relative; width:180px; height:180px; flex-shrink:0;">
                        <canvas id="skill-donut" width="180" height="180"></canvas>
                        <div class="donut-center">
                            <div class="big-num">${allSkills.length}</div>
                            <div class="small-label">Gaps</div>
                        </div>
                    </div>
                    <div style="flex:1;">
                        ${catNames.map((n, i) => `
                        <div class="progress-item">
                            <div class="progress-header">
                                <span class="progress-label"><span class="legend-dot" style="background:${catColors[i]}"></span>${n}</span>
                                <span class="progress-value">${catCounts[i]}</span>
                            </div>
                            <div class="progress-track"><div class="progress-fill" style="width:${allSkills.length ? Math.round(catCounts[i]/allSkills.length*100) : 0}%; background:${catColors[i]};"></div></div>
                        </div>`).join('')}
                    </div>
                </div>
            </div>

            <div class="chart-card">
                <div class="chart-title"><i class="ph ph-chart-bar"></i> Priority Breakdown</div>
                <div class="chart-wrap" style="height:200px;">
                    <canvas id="priority-bar"></canvas>
                </div>
            </div>
        </div>

        <!-- FILTER BAR -->
        <div id="skills-filter-bar" style="display:flex; gap:8px; overflow-x:auto; margin-bottom:16px; padding-bottom:8px; white-space:nowrap; scrollbar-width:thin;">
            <button class="filter-chip ${!window._currentSkillFilter || window._currentSkillFilter === 'All' ? 'active' : ''}" data-filter="All" style="padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:${!window._currentSkillFilter || window._currentSkillFilter === 'All' ? 'var(--accent)' : 'var(--bg-surface)'}; color:${!window._currentSkillFilter || window._currentSkillFilter === 'All' ? '#000' : 'var(--text-primary)'}; font-size:0.8rem; cursor:pointer; font-weight:600; transition:all 0.2s;">All</button>
            ${catNames.map(n => `
                <button class="filter-chip ${window._currentSkillFilter === n ? 'active' : ''}" data-filter="${n}" style="padding:6px 14px; border-radius:20px; border:1px solid var(--border); background:${window._currentSkillFilter === n ? categories[n].color : 'var(--bg-surface)'}; color:${window._currentSkillFilter === n ? '#000' : 'var(--text-primary)'}; font-size:0.8rem; cursor:pointer; font-weight:600; transition:all 0.2s;">
                    <i class="ph ${categories[n].icon}" style="margin-right:4px;"></i>${n}
                </button>
            `).join('')}
        </div>

        <!-- TABLE VIEW -->
        <div id="skills-table-view">
            <div class="chart-card" style="overflow:auto; margin-bottom:20px; padding:0;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="padding-left:20px; width:40px;"><i class="ph ph-check-square" style="font-size:1.1rem;"></i></th>
                            <th>Gap / Skill Needed</th>
                            <th>Type</th>
                            <th>Priority</th>
                        </tr>
                    </thead>
                    <tbody id="skills-tbody">
                        ${(window._currentSkillFilter && window._currentSkillFilter !== 'All' ? allSkills.filter(s => s.category === window._currentSkillFilter) : allSkills).map((s, i) => {
                            const catName = s.category;
                            const catColor = categories[catName] ? categories[catName].color : '#3b82f6';
                            const catIcon  = categories[catName] ? categories[catName].icon  : 'ph-code';
                            const prLabel  = s.priority === 'hard' ? 'MUST' : s.priority === 'mod' ? 'SHOULD' : 'NICE';
                            return `<tr>
                                <td style="padding-left:20px;">
                                    <input type="checkbox" class="skill-checkbox" data-text="${s.text.replace(/"/g,'&quot;')}" ${s.completed ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:var(--accent);">
                                </td>
                                <td><span style="font-weight:500; transition:all 0.2s; ${s.completed ? 'text-decoration:line-through; color:var(--text-muted); opacity:0.6;' : ''}">${s.text}</span></td>
                                <td><span class="category-badge" style="color:${catColor}; background:${catColor}18; ${s.completed ? 'opacity:0.5;' : ''}"><i class="ph ${catIcon}" style="font-size:0.8rem;"></i>${catName.split(' ').slice(0,2).join(' ')}</span></td>
                                <td><span class="priority-badge ${s.priority}" style="${s.completed ? 'opacity:0.5;' : ''}">${prLabel}</span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

    `;

    // Destroy previous chart instances if they exist to prevent Chart.js reuse errors
    if (window.skillDonutChart) {
        window.skillDonutChart.destroy();
    }
    if (window.priorityBarChart) {
        window.priorityBarChart.destroy();
    }

    // --- Charts ---
    window.skillDonutChart = new Chart(document.getElementById('skill-donut'), {
        type: 'doughnut',
        data: {
            labels: catNames,
            datasets: [{ data: catCounts.map(c => c || 0.01), backgroundColor: catColors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } }, animation: { duration: 600 } }
    });

    window.priorityBarChart = new Chart(document.getElementById('priority-bar'), {
        type: 'bar',
        data: {
            labels: ['Must Have', 'Should Have', 'Nice to Have'],
            datasets: [{
                label: 'Gaps',
                data: [mustCount, shouldCount, niceCount],
                backgroundColor: ['rgba(239,68,68,0.75)', 'rgba(245,158,11,0.75)', 'rgba(34,197,94,0.75)'],
                borderRadius: 6, borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11 }, precision: 0 }, beginAtZero: true },
                y: { grid: { display: false }, ticks: { color: labelColor, font: { size: 11, weight: '600' } } }
            },
            animation: { duration: 600 }
        }
    });

    // --- Checkbox toggle ---
    container.querySelectorAll('.skill-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const text = e.target.dataset.text;
            const isChecked = e.target.checked;
            const d = getData();
            if (!d.skills.completed) d.skills.completed = [];
            
            if (isChecked) {
                if (!d.skills.completed.includes(text)) d.skills.completed.push(text);
                showToast('Skill marked as completed! 🎯', 'success');
            } else {
                d.skills.completed = d.skills.completed.filter(x => x !== text);
            }
            saveData(d);
            renderSkills(container);
        });
    });

    // --- Filter Chips ---
    container.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            window._currentSkillFilter = e.currentTarget.dataset.filter;
            renderSkills(container);
        });
    });

    // --- JD Parser Event Listener ---
    const analyzeBtn = document.getElementById('analyze-jd-btn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            const jdText = document.getElementById('jd-input').value.trim();
            const apiKey = localStorage.getItem('geminiApiKey');
            
            if (!jdText) return showToast('Please paste a Job Description first.', 'error');
            if (!apiKey) return showToast('API Key missing. Please refresh to configure.', 'error');

            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Analyzing...';

            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `Extract specific missing skills, traits, habits, and tools a candidate would need from this Job Description. Categorize them into a JSON object strictly following this format: {"hard": ["skill1"], "moderate": [], "soft": []}. "hard" means Must Have, "moderate" means Should Have, "soft" means Nice to Have. CRITICAL: Do NOT write sentences. Each item MUST be a concise 1-3 word tag (e.g. "React", "B2B SaaS", "Design Systems"). Only output valid JSON, no markdown formatting. JD: ${jdText}`
                            }]
                        }]
                    })
                });

                const json = await response.json();
                if (json.error) throw new Error(json.error.message);
                
                let textRes = json.candidates[0].content.parts[0].text.trim();
                if (textRes.startsWith('\`\`\`json')) {
                    textRes = textRes.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
                }
                const parsed = JSON.parse(textRes);
                const d = getData();
                let addedCount = 0;
                
                ['hard','moderate','soft'].forEach(k => { 
                    if (parsed[k] && Array.isArray(parsed[k])) {
                        parsed[k].forEach(newText => {
                            if (!d.skills[k].includes(newText)) {
                                d.skills[k].push(newText);
                                addedCount++;
                            }
                        });
                    }
                });
                
                saveData(d);
                showToast(`Analyzed! ${addedCount} new gaps discovered.`, 'success');
                document.getElementById('jd-input').value = '';
                renderSkills(container);
            } catch (err) {
                console.error("Gemini Parsing Error:", err);
                showToast('Analysis failed. Try again.', 'error');
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = 'Analyze';
            }
        });
    }
}

// ======================== NYC FEED ========================
function getISOWeek(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
}

function renderNewsUI(container, feedData, isFetchingNews, isFetchingEvents) {
    let newsHTML = '';
    if (isFetchingNews && feedData.news.length === 0) {
        newsHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;"><i class="ph ph-spinner ph-spin" style="margin-right:6px;"></i>Loading signals...</div>`;
    } else if (feedData.news.length > 0) {
        newsHTML = feedData.news.map(item => `
            <a href="${item.link}" target="_blank" style="text-decoration:none; color:inherit;">
                <div style="background:var(--bg-surface); padding:14px; border-radius:10px; transition:transform 0.2s; cursor:pointer;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <strong style="font-size:0.88rem; color:var(--safe); line-height:1.3; display:block; margin-bottom:4px;">${item.title.replace(/"/g, '&quot;')}</strong>
                    <p style="color:var(--text-secondary); font-size:0.75rem;">${new Date(item.pubDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})} · ${item.source || 'News'}</p>
                </div>
            </a>
        `).join('');
    } else {
        newsHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No signals yet.</div>`;
    }

    let eventsHTML = '';
    if (isFetchingEvents && feedData.events.length === 0) {
        eventsHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;"><i class="ph ph-spinner ph-spin" style="margin-right:6px;"></i>Loading events...</div>`;
    } else if (feedData.events.length > 0) {
        eventsHTML = feedData.events.map(item => `
            <a href="${item.link}" target="_blank" style="text-decoration:none; color:inherit;">
                <div style="background:var(--bg-surface); padding:14px; border-radius:10px; transition:transform 0.2s; cursor:pointer;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <strong style="font-size:0.88rem; color:var(--accent); line-height:1.3; display:block; margin-bottom:4px;">${item.title.replace(/"/g, '&quot;')}</strong>
                    <p style="color:var(--text-secondary); font-size:0.75rem;">Detected: ${new Date(item.pubDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})} · Event Radar</p>
                </div>
            </a>
        `).join('');
    } else {
        eventsHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No events found yet.</div>`;
    }

    container.innerHTML = `
        <div style="margin-bottom:24px;">
            <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">NYC Feed <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">Week ${feedData.currentWeek}</span></h2>
            <p style="color:var(--text-secondary); font-size:0.85rem;">Continuous polling engine. Auto-archives weekly.</p>
        </div>
        <div class="content-grid">
            <div class="card">
                <div class="card-title" style="display:flex; justify-content:space-between;">
                    <span><i class="ph ph-calendar-star" style="color:var(--accent)"></i> Upcoming Events</span>
                    ${isFetchingEvents ? '<i class="ph ph-spinner ph-spin" style="color:var(--accent)"></i>' : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; max-height: 60vh; overflow-y: auto; padding-right:8px;">
                    ${eventsHTML}
                </div>
            </div>
            <div class="card">
                <div class="card-title" style="display:flex; justify-content:space-between;">
                    <span><i class="ph ph-trend-up" style="color:var(--safe)"></i> Market Signals</span>
                    ${isFetchingNews ? '<i class="ph ph-spinner ph-spin" style="color:var(--safe)"></i>' : ''}
                </div>
                <div style="display:flex; flex-direction:column; gap:12px; max-height: 60vh; overflow-y: auto; padding-right:8px;">
                    ${newsHTML}
                </div>
            </div>
        </div>`;
}

function renderNews(container) {
    const data = getData();
    const currentWeek = getISOWeek(new Date());

    if (!data.feed) {
        data.feed = { news: [], events: [], lastNewsFetch: 0, lastEventsFetch: 0, currentWeek: currentWeek };
    }

    // Weekly Archiving Logic
    if (data.feed.currentWeek !== currentWeek) {
        if (!data.archive) data.archive = {};
        if (!data.archive.feeds) data.archive.feeds = [];
        data.archive.feeds.push({
            week: data.feed.currentWeek,
            year: new Date().getFullYear(),
            news: [...data.feed.news],
            events: [...data.feed.events]
        });
        data.feed.news = [];
        data.feed.events = [];
        data.feed.currentWeek = currentWeek;
        saveData(data);
    }

    const now = Date.now();
    let isFetchingNews = false;
    let isFetchingEvents = false;

    // 30-minute News Cache
    if (now - data.feed.lastNewsFetch > 30 * 60 * 1000) {
        isFetchingNews = true;
        const newsQuery = encodeURIComponent('"UX Design" OR "Product Design" OR "AI" OR "Design Engineering" New York');
        const rssUrl = encodeURIComponent(`https://news.google.com/rss/search?q=${newsQuery}&hl=en-US&gl=US&ceid=US:en`);
        
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'ok') {
                    const existingLinks = new Set(data.feed.news.map(x => x.link));
                    const newItems = [];
                    resData.items.forEach(i => {
                        if (!existingLinks.has(i.link)) {
                            newItems.push({ title: i.title, link: i.link, pubDate: i.pubDate, source: i.source });
                        }
                    });
                    if (newItems.length > 0) {
                        data.feed.news = [...newItems, ...data.feed.news];
                        saveData(data);
                    }
                }
                data.feed.lastNewsFetch = Date.now();
                saveData(data);
            })
            .catch(e => {
                console.error("News fetch error", e);
            })
            .finally(() => {
                isFetchingNews = false;
                renderNewsUI(container, data.feed, isFetchingNews, isFetchingEvents);
            });
    }

    // 6-hour Events Cache
    if (now - data.feed.lastEventsFetch > 6 * 60 * 60 * 1000) {
        isFetchingEvents = true;
        const eventsQuery = encodeURIComponent('"UX Design" OR "Product Design" OR "AI" events New York');
        const rssUrl = encodeURIComponent(`https://news.google.com/rss/search?q=${eventsQuery}&hl=en-US&gl=US&ceid=US:en`);
        
        fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`)
            .then(res => res.json())
            .then(resData => {
                if (resData.status === 'ok') {
                    const existingLinks = new Set(data.feed.events.map(x => x.link));
                    const newItems = [];
                    resData.items.forEach(i => {
                        if (!existingLinks.has(i.link)) {
                            newItems.push({ title: i.title, link: i.link, pubDate: i.pubDate });
                        }
                    });
                    if (newItems.length > 0) {
                        data.feed.events = [...newItems, ...data.feed.events];
                        saveData(data);
                    }
                }
                data.feed.lastEventsFetch = Date.now();
                saveData(data);
            })
            .catch(e => {
                console.error("Events fetch error", e);
            })
            .finally(() => {
                isFetchingEvents = false;
                renderNewsUI(container, data.feed, isFetchingNews, isFetchingEvents);
            });
    }

    // Initial Render
    renderNewsUI(container, data.feed, isFetchingNews, isFetchingEvents);
}

// Spin animation
const style = document.createElement('style');
style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } .ph-spin { animation: spin 1s linear infinite; display: inline-block; }`;
document.head.appendChild(style);

// ======================== NOTION LITE EDITOR ENGINE ========================
const NotionEditor = {
    init() {
        document.addEventListener('selectionchange', this.handleSelection.bind(this));
        document.addEventListener('input', this.handleInput.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Toolbar actions
        document.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.toolbar-btn');
            if (btn) {
                e.preventDefault(); // keep selection active
                document.execCommand(btn.dataset.action, false, null);
            }
        });

        // Slash command actions
        document.addEventListener('mousedown', (e) => {
            const slashItem = e.target.closest('.slash-item');
            if (slashItem) {
                e.preventDefault();
                this.executeSlashCommand(slashItem.dataset.type);
            }
        });
    },

    handleSelection() {
        const selection = window.getSelection();
        const toolbar = document.getElementById('notion-floating-toolbar');
        if (!toolbar) return;

        if (!selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const parent = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
            
            if (parent.closest('.notion-block')) {
                const rect = range.getBoundingClientRect();
                toolbar.style.left = `${rect.left + rect.width / 2}px`;
                toolbar.style.top = `${rect.top - 8}px`;
                toolbar.classList.add('active');
                return;
            }
        }
        toolbar.classList.remove('active');
    },

    getCurrentBlock() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        let node = selection.getRangeAt(0).startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        // In a contenteditable, the block is usually the nearest div
        return node.closest('div:not(.notion-block)') || node; 
    },

    handleInput(e) {
        if (!e.target.classList || !e.target.classList.contains('notion-block')) return;
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const block = this.getCurrentBlock();
        if (!block || block === e.target) return; // Wait until they are in a sub-div

        const text = block.textContent;

        // Auto-markdown conversion
        let converted = false;
        if (text === '# ') { block.className = 'notion-h1'; converted = true; }
        else if (text === '## ') { block.className = 'notion-h2'; converted = true; }
        else if (text === '### ') { block.className = 'notion-h3'; converted = true; }
        else if (text === '> ') { block.className = 'notion-quote'; converted = true; }
        else if (text === '---') { 
            block.innerHTML = '<hr class="notion-divider" contenteditable="false">'; 
            const newBlock = document.createElement('div');
            newBlock.innerHTML = '<br>';
            block.parentNode.insertBefore(newBlock, block.nextSibling);
            selection.collapse(newBlock, 0);
            return;
        }
        else if (text === '* ' || text === '- ') { block.className = 'notion-bullet'; converted = true; }
        else if (text === '1. ') { block.className = 'notion-number'; converted = true; }
        else if (text === '[] ') { 
            block.className = 'notion-todo';
            block.innerHTML = '<input type="checkbox"><span contenteditable="true"></span>';
            selection.collapse(block.querySelector('span'), 0);
            return;
        }
        
        // Handle slash command
        const slashMenu = document.getElementById('slash-command-menu');
        if (text.startsWith('/')) {
            const rect = block.getBoundingClientRect();
            slashMenu.style.left = `${rect.left}px`;
            slashMenu.style.top = `${rect.bottom + 4}px`;
            slashMenu.classList.add('active');
            slashMenu.dataset.blockId = Math.random().toString(); // Tag it
            block.dataset.slashTarget = slashMenu.dataset.blockId;
        } else {
            slashMenu.classList.remove('active');
        }

        if (converted) {
            block.textContent = '';
        }
    },

    executeSlashCommand(type) {
        const slashMenu = document.getElementById('slash-command-menu');
        slashMenu.classList.remove('active');
        
        const block = document.querySelector(`div[data-slash-target="${slashMenu.dataset.blockId}"]`);
        if (!block) return;
        
        delete block.dataset.slashTarget;
        block.textContent = ''; // clear the slash

        if (type === 'h1') block.className = 'notion-h1';
        else if (type === 'h2') block.className = 'notion-h2';
        else if (type === 'h3') block.className = 'notion-h3';
        else if (type === 'quote') block.className = 'notion-quote';
        else if (type === 'bullet') block.className = 'notion-bullet';
        else if (type === 'number') block.className = 'notion-number';
        else if (type === 'divider') {
            block.innerHTML = '<hr class="notion-divider" contenteditable="false">';
            const newBlock = document.createElement('div');
            newBlock.innerHTML = '<br>';
            block.parentNode.insertBefore(newBlock, block.nextSibling);
        }
        else if (type === 'todo') {
            block.className = 'notion-todo';
            block.innerHTML = '<input type="checkbox"><span contenteditable="true"></span>';
        }
        else {
            block.className = ''; // standard text
        }
        
        if (type !== 'divider') {
            block.focus();
        }
    },

    handleKeydown(e) {
        // Toggle checkboxes
        if (e.target.type === 'checkbox' && e.target.closest('.notion-todo')) {
            const todo = e.target.closest('.notion-todo');
            if (e.target.checked) todo.classList.add('checked');
            else todo.classList.remove('checked');
            
            // Trigger save
            const mainBlock = e.target.closest('.notion-block');
            if (mainBlock) {
                const event = new Event('input', { bubbles: true });
                mainBlock.dispatchEvent(event);
            }
        }
    }
};

document.addEventListener('firebaseReady', () => {
    NotionEditor.init();
});

// ======================== JOURNAL (KEEP CLONE) ========================
const JOURNAL_COLORS = [
    'var(--bg-card)',                  // Default
    'rgba(242, 139, 130, 0.15)',       // Red
    'rgba(251, 188, 4, 0.15)',         // Orange
    'rgba(255, 244, 117, 0.15)',       // Yellow
    'rgba(204, 255, 144, 0.15)',       // Sage
    'rgba(168, 218, 181, 0.15)',       // Teal
    'rgba(203, 240, 248, 0.15)',       // Blue
    'rgba(174, 203, 250, 0.15)',       // Dark Blue
    'rgba(215, 174, 251, 0.15)',       // Purple
    'rgba(253, 207, 232, 0.15)',       // Pink
    'rgba(230, 201, 168, 0.15)',       // Brown
    'rgba(232, 234, 237, 0.15)'        // Gray
];

function renderJournal(container) {
    const data = getData();
    if (!data.journal) data.journal = [];

    // Filter and sort notes
    const activeNotes = data.journal.filter(n => !n.archived);
    const archivedNotes = data.journal.filter(n => n.archived).sort((a, b) => b.created - a.created);
    
    const pinnedNotes = activeNotes.filter(n => n.pinned).sort((a, b) => b.created - a.created);
    const otherNotes = activeNotes.filter(n => !n.pinned).sort((a, b) => b.created - a.created);

    // Load draft state
    let draftStr = localStorage.getItem('journalDraft');
    let draft = draftStr ? JSON.parse(draftStr) : { title: '', body: '', color: 'var(--bg-card)', pinned: false, isChecklist: false, isExpanded: false };

    // Helper to render a grid of notes
    const renderNoteGrid = (notes, sectionTitle = null) => {
        if (notes.length === 0) return '';
        
        let sectionHeader = sectionTitle ? `<div class="journal-section-label">${sectionTitle}</div>` : '';
        
        const gridHtml = notes.map(note => {
            let bodyHTML = `<div class="journal-note-body notion-block" contenteditable="true" data-id="${note.id}" data-placeholder="Note">${note.body}</div>`;

            return `
            <div class="journal-note" style="background:${note.color};" tabindex="0" role="listitem" aria-label="Journal entry">
                <button class="journal-action-btn j-action-pin pin-top-right ${note.pinned ? 'active' : ''}" data-id="${note.id}" title="${note.pinned ? 'Unpin' : 'Pin note'}">
                    <i class="ph ${note.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'}"></i>
                </button>
                
                <div class="journal-note-title" contenteditable="true" data-id="${note.id}" placeholder="Title">${note.title || ''}</div>
                ${bodyHTML}
                
                <div class="journal-note-toolbar">
                    <div class="toolbar-left">
                        <div style="position:relative;">
                            <button class="journal-action-btn j-action-color" data-id="${note.id}" title="Change color">
                                <i class="ph ph-palette"></i>
                            </button>
                            <div class="color-picker j-color-picker-${note.id}">
                                ${JOURNAL_COLORS.map(c => `<div class="color-swatch edit-color-swatch" data-id="${note.id}" data-color="${c}" style="background:${c};"></div>`).join('')}
                            </div>
                        </div>
                        <button class="journal-action-btn j-action-archive" data-id="${note.id}" title="${note.archived ? 'Unarchive' : 'Archive'}">
                            <i class="ph ${note.archived ? 'ph-upload-simple' : 'ph-archive-box'}"></i>
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <button class="journal-action-btn j-action-delete" data-id="${note.id}" title="Delete">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
            ${sectionHeader}
            <div class="journal-masonry">${gridHtml}</div>
        `;
    };

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:24px;">
            <div>
                <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Journal & Notes</h2>
            </div>
        </div>

        <!-- EXPANDABLE COMPOSER -->
        <div class="journal-composer-wrapper">
            <div class="journal-composer ${draft.isExpanded ? 'expanded' : ''}" id="j-composer" style="background:${draft.color};">
                
                <!-- Collapsed State (Just the fake input + icons) -->
                <div class="composer-collapsed" id="j-comp-collapsed" style="display:${draft.isExpanded ? 'none' : 'flex'}">
                    <div class="fake-input">Take a note...</div>
                    <div class="quick-actions">
                        <button class="journal-action-btn" id="j-comp-quick-check" title="New list"><i class="ph ph-check-square"></i></button>
                    </div>
                </div>

                <!-- Expanded State -->
                <div class="composer-expanded" id="j-comp-expanded" style="display:${draft.isExpanded ? 'block' : 'none'}">
                    <div class="composer-header">
                        <input type="text" id="j-comp-title" class="composer-title-input" placeholder="Title" value="${draft.title.replace(/"/g, '&quot;')}">
                        <button class="journal-action-btn j-comp-pin ${draft.pinned ? 'active' : ''}" id="j-comp-pin" title="Pin note">
                            <i class="ph ${draft.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'}"></i>
                        </button>
                    </div>
                    
                    <div id="j-comp-body" contenteditable="true" class="composer-body-input notion-block" data-placeholder="${draft.isChecklist ? 'List item...' : 'Take a note...'}">${draft.body}</div>
                    
                    <div class="composer-toolbar">
                        <div class="toolbar-left">
                            <button class="journal-action-btn ${draft.isChecklist ? 'active' : ''}" id="j-comp-check" title="Toggle checklist">
                                <i class="ph ph-list-checks"></i>
                            </button>
                            <div style="position:relative;">
                                <button class="journal-action-btn" id="j-comp-color" title="Change color">
                                    <i class="ph ph-palette"></i>
                                </button>
                                <div class="color-picker" id="j-comp-color-picker">
                                    ${JOURNAL_COLORS.map((c) => `<div class="color-swatch new-color-swatch" data-color="${c}" style="background:${c};"></div>`).join('')}
                                </div>
                            </div>
                        </div>
                        <div class="toolbar-right">
                            <button class="composer-close-btn" id="j-comp-close">Create</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- NOTES BOARDS -->
        <div class="journal-boards">
            ${pinnedNotes.length > 0 ? renderNoteGrid(pinnedNotes, 'PINNED') : ''}
            ${otherNotes.length > 0 ? renderNoteGrid(otherNotes, pinnedNotes.length > 0 ? 'OTHERS' : null) : ''}
            ${archivedNotes.length > 0 ? renderNoteGrid(archivedNotes, 'ARCHIVE') : ''}
            ${data.journal.length === 0 ? `
                <div style="text-align:center; padding: 60px 20px; color:var(--text-muted);">
                    <i class="ph ph-lightbulb" style="font-size:3rem; margin-bottom:16px; opacity:0.5;"></i>
                    <p style="font-size:1.1rem;">Notes you add appear here</p>
                </div>
            ` : ''}
        </div>
    `;

    // --- COMPOSER LOGIC ---
    const composer = document.getElementById('j-composer');
    const collapsed = document.getElementById('j-comp-collapsed');
    const expanded = document.getElementById('j-comp-expanded');
    const titleIn = document.getElementById('j-comp-title');
    const bodyIn = document.getElementById('j-comp-body');
    
    let newNoteState = draft;

    function saveDraft() {
        newNoteState.title = titleIn.value;
        newNoteState.body = bodyIn.innerHTML;
        localStorage.setItem('journalDraft', JSON.stringify(newNoteState));
    }

    function expandComposer(isChecklist = false) {
        newNoteState.isExpanded = true;
        if (isChecklist) newNoteState.isChecklist = true;
        
        collapsed.style.display = 'none';
        expanded.style.display = 'block';
        composer.classList.add('expanded');
        
        bodyIn.setAttribute('data-placeholder', newNoteState.isChecklist ? 'List item...' : 'Take a note...');
        
        setTimeout(() => bodyIn.focus(), 50);
        saveDraft();
    }

    function closeComposerAndSave() {
        const title = titleIn.value.trim();
        const body = bodyIn.innerHTML.trim();
        
        if (title || body) {
            const d = getData();
            d.journal.push({
                id: Date.now().toString(),
                title, body,
                color: newNoteState.color,
                pinned: newNoteState.pinned,
                isChecklist: newNoteState.isChecklist,
                checkedLines: [],
                archived: false,
                created: Date.now()
            });
            saveData(d);
        }
        
        localStorage.removeItem('journalDraft');
        renderJournal(container);
    }

    // Trigger expansion
    collapsed.querySelector('.fake-input').addEventListener('click', () => expandComposer(false));
    document.getElementById('j-comp-quick-check').addEventListener('click', (e) => {
        e.stopPropagation();
        expandComposer(true);
        document.getElementById('j-comp-check').classList.add('active');
    });

    // Handle inputs
    titleIn.addEventListener('input', saveDraft);
    bodyIn.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        saveDraft();
    });

    // Initial resize if draft body exists
    if (draft.body) {
        bodyIn.style.height = 'auto';
        bodyIn.style.height = (bodyIn.scrollHeight) + 'px';
    }

    // Close button
    document.getElementById('j-comp-close').addEventListener('click', closeComposerAndSave);

    // Click outside to close
    document.addEventListener('mousedown', function clickOutsideComposer(e) {
        if (newNoteState.isExpanded && !composer.contains(e.target)) {
            // Check if color picker is active and click is inside it
            if (e.target.closest('.color-picker')) return;
            
            document.removeEventListener('mousedown', clickOutsideComposer);
            closeComposerAndSave();
        }
    });

    // Toolbar buttons
    document.getElementById('j-comp-pin').addEventListener('click', (e) => {
        newNoteState.pinned = !newNoteState.pinned;
        const icon = e.currentTarget.querySelector('i');
        icon.className = `ph ${newNoteState.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'}`;
        e.currentTarget.classList.toggle('active', newNoteState.pinned);
        saveDraft();
    });

    document.getElementById('j-comp-check').addEventListener('click', (e) => {
        newNoteState.isChecklist = !newNoteState.isChecklist;
        e.currentTarget.classList.toggle('active', newNoteState.isChecklist);
        bodyIn.placeholder = newNoteState.isChecklist ? 'List item...' : 'Take a note...';
        saveDraft();
    });

    const newColorPicker = document.getElementById('j-comp-color-picker');
    document.getElementById('j-comp-color').addEventListener('click', (e) => {
        e.stopPropagation();
        newColorPicker.classList.toggle('active');
    });
    
    container.querySelectorAll('.new-color-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            newNoteState.color = e.target.dataset.color;
            composer.style.background = newNoteState.color;
            newColorPicker.classList.remove('active');
            saveDraft();
        });
    });

    // --- NOTE CARD ACTIONS ---
    container.querySelectorAll('.j-action-pin').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) note.pinned = !note.pinned;
            saveData(d);
            renderJournal(container);
        });
    });

    container.querySelectorAll('.j-action-archive').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) {
                note.archived = !note.archived;
                if (note.archived) note.pinned = false; // unpin when archiving
            }
            saveData(d);
            renderJournal(container);
            showToast(note.archived ? 'Note archived' : 'Note unarchived');
        });
    });

    container.querySelectorAll('.j-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const d = getData();
            d.journal = d.journal.filter(n => n.id !== id);
            saveData(d);
            renderJournal(container);
            showToast('Note deleted');
        });
    });

    container.querySelectorAll('.j-action-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.currentTarget.dataset.id;
            const picker = container.querySelector(`.j-color-picker-${id}`);
            container.querySelectorAll('.color-picker').forEach(p => { if (p !== picker) p.classList.remove('active'); });
            picker.classList.toggle('active');
        });
    });

    container.querySelectorAll('.edit-color-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = e.target.dataset.id;
            const color = e.target.dataset.color;
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) note.color = color;
            saveData(d);
            renderJournal(container);
        });
    });

    // Hide color pickers on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.j-action-color') && !e.target.closest('.color-picker')) {
            container.querySelectorAll('.color-picker.active').forEach(p => p.classList.remove('active'));
        }
    });

    // --- CHECKLIST CHECKING ---
    container.querySelectorAll('.j-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            const idx = parseInt(e.target.dataset.idx, 10);
            const isChecked = e.target.checked;
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) {
                if (!note.checkedLines) note.checkedLines = [];
                if (isChecked) {
                    if (!note.checkedLines.includes(idx)) note.checkedLines.push(idx);
                } else {
                    note.checkedLines = note.checkedLines.filter(x => x !== idx);
                }
                saveData(d);
                renderJournal(container); // Re-renders to move items visually
            }
        });
    });

    // --- INLINE EDITING ---
    // Title
    container.querySelectorAll('.journal-note-title[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = e.currentTarget.dataset.id;
            const newTitle = e.currentTarget.innerText.trim();
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note && note.title !== newTitle) {
                note.title = newTitle;
                saveData(d);
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
            }
        });
    });

    // Body
    container.querySelectorAll('.journal-note-body[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = e.currentTarget.dataset.id;
            const newBody = e.currentTarget.innerText.trim();
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note && note.body !== newBody) {
                note.body = newBody;
                saveData(d);
            }
        });
    });

    // Checklist Items
    container.querySelectorAll('.journal-checklist-text[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = e.currentTarget.dataset.id;
            const idx = parseInt(e.currentTarget.dataset.idx, 10);
            const newText = e.currentTarget.innerText.trim();
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) {
                const lines = note.body.split('\n');
                if (lines[idx] !== newText) {
                    lines[idx] = newText;
                    note.body = lines.join('\n');
                    saveData(d);
                }
            }
        });

        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const id = e.currentTarget.dataset.id;
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                const d = getData();
                const note = d.journal.find(n => n.id === id);
                if (note) {
                    const lines = note.body.split('\n');
                    lines.splice(idx + 1, 0, '');

                    // Shift checked lines indices
                    if (note.checkedLines) {
                        note.checkedLines = note.checkedLines.map(chkIdx => {
                            if (chkIdx > idx) return chkIdx + 1;
                            return chkIdx;
                        });
                    }

                    note.body = lines.join('\n');
                    saveData(d);
                    renderJournal(container);

                    setTimeout(() => {
                        const newEl = container.querySelector(`.journal-checklist-text[data-id="${id}"][data-idx="${idx + 1}"]`);
                        if (newEl) {
                            newEl.focus();
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(newEl);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                    }, 50);
                }
            } else if (e.key === 'Backspace' && e.currentTarget.innerText.trim() === '') {
                const id = e.currentTarget.dataset.id;
                const idx = parseInt(e.currentTarget.dataset.idx, 10);
                const d = getData();
                const note = d.journal.find(n => n.id === id);
                if (note) {
                    const lines = note.body.split('\n');
                    if (lines.length > 1) {
                        e.preventDefault();
                        lines.splice(idx, 1);

                        // Shift/remove checked lines
                        if (note.checkedLines) {
                            note.checkedLines = note.checkedLines
                                .filter(chkIdx => chkIdx !== idx)
                                .map(chkIdx => {
                                    if (chkIdx > idx) return chkIdx - 1;
                                    return chkIdx;
                                });
                        }

                        note.body = lines.join('\n');
                        saveData(d);
                        renderJournal(container);

                        setTimeout(() => {
                            const prevIdx = idx > 0 ? idx - 1 : 0;
                            const prevEl = container.querySelector(`.journal-checklist-text[data-id="${id}"][data-idx="${prevIdx}"]`);
                            if (prevEl) {
                                prevEl.focus();
                                const range = document.createRange();
                                const sel = window.getSelection();
                                range.selectNodeContents(prevEl);
                                range.collapse(false);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }
                        }, 50);
                    }
                }
            }
        });
    });
}


// ======================== ACCESSIBILITY HELPERS & SPOTLIGHT/PALETTE ========================
function announce(message) {
    const el = document.getElementById('sr-announcer');
    if (el) {
        el.textContent = '';
        setTimeout(() => {
            el.textContent = message;
        }, 50);
    }
}

function initAccessibilityOverlays() {
    if (document.getElementById('shortcuts-modal')) return;

    // 1. Shortcuts Modal Cheatsheet
    const shortcuts = document.createElement('div');
    shortcuts.id = 'shortcuts-modal';
    shortcuts.className = 'modal-overlay';
    shortcuts.style.display = 'none';
    shortcuts.innerHTML = `
        <div class="modal-content" style="max-width:680px;">
            <div class="modal-header">
                <h3>⌨️ Keyboard Shortcuts Reference</h3>
                <i class="ph ph-x modal-close" id="close-shortcuts-modal" tabindex="0" role="button" aria-label="Close Reference Modal"></i>
            </div>
            <div class="modal-body" style="padding-top: 10px;">
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:12px;">Every interactive module of Blueprint is fully keyboard controllable. Single-key shortcuts are ignored when typing in active textboxes.</p>
                <div class="board-shortcuts-grid">
                    <div class="shortcuts-group">
                        <h5>Global & Search</h5>
                        <div class="shortcut-row"><span>Keyboard Cheatsheet</span><span class="shortcut-key">?</span></div>
                        <div class="shortcut-row"><span>Command Palette</span><span class="shortcut-key">Ctrl + K</span></div>
                        <div class="shortcut-row"><span>Global Spotlight Search</span><span class="shortcut-key">Ctrl + F</span></div>
                        <div class="shortcut-row"><span>Undo Last Archive</span><span class="shortcut-key">Ctrl + Z</span></div>
                        <div class="shortcut-row"><span>Sync Database</span><span class="shortcut-key">Ctrl + S</span></div>
                        <div class="shortcut-row"><span>Dismiss Overlays</span><span class="shortcut-key">Esc</span></div>
                        <div class="shortcut-row"><span>Go to Dashboard</span><span class="shortcut-key">G</span></div>
                        <div class="shortcut-row"><span>Go to Contacts</span><span class="shortcut-key">C</span></div>
                    </div>
                    <div class="shortcuts-group">
                        <h5>Navigation Views</h5>
                        <div class="shortcut-row"><span>Dashboard View</span><span class="shortcut-key">1</span></div>
                        <div class="shortcut-row"><span>Contacts View</span><span class="shortcut-key">2</span></div>
                        <div class="shortcut-row"><span>Life Coach View</span><span class="shortcut-key">3</span></div>
                        <div class="shortcut-row"><span>Skills View</span><span class="shortcut-key">4</span></div>
                        <div class="shortcut-row"><span>Archive View</span><span class="shortcut-key">5</span></div>
                        <div class="shortcut-row"><span>Journal View</span><span class="shortcut-key">6</span></div>
                        <div class="shortcut-row"><span>NYC Feed View</span><span class="shortcut-key">7</span></div>
                        <div class="shortcut-row"><span>Cycle Menu</span><span class="shortcut-key">↑ / ↓</span></div>
                    </div>
                    <div class="shortcuts-group">
                        <h5>Dashboard & Goals</h5>
                        <div class="shortcut-row"><span>New Goal Focus</span><span class="shortcut-key">N</span></div>
                        <div class="shortcut-row"><span>Toggle Checkbox</span><span class="shortcut-key">Space</span></div>
                        <div class="shortcut-row"><span>Cycle Goal List</span><span class="shortcut-key">j / k</span></div>
                        <div class="shortcut-row"><span>Jump to Daily Col</span><span class="shortcut-key">Shift + D</span></div>
                        <div class="shortcut-row"><span>Jump to Weekly Col</span><span class="shortcut-key">Shift + W</span></div>
                        <div class="shortcut-row"><span>Jump to Monthly Col</span><span class="shortcut-key">Shift + M</span></div>
                        <div class="shortcut-row"><span>Inline Text Edit</span><span class="shortcut-key">E / F2</span></div>
                        <div class="shortcut-row"><span>Delete Goal</span><span class="shortcut-key">Del</span></div>
                    </div>
                    <div class="shortcuts-group">
                        <h5>Target Contacts</h5>
                        <div class="shortcut-row"><span>Add Card Item</span><span class="shortcut-key">N</span></div>
                        <div class="shortcut-row"><span>Edit Name / Details</span><span class="shortcut-key">E / Enter</span></div>
                        <div class="shortcut-row"><span>Add Card Field</span><span class="shortcut-key">Ctrl + +</span></div>
                        <div class="shortcut-row"><span>Delete Card Item</span><span class="shortcut-key">Del</span></div>
                        <div class="shortcut-row"><span>Select Card (Reorder)</span><span class="shortcut-key">Space</span></div>
                        <div class="shortcut-row"><span>Reorder Swaps</span><span class="shortcut-key">↑ / ↓</span></div>
                    </div>
                    <div class="shortcuts-group">
                        <h5>Journal & Notes</h5>
                        <div class="shortcut-row"><span>New Entry Focus</span><span class="shortcut-key">N</span></div>
                        <div class="shortcut-row"><span>Save Entry</span><span class="shortcut-key">Ctrl + S</span></div>
                        <div class="shortcut-row"><span>Format Bold</span><span class="shortcut-key">Ctrl + B</span></div>
                        <div class="shortcut-row"><span>Format Italic</span><span class="shortcut-key">Ctrl + I</span></div>
                        <div class="shortcut-row"><span>Delete Entry Note</span><span class="shortcut-key">Ctrl + Del</span></div>
                        <div class="shortcut-row"><span>Cycle Notes cards</span><span class="shortcut-key">Ctrl + ↑/↓</span></div>
                    </div>
                    <div class="shortcuts-group">
                        <h5>Power Actions</h5>
                        <div class="shortcut-row"><span>Auto-complete Dailies</span><span class="shortcut-key">Ctrl+Sh+Ent</span></div>
                        <div class="shortcut-row"><span>Open Archive List</span><span class="shortcut-key">Ctrl + H</span></div>
                        <div class="shortcut-row"><span>Toggle Zone Details</span><span class="shortcut-key">Z</span></div>
                        <div class="shortcut-row"><span>JSON Data Export</span><span class="shortcut-key">Ctrl+Sh+E</span></div>
                        <div class="shortcut-row"><span>Reload & Animate Charts</span><span class="shortcut-key">Ctrl+Sh+R</span></div>
                        <div class="shortcut-row"><span>Toggle Compact Density</span><span class="shortcut-key">Ctrl+Sh+D</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(shortcuts);

    document.getElementById('close-shortcuts-modal').addEventListener('click', () => {
        shortcuts.style.display = 'none';
    });
    shortcuts.addEventListener('click', (e) => {
        if (e.target === shortcuts) shortcuts.style.display = 'none';
    });

    // 2. Command Palette Modal
    const palette = document.createElement('div');
    palette.id = 'command-palette-modal';
    palette.className = 'modal-overlay';
    palette.style.display = 'none';
    palette.innerHTML = `
        <div class="palette-modal-content">
            <input type="text" id="palette-search" class="palette-input" placeholder="Type a command... (Use ↑/↓ arrows, Enter to run)">
            <ul id="palette-results" class="palette-list"></ul>
        </div>
    `;
    document.body.appendChild(palette);

    // 3. Global Search Modal
    const gSearch = document.createElement('div');
    gSearch.id = 'global-search-modal';
    gSearch.className = 'modal-overlay';
    gSearch.style.display = 'none';
    gSearch.innerHTML = `
        <div class="palette-modal-content">
            <input type="text" id="gsearch-search" class="palette-input" placeholder="Search goals, contacts, and journal entries...">
            <ul id="gsearch-results" class="palette-list"></ul>
        </div>
    `;
    document.body.appendChild(gSearch);

    // Command palette bindings
    const paletteInput = document.getElementById('palette-search');
    paletteInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            filteredCommands = [...COMMANDS];
        } else {
            filteredCommands = COMMANDS.filter(cmd => 
                cmd.name.toLowerCase().includes(query) || 
                cmd.desc.toLowerCase().includes(query)
            );
        }
        selectedCommandIdx = 0;
        renderCommandPalette();
    });

    paletteInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (filteredCommands.length > 0) {
                selectedCommandIdx = (selectedCommandIdx + 1) % filteredCommands.length;
                renderCommandPalette();
                const items = document.querySelectorAll('#palette-results .palette-item');
                items[selectedCommandIdx]?.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (filteredCommands.length > 0) {
                selectedCommandIdx = (selectedCommandIdx - 1 + filteredCommands.length) % filteredCommands.length;
                renderCommandPalette();
                const items = document.querySelectorAll('#palette-results .palette-item');
                items[selectedCommandIdx]?.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedCommandIdx]) {
                filteredCommands[selectedCommandIdx].action();
                document.getElementById('command-palette-modal').style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            document.getElementById('command-palette-modal').style.display = 'none';
        }
    });

    // Global Spotlight Search bindings
    const gSearchInput = document.getElementById('gsearch-search');
    gSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            activeSearchResults = [];
        } else {
            activeSearchResults = getGlobalSearchResults(query);
        }
        selectedSearchIdx = 0;
        renderGlobalSearchResults();
    });

    gSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeSearchResults.length > 0) {
                selectedSearchIdx = (selectedSearchIdx + 1) % activeSearchResults.length;
                renderGlobalSearchResults();
                const items = document.querySelectorAll('#gsearch-results .palette-item');
                items[selectedSearchIdx]?.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeSearchResults.length > 0) {
                selectedSearchIdx = (selectedSearchIdx - 1 + activeSearchResults.length) % activeSearchResults.length;
                renderGlobalSearchResults();
                const items = document.querySelectorAll('#gsearch-results .palette-item');
                items[selectedSearchIdx]?.scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSearchResults[selectedSearchIdx]) {
                activeSearchResults[selectedSearchIdx].action();
                document.getElementById('global-search-modal').style.display = 'none';
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            document.getElementById('global-search-modal').style.display = 'none';
        }
    });
}

const COMMANDS = [
    { name: "Go to Dashboard", desc: "View your stats, charts, and goals", action: () => { window.location.hash = '#dashboard'; } },
    { name: "Go to Contacts", desc: "View companies, outreach, and job portals", action: () => { window.location.hash = '#contacts'; } },
    { name: "Go to Life Coach", desc: "Get AI mindset guidance and analysis", action: () => { window.location.hash = '#coach'; } },
    { name: "Go to Skills & Gaps", desc: "Assess required job specs and roadmap", action: () => { window.location.hash = '#skills'; } },
    { name: "Go to Archive", desc: "Browse your historical completed targets", action: () => { window.location.hash = '#archive'; } },
    { name: "Go to Journal", desc: "Draft reflective logs and checklists", action: () => { window.location.hash = '#journal'; } },
    { name: "Go to NYC Feed", desc: "Read tech news and local events calendar", action: () => { window.location.hash = '#news'; } },
    { name: "Clear Daily Goals", desc: "Wipes out active daily goals", action: () => {
        const d = getData();
        d.goals = d.goals.filter(g => g.type !== 'daily');
        saveData(d);
        renderGoalLists();
        calculateZone();
        const container = document.getElementById('view-container');
        if (container) renderDashboard(container);
        showToast('Daily goals cleared.', 'info');
        announce('Cleared daily goals.');
    } },
    { name: "Toggle Zone Status Details", desc: "View details of current ADHD Zone", action: () => { showZoneModal(); } },
    { name: "Export JSON Database Backup", desc: "Export schema database file", action: () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getData(), null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "blueprint_backup.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('JSON backup exported.', 'success');
    } },
    { name: "Reload Chart.js Animations", desc: "Reload donut and win bar charts", action: () => {
        const container = document.getElementById('view-container');
        if (container && window.location.hash.replace('#', '') === 'dashboard') {
            renderDashboard(container);
            showToast('Charts reloaded.', 'success');
        }
    } },
    { name: "Toggle Layout Density (Compact)", desc: "Compress page paddings and gap sizes", action: () => {
        document.body.classList.toggle('layout-compact');
        const active = document.body.classList.contains('layout-compact');
        showToast(`Layout set to ${active ? 'Compact' : 'Normal'} density.`, 'success');
        announce(`Layout density toggled to ${active ? 'compact' : 'normal'}.`);
    } },
    { name: "Undo Last Goal Archive", desc: "Restore the last completed goal", action: () => { window._undoLastArchive(); } }
];

let selectedCommandIdx = 0;
let filteredCommands = [...COMMANDS];

function renderCommandPalette() {
    const listEl = document.getElementById('palette-results');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (filteredCommands.length === 0) {
        listEl.innerHTML = `<li style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No matching commands.</li>`;
        return;
    }

    filteredCommands.forEach((cmd, idx) => {
        const li = document.createElement('li');
        li.className = `palette-item${idx === selectedCommandIdx ? ' selected' : ''}`;
        li.innerHTML = `
            <div>
                <span style="font-weight:600; display:block;">${cmd.name}</span>
                <span style="font-size:0.72rem; color:var(--text-muted);">${cmd.desc}</span>
            </div>
            <span class="palette-badge">Run</span>
        `;
        li.addEventListener('click', () => {
            cmd.action();
            document.getElementById('command-palette-modal').style.display = 'none';
        });
        listEl.appendChild(li);
    });
}

function getGlobalSearchResults(query) {
    const data = getData();
    const results = [];
    const q = query.toLowerCase();

    // 1. Active goals
    if (data.goals) {
        data.goals.forEach(g => {
            if (g.text.toLowerCase().includes(q)) {
                results.push({
                    type: 'Active Goal',
                    icon: 'ph-target',
                    title: g.text,
                    desc: `Type: ${g.type.toUpperCase()}`,
                    action: () => {
                        window.location.hash = '#dashboard';
                        setTimeout(() => {
                            const li = document.getElementById(`chk-${g.id}`)?.closest('.goal-item');
                            if (li) {
                                li.focus();
                                li.style.outline = '3px solid var(--accent)';
                                setTimeout(() => li.style.outline = '', 3000);
                            }
                        }, 100);
                    }
                });
            }
        });
    }

    // 2. Archived goals
    if (data.archive) {
        data.archive.forEach(a => {
            if (a.text.toLowerCase().includes(q)) {
                results.push({
                    type: 'Archived Goal',
                    icon: 'ph-archive',
                    title: a.text,
                    desc: `Completed on ${new Date(a.completedAt).toLocaleDateString()}`,
                    action: () => {
                        window.location.hash = '#archive';
                        setTimeout(() => {
                            const archItems = Array.from(document.querySelectorAll('.archive-item'));
                            const item = archItems.find(el => el.textContent.includes(a.text));
                            if (item) {
                                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                item.style.outline = '3px solid var(--accent)';
                                setTimeout(() => item.style.outline = '', 3000);
                            }
                        }, 100);
                    }
                });
            }
        });
    }

    // 3. Contacts
    ['companies', 'people', 'portals'].forEach(key => {
        if (data[key]) {
            data[key].forEach((item, idx) => {
                const nameMatches = item.name && item.name.toLowerCase().includes(q);
                const descMatches = item.description && item.description.toLowerCase().includes(q);
                const fieldMatches = item.fields && item.fields.some(f => f.value && f.value.toLowerCase().includes(q));

                if (nameMatches || descMatches || fieldMatches) {
                    results.push({
                        type: `Contact (${key.charAt(0).toUpperCase() + key.slice(1)})`,
                        icon: key === 'companies' ? 'ph-buildings' : key === 'people' ? 'ph-users-three' : 'ph-browser',
                        title: item.name || 'Unnamed item',
                        desc: item.description || 'No description',
                        action: () => {
                            window._activeTargetTab = key;
                            window.location.hash = '#contacts';
                            setTimeout(() => {
                                const card = document.querySelector(`.target-card[data-key="${key}"][data-idx="${idx}"]`);
                                if (card) {
                                    card.focus();
                                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    card.style.outline = '3px solid var(--accent)';
                                    setTimeout(() => card.style.outline = '', 3000);
                                }
                            }, 100);
                        }
                    });
                }
            });
        }
    });

    // 4. Journal notes
    if (data.journal) {
        data.journal.forEach(note => {
            const titleMatches = note.title && note.title.toLowerCase().includes(q);
            const bodyMatches = note.body && note.body.toLowerCase().includes(q);

            if (titleMatches || bodyMatches) {
                results.push({
                    type: 'Journal Note',
                    icon: 'ph-notebook',
                    title: note.title || 'Untitled note',
                    desc: note.body.substring(0, 60) + (note.body.length > 60 ? '...' : ''),
                    action: () => {
                        window.location.hash = '#journal';
                        setTimeout(() => {
                            const noteEl = Array.from(document.querySelectorAll('.journal-note')).find(el => {
                                const titleEl = el.querySelector('.journal-note-title');
                                return titleEl && titleEl.textContent.trim() === (note.title || '').trim();
                            });
                            if (noteEl) {
                                noteEl.focus();
                                noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                noteEl.style.outline = '3px solid var(--accent)';
                                setTimeout(() => noteEl.style.outline = '', 3000);
                            }
                        }, 100);
                    }
                });
            }
        });
    }

    return results;
}

let selectedSearchIdx = 0;
let activeSearchResults = [];

function renderGlobalSearchResults() {
    const listEl = document.getElementById('gsearch-results');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (activeSearchResults.length === 0) {
        listEl.innerHTML = `<li style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No matches found. Try another query!</li>`;
        return;
    }

    activeSearchResults.forEach((res, idx) => {
        const li = document.createElement('li');
        li.className = `palette-item${idx === selectedSearchIdx ? ' selected' : ''}`;
        li.innerHTML = `
            <div>
                <span style="font-size:0.65rem; text-transform:uppercase; color:var(--accent); font-weight:700; display:flex; align-items:center; gap:4px;">
                    <i class="ph ${res.icon}"></i> ${res.type}
                </span>
                <span style="font-weight:600; display:block; margin-top:2px;">${res.title}</span>
                <span style="font-size:0.72rem; color:var(--text-secondary);">${res.desc}</span>
            </div>
            <span class="palette-badge">Go</span>
        `;
        li.addEventListener('click', () => {
            res.action();
            document.getElementById('global-search-modal').style.display = 'none';
        });
        listEl.appendChild(li);
    });
}

// Global window keydown hotkeys engine
window.addEventListener('keydown', (e) => {
    const isInputActive = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.getAttribute('contenteditable') === 'true' ||
        document.activeElement.closest('[contenteditable="true"]')
    );

    // Global combo overrides (always active)
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        window._undoLastArchive();
        return;
    }
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const modal = document.getElementById('command-palette-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('palette-search').value = '';
            filteredCommands = [...COMMANDS];
            selectedCommandIdx = 0;
            renderCommandPalette();
            document.getElementById('palette-search').focus();
        }
        return;
    }
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const modal = document.getElementById('global-search-modal');
        if (modal) {
            modal.style.display = 'flex';
            document.getElementById('gsearch-search').value = '';
            activeSearchResults = [];
            selectedSearchIdx = 0;
            renderGlobalSearchResults();
            document.getElementById('gsearch-search').focus();
        }
        return;
    }
    if (e.key === 'Escape') {
        document.getElementById('shortcuts-modal').style.display = 'none';
        document.getElementById('command-palette-modal').style.display = 'none';
        document.getElementById('global-search-modal').style.display = 'none';
        document.getElementById('zone-modal').style.display = 'none';
        return;
    }

    if (e.ctrlKey) {
        if (e.key.toLowerCase() === 's') {
            e.preventDefault();
            const saveBtn = document.getElementById('j-new-save');
            if (saveBtn) {
                saveBtn.click();
                showToast('Draft note saved to journal.', 'success');
            } else {
                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }
                showToast('Journal notes synced and saved.', 'success');
            }
            return;
        }
        if (e.ctrlKey && e.key === 'Delete') {
            const activeNote = document.activeElement.closest('.journal-note');
            if (activeNote) {
                e.preventDefault();
                const delBtn = activeNote.querySelector('.j-action-delete');
                if (delBtn) delBtn.click();
            }
            return;
        }
        if (e.shiftKey) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const d = getData();
                const dailyGoals = d.goals.filter(g => g.type === 'daily');
                if (dailyGoals.length === 0) {
                    showToast('No active daily goals to complete.', 'info');
                    return;
                }
                d.archive = d.archive || [];
                const timestamp = new Date().toISOString();
                dailyGoals.forEach(g => {
                    g.completed = true;
                    d.archive.push({
                        id: g.id + '_arc_' + Date.now(),
                        text: g.text,
                        type: g.type,
                        completedAt: timestamp
                    });
                });
                d.goals = d.goals.filter(g => g.type !== 'daily');
                saveData(d);
                renderGoalLists();
                calculateZone();
                const container = document.getElementById('view-container');
                if (container) renderDashboard(container);
                showToast('All daily goals completed & archived! 🏆', 'success');
                announce('Completed all daily goals.');
                return;
            }
            if (e.key.toLowerCase() === 'e') {
                e.preventDefault();
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getData(), null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "blueprint_backup.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                showToast('JSON backup database exported successfully.', 'success');
                return;
            }
            if (e.key.toLowerCase() === 'r') {
                e.preventDefault();
                const container = document.getElementById('view-container');
                if (container && window.location.hash.replace('#', '') === 'dashboard') {
                    renderDashboard(container);
                    showToast('Charts reloaded and re-animated.', 'success');
                }
                return;
            }
            if (e.key.toLowerCase() === 'd') {
                e.preventDefault();
                document.body.classList.toggle('layout-compact');
                const active = document.body.classList.contains('layout-compact');
                showToast(`Layout set to ${active ? 'Compact' : 'Normal'} density.`, 'success');
                return;
            }
        }
    }

    // Ignore single key navigation and hotkeys when typing in active editors/inputs
    if (isInputActive) return;

    if (e.key === '?') {
        e.preventDefault();
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            if (modal.style.display === 'none' || modal.style.display === '') {
                modal.style.display = 'flex';
            } else {
                modal.style.display = 'none';
            }
        }
        return;
    }

    if (e.key >= '1' && e.key <= '7') {
        const hashes = ['dashboard', 'contacts', 'coach', 'skills', 'archive', 'journal', 'news'];
        const targetHash = hashes[parseInt(e.key) - 1];
        if (targetHash) {
            e.preventDefault();
            window.location.hash = `#${targetHash}`;
        }
        return;
    }

    if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        window.location.hash = '#dashboard';
        return;
    }
    if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        window.location.hash = '#contacts';
        return;
    }

    if (document.activeElement && document.activeElement.classList.contains('nav-item')) {
        const navs = Array.from(document.querySelectorAll('.nav-item'));
        let idx = navs.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            navs[(idx + 1) % navs.length].focus();
            return;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navs[(idx - 1 + navs.length) % navs.length].focus();
            return;
        }
    }

    if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const modal = document.getElementById('zone-modal');
        if (modal) {
            if (modal.style.display === 'none' || modal.style.display === '') {
                showZoneModal();
            } else {
                modal.style.display = 'none';
            }
        }
        return;
    }

    const currentHash = window.location.hash.replace('#', '') || 'dashboard';

    // Dashboard Goals Specific
    if (currentHash === 'dashboard') {
        if (e.key.toLowerCase() === 'n') {
            const addIn = document.getElementById('new-goal-text');
            if (addIn) {
                e.preventDefault();
                addIn.focus();
            }
            return;
        }
        if (e.shiftKey) {
            if (e.key === 'D') {
                e.preventDefault();
                document.querySelector('#daily-goals .goal-item')?.focus();
                return;
            }
            if (e.key === 'W') {
                e.preventDefault();
                document.querySelector('#weekly-goals .goal-item')?.focus();
                return;
            }
            if (e.key === 'M') {
                e.preventDefault();
                document.querySelector('#monthly-goals .goal-item')?.focus();
                return;
            }
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'j' || e.key === 'k') {
            const items = Array.from(document.querySelectorAll('.goal-item'));
            if (items.length > 0) {
                let idx = items.indexOf(document.activeElement);
                if (idx === -1) {
                    const parentItem = document.activeElement.closest('.goal-item');
                    if (parentItem) idx = items.indexOf(parentItem);
                }
                if (idx !== -1) {
                    e.preventDefault();
                    let nextIdx = (e.key === 'ArrowDown' || e.key === 'j') ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
                    items[nextIdx].focus();
                    return;
                }
            }
        }

        if (document.activeElement && document.activeElement.classList.contains('goal-item')) {
            const card = document.activeElement;
            const chk = card.querySelector('input[type="checkbox"]');
            const span = card.querySelector('.goal-text');

            if (e.key === ' ') {
                e.preventDefault();
                if (chk) {
                    chk.checked = !chk.checked;
                    chk.dispatchEvent(new Event('change'));
                }
                return;
            }
            if (e.key.toLowerCase() === 'e' || e.key === 'F2') {
                e.preventDefault();
                if (span) {
                    span.focus();
                    document.execCommand('selectAll', false, null);
                }
                return;
            }
            if (e.key === 'Delete') {
                e.preventDefault();
                const trash = card.querySelector('.ph-trash');
                if (trash) trash.click();
                return;
            }
        }
    }

    // Contacts Specific
    if (currentHash === 'contacts') {
        if (e.key.toLowerCase() === 'n') {
            const addIn = document.querySelector('.linear-column input[id^="add-"]');
            if (addIn) {
                e.preventDefault();
                addIn.focus();
            }
            return;
        }

        if (document.activeElement && document.activeElement.classList.contains('target-card')) {
            const card = document.activeElement;
            const idx = parseInt(card.dataset.idx);
            const key = card.dataset.key;

            if (e.key === ' ') {
                e.preventDefault();
                if (window._pickedContactIndex === undefined || window._pickedContactIndex === null) {
                    window._pickedContactIndex = idx;
                    window._pickedContactKey = key;
                    card.classList.add('keyboard-picked');
                    announce(`Picked up ${card.querySelector('.target-card-name').textContent.trim() || 'unnamed'}. Use Up/Down arrows to reorder.`);
                } else if (window._pickedContactIndex === idx && window._pickedContactKey === key) {
                    window._pickedContactIndex = null;
                    window._pickedContactKey = null;
                    card.classList.remove('keyboard-picked');
                    announce(`Dropped card.`);
                }
                return;
            }

            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                if (window._pickedContactIndex === idx && window._pickedContactKey === key) {
                    e.preventDefault();
                    const d = getData();
                    const items = d[key] || [];
                    const toIdx = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
                    if (toIdx >= 0 && toIdx < items.length) {
                        const temp = d[key][idx];
                        d[key][idx] = d[key][toIdx];
                        d[key][toIdx] = temp;
                        saveData(d);

                        window._pickedContactIndex = toIdx;
                        renderContacts(document.getElementById('view-container'));

                        const nextCard = document.querySelector(`.target-card[data-key="${key}"][data-idx="${toIdx}"]`);
                        if (nextCard) {
                            nextCard.focus();
                            nextCard.classList.add('keyboard-picked');
                        }
                        announce(`Moved ${temp.name || 'item'} to position ${toIdx + 1}.`);
                    }
                    return;
                }
            }

            if (e.key.toLowerCase() === 'e' || e.key === 'Enter') {
                e.preventDefault();
                const nameIn = card.querySelector('.target-card-name');
                if (nameIn) {
                    nameIn.focus();
                    document.execCommand('selectAll', false, null);
                }
                return;
            }

            if (e.key === '+' && e.ctrlKey) {
                e.preventDefault();
                const addBtn = card.querySelector('.add-field-btn');
                if (addBtn) addBtn.click();
                return;
            }

            if (e.key === 'Delete') {
                e.preventDefault();
                const delBtn = card.querySelector('.target-card-delete');
                if (delBtn) delBtn.click();
                return;
            }
        }
    }

    // Journal Specific
    if (currentHash === 'journal') {
        if (e.key.toLowerCase() === 'n') {
            const addIn = document.getElementById('j-new-title');
            if (addIn) {
                e.preventDefault();
                addIn.focus();
            }
            return;
        }

        if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            const notes = Array.from(document.querySelectorAll('.journal-note'));
            if (notes.length > 0) {
                e.preventDefault();
                let idx = notes.indexOf(document.activeElement);
                if (idx === -1) {
                    const parentNote = document.activeElement.closest('.journal-note');
                    if (parentNote) idx = notes.indexOf(parentNote);
                }
                let nextIdx = e.key === 'ArrowDown' ? (idx + 1) % notes.length : (idx - 1 + notes.length) % notes.length;
                notes[nextIdx].focus();
            }
        }
    }
});
