/* Junta os arquivos de src/ em um único HTML compatível com Artifacts: node leora/build.js */
'use strict';
const fs = require('fs'); const path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const ordem = ['core.js', 'engine.js', 'store.js', 'ui-base.js', 'ui-cadastros.js', 'ui-operacoes.js', 'ui-telas.js', 'ui-financeiro.js', 'ui-relatorios.js', 'demo.js', 'main.js'];
const js = ordem.map(f => `/* ---- ${f} ---- */\n` + src(f)).join('\n').replace(/<\/script/gi, '<\\/script');
const html = src('index.html').replace('/*__CSS__*/', () => src('styles.css')).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const out = path.join(__dirname, 'dist', 'leora-confeitaria.html');
fs.writeFileSync(out, html);
console.log('Gerado', out, (html.length / 1024).toFixed(0) + ' KB');
