import { set, update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { store } from './state.js';
import { baixarArquivo, hojeISO } from './utils.js';

function csvCell(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const backupApp = {
  exportarJSON() {
    baixarArquivo(
      `financas_backup_${hojeISO()}.json`,
      JSON.stringify(store.dados, null, 2),
      'application/json'
    );
  },

  importarJSON(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup || typeof backup !== 'object' || !backup.contas || !backup.transacoes) {
          throw new Error('Arquivo de backup inválido.');
        }
        if (!store.dbRef) throw new Error('Faça login antes de importar o backup.');
        if (!confirm('Isso vai SUBSTITUIR os dados atuais na nuvem. Deseja continuar?')) return;

        await set(store.dbRef, {
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
  },

  exportarTransacoesCSV() {
    const { contas, transacoes } = store.dados;
    const rows = [['Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Conta', 'Conta destino', 'Categoria']];

    Object.values(transacoes || {})
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
      .forEach(t => {
        const tipoLabel = t.tipo === 'entrada' ? 'Entrada' : t.tipo === 'saida' ? 'Saída' : 'Transferência';
        rows.push([
          t.data || '',
          tipoLabel,
          t.desc || '',
          Number(t.valor || 0).toFixed(2).replace('.', ','),
          contas[t.conta]?.nome || '',
          contas[t.contaDestino]?.nome || '',
          t.categoria || ''
        ]);
      });

    if (rows.length === 1) return alert('Nenhuma transação para exportar.');
    baixarArquivo(
      `transacoes_${hojeISO()}.csv`,
      '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'),
      'text/csv;charset=utf-8'
    );
  },

  exportarPagamentosCSV() {
    const { contas, emprestimos, pagamentosEmprestimo } = store.dados;
    const rows = [['Data', 'Pessoa', 'Tipo', 'Valor (R$)', 'Conta']];

    Object.values(pagamentosEmprestimo || {})
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
      .forEach(p => {
        const emp = emprestimos[p.empId];
        if (!emp) return;
        rows.push([
          p.data || '',
          emp.pessoa || '',
          emp.tipo === 'emprestei' ? 'Recebido' : 'Pago',
          Number(p.valor || 0).toFixed(2).replace('.', ','),
          contas[p.conta]?.nome || ''
        ]);
      });

    if (rows.length === 1) return alert('Nenhum pagamento para exportar.');
    baixarArquivo(
      `pagamentos_${hojeISO()}.csv`,
      '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'),
      'text/csv;charset=utf-8'
    );
  },

  async limparTudo() {
    if (!store.dbRef) return alert('Faça login antes de apagar dados.');
    if (!confirm('Apagar TODAS as transações e empréstimos da nuvem?')) return;
    if (!confirm('Tem CERTEZA? Esta ação não pode ser desfeita.')) return;

    try {
      const contasZeradas = {};
      Object.entries(store.dados.contas || {}).forEach(([id, conta]) => {
        contasZeradas[id] = { ...conta, saldoInicial: 0 };
      });

      await update(store.dbRef, {
        contas: contasZeradas,
        transacoes: null,
        emprestimos: null,
        pagamentosEmprestimo: null
      });
      alert('Dados zerados.');
    } catch (error) {
      alert(`Erro ao apagar dados: ${error.message}`);
    }
  }
};