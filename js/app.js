import { vozApp } from './voz.js';
import { db, auth } from './firebase.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { PIN_KEY } from './config.js';
import { brl, parseMoeda } from './utils.js';
import * as UI from './ui.js';
import { authApp, pinApp, inatApp } from './auth.js';

let dbRef = null;
let unsubscribeData = null;
let tipoAtual = 'entrada';
let empTipoAtual = 'emprestei';
let appIniciado = false;
let quickTitulo = '', quickCategoria = '';

window.APP = {
  estado: { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} },

  // Juntando as peças dos módulos para o HTML achar
  auth: authApp,
  pin: pinApp,
  inat: inatApp,
  voz: vozApp, // <-- ADICIONE AQUI

  mudarTab: UI.mudarTab,
  abrirModal: UI.abrirModal,
  fecharModal: UI.fecharModal,

  //FUNÇÃO PARA O MÓDULO DE VOZ USAR
    salvarDireto: async (transacao) => {
      // Gera um ID único se não existir um
      const id = transacao.id || 't' + Date.now() + Math.random().toString(36).slice(2, 6);

      // Remove a propriedade id do objeto (se existir) para não salvar duplicado
      const { id: _, ...dados } = transacao;

      await update(dbRef, { ['transacoes/' + id]: dados });
    },


  iniciar: () => {
    if (appIniciado) return;
    appIniciado = true;
    UI.setDataHoje();
    UI.atualizarMes();
    UI.preencherSelects(APP.estado, tipoAtual);
    UI.renderizar(APP.estado);
    inatApp.start();
  },

  setTipo: (t) => {
    tipoAtual = t;
    document.querySelectorAll('#tipoGroup button').forEach(b => b.classList.toggle('active', b.dataset.tipo === t));
    document.getElementById('contaDestinoWrap').style.display = t === 'transferencia' ? 'block' : 'none';
    UI.preencherCategorias(tipoAtual);
  },

  // --- QUICK ADD ---
  abrirQuick: (id) => {
    const a = APP.estado.atalhos[id]; if (!a) return;
    quickTitulo = a.nome; quickCategoria = a.categoria;
    document.getElementById('quickTitle').innerHTML = `${a.emoji} ${a.nome}`;
    document.getElementById('quickValor').value = '';
    UI.abrirModal('modalQuickAdd');
    setTimeout(() => document.getElementById('quickValor').focus(), 100);
  },
  salvarQuick: async () => {
    const valor = parseMoeda(document.getElementById('quickValor').value);
    if (valor <= 0) return alert('Digite um valor válido.');
    const contaId = Object.keys(APP.estado.contas)[0];
    if (!contaId) return alert('Crie uma conta primeiro.');

    const id = 't'+Date.now();
    const t = { tipo: 'saida', desc: quickTitulo, valor, data: new Date().toISOString().split('T')[0], conta: contaId, categoria: quickCategoria, criadoEm: Date.now() };
    try { await update(dbRef, { ['transacoes/'+id]: t }); UI.fecharModal('modalQuickAdd'); alert('✅ Gasto lançado!'); } catch(e) { alert('Erro: ' + e.message); }
  },

  abrirGerenciarAtalhos: () => {
    APP.renderListaAtalhosConfig();
    document.getElementById('atalhoCategoria').innerHTML = ['Alimentação','Transporte','Moradia','Lazer','Saúde','Educação','Contas Fixas','Outros'].map(c => `<option value="${c}">${c}</option>`).join('');
    UI.abrirModal('modalGerenciarAtalhos');
  },
  renderListaAtalhosConfig: () => {
    const div = document.getElementById('listaAtalhosConfig');
    const atalhos = Object.entries(APP.estado.atalhos || {});
    if (atalhos.length === 0) { div.innerHTML = '<div class="empty">Nenhum atalho.</div>'; return; }
    div.innerHTML = atalhos.map(([id, a]) => `<div class="atalho-item"><span>${a.emoji} ${a.nome} <small style="color:var(--muted)">(${a.categoria})</small></span><button class="sm danger" onclick="APP.excluirAtalho('${id}')">🗑️</button></div>`).join('');
  },
  salvarAtalho: async () => {
    const emoji = document.getElementById('atalhoEmoji').value.trim() || '📌';
    const nome = document.getElementById('atalhoNome').value.trim();
    const categoria = document.getElementById('atalhoCategoria').value;
    if (!nome) return alert('Digite o nome.');
    const id = 'a' + Date.now();
    try { await update(dbRef, { ['atalhos/'+id]: { emoji, nome, categoria } }); document.getElementById('atalhoEmoji').value = ''; document.getElementById('atalhoNome').value = ''; APP.renderListaAtalhosConfig(); } catch(e) { alert(e.message); }
  },
  excluirAtalho: async (id) => {
    if (!confirm('Excluir atalho?')) return; try { await update(dbRef, { ['atalhos/'+id]: null }); APP.renderListaAtalhosConfig(); } catch(e) { alert(e.message); }
  },

  // --- TRANSAÇÕES ---
  salvarTransacao: async () => {
    const desc = document.getElementById('novaDesc').value.trim(); const valor = parseMoeda(document.getElementById('novaValor').value); const conta = document.getElementById('novaConta').value;
    if (!desc || valor <= 0 || !conta) return alert('Preencha tudo.');
    const t = { tipo: tipoAtual, desc, valor, data: document.getElementById('novaData').value, conta, categoria: document.getElementById('novaCategoria').value, criadoEm: Date.now() };
    try { await update(dbRef, { ['transacoes/t'+Date.now()]: t }); document.getElementById('novaDesc').value = ''; document.getElementById('novaValor').value = ''; alert('✅ Salvo!'); } catch(e) { alert(e.message); }
  },
  abrirEditarConta: () => {
    document.getElementById('formContas').innerHTML = Object.entries(APP.estado.contas).map(([id, c]) => `<div style="margin-bottom:10px;"><label>Nome</label><input data-conta-id="${id}" data-campo="nome" value="${c.nome}" /><label>Saldo Inicial</label><input data-conta-id="${id}" data-campo="saldoInicial" type="text" value="${c.saldoInicial}" /></div>`).join('');
    UI.abrirModal('modalEditarConta');
  },
  salvarContas: async () => {
    const novas = JSON.parse(JSON.stringify(APP.estado.contas));
    document.querySelectorAll('#formContas input').forEach(inp => { if (inp.dataset.campo === 'saldoInicial') novas[inp.dataset.contaId].saldoInicial = parseMoeda(inp.value); else novas[inp.dataset.contaId][inp.dataset.campo] = inp.value; });
    await update(dbRef, { contas: novas }); UI.fecharModal('modalEditarConta');
  },

  // --- EMPRÉSTIMOS ---
  abrirNovoEmprestimo: (id) => {
    const emp = id ? APP.estado.emprestimos[id] : null;
    document.getElementById('empIdEdit').value = id || ''; document.getElementById('empPessoa').value = emp ? emp.pessoa : ''; document.getElementById('empValor').value = emp ? emp.valor : '';
    empTipoAtual = emp ? emp.tipo : 'emprestei';
    document.querySelectorAll('#modalEmprestimo [data-emp-tipo]').forEach(b => b.classList.toggle('active', b.dataset.empTipo === empTipoAtual));
    UI.abrirModal('modalEmprestimo');
  },
  salvarEmprestimo: async () => {
    const id = document.getElementById('empIdEdit').value; const pessoa = document.getElementById('empPessoa').value; const valor = parseMoeda(document.getElementById('empValor').value);
    if (!pessoa || valor <= 0) return alert('Preencha.');
    if (id) await update(dbRef, { ['emprestimos/'+id]: { ...APP.estado.emprestimos[id], pessoa, valor, tipo: empTipoAtual } });
    else await update(dbRef, { ['emprestimos/e'+Date.now()]: { pessoa, valor, data: new Date().toISOString().split('T')[0], tipo: empTipoAtual, pago: 0 } });
    UI.fecharModal('modalEmprestimo');
  },
  abrirPagamento: (id) => {
    const emp = APP.estado.emprestimos[id];
    document.getElementById('pagEmpId').value = id; document.getElementById('pagInfo').innerHTML = `Falta: ${brl(emp.valor - emp.pago)}`;
    UI.abrirModal('modalPagamento');
  },
  salvarPagamento: async () => {
    const empId = document.getElementById('pagEmpId').value; const valor = parseMoeda(document.getElementById('pagValor').value); const emp = APP.estado.emprestimos[empId];
    if (valor <= 0) return;
    await update(dbRef, { ['pagamentosEmprestimo/p'+Date.now()]: { empId, valor, data: new Date().toISOString().split('T')[0] }, ['emprestimos/'+empId+'/pago']: (emp.pago||0) + valor });
    UI.fecharModal('modalPagamento');
  },
  excluirPagamento: async (empId, pagId, valor) => {
    if (!confirm('Excluir este pagamento?')) return;
    const emp = APP.estado.emprestimos[empId]; if (!emp) return;
    await update(dbRef, { ['pagamentosEmprestimo/'+pagId]: null, ['emprestimos/'+empId+'/pago']: Math.max(0, (emp.pago || 0) - valor) });
    APP.verHistoricoEmprestimo(empId);
  },
  verHistoricoEmprestimo: (id) => {
    const emp = APP.estado.emprestimos[id];
    const pagamentos = Object.entries(APP.estado.pagamentosEmprestimo).filter(([key, p]) => p.empId === id).sort((a,b) => new Date(b[1].data) - new Date(a[1].data));
    let html = `<div style="margin-bottom:12px; padding:12px; background:var(--bg); border-radius:8px;"><b>${emp.pessoa}</b><br><small>Total: ${brl(emp.valor)} • Pago: ${brl(emp.pago)} • Falta: ${brl(emp.valor - emp.pago)}</small></div>`;
    if (!pagamentos.length) html += '<div class="empty">Nenhum pagamento.</div>';
    else {
      html += pagamentos.map(([pid, p]) => `<div class="transacao"><div class="info"><div class="desc">💰 ${brl(p.valor)}</div><div class="meta">${new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR')}</div></div><button class="sm danger" onclick="APP.excluirPagamento('${id}', '${pid}', ${p.valor})">🗑️</button></div>`).join('');
    }
    document.getElementById('historicoEmpContent').innerHTML = html; UI.abrirModal('modalHistoricoEmp');
  }
};

onAuthStateChanged(auth, (user) => {
  if (unsubscribeData) unsubscribeData();

  if (user) {
    dbRef = ref(db, `usuarios/${user.uid}`);
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('userInfo').textContent = user.email;

    unsubscribeData = onValue(dbRef, (snap) => {
      const d = snap.val() || {};
      APP.estado.contas = d.contas || {};
      APP.estado.transacoes = d.transacoes || {};
      APP.estado.emprestimos = d.emprestimos || {};
      APP.estado.pagamentosEmprestimo = d.pagamentosEmprestimo || {};
      APP.estado.atalhos = d.atalhos || {};
      if (appIniciado) UI.renderizar(APP.estado);
    });

    const pinHash = localStorage.getItem(PIN_KEY);
    if (!pinHash) pinApp.configurarSetup();
    else if (pinHash === 'SKIPPED') { document.getElementById('pinOverlay').classList.add('hidden'); APP.iniciar(); }
    else pinApp.abrirLogin();
  } else {
    appIniciado = false; inatApp.stop();
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

// Eventos iniciais
inatApp.bindActivity();
document.getElementById('authSenha').addEventListener('keypress', e => { if (e.key === 'Enter') authApp.entrar(); });
document.getElementById('quickValor').addEventListener('keypress', e => { if (e.key === 'Enter') APP.salvarQuick(); });
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) UI.fecharModal(m.id); }));