import { update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { store } from './state.js';
import { CATEGORIAS_GERAIS } from './config.js';
import { esc, parseMoeda, hojeISO, gerarId } from './utils.js';

let quickTitulo = '';
let quickCategoria = '';

export const atalhosApp = {
  abrirQuick(id) {
    const atalho = store.dados.atalhos?.[id];
    if (!atalho) return;
    quickTitulo = atalho.nome;
    quickCategoria = atalho.categoria || 'Outros';
    document.getElementById('quickTitle').textContent = `${atalho.emoji || ''} ${atalho.nome}`;
    document.getElementById('quickValor').value = '';
    window.APP.abrirModal('modalQuickAdd');
    setTimeout(() => document.getElementById('quickValor')?.focus(), 100);
  },

  async salvarQuick() {
    if (!store.dbRef) return alert('Faça login antes de lançar.');
    const valor = parseMoeda(document.getElementById('quickValor').value);
    if (valor <= 0) return alert('Digite um valor válido.');

    const conta = Object.keys(store.dados.contas || {})[0];
    if (!conta) return alert('Crie uma conta primeiro.');

    const id = gerarId('t');
    const transacao = {
      tipo: 'saida',
      desc: quickTitulo,
      valor,
      data: hojeISO(),
      conta,
      categoria: quickCategoria,
      criadoEm: Date.now()
    };

    try {
      await update(store.dbRef, { [`transacoes/${id}`]: transacao });
      window.APP.fecharModal('modalQuickAdd');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  abrirGerenciar() {
    this.renderListaConfig();
    const selectCat = document.getElementById('atalhoCategoria');
    if (selectCat) {
      selectCat.innerHTML = CATEGORIAS_GERAIS.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }
    window.APP.abrirModal('modalGerenciarAtalhos');
  },

  renderListaConfig() {
    const container = document.getElementById('listaAtalhosConfig');
    if (!container) return;
    const atalhos = Object.entries(store.dados.atalhos || {});
    if (!atalhos.length) {
      container.innerHTML = '<div class="empty">Nenhum atalho.</div>';
      return;
    }
    container.innerHTML = atalhos.map(([id, atalho]) => `
      <div class="atalho-item">
        <span>${esc(atalho.emoji)} ${esc(atalho.nome)} <small style="color:var(--muted)">(${esc(atalho.categoria)})</small></span>
        <button type="button" class="sm danger" onclick="APP.excluirAtalho('${esc(id)}')">✕</button>
      </div>
    `).join('');
  },

  async salvarAtalho() {
    if (!store.dbRef) return alert('Faça login antes de salvar o atalho.');
    const emoji = document.getElementById('atalhoEmoji').value.trim() || '📌';
    const nome = document.getElementById('atalhoNome').value.trim();
    const categoria = document.getElementById('atalhoCategoria').value;
    if (!nome) return alert('Digite o nome.');

    const id = gerarId('a');
    try {
      await update(store.dbRef, { [`atalhos/${id}`]: { emoji, nome, categoria } });
      document.getElementById('atalhoEmoji').value = '';
      document.getElementById('atalhoNome').value = '';
    } catch (error) {
      alert(error.message);
    }
  },

  async excluirAtalho(id) {
    if (!confirm('Excluir atalho?')) return;
    if (!store.dbRef) return alert('Faça login antes de excluir o atalho.');
    try {
      await update(store.dbRef, { [`atalhos/${id}`]: null });
    } catch (error) {
      alert(error.message);
    }
  }
};