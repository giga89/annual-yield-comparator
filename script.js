const startYear = 2000;
const currentYear = new Date().getFullYear();
const endYear = currentYear; // Up to current year

// Historical Data loaded from indices_data.js

const userReturns = {};
let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initInputs();
    initChart();
});

function initInputs() {
    // Default: Empty grid as requested "al default non mostrarne nessuna"

    document.getElementById('downloadBtn').addEventListener('click', downloadChart);
    document.getElementById('clearBtn').addEventListener('click', clearData);

    // Listen to Start Year input change to regenerate grid if user wants manual entry
    const startYearInput = document.getElementById('startYear');
    if (startYearInput) {
        // Initial value check
        // If the user manually changes the start year, we regenerate the grid
        startYearInput.addEventListener('change', () => {
            const y = parseInt(startYearInput.value);
            if (y && y >= 2000 && y <= endYear) {
                generateInputGrid(y);
                updateChart();
            }
        });

        // Populate default if needed, or leave as HTML default (2020)
        // But we DON'T generate grid yet.
    }
}

function generateInputGrid(fromYear) {
    const grid = document.getElementById('inputGrid');
    if (!grid) return;
    grid.innerHTML = ''; // Clear existing

    // Ensure we don't go into future or crazy past
    const safeStart = Math.max(2000, fromYear);

    for (let year = safeStart; year <= endYear; year++) {
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

        // Pre-fill if we have data for this year
        if (userReturns[year] !== undefined) {
            input.value = userReturns[year];
        }

        group.appendChild(label);
        group.appendChild(input);
        grid.appendChild(group);
    }
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
        // Use the input value as a filter preference, 
        // BUT we might adjust the grid if data is found earlier?
        // The user said: "Se l'utente ha i dati dal 2011 ci devono essere tutte dal 2011"
        // So the fetch logic should probably find the min year first.
        let requestedStartYear = parseInt(startYearInput.value) || 2020;

        if (!username) {
            updateStatus('Please enter a username', 'error');
            return;
        }

        toggleOverlay(true);
        updateStatus('Fetching data...', 'loading');
        await fetchBullAwareData(username, requestedStartYear);
        toggleOverlay(false);
    });
}

function updateStatus(msg, type) {
    if (!fetchStatus) return;
    fetchStatus.textContent = msg;
    fetchStatus.className = `status-msg ${type}`;
}

async function fetchBullAwareData(username, requestedStartYear) {
    // BullAware might be slow or rate-limit the proxy.
    // Enhanced with Retry Logic

    const MAX_RETRIES = 2;
    let attempt = 0;

    while (attempt <= MAX_RETRIES) {
        attempt++;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://bullaware.com/etoro/${username}`)}&timestamp=${new Date().getTime()}`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 408 || response.status === 504) {
                    throw new Error('Timeout');
                }
                if (response.status === 500) {
                    throw new Error('User not found. Check capitalization (e.g. "BorisAka").');
                }
                throw new Error(`Network error (${response.status})`);
            }

            const text = await response.text();

            if (text.length < 500 && text.toLowerCase().includes('error')) {
                throw new Error("Proxy error possibly.");
            }

            const regex = /\\?"monthlyReturns\\?":\s*(\{[^}]+})/;
            const match = text.match(regex);

            if (match && match[1]) {
                let jsonString = match[1];
                // Aggressive cleaning: Remove ALL backslashes.
                jsonString = jsonString.replace(/\\/g, '');

                try {
                    const monthlyData = JSON.parse(jsonString);
                    processFetchedData(monthlyData, requestedStartYear);
                    updateStatus('Data loaded successfully!', 'success');
                    return;
                } catch (e) {
                    console.error("JSON Parse error:", e);
                    throw new Error("Parsing failed: " + e.message);
                }
            } else {
                throw new Error('Could not find data in response.');
            }

        } catch (error) {
            console.warn(`Attempt ${attempt} failed: ${error.message}`);

            const isTimeout = error.message.includes('Timeout') || error.name === 'AbortError';
            if (isTimeout && attempt <= MAX_RETRIES) {
                updateStatus(`Timeout, retrying... (${attempt}/${MAX_RETRIES})`, 'loading');
                await new Promise(r => setTimeout(r, 1500));
                continue;
            }

            if (attempt > MAX_RETRIES || !isTimeout) {
                let msg = error.message;
                if (msg.includes('Timeout') || msg.includes('AbortError')) {
                    msg = "Server timed out (408). Please try again later.";
                }
                updateStatus(msg, 'error');
                return;
            }
        }
    }
}

function processFetchedData(monthlyData, requestedStartYear) {
    // 1. Organize by year
    const yearsData = {};
    let minYearFound = 3000;

    Object.entries(monthlyData).forEach(([key, val]) => {
        if (!val && val !== 0) return;
        const parts = key.split('-');
        if (parts.length !== 2) return;

        const year = parseInt(parts[0]);
        if (year < minYearFound) minYearFound = year;

        const returnVal = parseFloat(val);

        if (!yearsData[year]) yearsData[year] = [];
        yearsData[year].push(returnVal);
    });

    // 2. Logic to determine Grid Start Year
    // "ok ma se scrivo 2020 nello start year deve rimanere 2020 non prendere TUTTI gli anni"
    // Rule 1: Respect User Filter. If User inputs 2020, do NOT show 2019 even if data exists.
    // Rule 2: If Data starts LATER than User Input (e.g. Input 2020, Data starts 2023), 
    //         we should start from 2023 (hide empty 2020-2022 boxes), because user said:
    //         "se ha i dati solo dal 2023 deve esserci solo 2023..."

    let effectiveStartYear = Math.max(requestedStartYear, minYearFound);
    if (effectiveStartYear < 2000) effectiveStartYear = 2000;

    // We do NOT overwrite the input value unless we are forced to move FORWARD 
    // (e.g. user asked 2020 but data starts 2023).
    if (startYearInput && effectiveStartYear > requestedStartYear) {
        startYearInput.value = effectiveStartYear;
    }
    // If user asked 2020 and data starts 2015, effective is 2020. 
    // We leave input as 2020. Correct.

    // 3. Generate Grid dynamically from this effective start year
    generateInputGrid(effectiveStartYear);

    // 4. Calculate Annual Yields
    const annualYields = {};
    Object.keys(yearsData).forEach(year => {
        // Filter: We only care about data >= effectiveStartYear
        if (year < effectiveStartYear) return;

        const months = yearsData[year];
        let compounded = 1.0;
        months.forEach(r => {
            compounded *= (1 + r / 100);
        });

        const yieldVal = (compounded - 1.0) * 100;
        annualYields[year] = parseFloat(yieldVal.toFixed(4));
    });

    // 5. Reset userReturns
    Object.keys(userReturns).forEach(key => delete userReturns[key]);
    Object.assign(userReturns, annualYields);
    saveUserReturns();

    // 6. Populate inputs
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
        // If we have saved data, what grid to show?
        // Maybe find min year in saved data?
        const years = Object.keys(userReturns).map(Number);
        if (years.length > 0) {
            const min = Math.min(...years);
            if (startYearInput) startYearInput.value = min;
            generateInputGrid(min);
            // Populate inputs
            Object.entries(userReturns).forEach(([year, val]) => {
                const input = document.querySelector(`input[data-year="${year}"]`);
                if (input) input.value = val;
            });
            updateComparison();
            updateChart();
        }
    }
}

function saveUserReturns() {
    localStorage.setItem('annual_yield_user_returns', JSON.stringify(userReturns));
}

function clearData() {
    if (confirm('Are you sure you want to clear all your data?')) {
        for (const key in userReturns) delete userReturns[key];
        localStorage.removeItem('annual_yield_user_returns');

        // Clear grid visuals or empty it?
        // "Al default non mostrarne nessuno" implies when no data, no grid.
        const grid = document.getElementById('inputGrid');
        if (grid) grid.innerHTML = '';

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
    if (!container) return;
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
        <span class="result-footer">Tool by @AndreaRavalli</span>
    `;

    container.appendChild(card);
}

function initChart() {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

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
    // Determine Chart Range
    // Dynamic based on the grid / input start year

    const startYearInput = document.getElementById('startYear');
    let inputStartYear = parseInt(startYearInput.value) || 2020;

    // Safety check
    if (inputStartYear < 2000) inputStartYear = 2000;

    const years = [];
    for (let y = inputStartYear; y <= endYear; y++) years.push(y);

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
        plugins: [{
            id: 'watermark',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const width = chart.width;
                const height = chart.height;

                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.font = '12px "Outfit", sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillText('Tool by @AndreaRavalli', width - 10, height - 10);
                ctx.restore();
            }
        }],
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
