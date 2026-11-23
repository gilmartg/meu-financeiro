// Regras de negócio puras (sem DOM, sem Firebase) — fáceis de testar.
import { arred2 } from './utils.js';

/** Saldo = saldo inicial + entradas − saídas ± transferências. */
export function calcularSaldoConta(estado, contaId) {
  let saldo = Number(estado.contas?.[contaId]?.saldoInicial) || 0;
  for (const t of Object.values(estado.transacoes || {})) {
    const valor = Number(t.valor) || 0;
    if (t.tipo === 'entrada' && t.conta === contaId) saldo += valor;
    else if (t.tipo === 'saida' && t.conta === contaId) saldo -= valor;
    else if (t.tipo === 'transferencia') {
      if (t.conta === contaId) saldo -= valor;
      if (t.contaDestino === contaId) saldo += valor;
    }
  }
  return arred2(saldo);
}

export function calcularSaldoTotal(estado) {
  return arred2(Object.keys(estado.contas || {}).reduce((s, id) => s + calcularSaldoConta(estado, id), 0));
}

/** Entradas e saídas de um mês (transferências não contam). mes: 0-11 */
export function totaisDoMes(estado, ano, mes) {
  let entradas = 0, saidas = 0;
  for (const t of Object.values(estado.transacoes || {})) {
    if (!t.data) continue;
    const [a, m] = t.data.split('-').map(Number);
    if (a !== ano || m - 1 !== mes) continue;
    if (t.tipo === 'entrada') entradas += Number(t.valor) || 0;
    if (t.tipo === 'saida') saidas += Number(t.valor) || 0;
  }
  return { entradas: arred2(entradas), saidas: arred2(saidas) };
}

export const faltaDoEmprestimo = (e) => arred2(Math.max(0, (Number(e.valor) || 0) - (Number(e.pago) || 0)));
export const estaQuitado = (e) => (Number(e.pago) || 0) >= (Number(e.valor) || 0);

/** Quanto ainda vão me pagar e quanto eu ainda devo. */
export function resumoEmprestimos(estado) {
  let aReceber = 0, aPagar = 0, abertos = 0;
  for (const e of Object.values(estado.emprestimos || {})) {
    if (estaQuitado(e)) continue;
    abertos++;
    if (e.tipo === 'emprestei') aReceber += faltaDoEmprestimo(e);
    else aPagar += faltaDoEmprestimo(e);
  }
  return { aReceber: arred2(aReceber), aPagar: arred2(aPagar), abertos };
}
