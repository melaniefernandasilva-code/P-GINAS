# LEORA Confeitaria Artesanal — sistema de gestão

Precificação, estoque por lote, produção, vendas diárias, financeiro, metas e relatórios.

## Abrir

- **No Claude (versão principal):** https://claude.ai/artifact/EHpKky8pU3ea8X4DBMpKVh
  Abra com a mesma conta no celular ou no computador. Os registros ficam no armazenamento do próprio Artifact e aparecem nos dois aparelhos.
- **Fora do Claude:** abra `dist/leora-confeitaria.html` no navegador. Nesse caso os dados ficam só naquele navegador. Use o backup em JSON para levar os dados de um lugar para o outro.

## Primeiros passos

1. **Configurações e backup › Geral:** valor da sua hora, tarifa de energia (R$/kWh), margem desejada, início e saldo inicial.
2. **Configurações:** formas de pagamento (Pix, crédito…), canais (WhatsApp, iFood…) com as taxas do seu contrato e o forno (potência, pré-aquecimento).
3. **Compras e ingredientes:** cadastre ingredientes e embalagens, depois os conjuntos de embalagem (armazenamento e venda).
4. **Produtos e receitas:** produto › sabores e tamanhos (peso, validade do assado, embalagem de venda, assamento, preços). Depois a receita base e a receita de cada sabor, com o rendimento real.
5. **Metas e calendário:** meta do mês, folgas e a mistura planejada de vendas.

## Rotina

Pela tela inicial: **Registrar compra → Produzir massa → Registrar fornada** (a opção "registrar a venda em seguida" já abre a venda) **→ Registrar venda**. Despesas em **Lançar despesa**; repasses em **Vendas diárias › Recebimentos**.

## Desenvolvimento

- Código em `src/` (`core.js` e `engine.js` têm os cálculos e não dependem da tela).
- `node build.js` gera `dist/leora-confeitaria.html` (arquivo único usado no Artifact).
- `node --test tests/engine.test.js` roda os exemplos calculáveis (conversões, custo por receita, margem × acréscimo, taxas, compra parcelada, produção/fornada/venda sem baixa dupla, combo, perdas, histórico de custos, repasses, energia/gás, metas, recuperação do investimento, backup).
