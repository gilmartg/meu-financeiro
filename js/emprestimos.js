import { update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { esc, brl, parseMoeda } from './utils.js';

let empTipoAtual = 'emprestei';

export const emprestimosApp = {
  renderizar(estado) {
    const emps = Object.entries(estado.emprestimos || {}).map(([id,e]) => ({ id, ...e }));
    const abertos = emps.filter(e => (e.pago||0) < e.valor);

    document.getElementById('listaEmprestimos').innerHTML = abertos.map(e => `
      <div class="emprestimo-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <b>${esc(e.pessoa)}</b>
          <span class="badge" style="background:${e.tipo === 'emprestei' ? 'var(--primary)' : 'var(--danger)'}20; color:${e.tipo === 'emprestei' ? 'var(--primary)' : 'var(--danger)'};">
            ${e.tipo === 'emprestei' ? '💸 Emprestei' : '🤲 Peguei'}
          </span>
        </div>
        <small style="display:block; margin-bottom:8px;">Falta: <b>${brl(e.valor - (e.pago||0))}</b></small>
        <div class="row" style="flex-wrap:wrap; gap:6px;">
          <button class="sm" onclick="APP.abrirPagamento('${e.id}')">💰 Pagar</button>
          <button class="sm sec" onclick="APP.verHistoricoEmprestimo('${e.id}')">📋 Histórico</button>
          <button class="sm sec" onclick="APP.abrirNovoEmprestimo('${e.id}')">✏️ Editar</button>
          <button class="sm danger" onclick="APP.excluirEmprestimo('${e.id}')">✕ Excluir</button>
        </div>
      </div>`
    ).join('') || '<div class="empty">Nenhum empréstimo em aberto.</div>';

    const pag = Object.values(estado.pagamentosEmprestimo || {}).sort((a,b) => new Date(b.data) - new Date(a.data)).slice(0, 15);
    document.getElementById('historicoPagamentos').innerHTML = pag.length ? pag.map(p => {
      const emp = estado.emprestimos[p.empId]; if (!emp) return '';
      const conta = p.conta ? (estado.contas[p.conta]?.nome || '?') : '—';
      const tipoL = emp.tipo === 'emprestei' ? 'Recebido' : 'Pago';
      return `<div class="transacao"><div class="info"><div class="desc">${esc(emp.pessoa)} — ${tipoL}</div><div class="meta">${new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR')} • ${esc(conta)}</div></div><div class="valor entrada">${brl(p.valor)}</div></div>`;
    }).join('') : '<div class="empty">Nenhum pagamento registrado.</div>';
  },

  setEmpTipo(tipo, btn) {
    empTipoAtual = tipo;
    document.querySelectorAll('#modalEmprestimo [data-emp-tipo]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
  },

  abrir(id) {
    const estado = window.APP.estado;
    const emp = id ? estado.emprestimos[id] : null;
    document.getElementById('empIdEdit').value = id || '';
    document.getElementById('empPessoa').value = emp ? emp.pessoa : '';
    document.getElementById('empValor').value = emp ? emp.valor : '';
    empTipoAtual = emp ? emp.tipo : 'emprestei';
    document.querySelectorAll('#modalEmprestimo [data-emp-tipo]').forEach(b => b.classList.toggle('active', b.dataset.empTipo === empTipoAtual));
    window.APP.abrirModal('modalEmprestimo');
  },

  async salvar() {
    const dbRef = window.APP.dbRef;
    const estado = window.APP.estado;
    const id = document.getElementById('empIdEdit').value;
    const pessoa = document.getElementById('empPessoa').value;
    const valor = parseMoeda(document.getElementById('empValor').value);

    if (!pessoa || valor <= 0) return alert('Preencha o nome e um valor válido.');

    if (id) {
      await update(dbRef, { ['emprestimos/'+id]: { ...estado.emprestimos[id], pessoa, valor, tipo: empTipoAtual } });
    } else {
      await update(dbRef, { ['emprestimos/e'+Date.now()]: { pessoa, valor, data: new Date().toISOString().split('T')[0], tipo: empTipoAtual, pago: 0 } });
    }
    window.APP.fecharModal('modalEmprestimo');
  },

  async excluir(id) {
    if (!confirm('Excluir este empréstimo e todos os pagamentos?')) return;
    const dbRef = window.APP.dbRef;
    const estado = window.APP.estado;
    const updates = { ['emprestimos/'+id]: null };
    Object.entries(estado.pagamentosEmprestimo || {}).forEach(([pid, p]) => {
      if (p.empId === id) updates['pagamentosEmprestimo/'+pid] = null;
    });
    try { await update(dbRef, updates); } catch(e) { alert('Erro: ' + e.message); }
  },

  abrirPagamento(id) {
    const emp = window.APP.estado.emprestimos[id];
    document.getElementById('pagEmpId').value = id;
    document.getElementById('pagInfo').innerHTML = `Falta: ${brl(emp.valor - emp.pago)}`;
    window.APP.abrirModal('modalPagamento');
  },

  async salvarPagamento() {
    const dbRef = window.APP.dbRef;
    const estado = window.APP.estado;
    const empId = document.getElementById('pagEmpId').value;
    const valor = parseMoeda(document.getElementById('pagValor').value);
    const emp = estado.emprestimos[empId];

    if (valor <= 0) return alert('Valor inválido.');

    await update(dbRef, {
      ['pagamentosEmprestimo/p'+Date.now()]: { empId, valor, data: new Date().toISOString().split('T')[0] },
      ['emprestimos/'+empId+'/pago']: (emp.pago||0) + valor
    });
    window.APP.fecharModal('modalPagamento');
  },

  async excluirPagamento(empId, pagId, valor) {
    if (!confirm('Excluir este pagamento?')) return;
    const dbRef = window.APP.dbRef;
    const emp = window.APP.estado.emprestimos[empId];
    if (!emp) return;
    await update(dbRef, {
      ['pagamentosEmprestimo/'+pagId]: null,
      ['emprestimos/'+empId+'/pago']: Math.max(0, (emp.pago || 0) - valor)
    });
    this.verHistorico(empId);
  },

  verHistorico(id) {
    const estado = window.APP.estado;
    const emp = estado.emprestimos[id];
    const pagamentos = Object.entries(estado.pagamentosEmprestimo).filter(([key, p]) => p.empId === id).sort((a,b) => new Date(b[1].data) - new Date(a[1].data));

    let html = `<div style="margin-bottom:12px; padding:12px; background:var(--bg); border-radius:8px;"><b>${emp.pessoa}</b><br><small>Total: ${brl(emp.valor)} • Pago: ${brl(emp.pago)} • Falta: ${brl(emp.valor - emp.pago)}</small></div>`;

    if (!pagamentos.length) {
      html += '<div class="empty">Nenhum pagamento.</div>';
    } else {
      html += pagamentos.map(([pid, p]) => `<div class="transacao"><div class="info"><div class="desc">💰 ${brl(p.valor)}</div><div class="meta">${new Date(p.data+'T12:00:00').toLocaleDateString('pt-BR')}</div></div><button class="sm danger" onclick="APP.excluirPagamento('${id}', '${pid}', ${p.valor})">🗑️</button></div>`).join('');
    }
    document.getElementById('historicoEmpContent').innerHTML = html;
    window.APP.abrirModal('modalHistoricoEmp');
  }
};