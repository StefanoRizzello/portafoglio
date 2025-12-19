let portfolio = {
    cash: 0,
    investedTotal: 0,
    etfs: [
        { isin: 'IE00B4L5Y983', name: 'iShares Core MSCI World', share: 0.60, price: 92.45, owned: 0 },
        { isin: 'IE00BKM4GZ66', name: 'iShares Core MSCI EM IMI', share: 0.20, price: 31.12, owned: 0 },
        { isin: 'IE00B579F325', name: 'iShares Global Agg Bond', share: 0.20, price: 4.85, owned: 0 }
    ]
};

window.onload = () => {
    const saved = localStorage.getItem('tr_pro_data');
    if (saved) portfolio = JSON.parse(saved);
    updateUI();
};

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`btn-${tabName}`).classList.add('nav-active');
    if (tabName === 'forecast') updateForecast();
}

function distributeBudget() {
    const budget = parseFloat(document.getElementById('budget-input').value);
    if (isNaN(budget) || budget <= 0) return;

    let etfAmount = budget > 350 ? 350 + (budget - 350) * 0.7 : budget;
    let cashAmount = budget > 350 ? (budget - 350) * 0.3 : 0;

    portfolio.cash += cashAmount;
    portfolio.investedTotal += budget;

    portfolio.etfs.forEach(etf => {
        let quota = etfAmount * etf.share;
        etf.owned += quota / etf.price;
    });

    saveData();
    alert("Budget distribuito correttamente!");
}

function setInitialCash() {
    const val = parseFloat(document.getElementById('initial-cash').value);
    if (!isNaN(val)) {
        portfolio.cash = val;
        saveData();
    }
}

function updateUI() {
    let etfVal = portfolio.etfs.reduce((s, e) => s + (e.owned * e.price), 0);
    let total = etfVal + portfolio.cash;

    document.getElementById('total-balance').innerText = `€ ${total.toLocaleString('it-IT', {minimumFractionDigits: 2})}`;
    document.getElementById('total-invested').innerText = `€ ${portfolio.investedTotal.toFixed(2)}`;
    document.getElementById('cash-mini').innerText = `€ ${portfolio.cash.toFixed(2)}`;
    document.getElementById('annual-interest').innerText = `€ ${(portfolio.cash * 0.02).toFixed(2)}`;

    renderEtfList();
    renderAlerts(etfVal);
    updateTargetProgress(total);
    initMainChart();
}

function renderEtfList() {
    const list = document.getElementById('etf-list');
    list.innerHTML = portfolio.etfs.map(e => `
        <div class="glass-card p-4">
            <div class="flex justify-between text-[10px] text-gray-500 mb-1"><span>${e.isin}</span><span>Target: ${e.share*100}%</span></div>
            <div class="flex justify-between items-center">
                <span class="font-bold">${e.name}</span>
                <span class="text-blue-400 font-bold">€ ${(e.owned * e.price).toFixed(2)}</span>
            </div>
        </div>
    `).join('');
}

function renderAlerts(etfTotal) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    portfolio.etfs.forEach(e => {
        let currentShare = (e.owned * e.price) / etfTotal;
        if (etfTotal > 0 && Math.abs(currentShare - e.share) > 0.05) {
            container.innerHTML += `<div class="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px]">
                ⚠️ <b>Ribilanciamento:</b> ${e.name} fuori target.</div>`;
        }
    });
}

function updateTargetProgress(total) {
    let perc = Math.min((total / 10000) * 100, 100);
    document.getElementById('target-percentage').innerText = Math.round(perc) + '%';
    document.getElementById('target-bar').style.width = perc + '%';
}

function initMainChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (window.mChart) window.mChart.destroy();
    window.mChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['World', 'EM', 'Bonds', 'Cash'],
            datasets: [{
                data: [...portfolio.etfs.map(e => e.owned * e.price), portfolio.cash],
                backgroundColor: ['#3b82f6', '#1d4ed8', '#60a5fa', '#ffffff'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { display: false } }, cutout: '80%' }
    });
}

function updateForecast() {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    let current = portfolio.cash + portfolio.etfs.reduce((s, e) => s + (e.owned * e.price), 0);
    let budget = parseFloat(document.getElementById('budget-input').value) || 350;
    let data = [];
    for(let i=0; i<=10; i++) {
        data.push(current.toFixed(0));
        current = (current + (budget * 12)) * 1.06;
    }
    if (window.fChart) window.fChart.destroy();
    window.fChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({length: 11}, (_, i) => "Anno " + i),
            datasets: [{ label: 'Stima', data: data, borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)' }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

function saveData() { localStorage.setItem('tr_pro_data', JSON.stringify(portfolio)); updateUI(); }

function resetAllData() {
    if(confirm("Cancellare tutto?")) { localStorage.removeItem('tr_pro_data'); location.reload(); }
}