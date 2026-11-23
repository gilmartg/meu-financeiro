import { auth } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { PIN_KEY, INAT_KEY, DEFAULT_INAT, TIMEOUT_OPCOES } from './config.js';
import { hashPin } from './utils.js';
import { abrirModal, fecharModal } from './ui.js';

let pinModoAtual = 'login';
let authModo = 'login';

function traduzirErroAuth(code = '') {
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'E-mail ou senha inválidos.';
  }
  if (code.includes('email-already-in-use')) return 'Este e-mail já está cadastrado.';
  if (code.includes('weak-password')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (code.includes('invalid-email')) return 'Digite um e-mail válido.';
  if (code.includes('network-request-failed')) return 'Sem conexão com a internet.';
  return 'Não foi possível concluir a autenticação.';
}

export const authApp = {
  alternarModo() {
    authModo = authModo === 'login' ? 'register' : 'login';
    document.getElementById('authErro').textContent = '';
    document.getElementById('authTitle').textContent = authModo === 'login' ? 'Entrar (Lab)' : 'Criar Conta';
    document.getElementById('authBtn').textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta';
    document.getElementById('authToggle').textContent = authModo === 'login' ? 'Criar conta' : 'Já tenho conta';
  },

  async entrar() {
    const email = document.getElementById('authEmail').value.trim();
    const senha = document.getElementById('authSenha').value;
    const erro = document.getElementById('authErro');
    const btn = document.getElementById('authBtn');
    erro.textContent = '';

    if (!email || !senha) {
      erro.textContent = 'Preencha e-mail e senha.';
      return;
    }

    btn.disabled = true;
    btn.textContent = '...';
    try {
      if (authModo === 'login') {
        await signInWithEmailAndPassword(auth, email, senha);
      } else {
        await createUserWithEmailAndPassword(auth, email, senha);
      }
      document.getElementById('authSenha').value = '';
    } catch (e) {
      erro.textContent = traduzirErroAuth(e.code || e.message || '');
    } finally {
      btn.disabled = false;
      btn.textContent = authModo === 'login' ? 'Entrar' : 'Criar Conta';
    }
  },

  async esqueciSenha() {
    const email = document.getElementById('authEmail').value.trim();
    if (!email) return alert('Digite seu e-mail para redefinir a senha.');
    try {
      await sendPasswordResetEmail(auth, email);
      alert('📧 E-mail de redefinição enviado.');
    } catch (e) {
      alert('Erro: ' + traduzirErroAuth(e.code || e.message || ''));
    }
  },

  async sair(silencioso = false) {
    if (!silencioso && !confirm('Sair da conta?')) return;
    window.APP.inat.stop();
    try {
      await signOut(auth);
    } catch (_) {}
  }
};

export const pinApp = {
  async verificar() {
    const pin = document.getElementById('pinInput').value.trim();
    const conf = document.getElementById('pinConfirm').value.trim();
    const erro = document.getElementById('pinErro');
    erro.textContent = '';

    if (pinModoAtual === 'login') {
      if (pin.length < 4) {
        erro.textContent = 'Digite ao menos 4 dígitos.';
        return;
      }
      if ((await hashPin(pin)) === localStorage.getItem(PIN_KEY)) {
        document.getElementById('pinInput').value = '';
        document.getElementById('pinOverlay').classList.add('hidden');
        window.APP.iniciar();
        window.APP.inat.reset();
      } else {
        erro.textContent = '❌ PIN incorreto.';
        document.getElementById('pinInput').value = '';
      }
      return;
    }

    if (pin.length < 4 || pin !== conf) {
      erro.textContent = 'Os PINs devem ter ao menos 4 dígitos e ser iguais.';
      return;
    }

    localStorage.setItem(PIN_KEY, await hashPin(pin));
    document.getElementById('pinInput').value = '';
    document.getElementById('pinConfirm').value = '';
    document.getElementById('pinOverlay').classList.add('hidden');
    pinModoAtual = 'login';
    window.APP.iniciar();
    window.APP.inat.start();
  },

  abrirLogin() {
    pinModoAtual = 'login';
    document.getElementById('pinErro').textContent = '';
    document.getElementById('pinTitle').textContent = 'Digite seu PIN';
    document.getElementById('pinConfirm').style.display = 'none';
    document.getElementById('pinBtn').textContent = 'Entrar';
    document.getElementById('pinEsqueci').style.display = 'block';
    document.getElementById('pinPular').style.display = 'none';
    document.getElementById('pinOverlay').classList.remove('hidden');
  },

  configurarSetup() {
    pinModoAtual = 'setup';
    document.getElementById('pinErro').textContent = '';
    document.getElementById('pinInput').value = '';
    document.getElementById('pinConfirm').value = '';
    document.getElementById('pinTitle').textContent = 'Crie um PIN';
    document.getElementById('pinConfirm').style.display = 'block';
    document.getElementById('pinBtn').textContent = 'Salvar';
    document.getElementById('pinEsqueci').style.display = 'none';
    document.getElementById('pinPular').style.display = 'block';
    document.getElementById('pinOverlay').classList.remove('hidden');
  },

  abrirTroca() {
    this.configurarSetup();
  },

  desativar() {
    if (!confirm('Desativar o PIN neste aparelho?')) return;
    localStorage.setItem(PIN_KEY, 'SKIPPED');
    document.getElementById('pinOverlay').classList.add('hidden');
    window.APP.iniciar();
  },

  async esqueci() {
    localStorage.removeItem(PIN_KEY);
    window.APP.inat.stop();
    try {
      await signOut(auth);
    } catch (_) {}
  },

  pular() {
    localStorage.setItem(PIN_KEY, 'SKIPPED');
    document.getElementById('pinOverlay').classList.add('hidden');
    window.APP.iniciar();
    window.APP.inat.start();
  }
};

export const inatApp = {
  timerId: null,
  warningInterval: null,
  lastActivity: Date.now(),
  timeoutMs: DEFAULT_INAT,
  _bound: false,

  load() {
    const salvo = localStorage.getItem(INAT_KEY);
    if (salvo !== null) {
      const parsed = parseInt(salvo, 10);
      this.timeoutMs = Number.isNaN(parsed) ? DEFAULT_INAT : parsed;
    }
    this.atualizarLabel();
  },

  atualizarLabel() {
    const labelEl = document.getElementById('inatCurrentLabel');
    if (!labelEl) return;
    const encontrada = TIMEOUT_OPCOES.find(o => o.ms === this.timeoutMs);
    const texto = encontrada ? encontrada.label : `${Math.round(this.timeoutMs / 60000)} minutos`;
    labelEl.textContent = this.timeoutMs > 0 ? `Logout automático: ${texto}` : 'Logout automático: Desativado';
  },

  bindActivity() {
    if (this._bound) return;
    this._bound = true;
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'input'].forEach(ev => {
      document.addEventListener(ev, () => this.reset(), { passive: true });
    });
  },

  start() {
    this.stop();
    if (this.timeoutMs <= 0) return;
    this.lastActivity = Date.now();
    this.timerId = setInterval(() => this.check(), 10000);
  },

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.warningInterval) {
      clearInterval(this.warningInterval);
      this.warningInterval = null;
    }
    const w = document.getElementById('inatWarning');
    if (w) w.classList.remove('open');
  },

  isActive() {
    return !!this.timerId && !!auth.currentUser;
  },

  reset() {
    if (!this.isActive()) return;
    this.lastActivity = Date.now();
    const w = document.getElementById('inatWarning');
    if (w && w.classList.contains('open')) {
      w.classList.remove('open');
      if (this.warningInterval) {
        clearInterval(this.warningInterval);
        this.warningInterval = null;
      }
    }
  },

  check() {
    if (!this.isActive()) return;
    const idle = Date.now() - this.lastActivity;
    const restante = this.timeoutMs - idle;
    if (restante <= 0) {
      this.expirar();
      return;
    }
    if (restante <= 60000) {
      this.mostrarWarning();
    }
  },

  mostrarWarning() {
    const w = document.getElementById('inatWarning');
    if (!w || w.classList.contains('open')) return;
    w.classList.add('open');
    const el = document.getElementById('inatCountdown');
    const tick = () => {
      if (!w.classList.contains('open')) return;
      const seg = Math.ceil(Math.max(0, this.timeoutMs - (Date.now() - this.lastActivity)) / 1000);
      if (el) el.textContent = String(seg);
    };
    tick();
    this.warningInterval = setInterval(tick, 1000);
  },

  continuar() {
    this.reset();
  },

  expirar() {
    this.stop();
    alert('⏱️ Sessão expirada por inatividade.');
    authApp.sair(true);
  },

  abrirConfig() {
    document.querySelectorAll('#timeoutOptions button').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.ms, 10) === this.timeoutMs);
    });
    abrirModal('modalInatConfig');
  },

  fecharConfig() {
    fecharModal('modalInatConfig');
  },

  escolherTempo(ms) {
    this.timeoutMs = Number(ms);
    localStorage.setItem(INAT_KEY, String(this.timeoutMs));
    this.atualizarLabel();
    if (auth.currentUser) {
      if (this.timeoutMs > 0) this.start();
      else this.stop();
    }
    this.fecharConfig();
  }
};