// Backup (JSON), exportação CSV e "zerar dados".
import { getEstado, getDbRef } from '../core/store.js';
import { set, update } from '../core/firebase.js';
import { registrarAcoes } from '../core/acoes.js';
import { hojeISO } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

function baixar(nome, conteudo, mime) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const celula = (v) => {
  const t = String(v ?? '');
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const numeroCSV = (v) => Number(v || 0).toFixed(2).replace('.', ',');
const baixarCSV = (nome, linhas) =>
  baixar(nome, '﻿' + linhas.map(l => l.map(celula).join(';')).join('\r\n'), 'text/csv;charset=utf-8');

function exportarJSON() {
  baixar(`financas_backup_${hojeISO()}.json`, JSON.stringify(getEstado(), null, 2), 'application/json');
}

function exportarTransacoesCSV() {
  const { transacoes, contas } = getEstado();
  const linhas = [['Data', 'Tipo', 'Descrição', 'Valor (R$)', 'Conta', 'Conta destino', 'Categoria']];
  Object.values(transacoes).sort((a, b) => String(b.data).localeCompare(String(a.data))).forEach(t => {
    linhas.push([
      t.data,
      t.tipo === 'entrada' ? 'Entrada' : t.tipo === 'saida' ? 'Saída' : 'Transferência',
      t.desc, numeroCSV(t.valor),
      contas[t.conta]?.nome || '', contas[t.contaDestino]?.nome || '', t.categoria || ''
    ]);
  });
  if (linhas.length === 1) return alert('Nenhuma transação para exportar.');
  baixarCSV(`transacoes_${hojeISO()}.csv`, linhas);
}

function exportarPagamentosCSV() {
  const { pagamentosEmprestimo, emprestimos, contas } = getEstado();
  const linhas = [['Data', 'Pessoa', 'Tipo', 'Valor (R$)', 'Conta']];
  Object.values(pagamentosEmprestimo).sort((a, b) => String(b.data).localeCompare(String(a.data))).forEach(p => {
    const emp = emprestimos[p.empId];
    if (!emp) return;
    linhas.push([p.data, emp.pessoa, emp.tipo === 'emprestei' ? 'Recebido' : 'Pago', numeroCSV(p.valor), contas[p.conta]?.nome || '']);
  });
  if (linhas.length === 1) return alert('Nenhum pagamento para exportar.');
  baixarCSV(`pagamentos_${hojeISO()}.csv`, linhas);
}

function importarJSON(event) {
  const arquivo = event.target.files?.[0];
  event.target.value = '';
  if (!arquivo) return;

  const leitor = new FileReader();
  leitor.onload = async () => {
    try {
      const backup = JSON.parse(leitor.result);
      const chaves = ['contas', 'transacoes', 'emprestimos', 'pagamentosEmprestimo', 'atalhos'];
      if (!backup || typeof backup !== 'object' || !chaves.some(k => backup[k] && typeof backup[k] === 'object')) {
        throw new Error('Arquivo de backup inválido.');
      }
      const ref = getDbRef();
      if (!ref) throw new Error('Faça login antes de importar o backup.');
      if (!confirm('Isso vai SUBSTITUIR todos os dados da nuvem. Deseja continuar?')) return;
      await set(ref, Object.fromEntries(chaves.map(k => [k, backup[k] || {}])));
      alert('✅ Backup restaurado!');
    } catch (error) {
      alert(`Não foi possível importar o backup: ${error.message}`);
    }
  };
  leitor.readAsText(arquivo);
}

async function limparTudo() {
  const ref = getDbRef();
  if (!ref) return alert('Faça login antes de apagar dados.');
  if (!confirm('Apagar TODAS as transações e empréstimos da nuvem? Os saldos iniciais das contas também voltam a zero.')) return;
  if (!confirm('Tem CERTEZA? Esta ação não pode ser desfeita.')) return;

  const atualizacoes = { transacoes: null, emprestimos: null, pagamentosEmprestimo: null };
  Object.keys(getEstado().contas).forEach(id => { atualizacoes[`contas/${id}/saldoInicial`] = 0; });
  await update(ref, atualizacoes);
  alert('Dados zerados.');
}

export function iniciarBackup() {
  $('labBackupFile').addEventListener('change', importarJSON);
  registrarAcoes({
    'backup-exportar': exportarJSON,
    'backup-importar': () => $('labBackupFile').click(),
    'csv-transacoes': exportarTransacoesCSV,
    'csv-pagamentos': exportarPagamentosCSV,
    'dados-zerar': limparTudo
  });
}
