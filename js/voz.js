import { update } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js';
import { store } from './state.js';
import { parseMoeda, hojeISO, gerarId } from './utils.js';

export const vozApp = {
  recognition: null,
  ouvindo: false,

  iniciar() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('⚠️ Seu navegador não suporta reconhecimento de voz.\nUse o Chrome no Android ou no PC.');
      return;
    }
    if (this.ouvindo) return;

    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      this.ouvindo = true;
      document.getElementById('vozStatus').innerHTML = '🎙️ Ouvindo...<br><span style="font-size:0.8rem; color:var(--muted);">Fale o gasto e o valor.</span>';
      window.APP.abrirModal('modalVoz');
    };

    rec.onerror = (event) => {
      this.ouvindo = false;
      window.APP.fecharModal('modalVoz');
      if (event.error === 'not-allowed') {
        alert('⚠️ Permissão de microfone negada. Libere o microfone nas configurações do navegador.');
      } else if (event.error === 'no-speech') {
        alert('🤫 Não ouvi nada. Tente falar mais perto do microfone.');
      } else {
        alert('Erro no microfone: ' + event.error);
      }
    };

    rec.onend = () => {
      this.ouvindo = false;
      window.APP.fecharModal('modalVoz');
    };

    rec.onresult = (event) => {
      const textoFalado = event.results?.[0]?.[0]?.transcript || '';
      this.processarFala(textoFalado);
    };

    this.recognition = rec;
    rec.start();
  },

  processarFala(texto) {
    const matchValor = texto.match(/(\d+([.,]\d{1,2})?)/);
    if (!matchValor) {
      alert(`🎙️ Você disse: "${texto}"\n\n❌ Não consegui identificar o valor. Tente dizer: "Padaria 15 reais".`);
      return;
    }

    const valorStr = matchValor[0];
    const valor = parseMoeda(valorStr);

    let nome = texto
      .replace(valorStr, '')
      .replace(/\b(reais|real|gastei|paguei|no|na|de|do|da)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!nome) nome = 'Gasto por voz';
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);

    const lower = nome.toLowerCase();
    let categoria = 'Outros';
    if (/(pão|padaria|mercado|lanche|restaurante|café|almoço|jantar)/.test(lower)) categoria = 'Alimentação';
    else if (/(uber|gasolina|ônibus|onibus|metrô|metro|estacionamento|combustível)/.test(lower)) categoria = 'Transporte';
    else if (/(farmácia|farmacia|remédio|remedio|médico|medico)/.test(lower)) categoria = 'Saúde';
    else if (/(luz|água|agua|internet|aluguel|condomínio|condominio)/.test(lower)) categoria = 'Contas Fixas';

    document.getElementById('vozTexto').textContent = `"${texto}"`;
    document.getElementById('vozDesc').value = nome;
    document.getElementById('vozValor').value = valor.toFixed(2).replace('.', ',');
    document.getElementById('vozCat').value = categoria;

    window.APP.abrirModal('modalVozResult');
  },

  async salvar() {
    if (!store.dbRef) return alert('Faça login antes de salvar.');
    const desc = document.getElementById('vozDesc').value.trim();
    const valor = parseMoeda(document.getElementById('vozValor').value);
    const categoria = document.getElementById('vozCat').value;

    if (!desc || valor <= 0) return alert('Preencha descrição e valor válidos.');
    const contaId = Object.keys(store.dados.contas || {})[0];
    if (!contaId) return alert('Crie uma conta primeiro.');

    const id = gerarId('t');
    const tx = {
      tipo: 'saida',
      desc,
      valor,
      data: hojeISO(),
      conta: contaId,
      categoria,
      criadoEm: Date.now()
    };

    try {
      await update(store.dbRef, { [`transacoes/${id}`]: tx });
      window.APP.fecharModal('modalVozResult');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  }
};