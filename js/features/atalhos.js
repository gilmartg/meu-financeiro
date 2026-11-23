// Lançamento rápido: atalhos personalizáveis (ex.: "Padaria") + modal de valor.
import { getEstado, gravar } from '../core/store.js';
import { registrarAcoes } from '../core/acoes.js';
import { esc, parseMoeda, novoId } from '../core/utils.js';
import { CATEGORIAS_RAPIDAS } from '../core/config.js';
import { abrirModal, fecharModal } from '../ui/modal.js';
import { lancarSaida } from './transacoes.js';

const $ = (id) => document.getElementById(id);

let atalhoAtual = null;

export function renderizarAtalhos(estado) {
  const atalhos = Object.entries(estado.atalhos);
  $('semAtalhos').style.display = atalhos.length ? 'none' : 'block';
  $('quickGrid').innerHTML = atalhos.map(([id, a]) =>
    `<button type="button" class="quick-btn" data-action="atalho-abrir" data-id="${esc(id)}">${esc(a.emoji)}<br>${esc(a.nome)}</button>`
  ).join('');
  // Se o modal de gerenciar estiver aberto, mantém a lista atualizada.
  if ($('modalGerenciarAtalhos').classList.contains('open')) renderizarListaConfig();
}

function renderizarListaConfig() {
  const atalhos = Object.entries(getEstado().atalhos);
  $('listaAtalhosConfig').innerHTML = atalhos.map(([id, a]) => `
    <div class="atalho-item">
      <span>${esc(a.emoji)} ${esc(a.nome)} <small style="color:var(--muted)">(${esc(a.categoria)})</small></span>
      <button type="button" class="sm danger" aria-label="Excluir atalho ${esc(a.nome)}" data-action="atalho-excluir" data-id="${esc(id)}">✕</button>
    </div>`).join('') || '<div class="empty">Nenhum atalho.</div>';
}

function abrirQuick({ id }) {
  const atalho = getEstado().atalhos[id];
  if (!atalho) return;
  atalhoAtual = atalho;
  $('quickTitle').textContent = `${atalho.emoji || ''} ${atalho.nome}`;
  $('quickValor').value = '';
  abrirModal('modalQuickAdd');
  setTimeout(() => $('quickValor').focus(), 100);
}

async function salvarQuick() {
  const valor = parseMoeda($('quickValor').value);
  if (valor <= 0) return alert('Digite um valor válido.');
  if (!atalhoAtual) return;
  await lancarSaida({ desc: atalhoAtual.nome, valor, categoria: atalhoAtual.categoria });
  fecharModal('modalQuickAdd');
  alert('✅ Gasto lançado!');
}

function abrirGerenciar() {
  $('atalhoCategoria').innerHTML = CATEGORIAS_RAPIDAS.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
  renderizarListaConfig();
  abrirModal('modalGerenciarAtalhos');
}

async function salvarAtalho() {
  const emoji = $('atalhoEmoji').value.trim() || '📌';
  const nome = $('atalhoNome').value.trim();
  if (!nome) return alert('Digite o nome do atalho.');
  await gravar({ [`atalhos/${novoId('a')}`]: { emoji, nome, categoria: $('atalhoCategoria').value } });
  $('atalhoEmoji').value = '';
  $('atalhoNome').value = '';
}

async function excluirAtalho({ id }) {
  if (!confirm('Excluir atalho?')) return;
  await gravar({ [`atalhos/${id}`]: null });
}

export function iniciarAtalhos() {
  $('quickValor').addEventListener('keydown', (e) => { if (e.key === 'Enter') salvarQuick(); });
  registrarAcoes({
    'atalho-abrir': abrirQuick,
    'atalho-confirmar': salvarQuick,
    'atalhos-gerenciar': abrirGerenciar,
    'atalho-salvar': salvarAtalho,
    'atalho-excluir': excluirAtalho
  });
}
