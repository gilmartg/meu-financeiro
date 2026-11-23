// Logout automático por inatividade.
import { INAT_KEY, DEFAULT_INAT } from '../core/config.js';
import { auth } from '../core/firebase.js';
import { registrarAcoes } from '../core/acoes.js';
import { abrirModal, fecharModal } from '../ui/modal.js';

const $ = (id) => document.getElementById(id);

let timerId = null;
let contagemId = null;
let ultimaAtividade = Date.now();
let timeoutMs = DEFAULT_INAT;
let aoExpirar = () => {};

export const definirAoExpirar = (fn) => { aoExpirar = fn; };

function carregar() {
  const salvo = localStorage.getItem(INAT_KEY);
  if (salvo !== null) {
    const n = parseInt(salvo, 10);
    timeoutMs = Number.isNaN(n) ? DEFAULT_INAT : n; // 0 = nunca
  }
}

const ativo = () => !!timerId && !!auth.currentUser;

function fecharAviso() {
  $('inatWarning').classList.remove('open');
  if (contagemId) { clearInterval(contagemId); contagemId = null; }
}

export function parar() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  fecharAviso();
}

export function iniciar() {
  parar();
  if (timeoutMs <= 0) return;
  ultimaAtividade = Date.now();
  timerId = setInterval(verificar, 10000);
}

export function registrarAtividade() {
  if (!ativo()) return;
  ultimaAtividade = Date.now();
  if ($('inatWarning').classList.contains('open')) fecharAviso();
}

function mostrarAviso() {
  const aviso = $('inatWarning');
  if (aviso.classList.contains('open')) return;
  aviso.classList.add('open');
  const el = $('inatCountdown');
  const tick = () => {
    el.textContent = Math.ceil(Math.max(0, timeoutMs - (Date.now() - ultimaAtividade)) / 1000);
  };
  tick();
  contagemId = setInterval(tick, 1000);
}

function verificar() {
  if (!ativo()) return;
  const restante = timeoutMs - (Date.now() - ultimaAtividade);
  if (restante <= 0) {
    parar();
    alert('⏱️ Sessão expirada por inatividade.');
    aoExpirar();
  } else if (restante <= 60000) {
    mostrarAviso();
  }
}

export function atualizarRotulo() {
  const el = $('inatCurrentLabel');
  if (!el) return;
  el.textContent = timeoutMs <= 0
    ? 'Logout automático: desativado'
    : `Logout automático: ${Math.round(timeoutMs / 60000)} min sem uso`;
}

function abrirConfig() {
  document.querySelectorAll('#timeoutOptions button').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === timeoutMs);
  });
  abrirModal('modalInatConfig');
}

function escolherTempo(ms) {
  timeoutMs = ms;
  localStorage.setItem(INAT_KEY, String(ms));
  atualizarRotulo();
  if (auth.currentUser) iniciar();
  fecharModal('modalInatConfig');
}

export function iniciarInatividade() {
  carregar();
  atualizarRotulo();
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'input']
    .forEach(ev => document.addEventListener(ev, registrarAtividade, { passive: true }));
  registrarAcoes({
    'inat-config': abrirConfig,
    'inat-tempo': ({ ms }) => escolherTempo(parseInt(ms, 10)),
    'inat-continuar': registrarAtividade
  });
}
