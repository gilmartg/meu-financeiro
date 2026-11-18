  salvarTransacao: async () => {
    const desc = document.getElementById('novaDesc').value.trim();
    const valor = parseMoeda(document.getElementById('novaValor').value);
    const conta = document.getElementById('novaConta').value;
    const contaDestino = document.getElementById('novaContaDestino').value;

    if (!desc || valor <= 0 || !conta || (tipoAtual === 'transferencia' && !contaDestino)) {
      return alert('Preencha todos os campos.');
    }

    if (tipoAtual === 'transferencia' && conta === contaDestino) {
      return alert('Escolha uma conta de destino diferente da conta de origem.');
    }

    const t = {
      tipo: tipoAtual,
      desc,
      valor,
      data: document.getElementById('novaData').value,
      conta,
      categoria: document.getElementById('novaCategoria').value,
      criadoEm: Date.now(),
      ...(tipoAtual === 'transferencia' && { contaDestino })
    };

    try {
      await update(APP.dbRef, { ['transacoes/t' + Date.now()]: t });

      document.getElementById('novaDesc').value = '';
      document.getElementById('novaValor').value = '';
      alert('✅ Salvo!');
    } catch (e) {
      alert('Erro: ' + e.message);
    }
  },