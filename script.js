const startYear = 2000;
const currentYear = new Date().getFullYear();
const endYear = currentYear; // Up to current year

// Historical Data (Hardcoded based on research)
// Historical Data loaded from indices_data.js

const userReturns = {};
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initInputs();
    initChart();
});

function initInputs() {
    const grid = document.getElementById('inputGrid');

    for (let year = startYear; year <= endYear; year++) {
        const group = document.createElement('div');
        group.className = 'year-input-group';

        const label = document.createElement('label');
        label.textContent = year;

        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.01';
        input.placeholder = '%';
        input.dataset.year = year;
        input.addEventListener('input', handleInputChange);

        group.appendChild(label);
        group.appendChild(input);
        grid.appendChild(group);
    }

    document.getElementById('downloadBtn').addEventListener('click', downloadChart);
    document.getElementById('clearBtn').addEventListener('click', clearData);

    // We do NOT loadUserReturns() here to keep fields empty by default as requested.
}

// Fetch Data Logic
const fetchBtn = document.getElementById('fetchBtn');
const etoroUsernameInput = document.getElementById('etoroUsername');
const startYearInput = document.getElementById('startYear');
const fetchStatus = document.getElementById('fetchStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

function toggleOverlay(show) {
    if (show) loadingOverlay.classList.remove('hidden');
    else loadingOverlay.classList.add('hidden');
}

if (fetchBtn) {
    fetchBtn.addEventListener('click', async () => {
        const username = etoroUsernameInput.value.trim();
        const startYear = parseInt(startYearInput.value) || 2020;

        if (!username) {
            updateStatus('Please enter a username', 'error');
            return;
        }

        toggleOverlay(true);
        updateStatus('Fetching data...', 'loading');
        await fetchBullAwareData(username, startYear);
        toggleOverlay(false);
    });
}

function updateStatus(msg, type) {
    if (!fetchStatus) return;
    fetchStatus.textContent = msg;
    fetchStatus.className = `status-msg ${type}`;
}

async function fetchBullAwareData(username, startYear) {
    // BullAware might be slow or rate-limit the proxy.
    // Enhanced with Retry Logic

    const MAX_RETRIES = 2; // Try up to 3 times total
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        attempt++;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://bullaware.com/etoro/${username}`)}&timestamp=${new Date().getTime()}`;

        try {
            // Set a client-side timeout of 10s to fail fast and retry if needed
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                // Handle specifics
                if (response.status === 408 || response.status === 504) {
                    throw new Error('Timeout'); // Trigger retry
                }
                if (response.status === 500) {
                    // Often implies 404 from the target via this specific proxy
                    throw new Error('User not found. Check capitalization (e.g. "BorisAka").');
                }
                throw new Error(`Network error (${response.status})`);
            }

            const text = await response.text();

            // Check if we actually got the target page or a proxy error page
            if (text.length < 500 && text.toLowerCase().includes('error')) {
                throw new Error("Proxy error possibly.");
            }

            // Regex for Data
            const regex = /\\?"monthlyReturns\\?":\s*(\{[^}]+})/;
            const match = text.match(regex);

            if (match && match[1]) {
                let jsonString = match[1];
                // Aggressive cleaning: Remove ALL backslashes.
                // This handles single escaped (\") and double escaped (\\\") quotes securely
                // because our specific dataset (dates and numbers) doesn't use backslashes.
                jsonString = jsonString.replace(/\\/g, '');

                try {
                    const monthlyData = JSON.parse(jsonString);
                    processFetchedData(monthlyData, startYear);
                    updateStatus('Data loaded successfully!', 'success');
                    return; // SUCCESS - Exit function
                } catch (e) {
                    console.error("JSON Parse error:", e);
                    // Show part of the string to debug
                    throw new Error("Parsing failed invalid char at " + e.message + " | String: " + jsonString.substring(0, 30) + "...");
                }
            } else {
                throw new Error('Could not find data in response.');
            }

        } catch (error) {
            console.warn(`Attempt ${attempt} failed: ${error.message}`);

            // Should we retry?
            const isTimeout = error.message.includes('Timeout') || error.name === 'AbortError';
            if (isTimeout && attempt <= MAX_RETRIES) {
                updateStatus(`Timeout, retrying... (${attempt}/${MAX_RETRIES})`, 'loading');
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }

            // Final Error Handling
            if (attempt > MAX_RETRIES || !isTimeout) {
                let msg = error.message;
                if (msg.includes('Timeout') || msg.includes('AbortError')) {
                    msg = "Server timed out (408). Please try again later.";
                }
                updateStatus(msg, 'error');
                return; // Stop trying
            }
        }
    }
}

function processFetchedData(monthlyData, startYear) {
    // Organize by year
    const yearsData = {};

    Object.entries(monthlyData).forEach(([key, val]) => {
        if (!val && val !== 0) return;
        const parts = key.split('-');
        if (parts.length !== 2) return;

        const year = parseInt(parts[0]);
        // Filter by start year
        if (year < startYear) return;

        const returnVal = parseFloat(val);

        if (!yearsData[year]) yearsData[year] = [];
        yearsData[year].push(returnVal);
    });

    // Calculate Annual Yields
    const annualYields = {};
    Object.keys(yearsData).forEach(year => {
        const months = yearsData[year];
        let compounded = 1.0;
        months.forEach(r => {
            compounded *= (1 + r / 100);
        });

        const yieldVal = (compounded - 1.0) * 100;
        // High precision (4 decimals)
        annualYields[year] = parseFloat(yieldVal.toFixed(4));
    });

    // 1. Reset userReturns
    Object.keys(userReturns).forEach(key => delete userReturns[key]);

    // 2. Assign new filtered data
    Object.assign(userReturns, annualYields);
    saveUserReturns();

    // 3. Clear ALL inputs first (visual reset)
    document.querySelectorAll('.year-input-group input').forEach(input => {
        input.value = '';
    });

    // 4. Populate inputs with new data
    Object.entries(userReturns).forEach(([year, val]) => {
        const input = document.querySelector(`input[data-year="${year}"]`);
        if (input) input.value = val;
    });

    try {
        updateComparison();
        updateChart();
    } catch (uiError) {
        console.warn("UI Update failed:", uiError);
    }
}

function loadUserReturns() {
    const saved = localStorage.getItem('annual_yield_user_returns');
    if (saved) {
        Object.assign(userReturns, JSON.parse(saved));
    }

    if (typeof fetchedUserReturns !== 'undefined') {
        Object.assign(userReturns, fetchedUserReturns);
        saveUserReturns();
    }

    Object.entries(userReturns).forEach(([year, val]) => {
        const input = document.querySelector(`input[data-year="${year}"]`);
        if (input) input.value = val;
    });

    updateComparison();
    updateChart();
}

function saveUserReturns() {
    localStorage.setItem('annual_yield_user_returns', JSON.stringify(userReturns));
}

function clearData() {
    if (confirm('Are you sure you want to clear all your data?')) {
        for (const key in userReturns) delete userReturns[key];
        localStorage.removeItem('annual_yield_user_returns');

        document.querySelectorAll('.year-input-group input').forEach(input => {
            input.value = '';
        });

        updateComparison();
        updateChart();
    }
}

function handleInputChange(e) {
    const year = parseInt(e.target.dataset.year);
    const val = parseFloat(e.target.value);

    if (!isNaN(val)) {
        userReturns[year] = val;
    } else {
        delete userReturns[year];
    }

    saveUserReturns();
    updateComparison();
    updateChart();
}

function updateComparison() {
    const container = document.getElementById('comparisonResults');
    container.innerHTML = '';

    const yearsEntered = Object.keys(userReturns).map(Number).sort((a, b) => b - a);

    if (yearsEntered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-keyboard"></i>
                <p>Enter your returns above to see the comparison.</p>
            </div>`;
        return;
    }

    for (const [key, index] of Object.entries(indicesData)) {
        let userCumulative = 1;
        let indexCumulative = 1;
        let validYears = 0;

        yearsEntered.forEach(year => {
            if (index.returns[year] !== undefined) {
                userCumulative *= (1 + userReturns[year] / 100);
                indexCumulative *= (1 + index.returns[year] / 100);
                validYears++;
            }
        });

        if (validYears > 0) {
            const userTotal = (userCumulative - 1) * 100;
            const indexTotal = (indexCumulative - 1) * 100;
            const diff = userTotal - indexTotal;

            createResultCard(container, index.name, diff, userTotal, indexTotal);
        }
    }
}

function createResultCard(container, name, diff, userTotal, indexTotal) {
    const isWin = diff >= 0;
    const card = document.createElement('div');
    card.className = `result-card ${isWin ? 'outperformance' : 'underperformance'}`;

    const diffFormatted = (diff > 0 ? '+' : '') + diff.toFixed(1) + '%';
    const statusText = isWin ? 'OUTPERFORMANCE' : 'UNDERPERFORMANCE';
    const badgeClass = isWin ? 'win' : 'loss';

    card.innerHTML = `
        <div class="result-info">
            <span class="result-title">VS ${name}</span>
            <span class="result-val">You: ${userTotal.toFixed(1)}% | Index: ${indexTotal.toFixed(1)}%</span>
        </div>
        <div class="result-badge ${badgeClass}">
            ${diffFormatted} (${statusText})
        </div>
    `;

    container.appendChild(card);
}

function initChart() {
    const ctx = document.getElementById('performanceChart').getContext('2d');

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { callback: (val) => val + '%' }
                },
                x: {
                    grid: { display: false }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                },
                legend: {
                    labels: { usePointStyle: true, boxWidth: 8 }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function updateChart() {
    // 1. Determine Chart Range
    const inputStartYear = parseInt(document.getElementById('startYear').value) || startYear;
    const years = [];
    for (let y = inputStartYear; y <= endYear; y++) years.push(y);

    // 2. Prepare Datasets
    const datasets = [];

    // User Dataset (Accumulated)
    const userPoints = [];
    let userCum = 100;

    years.forEach((year) => {
        const val = userReturns[year];
        if (val !== undefined && val !== null && !isNaN(val)) {
            userCum = userCum * (1 + val / 100);
            userPoints.push(userCum - 100);
        } else {
            userPoints.push(null);
        }
    });

    if (userPoints.some(p => p !== null)) {
        datasets.push({
            label: 'You',
            data: userPoints,
            borderColor: '#4ade80', // Green
            backgroundColor: 'rgba(74, 222, 128, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }

    // Indices Lines
    Object.values(indicesData).forEach(index => {
        const points = [];
        let cum = 100;

        years.forEach(year => {
            const ret = index.returns[year];
            if (ret !== undefined) {
                cum = cum * (1 + ret / 100);
                points.push(cum - 100);
            } else {
                points.push(null);
            }
        });

        datasets.push({
            label: index.name,
            data: points,
            borderColor: index.color,
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    });

    // 3. Render Chart
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        callback: (val) => val + '%'
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2) + '%';
                            }
                            return label;
                        }
                    }
                },
                legend: {
                    labels: { usePointStyle: true, boxWidth: 8, color: '#94a3b8' }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function downloadChart() {
    const link = document.createElement('a');
    link.download = 'performance_chart.png';
    link.href = document.getElementById('performanceChart').toDataURL('image/png', 1.0);
    link.click();
}
