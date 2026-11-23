// Delegação de eventos: botões do HTML usam data-action="nome" (+ data-* com parâmetros)
// e cada módulo registra suas ações aqui. Sem onclick inline e sem variável global.
const acoes = new Map();

export function registrarAcoes(mapa) {
  for (const [nome, fn] of Object.entries(mapa)) {
    if (acoes.has(nome)) console.warn(`Ação duplicada: ${nome}`);
    acoes.set(nome, fn);
  }
}

export function iniciarDelegacao() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const nome = el.dataset.action;
    const fn = acoes.get(nome);
    if (!fn) { console.warn(`Ação não registrada: ${nome}`); return; }
    Promise.resolve()
      .then(() => fn(el.dataset, el, event))
      .catch(err => { console.error(`Erro na ação ${nome}:`, err); alert(`Erro: ${err.message || err}`); });
  });
}
