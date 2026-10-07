# Página de vendas: Análise Estratégica de Perfil (A Mel do MKT)

## Arquivos

- `pagina-analise-estrategica.html`: a página completa. Abra no navegador para visualizar.
- `imagens/logo-a-mel-do-mkt.png`: logo oficial recortada, com fundo transparente, sem alteração de proporção.
- `imagens/foto-mel-topo.webp`, `imagens/foto-mel-ipad.webp` e `imagens/foto-mel-sobre.webp`: suas fotos otimizadas para a web (abertura, seção "Essa análise é para você que…" e seção sobre você).
- `imagens/abelha.png`: a abelhinha da própria logo, usada como detalhe em poucas seções.

## Como publicar no WordPress

1. Envie todos os arquivos da pasta `imagens` para **Mídia > Adicionar nova** e copie a URL de cada uma.
2. Crie uma página e escolha um modelo de **largura total / sem barra lateral** (o nome varia conforme o tema).
3. Adicione um bloco **HTML personalizado** (ou o widget HTML no Elementor).
4. No arquivo `.html`, copie tudo entre `INÍCIO` e `FIM` e cole no bloco.
5. Procure por `PENDENTE` e substitua:
   - `INSERIR-LINK-DE-PAGAMENTO` pelo link de pagamento (aparece em 5 botões; use "Substituir tudo").
   - `imagens/logo-a-mel-do-mkt.png`, `imagens/abelha.png`, `imagens/foto-mel-topo.webp`, `imagens/foto-mel-ipad.webp` e `imagens/foto-mel-sobre.webp` pelas URLs da Biblioteca de Mídia.
6. Para ativar um bloco pendente (informações operacionais, perguntas de agendamento e cancelamento, links do rodapé): preencha os campos, apague a linha que começa com `<!-- PENDENTE` e a linha `FIM DO BLOCO PENDENTE -->`.

Todo o estilo fica dentro da classe `.amm`, então não altera o restante do tema. A página não usa JavaScript; as perguntas frequentes abrem e fecham com recurso nativo do navegador.

## Escolhas que são sugestões

- **Títulos:** Playfair Display reta, com itálico só nas palavras de destaque (marcadas com `<em>` no código). Para mudar o destaque, basta mover o `<em>`.
- **Seção sobre você:** seguindo a referência, o título principal virou o seu nome e "Quem vai olhar para o seu perfil" ficou como chamada acima dele.
- **Fonte dos textos:** Clear Sans não está disponível no Google Fonts. A página usa Clear Sans se o tema já a carregar; caso contrário, usa **Source Sans 3**, que tem desenho parecido.
- **Cores extras:** vinho mais escuro para o botão ao passar o mouse (`#4f1420`), rosa médio para fundos e moldura da foto (`#f8d9eb`), rosa de borda (`#f1cfe3`) e um creme claro (`#fff8fb`). As quatro cores oficiais seguem como base.
- **Frase de introdução das situações:** "Talvez você se reconheça em alguma destas situações:", para não afirmar que a visitante passa por todas.
- **Resumo no bloco de preço:** quatro itens retirados da lista "O que está incluído".
