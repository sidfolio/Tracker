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

    // Firebase banner dismiss
    document.getElementById('dismiss-banner').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('firebase-banner').style.display = 'none';
    });

    // Routing
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

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${hash}`)?.classList.add('active');

    const container = document.getElementById('view-container');
    container.innerHTML = '';
    views[hash](container);
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
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

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
                        <canvas id="goal-donut" width="180" height="180"></canvas>
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
            </div>

            <!-- BAR CHART: Wins per day -->
            <div class="chart-card">
                <div class="chart-title"><i class="ph ph-chart-bar"></i> Wins per Day (Last 7 Days)</div>
                <div class="chart-wrap" style="height:180px;">
                    <canvas id="wins-bar"></canvas>
                </div>
            </div>
        </div>

        <!-- GOAL CARDS -->
        <div class="content-grid-3" style="margin-bottom:20px;">
            <div class="card">
                <div class="card-title"><i class="ph ph-sun"></i> Daily Goals</div>
                <ul class="goal-list" id="daily-goals"></ul>
            </div>
            <div class="card">
                <div class="card-title"><i class="ph ph-calendar-blank"></i> Weekly Goals</div>
                <ul class="goal-list" id="weekly-goals"></ul>
            </div>
            <div class="card">
                <div class="card-title"><i class="ph ph-calendar"></i> Monthly Goals</div>
                <ul class="goal-list" id="monthly-goals"></ul>
            </div>
        </div>

        <!-- ADD GOAL -->
        <div class="card">
            <div class="card-title"><i class="ph ph-plus"></i> Add New Goal</div>
            <div class="input-group">
                <select id="new-goal-type" style="flex:0 0 120px;">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                </select>
                <input type="text" id="new-goal-text" placeholder="e.g., Cold email 5 recruiters at Ramp">
                <button id="add-goal-btn">Add Goal</button>
            </div>
        </div>
    `;

    renderGoalLists();

    // --- Donut chart ---
    const isDark = !document.body.classList.contains('light');
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const labelColor = isDark ? '#8a8a9a' : '#666678';

    new Chart(document.getElementById('goal-donut'), {
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
    new Chart(document.getElementById('wins-bar'), {
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
            li.innerHTML = `
                <input type="checkbox" id="chk-${g.id}" ${g.completed ? 'checked' : ''}>
                <label for="chk-${g.id}" class="goal-text">${g.text}</label>
                <i class="ph ph-trash" style="cursor:pointer;color:var(--text-muted);font-size:0.9rem;" title="Delete"></i>
            `;

            li.querySelector('input').addEventListener('change', (e) => {
                const d = getData();
                const goal = d.goals.find(x => x.id === g.id);
                if (!goal) return;

                if (e.target.checked) {
                    // Archive it
                    goal.completed = true;
                    d.archive = d.archive || [];
                    d.archive.push({
                        id: goal.id + '_arc_' + Date.now(),
                        text: goal.text,
                        type: goal.type,
                        completedAt: new Date().toISOString()
                    });
                    d.goals = d.goals.filter(x => x.id !== g.id);
                    saveData(d);
                    showToast('Goal archived! 🏆 Great work.', 'success');
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

            li.querySelector('.ph-trash').addEventListener('click', () => {
                const d = getData();
                d.goals = d.goals.filter(x => x.id !== g.id);
                saveData(d);
                renderGoalLists();
                calculateZone();
                showToast('Goal removed.', 'info');
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

function renderContacts(container) {
    const data = getData();
    const categories = [
        { key: 'companies', label: 'Companies',      icon: 'ph-buildings',     placeholder: 'Add company...' },
        { key: 'people',    label: 'Key Contacts',   icon: 'ph-users-three',   placeholder: 'Add contact...' },
        { key: 'portals',   label: 'Job Portals',    icon: 'ph-browser',       placeholder: 'Add portal...' }
    ];

    let html = `
        <div style="margin-bottom:24px;">
            <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Target Board & Sources</h2>
            <p style="color:var(--text-secondary); font-size:0.85rem;">Manage your target companies, key outreach contacts, and job search portals in one place.</p>
        </div>
        <div class="linear-list-board">`;

    categories.forEach(cat => {
        const items = data[cat.key] || [];
        html += `
            <div class="linear-column" style="display:flex; flex-direction:column; gap:16px;">
                <div class="linear-header" style="color:var(--accent-light); margin-bottom: 0px; padding-bottom: 12px;">
                    <i class="ph ${cat.icon}"></i> ${cat.label}
                    <span style="margin-left:auto; font-size:0.7rem; color:var(--text-muted); font-weight:400;">${items.length} total</span>
                </div>
                
                <div class="target-cards-list" id="col-${cat.key}" style="display:flex; flex-direction:column; gap:12px; min-height:50px;">
                    ${items.map((item, idx) => {
                        if (cat.key === 'contacts') {
                            return `
                                <div class="target-card" draggable="true" data-key="${cat.key}" data-idx="${idx}">
                                    <div class="target-card-header">
                                        <div class="target-card-name" contenteditable="true" placeholder="Name" data-field="name">${item.name || ''}</div>
                                        <div class="target-card-controls" style="display:flex; align-items:center; gap:6px;">
                                            <i class="ph ph-push-pin target-card-control pin-btn" title="Move to Top" style="cursor:pointer; font-size:0.85rem;"></i>
                                            <i class="ph ph-caret-up target-card-control up-btn" title="Move Up" style="cursor:pointer; font-size:0.95rem;"></i>
                                            <i class="ph ph-caret-down target-card-control down-btn" title="Move Down" style="cursor:pointer; font-size:0.95rem;"></i>
                                            <i class="ph ph-trash target-card-delete" title="Delete"></i>
                                        </div>
                                    </div>
                                    <div class="target-card-link-row">
                                        <i class="${getIconForLink(item.link || '')} target-card-link-icon"></i>
                                        <div class="target-card-link-text" contenteditable="true" placeholder="LinkedIn or URL" data-field="link">${item.link || ''}</div>
                                        ${item.link ? `<a href="${formatURL(item.link)}" target="_blank" class="target-card-link-go" title="Open Link"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                                    </div>
                                    <div class="target-card-link-row" style="margin-top: 4px;">
                                        <i class="ph ph-envelope target-card-link-icon"></i>
                                        <div class="target-card-link-text" contenteditable="true" placeholder="Email address" data-field="email">${item.email || ''}</div>
                                        ${item.email ? `<a href="mailto:${item.email}" class="target-card-link-go" title="Send Email"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                                    </div>
                                    <div class="target-card-link-row" style="margin-top: 4px;">
                                        <i class="ph ph-phone target-card-link-icon"></i>
                                        <div class="target-card-link-text" contenteditable="true" placeholder="Phone number" data-field="phone">${item.phone || ''}</div>
                                        ${item.phone ? `<a href="tel:${item.phone}" class="target-card-link-go" title="Call Phone"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                                    </div>
                                    <div class="target-card-desc" contenteditable="true" placeholder="Add description..." data-field="description">${item.description || ''}</div>
                                </div>
                            `;
                        } else {
                            return `
                                <div class="target-card" draggable="true" data-key="${cat.key}" data-idx="${idx}">
                                    <div class="target-card-header">
                                        <div class="target-card-name" contenteditable="true" placeholder="Name" data-field="name">${item.name || ''}</div>
                                        <div class="target-card-controls" style="display:flex; align-items:center; gap:6px;">
                                            <i class="ph ph-push-pin target-card-control pin-btn" title="Move to Top" style="cursor:pointer; font-size:0.85rem;"></i>
                                            <i class="ph ph-caret-up target-card-control up-btn" title="Move Up" style="cursor:pointer; font-size:0.95rem;"></i>
                                            <i class="ph ph-caret-down target-card-control down-btn" title="Move Down" style="cursor:pointer; font-size:0.95rem;"></i>
                                            <i class="ph ph-trash target-card-delete" title="Delete"></i>
                                        </div>
                                    </div>
                                    <div class="target-card-link-row">
                                        <i class="${getIconForLink(item.link || '')} target-card-link-icon"></i>
                                        <div class="target-card-link-text" contenteditable="true" placeholder="LinkedIn or URL" data-field="link">${item.link || ''}</div>
                                        ${item.link ? `<a href="${formatURL(item.link)}" target="_blank" class="target-card-link-go" title="Open Link"><i class="ph ph-arrow-square-out"></i></a>` : ''}
                                    </div>
                                    <div class="target-card-desc" contenteditable="true" placeholder="Add description..." data-field="description">${item.description || ''}</div>
                                </div>
                            `;
                        }
                    }).join('')}
                </div>
                
                <div class="input-group" style="margin-top:auto; padding-top:12px; border-top:1px solid var(--border); display:flex; gap:8px;">
                    <input type="text" id="add-${cat.key}" placeholder="${cat.placeholder}" style="background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:8px 12px; flex:1; box-sizing:border-box;">
                    <button data-cat="${cat.key}" class="add-target-btn">
                        <i class="ph ph-plus" style="font-weight:700;"></i> Add Item
                    </button>
                </div>
            </div>`;
    });

    html += '</div>';
    container.innerHTML = html;

    // Event delegation for blur (auto-saving)
    const cardBoard = container.querySelector('.linear-list-board');
    cardBoard.addEventListener('blur', (e) => {
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
            const oldVal = d[key][idx][field] || '';
            if (oldVal !== val) {
                d[key][idx][field] = val;
                saveData(d);
                // If editing link, email or phone, refresh view to update external anchor tag & icon
                if (field === 'link' || field === 'email' || field === 'phone') {
                    renderContacts(container);
                }
            }
        }
    }, true);

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
                }
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

    // Event listeners for Add Buttons (Defensive Sibling Fallback included)
    container.querySelectorAll('.add-target-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            const input = document.getElementById(`add-${cat}`) || btn.previousElementSibling;
            const val = input.value.trim();
            if (!val) return;
            const d = getData();
            if (!d[cat]) d[cat] = [];
            const newItem = { name: val, link: '', description: '' };
            if (cat === 'contacts') {
                newItem.email = '';
                newItem.phone = '';
            }
            d[cat].push(newItem);
            saveData(d);
            input.value = '';
            renderContacts(container);
            showToast(`Added "${val}" successfully.`, 'success');
        });
    });

    // Enter Key on Inputs to Add Item (Defensive Sibling Fallback included)
    container.querySelectorAll('.linear-column input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const cat = input.id ? input.id.replace('add-', '') : '';
                const val = input.value.trim();
                if (!val) return;
                const d = getData();
                if (!cat) return;
                if (!d[cat]) d[cat] = [];
                const newItem = { name: val, link: '', description: '' };
                if (cat === 'contacts') {
                    newItem.email = '';
                    newItem.phone = '';
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

    // --- Charts ---
    new Chart(document.getElementById('skill-donut'), {
        type: 'doughnut',
        data: {
            labels: catNames,
            datasets: [{ data: catCounts.map(c => c || 0.01), backgroundColor: catColors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: { cutout: '70%', plugins: { legend: { display: false } }, animation: { duration: 600 } }
    });

    new Chart(document.getElementById('priority-bar'), {
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

// ======================== JOURNAL (KEEP CLONE) ========================
const JOURNAL_COLORS = [
    'var(--bg-card)',          // Default
    'rgba(239, 68, 68, 0.15)', // Red
    'rgba(245, 158, 11, 0.15)',// Yellow
    'rgba(34, 197, 94, 0.15)', // Green
    'rgba(59, 130, 246, 0.15)',// Blue
    'rgba(139, 92, 246, 0.15)' // Purple
];

function renderJournal(container) {
    const data = getData();
    if (!data.journal) data.journal = [];

    // Sort notes: pinned first, then by timestamp descending
    const sortedNotes = [...data.journal].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.created - a.created;
    });

    // Load draft state
    let draftStr = localStorage.getItem('journalDraft');
    let draft = draftStr ? JSON.parse(draftStr) : { title: '', body: '', color: 'var(--bg-card)', pinned: false, isChecklist: false };

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:20px;">
            <div>
                <h2 style="font-weight:700; letter-spacing:-0.02em; margin-bottom:4px;">Journal & Notes</h2>
                <p style="color:var(--text-secondary); font-size:0.85rem;">Capture thoughts, checklists, and milestones.</p>
            </div>
        </div>

        <!-- CREATE NOTE BOX -->
        <div class="journal-create-box" id="j-create-box" style="background:${draft.color};">
            <input type="text" id="j-new-title" class="journal-input title" placeholder="Title" value="${draft.title.replace(/"/g, '&quot;')}">
            <textarea id="j-new-body" class="journal-input" placeholder="${draft.isChecklist ? 'List items (press Enter for new item)...' : 'Take a note...'}" rows="${draft.body ? 3 : 1}">${draft.body}</textarea>
            
            <div class="journal-actions" id="j-create-actions" style="display:${(draft.title || draft.body) ? 'flex' : 'none'};">
                <div class="journal-tools">
                    <button class="journal-tool-btn" id="j-new-pin" title="Pin Note" style="color:${draft.pinned ? 'var(--accent)' : 'var(--text-muted)'};"><i class="ph ph-push-pin"></i></button>
                    <button class="journal-tool-btn" id="j-new-check" title="Toggle Checklist" style="color:${draft.isChecklist ? 'var(--accent)' : 'var(--text-muted)'};"><i class="ph ph-check-square"></i></button>
                    <div style="position:relative;">
                        <button class="journal-tool-btn" id="j-new-color" title="Change Color"><i class="ph ph-palette"></i></button>
                        <div class="color-picker" id="j-new-color-picker">
                            ${JOURNAL_COLORS.map((c, i) => `<div class="color-swatch new-color-swatch" data-color="${c}" style="background:${c};"></div>`).join('')}
                        </div>
                    </div>
                </div>
                <button class="primary-btn" id="j-new-save" style="padding:6px 16px; font-size:0.85rem;">Close</button>
            </div>
        </div>

        <!-- MASONRY GRID -->
        <div class="journal-masonry">
            ${sortedNotes.map(note => {
                let bodyHTML = '';
                if (note.isChecklist) {
                    const lines = note.body.split('\n');
                    bodyHTML = lines.map((l, i) => `
                        <div class="journal-checklist-item">
                            <input type="checkbox" class="j-check" data-id="${note.id}" data-idx="${i}" ${note.checkedLines?.includes(i) ? 'checked' : ''}>
                            <div class="journal-checklist-text" contenteditable="true" data-id="${note.id}" data-idx="${i}" placeholder="List item">${l}</div>
                        </div>
                    `).join('');
                } else {
                    bodyHTML = `<div class="journal-note-body" contenteditable="true" data-id="${note.id}" placeholder="Take a note...">${note.body}</div>`;
                }

                return `
                <div class="journal-note ${note.pinned ? 'pinned' : ''}" style="background:${note.color};">
                    <div class="journal-note-title" contenteditable="true" data-id="${note.id}" placeholder="Title">${note.title || ''}</div>
                    ${bodyHTML}
                    
                    <div class="journal-note-footer">
                        <button class="journal-tool-btn j-action-pin" data-id="${note.id}" title="Pin Note">
                            <i class="ph ${note.pinned ? 'ph-push-pin-slash' : 'ph-push-pin'}"></i>
                        </button>
                        <div style="position:relative;">
                            <button class="journal-tool-btn j-action-color" data-id="${note.id}" title="Change Color">
                                <i class="ph ph-palette"></i>
                            </button>
                            <div class="color-picker j-color-picker-${note.id}">
                                ${JOURNAL_COLORS.map(c => `<div class="color-swatch edit-color-swatch" data-id="${note.id}" data-color="${c}" style="background:${c};"></div>`).join('')}
                            </div>
                        </div>
                        <button class="journal-tool-btn j-action-delete" data-id="${note.id}" title="Delete Note">
                            <i class="ph ph-trash"></i>
                        </button>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;

    // --- Create Box Logic ---
    const createBox = document.getElementById('j-create-box');
    const titleIn = document.getElementById('j-new-title');
    const bodyIn = document.getElementById('j-new-body');
    const actions = document.getElementById('j-create-actions');
    let newNoteState = draft;

    function saveDraft() {
        newNoteState.title = titleIn.value;
        newNoteState.body = bodyIn.value;
        localStorage.setItem('journalDraft', JSON.stringify(newNoteState));
    }

    titleIn.addEventListener('input', saveDraft);

    bodyIn.addEventListener('focus', () => {
        actions.style.display = 'flex';
        bodyIn.rows = 3;
    });

    // Auto-resize textarea and save draft
    bodyIn.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        saveDraft();
    });

    document.getElementById('j-new-save').addEventListener('click', () => {
        const title = titleIn.value.trim();
        const body = bodyIn.value.trim();
        if (title || body) {
            const d = getData();
            d.journal.push({
                id: Date.now().toString(),
                title, body,
                color: newNoteState.color,
                pinned: newNoteState.pinned,
                isChecklist: newNoteState.isChecklist,
                checkedLines: [],
                created: Date.now()
            });
            saveData(d);
        }
        localStorage.removeItem('journalDraft');
        renderJournal(container);
    });

    document.getElementById('j-new-pin').addEventListener('click', (e) => {
        newNoteState.pinned = !newNoteState.pinned;
        e.currentTarget.style.color = newNoteState.pinned ? 'var(--accent)' : 'var(--text-muted)';
        saveDraft();
    });

    document.getElementById('j-new-check').addEventListener('click', (e) => {
        newNoteState.isChecklist = !newNoteState.isChecklist;
        e.currentTarget.style.color = newNoteState.isChecklist ? 'var(--accent)' : 'var(--text-muted)';
        bodyIn.placeholder = newNoteState.isChecklist ? 'List items (press Enter for new item)...' : 'Take a note...';
        saveDraft();
    });

    const newColorPicker = document.getElementById('j-new-color-picker');
    document.getElementById('j-new-color').addEventListener('click', () => {
        newColorPicker.classList.toggle('active');
    });
    
    container.querySelectorAll('.new-color-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            newNoteState.color = e.target.dataset.color;
            createBox.style.background = newNoteState.color;
            newColorPicker.classList.remove('active');
            saveDraft();
        });
    });

    // --- Existing Notes Actions ---
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

    container.querySelectorAll('.j-action-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const d = getData();
            d.journal = d.journal.filter(n => n.id !== id);
            saveData(d);
            renderJournal(container);
        });
    });

    container.querySelectorAll('.j-action-color').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const picker = container.querySelector(`.j-color-picker-${id}`);
            container.querySelectorAll('.color-picker').forEach(p => { if (p !== picker) p.classList.remove('active'); });
            picker.classList.toggle('active');
        });
    });

    container.querySelectorAll('.edit-color-swatch').forEach(sw => {
        sw.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const color = e.target.dataset.color;
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note) note.color = color;
            saveData(d);
            renderJournal(container);
        });
    });

    // --- Checklist Checking ---
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
                renderJournal(container);
            }
        });
    });

    // --- Inline Editing for Existing Notes ---

    // 1. Edit Title
    container.querySelectorAll('.journal-note-title[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = e.currentTarget.dataset.id;
            const newTitle = e.currentTarget.innerText.trim();
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note && note.title !== newTitle) {
                note.title = newTitle;
                saveData(d);
                showToast('Title updated.', 'success');
            }
        });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
            }
        });
    });

    // 2. Edit Body (Regular Notes)
    container.querySelectorAll('.journal-note-body[contenteditable="true"]').forEach(el => {
        el.addEventListener('blur', (e) => {
            const id = e.currentTarget.dataset.id;
            const newBody = e.currentTarget.innerText.trim();
            const d = getData();
            const note = d.journal.find(n => n.id === id);
            if (note && note.body !== newBody) {
                note.body = newBody;
                saveData(d);
                showToast('Note updated.', 'success');
            }
        });
    });

    // 3. Edit Checklist Items
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
                    showToast('Item updated.', 'success');
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

                    // Focus newly created item
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

                        // Focus previous item
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
