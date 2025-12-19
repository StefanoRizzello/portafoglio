// Stato dell'applicazione
let portfolio = {
    cash: 0,
    etfs: [
        { isin: 'IE00B4L5Y983', name: 'MSCI World', share: 0.6, price: 92.45, owned: 0 },
        { isin: 'IE00BKM4GZ66', name: 'MSCI EM IMI', share: 0.2, price: 31.12, owned: 0 },
        { isin: 'IE00B579F325', name: 'Global Agg Bond', share: 0.2, price: 4.85, owned: 0 }
    ],
    history: []
};

// Caricamento dati iniziali
window.onload = () => {
    const saved = localStorage.getItem('tr_portfolio');
    if (saved) portfolio = JSON.parse(saved);
    updateUI();
    initCharts();
};

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`btn-${tabName}`).classList.add('nav-active');
}

function distributeBudget() {
    const budget = parseFloat(document.getElementById('budget-input').value);
    const allocationDiv = document.getElementById('allocation-result');
    allocationDiv.innerHTML = '';

    let etfBudget = budget > 350 ? 350 : budget;
    let surplus = budget > 350 ? budget - 350 : 0;

    // Se c'è surplus, il 50% va negli ETF e il 50% nel Cash (proposta)
    let extraToEtf = surplus * 0.5;
    let extraToCash = surplus * 0.5;

    portfolio.cash += extraToCash;
    let totalEtfInvestedThisMonth = etfBudget + extraToEtf;

    portfolio.etfs.forEach(etf => {
        let amount = totalEtfInvestedThisMonth * etf.share;
        etf.owned += amount / etf.price;
        
        allocationDiv.innerHTML += `
            <div class="flex justify-between bg-gray-900 p-3 rounded-xl">
                <span>${etf.name}</span>
                <span class="font-bold text-blue-400">€ ${amount.toFixed(2)}</span>
            </div>
        `;
    });

    saveAndRefresh();
}

function setInitialCash() {
    const val = parseFloat(document.getElementById('initial-cash').value);
    if (!isNaN(val)) {
        portfolio.cash = val;
        saveAndRefresh();
    }
}

function saveAndRefresh() {
    localStorage.setItem('tr_portfolio', JSON.stringify(portfolio));
    updateUI();
}

function updateUI() {
    let etfValue = portfolio.etfs.reduce((sum, etf) => sum + (etf.owned * etf.price), 0);
    let total = etfValue + portfolio.cash;

    document.getElementById('total-balance').innerText = `€ ${total.toLocaleString('it-IT', {minimumFractionDigits: 2})}`;
    document.getElementById('cash-balance').innerText = `€ ${portfolio.cash.toFixed(2)}`;
    document.getElementById('annual-interest').innerText = `€ ${(portfolio.cash * 0.02).toFixed(2)}`;
    
    renderEtfList();
}

function renderEtfList() {
    const list = document.getElementById('etf-list');
    list.innerHTML = '';
    portfolio.etfs.forEach(etf => {
        let val = etf.owned * etf.price;
        list.innerHTML += `
            <div class="bg-gray-900 p-4 rounded-xl border-l-4 border-blue-500">
                <div class="flex justify-between">
                    <span class="text-xs text-gray-500">${etf.isin}</span>
                    <span class="text-green-400 font-bold">€ ${etf.price}</span>
                </div>
                <div class="flex justify-between items-end mt-2">
                    <span class="text-lg font-bold">${etf.name}</span>
                    <span class="text-sm">Posseduti: ${etf.owned.toFixed(2)} (Val: € ${val.toFixed(2)})</span>
                </div>
            </div>
        `;
    });
}

function initCharts() {
    // Inizializza Chart.js qui (Placeholder per brevità)
    const ctx = document.getElementById('mainChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['ETF MSCI World', 'EM IMI', 'Bonds', 'Cash'],
            datasets: [{
                data: [60, 20, 15, 5],
                backgroundColor: ['#3b82f6', '#1e40af', '#60a5fa', '#ffffff'],
                borderWidth: 0
            }]
        },
        options: { plugins: { legend: { display: false } } }
    });
}

function updateForecast() {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const anni = 10;
    const labels = [];
    const dataPunti = [];
    
    // Parametri di calcolo
    let budgetMensile = parseFloat(document.getElementById('budget-input').value) || 350;
    let capitaleAttuale = portfolio.cash + portfolio.etfs.reduce((sum, etf) => sum + (etf.owned * etf.price), 0);
    
    // Assunzioni: Rendimento medio ETF 7%, Cash 2% (media pesata stimata 6% annuo)
    const rendimentoAnnuo = 0.06; 
    const tassoMensile = rendimentoAnnuo / 12;

    let proiezione = capitaleAttuale;

    for (let i = 0; i <= anni; i++) {
        labels.push("Anno " + i);
        dataPunti.push(proiezione.toFixed(2));
        
        // Calcolo interesse composto mensile per l'anno successivo
        for (let m = 0; m < 12; m++) {
            proiezione = (proiezione + budgetMensile) * (1 + tassoMensile);
        }
    }

    // Distruggi il grafico precedente se esiste per evitare sovrapposizioni
    if (window.myForecastChart) window.myForecastChart.destroy();

    window.myForecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Crescita Stimata Portafoglio',
                data: dataPunti,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: '#222' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
            }
        }
    });
}

// Modifica la funzione showTab per aggiornare i grafici quando entri nei tab
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`btn-${tabName}`).classList.add('nav-active');

    if (tabName === 'forecast') updateForecast();
    if (tabName === 'main') initCharts(); // Ricarica il grafico a torta
}