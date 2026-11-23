// Contas bancárias: listagem, criação e edição.
import { getEstado, gravar } from '../core/store.js';
import { registrarAcoes } from '../core/acoes.js';
import { esc, brl, parseMoeda, novoId } from '../core/utils.js';
import { calcularSaldoConta } from '../core/calculos.js';
import { abrirModal, fecharModal } from '../ui/modal.js';

const $ = (id) => document.getElementById(id);

export function renderizarContas(estado) {
  const html = Object.entries(estado.contas).map(([id, conta]) => `
    <div class="conta-card">
      <div class="info">
        <div class="nome">${esc(conta.nome)}</div>
        <div class="saldo">${brl(calcularSaldoConta(estado, id))}</div>
      </div>
    </div>`).join('') || '<div class="empty">Nenhuma conta cadastrada.</div>';
  $('contasResumo').innerHTML = html;
  $('listaContas').innerHTML = html;

  // Selects dos formulários que dependem das contas
  const opcoes = Object.entries(estado.contas)
    .map(([id, c]) => `<option value="${esc(id)}">${esc(c.nome)}</option>`).join('');
  const vazio = '<option value="">Nenhuma conta</option>';
  const guardar = ['novaConta', 'novaContaDestino', 'pagConta'].map(id => [id, $(id).value]);
  $('novaConta').innerHTML = opcoes || vazio;
  $('novaContaDestino').innerHTML = opcoes || vazio;
  $('pagConta').innerHTML = '<option value="">— Não registrar em conta —</option>' + opcoes;
  guardar.forEach(([id, valor]) => { if (valor && $(id).querySelector(`option[value="${CSS.escape(valor)}"]`)) $(id).value = valor; });
}

function montarFormEdicao() {
  const contas = Object.entries(getEstado().contas);
  $('formContas').innerHTML = (contas.map(([id, conta]) => `
    <div style="margin-bottom:10px;">
      <label>Nome</label><input data-conta-id="${esc(id)}" data-campo="nome" value="${esc(conta.nome)}">
      <label>Saldo inicial</label><input data-conta-id="${esc(id)}" data-campo="saldoInicial" type="text" inputmode="decimal" value="${String(Number(conta.saldoInicial) || 0).replace('.', ',')}">
    </div>`).join('') || '<div class="empty">Nenhuma conta cadastrada.</div>') + `
    <hr style="border-color:var(--border);margin:15px 0;">
    <h3 style="font-size:0.9rem;margin-bottom:8px;">➕ Adicionar conta</h3>
    <label for="novaContaNome">Nome da conta</label>
    <input id="novaContaNome" type="text" maxlength="60" placeholder="Ex: Conta corrente">
    <label for="novaContaSaldo">Saldo inicial (R$)</label>
    <input id="novaContaSaldo" type="text" inputmode="decimal" placeholder="0,00">
    <button type="button" data-action="conta-adicionar">Adicionar conta</button>`;
}

async function adicionarConta() {
  const nome = $('novaContaNome').value.trim();
  if (!nome) return alert('Digite o nome da conta.');
  await gravar({ [`contas/${novoId('c')}`]: { nome, saldoInicial: parseMoeda($('novaContaSaldo').value) } });
  montarFormEdicao(); // mostra a nova conta na lista de edição
  $('novaContaNome').focus();
}

async function salvarContas() {
  const atualizacoes = {};
  document.querySelectorAll('#formContas input[data-conta-id]').forEach(input => {
    const { contaId, campo } = input.dataset;
    if (campo === 'saldoInicial') atualizacoes[`contas/${contaId}/saldoInicial`] = parseMoeda(input.value);
    else if (input.value.trim()) atualizacoes[`contas/${contaId}/nome`] = input.value.trim();
  });
  if (Object.keys(atualizacoes).length) await gravar(atualizacoes);
  fecharModal('modalEditarConta');
}

export function iniciarContas() {
  registrarAcoes({
    'contas-editar': () => { montarFormEdicao(); abrirModal('modalEditarConta'); },
    'conta-adicionar': adicionarConta,
    'contas-salvar': salvarContas
  });
}
