// Lançamento por voz (Web Speech API). Ex.: "Padaria 15 reais".
import { parseMoeda, moedaParaInput } from '../core/utils.js';
import { registrarAcoes } from '../core/acoes.js';
import { abrirModal, fecharModal } from '../ui/modal.js';
import { lancarSaida } from './transacoes.js';

const $ = (id) => document.getElementById(id);

let reconhecimento = null;
let ouvindo = false;

// Palavras de "ruído" removidas do nome — só quando são palavras inteiras
// (antes "na" apagava o final de "gasolina" e "no" o meio de "cinema").
const RUIDO = ['reais', 'real', 'gastei', 'paguei', 'comprei', 'no', 'na', 'de', 'com'];
const REGEX_RUIDO = new RegExp(`(?<![\\p{L}\\p{N}])(?:${RUIDO.join('|')})(?![\\p{L}\\p{N}])`, 'giu');

const CATEGORIAS_POR_PALAVRA = [
  ['Alimentação', ['pão', 'pao', 'padaria', 'mercado', 'lanche', 'restaurante', 'almoço', 'jantar', 'café', 'ifood']],
  ['Transporte', ['uber', 'gasolina', 'ônibus', 'onibus', 'metrô', 'metro', 'estacionamento', '99']],
  ['Saúde', ['farmácia', 'farmacia', 'remédio', 'remedio', 'médico', 'medico']],
  ['Contas Fixas', ['luz', 'água', 'agua', 'internet', 'aluguel']]
];

export function interpretarFala(texto) {
  const m = texto.match(/\d+(?:[.,]\d{1,2})?/);
  if (!m) return null;
  const valor = parseMoeda(m[0]);

  let nome = texto.replace(m[0], ' ').replace(REGEX_RUIDO, ' ').replace(/\s+/g, ' ').trim();
  if (!nome) nome = 'Gasto por voz';
  nome = nome.charAt(0).toUpperCase() + nome.slice(1);

  const minusculo = nome.toLowerCase();
  const achada = CATEGORIAS_POR_PALAVRA.find(([, palavras]) =>
    palavras.some(p => new RegExp(`(?<![\\p{L}\\p{N}])${p}(?![\\p{L}\\p{N}])`, 'iu').test(minusculo)));
  return { nome, valor, categoria: achada ? achada[0] : 'Outros' };
}

function iniciar() {
  const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecimento) {
    return alert('⚠️ Seu navegador não suporta reconhecimento de voz.\nUse o Chrome no Android ou no PC.');
  }
  if (ouvindo) return;

  reconhecimento = new Reconhecimento();
  reconhecimento.lang = 'pt-BR';
  reconhecimento.interimResults = false;
  reconhecimento.maxAlternatives = 1;

  reconhecimento.onstart = () => {
    ouvindo = true;
    $('vozStatus').innerHTML = '🎙️ Ouvindo...<br><span style="font-size:0.8rem; color:var(--muted);">Fale o gasto e o valor.</span>';
    abrirModal('modalVoz');
  };
  reconhecimento.onerror = (event) => {
    ouvindo = false;
    fecharModal('modalVoz');
    if (event.error === 'not-allowed') alert('⚠️ Permissão de microfone negada. Libere o microfone nas configurações do navegador.');
    else if (event.error === 'no-speech') alert('🤫 Não ouvi nada. Tente falar mais perto do microfone.');
    else if (event.error !== 'aborted') alert('Erro no microfone: ' + event.error);
  };
  reconhecimento.onend = () => { ouvindo = false; fecharModal('modalVoz'); };
  reconhecimento.onresult = (event) => processarFala(event.results[0][0].transcript);

  reconhecimento.start();
}

function processarFala(texto) {
  const r = interpretarFala(texto);
  if (!r) {
    return alert(`🎙️ Você disse: "${texto}"\n\n❌ Não consegui identificar o valor. Tente dizer: "Padaria 15 reais".`);
  }
  $('vozTexto').textContent = texto; // textContent: o texto vem do microfone, nunca como HTML
  $('vozDesc').value = r.nome;
  $('vozValor').value = moedaParaInput(r.valor);
  $('vozCat').value = r.categoria;
  abrirModal('modalVozResult');
}

async function salvar() {
  const desc = $('vozDesc').value.trim() || 'Gasto por voz';
  const valor = parseMoeda($('vozValor').value);
  if (valor <= 0) return alert('Valor inválido.');
  await lancarSaida({ desc, valor, categoria: $('vozCat').value });
  fecharModal('modalVozResult');
  alert('✅ Gasto salvo por voz!');
}

export function iniciarVoz() {
  registrarAcoes({ 'voz-iniciar': iniciar, 'voz-salvar': salvar });
}
