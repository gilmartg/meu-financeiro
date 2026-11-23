// PIN local (guardado só neste aparelho) para bloqueio rápido.
import { PIN_KEY, PIN_PULADO } from '../core/config.js';
import { hashPin } from '../core/utils.js';
import { registrarAcoes } from '../core/acoes.js';
import { signOut, auth } from '../core/firebase.js';

const $ = (id) => document.getElementById(id);

// 'login'  = pedir PIN existente
// 'setup'  = primeiro PIN (pode pular)
// 'troca'  = trocar PIN já em uso (pode cancelar)
let modo = 'login';
let aoLiberar = () => {};

export const definirAoLiberar = (fn) => { aoLiberar = fn; };

const guardado = () => localStorage.getItem(PIN_KEY);
export const pinAtivo = () => { const v = guardado(); return !!v && v !== PIN_PULADO; };
export const pinNaoConfigurado = () => guardado() === null;
export const pinPulado = () => guardado() === PIN_PULADO;

function mostrar(m) {
  modo = m;
  const login = m === 'login';
  $('pinTitle').textContent = login ? 'Digite seu PIN' : (m === 'troca' ? 'Novo PIN' : 'Crie um PIN');
  $('pinConfirm').style.display = login ? 'none' : 'block';
  $('pinBtn').textContent = login ? 'Entrar' : 'Salvar';
  $('pinEsqueci').style.display = login ? 'block' : 'none';
  $('pinPular').style.display = login ? 'none' : 'block';
  $('pinPular').textContent = m === 'troca' ? 'Cancelar' : 'Pular';
  $('pinPular').dataset.action = m === 'troca' ? 'pin-cancelar' : 'pin-pular';
  $('pinInput').value = '';
  $('pinConfirm').value = '';
  $('pinErro').textContent = '';
  $('pinOverlay').classList.remove('hidden');
  setTimeout(() => $('pinInput').focus(), 50);
}

const esconder = () => $('pinOverlay').classList.add('hidden');

export const abrirLogin = () => mostrar('login');
export const abrirSetup = () => mostrar('setup');
export const esconderPin = esconder;

async function verificar() {
  const pin = $('pinInput').value.trim();
  const conf = $('pinConfirm').value.trim();
  const erro = $('pinErro');
  erro.textContent = '';

  if (modo === 'login') {
    if (pin.length < 4) { erro.textContent = 'O PIN tem de 4 a 6 dígitos.'; return; }
    if (await hashPin(pin) === guardado()) {
      esconder();
      aoLiberar();
    } else {
      erro.textContent = '❌ PIN incorreto';
      $('pinInput').value = '';
    }
    return;
  }

  if (!/^\d{4,6}$/.test(pin)) { erro.textContent = 'Use de 4 a 6 números.'; return; }
  if (pin !== conf) { erro.textContent = 'Os PINs não conferem.'; return; }
  localStorage.setItem(PIN_KEY, await hashPin(pin));
  esconder();
  aoLiberar();
}

async function esqueci() {
  localStorage.removeItem(PIN_KEY);
  try { await signOut(auth); } catch (e) { console.error(e); }
}

function pular() {
  localStorage.setItem(PIN_KEY, PIN_PULADO);
  esconder();
  aoLiberar();
}

function desativar() {
  if (!confirm('Desativar o PIN neste aparelho? O app abrirá direto após o login.')) return;
  localStorage.setItem(PIN_KEY, PIN_PULADO);
  alert('PIN desativado neste aparelho.');
}

export function iniciarPin() {
  $('pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && modo === 'login') verificar(); });
  registrarAcoes({
    'pin-verificar': verificar,
    'pin-esqueci': esqueci,
    'pin-pular': pular,
    'pin-cancelar': esconder,
    'pin-trocar': () => mostrar('troca'),
    'pin-desativar': desativar
  });
}
