// Login por e-mail/senha (Firebase Auth).
import {
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from '../core/firebase.js';
import { registrarAcoes } from '../core/acoes.js';

let modo = 'login';
const $ = (id) => document.getElementById(id);

const MENSAGENS = {
  'auth/invalid-email': 'E-mail inválido.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já tem conta. Use "Entrar".',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet.'
};
const traduzir = (e) => MENSAGENS[e?.code] || e?.message || 'Erro desconhecido.';

function alternarModo() {
  modo = modo === 'login' ? 'register' : 'login';
  const login = modo === 'login';
  $('authTitle').textContent = login ? 'Entrar (Lab)' : 'Criar Conta';
  $('authBtn').textContent = login ? 'Entrar' : 'Criar Conta';
  $('authToggle').textContent = login ? 'Criar conta' : 'Já tenho conta';
  $('authSenha').autocomplete = login ? 'current-password' : 'new-password';
  $('authErro').textContent = '';
}

async function entrar() {
  const email = $('authEmail').value.trim();
  const senha = $('authSenha').value;
  const erro = $('authErro');
  const btn = $('authBtn');
  erro.textContent = '';
  if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }

  btn.disabled = true;
  btn.textContent = '...';
  try {
    if (modo === 'login') await signInWithEmailAndPassword(auth, email, senha);
    else await createUserWithEmailAndPassword(auth, email, senha);
    $('authSenha').value = '';
  } catch (e) {
    erro.textContent = traduzir(e);
  } finally {
    btn.disabled = false;
    btn.textContent = modo === 'login' ? 'Entrar' : 'Criar Conta';
  }
}

async function esqueciSenha() {
  const email = $('authEmail').value.trim();
  if (!email) return alert('Digite seu e-mail primeiro.');
  try {
    await sendPasswordResetEmail(auth, email);
    alert('📧 E-mail de recuperação enviado.');
  } catch (e) {
    alert('Erro: ' + traduzir(e));
  }
}

/** Sai da conta. `silencioso` pula a confirmação (usado ao expirar a sessão). */
export async function sair(silencioso = false) {
  if (!silencioso && !confirm('Sair da conta?')) return;
  try { await signOut(auth); } catch (e) { console.error(e); }
}

export function iniciarAuth() {
  $('authSenha').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
  registrarAcoes({
    'auth-entrar': entrar,
    'auth-alternar': alternarModo,
    'auth-esqueci': esqueciSenha,
    'auth-sair': () => sair()
  });
}
