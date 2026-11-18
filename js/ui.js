import { esc, brl } from './utils.js';
import { CATEGORIAS } from './config.js';
import { renderGraficos } from './charts.js';
import { emprestimosApp } from './emprestimos.js';

export function mudarTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('tab-' + id);
  if (tab) tab.classList.add('active');
  const btn = document.querySelector(`.tabbar button[data-tab="${id}"]`);
  if (btn) btn.classList.add('active');
  if (id === 'analises') setTimeout(() => renderGraficos(window.APP.estado), 50);
}

export function abrirModal(id) {
  document.getElementById(id).classList.add('open');
}

export function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function preencherSelects(estado, tipoAtual) {
  const opts = Object.entries(estado.contas)
    .map(([id, c]) => `<option value="${id}">${esc(c.nome)}</option>`)
    .join('');
  document.getElementById('novaConta').innerHTML = opts || '<option value="">Nenhuma conta</option>';
  document.getElementById('novaContaDestino').innerHTML = opts || '<option value="">Nenhuma conta</option>';
  document.getElementById('pagConta').innerHTML = '<option value="">-- Nenhuma --</option>' + opts;
  preencherCategorias(tipoAtual);
}

export function preencherCategorias(tipoAtual) {
  const cats = tipoAtual === 'transferencia' ? ['Transferência'] : CATEGORIAS[tipoAtual];
  document.getElementById('novaCategoria').innerHTML = cats
    .map(c => `<option value="${c}">${c}</option>`)
    .join('');
}

export function renderizar(estado) {
  // Calculate total saldo considering transfers
  const saldo = Object.keys(estado.contas).reduce((s, id) => {
    const c = estado.contas[id];
    let val = Number(c.saldoInicial) || 0;

    Object.values(estado.transacoes).forEach(t => {
      if (t.tipo === 'entrada' && t.conta === id) val += Number(t.valor);
      if (t.tipo === 'saida' && t.conta === id) val -= Number(t.valor);
      if (t.tipo === 'transferencia') {
        if (t.conta === id) val -= Number(t.valor); // Debit from origin account
        if (t.contaDestino === id) val += Number(t.valor); // Credit to destination account
      }
    });

    return s + val;
  }, 0);

  document.getElementById('saldoTotalValor').textContent = brl(saldo);

  // Render account summaries
  const contasHtml = Object.entries(estado.contas)
    .map(([id, c]) => {
      let val = Number(c.saldoInicial) || 0;
      Object.values(estado.transacoes).forEach(t => {
        if (t.tipo === 'entrada' && t.conta === id) val += Number(t.valor);
        if (t.tipo === 'saida' && t.conta === id) val -= Number(t.valor);
      });
      return `<div class="conta-card"><div class="info"><div class="nome">${esc(c.nome)}</div><div class="saldo">${brl(val)}</div></div></div>`;
    })
    .join('');

  document.getElementById('contasResumo').innerHTML = contasHtml;
  document.getElementById('listaContas').innerHTML = contasHtml;

  // Render shortcuts
  const atalhos = Object.entries(estado.atalhos || {});
  const grid = document.getElementById('quickGrid');
  const vazio = document.getElementById('semAtalhos');
  if (atalhos.length === 0) {
    grid.innerHTML = '';
    vazio.style.display = 'block';
  } else {
    vazio.style.display = 'none';
    grid.innerHTML = atalhos
      .map(([id, a]) => `<button class="quick-btn" onclick="APP.abrirQuick('${id}')">${a.emoji}<br>${a.nome}</button>`)
      .join('');
  }

  // Render recent transactions
  const transacoes = Object.entries(estado.transacoes || {})
    .sort((a, b) => new Date(b[1].data) - new Date(a[1].data))
    .slice(0, 20);
  document.getElementById('todasTransacoes').innerHTML = transacoes.length
    ? transacoes
        .map(([id, t]) => {
          const contas = estado.contas;
          const vc = t.tipo === 'entrada' ? 'entrada' : t.tipo === 'saida' ? 'saida' : 'transf';
          const sinal = t.tipo === 'entrada' ? '+' : t.tipo === 'saida' ? '-' : '↔';
          const dt = new Date(t.data + 'T12:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          });
          let ct = contas[t.conta]?.nome || '?';
          return `<div class="transacao"><div class="info"><div class="desc">${esc(t.desc)}</div><div class="meta">${dt} • ${esc(ct)} • ${esc(t.categoria || '')}</div></div><div class="valor ${vc}">${sinal} ${brl(t.valor)}</div></div>`;
        })
        .join('')
    : '<div class="empty">Sem transações recentes.</div>';

  // Render loan module
  emprestimosApp.renderizar(estado);
}

export function atualizarMes() {
  const m = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  document.getElementById('mesAtual').textContent =
    m[new Date().getMonth()] + ' de ' + new Date().getFullYear();
}

export function setDataHoje() {
  document.getElementById('novaData').value = new Date().toISOString().split('T')[0];
}