import { registrarAcoes } from '../core/acoes.js';

const aoEntrar = {};

/** Registra uma função para rodar quando a aba for aberta (ex.: desenhar gráficos). */
export function aoEntrarNaAba(id, fn) { aoEntrar[id] = fn; }

export function mudarTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tabbar button').forEach(b => {
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  document.getElementById('tab-' + id)?.classList.add('active');
  const btn = document.querySelector(`.tabbar button[data-tab="${id}"]`);
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-current', 'page'); }
  aoEntrar[id]?.();
}

export function iniciarTabs() {
  registrarAcoes({ 'tab': ({ tab }) => mudarTab(tab) });
}
