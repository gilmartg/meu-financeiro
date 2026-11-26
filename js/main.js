// Ponto de entrada: liga os módulos. Nenhuma regra de negócio mora aqui.
import './core/firebase.js';
import { aoMudar, getEstado } from './core/store.js';
import { iniciarDelegacao } from './core/acoes.js';
import { iniciarModais } from './ui/modal.js';
import { iniciarTabs, aoEntrarNaAba } from './ui/tabs.js';
import { iniciarAuth } from './features/auth.js';
import { iniciarPin } from './features/pin.js';
import { iniciarInatividade } from './features/inatividade.js';
import { iniciarSessao, appLiberado } from './features/sessao.js';
import { iniciarContas, renderizarContas } from './features/contas.js';
import { iniciarTransacoes, renderizarTransacoes, definirDataHoje } from './features/transacoes.js';
import { iniciarAtalhos, renderizarAtalhos } from './features/atalhos.js';
import { iniciarEmprestimos, renderizarEmprestimos } from './features/emprestimos.js';
import { iniciarVoz } from './features/voz.js';
import { iniciarBackup } from './features/backup.js';
import { renderizarGraficos } from './features/graficos.js';
import { renderizarPainel, atualizarMes } from './features/painel.js';

// Importações para o PWA
import { getDatabase, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { app } from './core/firebase.js';

// ==========================================
// 1. CONFIGURAÇÃO DO MODO OFFLINE (FIREBASE)
// ==========================================
const db = getDatabase(app);
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Múltiplas abas abertas. O cache offline funcionará apenas na primeira.');
  } else if (err.code === 'unimplemented') {
    console.warn('O navegador não suporta persistência offline.');
  }
});

// ==========================================
// 2. CONFIGURAÇÃO DO PWA (SERVICE WORKER)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => console.log('✅ PWA: Service Worker registrado!', reg.scope))
      .catch((err) => console.error('❌ PWA: Erro ao registrar', err));
  });
}

// ==========================================
// 3. FUNÇÕES DO APP E INICIALIZAÇÃO
// ==========================================
function renderizarTudo(estado) {
  renderizarContas(estado);
  renderizarPainel(estado);
  renderizarTransacoes(estado);
  renderizarAtalhos(estado);
  renderizarEmprestimos(estado);
  if (document.getElementById('tab-analises').classList.contains('active')) renderizarGraficos();
}

iniciarDelegacao();
iniciarModais();
iniciarTabs();
iniciarAuth();
iniciarPin();
iniciarInatividade();
iniciarContas();
iniciarTransacoes();
iniciarAtalhos();
iniciarEmprestimos();
iniciarVoz();
iniciarBackup();
aoEntrarNaAba('analises', () => setTimeout(renderizarGraficos, 50));

// Só desenha dados depois que o PIN liberou o app.
aoMudar((estado) => {
  if (appLiberado()) renderizarTudo(estado);
});

// Inicializa a sessão (com a chave e o fechamento corretos)
iniciarSessao({
  aoLiberar: () => {
    atualizarMes();
    definirDataHoje();
    renderizarTudo(getEstado());
  }
});