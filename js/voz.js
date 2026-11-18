import { parseMoeda } from './utils.js';

export const vozApp = {
  recognition: null,
  ouvindo: false,

  iniciar: () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("⚠️ Seu navegador não suporta reconhecimento de voz.\nUse o Chrome no Android ou no PC.");
      return;
    }

    if (vozApp.ouvindo) return;

    vozApp.recognition = new SpeechRecognition();
    vozApp.recognition.lang = 'pt-BR';
    vozApp.recognition.interimResults = false;
    vozApp.recognition.maxAlternatives = 1;

    vozApp.recognition.onstart = () => {
      vozApp.ouvindo = true;
      document.getElementById('vozStatus').innerHTML = '🎙️ Ouvindo...<br><span style="font-size:0.8rem; color:var(--muted);">Fale o gasto e o valor.</span>';
      document.getElementById('modalVoz').classList.add('open');
    };

    vozApp.recognition.onerror = (event) => {
      vozApp.ouvindo = false;
      document.getElementById('modalVoz').classList.remove('open');
      if (event.error === 'not-allowed') {
        alert("⚠️ Permissão de microfone negada. Libere o microfone nas configurações do navegador.");
      } else if (event.error === 'no-speech') {
        alert("🤫 Não ouvi nada. Tente falar mais perto do microfone.");
      } else {
        alert("Erro no microfone: " + event.error);
      }
    };

    vozApp.recognition.onend = () => {
      vozApp.ouvindo = false;
      document.getElementById('modalVoz').classList.remove('open');
    };

    vozApp.recognition.onresult = (event) => {
      const textoFalado = event.results[0][0].transcript;
      vozApp.processarFala(textoFalado);
    };

    vozApp.recognition.start();
  },

  processarFala: (texto) => {
    // 1. Tenta achar o valor (números inteiros ou com vírgula/ponto)
    // Ex: "Padaria 15,50" -> pega o 15,50
    const matchValor = texto.match(/(\d+([.,]\d{1,2})?)/);

    if (!matchValor) {
      alert(`🎙️ Você disse: "${texto}"\n\n❌ Mas eu não consegui identificar o valor numérico. Tente dizer: "Padaria 15 reais".`);
      return;
    }

    const valorStr = matchValor[0];
    const valor = parseMoeda(valorStr);

    // 2. O nome é o texto inteiro, removendo o valor e palavras comuns
    let nome = texto.replace(valorStr, '')
                    .replace(/reais/gi, '')
                    .replace(/real/gi, '')
                    .replace(/gastei/gi, '')
                    .replace(/paguei/gi, '')
                    .replace(/no/gi, '')
                    .replace(/na/gi, '')
                    .trim();

    // Se o nome ficar vazio, usa "Gasto por voz"
    if (!nome) nome = "Gasto por voz";

    // Capitaliza a primeira letra
    nome = nome.charAt(0).toUpperCase() + nome.slice(1);

    // 3. Adivinha a categoria baseada em palavras-chave
    let categoria = 'Outros';
    const textoLower = nome.toLowerCase();
    if (textoLower.includes('pão') || textoLower.includes('padaria') || textoLower.includes('mercado') || textoLower.includes('lanche') || textoLower.includes('restaurante')) categoria = 'Alimentação';
    else if (textoLower.includes('uber') || textoLower.includes('gasolina') || textoLower.includes('ônibus') || textoLower.includes('metrô') || textoLower.includes('estacionamento')) categoria = 'Transporte';
    else if (textoLower.includes('farmácia') || textoLower.includes('remédio') || textoLower.includes('médico')) categoria = 'Saúde';
    else if (textoLower.includes('luz') || textoLower.includes('água') || textoLower.includes('internet') || textoLower.includes('aluguel')) categoria = 'Contas Fixas';

    // 4. Abre o modal de confirmação para o usuário ver o que foi entendido
    document.getElementById('vozTexto').innerHTML = texto;
    document.getElementById('vozDesc').value = nome;
    document.getElementById('vozValor').value = valor.toFixed(2).replace('.', ',');
    document.getElementById('vozCat').value = categoria;

    document.getElementById('modalVozResult').classList.add('open');
  },

  salvar: async () => {
    const desc = document.getElementById('vozDesc').value;
    const valor = parseMoeda(document.getElementById('vozValor').value);
    const categoria = document.getElementById('vozCat').value;

    if (valor <= 0) return alert('Valor inválido.');
    const contaId = Object.keys(window.APP.estado.contas)[0];
    if (!contaId) return alert('Crie uma conta primeiro.');

    const id = 't' + Date.now() + Math.random().toString(36).slice(2, 6); // ID garantido
    const t = { id, tipo: 'saida', desc, valor, data: new Date().toISOString().split('T')[0], conta: contaId, categoria, criadoEm: Date.now() };

    try {
      // Chama a função de salvar do app.js
      await window.APP.salvarDireto(t);
      document.getElementById('modalVozResult').classList.remove('open');
      alert('✅ Gasto salvo por voz!');
    } catch(e) { alert('Erro: ' + e.message); }
  }
};