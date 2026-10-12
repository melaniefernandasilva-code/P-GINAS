# Finanças da Mel

Painel financeiro pessoal e profissional publicado como Artifact no Claude.

- `src/`: código-fonte (motor de cálculo em `03-engine.js`, ações em `04-actions.js`, telas nos demais arquivos).
- `python3 build.py`: gera `painel.html`, o arquivo publicado.
- `node tests/engine.test.js`: testes dos cálculos (transferências, cartões, Pix no crédito, contratos, dívidas, reservas, CSV, simulação, backup).

Os dados ficam no armazenamento do Artifact (área privada do usuário), com cópia no navegador. Backup completo em JSON e exportação CSV pelo próprio painel.
