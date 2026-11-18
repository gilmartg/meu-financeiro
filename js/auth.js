import { auth } from './firebase.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { PIN_KEY, INAT_KEY, DEFAULT_INAT } from './config.js';
import { hashPin } from './utils.js';
import { abrirModal, fecharModal } from './ui.js';

let pinModoAtual = 'login';
let authModo = 'login';

export const authApp = {
  alternarModo: () => {
    authModo = authModo === 'login' ? 'register' : 'login';
    document.getElementById('authTitle').textContent = authModo === 'login' ? 'Entrar (Lab)' : 'Criar Conta';
    document.getElementById('authBtn').textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta';
    document.getElementById('authToggle').textContent = authModo === 'login' ? 'Criar conta' : 'Já tenho conta';
  },
  entrar: async () => {
    const email = document.getElementById('authEmail').value.trim();
    const senha = document.getElementById('authSenha').value;
    const erro = document.getElementById('authErro');
    const btn = document.getElementById('authBtn');
    erro.textContent = ''; if (!email || !senha) return erro.textContent = 'Preencha tudo.';
    btn.disabled = true; btn.textContent = '...';
    try {
      if (authModo === 'login') await signInWithEmailAndPassword(auth, email, senha);
      else await createUserWithEmailAndPassword(auth, email, senha);
      document.getElementById('authSenha').value = '';
    } catch(e) {
      erro.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta';
    }
  },
  esqueciSenha: async () => {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) return alert('Digite seu e-mail.');
    try { await sendPasswordResetEmail(auth, email); alert('📧 E-mail enviado.'); } catch(e) { alert('Erro: ' + e.message); }
  },
  sair: async (s = false) => {
    if (!s && !confirm('Sair?')) return;
    window.APP.inat.stop();
    try { await signOut(auth); } catch(e) {}
  }
};

export const pinApp = {
  verificar: async () => {
    const pin = document.getElementById('pinInput').value.trim();
    const conf = document.getElementById('pinConfirm').value.trim();
    const erro = document.getElementById('pinErro'); erro.textContent = '';

    if (pinModoAtual === 'login') {
      if (pin.length < 4) return erro.textContent = 'Curto.';
      if (await hashPin(pin) === localStorage.getItem(PIN_KEY)) {
        document.getElementById('pinOverlay').classList.add('hidden');
        window.APP.iniciar();
        window.APP.inat.reset();
      } else {
        erro.textContent = '❌ Incorreto'; document.getElementById('pinInput').value = '';
      }
      return;
    }
    if (pin.length < 4 || pin !== conf) return erro.textContent = 'Não conferem ou curto.';
    localStorage.setItem(PIN_KEY, await hashPin(pin));
    document.getElementById('pinOverlay').classList.add('hidden');
    pinModoAtual = 'login';
    window.APP.iniciar();
  },
  abrirLogin: () => { pinModoAtual = 'login'; document.getElementById('pinTitle').textContent = 'Digite seu PIN'; document.getElementById('pinConfirm').style.display = 'none'; document.getElementById('pinBtn').textContent = 'Entrar'; document.getElementById('pinEsqueci').style.display = 'block'; document.getElementById('pinPular').style.display = 'none'; document.getElementById('pinOverlay').classList.remove('hidden'); },
  configurarSetup: () => { pinModoAtual = 'setup'; document.getElementById('pinTitle').textContent = 'Crie um PIN'; document.getElementById('pinConfirm').style.display = 'block'; document.getElementById('pinBtn').textContent = 'Salvar'; document.getElementById('pinEsqueci').style.display = 'none'; document.getElementById('pinPular').style.display = 'block'; document.getElementById('pinOverlay').classList.remove('hidden'); },
  esqueci: async () => { localStorage.removeItem(PIN_KEY); window.APP.inat.stop(); try { await signOut(auth); } catch(e) {} },
  pular: () => { localStorage.setItem(PIN_KEY, 'SKIPPED'); document.getElementById('pinOverlay').classList.add('hidden'); window.APP.iniciar(); window.APP.inat.start(); }
};

export const inatApp = {
  timerId: null, warningInterval: null, lastActivity: Date.now(), timeoutMs: DEFAULT_INAT, _bound: false,
  load() { const s = localStorage.getItem(INAT_KEY); if (s !== null) { this.timeoutMs = parseInt(s, 10) || DEFAULT_INAT; } },
  bindActivity() { if (this._bound) return; this._bound = true; ['mousemove','mousedown','keydown','scroll','touchstart','click','input'].forEach(ev => { document.addEventListener(ev, () => this.reset(), { passive: true }); }); },
  start() { this.stop(); if (this.timeoutMs <= 0) return; this.lastActivity = Date.now(); this.timerId = setInterval(() => this.check(), 10000); },
  stop() { if (this.timerId) { clearInterval(this.timerId); this.timerId = null; } if (this.warningInterval) { clearInterval(this.warningInterval); this.warningInterval = null; } const w = document.getElementById('inatWarning'); if (w) w.classList.remove('open'); },
  isActive() { return !!this.timerId && !!auth.currentUser; },
  reset() { if (!this.isActive()) return; this.lastActivity = Date.now(); const w = document.getElementById('inatWarning'); if (w && w.classList.contains('open')) { w.classList.remove('open'); if (this.warningInterval) { clearInterval(this.warningInterval); this.warningInterval = null; } } },
  check() { if (!this.isActive()) return; const idle = Date.now() - this.lastActivity; if (this.timeoutMs - idle <= 0) { this.expirar(); return; } if (this.timeoutMs - idle <= 60000) { this.mostrarWarning(); } },
  mostrarWarning() { const w = document.getElementById('inatWarning'); if (!w || w.classList.contains('open')) return; w.classList.add('open'); const el = document.getElementById('inatCountdown'); const tick = () => { if (!w.classList.contains('open')) return; el.textContent = Math.ceil(Math.max(0, this.timeoutMs - (Date.now() - this.lastActivity)) / 1000); }; tick(); this.warningInterval = setInterval(tick, 1000); },
  continuar() { this.reset(); },
  expirar() { this.stop(); alert('⏱️ Sessão expirada.'); authApp.sair(true); },
  abrirConfig() { document.querySelectorAll('#timeoutOptions button').forEach(b => b.classList.toggle('active', parseInt(b.dataset.ms) === this.timeoutMs)); abrirModal('modalInatConfig'); },
  fecharConfig() { fecharModal('modalInatConfig'); },
  escolherTempo(ms) { this.timeoutMs = ms; localStorage.setItem(INAT_KEY, String(ms)); if (auth.currentUser) this.start(); this.fecharConfig(); }
};