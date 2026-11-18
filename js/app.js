import { db, auth } from './firebase.js';
import { ref, onValue, update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { PIN_KEY } from './config.js';
import { parseMoeda, esc, brl } from './utils.js';
import * as UI from './ui.js';
import { authApp, pinApp, inatApp } from './auth.js';
import { emprestimosApp } from './emprestimos.js';
import { vozApp } from './voz.js';

let unsubscribeData = null;
let tipoAtual = 'entrada';
let appIniciado = false;
let quickTitulo = '';
let quickCategoria = '';

window.APP = {
  estado: { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} },
  dbRef: null,
  auth: authApp,
  pin: pinApp,
  inat: inatApp,
  voz: vozApp,
  brl,
  mudarTab: UI.mudarTab,
  abrirModal: UI.abrirModal,
  fecharModal: UI.fecharModal,
  abrirNovoEmprestimo: emprestimosApp.abrir,
  salvarEmprestimo: emprestimosApp.salvar,
  excluirEmprestimo: emprestimosApp.excluir,
  abrirPagamento: emprestimosApp.abrirPagamento,
  salvarPagamento: emprestimosApp.salvarPagamento,
  excluirPagamento: emprestimosApp.excluirPagamento,
  verHistoricoEmprestimo: emprestimosApp.verHistorico,
  setEmpTipo: emprestimosApp.setEmpTipo,

  iniciar: () => {
    if (appIniciado) return;
    appIniciado = true;
    UI.setDataHoje();
    UI.atualizarMes();
    UI.preencherSelects(window.APP.estado, tipoAtual);
    UI.renderizar(window.APP.estado);
    inatApp.start();
  },

  setTipo: (tipo) => {
    tipoAtual = tipo;
    document.querySelectorAll('#tipoGroup button').forEach(button => {
      button.classList.toggle('active', button.dataset.tipo === tipo);
    });
    document.getElementById('contaDestinoWrap').style.display = tipo === 'transferencia' ? 'block' : 'none';
    UI.preencherCategorias(tipoAtual);
  },

  abrirQuick: (id) => {
    const atalho = window.APP.estado.atalhos[id];
    if (!atalho) return;
    quickTitulo = atalho.nome;
    quickCategoria = atalho.categoria;
    document.getElementById('quickTitle').textContent = `${atalho.emoji || ''} ${atalho.nome}`;
    document.getElementById('quickValor').value = '';
    UI.abrirModal('modalQuickAdd');
    setTimeout(() => document.getElementById('quickValor').focus(), 100);
  },

  salvarQuick: async () => {
    const valor = parseMoeda(document.getElementById('quickValor').value);
    if (valor <= 0) return alert('Digite um valor válido.');
    const conta = Object.keys(window.APP.estado.contas)[0];
    if (!conta) return alert('Crie uma conta primeiro.');
    const id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const transacao = {
      tipo: 'saida', desc: quickTitulo, valor,
      data: new Date().toISOString().slice(0, 10), conta,
      categoria: quickCategoria, criadoEm: Date.now()
    };
    try {
      await update(window.APP.dbRef, { [`transacoes/${id}`]: transacao });
      UI.fecharModal('modalQuickAdd');
      alert('✅ Gasto lançado!');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  salvarDireto: async (transacao) => {
    const id = transacao.id || `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const { id: ignoredId, ...dados } = transacao;
    await update(window.APP.dbRef, { [`transacoes/${id}`]: dados });
  },

  abrirGerenciarAtalhos: () => {
    window.APP.renderListaAtalhosConfig();
    const categorias = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas Fixas', 'Outros'];
    document.getElementById('atalhoCategoria').innerHTML = categorias.map(categoria => `<option value="${esc(categoria)}">${esc(categoria)}</option>`).join('');
    UI.abrirModal('modalGerenciarAtalhos');
  },

  renderListaAtalhosConfig: () => {
    const container = document.getElementById('listaAtalhosConfig');
    const atalhos = Object.entries(window.APP.estado.atalhos || {});
    if (!atalhos.length) {
      container.innerHTML = '<div class="empty">Nenhum atalho.</div>';
      return;
    }
    container.innerHTML = atalhos.map(([id, atalho]) => `
      <div class="atalho-item"><span>${esc(atalho.emoji)} ${esc(atalho.nome)} <small style="color:var(--muted)">(${esc(atalho.categoria)})</small></span>
      <button type="button" class="sm danger" onclick="APP.excluirAtalho('${esc(id)}')">✕</button></div>
    `).join('');
  },

  salvarAtalho: async () => {
    const emoji = document.getElementById('atalhoEmoji').value.trim() || '📌';
    const nome = document.getElementById('atalhoNome').value.trim();
    const categoria = document.getElementById('atalhoCategoria').value;
    if (!nome) return alert('Digite o nome.');
    const id = `a${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
    try {
      await update(window.APP.dbRef, { [`atalhos/${id}`]: { emoji, nome, categoria } });
      document.getElementById('atalhoEmoji').value = '';
      document.getElementById('atalhoNome').value = '';
      window.APP.renderListaAtalhosConfig();
    } catch (error) {
      alert(error.message);
    }
  },

  excluirAtalho: async (id) => {
    if (!confirm('Excluir atalho?')) return;
    try {
      await update(window.APP.dbRef, { [`atalhos/${id}`]: null });
      window.APP.renderListaAtalhosConfig();
    } catch (error) {
      alert(error.message);
    }
  },

  salvarTransacao: async () => {
    const desc = document.getElementById('novaDesc').value.trim();
    const valor = parseMoeda(document.getElementById('novaValor').value);
    const conta = document.getElementById('novaConta').value;
    const contaDestino = document.getElementById('novaContaDestino').value;
    const data = document.getElementById('novaData').value;

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
      const id = `t${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
      // O saldo é derivado das transações na UI; não altere saldoInicial aqui.
      await update(window.APP.dbRef, { [`transacoes/${id}`]: transacao });
      document.getElementById('novaDesc').value = '';
      document.getElementById('novaValor').value = '';
      alert('✅ Salvo!');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  excluirTransacao: async (id) => {
    if (!confirm('Excluir esta transação?')) return;
    try {
      await update(window.APP.dbRef, { [`transacoes/${id}`]: null });
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  },

  abrirEditarConta: () => {
    const form = document.getElementById('formContas');
    form.innerHTML = Object.entries(window.APP.estado.contas).map(([id, conta]) => `
      <div style="margin-bottom:10px;">
        <label>Nome</label><input data-conta-id="${esc(id)}" data-campo="nome" value="${esc(conta.nome)}">
        <label>Saldo Inicial</label><input data-conta-id="${esc(id)}" data-campo="saldoInicial" type="text" inputmode="decimal" value="${Number(conta.saldoInicial) || 0}">
      </div>
    `).join('') || '<div class="empty">Nenhuma conta cadastrada.</div>';
    UI.abrirModal('modalEditarConta');
  },

  salvarContas: async () => {
    const novas = JSON.parse(JSON.stringify(window.APP.estado.contas || {}));
    document.querySelectorAll('#formContas input').forEach(input => {
      const conta = novas[input.dataset.contaId];
      if (!conta) return;
      if (input.dataset.campo === 'saldoInicial') conta.saldoInicial = parseMoeda(input.value);
      else conta[input.dataset.campo] = input.value.trim();
    });
    try {
      await update(window.APP.dbRef, { contas: novas });
      UI.fecharModal('modalEditarConta');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  }
};

onAuthStateChanged(auth, (user) => {
  if (unsubscribeData) unsubscribeData();
  unsubscribeData = null;

  if (user) {
    window.APP.dbRef = ref(db, `usuarios/${user.uid}`);
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('userInfo').textContent = user.email || '';

    unsubscribeData = onValue(window.APP.dbRef, (snapshot) => {
      const data = snapshot.val() || {};
      window.APP.estado = {
        contas: data.contas || {},
        transacoes: data.transacoes || {},
        emprestimos: data.emprestimos || {},
        pagamentosEmprestimo: data.pagamentosEmprestimo || {},
        atalhos: data.atalhos || {}
      };
      if (appIniciado) {
        UI.preencherSelects(window.APP.estado, tipoAtual);
        UI.renderizar(window.APP.estado);
      }
    }, (error) => {
      console.error('Erro ao carregar dados:', error);
      alert(`Não foi possível carregar os dados: ${error.message}`);
    });

    const pinHash = localStorage.getItem(PIN_KEY);
    if (!pinHash) pinApp.configurarSetup();
    else if (pinHash === 'SKIPPED') {
      document.getElementById('pinOverlay').classList.add('hidden');
      window.APP.iniciar();
    } else {
      pinApp.abrirLogin();
    }
  } else {
    appIniciado = false;
    inatApp.stop();
    window.APP.dbRef = null;
    window.APP.estado = { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} };
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

inatApp.bindActivity();
document.getElementById('authSenha').addEventListener('keypress', event => {
  if (event.key === 'Enter') authApp.entrar();
});
document.getElementById('quickValor').addEventListener('keypress', event => {
  if (event.key === 'Enter') window.APP.salvarQuick();
});
document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) UI.fecharModal(modal.id);
  });
});
