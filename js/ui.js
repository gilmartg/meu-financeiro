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

export function abrirModal(id) { document.getElementById(id).classList.add('open'); }
export function fecharModal(id) { document.getElementById(id).classList.remove('open'); }

export function preencherSelects(estado, tipoAtual) {
  const opts = Object.entries(estado.contas)
    .map(([id, c]) => `<option value="${esc(id)}">${esc(c.nome)}</option>`)
    .join('');
  document.getElementById('novaConta').innerHTML = opts || '<option value="">Nenhuma conta</option>';
  document.getElementById('novaContaDestino').innerHTML = opts || '<option value="">Nenhuma conta</option>';
  document.getElementById('pagConta').innerHTML = '<option value="">-- Nenhuma --</option>' + opts;
  preencherCategorias(tipoAtual);
}

export function preencherCategorias(tipoAtual) {
  const cats = tipoAtual === 'transferencia' ? ['Transferência'] : CATEGORIAS[tipoAtual];
  document.getElementById('novaCategoria').innerHTML = cats
    .map(c => `<option value="${esc(c)}">${esc(c)}</option>`)
    .join('');
}

// Cada transferência remove o valor da conta de origem e o adiciona à conta de destino.
function calcularSaldoConta(estado, contaId) {
  const conta = estado.contas?.[contaId];
  let saldo = Number(conta?.saldoInicial) || 0;

  Object.values(estado.transacoes || {}).forEach(transacao => {
    const valor = Number(transacao.valor) || 0;

    if (transacao.tipo === 'entrada' && transacao.conta === contaId) saldo += valor;
    if (transacao.tipo === 'saida' && transacao.conta === contaId) saldo -= valor;

    if (transacao.tipo === 'transferencia') {
      if (transacao.conta === contaId) saldo -= valor;
      if (transacao.contaDestino === contaId) saldo += valor;
    }
  });

  return saldo;
}

export function renderizar(estado) {
  const contasIds = Object.keys(estado.contas || {});
  const saldoTotal = contasIds.reduce((total, contaId) => {
    return total + calcularSaldoConta(estado, contaId);
  }, 0);

  document.getElementById('saldoTotalValor').textContent = brl(saldoTotal);

  const contasHtml = Object.entries(estado.contas || {})
    .map(([id, conta]) => `
      <div class="conta-card">
        <div class="info">
          <div class="nome">${esc(conta.nome)}</div>
          <div class="saldo">${brl(calcularSaldoConta(estado, id))}</div>
        </div>
      </div>
    `)
    .join('');

  document.getElementById('contasResumo').innerHTML = contasHtml;
  document.getElementById('listaContas').innerHTML = contasHtml;

  const atalhos = Object.entries(estado.atalhos || {});
  const grid = document.getElementById('quickGrid');
  const vazio = document.getElementById('semAtalhos');
  if (atalhos.length === 0) {
    grid.innerHTML = '';
    vazio.style.display = 'block';
  } else {
    vazio.style.display = 'none';
    grid.innerHTML = atalhos
      .map(([id, atalho]) => `<button class="quick-btn" onclick="APP.abrirQuick('${esc(id)}')">${esc(atalho.emoji)}<br>${esc(atalho.nome)}</button>`)
      .join('');
  }

  const transacoes = Object.entries(estado.transacoes || {})
    .sort((a, b) => new Date(b[1].data) - new Date(a[1].data))
    .slice(0, 20);

  document.getElementById('todasTransacoes').innerHTML = transacoes.length
    ? transacoes.map(([, transacao]) => {
        const contas = estado.contas;
        const tipoClasse = transacao.tipo === 'entrada' ? 'entrada' : transacao.tipo === 'saida' ? 'saida' : 'transf';
        const sinal = transacao.tipo === 'entrada' ? '+' : transacao.tipo === 'saida' ? '-' : '↔';
        const dt = new Date(`${transacao.data}T12:00:00`).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });

        const contaOrigem = contas[transacao.conta]?.nome || '?';
        const contaDestino = transacao.tipo === 'transferencia' && transacao.contaDestino
          ? ` → ${esc(contas[transacao.contaDestino]?.nome || '?')}`
          : '';

        return `<div class="transacao">
          <div class="info">
            <div class="desc">${esc(transacao.desc)}</div>
            <div class="meta">${dt} • ${esc(contaOrigem)}${contaDestino} • ${esc(transacao.categoria || '')}</div>
          </div>
          <div class="valor ${tipoClasse}">${sinal} ${brl(transacao.valor)}</div>
        </div>`;
      }).join('')
    : '<div class="empty">Sem transações recentes.</div>';

  emprestimosApp.renderizar(estado);
}

export function atualizarMes() {
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('mesAtual').textContent = meses[new Date().getMonth()] + ' de ' + new Date().getFullYear();
}

export function setDataHoje() {
  document.getElementById('novaData').value = new Date().toISOString().split('T')[0];
}
