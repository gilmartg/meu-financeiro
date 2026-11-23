import { update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { store } from './state.js';
import { esc, brl, parseMoeda, hojeISO, formatarDataBR, gerarId } from './utils.js';

let empTipoAtual = 'emprestei';

const hintPorTipo = (tipo) =>
  tipo === 'emprestei'
    ? '💸 Você emprestou dinheiro a alguém (a receber).'
    : '🤲 Você pegou dinheiro emprestado de alguém (a pagar).';

export const emprestimosApp = {
  setEmpTipo(tipo, btn = null) {
    empTipoAtual = tipo === 'peguei' ? 'peguei' : 'emprestei';
    document.querySelectorAll('#modalEmprestimo [data-emp-tipo]').forEach(b => {
      b.classList.toggle('active', b === btn || b.dataset.empTipo === empTipoAtual);
    });
    const hint = document.getElementById('empTipoHint');
    if (hint) hint.textContent = hintPorTipo(empTipoAtual);
  },

  abrir(id = '') {
    const estado = store.dados;
    const emp = id ? estado.emprestimos[id] : null;

    document.getElementById('empIdEdit').value = id || '';
    document.getElementById('empPessoa').value = emp ? emp.pessoa : '';
    document.getElementById('empValor').value = emp ? Number(emp.valor || 0).toFixed(2).replace('.', ',') : '';

    const campoData = document.getElementById('empData');
    if (campoData) campoData.value = emp?.data || hojeISO();

    const campoObs = document.getElementById('empObs');
    if (campoObs) campoObs.value = emp?.obs || '';

    this.setEmpTipo(emp?.tipo || 'emprestei');

    const titulo = document.getElementById('tituloModalEmp');
    if (titulo) titulo.textContent = emp ? '✏️ Editar Empréstimo' : '🤝 Novo Empréstimo';

    window.APP.abrirModal('modalEmprestimo');
  },

  async salvar() {
    if (!store.dbRef) return alert('Faça login antes de salvar o empréstimo.');

    const estado = store.dados;
    const id = document.getElementById('empIdEdit').value;
    const pessoa = document.getElementById('empPessoa').value.trim();
    const valor = parseMoeda(document.getElementById('empValor').value);
    const data = document.getElementById('empData')?.value || hojeISO();
    const obs = document.getElementById('empObs')?.value.trim() || '';

    if (!pessoa || valor <= 0 || !data) {
      return alert('Preencha o nome, um valor válido e a data.');
    }

    try {
      if (id) {
        const atual = estado.emprestimos[id];
        if (!atual) return alert('Este empréstimo não existe mais.');
        await update(store.dbRef, {
          [`emprestimos/${id}`]: { ...atual, pessoa, valor, data, obs, tipo: empTipoAtual }
        });
      } else {
        const novoId = gerarId('e');
        await update(store.dbRef, {
          [`emprestimos/${novoId}`]: { pessoa, valor, data, obs, tipo: empTipoAtual, pago: 0 }
        });
      }
      window.APP.fecharModal('modalEmprestimo');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  },

  async excluir(id) {
    if (!confirm('Excluir este empréstimo e todos os pagamentos?')) return;
    if (!store.dbRef) return alert('Faça login antes de excluir o empréstimo.');

    try {
      const estado = store.dados;
      if (!estado.emprestimos[id]) return;

      const updates = { [`emprestimos/${id}`]: null };
      Object.entries(estado.pagamentosEmprestimo || {}).forEach(([pid, p]) => {
        if (p.empId === id) updates[`pagamentosEmprestimo/${pid}`] = null;
      });

      await update(store.dbRef, updates);

      const historicoModal = document.getElementById('modalHistoricoEmp');
      if (historicoModal?.classList.contains('open')) {
        window.APP.fecharModal('modalHistoricoEmp');
      }
    } catch (error) {
      alert('Erro: ' + error.message);
    }
  },

  abrirPagamento(id) {
    const emp = store.dados.emprestimos[id];
    if (!emp) return;

    const falta = Math.max(0, Number(emp.valor || 0) - Number(emp.pago || 0));
    document.getElementById('pagEmpId').value = id;
    document.getElementById('pagInfo').textContent = `${emp.pessoa} • Falta: ${brl(falta)}`;

    const campoData = document.getElementById('pagData');
    if (campoData) campoData.value = hojeISO();

    const campoValor = document.getElementById('pagValor');
    if (campoValor) campoValor.value = '';

    window.APP.abrirModal('modalPagamento');
  },

  async salvarPagamento() {
    if (!store.dbRef) return alert('Faça login antes de registrar o pagamento.');

    const estado = store.dados;
    const empId = document.getElementById('pagEmpId').value;
    const valor = parseMoeda(document.getElementById('pagValor').value);
    const data = document.getElementById('pagData')?.value || hojeISO();
    const conta = document.getElementById('pagConta')?.value || '';
    const emp = estado.emprestimos[empId];

    if (!emp) return alert('Empréstimo não encontrado.');
    if (valor <= 0 || !data) return alert('Informe um valor e uma data válidos.');

    const pagoAtual = Number(emp.pago || 0);
    const novoPago = Math.min(Number(emp.valor || 0), pagoAtual + valor);
    const pagId = gerarId('p');

    const updates = {
      [`pagamentosEmprestimo/${pagId}`]: {
        empId,
        valor,
        data,
        ...(conta ? { conta } : {})
      },
      [`emprestimos/${empId}/pago`]: novoPago
    };

    if (conta) {
      const txId = gerarId('t');
      const ehRecebimento = emp.tipo === 'emprestei';
      updates[`transacoes/${txId}`] = {
        tipo: ehRecebimento ? 'entrada' : 'saida',
        desc: `${ehRecebimento ? 'Recebimento empréstimo' : 'Pagamento empréstimo'} — ${emp.pessoa}`,
        valor,
        data,
        conta,
        categoria: ehRecebimento ? 'Empréstimo recebido' : 'Empréstimo pago',
        criadoEm: Date.now()
      };
    }

    try {
      await update(store.dbRef, updates);
      window.APP.fecharModal('modalPagamento');
      this.verHistorico(empId);
    } catch (error) {
      alert('Erro ao registrar pagamento: ' + error.message);
    }
  },

  async excluirPagamento(empId, pagId, valor) {
    if (!confirm('Excluir este pagamento?')) return;
    if (!store.dbRef) return alert('Faça login antes de excluir o pagamento.');

    try {
      const emp = store.dados.emprestimos[empId];
      if (!emp) return;
      const novoPago = Math.max(0, Number(emp.pago || 0) - Number(valor || 0));

      await update(store.dbRef, {
        [`pagamentosEmprestimo/${pagId}`]: null,
        [`emprestimos/${empId}/pago`]: novoPago
      });

      this.verHistorico(empId);
    } catch (error) {
      alert('Erro ao excluir pagamento: ' + error.message);
    }
  },

  verHistorico(id) {
    const estado = store.dados;
    const emp = estado.emprestimos?.[id];
    if (!emp) {
      window.APP.fecharModal('modalHistoricoEmp');
      return;
    }

    const total = Number(emp.valor || 0);
    const pago = Number(emp.pago || 0);
    const falta = Math.max(0, total - pago);

    const pagamentos = Object.entries(estado.pagamentosEmprestimo || {})
      .filter(([, p]) => p.empId === id)
      .sort((a, b) => String(b[1].data || '').localeCompare(String(a[1].data || '')));

    let html = `
      <div style="margin-bottom:12px; padding:12px; background:var(--bg); border-radius:8px;">
        <b>${esc(emp.pessoa)}</b><br>
        <small>Total: ${brl(total)} • Pago: ${brl(pago)} • Falta: ${brl(falta)}</small>
        <br><small>Data: ${formatarDataBR(emp.data)}</small>
        ${emp.obs ? `<br><small>${esc(emp.obs)}</small>` : ''}
      </div>
    `;

    if (!pagamentos.length) {
      html += '<div class="empty">Nenhum pagamento registrado.</div>';
    } else {
      html += pagamentos.map(([pid, p]) => {
        const nomeConta = p.conta ? (estado.contas[p.conta]?.nome || 'Conta removida') : '';
        return `
          <div class="transacao">
            <div class="info">
              <div class="desc">💰 ${brl(p.valor)}</div>
              <div class="meta">${formatarDataBR(p.data)}${nomeConta ? ' • ' + esc(nomeConta) : ''}</div>
            </div>
            <button type="button" class="sm danger" onclick="APP.excluirPagamento('${esc(id)}','${esc(pid)}',${Number(p.valor)})">✕</button>
          </div>
        `;
      }).join('');
    }

    document.getElementById('historicoEmpContent').innerHTML = html;
    window.APP.abrirModal('modalHistoricoEmp');
  },

  renderResumoPainel(estado) {
    const el = document.getElementById('emprestimoResumo');
    if (!el) return;

    const emps = Object.values(estado.emprestimos || {});
    const abertos = emps.filter(e => Number(e.pago || 0) < Number(e.valor || 0));

    if (!abertos.length) {
      el.innerHTML = '<div class="empty">Nenhum empréstimo em aberto.</div>';
      return;
    }

    const aReceber = abertos
      .filter(e => e.tipo === 'emprestei')
      .reduce((acc, e) => acc + Math.max(0, Number(e.valor || 0) - Number(e.pago || 0)), 0);

    const aPagar = abertos
      .filter(e => e.tipo !== 'emprestei')
      .reduce((acc, e) => acc + Math.max(0, Number(e.valor || 0) - Number(e.pago || 0)), 0);

    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; gap:10px; font-size:0.9rem;">
        <div><span style="color:var(--muted);">A receber:</span><br><b style="color:var(--primary);">${brl(aReceber)}</b></div>
        <div style="text-align:right;"><span style="color:var(--muted);">A pagar:</span><br><b style="color:var(--danger);">${brl(aPagar)}</b></div>
      </div>
      <div class="hint">${abertos.length} empréstimo(s) em aberto.</div>
    `;
  },

  renderizar(estado) {
    this.renderResumoPainel(estado);

    const emps = Object.entries(estado.emprestimos || {}).map(([id, e]) => ({ id, ...e }));
    const abertos = emps
      .filter(e => Number(e.pago || 0) < Number(e.valor || 0))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

    const listaAbertos = document.getElementById('listaEmprestimos');
    if (listaAbertos) {
      listaAbertos.innerHTML = abertos.map(e => {
        const falta = Math.max(0, Number(e.valor || 0) - Number(e.pago || 0));
        return `
          <div class="emprestimo-card">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <b>${esc(e.pessoa)}</b>
              <span style="font-size:0.78rem; color:${e.tipo === 'emprestei' ? 'var(--primary)' : 'var(--danger)'};">
                ${e.tipo === 'emprestei' ? '💸 Emprestei' : '🤲 Peguei'}
              </span>
            </div>
            <small style="display:block; margin-bottom:4px;">${formatarDataBR(e.data)} • Total: ${brl(e.valor)}</small>
            ${e.obs ? `<small style="display:block; margin-bottom:6px; color:var(--muted);">${esc(e.obs)}</small>` : ''}
            <small style="display:block; margin-bottom:8px;">Falta: <b>${brl(falta)}</b></small>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              <button class="sm" type="button" onclick="APP.abrirPagamento('${esc(e.id)}')">💰 Pagar</button>
              <button class="sm sec" type="button" onclick="APP.verHistoricoEmprestimo('${esc(e.id)}')">📋 Histórico</button>
              <button class="sm sec" type="button" onclick="APP.abrirNovoEmprestimo('${esc(e.id)}')">✏️ Editar</button>
              <button class="sm danger" type="button" onclick="APP.excluirEmprestimo('${esc(e.id)}')">✕ Excluir</button>
            </div>
          </div>
        `;
      }).join('') || '<div class="empty">Nenhum empréstimo em aberto.</div>';
    }

    const quitados = emps
      .filter(e => Number(e.pago || 0) >= Number(e.valor || 0))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));

    const listaQuitados = document.getElementById('listaQuitados');
    if (listaQuitados) {
      listaQuitados.innerHTML = quitados.map(e => `
        <div class="emprestimo-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <b>${esc(e.pessoa)}</b>
            <span style="font-size:0.78rem; color:var(--primary);">✅ Quitado</span>
          </div>
          <small>${formatarDataBR(e.data)} • ${brl(e.valor)}</small>
          ${e.obs ? `<br><small style="color:var(--muted);">${esc(e.obs)}</small>` : ''}
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
            <button class="sm sec" type="button" onclick="APP.verHistoricoEmprestimo('${esc(e.id)}')">📋 Histórico</button>
            <button class="sm sec" type="button" onclick="APP.abrirNovoEmprestimo('${esc(e.id)}')">✏️ Editar</button>
            <button class="sm danger" type="button" onclick="APP.excluirEmprestimo('${esc(e.id)}')">✕ Excluir</button>
          </div>
        </div>
      `).join('') || '<div class="empty">Nenhum empréstimo quitado.</div>';
    }

    const pag = Object.entries(estado.pagamentosEmprestimo || {})
      .map(([id, p]) => ({ id, ...p }))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
      .slice(0, 15);

    const histEl = document.getElementById('historicoPagamentos');
    if (histEl) {
      histEl.innerHTML = pag.length ? pag.map(p => {
        const emp = estado.emprestimos[p.empId];
        if (!emp) return '';
        const conta = p.conta ? (estado.contas[p.conta]?.nome || 'Conta removida') : '—';
        const tipoL = emp.tipo === 'emprestei' ? 'Recebido' : 'Pago';
        return `
          <div class="transacao">
            <div class="info">
              <div class="desc">${esc(emp.pessoa)} — ${tipoL}</div>
              <div class="meta">${formatarDataBR(p.data)} • ${esc(conta)}</div>
            </div>
            <div class="valor">${brl(p.valor)}</div>
          </div>
        `;
      }).join('') : '<div class="empty">Nenhum pagamento registrado.</div>';
    }
  }
};