// Lançamentos: nova transação, listas e exclusão.
import { getEstado, gravar } from '../core/store.js';
import { registrarAcoes } from '../core/acoes.js';
import { esc, brl, parseMoeda, novoId, hojeISO, formatarData } from '../core/utils.js';
import { CATEGORIAS } from '../core/config.js';

const $ = (id) => document.getElementById(id);
const POR_PAGINA = 50;

let tipoAtual = 'entrada';
let limite = POR_PAGINA;

export function definirDataHoje() { $('novaData').value = hojeISO(); }

function preencherCategorias() {
  const cats = tipoAtual === 'transferencia' ? ['Transferência'] : CATEGORIAS[tipoAtual];
  const atual = $('novaCategoria').value;
  $('novaCategoria').innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if (cats.includes(atual)) $('novaCategoria').value = atual;
}

function setTipo(tipo) {
  tipoAtual = tipo;
  document.querySelectorAll('#tipoGroup button').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipo));
  $('contaDestinoWrap').style.display = tipo === 'transferencia' ? 'block' : 'none';
  preencherCategorias();
}

function htmlTransacao(t, contas) {
  const classe = t.tipo === 'entrada' ? 'entrada' : t.tipo === 'saida' ? 'saida' : 'transf';
  const sinal = t.tipo === 'entrada' ? '+' : t.tipo === 'saida' ? '−' : '↔';
  const origem = contas[t.conta]?.nome || 'Conta removida';
  const destino = t.tipo === 'transferencia' && t.contaDestino
    ? ` → ${esc(contas[t.contaDestino]?.nome || 'Conta removida')}` : '';
  return `<div class="transacao">
    <div class="info">
      <div class="desc">${esc(t.desc)}</div>
      <div class="meta">${formatarData(t.data, { day: '2-digit', month: '2-digit' })} · ${esc(origem)}${destino} · ${esc(t.categoria || '')}</div>
    </div>
    <span class="valor ${classe}">${sinal} ${brl(t.valor)}</span>
    <button type="button" class="sm danger" aria-label="Excluir ${esc(t.desc)}" data-action="transacao-excluir" data-id="${esc(t.id)}">🗑️</button>
  </div>`;
}

export function renderizarTransacoes(estado) {
  const lista = Object.entries(estado.transacoes)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (b.criadoEm || 0) - (a.criadoEm || 0));
  const vazio = '<div class="empty">Nenhuma transação registrada.</div>';

  $('ultimasTransacoes').innerHTML = lista.slice(0, 5).map(t => htmlTransacao(t, estado.contas)).join('') || vazio;

  const visiveis = lista.slice(0, limite);
  $('todasTransacoes').innerHTML = (visiveis.map(t => htmlTransacao(t, estado.contas)).join('') || vazio)
    + (lista.length > limite
      ? `<button type="button" class="sec" data-action="transacoes-mais">Mostrar mais (${lista.length - limite} restantes)</button>` : '');
}

async function salvarTransacao() {
  const desc = $('novaDesc').value.trim();
  const valor = parseMoeda($('novaValor').value);
  const conta = $('novaConta').value;
  const contaDestino = $('novaContaDestino').value;
  const data = $('novaData').value;
  const transferencia = tipoAtual === 'transferencia';

  if (!desc || valor <= 0 || !conta || !data || (transferencia && !contaDestino)) {
    return alert('Preencha todos os campos com um valor maior que zero.');
  }
  if (transferencia && conta === contaDestino) {
    return alert('Escolha uma conta de destino diferente da conta de origem.');
  }

  // O saldo é calculado a partir das transações; não mexe em saldoInicial.
  await gravar({
    [`transacoes/${novoId('t')}`]: {
      tipo: tipoAtual, desc, valor, data, conta,
      categoria: $('novaCategoria').value,
      criadoEm: Date.now(),
      ...(transferencia ? { contaDestino } : {})
    }
  });
  $('novaDesc').value = '';
  $('novaValor').value = '';
  alert('✅ Salvo!');
}

/** Usado por atalhos e voz: grava uma saída simples na primeira conta. */
export async function lancarSaida({ desc, valor, categoria }) {
  const conta = Object.keys(getEstado().contas)[0];
  if (!conta) throw new Error('Crie uma conta primeiro.');
  await gravar({
    [`transacoes/${novoId('t')}`]: { tipo: 'saida', desc, valor, data: hojeISO(), conta, categoria, criadoEm: Date.now() }
  });
}

async function excluirTransacao({ id }) {
  if (!confirm('Excluir esta transação?')) return;
  await gravar({ [`transacoes/${id}`]: null });
}

export function iniciarTransacoes() {
  setTipo('entrada');
  definirDataHoje();
  registrarAcoes({
    'tipo-transacao': ({ tipo }) => setTipo(tipo),
    'transacao-salvar': salvarTransacao,
    'transacao-excluir': excluirTransacao,
    'transacoes-mais': () => { limite += POR_PAGINA; renderizarTransacoes(getEstado()); }
  });
}
