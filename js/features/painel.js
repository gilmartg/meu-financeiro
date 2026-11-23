// Aba Painel: saldo total, entradas/saídas do mês e resumo de empréstimos.
import { brl } from '../core/utils.js';
import { calcularSaldoTotal, totaisDoMes, resumoEmprestimos } from '../core/calculos.js';

const $ = (id) => document.getElementById(id);

export function atualizarMes() {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const hoje = new Date();
  $('mesAtual').textContent = `${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
}

export function renderizarPainel(estado) {
  const saldo = calcularSaldoTotal(estado);
  $('saldoTotalValor').textContent = brl(saldo);
  $('saldoTotalBox').classList.toggle('negativo', saldo < 0);

  const hoje = new Date();
  const { entradas, saidas } = totaisDoMes(estado, hoje.getFullYear(), hoje.getMonth());
  $('kpiEntradas').textContent = brl(entradas);
  $('kpiSaidas').textContent = brl(saidas);

  const { aReceber, aPagar, abertos } = resumoEmprestimos(estado);
  $('emprestimoResumo').innerHTML = abertos
    ? `<div class="kpi-grid">
         <div class="kpi-box pos"><b>${brl(aReceber)}</b><span>A receber</span></div>
         <div class="kpi-box neg"><b>${brl(aPagar)}</b><span>A pagar</span></div>
       </div>`
    : '<div class="empty">Nenhum empréstimo em aberto.</div>';
}
