// Gráficos da aba Análises. O Chart.js só é baixado quando a aba é aberta,
// então uma falha no CDN não derruba o resto do app.
import { CHARTJS_URL } from '../core/config.js';
import { getEstado } from '../core/store.js';
import { dataLocal } from '../core/utils.js';

const $ = (id) => document.getElementById(id);
const CORES = ['#ef4444', '#f97316', '#fbbf24', '#10b981', '#38bdf8', '#8b5cf6', '#ec4899', '#64748b', '#94a3b8'];
const NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

let ChartLib = null;
let pizza = null;
let barras = null;

async function carregarChart() {
  if (!ChartLib) ChartLib = (await import(CHARTJS_URL)).default;
  return ChartLib;
}

function pontosDoMes(t, ano, mes) {
  const d = dataLocal(t.data);
  return d && d.getFullYear() === ano && d.getMonth() === mes;
}

export async function renderizarGraficos() {
  let Chart;
  try {
    Chart = await carregarChart();
  } catch (e) {
    console.error('Chart.js indisponível:', e);
    $('semDadosPizza').textContent = 'Não foi possível carregar os gráficos (sem internet?).';
    $('semDadosPizza').style.display = 'block';
    return;
  }
  const transacoes = Object.values(getEstado().transacoes);
  desenharPizza(Chart, transacoes);
  desenharBarras(Chart, transacoes);
}

function desenharPizza(Chart, transacoes) {
  const canvas = $('chartPizza');
  const vazio = $('semDadosPizza');
  const hoje = new Date();
  const saidas = transacoes.filter(t => t.tipo === 'saida' && pontosDoMes(t, hoje.getFullYear(), hoje.getMonth()));

  pizza?.destroy();
  pizza = null;
  vazio.textContent = 'Sem saídas neste mês.';
  if (!saidas.length) {
    canvas.style.display = 'none';
    vazio.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  vazio.style.display = 'none';

  const porCategoria = {};
  saidas.forEach(t => {
    const cat = t.categoria || 'Outros';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(t.valor || 0);
  });
  const labels = Object.keys(porCategoria);
  pizza = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: Object.values(porCategoria), backgroundColor: labels.map((_, i) => CORES[i % CORES.length]), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#e2e8f0', font: { size: 11 } } } } }
  });
}

function desenharBarras(Chart, transacoes) {
  const hoje = new Date();
  const meses = [];
  for (let i = 5; i >= 0; i--) {
    // dia 1 evita pular mês (ex.: 31/mar − 1 mês = "31/fev" = 3/mar)
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ ano: d.getFullYear(), mes: d.getMonth() });
  }
  const somar = (tipo) => meses.map(({ ano, mes }) =>
    transacoes.filter(t => t.tipo === tipo && pontosDoMes(t, ano, mes)).reduce((s, t) => s + Number(t.valor || 0), 0));

  barras?.destroy();
  barras = new Chart($('chartBarras'), {
    type: 'bar',
    data: {
      labels: meses.map(m => NOMES_MESES[m.mes]),
      datasets: [
        { label: 'Entradas', data: somar('entrada'), backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Saídas', data: somar('saida'), backgroundColor: '#ef4444', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', labels: { color: '#e2e8f0' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      }
    }
  });
}
