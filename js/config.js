export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyBd6HByBm8ZS8o9t_IrzFV_eSWWqLKPOqY",
    authDomain: "bolao-2a310.firebaseapp.com",
    databaseURL: "https://bolao-2a310-default-rtdb.firebaseio.com",
    projectId: "bolao-2a310",
    storageBucket: "bolao-2a310.firebasestorage.app",
    messagingSenderId: "89102406302",
    appId: "1:89102406302:web:739c1fdbf536449814a18f"
  }
};

export const PIN_KEY = 'financas_pin_hash_v2';
export const INAT_KEY = 'financas_inat_timeout';
export const DEFAULT_INAT = 15 * 60 * 1000;

export const TIMEOUT_OPCOES = [
  { ms: 300000, label: '5 minutos' },
  { ms: 600000, label: '10 minutos' },
  { ms: 900000, label: '15 minutos' },
  { ms: 1800000, label: '30 minutos' },
  { ms: 3600000, label: '60 minutos' },
  { ms: 0, label: '🚫 Nunca' }
];

export const CATEGORIAS = {
  entrada: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Reembolso', 'Empréstimo recebido', 'Outros'],
  saida: ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas Fixas', 'Empréstimo pago', 'Outros']
};

export const CATEGORIAS_GERAIS = [
  'Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas Fixas', 'Outros'
];