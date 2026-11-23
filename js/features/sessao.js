// Ciclo de vida da sessão: login/logout -> assinatura dos dados -> PIN -> app liberado.
import { auth, db, ref, onValue, onAuthStateChanged } from '../core/firebase.js';
import { definirRef, definirDados, limparEstado } from '../core/store.js';
import * as pin from './pin.js';
import * as inatividade from './inatividade.js';
import { sair } from './auth.js';

const $ = (id) => document.getElementById(id);

let cancelarAssinatura = null;
let liberado = false;
let aoLiberarApp = () => {};

export const appLiberado = () => liberado;

function liberarApp() {
  if (liberado) return;
  liberado = true;
  aoLiberarApp();
  inatividade.iniciar();
}

export function iniciarSessao({ aoLiberar }) {
  aoLiberarApp = aoLiberar;
  pin.definirAoLiberar(liberarApp);
  inatividade.definirAoExpirar(() => sair(true));

  onAuthStateChanged(auth, (user) => {
    if (cancelarAssinatura) cancelarAssinatura();
    cancelarAssinatura = null;

    if (!user) {
      liberado = false;
      inatividade.parar();
      definirRef(null);
      limparEstado();
      $('authOverlay').classList.remove('hidden');
      pin.esconderPin();
      return;
    }

    const dbRef = ref(db, `usuarios/${user.uid}`);
    definirRef(dbRef);
    $('authOverlay').classList.add('hidden');
    $('userInfo').textContent = user.email || '';
    $('contaInfo').textContent = user.email ? `Conectado como ${user.email}` : '';

    cancelarAssinatura = onValue(
      dbRef,
      (snapshot) => definirDados(snapshot.val() || {}),
      (error) => {
        console.error('Erro ao carregar dados:', error);
        alert(`Não foi possível carregar os dados: ${error.message}`);
      }
    );

    if (pin.pinNaoConfigurado()) pin.abrirSetup();
    else if (pin.pinPulado()) liberarApp();
    else pin.abrirLogin();
  });
}
