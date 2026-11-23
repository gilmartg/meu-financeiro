export const esc = (s) => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const brl = (v) => {
  return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseMoeda = (s) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  if (!s) return 0;
  const limpo = String(s).replace(/R\$\s?/gi, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpo);
  return Number.isNaN(num) ? 0 : num;
};

export const hojeISO = () => new Date().toISOString().slice(0, 10);

export const formatarDataBR = (isoDate, opts = undefined) => {
  if (!isoDate) return '—';
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return d.toLocaleDateString('pt-BR', opts);
};

export const gerarId = (prefixo = 'id') => `${prefixo}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;

export function baixarArquivo(nomeArquivo, conteudo, mimeType) {
  const blob = new Blob([conteudo], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function hashPin(pin) {
  const str = 'fin2_salt::' + pin;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i);
    h |= 0;
  }
  return 'fb_' + Math.abs(h).toString(16) + '_' + str.length;
}