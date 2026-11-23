import { registrarAcoes } from '../core/acoes.js';

export const abrirModal = (id) => document.getElementById(id)?.classList.add('open');
export const fecharModal = (id) => document.getElementById(id)?.classList.remove('open');

export function iniciarModais() {
  // Clicar fora do conteúdo fecha o modal (exceto o aviso de sessão expirando).
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal && modal.id !== 'inatWarning') fecharModal(modal.id);
    });
  });
  registrarAcoes({
    'fechar-modal': ({ modal }) => fecharModal(modal)
  });
}
