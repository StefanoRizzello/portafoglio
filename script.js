// --- CONFIGURAZIONE INIZIALE ---
let portfolio = {
    monthlyBudget: 500,
    targetGoal: 10000,
    transactions: [],
    etfs: [
        { isin: 'IE00B4L5Y983', name: 'MSCI World', share: 0.60, price: 92.45, ticker: 'IWDA.AS', owned: 0, change: 0 },
        { isin: 'IE00BKM4GZ66', name: 'MSCI EM IMI', share: 0.20, price: 31.12, ticker: 'EIMI.L', owned: 0, change: 0 },
        { isin: 'IE00B579F325', name: 'Global Bond', share: 0.20, price: 4.85, ticker: 'VAGF.DE', owned: 0, change: 0 },
    ],
    cashBalance: 0,
    investedTotal: 0
};

let charts = { performance: null, doughnut: null, forecast: null };
let editingIndex = null;

// --- INIZIALIZZAZIONE ---
window.onload = async () => {
    const saved = localStorage.getItem('tr_pro_ultra_v3');
    if (saved) {
        const parsed = JSON.parse(saved);
        portfolio = { ...portfolio, ...parsed };
    }
    
    syncSettingsFields();
    const dateInput = document.getElementById('budget-date');
    if (dateInput) dateInput.value = new Date().toISOString().substring(0, 7);

    setupLivePreview(); 
    recalculateAll(); 
    initPerformanceChart();
    fetchMarketData();
    
    setInterval(fetchMarketData, 60000);
};

// --- GESTIONE IMPOSTAZIONI ---
function syncSettingsFields() {
    if (document.getElementById('set-budget')) document.getElementById('set-budget').value = portfolio.monthlyBudget;
    if (document.getElementById('target-goal-input')) document.getElementById('target-goal-input').value = portfolio.targetGoal;
    safeSet('display-target-goal', portfolio.targetGoal.toLocaleString('it-IT'));
}

function saveAllSettings() {
    const newBudget = parseFloat(document.getElementById('set-budget').value);
    const newTarget = parseFloat(document.getElementById('target-goal-input').value);
    if (!isNaN(newBudget)) portfolio.monthlyBudget = newBudget;
    if (!isNaN(newTarget)) portfolio.targetGoal = newTarget;
    saveData();
    recalculateAll();
    showNotification("Impostazioni salvate!", "⚙️");
}

// --- LOGICA SLIDER GRANULARE ---
function setupLivePreview() {
    const budgetInput = document.getElementById('budget-input');
    const controls = document.getElementById('allocation-controls');
    
    budgetInput?.addEventListener('input', (e) => {
        const total = parseFloat(e.target.value) || 0;
        if (total > 0) {
            controls.classList.remove('hidden');
            renderGranularSliders(total);
        } else {
            controls.classList.add('hidden');
        }
    });
}

function renderGranularSliders(totalBudget) {
    const container = document.getElementById('allocation-sliders-container');
    if (!container) return;

    // Calcolo iniziale suggerito: budget mensile in ETF, eccedenza in Cash
    let initEtfTotal = Math.min(totalBudget, portfolio.monthlyBudget);
    let initCash = totalBudget - initEtfTotal;

    let values = {
        cash: initCash,
        etf0: initEtfTotal * portfolio.etfs[0].share,
        etf1: initEtfTotal * portfolio.etfs[1].share,
        etf2: initEtfTotal * portfolio.etfs[2].share
    };

    const updateAll = () => {
        container.innerHTML = `
            <div class="space-y-4">
                ${renderSingleSlider('Liquidità (Cash)', 'cash', values.cash, totalBudget)}
                ${renderSingleSlider(portfolio.etfs[0].name, 'etf0', values.etf0, totalBudget)}
                ${renderSingleSlider(portfolio.etfs[1].name, 'etf1', values.etf1, totalBudget)}
                ${renderSingleSlider(portfolio.etfs[2].name, 'etf2', values.etf2, totalBudget)}
            </div>
        `;

        container.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.id;
                const newVal = parseFloat(e.target.value);
                const diff = newVal - values[id];
                const otherKeys = Object.keys(values).filter(k => k !== id);
                const sumOthers = otherKeys.reduce((s, k) => s + values[k], 0);

                if (sumOthers > 0) {
                    otherKeys.forEach(k => { values[k] -= diff * (values[k] / sumOthers); });
                } else {
                    otherKeys.forEach(k => { values[k] -= diff / otherKeys.length; });
                }
                
                values[id] = newVal;
                Object.keys(values).forEach(k => { if(values[k] < 0) values[k] = 0; });
                updateAll();
            });
        });

        // Memorizza i dati per il salvataggio
        container.dataset.vals = JSON.stringify(values);
    };
    updateAll();
}

function renderSingleSlider(label, id, val, max) {
    return `
        <div>
            <div class="flex justify-between text-[10px] mb-1 font-bold italic">
                <span class="text-gray-400">${label.toUpperCase()}</span>
                <span class="text-blue-400">€ ${val.toLocaleString('it-IT', {minimumFractionDigits:2})}</span>
            </div>
            <input type="range" id="${id}" min="0" max="${max}" step="0.01" value="${val}" 
                class="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500">
        </div>`;
}

function renderForecastChart(labels, data) {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) {
        console.error("Canvas forecastChart non trovato!");
        return;
    }

    if (charts.forecast) {
        charts.forecast.destroy();
    }

    charts.forecast = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Patrimonio Stimato',
                data: data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { 
                        color: '#555', 
                        font: { size: 9 },
                        callback: (value) => '€' + value.toLocaleString()
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#555', font: { size: 9 } }
                }
            }
        }
    });
}

// --- MOTORE DATI LIVE ---
async function fetchMarketData() {
    const myProxy = "https://script.google.com/macros/s/AKfycbyZi2XtovfThhifu3w3vxfXpYP1z2_WcGNfqw9TKagV6dta_jb4PPo8Y4Kdw9-LAp2xUg/exec";
    for (let etf of portfolio.etfs) {
        try {
            const target = `https://query1.finance.yahoo.com/v8/finance/chart/${etf.ticker}?interval=1d&range=1d`;
            const res = await fetch(`${myProxy}?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            const meta = data.chart?.result?.[0]?.meta;
            if (meta) {
                etf.price = meta.regularMarketPrice || meta.chartPreviousClose || etf.price;
                const prevClose = meta.previousClose || meta.chartPreviousClose;
                etf.change = prevClose ? ((etf.price - prevClose) / prevClose) * 100 : 0;
            }
        } catch (e) { console.error("Errore API:", e); }
    }
    recalculateAll();
}

// --- CALCOLI CORE ---
function recalculateAll() {
    let deposited = 0;
    let currentCash = 0;
    portfolio.etfs.forEach(e => e.owned = 0);
    
    portfolio.transactions.forEach(tx => {
        deposited += tx.amount;
        currentCash += tx.cashPart;
        
        portfolio.etfs.forEach((etf, idx) => {
            const savedPriceObj = tx.buyPrices ? tx.buyPrices.find(p => p.ticker === etf.ticker) : null;
            const priceAtPurchase = (savedPriceObj && savedPriceObj.price > 0) ? savedPriceObj.price : etf.price;
            
            // Usa ripartizione custom se presente (per nuovi versamenti granulari)
            let investedInThisEtf = tx.customWeights ? tx.customWeights[idx].amount : (tx.etfPart * etf.share);

            if (priceAtPurchase > 0) {
                etf.owned += investedInThisEtf / priceAtPurchase;
            }
        });
    });

    portfolio.investedTotal = deposited;
    portfolio.cashBalance = currentCash;
    updateUI();
}

function updateUI() {
    const etfVal = portfolio.etfs.reduce((s, e) => s + (e.owned * e.price), 0);
    const totalMaturato = etfVal + portfolio.cashBalance;
    const investito = portfolio.investedTotal;
    const pnl = totalMaturato - investito;
    const pnlPerc = investito > 0 ? (pnl / investito * 100) : 0;

    const tassePlusvalenza = pnl > 0 ? pnl * 0.26 : 0;
    const nettoStimato = totalMaturato - tassePlusvalenza;

    safeSet('total-balance', `€ ${totalMaturato.toLocaleString('it-IT', {minimumFractionDigits: 2})}`);
    safeSet('net-balance', `€ ${nettoStimato.toLocaleString('it-IT', {minimumFractionDigits: 2})}`);
    safeSet('stat-investito', `€ ${investito.toLocaleString('it-IT', {minimumFractionDigits: 2})}`);
    
    const taxEl = document.getElementById('tax-bollo');
    if (taxEl) taxEl.innerText = `€ ${tassePlusvalenza.toLocaleString('it-IT', {minimumFractionDigits: 2})} (Tasse 26%)`;

    safeSet('annual-interest', `€ ${(portfolio.cashBalance * 0.02).toLocaleString('it-IT', {minimumFractionDigits: 2})}`);
    
    const profitEl = document.getElementById('stat-profitto');
    if (profitEl) {
        profitEl.innerText = `${pnl >= 0 ? '+' : ''}€ ${pnl.toLocaleString('it-IT', {minimumFractionDigits: 2})} (${pnlPerc.toFixed(2)}%)`;
        profitEl.className = `inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold mt-2 bg-white/5 italic ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`;
    }

    const progress = Math.min((totalMaturato / portfolio.targetGoal) * 100, 100);
    safeSet('target-percentage', Math.round(progress) + '%');
    if (document.getElementById('target-bar')) document.getElementById('target-bar').style.width = progress + '%';
    
    renderEtfList();
    renderHistory();
}

// --- TRANSAZIONI ---
function distributeBudget() {
    const amount = parseFloat(document.getElementById('budget-input').value);
    const date = document.getElementById('budget-date').value;
    const container = document.getElementById('allocation-sliders-container');
    
    if (!amount || !date || !container.dataset.vals) return showNotification("Dati mancanti", "⚠️");

    const vals = JSON.parse(container.dataset.vals);

    const newTx = {
        date, amount, 
        etfPart: vals.etf0 + vals.etf1 + vals.etf2, 
        cashPart: vals.cash,
        customWeights: [
            { ticker: portfolio.etfs[0].ticker, amount: vals.etf0 },
            { ticker: portfolio.etfs[1].ticker, amount: vals.etf1 },
            { ticker: portfolio.etfs[2].ticker, amount: vals.etf2 }
        ],
        buyPrices: portfolio.etfs.map(e => ({ ticker: e.ticker, price: e.price }))
    };

    if (editingIndex !== null) {
        portfolio.transactions[editingIndex] = newTx;
        editingIndex = null;
        showNotification("Modifica salvata!", "✏️");
    } else {
        portfolio.transactions.push(newTx);
        showNotification("Versamento registrato!", "✅");
    }

    saveData();
    recalculateAll();
    document.getElementById('budget-input').value = '';
    document.getElementById('allocation-controls').classList.add('hidden');
}

function editTransaction(idx) {
    const tx = portfolio.transactions[idx];
    editingIndex = idx;
    showTab('main');
    document.getElementById('budget-input').value = tx.amount;
    document.getElementById('budget-date').value = tx.date;
    document.getElementById('allocation-controls').classList.remove('hidden');
    renderGranularSliders(tx.amount); // Ricarica gli slider con l'importo corretto
    showNotification("Modalità Modifica", "✏️");
}

function deleteTransaction(idx) {
    if(confirm("Eliminare definitivamente?")) {
        portfolio.transactions.splice(idx, 1);
        saveData();
        recalculateAll();
    }
}

// --- RENDER ---
function renderEtfList() {
    const list = document.getElementById('etf-list'); if (!list) return;
    list.innerHTML = portfolio.etfs.map(e => `
        <div class="glass-card p-5">
            <div class="flex justify-between items-center">
                <div><h4 class="font-bold italic text-blue-400">${e.name}</h4><p class="text-[9px] text-gray-500">${e.isin}</p></div>
                <div class="text-right">
                    <p class="text-xs ${e.change >= 0 ? 'text-green-400' : 'text-red-400'} font-bold">${e.change.toFixed(2)}%</p>
                    <p class="text-[10px] font-black italic">€ ${(e.owned * e.price).toLocaleString('it-IT', {minimumFractionDigits: 2})}</p>
                </div>
            </div>
        </div>`).join('');
}

function renderHistory() {
    const list = document.getElementById('history-page-list'); if (!list) return;
    list.innerHTML = [...portfolio.transactions].reverse().map((tx, i) => {
        const originalIdx = portfolio.transactions.length - 1 - i;
        return `
        <div class="glass-card p-4 flex justify-between items-center">
            <div>
                <p class="text-[10px] text-gray-500 font-bold uppercase">${tx.date}</p>
                <p class="text-lg font-black italic">€ ${tx.amount.toLocaleString('it-IT')}</p>
            </div>
            <div class="flex items-center gap-2">
                <div class="text-[8px] text-gray-400 text-right italic mr-2">
                    ETF: €${tx.etfPart.toFixed(0)}<br>CASH: €${tx.cashPart.toFixed(0)}
                </div>
                <button onclick="editTransaction(${originalIdx})" class="p-2 bg-blue-500/10 rounded-lg text-xs">✏️</button>
                <button onclick="deleteTransaction(${originalIdx})" class="p-2 bg-red-500/10 rounded-lg text-xs">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// --- UTILS & CHARTS ---
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(x => x.classList.remove('nav-active'));
    
    const targetTab = document.getElementById(`tab-${t}`);
    const targetBtn = document.getElementById(`btn-${t}`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetBtn) targetBtn.classList.add('nav-active');

    // Se entriamo nel tab forecast, avviamo il calcolo
    if (t === 'forecast') {
        // Un piccolo delay assicura che il DOM sia visibile prima di disegnare
        setTimeout(() => {
            updateForecast();
        }, 50);
    }
    
    if (t === 'main') initPerformanceChart();
    if (t === 'etf') initAssetDoughnut();
}

function initPerformanceChart() {
    const ctx = document.getElementById('performanceChart'); if (!ctx) return;
    if (charts.performance) charts.performance.destroy();
    let curr = 0; const data = [0]; const labels = ['Inizio'];
    portfolio.transactions.forEach(tx => { curr += tx.amount; labels.push(tx.date); data.push(curr); });
    charts.performance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59,130,246,0.05)', pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { display: false }, x: { display: false } } }
    });
}

function initAssetDoughnut() {
    const ctx = document.getElementById('assetDoughnut'); if (!ctx) return;
    if (charts.doughnut) charts.doughnut.destroy();
    const vals = [...portfolio.etfs.map(e => e.owned * e.price), portfolio.cashBalance];
    charts.doughnut = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: [...portfolio.etfs.map(e => e.name), 'Cash'], datasets: [{ data: vals, backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#64748b'], borderWidth: 0 }] },
        options: { cutout: '80%', plugins: { legend: { display: false } } }
    });
}

function safeSet(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; }
function saveData() { localStorage.setItem('tr_pro_ultra_v3', JSON.stringify(portfolio)); }
function showNotification(msg, icon) {
    const toast = document.getElementById('notification-toast');
    safeSet('notif-msg', msg); safeSet('notif-icon', icon);
    toast?.classList.remove('-translate-y-32');
    setTimeout(() => toast?.classList.add('-translate-y-32'), 3000);
}
function resetAllData() { if (confirm("RESET TOTALE?")) { localStorage.clear(); location.reload(); } }

function updateForecast() {
    // 1. Recupero valori dagli slider (Assicurati che gli ID esistano nell'HTML)
    const monthlyInput = document.getElementById('range-monthly');
    const yearsInput = document.getElementById('range-years');
    const roiInput = document.getElementById('range-roi');

    if (!monthlyInput || !yearsInput || !roiInput) return;

    const monthly = parseFloat(monthlyInput.value) || 0;
    const years = parseInt(yearsInput.value) || 1;
    const roi = (parseFloat(roiInput.value) || 0) / 100;

    // 2. Aggiornamento etichette numeriche (i piccoli testi sopra gli slider)
    safeSet('val-range-monthly', monthly.toLocaleString('it-IT'));
    safeSet('val-range-years', years);
    safeSet('val-range-roi', (roi * 100).toFixed(1));

    // 3. Calcolo proiezione (Interesse Composto)
    const currentAssets = portfolio.etfs.reduce((s, e) => s + (e.owned * e.price), 0) + portfolio.cashBalance;
    
    let balance = currentAssets;
    let totalInvested = portfolio.investedTotal; // Partiamo da quanto hai già versato realmente
    
    const labels = []; 
    const dataPoints = [];

    // Punto zero: Situazione attuale
    labels.push(`Oggi`);
    dataPoints.push(balance);

    for (let i = 1; i <= years; i++) {
        // Formula: (Capitale precedente + Versamenti annuali) * Rendimento
        balance = (balance + (monthly * 12)) * (1 + roi);
        totalInvested += (monthly * 12);
        
        labels.push(`Anno ${i}`); 
        dataPoints.push(balance);
    }

    // 4. Aggiornamento Statistiche Finali
    safeSet('future-invested', `€ ${totalInvested.toLocaleString('it-IT', {maximumFractionDigits:0})}`);
    safeSet('future-balance', `€ ${balance.toLocaleString('it-IT', {maximumFractionDigits:0})}`);
    
    const interests = balance - totalInvested;
    safeSet('future-interests', `€ ${interests.toLocaleString('it-IT', {maximumFractionDigits:0})}`);

    // 5. Render del grafico
    renderForecastChart(labels, dataPoints);
}