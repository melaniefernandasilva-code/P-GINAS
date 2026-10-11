/* LEORA — telas de precificação/promoções e financeiro. */
(function (L) {
  'use strict';
  const UI = L.UI; const esc = UI.esc; const F = UI.forms; const N = L.num; const V = UI.views;
  const D = () => UI.D(); const S = () => UI.S();
  const topo = (t, extra) => `<div class="topo"><div><div class="eyebrow">${esc(L.fmtBR(L.hoje()))}</div><h1>${esc(t)}</h1></div><div class="row">${extra || ''}</div></div>`;

  // ================= PRECIFICAÇÃO =================
  function simPadrao() {
    const d = D(); const v = L.ativos(d.variantes)[0]; const c = L.ativos(d.canais)[0];
    return { ref: v ? 'v:' + v.id : '', canalId: c ? c.id : '', formaId: c ? c.formaPadraoId || '' : '', criterio: 'medio', modo: 'margem', margem: String(d.cfg.margemDesejada || 30), preco: '', descTipo: 'pct', desc: '', kitId: '__padrao', itensPorPedido: String(d.cfg.itensPorPedido || 1), rateio: false };
  }
  V.precos = function () {
    const sub = UI.subAtual('precos', 'sim');
    let html = topo('Precificação e promoções') + UI.subtabs('precos', [['sim', 'Simulador'], ['tabela', 'Tabela de preços'], ['promos', 'Promoções'], ['rateio', 'Despesas no preço']]);
    const d = D();
    if (sub === 'sim') {
      if (!UI.pg.sim) UI.pg.sim = simPadrao();
      const st = UI.pg.sim;
      const itens = L.ativos(d.variantes).map(v => ({ v: 'v:' + v.id, t: L.nomeVariante(d, v.id) })).concat(L.ativos(d.combos).map(c => ({ v: 'c:' + c.id, t: 'Combo ' + c.nome })));
      if (!itens.length) return html + `<div class="card">${UI.vazio('Cadastre produtos e receitas para simular preços.', '', '<button class="btn" data-a="ir" data-r="produtos">Ir para produtos</button>')}</div>`;
      const pgSel = (path, rot, opts) => `<label class="f" for="pg_${path}"><span>${rot}</span><select id="pg_${path}" data-b="sim.${path}">${opts}</select></label>`;
      const pgInp = (path, rot, ajuda) => `<label class="f" for="pg_${path}"><span>${rot}</span><input type="text" inputmode="decimal" id="pg_${path}" data-b="sim.${path}" value="${esc(st[path])}">${ajuda ? `<small>${ajuda}</small>` : ''}</label>`;
      html += `<div class="card"><div class="lg">${pgSel('ref', 'Item ou combo', UI.opts(itens, st.ref))}${pgSel('canalId', 'Canal', UI.optsCanais(st.canalId, 'Escolha…'))}${pgSel('formaId', 'Forma de pagamento', UI.optsFormas(st.formaId, 'Escolha…'))}
          ${pgSel('criterio', 'Custo dos ingredientes', UI.opts([{ v: 'medio', t: 'Custo médio do estoque' }, { v: 'ultimo', t: 'Último preço de compra' }], st.criterio))}</div>
        <div class="row" style="margin-top:12px"><div class="seg" role="group"><button type="button" data-a="simModo" data-v="margem" aria-pressed="${st.modo === 'margem'}">Sugerir preço pela margem</button><button type="button" data-a="simModo" data-v="preco" aria-pressed="${st.modo === 'preco'}">Testar um preço</button></div></div>
        <div class="lg" style="margin-top:12px">${st.modo === 'margem' ? pgInp('margem', 'Margem desejada (% do preço)') : pgInp('preco', 'Preço a testar (R$)')}
          ${pgInp('itensPorPedido', 'Itens por pedido (premissa)', 'Divide a taxa fixa por pedido.')}
          ${pgSel('descTipo', 'Desconto promocional', UI.opts([{ v: 'pct', t: 'Em %' }, { v: 'valor', t: 'Em R$ por unidade' }], st.descTipo))}${pgInp('desc', 'Valor do desconto')}
          ${pgSel('kitId', 'Embalagem', UI.opts([{ v: '__padrao', t: 'Padrão do item' }].concat(L.ativos(d.kits).filter(k => k.uso === 'venda').map(k => ({ v: k.id, t: k.nome }))), st.kitId))}</div>
        <label class="chk" style="margin-top:10px" for="pg_rateio"><input type="checkbox" id="pg_rateio" data-b="sim.rateio" ${st.rateio ? 'checked' : ''}><span>Incluir parte das despesas mensais no preço <span class="muted small">(premissas em “Despesas no preço”)</span></span></label></div>
        <div data-sim>${resultadoSim(st)}</div>`;
      UI.pgAtualizar = () => { const el = document.querySelector('[data-sim]'); if (el) el.innerHTML = resultadoSim(UI.pg.sim); };
    } else if (sub === 'tabela') {
      const s = S(); const canais = L.ativos(d.canais);
      const margem = (d.cfg.margemDesejada || 0) / 100;
      const cel = (preco, custo, ch, faixa) => {
        if (!(preco > 0)) return '<span class="muted">—</span>';
        const tx = L.taxas(d, ch.id, ch.formaPadraoId); const a = L.analisarPreco(preco, custo, tx, d.cfg.itensPorPedido);
        const cls = !(custo > 0) ? '' : a.contribuicao < 0 ? 'crit' : a.margemContrib < margem - 1e-9 ? 'warn' : 'ok';
        return `${L.brl(preco)}<div class="tiny">${UI.pill(custo > 0 ? 'margem ' + L.pct(a.margemContrib, 0) : 'sem custo', cls)}</div><div class="tiny muted">mín. ${a.minimo ? L.brl(a.minimo) : '—'}${faixa ? ' · pior caso' : ''}</div>`;
      };
      const linV = L.ativos(d.variantes).map(v => { const c = L.custoVariante(d, s, v.id, 'medio'); return [esc(L.nomeVariante(d, v.id)), L.brl4(c.total)].concat(canais.map(ch => cel((v.precos || {})[ch.id], c.total, ch))); });
      const linC = L.ativos(d.combos).map(cb => { const c = L.custoCombo(d, s, cb.id, 'medio'); return ['Combo ' + esc(cb.nome), cb.tipo === 'livre' ? `${L.brl(c.min)} a ${L.brl(c.max)}` : L.brl(c.medio)].concat(canais.map(ch => cel((cb.precos || {})[ch.id], c.max, ch, cb.tipo === 'livre'))); });
      html += `<div class="card"><p class="muted small" style="margin-bottom:8px">Margem sobre o preço após custo completo (inclui seu trabalho estimado) e taxas do canal com a forma de pagamento mais comum. “Mín.” é o preço que zera a sobra. Meta: ${L.pct(margem, 0)}.</p>
        ${UI.tabela([{ t: 'Item' }, { t: 'Custo/un.', n: 1 }].concat(canais.map(c => ({ t: c.nome }))), linV.concat(linC), { vazio: UI.vazio('Nenhum item para precificar.') })}</div>`;
    } else if (sub === 'promos') {
      const lin = Object.values(d.promocoes).sort((a, b) => (b.inicio || '').localeCompare(a.inicio || '')).map(p => {
        const usos = Object.values(d.ops).filter(o => o.k === 'venda' && o.status !== 'cancelado').reduce((t, o) => t + L.sum(o.linhas.filter(l => l.promoId === p.id), l => l.qtd), 0);
        return { _cls: p.arquivado ? 'arq' : '', c: [esc(p.nome), esc(L.nomeItem(d, p.alvoTipo, p.alvoId)), p.canalId ? esc((d.canais[p.canalId] || {}).nome || '') : 'Todos', p.descTipo === 'pct' ? L.nf(p.desc) + '%' : L.brl(p.desc) + '/un.', p.kitVendaId ? esc((d.kits[p.kitVendaId] || {}).nome || '') : '—', `${L.fmtBR(p.inicio)} a ${p.fim ? L.fmtBR(p.fim) : 'sem fim'}`, p.ativa !== false ? UI.pill('disponível', 'ok') : UI.pill('pausada'), usos, `<button class="btn sm lk" data-a="simularPromo" data-id="${p.id}">Simular</button><button class="btn sm lk" data-a="editarPromo" data-id="${p.id}">Editar</button><button class="btn sm lk" data-a="arquivar" data-col="promocoes" data-id="${p.id}">${p.arquivado ? 'Reativar' : 'Arquivar'}</button>`] };
      });
      html += `<div class="card"><div class="card-h"><h2>Promoções</h2><button class="btn pri" data-a="novaPromo">+ Promoção</button></div><p class="muted small" style="margin-bottom:8px">Simule antes no Simulador. A promoção só é aplicada na linha de venda em que você a escolher.</p>${UI.tabela([{ t: 'Nome' }, { t: 'Item' }, { t: 'Canal' }, { t: 'Desconto' }, { t: 'Embalagem' }, { t: 'Período' }, { t: 'Situação' }, { t: 'Vendidos', n: 1 }, { t: '' }], lin, { vazio: UI.vazio('Nenhuma promoção cadastrada.') })}</div>`;
    } else {
      const ym = L.hoje().slice(0, 7); const r = L.rateioMensal(d, ym); const cfgR = d.cfg.rateio || {};
      html += `<div class="card"><h2>Despesas mensais no preço</h2><p class="muted small" style="margin:6px 0 12px">Opcional. Divide as despesas fixas do mês por uma quantidade planejada de vendas e soma ao custo nas simulações. A quantidade é uma premissa sua: o sistema não reduz o rateio para fazer a conta fechar.</p>
        ${UI.dl([['Despesas fixas consideradas em ' + L.nomeMes(ym), L.brl(r.total)], ['Vendas planejadas no mês', cfgR.vendasPlanejadas ? L.nf(cfgR.vendasPlanejadas, 0) + ' un.' : '<span class="muted">não informado</span>'], ['Parte por unidade vendida', r.vendas > 0 ? L.brl(r.porUnidade) : '—', 'tot']])}
        <div class="row" style="margin-top:12px"><button class="btn" data-a="editarRateio">Editar premissas</button></div>
        <div style="margin-top:14px">${UI.tabela([{ t: 'Despesa' }, { t: 'Categoria' }, { t: 'Valor', n: 1 }, { t: 'Situação' }], r.itens.map(i => [esc(i.descricao), esc(L.catDespesa(d, i.categoria).nome), L.brl(i.valor), i.lancado ? UI.pill('lançada', 'ok') : UI.pill('recorrente prevista', 'est')]), { vazio: UI.vazio('Nenhuma despesa fixa neste mês.', 'Cadastre recorrências em Financeiro.') })}</div>
        ${r.excluidas.length ? `<p class="tiny muted" style="margin-top:8px">Fora do rateio por já estarem no custo do produto (energia/gás): ${r.excluidas.map(i => esc(i.descricao) + ' ' + L.brl(i.valor)).join(', ')}.</p>` : ''}
        <p class="tiny muted" style="margin-top:6px">O valor da sua hora já está no custo do produto; se você também paga pró-labore, desmarque essa categoria nas premissas para não contar o trabalho duas vezes no preço.</p></div>`;
    }
    return html;
  };
  function resultadoSim(st) {
    const d = D(); const s = S();
    const [tipo, id] = (st.ref || '').split(':');
    if (!id) return '';
    if (!st.canalId || !d.canais[st.canalId]) return '<div class="card"><p class="muted">Escolha um canal. Cadastre canais em Configurações.</p></div>';
    const tx = L.taxas(d, st.canalId, st.formaId);
    const kit = st.kitId === '__padrao' ? undefined : st.kitId;
    let custo, composicao, faixa = null, custoDin;
    if (tipo === 'c') {
      const c = L.custoCombo(d, s, id, st.criterio, kit);
      custo = c.max; custoDin = c.m + c.e;
      faixa = d.combos[id].tipo === 'livre' ? c : null;
      composicao = UI.dl([['Produtos do combo (custo completo)', L.brl(c.medio - c.embalagem)], ['Embalagem do combo', L.brl(c.embalagem)]].concat(faixa ? [['Custo conforme a escolha', `${L.brl(c.min)} a ${L.brl(c.max)}`]] : []).concat([['Custo usado na conta' + (faixa ? ' (maior, por segurança)' : ''), L.brl(custo), 'tot']])) + (c.avisos.length ? `<div class="nota small">${c.avisos.map(esc).join('<br>')}</div>` : '');
    } else {
      const c = L.custoVariante(d, s, id, st.criterio, kit !== undefined ? { kitVendaId: kit } : {});
      custo = c.total; custoDin = c.m + c.e; composicao = UI.resumoCusto(c);
    }
    const rat = st.rateio ? L.rateioMensal(d, L.hoje().slice(0, 7)) : null;
    const rateio = rat && rat.ativo ? rat.porUnidade : 0;
    const margem = (N(st.margem) || 0) / 100;
    let preco, sugestao = '';
    if (st.modo === 'margem') {
      const sp = L.precoSugerido(custo, tx, margem, N(st.itensPorPedido), rateio);
      if (sp.preco === null) return `<div class="card"><div class="nota erro">${esc(sp.erro)}</div></div>`;
      preco = sp.preco;
      sugestao = `<div class="kpi"><div class="eyebrow">Preço sugerido</div><div class="v">${L.brl(preco)}</div><div class="d">= (custo ${L.brl(custo)} + taxas fixas ${L.brl(sp.F)}${rateio ? ' + despesas ' + L.brl(rateio) : ''}) ÷ (1 − taxas ${L.pct(tx.pEff)} − margem ${L.pct(margem)})</div></div>`;
    } else {
      preco = N(st.preco);
      if (!(preco > 0)) return '<div class="card"><p class="muted">Informe o preço a testar.</p></div>';
    }
    const desc = N(st.desc) || 0;
    const precoEf = desc > 0 ? Math.max(0, st.descTipo === 'pct' ? preco * (1 - desc / 100) : preco - desc) : preco;
    const a = L.analisarPreco(precoEf, custo, tx, N(st.itensPorPedido), rateio, custoDin);
    const md = (D().cfg.margemDesejada || 0) / 100;
    const alertas = [];
    if (a.contribuicao < 0) alertas.push(['alto', `Abaixo do custo: cada venda perde ${L.brl(-a.contribuicao)}.`]);
    else if (a.margemContrib < md - 1e-9) alertas.push(['medio', `Margem de ${L.pct(a.margemContrib)} abaixo da desejada (${L.pct(md)}).`]);
    if (rateio && a.lucro < 0) alertas.push(['medio', 'Cobre o custo, mas não a parte das despesas mensais.']);
    const markup = custo > 0 ? `Equivale a ${L.pct(a.markup, 0)} de acréscimo sobre o custo. Um acréscimo de ${L.pct(margem || md, 0)} sobre o custo daria só ${L.pct((margem || md) / (1 + (margem || md)), 1)} de margem.` : '';
    return `<div class="grid g2"><div class="card"><h2>Composição do custo</h2>${composicao}</div>
      <div class="card"><h2>Resultado por unidade</h2>${sugestao}
        ${UI.dl([
          ['Preço' + (desc ? ' com desconto' : ''), L.brl(precoEf) + (desc ? ` <span class="muted">(de ${L.brl(preco)})</span>` : '')],
          ['Taxas do canal e pagamento', '− ' + L.brl(a.taxasValor) + ` <span class="muted tiny">${L.pct(tx.pEff)}${tx.fixoPedido ? ' + ' + L.brl(tx.fixoPedido) + '/pedido' : ''}${tx.incluso ? ' · pagamento incluso na plataforma' : ''}</span>`],
          ['Custo completo', '− ' + L.brl(custo)],
          ['Sobra por unidade (contribuição antes das despesas fixas)', L.brl(a.contribuicao), 'tot'],
          ['Margem sobre o preço', L.pct(a.margemContrib)],
          a.contribDinheiro !== null ? ['Contribuição em dinheiro (sem seu trabalho estimado)', L.brl(a.contribDinheiro)] : null,
          rateio ? ['Parte das despesas mensais', '− ' + L.brl(rateio)] : null,
          rateio ? ['Lucro estimado completo', L.brl(a.lucro), 'tot'] : null,
          rateio ? ['Margem de lucro', L.pct(a.margemLucro)] : null,
          ['Preço mínimo (sobra zero)', a.minimo ? L.brl(a.minimo) : '—'],
          rateio ? ['Preço mínimo cobrindo as despesas', a.minimoRateio ? L.brl(a.minimoRateio) : '—'] : null,
        ])}
        ${alertas.map(([n, t]) => `<div class="alerta ${n}" style="margin-top:8px"><span class="ic">!</span><span>${esc(t)}</span></div>`).join('')}
        <p class="tiny muted" style="margin-top:8px">${esc(markup)} ${rat && st.rateio && !rat.ativo ? 'O rateio de despesas está desligado ou sem vendas planejadas.' : rat ? `Premissa: ${L.brl(rat.total)} de despesas ÷ ${L.nf(rat.vendas, 0)} vendas planejadas.` : ''}</p>
        <div class="row" style="margin-top:12px"><button class="btn pri" data-a="aplicarPreco" data-v="${L.r2(preco)}">Usar ${L.brl(L.r2(preco))} no ${esc(d.canais[st.canalId].nome)}</button>${desc > 0 ? '<button class="btn" data-a="salvarPromoSim">Salvar como promoção</button>' : ''}</div></div></div>`;
  }
  Object.assign(UI.acoes, {
    simModo: ds => { UI.pg.sim.modo = ds.v; UI.render(); },
    aplicarPreco: async ds => {
      const st = UI.pg.sim; const [tipo, id] = st.ref.split(':'); const col = tipo === 'c' ? 'combos' : 'variantes';
      const o = L.clone(D()[col][id]); o.precos = o.precos || {}; o.precos[st.canalId] = Number(ds.v);
      try { await UI.salvarCad(col, o); UI.toast('Preço atualizado. Vendas antigas mantêm o preço praticado.'); } catch (e) { UI.toast(e.message); }
    },
    salvarPromoSim: () => { const st = UI.pg.sim; const [tipo, id] = st.ref.split(':'); F.promocao(null, { alvoTipo: tipo, alvoId: id, canalId: st.canalId, descTipo: st.descTipo, desc: st.desc, kitVendaId: st.kitId === '__padrao' ? '' : st.kitId }); },
    novaPromo: () => F.promocao(null), editarPromo: ds => F.promocao(ds.id),
    simularPromo: ds => { const p = D().promocoes[ds.id]; const c = p.canalId || (L.ativos(D().canais)[0] || {}).id; UI.pg.sim = Object.assign(simPadrao(), { ref: p.alvoTipo + ':' + p.alvoId, canalId: c, formaId: (D().canais[c] || {}).formaPadraoId || '', modo: 'preco', preco: String(((p.alvoTipo === 'c' ? D().combos : D().variantes)[p.alvoId] || {}).precos?.[c] || ''), descTipo: p.descTipo, desc: String(p.desc), kitId: p.kitVendaId || '__padrao' }); UI.ir('precos', 'sim'); },
    editarRateio: () => {
      const r = L.clone(D().cfg.rateio || {});
      const st0 = { ativo: !!r.ativo, vendasPlanejadas: r.vendasPlanejadas || '', cats: {} };
      (D().cfg.categoriasDespesa || []).forEach(c => { st0.cats[c.id] = !r.categorias || !r.categorias.length || r.categorias.includes(c.id); });
      UI.abrir({
        titulo: 'Premissas das despesas no preço',
        corpo: st => `${UI.chk(st, 'ativo', 'Considerar despesas mensais nas simulações de preço')}
          ${UI.campo(st, 'vendasPlanejadas', 'Vendas planejadas por mês (unidades ou combos)', { tipo: 'int' })}
          <div class="f"><span>Categorias consideradas</span>${(D().cfg.categoriasDespesa || []).filter(c => c.especial !== 'energia' && c.especial !== 'gas').map(c => UI.chk(st, 'cats.' + c.id, esc(c.nome))).join('')}</div>`,
        salvar: async st => {
          const cfg = L.clone(D().cfg); const v = N(st.vendasPlanejadas);
          if (st.ativo && !(v > 0)) UI.falha('Informe as vendas planejadas.');
          cfg.rateio = { ativo: !!st.ativo, vendasPlanejadas: v > 0 ? Math.round(v) : null, categorias: Object.entries(st.cats).filter(([, x]) => x).map(([k]) => k) };
          await L.Store.salvarConfig(cfg); return 'Premissas salvas.';
        },
      }, st0);
    },
  });

  // ================= FINANCEIRO =================
  V.financeiro = function () {
    const sub = UI.subAtual('financeiro', 'resumo');
    const d = D(); const hoje = L.hoje();
    let html = topo('Financeiro', `<button class="btn" data-a="novoLanc">Novo lançamento</button><button class="btn pri" data-a="novaDespesa">Lançar despesa</button>`)
      + UI.subtabs('financeiro', [['resumo', 'Resumo'], ['contas', 'Contas a pagar e receber'], ['lanc', 'Lançamentos'], ['rec', 'Recorrências'], ['inv', 'Investimento'], ['energia', 'Energia e gás']]);
    const { pend, caixa } = L.fluxo(d);
    if (sub === 'resumo') {
      const saldo = L.saldoCaixa(d, hoje);
      const aRec = pend.filter(p => p.lado === 'receber'), aPag = pend.filter(p => p.lado === 'pagar');
      const atrR = L.sum(aRec.filter(p => p.venc < hoje), p => p.valor), atrP = L.sum(aPag.filter(p => p.venc < hoje), p => p.valor);
      const ym = hoje.slice(0, 7);
      const R = L.resultado(d, ym + '-01', ym + '-' + String(L.diasNoMes(ym)).padStart(2, '0'));
      const prev = L.previsao(d, hoje, 6);
      const recs = L.recorrenciasPendentes(d, ym);
      html += `<div class="grid g4">${UI.kpi('Caixa disponível hoje', L.brl(saldo), 'Saldo inicial + entradas − saídas já ocorridas')}${UI.kpi('A receber', L.brl(L.sum(aRec, p => p.valor)), atrR ? `<span style="color:var(--crit)">${L.brl(atrR)} atrasado</span>` : 'Nada atrasado')}${UI.kpi('A pagar', L.brl(L.sum(aPag, p => p.valor)), atrP ? `<span style="color:var(--crit)">${L.brl(atrP)} atrasado</span>` : 'Nada atrasado')}${UI.kpi('Resultado de ' + L.nomeMesCurto(ym), L.brl(R.resultado), 'Lucro por competência, não é caixa')}</div>
        <div class="nota small">Caixa é o dinheiro disponível. Resultado é o que o mês gerou: vendas menos custos dos produtos vendidos e despesas. Uma compra de estoque reduz o caixa quando é paga, mas só vira custo quando o produto é vendido.</div>
        ${recs.length ? `<div class="card"><div class="card-h"><h2>Contas recorrentes de ${esc(L.nomeMes(ym))} ainda não lançadas</h2><button class="btn sm" data-a="lancarTodasRec">Lançar todas</button></div>${UI.tabela([{ t: 'Descrição' }, { t: 'Vencimento' }, { t: 'Valor', n: 1 }, { t: '' }], recs.map(r => [esc(r.descricao), L.fmtBR(r.venc), L.brl(r.valor), `<button class="btn sm" data-a="lancarRec" data-id="${r.recorrenciaId}">Lançar</button>`]))}</div>` : ''}
        <div class="card"><h2>Previsão de caixa</h2><p class="muted small" style="margin:4px 0 10px">Parte do caixa de hoje e soma o que vence em cada mês (contas lançadas e recorrências). O primeiro mês inclui valores atrasados.</p>
          ${graficoPrevisao(prev)}${UI.tabela([{ t: 'Mês' }, { t: 'Entradas previstas', n: 1 }, { t: 'Saídas previstas', n: 1 }, { t: 'Saldo projetado', n: 1 }], prev.map(p => [esc(L.nomeMes(p.ym)), L.brl(p.entra), L.brl(p.sai), `<strong style="color:${p.saldo < 0 ? 'var(--crit)' : 'inherit'}">${L.brl(p.saldo)}</strong>`]))}</div>
        <div class="card"><h2>Resultado de ${esc(L.nomeMes(ym))}</h2>${UI.dre(R)}</div>`;
    } else if (sub === 'contas') {
      const linha = p => [`${L.fmtBR(p.venc)} ${p.venc < hoje ? UI.pill('atrasado', 'crit') : L.diffDias(hoje, p.venc) <= (d.cfg.alertaDiasContas || 0) ? UI.pill('em breve', 'warn') : ''}`, esc(p.desc), p.total !== p.valor ? `${L.brl(p.valor)} <span class="tiny muted">de ${L.brl(p.total)}</span>` : L.brl(p.valor), `<button class="btn sm" data-a="pagar" data-op="${p.op}" data-p="${p.parcela}">${p.lado === 'pagar' ? 'Pagar' : 'Receber'}</button>`];
      html += `<div class="card"><h2>A pagar</h2>${UI.tabela([{ t: 'Vencimento' }, { t: 'Descrição' }, { t: 'Em aberto', n: 1 }, { t: '' }], pend.filter(p => p.lado === 'pagar').map(linha), { vazio: UI.vazio('Nenhuma conta em aberto.') })}</div>
        <div class="card"><h2>A receber</h2>${UI.tabela([{ t: 'Previsto' }, { t: 'Descrição' }, { t: 'Em aberto', n: 1 }, { t: '' }], pend.filter(p => p.lado === 'receber').map(linha), { vazio: UI.vazio('Nada a receber.') })}</div>
        <div class="card"><h2>Movimentos de caixa recentes</h2>${UI.tabela([{ t: 'Data' }, { t: 'Descrição' }, { t: 'Grupo' }, { t: 'Valor', n: 1 }], caixa.slice(-60).reverse().map(c => [L.fmtBR(c.data), esc(c.desc), { operacional: 'Operação', aporte: 'Aporte', retirada: 'Devolução', investimento: 'Investimento', saldo: 'Saldo inicial' }[c.grupo] || c.grupo, `<span style="color:${c.valor < 0 ? 'var(--crit)' : 'var(--ok)'}">${L.brl(c.valor)}</span>`]), { vazio: UI.vazio('Nenhum movimento de caixa.') })}</div>`;
    } else if (sub === 'lanc') {
      const ym = UI.pg.fin.mes || hoje.slice(0, 7);
      const ops = Object.values(d.ops).filter(o => o.k === 'lanc' && (o.competencia || o.data).slice(0, 7) === ym).sort((a, b) => b.competencia.localeCompare(a.competencia));
      const nat = { despesa: 'Despesa', aporte: 'Aporte', investimento: 'Investimento', retirada: 'Devolução', receita: 'Outra entrada' };
      html += `<div class="card"><label class="f" style="max-width:220px"><span>Mês de referência</span><input type="month" id="pgFinMes" data-b="fin.mes" value="${ym}"></label></div>
        <div class="card">${UI.tabela([{ t: 'Data' }, { t: 'Tipo' }, { t: 'Descrição' }, { t: 'Categoria' }, { t: 'Valor', n: 1 }, { t: 'Situação' }, { t: '' }], ops.map(o => {
          const pago = L.sum(o.parcelas, p => L.sum(p.pagos, g => g.valor));
          const sit = o.origem === 'proprietaria' ? UI.pill('bem da proprietária', 'est') : pago >= o.total - 0.004 ? UI.pill('quitado', 'ok') : UI.pill(L.brl(o.total - pago) + ' em aberto', 'warn');
          return { _cls: o.status === 'cancelado' ? 'cancel' : '', c: [L.fmtBR(o.competencia), nat[o.natureza], esc(o.descricao) + (o.parcelas.length > 1 ? ` <span class="tiny muted">${o.parcelas.length} parcelas</span>` : ''), o.natureza === 'despesa' ? esc(L.catDespesa(d, o.categoria).nome) : (o.tipoInvestimento || ''), L.brl(o.total), sit, o.status === 'cancelado' ? `<button class="btn sm lk" data-a="reativarOp" data-id="${o.id}">Reativar</button>` : `<button class="btn sm lk" data-a="editarLanc" data-id="${o.id}">Editar</button><button class="btn sm lk" data-a="cancelarOp" data-id="${o.id}">Cancelar</button>`] };
        }), { vazio: UI.vazio('Nenhum lançamento neste mês.', 'Compras de ingredientes ficam em Compras; vendas, em Vendas diárias.') })}</div>`;
    } else if (sub === 'rec') {
      const lin = Object.values(d.recorrencias).map(r => ({ _cls: r.arquivado || r.ativa === false ? 'arq' : '', c: [esc(r.descricao), r.natureza === 'despesa' ? esc(L.catDespesa(d, r.categoria).nome) : r.natureza, L.brl(r.valor), 'dia ' + r.dia + (r.intervaloMeses > 1 ? `, a cada ${r.intervaloMeses} meses` : ', todo mês'), `${r.inicio}${r.fim ? ' a ' + r.fim : ''}`, `<button class="btn sm lk" data-a="editarRec" data-id="${r.id}">Editar</button><button class="btn sm lk" data-a="arquivar" data-col="recorrencias" data-id="${r.id}">${r.arquivado ? 'Reativar' : 'Arquivar'}</button>`] }));
      html += `<div class="card"><div class="card-h"><h2>Contas recorrentes</h2><button class="btn pri" data-a="novaRec">+ Recorrência</button></div><p class="muted small" style="margin-bottom:8px">Ex.: tráfego pago, Canva, aplicativos de IA, parte da conta de luz. Pró-labore começa em zero; cadastre quando decidir começar as retiradas.</p>${UI.tabela([{ t: 'Descrição' }, { t: 'Categoria' }, { t: 'Valor', n: 1 }, { t: 'Vencimento' }, { t: 'Período' }, { t: '' }], lin, { vazio: UI.vazio('Nenhuma recorrência.') })}</div>`;
    } else if (sub === 'inv') {
      const r = L.recuperacao(d, hoje);
      const ops = Object.values(d.ops).filter(o => o.k === 'lanc' && ['aporte', 'investimento', 'retirada'].includes(o.natureza)).sort((a, b) => b.competencia.localeCompare(a.competencia));
      const nat = { aporte: 'Aporte', investimento: 'Investimento', retirada: 'Devolução' };
      html += `<div class="grid g4">${UI.kpi('Total investido pela proprietária', L.brl(r.investido), `Aportes ${L.brl(r.aportes)} · bens ${L.brl(r.emBens)}${d.cfg.saldoInicialEhAporte && d.cfg.saldoInicial ? ' · saldo inicial ' + L.brl(d.cfg.saldoInicial) : ''}`)}${UI.kpi('Já devolvido em dinheiro', L.brl(r.devolvido), 'Retiradas registradas como devolução')}${UI.kpi('Falta recuperar', L.brl(r.falta))}${UI.kpi('Disponível para recuperação', L.brl(r.disponivel), 'Caixa da operação − reinvestimentos − devoluções')}</div>
        <div class="card"><h2>Como está a recuperação</h2>${UI.dl([
          ['Caixa gerado pela operação (recebimentos − pagamentos de compras e despesas)', L.brl(r.operacional)],
          ['Reinvestido em equipamentos e estrutura com dinheiro do negócio', L.brl(r.reinvestido)],
          ['Devolvido à proprietária', L.brl(r.devolvido)],
          ['Lucro gerado desde o início (competência)', r.lucroAcumulado !== null ? L.brl(r.lucroAcumulado) : '<span class="muted">informe o início das operações</span>'],
          ['Prazo estimado para recuperar', r.prazoMeses !== null ? `${r.prazoMeses} ${r.prazoMeses === 1 ? 'mês' : 'meses'}` : '<span class="muted">dados insuficientes</span>', 'tot'],
        ])}<p class="tiny muted" style="margin-top:8px">Lucro gerado não é dinheiro devolvido: a recuperação só conta quando você registra uma devolução. Reinvestir não é recuperar. ${r.prazoMeses !== null ? `Prazo = (falta recuperar − disponível) ÷ média do caixa da operação de ${r.mesesBase.map(L.nomeMesCurto).join(', ')} (${L.brl(r.media)}/mês).` : 'O prazo aparece com pelo menos dois meses completos de caixa da operação positivo.'}</p></div>
        <div class="card"><div class="card-h"><h2>Aportes, investimentos e devoluções</h2><div class="row"><button class="btn sm" data-a="novoLanc" data-n="aporte">+ Aporte</button><button class="btn sm" data-a="novoLanc" data-n="investimento">+ Investimento</button><button class="btn sm" data-a="novoLanc" data-n="retirada">+ Devolução</button></div></div>
          ${UI.tabela([{ t: 'Data' }, { t: 'Tipo' }, { t: 'Descrição' }, { t: 'Valor', n: 1 }, { t: 'Origem' }, { t: '' }], ops.map(o => ({ _cls: o.status === 'cancelado' ? 'cancel' : '', c: [L.fmtBR(o.competencia), nat[o.natureza], esc(o.descricao) + (o.vidaUtilMeses ? ` <span class="tiny muted">vida útil ${o.vidaUtilMeses} meses</span>` : ''), L.brl(o.total), o.natureza === 'investimento' ? (o.origem === 'proprietaria' ? 'bem da proprietária' : 'reinvestimento (caixa)') : '', `<button class="btn sm lk" data-a="editarLanc" data-id="${o.id}">Editar</button>`] })), { vazio: UI.vazio('Nada registrado.', 'Registre o investimento inicial: equipamentos, utensílios e aportes em dinheiro.') })}</div>`;
    } else {
      const meses = [0, 1, 2, 3, 4, 5].map(i => L.addMesYM(hoje.slice(0, 7), -i));
      const lin = meses.map(ym => {
        const R = L.resultado(d, ym + '-01', ym + '-' + String(L.diasNoMes(ym)).padStart(2, '0'));
        return [esc(L.nomeMes(ym)), L.nf(R.kwh, 2) + ' kWh', L.nf(R.gas, 3) + ' ' + esc(d.cfg.unidadeGas), L.brl(R.energiaProduzida), R.energiaReal ? L.brl(R.energiaReal) : '—', R.gasReal ? L.brl(R.gasReal) : '—', `<button class="btn sm lk" data-a="contaEnergia" data-t="energia" data-m="${ym}">Luz</button><button class="btn sm lk" data-a="contaEnergia" data-t="gas" data-m="${ym}">Gás</button>`];
      });
      html += `<div class="card"><h2>Energia e gás da confeitaria</h2><p class="muted small" style="margin:4px 0 10px">O consumo vem das fornadas registradas (estimativa: potência × tempo × fator × tarifa). A conta da casa é compartilhada: lance como despesa só a parte da confeitaria. No resultado do mês, a parte real lançada substitui a estimativa; as duas nunca são somadas.</p>
        ${UI.tabela([{ t: 'Mês' }, { t: 'Energia estimada', n: 1 }, { t: 'Gás estimado', n: 1 }, { t: 'Custo estimado nas fornadas', n: 1 }, { t: 'Luz lançada', n: 1 }, { t: 'Gás lançado', n: 1 }, { t: 'Separar conta' }], lin)}</div>`;
    }
    return html;
  };
  function graficoPrevisao(prev) {
    const W = 640, H = 170, pad = { l: 64, r: 10, t: 14, b: 26 };
    const vals = prev.map(p => p.saldo); const max = Math.max(0, ...vals), min = Math.min(0, ...vals);
    if (max === min) return '';
    const y = v => pad.t + (max - v) / (max - min) * (H - pad.t - pad.b);
    const bw = (W - pad.l - pad.r) / prev.length;
    const ticks = [max, (max + min) / 2, min];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo projetado por mês">${ticks.map(t => `<line class="grade" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${esc(L.brl(t).replace(',00', ''))}</text>`).join('')}
      ${prev.map((p, i) => { const x = pad.l + i * bw + bw * 0.2, w = bw * 0.6, y0 = y(0), y1 = y(p.saldo); return `<rect class="barra-m" x="${x}" y="${Math.min(y0, y1)}" width="${w}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="3" style="${p.saldo < 0 ? 'fill:var(--crit)' : ''}"><title>${esc(L.nomeMes(p.ym))}: ${esc(L.brl(p.saldo))}</title></rect><text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(L.nomeMesCurto(p.ym))}</text>`; }).join('')}</svg>`;
  }
  UI.dre = function (R) {
    const d = D();
    const desp = Object.entries(R.despesas).map(([k, v]) => [esc(L.catDespesa(d, k).nome), '− ' + L.brl(v)]);
    return UI.dl([
      ['Faturamento bruto de produtos', L.brl(R.bruto)], R.descontos ? ['Descontos', '− ' + L.brl(R.descontos)] : null,
      ['Vendas de produtos', L.brl(R.produtos)], R.entregaCobrada ? ['Taxas de entrega cobradas', L.brl(R.entregaCobrada)] : null,
      ['Taxas de canais e pagamentos', '− ' + L.brl(R.taxas)], ['Vendas líquidas', L.brl(R.vendasLiquidas), 'tot'],
      ['Custo dos produtos vendidos — ingredientes e embalagens', '− ' + L.brl(R.cmvM)],
      [R.usaEnergiaReal ? 'Energia/gás: parte real lançada da conta' : 'Energia/gás: estimativa das fornadas vendidas', '− ' + L.brl(R.energiaNoResultado)],
      R.perdasM ? ['Perdas reais (materiais)', '− ' + L.brl(R.perdasM)] : null,
      R.ajustes ? ['Ajustes de estoque', (R.ajustes < 0 ? '− ' : '+ ') + L.brl(Math.abs(R.ajustes))] : null,
      R.custoEntrega ? ['Custo de entrega própria', '− ' + L.brl(R.custoEntrega)] : null,
      R.impostos ? ['Impostos configurados', '− ' + L.brl(R.impostos)] : null,
      ['Contribuição (antes das despesas fixas)', L.brl(R.contribuicao), 'tot'],
      ...desp,
      R.outrasReceitas ? ['Outras entradas', L.brl(R.outrasReceitas)] : null,
      R.depreciacao ? ['Depreciação de equipamentos', '− ' + L.brl(R.depreciacao)] : null,
      ['Resultado operacional', `<strong>${L.brl(R.resultado)}</strong>`, 'tot'],
      ['Seu trabalho estimado no período (não é despesa paga)', L.brl(R.trabalhoEstimado)],
      R.prolabore ? ['Pró-labore efetivamente lançado', L.brl(R.prolabore)] : null,
    ]) + `<p class="tiny muted" style="margin-top:8px">${R.usaEnergiaReal ? `A estimativa de energia dos produtos vendidos (${L.brl(R.energiaEstimada)}) foi trocada pela parte real da conta, para não contar duas vezes.` : 'Energia/gás estimados pelas fornadas; ao lançar a parte real da conta do mês, ela substitui a estimativa.'} O valor da sua hora usado no preço não é descontado aqui, porque não é dinheiro pago; pró-labore pago entra como despesa.</p>`;
  };
  Object.assign(UI.acoes, {
    novoLanc: ds => F.lancamento(null, ds && ds.n ? { natureza: ds.n } : undefined), editarLanc: ds => F.lancamento(ds.id),
    novaRec: () => F.recorrencia(null), editarRec: ds => F.recorrencia(ds.id),
    lancarRec: ds => { const r = L.recorrenciasPendentes(D(), L.hoje().slice(0, 7)).find(x => x.recorrenciaId === ds.id); if (r) F.lancarRecorrencia(r); },
    lancarTodasRec: async () => { for (const r of L.recorrenciasPendentes(D(), L.hoje().slice(0, 7))) await F.lancarRecorrencia(r); },
    contaEnergia: ds => F.contaEnergia(ds.t, ds.m),
  });
})(globalThis.L = globalThis.L || {});
