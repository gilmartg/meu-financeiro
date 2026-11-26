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

// 1. REGISTRO DO SERVICE WORKER (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('✅ PWA registrado!', reg.scope))
      .catch(err => console.error('❌ Erro PWA:', err));
  });
}

// 2. FUNÇÕES E INICIALIZAÇÃO
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

aoMudar(estado => { if (appLiberado()) renderizarTudo(estado); });

iniciarSessao({
  aoLiberar: () => {
    atualizarMes();
    definirDataHoje();
    renderizarTudo(getEstado());
  }
});