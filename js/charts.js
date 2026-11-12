import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm';

let chartPizzaInstance = null;
let chartBarrasInstance = null;

export function renderGraficos(estado) {
  renderPizza(estado);
  renderBarras(estado);
}

function renderPizza(estado) {
  const ctx = document.getElementById('chartPizza');
  const emptyMsg = document.getElementById('semDadosPizza');
  
  // Filtra saídas do mês atual
  const hoje = new Date();
  const saidasMes = Object.values(estado.transacoes).filter(t => {
    if (t.tipo !== 'saida') return false;
    const d = new Date(t.data + 'T12:00:00');
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  });

  if (saidasMes.length === 0) {
    ctx.style.display = 'none';
    emptyMsg.style.display = 'block';
    if (chartPizzaInstance) chartPizzaInstance.destroy();
    return;
  }

  ctx.style.display = 'block';
  emptyMsg.style.display = 'none';

  // Agrupa por categoria
  const porCategoria = {};
  saidasMes.forEach(t => {
    const cat = t.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(t.valor);
  });

  const labels = Object.keys(porCategoria);
  const data = Object.values(porCategoria);
  const cores = ['#ef4444', '#f97316', '#fbbf24', '#10b981', '#38bdf8', '#8b5cf6', '#ec4899', '#64748b', '#94a3b8'];

  if (chartPizzaInstance) chartPizzaInstance.destroy();

  chartPizzaInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: cores.slice(0, labels.length), borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 11 } } }
      }
    }
  });
}

function renderBarras(estado) {
  const ctx = document.getElementById('chartBarras');
  
  // Pega os últimos 6 meses
  const meses = [];
  const labels = [];
  const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    meses.push({ mes: d.getMonth(), ano: d.getFullYear() });
    labels.push(nomesMeses[d.getMonth()]);
  }

  const entradas = [];
  const saidas = [];

  meses.forEach(m => {
    let e = 0, s = 0;
    Object.values(estado.transacoes).forEach(t => {
      const d = new Date(t.data + 'T12:00:00');
      if (d.getMonth() === m.mes && d.getFullYear() === m.ano) {
        if (t.tipo === 'entrada') e += Number(t.valor);
        if (t.tipo === 'saida') s += Number(t.valor);
      }
    });
    entradas.push(e);
    saidas.push(s);
  });

  if (chartBarrasInstance) chartBarrasInstance.destroy();

  chartBarrasInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Entradas', data: entradas, backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Saídas', data: saidas, backgroundColor: '#ef4444', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#e2e8f0' } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}
