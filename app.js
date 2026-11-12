import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update, get } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { renderGraficos } from './charts.js';

const CONFIG = {
  firebase: {
    apiKey: "AIzaSyBd6HByBm8ZS8o9t_IrzFV_eSWWqLKPOqY",
    authDomain: "bolao-2a310.firebaseapp.com",
    databaseURL: "https://bolao-2a310-default-rtdb.firebaseio.com",
    projectId: "bolao-2a310",
    storageBucket: "bolao-2a310.firebasestorage.app",
    messagingSenderId: "89102406302",
    appId: "1:89102406302:web:739c1fdbf536449814a18f"
  }
};

const PIN_KEY = 'financas_pin_hash_v2';
const INAT_KEY = 'financas_inat_timeout';
const DEFAULT_INAT = 15 * 60 * 1000;
const CATEGORIAS = {
  entrada: ['Salário','Freelance','Investimentos','Vendas','Reembolso','Empréstimo recebido','Outros'],
  saida: ['Alimentação','Transporte','Moradia','Lazer','Saúde','Educação','Contas Fixas','Empréstimo pago','Outros']
};

const app = initializeApp(CONFIG.firebase);
const db = getDatabase(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(e => console.error(e));

let estado = { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} };
let currentUser = null;
let dbRef = null;
let unsubscribeData = null;
let tipoAtual = 'entrada';
let empTipoAtual = 'emprestei';
let pinModoAtual = 'login';
let authModo = 'login';
let appIniciado = false;

// Variáveis do Quick Add
let quickTitulo = '';
let quickCategoria = '';

async function hashPin(pin) {
  const str = 'fin2_salt::' + pin;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); } catch(e) {}
  }
  let h = 5381; for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; } return 'fb_' + Math.abs(h).toString(16) + '_' + str.length;
}

const APP = {
  esc(s) { return s==null?'':String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); },
  brl(v) { return 'R$ ' + (Number(v)||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); },
  parseMoeda(s) { if (!s) return 0; const c = String(s).replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.').trim(); const n = parseFloat(c); return isNaN(n)?0:n; },

  // === ATALHOS PERSONALIZADOS ===
  renderAtalhos() {
    const grid = document.getElementById('quickGrid');
    const vazio = document.getElementById('semAtalhos');
    const atalhos = Object.values(estado.atalhos || {});
    
    if (atalhos.length === 0) {
      grid.innerHTML = '';
      vazio.style.display = 'block';
      return;
    }
    vazio.style.display = 'none';
    grid.innerHTML = atalhos.map(a => `
      <button class="quick-btn" onclick="APP.abrirQuick('${a.id}')">
        ${a.emoji}<br>${a.nome}
      </button>
    `).join('');
  },
  abrirGerenciarAtalhos() {
    APP.renderListaAtalhosConfig();
    // Preenche o select de categorias
    document.getElementById('atalhoCategoria').innerHTML = CATEGORIAS.saida.map(c => `<option value="${c}">${c}</option>`).join('');
    APP.abrirModal('modalGerenciarAtalhos');
  },
  renderListaAtalhosConfig() {
    const div = document.getElementById('listaAtalhosConfig');
    const atalhos = Object.entries(estado.atalhos || {});
    if (atalhos.length === 0) {
      div.innerHTML = '<div class="empty">Nenhum atalho.</div>';
      return;
    }
    div.innerHTML = atalhos.map(([id, a]) => `
      <div class="atalho-item">
        <span>${a.emoji} ${a.nome} <small style="color:var(--muted)">(${a.categoria})</small></span>
        <button class="sm danger" onclick="APP.excluirAtalho('${id}')">🗑️</button>
      </div>
    `).join('');
  },
  async salvarAtalho() {
    const emoji = document.getElementById('atalhoEmoji').value.trim() || '📌';
    const nome = document.getElementById('atalhoNome').value.trim();
    const categoria = document.getElementById('atalhoCategoria').value;
    if (!nome) return alert('Digite o nome do atalho.');
    
    const id = 'a' + Date.now();
    try {
      await update(dbRef, { ['atalhos/'+id]: { emoji, nome, categoria } });
      document.getElementById('atalhoEmoji').value = '';
      document.getElementById('atalhoNome').value = '';
      APP.renderListaAtalhosConfig(); // Atualiza o modal
      APP.renderAtalhos(); // Atualiza a tela principal
    } catch(e) { alert('Erro: ' + e.message); }
  },
  async excluirAtalho(id) {
    if (!confirm('Excluir este atalho?')) return;
    try {
      await update(dbRef, { ['atalhos/'+id]: null });
      APP.renderListaAtalhosConfig();
      APP.renderAtalhos();
    } catch(e) { alert('Erro: ' + e.message); }
  },

  abrirQuick(id) {
    const a = estado.atalhos[id];
    if (!a) return;
    quickTitulo = a.nome;
    quickCategoria = a.categoria;
    document.getElementById('quickTitle').innerHTML = `${a.emoji} ${a.nome}`;
    document.getElementById('quickValor').value = '';
    APP.abrirModal('modalQuickAdd');
    setTimeout(() => document.getElementById('quickValor').focus(), 100);
  },
  async salvarQuick() {
    const valor = APP.parseMoeda(document.getElementById('quickValor').value);
    if (valor <= 0) return alert('Digite um valor válido.');
    const contaId = Object.keys(estado.contas)[0];
    if (!contaId) return alert('Crie uma conta primeiro.');

    const hoje = new Date().toISOString().split('T')[0];
    const id = 't'+Date.now();
    const t = { tipo: 'saida', desc: quickTitulo, valor, data: hoje, conta: contaId, categoria: quickCategoria, criadoEm: Date.now() };
    
    try {
      await update(dbRef, { ['transacoes/'+id]: t });
      APP.fecharModal('modalQuickAdd');
      alert('✅ Gasto lançado!');
    } catch(e) { alert('Erro: ' + e.message); }
  },

  // === RESTO DAS FUNÇÕES MANTIDAS ===
  inat: {
    timerId: null, warningInterval: null, lastActivity: Date.now(), timeoutMs: DEFAULT_INAT, _bound: false,
    load() { const s = localStorage.getItem(INAT_KEY); if (s !== null) { this.timeoutMs = parseInt(s, 10) || DEFAULT_INAT; } },
    bindActivity() { if (this._bound) return; this._bound = true; ['mousemove','mousedown','keydown','scroll','touchstart','click','input'].forEach(ev => { document.addEventListener(ev, () => this.reset(), { passive: true }); }); },
    start() { this.stop(); if (this.timeoutMs <= 0) return; this.lastActivity = Date.now(); this.timerId = setInterval(() => this.check(), 10000); },
    stop() { if (this.timerId) { clearInterval(this.timerId); this.timerId = null; } if (this.warningInterval) { clearInterval(this.warningInterval); this.warningInterval = null; } const w = document.getElementById('inatWarning'); if (w) w.classList.remove('open'); },
    isActive() { return !!this.timerId && !!currentUser; },
    reset() { if (!this.isActive()) return; this.lastActivity = Date.now(); const w = document.getElementById('inatWarning'); if (w && w.classList.contains('open')) { w.classList.remove('open'); if (this.warningInterval) { clearInterval(this.warningInterval); this.warningInterval = null; } } },
    check() { if (!this.isActive()) return; const idle = Date.now() - this.lastActivity; if (this.timeoutMs - idle <= 0) { this.expirar(); return; } if (this.timeoutMs - idle <= 60000) { this.mostrarWarning(); } },
    mostrarWarning() { const w = document.getElementById('inatWarning'); if (!w || w.classList.contains('open')) return; w.classList.add('open'); const el = document.getElementById('inatCountdown'); const tick = () => { if (!w.classList.contains('open')) return; el.textContent = Math.ceil(Math.max(0, this.timeoutMs - (Date.now() - this.lastActivity)) / 1000); }; tick(); this.warningInterval = setInterval(tick, 1000); },
    continuar() { this.reset(); },
    expirar() { this.stop(); alert('⏱️ Sessão expirada.'); APP.auth.sair(true); },
    abrirConfig() { document.querySelectorAll('#timeoutOptions button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.ms) === this.timeoutMs)); APP.abrirModal('modalInatConfig'); },
    fecharConfig() { APP.fecharModal('modalInatConfig'); },
    escolherTempo(ms) { this.timeoutMs = ms; localStorage.setItem(INAT_KEY, String(ms)); if (currentUser) this.start(); this.fecharConfig(); }
  },
  auth: {
    alternarModo() { authModo = authModo === 'login' ? 'register' : 'login'; document.getElementById('authTitle').textContent = authModo === 'login' ? 'Entrar (Lab)' : 'Criar Conta'; document.getElementById('authBtn').textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta'; document.getElementById('authToggle').textContent = authModo === 'login' ? 'Criar conta' : 'Já tenho conta'; },
    async entrar() {
      const email = document.getElementById('authEmail').value.trim(); const senha = document.getElementById('authSenha').value;
      const erro = document.getElementById('authErro'); const btn = document.getElementById('authBtn');
      erro.textContent = ''; if (!email || !senha) return erro.textContent = 'Preencha tudo.';
      btn.disabled = true; btn.textContent = '...';
      try { if (authModo === 'login') await signInWithEmailAndPassword(auth, email, senha); else await createUserWithEmailAndPassword(auth, email, senha); document.getElementById('authSenha').value = ''; }
      catch(e) { erro.textContent = e.message; } finally { btn.disabled = false; btn.textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta'; }
    },
    async esqueciSenha() { const email = document.getElementById('authEmail').value.trim(); if (!email) return alert('Digite seu e-mail.'); try { await sendPasswordResetEmail(auth, email); alert('📧 E-mail enviado.'); } catch(e) { alert('Erro: ' + e.message); } },
    async sair(s = false) { if (!s && !confirm('Sair?')) return; APP.inat.stop(); try { await signOut(auth); } catch(e) {} }
  },
  pin: {
    verificar: async () => {
      const pin = document.getElementById('pinInput').value.trim(); const conf = document.getElementById('pinConfirm').value.trim(); const erro = document.getElementById('pinErro'); erro.textContent = '';
      if (pinModoAtual === 'login') {
        if (pin.length < 4) return erro.textContent = 'Curto.';
        if (await hashPin(pin) === localStorage.getItem(PIN_KEY)) { document.getElementById('pinOverlay').classList.add('hidden'); if (!appIniciado) iniciarApp(); APP.inat.reset(); }
        else { erro.textContent = '❌ Incorreto'; document.getElementById('pinInput').value = ''; } return;
      }
      if (pin.length < 4 || pin !== conf) return erro.textContent = 'Não conferem ou curto.';
      localStorage.setItem(PIN_KEY, await hashPin(pin)); document.getElementById('pinOverlay').classList.add('hidden'); pinModoAtual = 'login'; if (!appIniciado) iniciarApp();
    },
    abrirLogin: () => { pinModoAtual = 'login'; document.getElementById('pinTitle').textContent = 'Digite seu PIN'; document.getElementById('pinConfirm').style.display = 'none'; document.getElementById('pinBtn').textContent = 'Entrar'; document.getElementById('pinEsqueci').style.display = 'block'; document.getElementById('pinPular').style.display = 'none'; document.getElementById('pinOverlay').classList.remove('hidden'); },
    configurarSetup: () => { pinModoAtual = 'setup'; document.getElementById('pinTitle').textContent = 'Crie um PIN'; document.getElementById('pinConfirm').style.display = 'block'; document.getElementById('pinBtn').textContent = 'Salvar'; document.getElementById('pinEsqueci').style.display = 'none'; document.getElementById('pinPular').style.display = 'block'; document.getElementById('pinOverlay').classList.remove('hidden'); },
    esqueci: async () => { localStorage.removeItem(PIN_KEY); APP.inat.stop(); try { await signOut(auth); } catch(e) {} },
    pular: () => { localStorage.setItem(PIN_KEY, 'SKIPPED'); document.getElementById('pinOverlay').classList.add('hidden'); if (!appIniciado) iniciarApp(); APP.inat.start(); }
  },

  init: () => { APP.setDataHoje(); APP.setTipo('entrada'); APP.atualizarMes(); APP.renderizar(); APP.inat.load(); },
  setDataHoje: () => { const h = new Date().toISOString().split('T')[0]; document.getElementById('novaData').value = h; },
  preencherSelects: () => { const opts = Object.entries(estado.contas).map(([id, c]) => `<option value="${id}">${APP.esc(c.nome)}</option>`).join(''); document.getElementById('novaConta').innerHTML = opts; document.getElementById('novaContaDestino').innerHTML = opts; document.getElementById('pagConta').innerHTML = '<option value="">-- Nenhuma --</option>' + opts; APP.preencherCategorias(); },
  preencherCategorias: () => { const cats = tipoAtual === 'transferencia' ? ['Transferência'] : CATEGORIAS[tipoAtual]; document.getElementById('novaCategoria').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join(''); },
  atualizarMes: () => { const m = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']; document.getElementById('mesAtual').textContent = m[new Date().getMonth()] + ' de ' + new Date().getFullYear(); },
  mudarTab: (id) => { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tabbar button').forEach(b => b.classList.remove('active')); document.getElementById('tab-'+id).classList.add('active'); document.querySelector(`.tabbar button[data-tab="${id}"]`).classList.add('active'); if (id === 'analises') setTimeout(() => renderGraficos(estado), 50); },
  setTipo: (t) => { tipoAtual = t; document.querySelectorAll('#tipoGroup button').forEach(b => b.classList.toggle('active', b.dataset.tipo === t)); document.getElementById('contaDestinoWrap').style.display = t === 'transferencia' ? 'block' : 'none'; APP.preencherCategorias(); },
  calcularSaldoConta: (id) => { const c = estado.contas[id]; if (!c) return 0; let s = Number(c.saldoInicial)||0; Object.values(estado.transacoes).forEach(t => { if (t.tipo === 'entrada' && t.conta === id) s += Number(t.valor); if (t.tipo === 'saida' && t.conta === id) s -= Number(t.valor); }); return s; },
  saldoTotal: () => Object.keys(estado.contas).reduce((s,id) => s + APP.calcularSaldoConta(id), 0),
  async salvarTransacao() { const desc = document.getElementById('novaDesc').value.trim(); const valor = APP.parseMoeda(document.getElementById('novaValor').value); const conta = document.getElementById('novaConta').value; if (!desc || valor <= 0 || !conta) return alert('Preencha tudo.'); const id = 't'+Date.now(); const t = { tipo: tipoAtual, desc, valor, data: document.getElementById('novaData').value, conta, categoria: document.getElementById('novaCategoria').value, criadoEm: Date.now() }; try { await update(dbRef, { ['transacoes/'+id]: t }); document.getElementById('novaDesc').value = ''; document.getElementById('novaValor').value = ''; alert('✅ Salvo!'); } catch(e) { alert(e.message); } },
  abrirEditarConta: () => { document.getElementById('formContas').innerHTML = Object.entries(estado.contas).map(([id, c]) => `<div style="margin-bottom:10px;"><label>Nome</label><input data-conta-id="${id}" data-campo="nome" value="${c.nome}" /><label>Saldo Inicial</label><input data-conta-id="${id}" data-campo="saldoInicial" type="text" value="${c.saldoInicial}" /></div>`).join(''); APP.abrirModal('modalEditarConta'); },
  async salvarContas() { const novas = JSON.parse(JSON.stringify(estado.contas)); document.querySelectorAll('#formContas input').forEach(inp => { if (inp.dataset.campo === 'saldoInicial') novas[inp.dataset.contaId].saldoInicial = APP.parseMoeda(inp.value); else novas[inp.dataset.contaId][inp.dataset.campo] = inp.value; }); await update(dbRef, { contas: novas }); APP.fecharModal('modalEditarConta'); },
  abrirNovoEmprestimo: (id) => { const emp = id ? estado.emprestimos[id] : null; document.getElementById('empIdEdit').value = id || ''; document.getElementById('empPessoa').value = emp ? emp.pessoa : ''; document.getElementById('empValor').value = emp ? emp.valor : ''; empTipoAtual = emp ? emp.tipo : 'emprestei'; document.querySelectorAll('#modalEmprestimo [data-emp-tipo]').forEach(b => b.classList.toggle('active', b.dataset.empTipo === empTipoAtual)); APP.abrirModal('modalEmprestimo'); },
  async salvarEmprestimo() { const id = document.getElementById('empIdEdit').value; const pessoa = document.getElementById('empPessoa').value; const valor = APP.parseMoeda(document.getElementById('empValor').value); if (!pessoa || valor <= 0) return alert('Preencha.'); if (id) await update(dbRef, { ['emprestimos/'+id]: { ...estado.emprestimos[id], pessoa, valor, tipo: empTipoAtual } }); else await update(dbRef, { ['emprestimos/e'+Date.now()]: { pessoa, valor, data: new Date().toISOString().split('T')[0], tipo: empTipoAtual, pago: 0 } }); APP.fecharModal('modalEmprestimo'); },
  abrirPagamento: (id) => { const emp = estado.emprestimos[id]; document.getElementById('pagEmpId').value = id; document.getElementById('pagInfo').innerHTML = `Falta: ${APP.brl(emp.valor - emp.pago)}`; APP.abrirModal('modalPagamento'); },
  async salvarPagamento() { const empId = document.getElementById('pagEmpId').value; const valor = APP.parseMoeda(document.getElementById('pagValor').value); const emp = estado.emprestimos[empId]; if (valor <= 0) return; const pagId = 'p'+Date.now(); await update(dbRef, { ['pagamentosEmprestimo/'+pagId]: { empId, valor, data: new Date().toISOString().split('T')[0] }, ['emprestimos/'+empId+'/pago']: (emp.pago||0) + valor }); APP.fecharModal('modalPagamento'); },
  async excluirPagamento(empId, pagId, valor) {
    if (!confirm('Excluir este pagamento?')) return;
    const emp = estado.emprestimos[empId]; if (!emp) return;
    const novoPago = Math.max(0, (emp.pago || 0) - valor);
    try { await update(dbRef, { ['pagamentosEmprestimo/'+pagId]: null, ['emprestimos/'+empId+'/pago']: novoPago }); APP.verHistoricoEmprestimo(empId); } catch(e) { alert('Erro: ' + e.message); }
  },
  verHistoricoEmprestimo: (id) => { 
    const emp = estado.emprestimos[id]; 
    const pagamentos = Object.entries(estado.pagamentosEmprestimo).filter(([key, p]) => p.empId === id).sort((a,b) => new Date(b[1].data) - new Date(a[1].data)); 
    let html = `<div style="margin-bottom:12px; padding:12px; background:var(--bg); border-radius:8px;"><b>${APP.esc(emp.pessoa)}</b><br><small>Total: ${APP.brl(emp.valor)} • Pago: ${APP.brl(emp.pago)} • Falta: ${APP.brl(emp.valor - emp.pago)}</small></div>`; 
    if (!pagamentos.length) html += '<div class="empty">Nenhum pagamento.</div>'; 
    else { 
      html += pagamentos.map(([pid, p]) => {
        return `<div class="transacao"><div class="info"><div class="desc">💰 ${APP.brl(p.valor)}</div><div class="meta">${new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR')}</div></div><button class="sm danger" onclick="APP.excluirPagamento('${id}', '${pid}', ${p.valor})">🗑️</button></div>`;
      }).join(''); 
    } 
    document.getElementById('historicoEmpContent').innerHTML = html; APP.abrirModal('modalHistoricoEmp'); 
  },
  abrirModal: (id) => document.getElementById(id).classList.add('open'),
  fecharModal: (id) => document.getElementById(id).classList.remove('open'),

  renderizar: () => { APP.preencherSelects(); APP.renderPainel(); APP.renderContas(); APP.renderEmprestimos(); APP.renderAtalhos(); },
  renderPainel: () => { document.getElementById('saldoTotalValor').textContent = APP.brl(APP.saldoTotal()); document.getElementById('contasResumo').innerHTML = Object.entries(estado.contas).map(([id, c]) => `<div class="conta-card"><div class="info"><div class="nome">${APP.esc(c.nome)}</div><div class="saldo">${APP.brl(APP.calcularSaldoConta(id))}</div></div></div>`).join(''); },
  renderContas: () => { document.getElementById('listaContas').innerHTML = Object.entries(estado.contas).map(([id,c]) => `<div class="conta-card"><div class="info"><div class="nome">${c.nome}</div><div class="saldo">${APP.brl(APP.calcularSaldoConta(id))}</div></div></div>`).join(''); },
  renderEmprestimos: () => { 
    const emps = Object.entries(estado.emprestimos).map(([id,e]) => ({ id, ...e })); 
    const abertos = emps.filter(e => (e.pago||0) < e.valor); 
    const renderCard = (e) => `<div class="emprestimo-card"><b>${APP.esc(e.pessoa)}</b><br><small>Falta: ${APP.brl(e.valor - (e.pago||0))}</small><div style="margin-top:8px;"><button class="sm" onclick="APP.abrirPagamento('${e.id}')">Pagar</button> <button class="sm sec" onclick="APP.verHistoricoEmprestimo('${e.id}')">Histórico</button></div></div>`; 
    document.getElementById('listaEmprestimos').innerHTML = abertos.map(renderCard).join('') || '<div class="empty">Nenhum</div>'; 
  }
};
window.APP = APP;

function iniciarApp() { appIniciado = true; APP.init(); APP.inat.start(); }

onAuthStateChanged(auth, async (user) => {
  if (unsubscribeData) unsubscribeData();
  if (user) {
    currentUser = user; dbRef = ref(db, `usuarios/${user.uid}`);
    document.getElementById('authOverlay').classList.add('hidden');
    document.getElementById('userInfo').textContent = user.email;
    unsubscribeData = onValue(dbRef, (snap) => { 
      const d = snap.val() || {}; 
      estado.contas = d.contas || {}; 
      estado.transacoes = d.transacoes || {}; 
      estado.emprestimos = d.emprestimos || {}; 
      estado.pagamentosEmprestimo = d.pagamentosEmprestimo || {}; 
      estado.atalhos = d.atalhos || {};
      if (appIniciado) APP.renderizar(); 
    });
    const pinHash = localStorage.getItem(PIN_KEY);
    if (!pinHash) APP.pin.configurarSetup();
    else if (pinHash === 'SKIPPED') { document.getElementById('pinOverlay').classList.add('hidden'); if (!appIniciado) iniciarApp(); }
    else APP.pin.abrirLogin();
  } else {
    currentUser = null; appIniciado = false; APP.inat.stop();
    document.getElementById('authOverlay').classList.remove('hidden');
    document.getElementById('pinOverlay').classList.add('hidden');
  }
});

document.getElementById('authSenha').addEventListener('keypress', e => { if (e.key === 'Enter') APP.auth.entrar(); });
document.getElementById('quickValor').addEventListener('keypress', e => { if (e.key === 'Enter') APP.salvarQuick(); });
document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); }));
APP.inat.bindActivity();