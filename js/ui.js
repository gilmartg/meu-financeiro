import { esc, brl, hojeISO, formatarDataBR } from './utils.js';
import { CATEGORIAS } from './config.js';
import { store } from './state.js';
import { renderGraficos } from './charts.js';
import { emprestimosApp } from './emprestimos.js';

export function mudarTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tabbar button').forEach(b => {
    const ativa = b.dataset.tab === id;
    b.classList.toggle('active', ativa);
    if (ativa) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  const tab = document.getElementById('tab-' + id);
  if (tab) tab.classList.add('active');
  if (id === 'analises') setTimeout(() => renderGraficos(store.dados), 50);
}

export function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

export function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

export function preencherCategorias(tipoAtual) {
  const cats = tipoAtual === 'transferencia' ? ['Transferência'] : (CATEGORIAS[tipoAtual] || CATEGORIAS.saida);
  const select = document.getElementById('novaCategoria');
  if (select) {
    select.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  }
}

export function preencherSelects(estado, tipoAtual) {
  const opts = Object.entries(estado.contas || {})
    .map(([id, c]) => `<option value="${esc(id)}">${esc(c.nome)}</option>`)
    .join('');

  const vazio = '<option value="">Nenhuma conta</option>';
  if (document.getElementById('novaConta')) document.getElementById('novaConta').innerHTML = opts || vazio;
  if (document.getElementById('novaContaDestino')) document.getElementById('novaContaDestino').innerHTML = opts || vazio;
  if (document.getElementById('pagConta')) {
    document.getElementById('pagConta').innerHTML = '<option value="">— Não registrar em conta —</option>' + opts;
  }
  preencherCategorias(tipoAtual);
}

function calcularSaldoConta(estado, contaId) {
  const conta = estado.contas?.[contaId];
  let saldo = Number(conta?.saldoInicial) || 0;

  Object.values(estado.transacoes || {}).forEach(t => {
    const valor = Number(t.valor) || 0;
    if (t.tipo === 'entrada' && t.conta === contaId) saldo += valor;
    if (t.tipo === 'saida' && t.conta === contaId) saldo -= valor;
    if (t.tipo === 'transferencia') {
      if (t.conta === contaId) saldo -= valor;
      if (t.contaDestino === contaId) saldo += valor;
    }
  });

  return saldo;
}

function renderKPIsMes(estado) {
  const hoje = new Date();
  let entradas = 0;
  let saidas = 0;

  Object.values(estado.transacoes || {}).forEach(t => {
    if (!t.data) return;
    const d = new Date(`${t.data}T12:00:00`);
    if (d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()) {
      const val = Number(t.valor) || 0;
      if (t.tipo === 'entrada') entradas += val;
      if (t.tipo === 'saida') saidas += val;
    }
  });

  const elEnt = document.getElementById('kpiEntradas');
  const elSai = document.getElementById('kpiSaidas');
  if (elEnt) elEnt.textContent = brl(entradas);
  if (elSai) elSai.textContent = brl(saidas);
}

function templateTransacao(id, t, contas, mostrarExcluir = false) {
  const tipoClasse = t.tipo === 'entrada' ? 'entrada' : t.tipo === 'saida' ? 'saida' : 'transf';
  const sinal = t.tipo === 'entrada' ? '+' : t.tipo === 'saida' ? '−' : '↔';
  const dt = formatarDataBR(t.data, { day: '2-digit', month: '2-digit' });
  const contaOrigem = contas[t.conta]?.nome || 'Conta removida';
  const contaDestino = t.tipo === 'transferencia' && t.contaDestino
    ? ` → ${esc(contas[t.contaDestino]?.nome || 'Conta removida')}`
    : '';

  const btnExcluir = mostrarExcluir
    ? `<button type="button" class="sm danger" aria-label="Excluir ${esc(t.desc)}" onclick="APP.excluirTransacao('${esc(id)}')">🗑️</button>`
    : '';

  return `
    <div class="transacao">
      <div class="info">
        <div class="desc">${esc(t.desc)}</div>
        <div class="meta">${dt} • ${esc(contaOrigem)}${contaDestino} • ${esc(t.categoria || '')}</div>
      </div>
      <div class="valor ${tipoClasse}">${sinal} ${brl(t.valor)}</div>
      ${btnExcluir}
    </div>
  `;
}

export function renderizar(estado) {
  const contas = estado.contas || {};
  const contasIds = Object.keys(contas);

  const saldoTotal = contasIds.reduce((acc, cid) => acc + calcularSaldoConta(estado, cid), 0);
  const saldoBox = document.getElementById('saldoTotalBox');
  const saldoValorEl = document.getElementById('saldoTotalValor');
  if (saldoValorEl) saldoValorEl.textContent = brl(saldoTotal);
  if (saldoBox) saldoBox.classList.toggle('negativo', saldoTotal < 0);

  renderKPIsMes(estado);

  const contasHtml = contasIds.length
    ? contasIds.map(id => {
        const conta = contas[id];
        const saldo = calcularSaldoConta(estado, id);
        return `
          <div class="conta-card">
            <div class="info">
              <div class="nome">${esc(conta.nome)}</div>
              <div class="saldo">${brl(saldo)}</div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty">Nenhuma conta cadastrada.</div>';

  if (document.getElementById('contasResumo')) document.getElementById('contasResumo').innerHTML = contasHtml;
  if (document.getElementById('listaContas')) document.getElementById('listaContas').innerHTML = contasHtml;

  const atalhos = Object.entries(estado.atalhos || {});
  const grid = document.getElementById('quickGrid');
  const vazio = document.getElementById('semAtalhos');
  if (grid && vazio) {
    if (!atalhos.length) {
      grid.innerHTML = '';
      vazio.style.display = 'block';
    } else {
      vazio.style.display = 'none';
      grid.innerHTML = atalhos
        .map(([id, atalho]) => `<button type="button" class="quick-btn" onclick="APP.abrirQuick('${esc(id)}')">${esc(atalho.emoji)}<br>${esc(atalho.nome)}</button>`)
        .join('');
    }
  }

  const ordenadas = Object.entries(estado.transacoes || {})
    .sort((a, b) => String(b[1].data || '').localeCompare(String(a[1].data || '')) || (b[1].criadoEm || 0) - (a[1].criadoEm || 0));

  const ultimasEl = document.getElementById('ultimasTransacoes');
  if (ultimasEl) {
    ultimasEl.innerHTML = ordenadas.length
      ? ordenadas.slice(0, 5).map(([id, t]) => templateTransacao(id, t, contas, false)).join('')
      : '<div class="empty">Nenhuma transação registrada.</div>';
  }

  const todasEl = document.getElementById('todasTransacoes');
  if (todasEl) {
    todasEl.innerHTML = ordenadas.length
      ? ordenadas.map(([id, t]) => templateTransacao(id, t, contas, true)).join('')
      : '<div class="empty">Nenhuma transação registrada.</div>';
  }

  emprestimosApp.renderizar(estado);
}

export function atualizarMes() {
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const el = document.getElementById('mesAtual');
  if (el) {
    const agora = new Date();
    el.textContent = `${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
  }
}

export function setDataHoje() {
  const el = document.getElementById('novaData');
  if (el) el.value = hojeISO();
}