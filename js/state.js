import { db } from './firebase.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';

const estadoVazio = () => ({
  contas: {},
  transacoes: {},
  emprestimos: {},
  pagamentosEmprestimo: {},
  atalhos: {}
});

class EstadoStore {
  constructor() {
    this.dados = estadoVazio();
    this.dbRef = null;
    this._unsubscribe = null;
    this._listeners = new Set();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  notificar() {
    this._listeners.forEach(fn => {
      try {
        fn(this.dados);
      } catch (err) {
        console.error('Erro em listener de estado:', err);
      }
    });
  }

  conectarUsuario(uid) {
    this.desconectar();
    if (!uid) {
      this.dados = estadoVazio();
      this.notificar();
      return;
    }

    this.dbRef = ref(db, `usuarios/${uid}`);
    this._unsubscribe = onValue(
      this.dbRef,
      (snapshot) => {
        const val = snapshot.val() || {};
        this.dados = {
          contas: val.contas || {},
          transacoes: val.transacoes || {},
          emprestimos: val.emprestimos || {},
          pagamentosEmprestimo: val.pagamentosEmprestimo || {},
          atalhos: val.atalhos || {}
        };
        this.notificar();
      },
      (error) => {
        console.error('Erro ao sincronizar dados:', error);
        alert(`Não foi possível carregar os dados: ${error.message}`);
      }
    );
  }

  desconectar() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.dbRef = null;
    this.dados = estadoVazio();
  }
}

export const store = new EstadoStore();