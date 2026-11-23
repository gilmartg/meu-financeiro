// Empréstimos familiares: cadastro, pagamentos e histórico.
import { getEstado, gravar } from '../core/store.js';
import { registrarAcoes } from '../core/acoes.js';
import { esc, brl, parseMoeda, moedaParaInput, arred2, novoId, hojeISO, formatarData, porDataDesc } from '../core/utils.js';
import { faltaDoEmprestimo, estaQuitado } from '../core/calculos.js';
import { abrirModal, fecharModal } from '../ui/modal.js';

const $ = (id) => document.getElementById(id);

let tipoAtual = 'emprestei';

const rotuloTipo = (e) => (e.tipo === 'emprestei' ? 'Recebido' : 'Pago');

// ---------- Renderização ----------
function cartao(e, { quitado }) {
  const emprestei = e.tipo === 'emprestei';
  const cor = emprestei ? 'var(--primary)' : 'var(--danger)';
  const badge = quitado
    ? '<span class="badge" style="background:rgba(16,185,129,.15);color:var(--primary);">✅ Quitado</span>'
    : `<span class="badge" style="background:${emprestei ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)'};color:${cor};">${emprestei ? '💸 Emprestei' : '🤲 Peguei'}</span>`;
  const linhaValor = quitado
    ? `<small>${formatarData(e.data)} • ${brl(e.valor)}</small>`
    : `<small style="display:block;margin-bottom:6px;">${formatarData(e.data)}</small>`;
  return `
    <div class="emprestimo-card">
      <div class="linha-entre" style="margin-bottom:6px;"><b>${esc(e.pessoa)}</b>${badge}</div>
      ${linhaValor}
      ${e.obs ? `<small style="display:block;margin-bottom:6px;">${esc(e.obs)}</small>` : ''}
      ${quitado ? '' : `<small style="display:block;margin-bottom:8px;">Falta: <b>${brl(faltaDoEmprestimo(e))}</b> de ${brl(e.valor)}</small>`}
      <div class="row">
        ${quitado ? '' : `<button class="sm" type="button" data-action="emp-pagar" data-id="${esc(e.id)}">💰 Pagar</button>`}
        <button class="sm sec" type="button" data-action="emp-historico" data-id="${esc(e.id)}">📋 Histórico</button>
        <button class="sm sec" type="button" data-action="emp-editar" data-id="${esc(e.id)}">✏️ Editar</button>
        <button class="sm danger" type="button" data-action="emp-excluir" data-id="${esc(e.id)}">✕ Excluir</button>
      </div>
    </div>`;
}

export function renderizarEmprestimos(estado) {
  const todos = Object.entries(estado.emprestimos).map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => porDataDesc(a.data, b.data));
  const abertos = todos.filter(e => !estaQuitado(e));
  const quitados = todos.filter(estaQuitado);

  $('listaEmprestimos').innerHTML = abertos.map(e => cartao(e, { quitado: false })).join('')
    || '<div class="empty">Nenhum empréstimo em aberto.</div>';
  $('listaQuitados').innerHTML = quitados.map(e => cartao(e, { quitado: true })).join('')
    || '<div class="empty">Nenhum empréstimo quitado.</div>';

  const pagamentos = Object.entries(estado.pagamentosEmprestimo)
    .map(([id, p]) => ({ id, ...p }))
    .filter(p => estado.emprestimos[p.empId])
    .sort((a, b) => porDataDesc(a.data, b.data))
    .slice(0, 15);
  $('historicoPagamentos').innerHTML = pagamentos.map(p => {
    const emp = estado.emprestimos[p.empId];
    const conta = p.conta ? (estado.contas[p.conta]?.nome || '?') : '—';
    return `<div class="transacao"><div class="info"><div class="desc">${esc(emp.pessoa)} — ${rotuloTipo(emp)}</div><div class="meta">${formatarData(p.data)} • ${esc(conta)}</div></div><div class="valor">${brl(p.valor)}</div></div>`;
  }).join('') || '<div class="empty">Nenhum pagamento registrado.</div>';

  // Mantém o histórico aberto sempre atualizado (ou fecha se o empréstimo foi apagado).
  const idAberto = $('modalHistoricoEmp').dataset.empId;
  if ($('modalHistoricoEmp').classList.contains('open') && idAberto) renderizarHistorico(idAberto);
}

function renderizarHistorico(id) {
  const estado = getEstado();
  const emp = estado.emprestimos[id];
  if (!emp) { fecharModal('modalHistoricoEmp'); return; }

  const pagamentos = Object.entries(estado.pagamentosEmprestimo)
    .filter(([, p]) => p.empId === id)
    .sort((a, b) => porDataDesc(a[1].data, b[1].data));

  let html = `<div class="resumo-emp"><b>${esc(emp.pessoa)}</b><br>
    <small>Total: ${brl(emp.valor)} • Pago: ${brl(emp.pago || 0)} • Falta: ${brl(faltaDoEmprestimo(emp))}</small>
    ${emp.data ? `<br><small>Data: ${formatarData(emp.data)}</small>` : ''}
    ${emp.obs ? `<br><small>${esc(emp.obs)}</small>` : ''}</div>`;

  html += pagamentos.map(([pid, p]) => `
    <div class="transacao">
      <div class="info"><div class="desc">💰 ${brl(p.valor)}</div>
      <div class="meta">${formatarData(p.data)}${p.conta ? ' • ' + esc(estado.contas[p.conta]?.nome || '?') : ''}</div></div>
      <button type="button" class="sm danger" aria-label="Excluir pagamento" data-action="pagamento-excluir" data-emp="${esc(id)}" data-id="${esc(pid)}">✕</button>
    </div>`).join('') || '<div class="empty">Nenhum pagamento.</div>';

  $('historicoEmpContent').innerHTML = html;
}

function verHistorico({ id }) {
  $('modalHistoricoEmp').dataset.empId = id;
  renderizarHistorico(id);
  abrirModal('modalHistoricoEmp');
}

// ---------- Cadastro / edição ----------
function setTipo({ empTipo }) {
  tipoAtual = empTipo;
  document.querySelectorAll('#modalEmprestimo [data-emp-tipo]')
    .forEach(b => b.classList.toggle('active', b.dataset.empTipo === empTipo));
}

function abrirEmprestimo({ id } = {}) {
  const emp = id ? getEstado().emprestimos[id] : null;
  $('empIdEdit').value = id || '';
  $('empPessoa').value = emp?.pessoa || '';
  $('empValor').value = emp ? moedaParaInput(emp.valor) : '';
  $('empData').value = emp?.data || hojeISO();
  $('empObs').value = emp?.obs || '';
  $('tituloModalEmp').textContent = emp ? '✏️ Editar Empréstimo' : '🤝 Novo Empréstimo';
  setTipo({ empTipo: emp?.tipo || 'emprestei' });
  abrirModal('modalEmprestimo');
}

async function salvarEmprestimo() {
  const id = $('empIdEdit').value;
  const pessoa = $('empPessoa').value.trim();
  const valor = parseMoeda($('empValor').value);
  const data = $('empData').value || hojeISO();
  const obs = $('empObs').value.trim();
  if (!pessoa || valor <= 0) return alert('Preencha o nome e um valor maior que zero.');

  if (id) {
    const atual = getEstado().emprestimos[id];
    if (!atual) return alert('Este empréstimo não existe mais.');
    if (valor < Number(atual.pago || 0)) {
      return alert(`O valor não pode ser menor que o já pago (${brl(atual.pago)}).`);
    }
    // Campo a campo, para não sobrescrever o "pago".
    await gravar({
      [`emprestimos/${id}/pessoa`]: pessoa, [`emprestimos/${id}/valor`]: valor,
      [`emprestimos/${id}/data`]: data, [`emprestimos/${id}/obs`]: obs,
      [`emprestimos/${id}/tipo`]: tipoAtual
    });
  } else {
    await gravar({ [`emprestimos/${novoId('e')}`]: { pessoa, valor, data, obs, tipo: tipoAtual, pago: 0 } });
  }
  fecharModal('modalEmprestimo');
}

async function excluirEmprestimo({ id }) {
  if (!confirm('Excluir este empréstimo e todos os pagamentos?')) return;
  const estado = getEstado();
  if (!estado.emprestimos[id]) return;

  const updates = { [`emprestimos/${id}`]: null };
  Object.entries(estado.pagamentosEmprestimo).forEach(([pid, p]) => {
    if (p.empId !== id) return;
    updates[`pagamentosEmprestimo/${pid}`] = null;
    if (p.transacaoId) updates[`transacoes/${p.transacaoId}`] = null; // desfaz o lançamento na conta
  });
  await gravar(updates);
}

// ---------- Pagamentos ----------
function abrirPagamento({ id }) {
  const emp = getEstado().emprestimos[id];
  if (!emp) return;
  $('pagEmpId').value = id;
  $('pagInfo').textContent = `${emp.pessoa} — falta ${brl(faltaDoEmprestimo(emp))}`;
  $('pagData').value = hojeISO();
  $('pagValor').value = '';
  $('pagConta').value = '';
  abrirModal('modalPagamento');
}

async function salvarPagamento() {
  const estado = getEstado();
  const empId = $('pagEmpId').value;
  const emp = estado.emprestimos[empId];
  const valor = parseMoeda($('pagValor').value);
  const data = $('pagData').value || hojeISO();
  const conta = $('pagConta').value;

  if (!emp) return alert('Empréstimo não encontrado.');
  if (valor <= 0) return alert('Informe um valor maior que zero.');
  const falta = faltaDoEmprestimo(emp);
  if (valor > falta) return alert(`O valor é maior que o que falta (${brl(falta)}).`);

  const pagId = novoId('p');
  const updates = {
    [`pagamentosEmprestimo/${pagId}`]: { empId, valor, data, ...(conta ? { conta } : {}) },
    [`emprestimos/${empId}/pago`]: arred2(Number(emp.pago || 0) + valor)
  };

  // Se escolheu uma conta, o pagamento entra no saldo dela:
  // emprestei -> recebi (entrada) | peguei -> paguei (saída).
  if (conta) {
    const transacaoId = novoId('t');
    const recebi = emp.tipo === 'emprestei';
    updates[`pagamentosEmprestimo/${pagId}`].transacaoId = transacaoId;
    updates[`transacoes/${transacaoId}`] = {
      tipo: recebi ? 'entrada' : 'saida',
      desc: `${recebi ? 'Recebimento' : 'Pagamento'} — ${emp.pessoa}`,
      valor, data, conta,
      categoria: recebi ? 'Empréstimo recebido' : 'Empréstimo pago',
      criadoEm: Date.now(),
      pagamentoId: pagId
    };
  }

  await gravar(updates);
  fecharModal('modalPagamento');
  verHistorico({ id: empId });
}

async function excluirPagamento({ emp: empId, id: pagId }) {
  if (!confirm('Excluir este pagamento?')) return;
  const estado = getEstado();
  const emp = estado.emprestimos[empId];
  const pagamento = estado.pagamentosEmprestimo[pagId];
  if (!emp || !pagamento) return;

  const updates = {
    [`pagamentosEmprestimo/${pagId}`]: null,
    [`emprestimos/${empId}/pago`]: Math.max(0, arred2(Number(emp.pago || 0) - Number(pagamento.valor || 0)))
  };
  if (pagamento.transacaoId) updates[`transacoes/${pagamento.transacaoId}`] = null;
  await gravar(updates);
}

export function iniciarEmprestimos() {
  registrarAcoes({
    'emp-novo': () => abrirEmprestimo(),
    'emp-editar': abrirEmprestimo,
    'emp-tipo': setTipo,
    'emp-salvar': salvarEmprestimo,
    'emp-excluir': excluirEmprestimo,
    'emp-pagar': abrirPagamento,
    'emp-pagamento-salvar': salvarPagamento,
    'emp-historico': verHistorico,
    'pagamento-excluir': excluirPagamento
  });
}
