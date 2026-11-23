// Estado central do app: dados do usuário + referência do banco.
// Quem precisa dos dados lê daqui; quem quer reagir a mudanças usa aoMudar().
import { update } from './firebase.js';

const estadoVazio = () => ({ contas: {}, transacoes: {}, emprestimos: {}, pagamentosEmprestimo: {}, atalhos: {} });

let estado = estadoVazio();
let dbRef = null;
const ouvintes = new Set();

export const getEstado = () => estado;
export const getDbRef = () => dbRef;
export const temSessao = () => !!dbRef;

export function definirRef(ref) { dbRef = ref; }

export function definirDados(dados = {}) {
  estado = {
    contas: dados.contas || {},
    transacoes: dados.transacoes || {},
    emprestimos: dados.emprestimos || {},
    pagamentosEmprestimo: dados.pagamentosEmprestimo || {},
    atalhos: dados.atalhos || {}
  };
  ouvintes.forEach(fn => fn(estado));
}

export function limparEstado() { definirDados({}); }

export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

/** Grava vários caminhos de uma vez (valor null apaga). */
export async function gravar(atualizacoes) {
  if (!dbRef) throw new Error('Faça login antes de continuar.');
  await update(dbRef, atualizacoes);
}
