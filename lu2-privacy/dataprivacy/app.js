// ── State ──
let sampleData = [];
let pseudoKeyMap = {};

// ── DOM refs ──
const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const generateBtn = document.getElementById('generateBtn');
const anonymizeBtn = document.getElementById('anonymizeBtn');
const statusBar = document.getElementById('statusBar');
const originalSection = document.getElementById('originalSection');
const originalDataDiv = document.getElementById('originalData');
const comparisonSection = document.getElementById('comparisonSection');
const comparisonTableDiv = document.getElementById('comparisonTable');

// ── Toggle API key visibility ──
toggleKeyBtn.addEventListener('click', () => {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
});

// ── Status helpers ──
function setStatus(msg, type = '') {
    statusBar.className = 'status-bar ' + type;
    statusBar.innerHTML = msg;
}

// ── Gemini call ──
async function callGemini(prompt, systemPrompt = '') {
    const key = apiKeyInput.value.trim();
    if (!key) throw new Error('Please enter your Google Gemini API key.');

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2000
        }
    };

    if (systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    return data.candidates[0].content.parts[0].text;
}

// ── Generate sample data via Gemini ──
generateBtn.addEventListener('click', async () => {
    try {
        generateBtn.disabled = true;
        anonymizeBtn.disabled = true;
        setStatus('<span class="spinner"></span> Generating realistic sample data via Gemini...');

        const prompt = `Generate exactly 5 realistic but fictional personal data records as a JSON array. Each object must have these fields:
- name (full name)
- email (realistic email)
- phone (with country code)
- dob (date of birth, YYYY-MM-DD)
- address (full street address with city, state, zip)
- ssn (US SSN format XXX-XX-XXXX)
- medical_condition (a specific condition)
- salary (annual, as number)
- employer (company name)

Make the records diverse in demographics. Return ONLY the JSON array, no markdown fences.`;

        const raw = await callGemini(prompt, 'You are a data generator. Return only valid JSON.');
        const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        sampleData = JSON.parse(cleaned);

        renderOriginalData();
        originalSection.classList.remove('hidden');
        anonymizeBtn.disabled = false;
        setStatus('Sample data generated. Click "Apply All Techniques" to see anonymization results.', 'success');
    } catch (e) {
        setStatus('Error: ' + e.message, 'error');
    } finally {
        generateBtn.disabled = false;
    }
});

// ── Apply all techniques ──
anonymizeBtn.addEventListener('click', async () => {
    try {
        anonymizeBtn.disabled = true;
        generateBtn.disabled = true;
        setStatus('<span class="spinner"></span> Applying anonymization techniques...');

        // 1. Deidentification (local)
        const deidentified = applyDeidentification(sampleData);
        renderDeidentResult('deidentResult', deidentified, sampleData);

        // 2. Pseudonymization (local)
        const { data: pseudonymized, keyMap } = applyPseudonymization(sampleData);
        pseudoKeyMap = keyMap;
        renderPseudoResult('pseudoResult', pseudonymized, keyMap);

        // 3. Objective Anonymization (local)
        const objectiveAnon = applyObjectiveAnonymization(sampleData);
        renderResult('objectiveResult', objectiveAnon, 'objective');

        // 4. Subjective Anonymization — 3 reviewers with different judgment
        setStatus('<span class="spinner"></span> Simulating 3 reviewers applying subjective anonymization (via AI)...');
        const subjectiveAnon = await applySubjectiveAnonymization(sampleData);
        renderSubjectiveResult('subjectiveResult', subjectiveAnon, sampleData);

        // Comparison table
        renderComparison(sampleData, deidentified, pseudonymized, objectiveAnon, subjectiveAnon);
        comparisonSection.classList.remove('hidden');

        setStatus('All techniques applied successfully.', 'success');
    } catch (e) {
        setStatus('Error: ' + e.message, 'error');
    } finally {
        anonymizeBtn.disabled = false;
        generateBtn.disabled = false;
    }
});

// ── Deidentification: remove only direct identifiers, keep quasi-identifiers ──
// This is the real problem: quasi-identifiers remain and can be cross-referenced
function applyDeidentification(data) {
    return data.map(r => ({
        name: '[REMOVED]',
        email: '[REMOVED]',
        phone: '[REMOVED]',
        dob: r.dob,                    // kept — seems harmless but is a quasi-identifier
        address: extractCityState(r.address), // partial — city/state kept
        ssn: '[REMOVED]',
        medical_condition: r.medical_condition, // kept — sensitive but "not an identifier"
        salary: r.salary,              // kept — quasi-identifier
        employer: r.employer           // kept — quasi-identifier
    }));
}

function extractCityState(addr) {
    const parts = addr.split(',');
    if (parts.length >= 3) {
        return parts.slice(-2).join(',').replace(/\d{5}(-\d{4})?/, '').trim();
    }
    if (parts.length >= 2) {
        return parts.slice(-1)[0].replace(/\d{5}(-\d{4})?/, '').trim();
    }
    return addr;
}

// ── Pseudonymization: replace identifiers with consistent keys ──
function applyPseudonymization(data) {
    const keyMap = {};
    const pseudoData = data.map((r, i) => {
        const id = `PSE-${String(i + 1).padStart(4, '0')}`;
        keyMap[id] = { name: r.name, email: r.email, ssn: r.ssn };
        return {
            pseudo_id: id,
            name: id,
            email: `${id.toLowerCase()}@pseudonym.internal`,
            phone: `+X-XXX-${String(Math.floor(Math.random() * 9000) + 1000)}`,
            dob: r.dob,
            address: `Unit ${Math.floor(Math.random() * 900) + 100}, Pseudo Building, Mapped City`,
            ssn: `PSE-${String(Math.floor(Math.random() * 90000) + 10000)}`,
            medical_condition: r.medical_condition,
            salary: r.salary,
            employer: `ORG-${String.fromCharCode(65 + i)}${String.fromCharCode(65 + ((i * 3) % 26))}`
        };
    });
    return { data: pseudoData, keyMap };
}

// ── Objective Anonymization: irreversibly strip all PII, generalize ──
function applyObjectiveAnonymization(data) {
    function ageRange(dob) {
        const age = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
        const low = Math.floor(age / 10) * 10;
        return `${low}-${low + 9}`;
    }

    function salaryBucket(s) {
        if (s < 40000) return 'Under 40K';
        if (s < 60000) return '40K-60K';
        if (s < 80000) return '60K-80K';
        if (s < 100000) return '80K-100K';
        if (s < 150000) return '100K-150K';
        return '150K+';
    }

    function regionOnly(addr) {
        const parts = addr.split(',');
        if (parts.length >= 2) {
            const stateZip = parts[parts.length - 1].trim();
            const state = stateZip.replace(/\d{5}(-\d{4})?/, '').trim();
            return state || 'Unknown Region';
        }
        return 'Unknown Region';
    }

    function generalizeCondition(c) {
        const lower = c.toLowerCase();
        if (lower.includes('diabet')) return 'Metabolic Disorder';
        if (lower.includes('hypertens') || lower.includes('blood pressure')) return 'Cardiovascular Condition';
        if (lower.includes('asthma') || lower.includes('copd') || lower.includes('lung')) return 'Respiratory Condition';
        if (lower.includes('depress') || lower.includes('anxiety') || lower.includes('mental')) return 'Mental Health Condition';
        if (lower.includes('cancer') || lower.includes('tumor')) return 'Oncological Condition';
        if (lower.includes('arthrit') || lower.includes('joint')) return 'Musculoskeletal Condition';
        return 'General Health Condition';
    }

    return data.map(r => ({
        age_range: ageRange(r.dob),
        region: regionOnly(r.address),
        condition_category: generalizeCondition(r.medical_condition),
        salary_range: salaryBucket(r.salary),
        industry: 'Private Sector'
    }));
}

// ── Subjective Anonymization: 3 different reviewers, same data, different judgments ──
async function applySubjectiveAnonymization(data) {
    const reviewers = [
        {
            id: 'A',
            name: 'Reviewer A — Minimal (Intern)',
            role: 'a junior intern preparing data for a training workshop',
            description: 'Removes only obvious identifiers like names. Keeps most other fields, not recognizing indirect identifiers.',
            style: 'conservative-remove',
            instruction: `You are a junior intern who only removes the most obvious direct identifiers (name, email, SSN).
You do NOT think about indirect identification risks. You keep employer, full DOB, salary, address, medical conditions, and phone numbers because they "aren't names".
You might partially mask phone numbers but that's about it. You are naive about re-identification.`
        },
        {
            id: 'B',
            name: 'Reviewer B — Moderate (Analyst)',
            role: 'a data analyst preparing a dataset for a published research report',
            description: 'Removes names, company, location details, and exact salary. Generalizes some fields. Misses some indirect identifiers.',
            style: 'moderate',
            instruction: `You are an experienced data analyst preparing data for a published research paper.
You remove names, emails, SSNs, phone numbers, employer names, and exact addresses.
You generalize salary to a range and keep only birth year (not full DOB).
However, you keep the specific medical condition and a general location (state), thinking these are useful for research and unlikely to re-identify.`
        },
        {
            id: 'C',
            name: 'Reviewer C — Aggressive (Privacy Officer)',
            role: 'a privacy officer reviewing data before sharing with an external vendor',
            description: 'Removes or generalizes anything that could even indirectly identify a person, including combinations of quasi-identifiers.',
            style: 'aggressive',
            instruction: `You are a strict privacy officer reviewing data before sharing with an external AI vendor.
You remove ALL direct identifiers and also aggressively generalize quasi-identifiers.
You generalize DOB to just an age decade, salary to a very broad bracket, medical condition to a general category, employer to just an industry, and address to just a region.
You think about how combinations of fields can re-identify people and suppress anything that could be cross-referenced.`
        }
    ];

    const prompt = `You are simulating 3 different reviewers who each apply SUBJECTIVE anonymization to the same personal data. Subjective anonymization means each reviewer uses their own judgment about what to remove — there is no fixed standard.

Here is the original data:
${JSON.stringify(data, null, 2)}

For each of these 3 reviewer personas, produce their version of the anonymized data:

${reviewers.map(r => `**${r.name}**: ${r.instruction}`).join('\n\n')}

Return a JSON object with three keys: "reviewer_A", "reviewer_B", "reviewer_C".
Each value is an array of 5 objects (one per record) showing how that reviewer would anonymize each record.
Each object should have ALL 9 original field names as keys. For removed fields, use "[REMOVED]". For generalized fields, show the generalized value. For kept fields, show the original value.

Return ONLY the JSON object, no markdown fences, no explanation.`;

    const raw = await callGemini(prompt, 'You generate valid JSON only. No markdown. No explanation.');
    const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return { reviewers, results: parsed };
}

// ── Render Deidentification with re-identification demo ──
function renderDeidentResult(containerId, deidentData, originalData) {
    const el = document.getElementById(containerId);
    const fields = Object.keys(deidentData[0]);

    // Data table
    let html = '<table class="data-table"><thead><tr>';
    html += fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const row of deidentData) {
        html += '<tr>';
        html += fields.map(f => {
            const val = String(row[f]);
            const cls = val.includes('[REMOVED]') ? 'cell-redacted' : '';
            return `<td class="${cls}">${escapeHtml(val)}</td>`;
        }).join('');
        html += '</tr>';
    }
    html += '</tbody></table>';

    // Re-identification attack demo
    html += `<div class="reid-warning">
        <div class="reid-title">Re-Identification Attack Demo</div>
        <p class="reid-desc">Even with name, email, and SSN removed, the remaining quasi-identifiers
        (DOB + city/state + employer + salary) can uniquely fingerprint individuals.
        An attacker with access to public records, LinkedIn, or company directories
        can cross-reference to re-identify people.</p>
        <div class="reid-examples">`;

    deidentData.forEach((row, i) => {
        const orig = originalData[i];
        html += `<div class="reid-card">
            <div class="reid-card-label">Record ${i + 1} — Attack Vector</div>
            <div class="reid-clues">
                <span class="reid-clue">DOB: <strong>${escapeHtml(row.dob)}</strong></span>
                <span class="reid-clue">Location: <strong>${escapeHtml(row.address)}</strong></span>
                <span class="reid-clue">Employer: <strong>${escapeHtml(row.employer)}</strong></span>
                <span class="reid-clue">Salary: <strong>$${Number(row.salary).toLocaleString()}</strong></span>
            </div>
            <div class="reid-arrow">cross-reference with public data &#x2192;</div>
            <div class="reid-reveal">
                <span class="reid-match">Likely match: <strong>${escapeHtml(orig.name)}</strong></span>
            </div>
        </div>`;
    });

    html += '</div></div>';
    el.innerHTML = html;
}

// ── Rendering helpers ──
function renderOriginalData() {
    if (!sampleData.length) return;
    const fields = Object.keys(sampleData[0]);
    let html = '<table class="data-table"><thead><tr>';
    html += fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const row of sampleData) {
        html += '<tr>';
        html += fields.map(f => `<td>${escapeHtml(String(row[f]))}</td>`).join('');
        html += '</tr>';
    }
    html += '</tbody></table>';
    originalDataDiv.innerHTML = html;
}

function renderResult(containerId, data, style) {
    const el = document.getElementById(containerId);
    if (!data.length) { el.innerHTML = '<span class="placeholder">No data</span>'; return; }
    const fields = Object.keys(data[0]);
    const cellClass = style === 'deident' ? 'cell-redacted' : style === 'objective' ? 'cell-stripped' : '';
    let html = '<table class="data-table"><thead><tr>';
    html += fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const row of data) {
        html += '<tr>';
        html += fields.map(f => {
            const val = String(row[f]);
            const cls = val.includes('[REMOVED]') || val.includes('[REDACTED]') ? 'cell-redacted' : cellClass;
            return `<td class="${cls}">${escapeHtml(val)}</td>`;
        }).join('');
        html += '</tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
}

function renderPseudoResult(containerId, data, keyMap) {
    const el = document.getElementById(containerId);
    const fields = Object.keys(data[0]).filter(f => f !== 'pseudo_id');
    let html = '<table class="data-table"><thead><tr>';
    html += fields.map(f => `<th>${escapeHtml(f)}</th>`).join('');
    html += '</tr></thead><tbody>';
    for (const row of data) {
        html += '<tr>';
        html += fields.map(f => {
            const val = String(row[f]);
            const isPseudo = val.startsWith('PSE-') || val.includes('pseudonym') || val.includes('Pseudo') || val.startsWith('ORG-');
            return `<td class="${isPseudo ? 'cell-key' : ''}">${escapeHtml(val)}</td>`;
        }).join('');
        html += '</tr>';
    }
    html += '</tbody></table>';

    html += '<details style="margin-top:.8rem"><summary style="cursor:pointer;color:var(--pseudo);font-size:.85rem;font-weight:600">Show Lookup Key Table (kept separately & securely)</summary>';
    html += '<table class="data-table" style="margin-top:.5rem"><thead><tr><th>Pseudo ID</th><th>Real Name</th><th>Real Email</th><th>Real SSN</th></tr></thead><tbody>';
    for (const [id, real] of Object.entries(keyMap)) {
        html += `<tr><td class="cell-key">${escapeHtml(id)}</td><td>${escapeHtml(real.name)}</td><td>${escapeHtml(real.email)}</td><td>${escapeHtml(real.ssn)}</td></tr>`;
    }
    html += '</tbody></table></details>';
    el.innerHTML = html;
}

function renderSubjectiveResult(containerId, subjectiveData, originalData) {
    const el = document.getElementById(containerId);
    const { reviewers, results } = subjectiveData;
    const fields = Object.keys(originalData[0]);
    const reviewerKeys = ['reviewer_A', 'reviewer_B', 'reviewer_C'];
    const reviewerColors = ['#ffa94d', '#22b8cf', '#b197fc'];

    // Record selector — show Record 1 by default
    let html = `<div class="subj-controls">
        <label>Inspect record:</label>
        <div class="subj-record-btns">
            ${originalData.map((_, i) => `<button class="subj-rec-btn ${i === 0 ? 'active' : ''}" data-rec="${i}">Record ${i + 1}</button>`).join('')}
        </div>
    </div>`;

    // Intro
    html += `<div class="subj-intro">
        <p>The <strong>same data</strong> is given to 3 different reviewers. Each applies their own judgment about what to remove.
        There is no fixed standard — this is what makes it <em>subjective</em>.</p>
    </div>`;

    // Reviewer profiles
    html += '<div class="subj-reviewers">';
    reviewers.forEach((r, ri) => {
        html += `<div class="subj-reviewer-badge" style="border-color:${reviewerColors[ri]}">
            <div class="subj-reviewer-name" style="color:${reviewerColors[ri]}">${escapeHtml(r.name)}</div>
            <div class="subj-reviewer-desc">${escapeHtml(r.description)}</div>
            <div class="subj-reviewer-context">Context: ${escapeHtml(r.role)}</div>
        </div>`;
    });
    html += '</div>';

    // Per-record comparison panels (one visible at a time)
    originalData.forEach((orig, recIdx) => {
        html += `<div class="subj-record-panel ${recIdx === 0 ? '' : 'hidden'}" data-panel="${recIdx}">`;

        // Side-by-side field comparison table
        html += `<table class="data-table subj-compare-table"><thead><tr>`;
        html += `<th>Field</th><th>Original</th>`;
        reviewers.forEach((r, ri) => {
            html += `<th style="color:${reviewerColors[ri]}">Reviewer ${r.id}</th>`;
        });
        html += `</tr></thead><tbody>`;

        for (const field of fields) {
            html += '<tr>';
            html += `<td style="font-weight:600;white-space:nowrap">${escapeHtml(field)}</td>`;
            html += `<td>${escapeHtml(String(orig[field]))}</td>`;

            reviewerKeys.forEach((rk, ri) => {
                const reviewerData = results[rk];
                const rec = reviewerData && reviewerData[recIdx];
                const val = rec ? String(rec[field] ?? '[REMOVED]') : '---';
                const origVal = String(orig[field]);

                let cls = '';
                if (val === '[REMOVED]' || val === '[removed]' || val.toLowerCase().includes('removed')) {
                    cls = 'cell-redacted';
                } else if (val !== origVal) {
                    cls = 'cell-generalized';
                }

                html += `<td class="${cls}">${escapeHtml(val)}</td>`;
            });

            html += '</tr>';
        }

        html += '</tbody></table>';

        // Inconsistency callout
        html += `<div class="subj-inconsistency">
            <div class="subj-inconsistency-title">Inconsistencies Highlighted</div>
            <div class="subj-inconsistency-body">`;

        for (const field of fields) {
            const vals = reviewerKeys.map(rk => {
                const rec = results[rk] && results[rk][recIdx];
                return rec ? String(rec[field] ?? '[REMOVED]') : '---';
            });
            const allSame = vals.every(v => v === vals[0]);
            if (!allSame) {
                html += `<div class="subj-diff-row">
                    <span class="subj-diff-field">${escapeHtml(field)}</span>
                    ${vals.map((v, vi) => `<span class="subj-diff-val" style="border-color:${reviewerColors[vi]}">${escapeHtml(v)}</span>`).join('<span class="subj-diff-vs">vs</span>')}
                </div>`;
            }
        }

        html += `</div>
            <p class="subj-inconsistency-note">These differences show why subjective anonymization is <strong>context-dependent</strong>
            and can be <strong>inconsistent across reviewers</strong>. The same dataset, 3 different outcomes.</p>
        </div>`;

        html += '</div>'; // end panel
    });

    // Use cases
    html += `<div class="subj-usecases">
        <div class="subj-usecases-title">Where Subjective Anonymization Is Used</div>
        <div class="subj-usecase-tags">
            <span class="subj-tag">Research Reports</span>
            <span class="subj-tag">Case Studies</span>
            <span class="subj-tag">Training Materials (WSQ)</span>
            <span class="subj-tag">Legal / Compliance Reviews</span>
            <span class="subj-tag">AI/LLM Training Data</span>
        </div>
        <p class="subj-usecase-note">Because decisions vary by reviewer, organizations should document their anonymization rationale
        and have multiple reviewers cross-check for hidden identifiers.</p>
    </div>`;

    el.innerHTML = html;

    // Wire up record selector buttons
    el.querySelectorAll('.subj-rec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            el.querySelectorAll('.subj-rec-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const idx = parseInt(btn.dataset.rec);
            el.querySelectorAll('.subj-record-panel').forEach(p => {
                p.classList.toggle('hidden', parseInt(p.dataset.panel) !== idx);
            });
        });
    });
}

function renderComparison(original, deident, pseudo, objective, subjective) {
    let html = '<table class="comparison"><thead><tr>';
    html += '<th>Field</th><th>Original</th>';
    html += '<th class="col-deident">Deidentified</th>';
    html += '<th class="col-pseudo">Pseudonymized</th>';
    html += '<th class="col-objective">Obj. Anonymized</th>';
    html += '<th class="col-subjective" style="color:#ffa94d">Subj. (Intern)</th>';
    html += '<th class="col-subjective">Subj. (Analyst)</th>';
    html += '<th class="col-subjective" style="color:#b197fc">Subj. (Privacy Off.)</th>';
    html += '</tr></thead><tbody>';

    const orig = original[0];
    const dei = deident[0];
    const pse = pseudo[0];
    const obj = objective[0];
    const subResults = subjective.results;

    const origFields = Object.keys(orig);
    for (const field of origFields) {
        html += '<tr>';
        html += `<td style="font-weight:600">${escapeHtml(field)}</td>`;
        html += `<td>${escapeHtml(String(orig[field]))}</td>`;
        html += `<td class="cell-redacted">${escapeHtml(String(dei[field] ?? '---'))}</td>`;
        html += `<td class="cell-key">${escapeHtml(String(pse[field] ?? '---'))}</td>`;

        const objMapping = {
            name: '---', email: '---', phone: '---',
            dob: obj.age_range, address: obj.region,
            ssn: '---', medical_condition: obj.condition_category,
            salary: obj.salary_range, employer: obj.industry
        };
        html += `<td class="cell-stripped">${escapeHtml(String(objMapping[field] ?? '---'))}</td>`;

        // 3 subjective reviewers
        ['reviewer_A', 'reviewer_B', 'reviewer_C'].forEach(rk => {
            const rec = subResults[rk] && subResults[rk][0];
            const val = rec ? String(rec[field] ?? '[REMOVED]') : '---';
            const isRemoved = val.toLowerCase().includes('removed');
            const isChanged = val !== String(orig[field]);
            const cls = isRemoved ? 'cell-redacted' : isChanged ? 'cell-context' : '';
            html += `<td class="${cls}">${escapeHtml(val)}</td>`;
        });

        html += '</tr>';
    }

    html += '</tbody></table>';
    comparisonTableDiv.innerHTML = html;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
