// Configurações fixas do app.
export const CHARTJS_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm';

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
export const PIN_PULADO = 'SKIPPED';
export const INAT_KEY = 'financas_inat_timeout';
export const DEFAULT_INAT = 15 * 60 * 1000;

export const CATEGORIAS = {
  entrada: ['Salário', 'Freelance', 'Investimentos', 'Vendas', 'Reembolso', 'Empréstimo recebido', 'Outros'],
  saida: ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas Fixas', 'Empréstimo pago', 'Outros']
};

// Categorias oferecidas nos atalhos rápidos e na confirmação por voz.
export const CATEGORIAS_RAPIDAS = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Educação', 'Contas Fixas', 'Outros'];
