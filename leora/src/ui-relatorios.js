/* LEORA — relatórios, exportações (CSV, PDF, impressão), configurações, backup e demonstração. */
(function (L) {
  'use strict';
  const UI = L.UI; const esc = UI.esc; const F = UI.forms; const N = L.num; const V = UI.views;
  const D = () => UI.D(); const S = () => UI.S();
  const topo = (t, extra) => `<div class="topo"><div><div class="eyebrow">${esc(L.fmtBR(L.hoje()))}</div><h1>${esc(t)}</h1></div><div class="row">${extra || ''}</div></div>`;
  UI.pg.rel = { modo: 'mes', ym: null, de: '', ate: '', canalId: '', categoria: '', produtoId: '', sabor: '', tamanho: '', tipo: '' };
  const fimMes = ym => ym + '-' + String(L.diasNoMes(ym)).padStart(2, '0');
  function periodo() {
    const r = UI.pg.rel; const ym = r.ym || L.hoje().slice(0, 7);
    if (r.modo === 'intervalo' && r.de && r.ate && r.de <= r.ate) return { de: r.de, ate: r.ate, nome: `${L.fmtBR(r.de)} a ${L.fmtBR(r.ate)}` };
    return { de: ym + '-01', ate: fimMes(ym), nome: L.nomeMes(ym) };
  }
  function filtros() { const r = UI.pg.rel; return { canalId: r.canalId, categoria: r.categoria, produtoId: r.produtoId, sabor: r.sabor, tamanho: r.tamanho, tipo: r.tipo }; }
  const temFiltro = f => Object.values(f).some(Boolean);

  // ---------- agregações ----------
  function rankings(R) {
    const d = D();
    const g = { sabor: {}, tamanho: {}, variante: {}, combo: {}, canal: {} };
    const add = (mapa, k, nome, campos) => { const x = mapa[k] = mapa[k] || { nome, unAvulsas: 0, unCombos: 0, combos: 0, receita: 0, taxas: 0, custo: 0 }; for (const [c, v] of Object.entries(campos)) x[c] += v; };
    for (const x of R.linhas) {
      const ln = x.ln; const custo = ln.custo.m + ln.custo.e;
      const canal = d.canais[x.canalId] || { nome: '?' };
      add(g.canal, x.canalId, canal.nome, { receita: x.receita, taxas: x.taxas, custo, unAvulsas: ln.tipo === 'v' ? ln.qtd : 0, unCombos: ln.tipo === 'c' ? ln.unidades : 0, combos: ln.tipo === 'c' ? ln.qtd : 0 });
      if (ln.tipo === 'c') {
        add(g.combo, ln.refId, (d.combos[ln.refId] || {}).nome || '?', { combos: ln.qtd, unCombos: ln.unidades, receita: x.receita, taxas: x.taxas, custo });
        for (const c of ln.composicao) { const v = d.variantes[c.varianteId] || {}; add(g.sabor, v.sabor || '?', v.sabor || '?', { unCombos: c.qtd }); add(g.tamanho, v.tamanho || '?', v.tamanho || '?', { unCombos: c.qtd }); add(g.variante, c.varianteId, L.nomeVariante(d, c.varianteId), { unCombos: c.qtd }); }
      } else {
        const v = d.variantes[ln.refId] || {};
        const campos = { unAvulsas: ln.qtd, receita: x.receita, taxas: x.taxas, custo };
        add(g.sabor, v.sabor || '?', v.sabor || '?', campos); add(g.tamanho, v.tamanho || '?', v.tamanho || '?', campos); add(g.variante, ln.refId, L.nomeVariante(d, ln.refId), campos);
      }
    }
    const fin = m => Object.values(m).map(x => Object.assign(x, { contrib: x.receita - x.taxas - x.custo, margem: x.receita > 0 ? (x.receita - x.taxas - x.custo) / x.receita : 0 }));
    return { sabor: fin(g.sabor), tamanho: fin(g.tamanho), variante: fin(g.variante), combo: fin(g.combo), canal: fin(g.canal) };
  }
  function comparativo(n) {
    const d = D(); const out = []; const f = filtros();
    for (let i = n - 1; i >= 0; i--) {
      const ym = L.addMesYM(L.hoje().slice(0, 7), -i);
      const R = L.resultado(d, ym + '-01', fimMes(ym), f);
      out.push({ ym, R, caixa: L.saldoCaixa(d, fimMes(ym)), meta: Number((d.cal.metas || {})[ym]) || 0, metaReal: L.faturamentoProdutos(d, ym + '-01', fimMes(ym)) });
    }
    return out;
  }
  function producaoPeriodo(de, ate) {
    const d = D(); const por = {};
    const p = id => (por[id] = por[id] || { previsto: 0, massa: 0, direto: 0, assados: 0, perdasForno: 0, perdasReg: 0, vendidos: 0 });
    for (const o of L.opsAtivas(d)) {
      if (o.data < de || o.data > ate) continue;
      if (o.k === 'producao') { o.previsto.forEach(x => { p(x.varianteId).previsto += x.unidades; }); o.saidas.forEach(x => { if (o.direto) p(x.varianteId).direto += x.unidades; else p(x.varianteId).massa += x.unidades; }); }
      if (o.k === 'fornada') { o.lotes.forEach(l => { p(l.varianteId).assados += l.unidades; }); o.perdas.forEach(x => { p(x.varianteId).perdasForno += x.unidades; }); }
      if (o.k === 'perda' && o.alvo !== 'ins') p(o.varianteId).perdasReg += o.qtd;
      if (o.k === 'venda') o.linhas.forEach(l => l.composicao.forEach(c => { p(c.varianteId).vendidos += c.qtd; }));
    }
    return por;
  }

  // ---------- gráficos simples ----------
  function barrasMes(serie, rot) {
    const W = 640, H = 190, pad = { l: 64, r: 10, t: 22, b: 26 };
    const max = Math.max(1, ...serie.map(s => s.v));
    const bw = (W - pad.l - pad.r) / serie.length;
    const y = v => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const ult = serie.length - 1;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(rot)}">${[max, max / 2, 0].map(t => `<line class="grade" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${esc(L.brl(t).replace(/,\d\d$/, ''))}</text>`).join('')}
      ${serie.map((s, i) => { const x = pad.l + i * bw + bw * 0.22, w = bw * 0.56; return `<rect class="barra-m" x="${x}" y="${y(s.v)}" width="${w}" height="${Math.max(0, y(0) - y(s.v))}" rx="3"><title>${esc(s.t)}: ${esc(L.brl(s.v))}</title></rect><text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(s.t)}</text>${i === ult && s.v > 0 ? `<text class="lbl" x="${x + w / 2}" y="${y(s.v) - 6}" text-anchor="middle">${esc(L.brl(s.v).replace(/,\d\d$/, ''))}</text>` : ''}`; }).join('')}</svg>`;
  }
  function hbars(itens, campo, fmt) {
    const max = Math.max(1e-9, ...itens.map(i => Math.abs(i[campo])));
    return itens.length ? `<div class="stack">${itens.map(i => `<div class="hbar"><span>${esc(i.nome)}</span><span class="num">${fmt(i[campo])}</span><div class="trilho"><span style="width:${(Math.max(0, i[campo]) / max * 100).toFixed(1)}%"></span></div></div>`).join('')}</div>` : UI.vazio('Sem vendas no período.');
  }

  // ================= RELATÓRIOS =================
  V.relatorios = function () {
    const d = D(); const r = UI.pg.rel; const sub = UI.subAtual('relatorios', 'resultado');
    const per = periodo(); const f = filtros();
    const sabores = [...new Set(L.ativos(d.variantes).map(v => v.sabor).filter(Boolean))];
    const tamanhos = [...new Set(L.ativos(d.variantes).map(v => v.tamanho).filter(Boolean))];
    const sel = (p, rot, opts) => `<label class="f" for="rel_${p}"><span>${rot}</span><select id="rel_${p}" data-b="rel.${p}">${opts}</select></label>`;
    let html = topo('Relatórios', `<button class="btn" data-a="pdfRelatorio">Baixar PDF</button><button class="btn" data-a="htmlRelatorio">Versão para impressão</button>`);
    html += `<div class="card"><div class="lg">${sel('modo', 'Período', UI.opts([{ v: 'mes', t: 'Mês' }, { v: 'intervalo', t: 'Intervalo de datas' }], r.modo))}
      ${r.modo === 'mes' ? `<label class="f" for="rel_ym"><span>Mês</span><input type="month" id="rel_ym" data-b="rel.ym" value="${r.ym || L.hoje().slice(0, 7)}"></label>` : `<label class="f" for="rel_de"><span>De</span><input type="date" id="rel_de" data-b="rel.de" value="${r.de}"></label><label class="f" for="rel_ate"><span>Até</span><input type="date" id="rel_ate" data-b="rel.ate" value="${r.ate}"></label>`}
      ${sel('canalId', 'Canal', UI.optsCanais(r.canalId, 'Todos'))}${sel('categoria', 'Categoria', UI.opts((d.cfg.categoriasProduto || []).map(c => ({ v: c, t: c })), r.categoria, 'Todas'))}
      ${sel('produtoId', 'Produto', UI.opts(Object.values(d.produtos).map(p => ({ v: p.id, t: p.nome })), r.produtoId, 'Todos'))}${sel('sabor', 'Sabor', UI.opts(sabores.map(s => ({ v: s, t: s })), r.sabor, 'Todos'))}
      ${sel('tamanho', 'Tamanho', UI.opts(tamanhos.map(s => ({ v: s, t: s })), r.tamanho, 'Todos'))}${sel('tipo', 'Avulso ou combo', UI.opts([{ v: 'v', t: 'Só avulsos' }, { v: 'c', t: 'Só combos' }], r.tipo, 'Ambos'))}</div>
      ${temFiltro(f) ? `<p class="tiny muted" style="margin-top:8px">Com filtro, os valores de vendas, taxas e custos são só das linhas filtradas (taxas da venda divididas pelo valor de cada linha). Despesas fixas não são distribuídas por produto e continuam no total do período.</p>` : ''}</div>`;
    html += UI.subtabs('relatorios', [['resultado', 'Resultado'], ['meses', 'Comparar meses'], ['ranking', 'Rankings'], ['producao', 'Produção e estoque'], ['perdas', 'Perdas'], ['invest', 'Investimentos e metas'], ['exportar', 'Exportar dados']]);
    const R = L.resultado(d, per.de, per.ate, f);
    if (sub === 'resultado') {
      const vazio = !R.linhas.length && R.resultado === 0;
      html += `<div class="grid g4">${UI.kpi('Vendas de produtos', L.brl(R.produtos), `${L.nf(R.unidadesVendidas, 0)} cookies · ${L.nf(R.combosVendidos, 0)} combos`)}${UI.kpi('Vendas líquidas', L.brl(R.vendasLiquidas), 'Após descontos e taxas')}${UI.kpi('Contribuição', L.brl(R.contribuicao), R.vendasLiquidas ? L.pct(R.contribuicao / Math.max(1e-9, R.produtos)) + ' das vendas' : '')}${UI.kpi('Resultado', L.brl(R.resultado), 'Após despesas do período')}</div>
        <div class="card"><h2>Resultado — ${esc(per.nome)}</h2>${vazio ? UI.vazio('Sem registros neste período.') : UI.dre(R)}</div>
        <div class="card"><h2>Caixa × resultado</h2>${UI.dl([['Caixa no fim do período', L.brl(L.saldoCaixa(d, per.ate))], ['Resultado do período', L.brl(R.resultado)]])}<p class="tiny muted" style="margin-top:6px">Caixa é dinheiro disponível (inclui aportes e ainda não desconta compras não pagas). Resultado é o que a operação gerou no período, por competência.</p></div>`;
    } else if (sub === 'meses') {
      const c = comparativo(6);
      html += `<div class="card"><h2>Vendas de produtos por mês</h2>${barrasMes(c.map(x => ({ t: L.nomeMesCurto(x.ym), v: x.R.produtos })), 'Vendas de produtos nos últimos 6 meses')}</div>
        <div class="card">${UI.tabela([{ t: 'Mês' }, { t: 'Bruto', n: 1 }, { t: 'Descontos', n: 1 }, { t: 'Taxas', n: 1 }, { t: 'Vendas líquidas', n: 1 }, { t: 'Custo dos vendidos', n: 1 }, { t: 'Contribuição', n: 1 }, { t: 'Despesas', n: 1 }, { t: 'Resultado', n: 1 }, { t: 'Caixa no fim', n: 1 }, { t: 'Meta', n: 1 }],
          c.map(x => [esc(L.nomeMes(x.ym)), L.brl(x.R.bruto), L.brl(x.R.descontos), L.brl(x.R.taxas), L.brl(x.R.vendasLiquidas), L.brl(x.R.cmvM + x.R.energiaEstimada), L.brl(x.R.contribuicao), L.brl(x.R.despesasTotal), L.brl(x.R.resultado), L.brl(x.caixa), x.meta ? L.pct(x.metaReal / x.meta, 0) : '—']))}</div>`;
    } else if (sub === 'ranking') {
      const rk = rankings(R);
      const ord = (a, campo) => a.slice().sort((x, y) => y[campo] - x[campo]);
      const tab = (lista, comCombos) => UI.tabela([{ t: 'Nome' }, { t: 'Un. avulsas', n: 1 }, { t: 'Un. em combos', n: 1 }].concat(comCombos ? [{ t: 'Combos', n: 1 }] : []).concat([{ t: 'Faturamento', n: 1 }, { t: 'Contribuição', n: 1 }, { t: 'Margem', n: 1 }]),
        ord(lista, 'receita').map(x => [esc(x.nome), L.nf(x.unAvulsas, 0), L.nf(x.unCombos, 0)].concat(comCombos ? [L.nf(x.combos, 0)] : []).concat([L.brl(x.receita), L.brl(x.contrib), x.receita ? L.pct(x.margem) : '—'])), { vazio: UI.vazio('Sem vendas no período.') });
      html += `<div class="nota small">Faturamento e contribuição de sabores e tamanhos consideram só vendas avulsas; a receita dos combos fica na tabela de combos, para não contar duas vezes. Contribuição = vendas − taxas − materiais − energia estimada, antes das despesas fixas (que não são divididas por produto).</div>
        <div class="grid g2"><div class="card"><h2>Sabores por unidades vendidas</h2>${hbars(ord(rk.sabor.map(x => Object.assign({}, x, { tot: x.unAvulsas + x.unCombos })), 'tot'), 'tot', v => L.nf(v, 0) + ' un.')}</div>
        <div class="card"><h2>Canais por faturamento</h2>${hbars(ord(rk.canal, 'receita'), 'receita', L.brl)}</div></div>
        <div class="card"><h2>Sabores</h2>${tab(rk.sabor)}</div><div class="card"><h2>Tamanhos</h2>${tab(rk.tamanho)}</div>
        <div class="card"><h2>Sabor × tamanho</h2>${tab(rk.variante)}</div><div class="card"><h2>Combos</h2>${tab(rk.combo, true)}</div><div class="card"><h2>Canais</h2>${tab(rk.canal, true)}</div>`;
    } else if (sub === 'producao') {
      const p = producaoPeriodo(per.de, per.ate); const s = S();
      const lin = Object.entries(p).map(([id, x]) => [esc(L.nomeVariante(d, id)), L.nf(x.previsto, 0), L.nf(x.massa, 0), L.nf(x.direto, 0), L.nf(x.assados, 0), L.nf(x.perdasForno + x.perdasReg, 0), L.nf(x.vendidos, 0), x.previsto ? L.pct((x.massa + x.direto) / x.previsto, 0) : '—']);
      const vIns = L.sum(Object.values(s.ins), x => Math.max(0, x.valor));
      const vMassa = L.sum(Object.values(s.lotes).filter(l => l.estado === 'massa' && l.saldo > 0), l => l.saldo * (l.cu.m + l.cu.e));
      const vAss = L.sum(Object.values(s.lotes).filter(l => l.estado === 'assado' && l.saldo > 0), l => l.saldo * (l.cu.m + l.cu.e));
      html += `<div class="card"><h2>Produção — ${esc(per.nome)}</h2>${UI.tabela([{ t: 'Item' }, { t: 'Previsto pela receita', n: 1 }, { t: 'Massa produzida', n: 1 }, { t: 'Produção direta', n: 1 }, { t: 'Assados', n: 1 }, { t: 'Perdas', n: 1 }, { t: 'Vendidos', n: 1 }, { t: 'Rendimento real', n: 1 }], lin, { vazio: UI.vazio('Sem produção no período.') })}</div>
        <div class="card"><h2>Estoque hoje (valor de custo, sem trabalho estimado)</h2>${UI.dl([['Ingredientes e embalagens', L.brl(vIns)], ['Massa congelada', L.brl(vMassa)], ['Cookies assados', L.brl(vAss)], ['Total', L.brl(vIns + vMassa + vAss), 'tot']])}</div>`;
    } else if (sub === 'perdas') {
      const ops = L.opsAtivas(d).filter(o => o.data >= per.de && o.data <= per.ate);
      const linhas = [];
      ops.filter(o => o.k === 'perda').forEach(o => linhas.push([L.fmtBR(o.data), o.alvo === 'ins' ? esc((d.insumos[o.insumoId] || {}).nome || '?') : esc(L.nomeVariante(d, o.varianteId)) + ' (' + o.alvo + ')', L.nf(o.qtd), esc(o.motivo), L.brl(o.valor)]));
      ops.filter(o => o.k === 'fornada').forEach(o => o.perdas.forEach(x => linhas.push([L.fmtBR(o.data), esc(L.nomeVariante(d, x.varianteId)) + ' (na fornada)', L.nf(x.unidades, 0), 'Não ficou bom no forno', L.brl(x.valor)])));
      const porMotivo = {}; linhas.forEach(l => { porMotivo[l[3]] = (porMotivo[l[3]] || 0) + N(String(l[4]).replace('R$', '')); });
      html += `<div class="card"><h2>Perdas reais — ${esc(per.nome)}</h2>${UI.tabela([{ t: 'Data' }, { t: 'Item' }, { t: 'Qtd.', n: 1 }, { t: 'Motivo' }, { t: 'Valor (inclui trabalho estimado)', n: 1 }], linhas.sort((a, b) => b[0].localeCompare(a[0])), { vazio: UI.vazio('Nenhuma perda no período.') })}
        <div style="margin-top:12px">${UI.dl([['Materiais perdidos (entra no resultado)', L.brl(R.perdasM)], ['Energia nas unidades perdidas', L.brl(R.perdasE)], ['Trabalho estimado nas unidades perdidas', L.brl(R.perdasT)]])}</div></div>`;
    } else if (sub === 'invest') {
      const rc = L.recuperacao(d, L.hoje()); const c = comparativo(6);
      html += `<div class="card"><h2>Investimento</h2>${UI.dl([['Total investido', L.brl(rc.investido)], ['Reinvestido com dinheiro do negócio', L.brl(rc.reinvestido)], ['Devolvido à proprietária', L.brl(rc.devolvido)], ['Falta recuperar', L.brl(rc.falta), 'tot'], ['Prazo estimado', rc.prazoMeses !== null ? rc.prazoMeses + ' meses' : 'dados insuficientes']])}</div>
        <div class="card"><h2>Metas dos últimos meses</h2>${UI.tabela([{ t: 'Mês' }, { t: 'Meta', n: 1 }, { t: 'Realizado', n: 1 }, { t: 'Alcançado', n: 1 }], c.map(x => [esc(L.nomeMes(x.ym)), x.meta ? L.brl(x.meta) : '—', L.brl(x.metaReal), x.meta ? UI.pill(L.pct(x.metaReal / x.meta, 0), x.metaReal >= x.meta ? 'ok' : 'warn') : '—']))}</div>`;
    } else {
      html += `<div class="card"><h2>Exportar registros (CSV)</h2><p class="muted small" style="margin:4px 0 12px">Arquivos CSV em UTF-8, separados por vírgula, com ponto como separador decimal e datas no formato AAAA-MM-DD. No Google Planilhas: Arquivo › Importar › Fazer upload; se os números vierem como texto, escolha a localidade “Estados Unidos” na importação ou use “Detectar automaticamente”. O período escolhido acima vale para vendas, compras, produção, perdas e financeiro.</p>
        <div class="row">${[['vendas', 'Vendas (linhas)'], ['recebimentos', 'Recebimentos'], ['compras', 'Compras (itens)'], ['producao', 'Produções'], ['fornadas', 'Fornadas'], ['perdas', 'Perdas e ajustes'], ['financeiro', 'Lançamentos e parcelas'], ['caixa', 'Movimentos de caixa'], ['estoque', 'Estoque atual (lotes)'], ['insumos', 'Ingredientes e custos'], ['precos', 'Tabela de preços'], ['resultado', 'Resultado mensal (12 meses)']].map(([k, t]) => `<button class="btn sm" data-a="csv" data-k="${k}">${t}</button>`).join('')}</div></div>
        <div class="card"><h2>Backup completo</h2><p class="muted small" style="margin:4px 0 12px">Para guardar ou levar todos os dados (cadastros, histórico e configurações), use o backup em JSON em Configurações e backup.</p><button class="btn" data-a="ir" data-r="config">Ir para backup</button></div>`;
    }
    return html;
  };

  // ---------- CSV ----------
  const CSV = {
    vendas: (d, de, ate) => {
      const cab = ['data', 'canal', 'forma_pagamento', 'tipo', 'item', 'quantidade', 'unidades_cookies', 'preco_unitario', 'desconto', 'valor_produtos', 'taxas_rateadas', 'custo_materiais', 'custo_energia', 'trabalho_estimado', 'promocao', 'situacao', 'id_registro'];
      const out = [];
      for (const o of Object.values(d.ops).filter(o => o.k === 'venda' && o.data >= de && o.data <= ate).sort((a, b) => a.data.localeCompare(b.data))) {
        const cv = L.calcVenda(d, o); const tot = L.sum(o.linhas, l => l.qtd * l.precoUnit - (l.desconto || 0));
        for (const l of o.linhas) { const rec = L.r2(l.qtd * l.precoUnit - (l.desconto || 0)); out.push([o.data, (d.canais[o.canalId] || {}).nome, (d.formas[o.formaId] || {}).nome, l.tipo === 'c' ? 'combo' : 'avulso', L.nomeItem(d, l.tipo, l.refId), l.qtd, l.unidades, l.precoUnit, l.desconto || 0, rec, tot > 0 ? L.r2(cv.taxas * rec / tot) : 0, L.r2(l.custo.m), L.r2(l.custo.e), L.r2(l.custo.t), l.promoId ? (d.promocoes[l.promoId] || {}).nome : '', o.status, o.id]); }
      }
      return [cab, out];
    },
    recebimentos: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => o.k === 'venda' && o.data >= de && o.data <= ate)) for (const r of o.recebimentos || []) out.push([o.data, (d.canais[o.canalId] || {}).nome, r.data, r.valor, L.r2(L.sum(r.pagos, g => g.valor)), (r.pagos || []).map(g => g.data).join(' '), r.encerrado ? 'encerrado' : '', o.status, o.id]);
      return [['data_venda', 'canal', 'previsto_para', 'valor_previsto', 'valor_recebido', 'datas_recebimento', 'conciliacao', 'situacao', 'id_registro'], out];
    },
    compras: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => o.k === 'compra' && o.data >= de && o.data <= ate)) for (const i of o.itens) { const ins = d.insumos[i.insumoId] || {}; out.push([o.data, o.recebidoEm || '', o.fornecedor, ins.nome, i.embs, i.embQtd, i.embUnid, i.qBase, ins.unidade, i.valor, i.extra || 0, i.custoTotal, L.r6(i.custoUnit), i.lote, i.validade || '', o.status, o.id]); }
      return [['data', 'recebida_em', 'fornecedor', 'item', 'embalagens', 'conteudo', 'unidade_conteudo', 'quantidade_estoque', 'unidade_estoque', 'valor_pago', 'adicionais_rateados', 'custo_total', 'custo_por_unidade', 'lote', 'validade', 'situacao', 'id_registro'], out];
    },
    producao: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => o.k === 'producao' && o.data >= de && o.data <= ate)) for (const l of o.lotes) out.push([o.data, (d.receitas[o.receitaId] || {}).nome, o.versao, o.mult, o.lote, L.nomeVariante(d, l.varianteId), l.unidades, (o.previsto.find(p => p.varianteId === l.varianteId) || {}).unidades || '', L.r6(l.cu.m), L.r6(l.cu.e), L.r6(l.cu.t), l.validade || '', o.direto ? 'direta (assada)' : 'massa congelada', o.status, o.id]);
      return [['data', 'receita', 'versao', 'receitas_feitas', 'lote', 'item', 'unidades', 'previsto', 'custo_materiais_un', 'custo_energia_un', 'trabalho_un', 'validade', 'tipo', 'situacao', 'id_registro'], out];
    },
    fornadas: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => o.k === 'fornada' && o.data >= de && o.data <= ate)) o.linhas.forEach((l, i) => { const lo = o.lotes.find(x => x.origem === l.key) || {}; out.push([o.data, L.nomeVariante(d, l.varianteId), l.key, l.retiradas, l.boas, l.retiradas - l.boas, o.custos.energia, L.r2(o.consumoForno.kwh), L.r2(o.consumoForno.gas), o.custos.trabalho, lo.cu ? L.r6(lo.cu.m + lo.cu.e + lo.cu.t) : '', lo.validade || '', o.status, o.id]); });
      return [['data', 'item', 'lote_massa', 'retiradas', 'boas', 'perdidas', 'energia_fornada', 'kwh', 'gas', 'trabalho_fornada', 'custo_un_assado', 'validade', 'situacao', 'id_registro'], out];
    },
    perdas: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => (o.k === 'perda' || o.k === 'ajuste') && o.data >= de && o.data <= ate)) out.push([o.data, o.k, o.alvo, o.alvo === 'ins' ? (d.insumos[o.insumoId] || {}).nome : L.nomeVariante(d, o.varianteId), o.k === 'perda' ? -o.qtd : o.delta, o.motivo, o.k === 'perda' ? -o.valor : o.valor, o.status, o.id]);
      return [['data', 'tipo', 'estado', 'item', 'quantidade', 'motivo', 'valor', 'situacao', 'id_registro'], out];
    },
    financeiro: (d, de, ate) => {
      const out = [];
      for (const o of Object.values(d.ops).filter(o => (o.k === 'lanc' || o.k === 'compra') && o.data >= de && o.data <= ate)) for (const p of o.parcelas || []) out.push([o.k === 'compra' ? o.data : o.competencia, o.k === 'compra' ? 'compra' : o.natureza, o.k === 'compra' ? 'Compra ' + (o.fornecedor || '') : o.descricao, o.k === 'lanc' && o.natureza === 'despesa' ? L.catDespesa(d, o.categoria).nome : '', p.venc, p.valor, L.r2(L.sum(p.pagos, g => g.valor)), (p.pagos || []).map(g => g.data).join(' '), o.status, o.id]);
      return [['competencia', 'tipo', 'descricao', 'categoria', 'vencimento', 'valor_parcela', 'valor_pago', 'datas_pagamento', 'situacao', 'id_registro'], out];
    },
    caixa: (d, de, ate) => [['data', 'descricao', 'grupo', 'valor'], L.fluxo(d).caixa.filter(c => c.data >= de && c.data <= ate).map(c => [c.data, c.desc, c.grupo, c.valor])],
    estoque: d => { const s = S(); const out = Object.values(s.lotes).filter(l => l.saldo > 0).map(l => [l.estado, L.nomeVariante(d, l.varianteId), l.lote, l.data, l.validade || '', l.saldo, l.inicial, L.r6(l.cu.m + l.cu.e + l.cu.t)]); for (const [id, st] of Object.entries(s.ins)) { const i = d.insumos[id] || {}; out.push(['insumo', i.nome, '', '', '', L.r6(st.qtd), '', st.qtd > 0 ? L.r6(st.valor / st.qtd) : '']); } return [['estado', 'item', 'lote', 'data', 'validade', 'saldo', 'inicial', 'custo_unitario'], out]; },
    insumos: d => { const s = S(); return [['item', 'tipo', 'unidade', 'estoque', 'custo_medio', 'ultimo_custo', 'estoque_minimo', 'fornecedor', 'arquivado'], Object.values(d.insumos).map(i => { const st = s.ins[i.id]; return [i.nome, i.tipo, i.unidade, st ? L.r6(st.qtd) : 0, L.r6(L.custoBaseInsumo(d, s, i.id, 'medio').valor || 0), L.r6(L.custoBaseInsumo(d, s, i.id, 'ultimo').valor || 0), i.estoqueMin || '', i.fornecedor || '', i.arquivado ? 'sim' : '']; })]; },
    precos: d => { const s = S(); const canais = L.ativos(d.canais); return [['item', 'custo_unitario'].concat(canais.map(c => 'preco_' + c.nome)), L.ativos(d.variantes).map(v => [L.nomeVariante(d, v.id), L.r6(L.custoVariante(d, s, v.id, 'medio').total)].concat(canais.map(c => (v.precos || {})[c.id] || ''))).concat(L.ativos(d.combos).map(cb => ['Combo ' + cb.nome, L.r6(L.custoCombo(d, s, cb.id, 'medio').max)].concat(canais.map(c => (cb.precos || {})[c.id] || ''))))]; },
    resultado: d => { const out = []; for (let i = 11; i >= 0; i--) { const ym = L.addMesYM(L.hoje().slice(0, 7), -i); const R = L.resultado(d, ym + '-01', fimMes(ym)); out.push([ym, R.bruto, R.descontos, R.produtos, R.entregaCobrada, R.taxas, R.vendasLiquidas, L.r2(R.cmvM), L.r2(R.energiaNoResultado), L.r2(R.perdasM), R.custoEntrega, L.r2(R.contribuicao), R.despesasTotal, L.r2(R.depreciacao), R.resultado, L.r2(R.trabalhoEstimado), L.saldoCaixa(d, fimMes(ym))]); } return [['mes', 'bruto', 'descontos', 'vendas_produtos', 'entrega_cobrada', 'taxas', 'vendas_liquidas', 'custo_materiais_vendidos', 'energia_gas', 'perdas_materiais', 'custo_entrega', 'contribuicao', 'despesas', 'depreciacao', 'resultado', 'trabalho_estimado', 'caixa_fim_mes'], out]; },
  };
  UI.acoes.csv = ds => {
    const per = periodo(); const [cab, linhas] = CSV[ds.k](D(), per.de, per.ate);
    if (!linhas.length) { UI.toast('Não há registros para exportar neste período.'); return; }
    const fixo = ['estoque', 'insumos', 'precos', 'resultado'].includes(ds.k);
    UI.baixar(fixo ? `leora-${ds.k}-${L.hoje()}.csv` : `leora-${ds.k}-${per.de}-a-${per.ate}.csv`, L.toCSV(cab, linhas));
  };

  // ---------- PDF e versão de impressão ----------
  function conteudoRelatorio() {
    const d = D(); const per = periodo(); const f = filtros(); const R = L.resultado(d, per.de, per.ate, f); const rk = rankings(R); const c = comparativo(6);
    const dre = [
      ['Faturamento bruto de produtos', R.bruto], ['Descontos', -R.descontos], ['Vendas de produtos', R.produtos], ['Taxas de entrega cobradas', R.entregaCobrada], ['Taxas de canais e pagamentos', -R.taxas], ['Vendas líquidas', R.vendasLiquidas],
      ['Custo dos vendidos: ingredientes e embalagens', -R.cmvM], [R.usaEnergiaReal ? 'Energia/gás (parte real da conta)' : 'Energia/gás (estimativa)', -R.energiaNoResultado], ['Perdas reais (materiais)', -R.perdasM], ['Ajustes de estoque', R.ajustes], ['Custo de entrega própria', -R.custoEntrega], ['Impostos configurados', -R.impostos],
      ['Contribuição', R.contribuicao], ...Object.entries(R.despesas).map(([k, v]) => [L.catDespesa(d, k).nome, -v]), ['Outras entradas', R.outrasReceitas || 0], ['Depreciação', -R.depreciacao], ['Resultado operacional', R.resultado], ['Trabalho estimado (não é despesa paga)', R.trabalhoEstimado],
    ].filter(x => x[1] !== 0 || ['Vendas de produtos', 'Vendas líquidas', 'Contribuição', 'Resultado operacional'].includes(x[0]));
    const filtrosTxt = Object.entries(f).filter(([, v]) => v).map(([k, v]) => k + ': ' + (k === 'canalId' ? (d.canais[v] || {}).nome : k === 'produtoId' ? (d.produtos[v] || {}).nome : k === 'tipo' ? (v === 'c' ? 'combos' : 'avulsos') : v)).join(' · ');
    return {
      titulo: 'LEORA Confeitaria Artesanal — Relatório', periodo: per.nome, filtros: filtrosTxt, gerado: new Date().toLocaleString('pt-BR', { timeZone: L.TZ }),
      secoes: [
        { titulo: 'Resultado do período', cab: ['Linha', 'Valor'], linhas: dre.map(x => [x[0], L.brl(x[1])]) },
        { titulo: 'Caixa', cab: ['Item', 'Valor'], linhas: [['Caixa no fim do período', L.brl(L.saldoCaixa(d, per.ate))], ['Resultado do período', L.brl(R.resultado)]] },
        { titulo: 'Comparativo dos últimos 6 meses', cab: ['Mês', 'Vendas prod.', 'Taxas', 'Contribuição', 'Despesas', 'Resultado', 'Caixa'], linhas: c.map(x => [L.nomeMesCurto(x.ym), L.brl(x.R.produtos), L.brl(x.R.taxas), L.brl(x.R.contribuicao), L.brl(x.R.despesasTotal), L.brl(x.R.resultado), L.brl(x.caixa)]) },
        { titulo: 'Sabores (receita só de avulsos)', cab: ['Sabor', 'Un. avulsas', 'Un. em combos', 'Faturamento', 'Contribuição', 'Margem'], linhas: rk.sabor.sort((a, b) => b.receita - a.receita).map(x => [x.nome, L.nf(x.unAvulsas, 0), L.nf(x.unCombos, 0), L.brl(x.receita), L.brl(x.contrib), L.pct(x.margem)]) },
        { titulo: 'Combos', cab: ['Combo', 'Combos', 'Cookies', 'Faturamento', 'Contribuição', 'Margem'], linhas: rk.combo.map(x => [x.nome, L.nf(x.combos, 0), L.nf(x.unCombos, 0), L.brl(x.receita), L.brl(x.contrib), L.pct(x.margem)]) },
        { titulo: 'Canais', cab: ['Canal', 'Un. avulsas', 'Combos', 'Faturamento', 'Contribuição', 'Margem'], linhas: rk.canal.map(x => [x.nome, L.nf(x.unAvulsas, 0), L.nf(x.combos, 0), L.brl(x.receita), L.brl(x.contrib), L.pct(x.margem)]) },
      ],
      notas: ['Caixa é dinheiro disponível; resultado é o que o período gerou por competência.', 'Contribuição = vendas líquidas − materiais − energia estimada − entrega − impostos, antes das despesas fixas. Despesas fixas não são distribuídas por produto.', R.usaEnergiaReal ? 'Energia/gás: usada a parte real lançada da conta no lugar da estimativa.' : 'Energia/gás: estimativa pela potência do forno, tempo e tarifa cadastrados.', 'Trabalho estimado é o valor da sua hora usado no preço; não é despesa paga.'],
    };
  }
  UI.acoes.pdfRelatorio = async () => {
    const jsp = window.jspdf && window.jspdf.jsPDF;
    if (!jsp) { UI.toast('O gerador de PDF não carregou. Use “Versão para impressão”.'); return; }
    const c = conteudoRelatorio();
    const doc = new jsp({ unit: 'pt', format: 'a4' });
    const vinho = [139, 30, 36], marrom = [78, 46, 30];
    doc.setTextColor(...vinho); doc.setFontSize(18); doc.text('LEORA', 40, 50);
    doc.setFontSize(9); doc.setTextColor(...marrom); doc.text('CONFEITARIA ARTESANAL', 40, 64);
    doc.setFontSize(13); doc.text('Relatório — ' + c.periodo, 40, 92);
    doc.setFontSize(8); doc.text('Gerado em ' + c.gerado + (c.filtros ? ' · Filtros: ' + c.filtros : ''), 40, 106);
    let y = 120;
    for (const s of c.secoes) {
      if (!s.linhas.length) continue;
      doc.setFontSize(11); doc.setTextColor(...vinho); doc.text(s.titulo, 40, y + 14);
      doc.autoTable({ startY: y + 20, head: [s.cab], body: s.linhas, theme: 'grid', styles: { fontSize: 8, textColor: marrom, cellPadding: 4 }, headStyles: { fillColor: vinho, textColor: [248, 241, 232] }, columnStyles: Object.fromEntries(s.cab.map((_, i) => [i, { halign: i === 0 ? 'left' : 'right' }])), margin: { left: 40, right: 40 } });
      y = doc.lastAutoTable.finalY + 10;
      if (y > 740) { doc.addPage(); y = 40; }
    }
    doc.setFontSize(7.5); doc.setTextColor(...marrom);
    const notas = doc.splitTextToSize(c.notas.join(' '), 515); if (y + 14 + notas.length * 10 > 800) { doc.addPage(); y = 40; } doc.text(notas, 40, y + 14);
    const blob = doc.output('blob');
    UI.baixar('leora-relatorio-' + periodo().de + '.pdf', blob);
  };
  UI.acoes.htmlRelatorio = () => {
    const c = conteudoRelatorio();
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(c.titulo)}</title><style>body{font-family:Georgia,serif;color:#4E2E1E;margin:32px;background:#fff}h1{color:#8B1E24;letter-spacing:.2em;margin:0}h2{color:#8B1E24;font-size:15px;margin:22px 0 6px}small{color:#7a5e4e}table{border-collapse:collapse;width:100%;font:12px system-ui,sans-serif}th{background:#8B1E24;color:#F8F1E8;text-align:left;padding:5px}td{border-bottom:1px solid #e5d6c6;padding:5px}td+td,th+th{text-align:right}p{font:11px system-ui,sans-serif}@media print{body{margin:12mm}}</style></head><body>
      <h1>LEORA</h1><small>CONFEITARIA ARTESANAL</small><h2 style="font-size:18px">Relatório — ${esc(c.periodo)}</h2><small>Gerado em ${esc(c.gerado)}${c.filtros ? ' · Filtros: ' + esc(c.filtros) : ''}</small>
      ${c.secoes.filter(s => s.linhas.length).map(s => `<h2>${esc(s.titulo)}</h2><table><thead><tr>${s.cab.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.linhas.map(l => `<tr>${l.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}
      <p>${c.notas.map(esc).join('<br>')}</p><p><em>Para salvar em PDF: abra este arquivo no navegador e use Imprimir › Salvar como PDF.</em></p></body></html>`;
    UI.baixar('leora-relatorio-' + periodo().de + '.html', html);
  };

  // ================= CONFIGURAÇÕES E BACKUP =================
  V.config = function () {
    const d = D(); const c = d.cfg; const modo = L.Store.modo;
    const tab = (cab, lin, novo, rot) => `<div class="card"><div class="card-h"><h2>${rot}</h2><button class="btn sm" data-a="${novo}">+ Adicionar</button></div>${UI.tabela(cab, lin, { vazio: UI.vazio('Nada cadastrado.') })}</div>`;
    const arq = (col, x) => `<button class="btn sm lk" data-a="arquivar" data-col="${col}" data-id="${x.id}">${x.arquivado ? 'Reativar' : 'Arquivar'}</button>`;
    const armaz = {
      nuvem: 'Os registros ficam no armazenamento deste Artifact na sua conta Claude. Abrindo o mesmo Artifact no celular ou no computador, com a mesma conta, você vê os mesmos dados. Mesmo assim, exporte um backup de vez em quando.',
      local: 'Este arquivo está aberto fora do Claude: os registros ficam só neste navegador, neste aparelho. Use o backup para levar os dados para a versão no Claude.',
      memoria: 'Nenhum armazenamento disponível nesta visualização: o que você registrar some ao fechar. Exporte o backup antes de sair.',
      demo: 'Modo demonstração: dados de exemplo só na memória.',
    }[modo] || '';
    return `${topo('Configurações e backup')}
      <div class="card"><div class="card-h"><h2>Armazenamento</h2>${UI.chipModo()}</div><p class="small">${armaz}</p></div>
      <div class="card"><div class="card-h"><h2>Geral</h2><div class="row"><button class="btn sm" data-a="abrirCfg">Editar</button><button class="btn sm" data-a="abrirCategorias">Categorias e impostos</button></div></div>
        ${UI.dl([['Início das operações', L.fmtBR(c.inicio)], ['Saldo inicial', L.brl(c.saldoInicial) + (c.saldoInicialEhAporte ? ' (aporte)' : '')], ['Valor da hora de trabalho', L.brl(c.valorHora)], ['Tarifa de energia', L.brl4(c.tarifaKwh) + '/kWh'], ['Tarifa do gás', L.brl4(c.tarifaGas) + '/' + esc(c.unidadeGas)], ['Margem desejada', L.nf(c.margemDesejada) + '%'], ['Divisão da fornada', c.criterioFornada === 'peso' ? 'por peso' : 'por unidades'], ['Depreciação', c.depreciacaoAtiva ? 'ativada' : 'desligada'], ['Impostos', (c.impostos || []).length ? c.impostos.map(i => esc(i.nome) + ' ' + L.nf(i.pct) + '%').join(', ') : 'nenhum']])}</div>
      <div class="card"><div class="card-h"><h2>Logo</h2></div><div class="row">${d.logo ? `<img src="${esc(d.logo)}" alt="Logo atual" style="width:72px;height:72px;object-fit:contain;border-radius:10px;border:1px solid var(--line)">` : '<span class="muted small">Sem logo. O nome LEORA aparece no lugar.</span>'}
        <label class="btn sm" for="arqLogo">Escolher imagem<input type="file" id="arqLogo" accept="image/*" data-arquivo="logo" hidden></label>${d.logo ? '<button class="btn sm lk" data-a="removerLogo">Remover</button>' : ''}</div></div>
      ${tab([{ t: 'Canal' }, { t: 'Tipo' }, { t: 'Comissão', n: 1 }, { t: 'Fixa/pedido', n: 1 }, { t: 'Pagamento' }, { t: '' }], Object.values(d.canais).map(x => ({ _cls: x.arquivado ? 'arq' : '', c: [esc(x.nome), x.tipo === 'plataforma' ? 'plataforma' : 'direto', L.nf(x.taxaPct) + '%' + (x.baseTaxa === 'produtos_entrega' ? ' (c/ entrega)' : ''), L.brl(x.taxaFixaPedido), x.pagamentoIncluso ? 'pela plataforma' + (x.prazoDias ? `, repasse em ${x.prazoDias} d` : '') : esc((d.formas[x.formaPadraoId] || {}).nome || '—'), `<button class="btn sm lk" data-a="editarCanal" data-id="${x.id}">Editar</button>${arq('canais', x)}`] })), 'novoCanal', 'Canais de venda')}
      ${tab([{ t: 'Forma' }, { t: 'Taxa', n: 1 }, { t: 'Fixa', n: 1 }, { t: 'Antecipação', n: 1 }, { t: 'Prazo', n: 1 }, { t: '' }], Object.values(d.formas).map(x => ({ _cls: x.arquivado ? 'arq' : '', c: [esc(x.nome), L.nf(x.taxaPct) + '%', L.brl(x.taxaFixa), L.nf(x.antecipacaoPct || 0) + '%', (x.prazoDias || 0) + ' dias', `<button class="btn sm lk" data-a="editarForma" data-id="${x.id}">Editar</button>${arq('formas', x)}`] })), 'novaForma', 'Formas de pagamento')}
      ${tab([{ t: 'Forno' }, { t: 'Tipo' }, { t: 'Potência / consumo' }, { t: 'Custo por hora', n: 1 }, { t: '' }], Object.values(d.fornos).map(x => ({ _cls: x.arquivado ? 'arq' : '', c: [esc(x.nome), x.tipo === 'gas' ? 'gás encanado' : 'elétrico', x.tipo === 'gas' ? (x.custoManualHora ? 'estimativa manual ' + L.brl(x.custoManualHora) + '/h' : L.nf(x.consumoHora || 0, 3) + ' ' + esc(c.unidadeGas) + '/h') : L.nf(x.potenciaW || 0) + ' W' + (x.fator ? ' × ' + L.nf(x.fator) : ''), L.brl(L.custoForno(d, x, 60).valor), `<button class="btn sm lk" data-a="editarForno" data-id="${x.id}">Editar</button>${arq('fornos', x)}`] })), 'novoForno', 'Fornos')}
      <div class="card"><h2>Backup e restauração</h2><p class="muted small" style="margin:4px 0 12px">O backup em JSON contém todos os cadastros, o histórico completo, configurações, metas e logo, com a versão do formato. Ao importar, o arquivo é conferido antes e você confirma a substituição: nada é misturado ou duplicado.</p>
        <div class="row"><button class="btn pri" data-a="exportarBackup" ${modo === 'demo' ? 'disabled' : ''}>Exportar backup completo</button><label class="btn" for="arqBackup">Importar backup<input type="file" id="arqBackup" accept=".json,application/json" data-arquivo="backup" hidden></label></div>
        ${modo === 'demo' ? '<p class="tiny muted" style="margin-top:6px">Saia da demonstração para exportar ou importar seus dados.</p>' : ''}</div>
      <div class="card"><h2>Demonstração</h2><p class="muted small" style="margin:4px 0 12px">Abre um conjunto de dados de exemplo, separado e identificado, só na memória. Seus registros reais não aparecem nem são alterados.</p>${modo === 'demo' ? '<button class="btn" data-a="sairDemo">Sair da demonstração</button>' : '<button class="btn" data-a="entrarDemo">Abrir demonstração</button>'}</div>`;
  };
  Object.assign(UI.acoes, {
    abrirCfg: () => F.config(), abrirCategorias: () => F.categorias(),
    novoCanal: () => F.canal(null), editarCanal: ds => F.canal(ds.id), novaForma: () => F.forma(null), editarForma: ds => F.forma(ds.id), novoForno: () => F.forno(null), editarForno: ds => F.forno(ds.id),
    removerLogo: async () => { try { await L.Store.salvarLogo(null); UI.toast('Logo removida.'); } catch (e) { UI.toast(e.message); } },
    logo: el => {
      const f = el.files && el.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        const img = new Image();
        img.onload = async () => {
          const max = 320; const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          const url = cv.toDataURL('image/png');
          if (url.length > 200000) { UI.toast('Imagem grande demais mesmo reduzida. Use um arquivo mais simples.'); return; }
          try { await L.Store.salvarLogo(url); UI.toast('Logo salva.'); } catch (e) { UI.toast(e.message); }
        };
        img.onerror = () => UI.toast('Não foi possível ler a imagem.');
        img.src = rd.result;
      };
      rd.readAsDataURL(f); el.value = '';
    },
    exportarBackup: () => {
      if (L.Store.modo === 'demo') return;
      const json = JSON.stringify(L.montarBackup(D()), null, 1);
      UI.baixar('leora-backup-' + L.hoje() + '.json', json);
    },
    backup: el => {
      const f = el.files && el.files[0]; if (!f) return; el.value = '';
      if (L.Store.modo === 'demo') { UI.toast('Saia da demonstração para importar.'); return; }
      const rd = new FileReader();
      rd.onload = async () => {
        let obj; try { obj = JSON.parse(rd.result); } catch (e) { UI.abrir({ titulo: 'Backup inválido', largura: 'estreita', corpo: () => '<p>O arquivo não é um JSON válido.</p>' }, {}); return; }
        const v = L.validarBackup(obj);
        if (!v.ok) { UI.abrir({ titulo: 'Backup recusado', largura: 'estreita', corpo: () => `<p>O arquivo não passou na verificação:</p><ul>${v.erros.map(e => `<li>${esc(e)}</li>`).join('')}</ul><p class="muted small">Nada foi alterado.</p>` }, {}); return; }
        const atual = L.validarBackup(L.montarBackup(D())).contagem;
        const nomes = { insumos: 'Ingredientes/embalagens', kits: 'Conjuntos', bases: 'Receitas base', produtos: 'Produtos', variantes: 'Variações', receitas: 'Receitas', combos: 'Combos', canais: 'Canais', formas: 'Formas de pagamento', fornos: 'Fornos', promocoes: 'Promoções', recorrencias: 'Recorrências', ops: 'Registros (compras, produção, vendas, financeiro)' };
        const ok = await UI.confirmar({
          titulo: 'Substituir todos os dados?', botao: 'Substituir pelos dados do backup',
          texto: `Backup gerado em ${esc(new Date(obj.geradoEm || Date.now()).toLocaleString('pt-BR', { timeZone: L.TZ }))}. Os dados atuais serão <strong>substituídos</strong> (não somados). Recomendo exportar um backup do estado atual antes.`,
          extra: UI.tabela([{ t: 'Conteúdo' }, { t: 'Atual', n: 1 }, { t: 'No backup', n: 1 }], Object.keys(nomes).map(k => [nomes[k], atual[k], v.contagem[k]])),
        });
        if (!ok) return;
        UI.toast('Restaurando…');
        try { await L.Store.substituirTudo(obj.dados, (a, b) => UI.toast(`Restaurando… ${a} de ${b}`)); UI.toast('Backup restaurado.'); }
        catch (e) { UI.abrir({ titulo: 'Restauração incompleta', largura: 'estreita', corpo: () => `<p>${esc(e.message)}</p>` }, {}); }
      };
      rd.readAsText(f, 'utf-8');
    },
    entrarDemo: () => { L.Store.entrarDemo(L.demo()); UI.ir('inicio'); UI.toast('Demonstração aberta. Nada aqui é salvo.'); },
  });
})(globalThis.L = globalThis.L || {});
