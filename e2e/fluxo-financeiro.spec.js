import { test, expect } from '@playwright/test';
import { mockFirebaseCDN, loginEPularPin } from './helpers/firebase-mock.js';

test.describe('Meu Financeiro - Testes de Browser (E2E)', () => {
  test('deve carregar sem erros de console e realizar login pulando o PIN', async ({ page }) => {
    const erros = [];
    page.on('pageerror', (err) => erros.push(err.message));

    await mockFirebaseCDN(page);
    await loginEPularPin(page);

    await expect(page.locator('#authOverlay')).toBeHidden();
    await expect(page.locator('#saldoTotalValor')).toHaveText('R$ 1.200,00');
    expect(erros).toEqual([]);
  });

  test('deve lançar receita, despesa e transferência mantendo o saldo total consistente', async ({ page }) => {
    await mockFirebaseCDN(page);
    await loginEPularPin(page);

    // Vai para aba Nova Transação
    await page.click('.tabbar button[data-tab="nova"]');

    // 1. Lança uma saída de R$ 150,00 na primeira conta (Nubank: 1000 -> 850)
    await page.click('#tipoGroup button[data-tipo="saida"]');
    await page.fill('#novaDesc', 'Supermercado');
    await page.fill('#novaValor', '150,00');
    await page.click('#tab-nova button:has-text("Salvar Transação")');

    // 2. Faz transferência de R$ 200,00 de Nubank para Carteira (Nubank: 650, Carteira: 400)
    await page.click('#tipoGroup button[data-tipo="transferencia"]');
    await page.fill('#novaDesc', 'Saque PIX');
    await page.fill('#novaValor', '200,00');
    await page.selectOption('#novaConta', 'c1');
    await page.selectOption('#novaContaDestino', 'c2');
    await page.click('#tab-nova button:has-text("Salvar Transação")');

    // Volta ao Painel e valida saldos e KPIs
    await page.click('.tabbar button[data-tab="painel"]');
    await expect(page.locator('#saldoTotalValor')).toHaveText('R$ 1.050,00');
    await expect(page.locator('#kpiEntradas')).toHaveText('R$ 0,00');
    await expect(page.locator('#kpiSaidas')).toHaveText('R$ 150,00');
  });

  test('deve registrar gasto pelo Lançamento Rápido (Atalho)', async ({ page }) => {
    await mockFirebaseCDN(page);
    await loginEPularPin(page);

    await page.click('.tabbar button[data-tab="nova"]');
    await page.click('#quickGrid .quick-btn:has-text("Padaria")');

    await expect(page.locator('#modalQuickAdd')).toHaveClass(/open/);
    await page.fill('#quickValor', '18,50');
    await page.click('#modalQuickAdd button:has-text("Confirmar Pagamento")');

    await expect(page.locator('#modalQuickAdd')).not.toHaveClass(/open/);
    await expect(page.locator('#todasTransacoes')).toContainText('Padaria');
    await expect(page.locator('#todasTransacoes')).toContainText('18,50');
  });

  test('deve criar empréstimo, validar pagamento excedente e quitar', async ({ page }) => {
    await mockFirebaseCDN(page);
    await loginEPularPin(page);

    await page.click('.tabbar button[data-tab="emprestimos"]');
    await page.click('button:has-text("Novo Empréstimo")');

    await page.fill('#empPessoa', 'Carlos');
    await page.fill('#empValor', '300,00');
    await page.click('#modalEmprestimo button:has-text("Salvar")');

    await expect(page.locator('#listaEmprestimos')).toContainText('Carlos');
    await expect(page.locator('#listaEmprestimos')).toContainText('R$ 300,00');

    // Abre modal de pagamento e tenta pagar valor maior que o restante (R$ 400 > R$ 300)
    await page.click('#listaEmprestimos button:has-text("Pagar")');

    let mensagemDialog = '';
    page.once('dialog', async (dialog) => {
      mensagemDialog = dialog.message();
      await dialog.accept();
    });

    await page.fill('#pagValor', '400,00');
    await page.click('#modalPagamento button:has-text("Salvar Pagamento")');

    expect(mensagemDialog).toContain('O valor é maior que o que falta');

    // Agora paga o valor exato restante (R$ 300,00) para quitar
    await page.fill('#pagValor', '300,00');
    await page.click('#modalPagamento button:has-text("Salvar Pagamento")');

    await page.click('#modalHistoricoEmp button:has-text("Fechar")');
    await expect(page.locator('#listaQuitados')).toContainText('Carlos');
  });
});