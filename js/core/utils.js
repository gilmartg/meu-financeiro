// Funções puras de formatação, datas e valores. Sem acesso a DOM nem Firebase.

export const esc = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
// Intl usa espaço não separável após "R$"; trocamos por espaço comum.
export const brl = (v) => formatadorBRL.format(Number(v) || 0).replace(/\s/g, ' ');

// Evita erros de ponto flutuante (0.1 + 0.2) em somas de dinheiro.
export const arred2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Converte texto digitado/falado em número.
 * "1.500,50" -> 1500.5 | "15,5" -> 15.5 | "15.50" -> 15.5 | "1.500" -> 1500
 */
export const parseMoeda = (s) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (!s) return 0;
  let c = String(s).replace(/R\$\s?/g, '').replace(/\s/g, '').trim();
  if (c.includes(',')) {
    c = c.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(c)) {
    c = c.replace(/\./g, ''); // só milhares: 1.500
  }
  const n = parseFloat(c);
  return Number.isFinite(n) ? n : 0;
};

// Valor para preencher um input de dinheiro: 15.5 -> "15,50"
export const moedaParaInput = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

// ---- Datas (sempre no fuso local; toISOString() usa UTC e erra o dia à noite no Brasil) ----
const doisDigitos = (n) => String(n).padStart(2, '0');

export const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
};

export const dataLocal = (iso) => (iso ? new Date(`${iso}T12:00:00`) : null);

export const formatarData = (iso, opcoes) => {
  const d = dataLocal(iso);
  if (!d || isNaN(d)) return 'Sem data';
  return d.toLocaleDateString('pt-BR', opcoes);
};

export const novoId = (prefixo) => `${prefixo}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

export const porDataDesc = (a, b) => String(b || '').localeCompare(String(a || ''));

export async function hashPin(pin) {
  const str = 'fin2_salt::' + pin;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) { /* cai no fallback */ }
  }
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; }
  return 'fb_' + Math.abs(h).toString(16) + '_' + str.length;
}
