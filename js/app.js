import { auth } from './firebase.js';
import { update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { PIN_KEY } from './config.js';
import { store } from './state.js';
import { parseMoeda, esc, brl, hojeISO, gerarId } from './utils.js';
import * as UI from './ui.js';
import { authApp, pinApp, inatApp } from './auth.js';
import { emprestimosApp } from './emprestimos.js';
import { atalhosApp } from './atalhos.js';
import { backupApp } from './backup.js';
import { vozApp } from './voz.js';

let tipoAtual = 'saida';
let appIniciado = false;

window.APP = {
  get estado() {
    return store.dados;
  },
  get dbRef() {
    return store.dbRef;
  },
  brl,
  auth: authApp,
  pin: pinApp,
  inat: inatApp,
  voz: vozApp,

  mudarTab: UI.mudarTab,
  abrirModal: UI.abrirModal,
  fecharModal: UI.fecharModal,

  abrirNovoEmprestimo: emprestimosApp.abrir.bind(emprestimosApp),
  salvarEmprestimo: emprestimosApp.salvar.bind(emprestimosApp),
  excluirEmprestimo: emprestimosApp.excluir.bind(emprestimosApp),
  abrirPagamento: emprestimosApp.abrirPagamento.bind(emprestimosApp),
  salvarPagamento: emprestimosApp.salvarPagamento.bind(emprestimosApp),
  excluirPagamento: emprestimosApp.excluirPagamento.bind(emprestimosApp),
  verHistoricoEmprestimo: emprestimosApp.verHistorico.bind(emprestimosApp),
  setEmpTipo: emprestimosApp.setEmpTipo.bind(emprestimosApp),

  abrirQuick: atalhosApp.abrirQuick.bind(atalhosApp),
  salvarQuick: atalhosApp.salvarQuick.bind(atalhosApp),
  abrirGerenciarAtalhos: atalhosApp.abrirGerenciar.bind(atalhosApp),
  salvarAtalho: atalhosApp.salvarAtalho.bind(atalhosApp),
  excluirAtalho: atalhosApp.excluirAtalho.bind(atalhosApp),

  exportar: backupApp.exportarJSON.bind(backupApp),
  importar: backupApp.importarJSON.bind(backupApp),
  exportarTransacoesCSV: backupApp.exportarTransacoesCSV.bind(backupApp),
  exportarPagamentosCSV: backupApp.exportarPagamentosCSV.bind(backupApp),
  limparTudo: backupApp.limparTudo.bind(backupApp),

  iniciar() {
    if (appIniciado) {
      UI.preencherSelects(store.dados, tipoAtual);
      UI.renderizar(store.dados);
      return;
    }
    appIniciado = true;
    UI.setDataHoje();
    UI.atualizarMes();
    this.setTipo(tipoAtual);
    UI.preencherSelects(store.dados, tipoAtual);
    UI.renderizar(store.dados);
    inatApp.start();
  },

  setTipo(tipo) {
    tipoAtual = tipo;
    document.querySelectorAll('#tipoGroup button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tipo === tipo);
    });
    const destWrap = document.getElementById('contaDestinoWrap');
    if (destWrap) destWrap.style.display = tipo === 'transferencia' ? 'block' : 'none';
    UI.preencherCategorias(tipoAtual);
  },

  async salvarTransacao() {
    if (!store.dbRef) return alert('Faça login antes de salvar.');

    const desc = document.getElementById('novaDesc').value.trim();
    const valor = parseMoeda(document.getElementById('novaValor').value);
    const conta = document.getElementById('novaConta').value;
    const contaDestino = document.getElementById('novaContaDestino').value;
    const data = document.getElementById('novaData').value || hojeISO();

    if (!desc || valor <= 0 || !conta || !data || (tipoAtual === 'transferencia' && !contaDestino)) {
      return alert('Preencha todos os campos.');
    }
    if (tipoAtual === 'transferencia' && conta === contaDestino) {
      return alert('Escolha uma conta de destino diferente da conta de origem.');
    }

    const transacao = {
      tipo: tipoAtual,
      desc,
      valor,
      data,
      conta,
      categoria: document.getElementById('novaCategoria').value,
      criadoEm: Date.now(),
      ...(tipoAtual === 'transferencia' ? { contaDestino } : {})
    };

    try {
      await update(store.dbRef, { [`transacoes/${gerarId('t')}`]: transacao });
      document.getElementById('novaDesc').value = '';
      document.getElementById('novaValor').value = '';
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  async excluirTransacao(id) {
    if (!confirm('Excluir esta transação?')) return;
    if (!store.dbRef) return alert('Faça login antes de excluir.');
    try {
      await update(store.dbRef, { [`transacoes/${id}`]: null });
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  abrirEditarConta() {
    const form = document.getElementById('formContas');
    form.innerHTML = Object.entries(store.dados.contas || {}).map(([id, conta]) => `
      <div style="margin-bottom:10px;">
        <label>Nome</label>
        <input data-conta-id="${esc(id)}" data-campo="nome" value="${esc(conta.nome)}">
        <label>Saldo Inicial</label>
        <input data-conta-id="${esc(id)}" data-campo="saldoInicial" type="text" inputmode="decimal" value="${Number(conta.saldoInicial || 0).toFixed(2).replace('.', ',')}">
      </div>
    `).join('') || '<div class="empty">Nenhuma conta cadastrada.</div>';

    const novaConta = document.createElement('div');
    novaConta.innerHTML = `
      <hr style="border-color:var(--border);margin:15px 0;">
      <h3>➕ Adicionar conta</h3>
      <label for="novaContaNome">Nome da conta</label>
      <input id="novaContaNome" type="text" maxlength="60" placeholder="Ex: Conta corrente">
      <label for="novaContaSaldo">Saldo inicial (R$)</label>
      <input id="novaContaSaldo" type="text" inputmode="decimal" placeholder="0,00">
      <button type="button" onclick="APP.adicionarConta()">Adicionar conta</button>
    `;
    form.append(novaConta);
    UI.abrirModal('modalEditarConta');
  },

  async adicionarConta() {
    const nomeInput = document.getElementById('novaContaNome');
    const saldoInput = document.getElementById('novaContaSaldo');
    const nome = nomeInput?.value.trim();
    if (!nome) return alert('Digite o nome da conta.');
    if (!store.dbRef || !auth.currentUser) return alert('Faça login antes de adicionar uma conta.');

    try {
      await update(store.dbRef, {
        [`contas/${gerarId('c')}`]: { nome, saldoInicial: parseMoeda(saldoInput.value) }
      });
      nomeInput.value = '';
      saldoInput.value = '';
      nomeInput.focus();
    } catch (error) {
      alert(`Erro ao adicionar conta: ${error.message}`);
    }
  },

  async salvarContas() {
    if (!store.dbRef || !auth.currentUser) return alert('Faça login antes de salvar as contas.');

    const atualizacoes = {};
    document.querySelectorAll('#formContas input[data-conta-id]').forEach(input => {
      const id = input.dataset.contaId;
      const campo = input.dataset.campo;
      if (!id || !campo) return;
      if (campo === 'saldoInicial') {
        atualizacoes[`contas/${id}/saldoInicial`] = parseMoeda(input.value);
      } else {
        const valor = input.value.trim();
        if (valor) atualizacoes[`contas/${id}/${campo}`] = valor;
      }
    });

    try {
      if (Object.keys(atualizacoes).length) await update(store.dbRef, atualizacoes);
      UI.fecharModal('modalEditarConta');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  }
};

store.subscribe((dados) => {
  if (!appIniciado) return;
  UI.preencherSelects(dados, tipoAtual);
  UI.renderizar(dados);
});

onAuthStateChanged(auth, (user) => {
  const dot = document.getElementById('syncDot');
  store.conectarUsuario(user?.uid || null);

  if (user) {
    if (dot) dot.className = 'sync-dot online';
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('userInfo').textContent = user.email || '';
    const contaInfo = document.getElementById('contaInfo');
    if (contaInfo) contaInfo.textContent = `Conectado como ${user.email || user.uid}`;

    const pinHash = localStorage.getItem(PIN_KEY);
    if (!pinHash) pinApp.configurarSetup();
    else if (pinHash === 'SKIPPED') {
      document.getElementById('pinOverlay').classList.add('hidden');
      window.APP.iniciar();
    } else {
      pinApp.abrirLogin();
    }
  } else {
    if (dot) dot.className = 'sync-dot';
    appIniciado = false;
    inatApp.stop();
    document.getElementById('userInfo').textContent = '';
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

inatApp.load();
inatApp.bindActivity();

document.getElementById('authSenha')?.addEventListener('keypress', e => {
  if (e.key === 'Enter') authApp.entrar();
});
document.getElementById('quickValor')?.addEventListener('keypress', e => {
  if (e.key === 'Enter') window.APP.salvarQuick();
});
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) UI.fecharModal(modal.id);
  });
});

