import './app.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { getDatabase, onValue, ref, set, update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

/*
 * Complemento de paridade do laboratório: preserva os atalhos e gráficos
 * experimentais e restaura recursos existentes no app oficial.
 */
const db = getDatabase(getApp());
const auth = getAuth(getApp());
const PIN_KEY = 'financas_pin_hash_v2';
let data = { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} };
let dataUnsubscribe;
let featureRef;

const el = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (value) => window.APP.brl(value);
const dateLabel = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '—';

function addField(parent, before, id, label, type = 'text', placeholder = '') {
  if (el(id)) return;
  const wrapper = document.createElement('div');
  const caption = document.createElement('label');
  caption.htmlFor = id;
  caption.textContent = label;
  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  if (type === 'text' && label.toLowerCase().includes('valor')) input.inputMode = 'decimal';
  input.placeholder = placeholder;
  wrapper.append(caption, input);
  parent.insertBefore(wrapper, before || null);
}

function ensureExpectedFields() {
  // O app.js utiliza estes campos durante a inicialização e os modais.
  const loanModal = el('modalEmprestimo');
  if (loanModal) {
    const content = loanModal.querySelector('.modal-content');
    const save = content?.querySelector('[onclick*="salvarEmprestimo"]');
    addField(content, save, 'empData', 'Data', 'date');
    addField(content, save, 'empObs', 'Observação (opcional)', 'text', 'Ex: pagar em 3x');
    if (!el('empTipoHint')) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.id = 'empTipoHint';
      const group = content.querySelector('.pill-group');
      group?.after(hint);
    }
  }
  const paymentModal = el('modalPagamento');
  if (paymentModal) {
    const content = paymentModal.querySelector('.modal-content');
    const save = content?.querySelector('[onclick*="salvarPagamento"]');
    addField(content, save, 'pagData', 'Data', 'date');
    if (!el('pagConta')) {
      const wrapper = document.createElement('div');
      const label = document.createElement('label');
      label.htmlFor = 'pagConta';
      label.textContent = 'Conta (opcional)';
      const select = document.createElement('select');
      select.id = 'pagConta';
      select.innerHTML = '<option value="">— Não registrar em conta —</option>';
      wrapper.append(label, select);
      content.insertBefore(wrapper, save || null);
    }
  }

  const config = el('tab-config');
  if (config && !el('labOfficialOptions')) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'labOfficialOptions';
    card.innerHTML = `
      <h2>🔐 Segurança e sessão</h2>
      <button type="button" class="sec" id="labChangePin">🔐 Alterar PIN (neste aparelho)</button>
      <button type="button" class="sec" id="labDisablePin">🔓 Desativar PIN (neste aparelho)</button>
      <p class="hint" id="inatCurrentLabel" style="text-align:center;color:var(--primary);font-weight:600;"></p>
      <button type="button" class="sec" id="labInactivity">⏱️ Configurar logout automático</button>
      <h2 style="margin-top:16px;">💾 Backup manual</h2>
      <button type="button" class="sec" id="labExportJson">📤 Exportar backup (JSON)</button>
      <button type="button" class="sec" id="labImportJson">📥 Importar backup (JSON)</button>
      <input type="file" id="labBackupFile" accept=".json,application/json" hidden>
      <h2 style="margin-top:16px;">📊 Exportar planilhas</h2>
      <button type="button" class="sec" id="labExportPayments">📋 Pagamentos (CSV)</button>
      <button type="button" class="sec" id="labExportTransactions">💸 Transações (CSV)</button>
      <h2 style="margin-top:16px;">🧹 Zerar dados</h2>
      <button type="button" class="danger" id="labClearData">⚠️ Zerar transações e empréstimos</button>`;
    config.append(card);
  }

  const panel = el('tab-painel');
  if (panel && !el('ultimasTransacoes')) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>📋 Últimas Transações</h2><div id="ultimasTransacoes"></div>';
    panel.append(card);
  }
  const entryTab = el('tab-nova');
  if (entryTab && !el('todasTransacoes')) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = '<h2>📋 Todas as Transações</h2><div id="todasTransacoes"></div>';
    entryTab.append(card);
  }
  const loansTab = el('tab-emprestimos');
  if (loansTab && !el('listaQuitados')) {
    const paid = document.createElement('div');
    paid.className = 'card';
    paid.innerHTML = '<h2>✅ Quitados</h2><div id="listaQuitados"></div>';
    loansTab.append(paid);
    const history = document.createElement('div');
    history.className = 'card';
    history.innerHTML = '<h2>📜 Histórico Geral de Pagamentos</h2><div id="historicoPagamentos"></div>';
    loansTab.append(history);
  }

  const tabbar = document.querySelector('.tabbar');
  if (tabbar && !tabbar.querySelector('[data-tab="contas"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'contas';
    button.setAttribute('aria-label', 'Contas');
    button.innerHTML = '🏦<br>Contas';
    button.addEventListener('click', () => window.APP.mudarTab('contas'));
    const newTab = tabbar.querySelector('[data-tab="nova"]');
    tabbar.insertBefore(button, newTab || null);
  }

  document.querySelectorAll('#timeoutOptions button').forEach((button) => {
    if (['600000', '1800000', '3600000'].includes(button.dataset.ms)) return;
    if (button.dataset.ms === '900000') {
      for (const [ms, label] of [['600000', '10 minutos'], ['1800000', '30 minutos'], ['3600000', '60 minutos']]) {
        const option = document.createElement('button');
        option.type = 'button';
        option.dataset.ms = ms;
        option.textContent = label;
        option.addEventListener('click', () => window.APP.inat.escolherTempo(Number(ms)));
        button.before(option);
      }
    }
  });

  el('labChangePin')?.addEventListener('click', () => window.APP.pin.configurarSetup());
  el('labDisablePin')?.addEventListener('click', () => {
    if (!confirm('Desativar o PIN neste aparelho? O app abrirá direto após o login.')) return;
    localStorage.setItem(PIN_KEY, 'SKIPPED');
    alert('PIN desativado neste aparelho.');
  });
  el('labInactivity')?.addEventListener('click', () => window.APP.inat.abrirConfig());
  el('labExportJson')?.addEventListener('click', () => window.APP.exportar());
  el('labImportJson')?.addEventListener('click', () => el('labBackupFile').click());
  el('labBackupFile')?.addEventListener('change', importBackup);
  el('labExportPayments')?.addEventListener('click', () => window.APP.exportarPagamentosCSV());
  el('labExportTransactions')?.addEventListener('click', () => window.APP.exportarTransacoesCSV());
  el('labClearData')?.addEventListener('click', () => window.APP.limparTudo());
}

function download(filename, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportTransactions() {
  const rows = [['Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Conta', 'Conta destino', 'Categoria']];
  Object.values(data.transacoes).sort((a, b) => String(b.data).localeCompare(String(a.data))).forEach((transaction) => {
    rows.push([
      transaction.data,
      transaction.tipo === 'entrada' ? 'Entrada' : transaction.tipo === 'saida' ? 'Saída' : 'Transferência',
      transaction.desc,
      Number(transaction.valor || 0).toFixed(2).replace('.', ','),
      data.contas[transaction.conta]?.nome || '',
      data.contas[transaction.contaDestino]?.nome || '',
      transaction.categoria || ''
    ]);
  });
  if (rows.length === 1) return alert('Nenhuma transação para exportar.');
  download(`transacoes_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

function exportPayments() {
  const rows = [['Data', 'Pessoa', 'Tipo', 'Valor (R$)', 'Conta']];
  Object.values(data.pagamentosEmprestimo).sort((a, b) => String(b.data).localeCompare(String(a.data))).forEach((payment) => {
    const loan = data.emprestimos[payment.empId];
    if (!loan) return;
    rows.push([payment.data, loan.pessoa, loan.tipo === 'emprestei' ? 'Recebido' : 'Pago', Number(payment.valor || 0).toFixed(2).replace('.', ','), data.contas[payment.conta]?.nome || '']);
  });
  if (rows.length === 1) return alert('Nenhum pagamento para exportar.');
  download(`pagamentos_${new Date().toISOString().slice(0, 10)}.csv`, '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

function importBackup(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || typeof backup !== 'object' || !backup.contas || !backup.transacoes) throw new Error('Arquivo de backup inválido.');
      if (!featureRef) throw new Error('Faça login antes de importar o backup.');
      if (!confirm('Isso vai SUBSTITUIR todos os dados da nuvem. Deseja continuar?')) return;
      await set(featureRef, {
        contas: backup.contas || {},
        transacoes: backup.transacoes || {},
        emprestimos: backup.emprestimos || {},
        pagamentosEmprestimo: backup.pagamentosEmprestimo || {},
        atalhos: backup.atalhos || {}
      });
      alert('✅ Backup restaurado!');
    } catch (error) {
      alert(`Não foi possível importar o backup: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function renderTransactions() {
  const list = Object.entries(data.transacoes).map(([id, transaction]) => ({ id, ...transaction }))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || (b.criadoEm || 0) - (a.criadoEm || 0));
  const markup = (items) => items.map((transaction) => {
    const amountClass = transaction.tipo === 'entrada' ? 'entrada' : transaction.tipo === 'saida' ? 'saida' : 'transf';
    const sign = transaction.tipo === 'entrada' ? '+' : transaction.tipo === 'saida' ? '−' : '↔';
    const accountName = data.contas[transaction.conta]?.nome || 'Conta removida';
    const target = transaction.contaDestino ? ` → ${esc(data.contas[transaction.contaDestino]?.nome || 'Conta removida')}` : '';
    return `<div class="transacao"><div class="info"><div class="desc">${esc(transaction.desc)}</div><div class="meta">${dateLabel(transaction.data)} · ${esc(accountName)}${target} · ${esc(transaction.categoria || '')}</div></div><span class="valor ${amountClass}">${sign} ${money(transaction.valor)}</span><button type="button" class="sm danger" aria-label="Excluir ${esc(transaction.desc)}" data-delete-transaction="${esc(transaction.id)}">🗑️</button></div>`;
  }).join('') || '<div class="empty">Nenhuma transação registrada.</div>';
  if (el('ultimasTransacoes')) el('ultimasTransacoes').innerHTML = markup(list.slice(0, 5));
  if (el('todasTransacoes')) el('todasTransacoes').innerHTML = markup(list);
  document.querySelectorAll('[data-delete-transaction]').forEach((button) => {
    button.onclick = () => window.APP.excluirTransacao(button.dataset.deleteTransaction);
  });
}

function renderLoans() {
  const loans = Object.entries(data.emprestimos).map(([id, loan]) => ({ id, ...loan }));
  const paidLoans = loans.filter(loan => Number(loan.pago || 0) >= Number(loan.valor || 0));
  if (el('listaQuitados')) {
    el('listaQuitados').innerHTML = paidLoans.map(loan => `<div class="emprestimo-card"><b>${esc(loan.pessoa)}</b><br><small>${loan.tipo === 'emprestei' ? 'Você emprestou' : 'Você pegou emprestado'} · Quitado · ${money(loan.valor)}</small><div style="margin-top:8px;"><button type="button" class="sm sec" data-loan-history="${esc(loan.id)}">📜 Histórico</button></div></div>`).join('') || '<div class="empty">Nenhum empréstimo quitado.</div>';
  }
  const payments = Object.values(data.pagamentosEmprestimo).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (el('historicoPagamentos')) {
    el('historicoPagamentos').innerHTML = payments.map(payment => {
      const loan = data.emprestimos[payment.empId];
      if (!loan) return '';
      return `<div class="transacao"><div class="info"><div class="desc">${esc(loan.pessoa)} · ${loan.tipo === 'emprestei' ? 'Recebido' : 'Pago'}</div><div class="meta">${dateLabel(payment.data)} · ${esc(data.contas[payment.conta]?.nome || 'Sem conta')}</div></div><span class="valor">${money(payment.valor)}</span></div>`;
    }).join('') || '<div class="empty">Nenhum pagamento registrado.</div>';
  }
  document.querySelectorAll('[data-loan-history]').forEach(button => {
    button.onclick = () => window.APP.verHistoricoEmprestimo(button.dataset.loanHistory);
  });
}

function renderExtra() {
  renderTransactions();
  renderLoans();
  window.APP.inat?.atualizarLabel?.();
}

function installFeatures() {
  ensureExpectedFields();
  const app = window.APP;
  if (!app || app.__labOfficialFeaturesInstalled) return;
  app.__labOfficialFeaturesInstalled = true;

  app.exportar = () => download(`financas_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
  app.exportarTransacoesCSV = exportTransactions;
  app.exportarPagamentosCSV = exportPayments;
  app.limparTudo = async () => {
    if (!featureRef) return alert('Faça login antes de apagar dados.');
    if (!confirm('Apagar TODAS as transações e empréstimos da nuvem?')) return;
    if (!confirm('Tem CERTEZA? Esta ação não pode ser desfeita.')) return;
    try {
      await update(featureRef, { transacoes: null, emprestimos: null, pagamentosEmprestimo: null });
      alert('Dados zerados.');
    } catch (error) {
      alert(`Erro ao apagar dados: ${error.message}`);
    }
  };

  const originalRender = app.renderizar;
  if (typeof originalRender === 'function') {
    app.renderizar = (...args) => {
      const result = originalRender.apply(app, args);
      renderExtra();
      return result;
    };
  }
  const originalOpenLoan = app.abrirNovoEmprestimo;
  if (typeof originalOpenLoan === 'function') {
    app.abrirNovoEmprestimo = (...args) => {
      const result = originalOpenLoan.apply(app, args);
      if (el('empData') && !el('empData').value) el('empData').value = new Date().toISOString().slice(0, 10);
      return result;
    };
  }
  renderExtra();
}

installFeatures();

onAuthStateChanged(auth, (user) => {
  if (dataUnsubscribe) dataUnsubscribe();
  dataUnsubscribe = null;
  featureRef = user ? ref(db, `usuarios/${user.uid}`) : null;
  if (!featureRef) {
    data = { contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} };
    renderExtra();
    return;
  }
  dataUnsubscribe = onValue(featureRef, (snapshot) => {
    const value = snapshot.val() || {};
    data = {
      contas: value.contas || {},
      transacoes: value.transacoes || {},
      emprestimos: value.emprestimos || {},
      pagamentosEmprestimo: value.pagamentosEmprestimo || {},
      atalhos: value.atalhos || {}
    };
    renderExtra();
  });
});
