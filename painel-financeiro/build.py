#!/usr/bin/env python3
"""Junta os arquivos de src/ em um único painel.html para publicar como Artifact."""
import pathlib

root = pathlib.Path(__file__).parent
src = root / 'src'
css = (src / 'style.css').read_text(encoding='utf-8')
js = '\n'.join((p.read_text(encoding='utf-8')) for p in sorted(src.glob('*.js')))
html = f"""<title>Finanças da Mel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap">
<style>
{css}
</style>
<div id="app"></div>
<script>
"use strict";
{js}
</script>
"""
out = root / 'painel.html'
out.write_text(html, encoding='utf-8')
print(out, len(html), 'bytes')
