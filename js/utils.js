export const esc = (s) => {
  if (s == null) return '';
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
};

export const brl = (v) => {
  return 'R$ ' + (Number(v)||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
};

export const parseMoeda = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  const c = String(s).replace(/R\$\s?/g,'').replace(/\./g,'').replace(',','.').trim();
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};

export async function hashPin(pin) {
  const str = 'fin2_salt::' + pin;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(e) {}
  }
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h |= 0; }
  return 'fb_' + Math.abs(h).toString(16) + '_' + str.length;
}