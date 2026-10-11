/* LEORA — telas das seções. */
(function (L) {
  'use strict';
  const UI = L.UI; const esc = UI.esc; const F = UI.forms; const N = L.num; const V = UI.views;
  const D = () => UI.D(); const S = () => UI.S();
  UI.pg = { sim: null, imp: { insumoId: '', preco: '', criterio: 'medio' }, meta: { ym: null, lucro: '', itemId: '', canalId: '' }, vendas: { data: null }, fin: { mes: null } };
  UI.paginaInput = el => { UI.setPath(UI.pg, el.dataset.b, el.type === 'checkbox' ? el.checked : el.value); if (UI.pgAtualizar) UI.pgAtualizar(); };
  UI.paginaChange = el => {
    UI.setPath(UI.pg, el.dataset.b, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.b === 'sim.canalId') { const c = UI.D().canais[UI.pg.sim.canalId]; if (c && c.formaPadraoId) UI.pg.sim.formaId = c.formaPadraoId; }
    if (el.dataset.salvar && UI.acoes[el.dataset.salvar]) UI.acoes[el.dataset.salvar](el); else UI.render();
  };
  const topo = (titulo, extra) => `<div class="topo"><div><div class="eyebrow">${esc(L.fmtBR(L.hoje()))}</div><h1>${esc(titulo)}</h1></div><div class="row">${extra || ''}</div></div>`;
  const acoesOp = (op, editar) => op.status === 'cancelado'
    ? `<button class="btn sm lk" data-a="reativarOp" data-id="${op.id}">Reativar</button>`
    : `${editar ? `<button class="btn sm lk" data-a="${editar}" data-id="${op.id}">Editar</button>` : ''}<button class="btn sm lk" data-a="cancelarOp" data-id="${op.id}">Cancelar</button><button class="btn sm lk" data-a="historicoOp" data-id="${op.id}">Histórico</button>`;
  const statusCls = op => op.status === 'cancelado' ? 'cancel' : '';
  const opsDe = (k, f) => Object.values(D().ops).filter(o => o.k === k && (!f || f(o))).sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
  const validadePill = (validade, ref) => {
    if (!validade) return UI.pill('sem validade');
    const d = L.diffDias(ref || L.hoje(), validade);
    if (d < 0) return UI.pill('vencido ' + L.fmtBR(validade), 'crit');
    if (d <= (Number(D().cfg.alertaDiasLotes) || 0)) return UI.pill('vence ' + L.fmtBR(validade), 'warn');
    return UI.pill('até ' + L.fmtBR(validade), 'ok');
  };
  UI.validadePill = validadePill;

  // ================= VISÃO GERAL =================
  V.inicio = function () {
    const d = D(); const s = S(); const hoje = L.hoje();
    const vazio = !Object.keys(d.insumos).length && !Object.keys(d.produtos).length && !Object.keys(d.ops).length;
    if (vazio && L.Store.modo !== 'demo') return topo('Visão geral') + boasVindas();
    const ym = hoje.slice(0, 7);
    const mi = L.metaInfo(d, ym, hoje);
    const caixa = L.saldoCaixa(d, hoje);
    const { pend } = L.fluxo(d);
    const lim = L.addDias(hoje, 30);
    const aRec = L.sum(pend.filter(p => p.lado === 'receber'), p => p.valor);
    const aPag30 = L.sum(pend.filter(p => p.lado === 'pagar' && p.venc <= lim), p => p.valor);
    const R = L.resultado(d, ym + '-01', hoje);
    const al = L.alertas(d, s, hoje);
    const acoes = [
      ['venda', 'Registrar venda', 'novaVenda', 'pri'], ['fornada', 'Registrar fornada', 'novaFornada'], ['massa', 'Produzir massa', 'novaProducao'],
      ['compra', 'Registrar compra', 'novaCompra'], ['despesa', 'Lançar despesa', 'novaDespesa'], ['perda', 'Registrar perda', 'novaPerda'],
    ].map(([ic, t, a, c]) => `<button class="acao ${c || ''}" data-a="${a}">${UI.ic(ic)}<span>${t}</span></button>`).join('');
    return `${topo('Visão geral')}
      <div class="acoes-rapidas">${acoes}</div>
      ${cardMeta(mi)}
      <div class="grid g4">${UI.kpi('Caixa disponível', L.brl(caixa), 'Dinheiro que já entrou menos o que já saiu')}${UI.kpi('A receber', L.brl(aRec), 'Vendas e repasses ainda não recebidos')}${UI.kpi('A pagar em 30 dias', L.brl(aPag30), 'Contas e parcelas em aberto, inclusive atrasadas')}${UI.kpi('Resultado do mês até hoje', L.brl(R.resultado), 'Por competência; não é dinheiro em caixa')}</div>
      <div class="grid g2"><div class="card"><div class="card-h"><h2>Alertas</h2><span class="muted small">${al.length} ${al.length === 1 ? 'item' : 'itens'}</span></div>${UI.alertasHTML(al.slice(0, 12))}${al.length > 12 ? `<p class="muted small" style="margin-top:8px">E mais ${al.length - 12}.</p>` : ''}</div>
      <div class="card"><div class="card-h"><h2>Pronto para vender</h2><button class="btn sm lk" data-a="ir" data-r="producao" data-s="estoque">Ver estoque</button></div>${tabelaProntos()}</div></div>`;
  };
  function boasVindas() {
    const passos = [
      ['Configurações gerais', 'Valor da sua hora, tarifa de energia, margem desejada e saldo inicial.', 'config', 'abrirConfig'],
      ['Canais e formas de pagamento', 'WhatsApp, iFood, Pix, crédito… com as taxas do seu contrato.', 'config', null],
      ['Forno', 'Potência do forno elétrico e pré-aquecimento.', 'config', null],
      ['Ingredientes e embalagens', 'Cadastre uma vez; os preços vêm das compras.', 'compras', null],
      ['Produtos, sabores e tamanhos', 'Peso, validade do assado, embalagem de venda e preços.', 'produtos', null],
      ['Receitas', 'Receita base, adicionais de cada sabor e rendimento real.', 'produtos', null],
      ['Meta do mês', 'Faturamento desejado e dias de folga.', 'metas', null],
    ];
    return `<div class="card"><h2>Bem-vinda ao sistema da LEORA</h2><p class="muted" style="margin-top:6px">O sistema começa vazio, sem dados inventados. Siga os passos abaixo; depois a rotina diária é registrar vendas, fornadas, compras e despesas pela tela inicial.</p>
      <div class="stack" style="margin-top:14px">${passos.map((p, i) => `<div class="row between" style="padding:10px 0;border-top:1px solid var(--line)"><div style="min-width:0;flex:1 1 240px"><strong>${i + 1}. ${p[0]}</strong><div class="muted small">${p[1]}</div></div><button class="btn sm" data-a="${p[3] || 'ir'}" data-r="${p[2]}">Abrir</button></div>`).join('')}</div>
      <div class="nota" style="margin-top:14px">Quer ver o sistema funcionando antes? <button class="btn sm" data-a="entrarDemo">Abrir demonstração</button> Os dados de exemplo ficam só na memória e não se misturam aos seus.</div></div>`;
  }
  function cardMeta(mi) {
    const d = D();
    if (!(mi.meta > 0)) return `<div class="card"><div class="row between"><div><h2>Meta de ${esc(L.nomeMes(mi.ym))}</h2><p class="muted small">Defina a meta de faturamento de produtos para acompanhar o valor a vender por dia.</p></div><button class="btn" data-a="ir" data-r="metas">Definir meta</button></div></div>`;
    let hojeTxt;
    if (mi.atingida) hojeTxt = `<div class="alerta ok"><span class="ic">✓</span><span>Meta atingida: ${L.brl(mi.realizado)} de ${L.brl(mi.meta)} (${L.pct(mi.pctAlcancado, 0)}).</span></div>`;
    else if (mi.semDias) hojeTxt = `<div class="alerta alto"><span class="ic">!</span><span>Não há mais dias de venda no mês e faltam ${L.brl(mi.restante)}. Ajuste a meta ou libere um dia no calendário.</span></div>`;
    else if (!mi.hojeEhDiaDeVenda) hojeTxt = `<div class="nota">Hoje está marcado como folga. ${mi.porDiaDepois !== null ? `Nos próximos ${mi.diasDepoisDeHoje} dias de venda: ${L.brl(mi.porDiaDepois)} por dia.` : ''}</div>`;
    else {
      const tr = L.traduzirValor(d, S(), mi.faltaHoje, d.cfg.mix);
      hojeTxt = `<div class="grid g3"><div><div class="eyebrow">Vender hoje</div><div class="kpi"><div class="v">${L.brl(mi.faltaHoje)}</div><div class="d">Meta do dia ${L.brl(mi.metaHoje)} · vendido hoje ${L.brl(mi.vendasHoje)}</div></div></div>
        <div style="grid-column: span 2; min-width:0">${mi.faltaHoje <= 0 ? '<div class="alerta ok"><span class="ic">✓</span><span>Meta de hoje cumprida.</span></div>' : tr.ok ? `<div class="eyebrow">Equivale a aproximadamente</div><div class="small">${tr.itens.map(i => `<strong>${i.qtd}</strong> ${esc(i.nome)} <span class="muted">(${esc(i.canal)}, ${L.brl(i.preco)})</span>`).join(' · ')}</div><p class="tiny muted">Pela mistura planejada de vendas (preço médio ${L.brl(tr.precoMedio)}), arredondado para cima. Com outra mistura o número muda.</p>` : `<p class="small muted">${esc(tr.erro)} <button class="btn sm lk" data-a="ir" data-r="metas">Montar mistura</button></p>`}</div></div>`;
    }
    return `<div class="card"><div class="card-h"><h2>Meta de ${esc(L.nomeMes(mi.ym))}</h2><span class="small muted">${L.brl(mi.realizado)} de ${L.brl(mi.meta)} · ${L.pct(mi.pctAlcancado, 0)}</span></div>
      ${UI.barra(mi.pctAlcancado, mi.atingida)}
      <div class="row small muted" style="margin:8px 0 12px;gap:18px"><span>Falta no mês: <strong>${L.brl(mi.restante)}</strong></span><span>Dias de venda restantes (com hoje): <strong>${mi.diasRestantes}</strong></span></div>${hojeTxt}</div>`;
  }
  function tabelaProntos() {
    const s = S(); const hoje = L.hoje(); const por = {};
    for (const l of Object.values(s.lotes)) {
      if (l.saldo <= 0 || l.orfao) continue;
      const k = l.varianteId; por[k] = por[k] || { assado: 0, massa: 0, venc: null };
      if (L.vencido(l, hoje)) continue;
      por[k][l.estado] += l.saldo;
      if (l.validade && (!por[k].venc || l.validade < por[k].venc)) por[k].venc = l.validade;
    }
    const lin = Object.entries(por).filter(([, v]) => v.assado + v.massa > 0).sort((a, b) => L.nomeVariante(D(), a[0]).localeCompare(L.nomeVariante(D(), b[0])))
      .map(([id, v]) => [esc(L.nomeVariante(D(), id)), L.nf(v.assado, 0), L.nf(v.massa, 0), v.venc ? validadePill(v.venc) : '']);
    return UI.tabela([{ t: 'Item' }, { t: 'Assados', n: 1 }, { t: 'Massa congelada', n: 1 }, { t: 'Próxima validade' }], lin, { vazio: UI.vazio('Nenhum cookie ou massa em estoque.', 'Registre uma produção de massa ou uma fornada.') });
  }
  UI.acoes.novaVenda = () => F.venda(null);
  UI.acoes.novaFornada = () => F.fornada(null);
  UI.acoes.novaProducao = () => F.producao(null);
  UI.acoes.novaCompra = () => F.compra(null);
  UI.acoes.novaDespesa = () => F.lancamento(null);
  UI.acoes.novaPerda = () => F.perda();
  UI.acoes.novoAjuste = () => F.ajuste();
  UI.acoes.abrirConfig = () => { UI.ir('config'); F.config(); };
  UI.acoes.historicoOp = ds => {
    const op = D().ops[ds.id]; if (!op) return;
    UI.abrir({ titulo: 'Histórico do registro', largura: 'estreita', corpo: () => `<div class="stack">${(op.historico || []).map(h => `<div class="small"><strong>${esc(h.acao)}</strong> · ${esc(new Date(h.em).toLocaleString('pt-BR', { timeZone: L.TZ }))}${h.antes ? `<div class="tiny muted">Antes: ${esc(resumoHist(h.antes))}</div>` : ''}</div>`).join('') || '<p class="muted">Sem histórico.</p>'}</div><p class="tiny muted">Situação atual: ${op.status === 'cancelado' ? 'cancelado' : 'ativo'}.</p>` }, {});
  };
  function resumoHist(a) {
    if (a.k === 'venda') return `${L.fmtBR(a.data)} · ${a.linhas.length} linha(s) · ${L.brl(L.sum(a.linhas, l => l.qtd * l.precoUnit - (l.desconto || 0)))}`;
    if (a.k === 'compra') return `${L.fmtBR(a.data)} · ${L.brl(a.total)} · ${a.itens.length} item(ns)`;
    if (a.k === 'lanc') return `${a.descricao} · ${L.brl(a.total)}`;
    return L.fmtBR(a.data);
  }

  // ================= VENDAS =================
  V.vendas = function () {
    const sub = UI.subAtual('vendas', 'dia');
    let html = topo('Vendas diárias', `<button class="btn pri" data-a="novaVenda">Registrar vendas</button>`) + UI.subtabs('vendas', [['dia', 'Por dia'], ['mes', 'Mês'], ['receb', 'Recebimentos']]);
    if (sub === 'dia') {
      const dia = UI.pg.vendas.data || L.hoje();
      const ops = opsDe('venda', o => o.data === dia);
      const ativas = ops.filter(o => o.status !== 'cancelado');
      const tot = L.sum(ativas, o => L.calcVenda(D(), o).produtos);
      const liq = L.sum(ativas, o => L.calcVenda(D(), o).liquido);
      html += `<div class="card"><div class="row between"><label class="f" style="max-width:220px"><span>Dia</span><input type="date" id="pgVendasData" data-b="vendas.data" value="${dia}"></label>
        <div class="row small"><span>Vendas de produtos: <strong>${L.brl(tot)}</strong></span><span>Líquido: <strong>${L.brl(liq)}</strong></span></div></div></div>`;
      html += ops.length ? ops.map(cardVenda).join('') : `<div class="card">${UI.vazio('Nenhuma venda registrada neste dia.', '', '<button class="btn pri" data-a="novaVenda">Registrar vendas</button>')}</div>`;
    } else if (sub === 'mes') {
      const ym = (UI.pg.vendas.mes || L.hoje().slice(0, 7));
      const ops = opsDe('venda', o => o.data.slice(0, 7) === ym && o.status !== 'cancelado');
      const porDia = {};
      for (const o of ops) { const cv = L.calcVenda(D(), o); const p = porDia[o.data] = porDia[o.data] || { prod: 0, tax: 0, liq: 0, un: 0 }; p.prod += cv.produtos; p.tax += cv.taxas; p.liq += cv.liquido; p.un += L.sum(o.linhas, l => l.unidades); }
      const lin = Object.entries(porDia).sort().reverse().map(([dt, p]) => [`<button class="btn sm lk" data-a="verDia" data-d="${dt}">${L.fmtBR(dt)}</button>`, L.nf(p.un, 0), L.brl(p.prod), L.brl(p.tax), L.brl(p.liq)]);
      html += `<div class="card"><label class="f" style="max-width:220px"><span>Mês</span><input type="month" id="pgVendasMes" data-b="vendas.mes" value="${ym}"></label></div>
        <div class="card">${UI.tabela([{ t: 'Dia' }, { t: 'Cookies', n: 1 }, { t: 'Produtos', n: 1 }, { t: 'Taxas', n: 1 }, { t: 'Líquido', n: 1 }], lin, { vazio: UI.vazio('Sem vendas neste mês.') })}</div>`;
    } else {
      const { pend } = L.fluxo(D());
      const rec = pend.filter(p => p.lado === 'receber' && p.k === 'venda');
      const hoje = L.hoje();
      html += `<div class="card"><h2>Recebimentos a conferir</h2><p class="muted small" style="margin-bottom:10px">A venda é contada no dia em que aconteceu. Aqui você registra quando o dinheiro entrou. Se o repasse veio diferente do previsto, encerre com o valor real: a diferença vira taxa, sem duplicar o faturamento.</p>
        ${UI.tabela([{ t: 'Previsto para' }, { t: 'Origem' }, { t: 'Em aberto', n: 1 }, { t: '' }], rec.map(p => [`${L.fmtBR(p.venc)} ${p.venc < hoje ? UI.pill('atrasado', 'crit') : ''}`, esc(p.desc), L.brl(p.valor), `<button class="btn sm" data-a="pagar" data-op="${p.op}" data-p="${p.parcela}">Registrar recebimento</button>`]), { vazio: UI.vazio('Nenhum recebimento pendente.') })}</div>`;
      const recebidos = [];
      for (const o of opsDe('venda', x => x.status !== 'cancelado')) for (const r of o.recebimentos || []) for (const g of r.pagos || []) recebidos.push({ o, r, g });
      recebidos.sort((a, b) => b.g.data.localeCompare(a.g.data));
      html += `<div class="card"><h2>Recebidos recentemente</h2>${UI.tabela([{ t: 'Entrou em' }, { t: 'Venda de' }, { t: 'Canal' }, { t: 'Previsto', n: 1 }, { t: 'Recebido', n: 1 }, { t: '' }], recebidos.slice(0, 40).map(x => [L.fmtBR(x.g.data), L.fmtBR(x.o.data), esc((D().canais[x.o.canalId] || {}).nome || ''), L.brl(x.r.valor), L.brl(x.g.valor) + (x.r.encerrado ? ' ' + UI.pill('encerrado', 'est') : ''), `<button class="btn sm lk" data-a="estornar" data-op="${x.o.id}" data-p="${x.r.id}" data-g="${x.g.id}">Desfazer</button>`]), { vazio: UI.vazio('Nada recebido ainda.') })}</div>`;
    }
    return html;
  };
  function cardVenda(o) {
    const d = D(); const cv = L.calcVenda(d, o);
    const lin = o.linhas.map(l => [esc(L.nomeItem(d, l.tipo, l.refId)) + (l.tipo === 'c' ? `<div class="tiny muted">${l.composicao.map(x => x.qtd + ' ' + esc(L.nomeVariante(d, x.varianteId))).join(', ')}</div>` : '') + (l.promoId && d.promocoes[l.promoId] ? ' ' + UI.pill(d.promocoes[l.promoId].nome, 'acc') : ''), L.nf(l.qtd, 0), L.brl(l.precoUnit), l.desconto ? '− ' + L.brl(l.desconto) : '', L.brl(l.qtd * l.precoUnit - (l.desconto || 0))]);
    const recebido = L.sum(o.recebimentos, r => L.sum(r.pagos, g => g.valor));
    return `<div class="card"><div class="card-h"><div><h3>${esc((d.canais[o.canalId] || {}).nome || 'Canal')} · ${esc((d.formas[o.formaId] || {}).nome || '')}</h3><div class="tiny muted">${o.pedidos ? o.pedidos + ' pedido(s) · ' : ''}${o.status === 'cancelado' ? 'cancelado' : ''}</div></div><div class="row">${acoesOp(o, 'editarVenda')}</div></div>
      <div class="${o.status === 'cancelado' ? 'muted' : ''}">${UI.tabela([{ t: 'Item' }, { t: 'Qtd.', n: 1 }, { t: 'Preço', n: 1 }, { t: 'Desconto', n: 1 }, { t: 'Total', n: 1 }], lin)}</div>
      <div class="row small" style="margin-top:8px;gap:16px"><span>Produtos ${L.brl(cv.produtos)}</span>${cv.entrega ? `<span>Entrega cobrada ${L.brl(cv.entrega)}</span>` : ''}<span>Taxas ${L.brl(cv.taxas)}</span><span>Líquido <strong>${L.brl(cv.liquido)}</strong></span><span>Recebido ${L.brl(recebido)}</span></div></div>`;
  }
  UI.acoes.editarVenda = ds => F.venda(ds.id);
  UI.acoes.verDia = ds => { UI.pg.vendas.data = ds.d; UI.sub.vendas = 'dia'; UI.render(); };
  UI.acoes.pagar = ds => F.pagar(ds.op, ds.p);
  UI.acoes.estornar = ds => F.estornarPagamento(ds.op, ds.p, ds.g);

  // ================= PRODUÇÃO E ESTOQUE =================
  V.producao = function () {
    const sub = UI.subAtual('producao', 'estoque');
    let html = topo('Produção e estoque', `<button class="btn" data-a="novaProducao">Produzir massa</button><button class="btn pri" data-a="novaFornada">Registrar fornada</button>`)
      + UI.subtabs('producao', [['estoque', 'Estoque'], ['producoes', 'Produções'], ['fornadas', 'Fornadas'], ['perdas', 'Perdas e ajustes'], ['movs', 'Movimentos']]);
    const d = D(); const s = S(); const hoje = L.hoje();
    if (sub === 'estoque') {
      const por = {};
      for (const l of Object.values(s.lotes)) {
        if (l.orfao || l.saldo <= 0) continue;
        const p = por[l.varianteId] = por[l.varianteId] || { massa: 0, assado: 0, vencidos: 0 };
        if (L.vencido(l, hoje)) p.vencidos += l.saldo; else p[l.estado] += l.saldo;
      }
      const vars = L.ativos(d.variantes).concat(Object.values(d.variantes).filter(v => v.arquivado && por[v.id]));
      const linV = vars.map(v => { const p = por[v.id] || { massa: 0, assado: 0, vencidos: 0 }; const tot = p.massa + p.assado; const pesoKg = v.pesoG ? (tot * v.pesoG / 1000) : null; return [esc(L.nomeVariante(d, v.id)), esc(v.sabor || ''), esc(v.tamanho || ''), L.nf(p.massa, 0), L.nf(p.assado, 0), p.vencidos ? UI.pill(L.nf(p.vencidos, 0) + ' vencidos', 'crit') : '', pesoKg !== null ? L.nf(pesoKg, 2) + ' kg' : '—', v.estoqueMin ? (tot < v.estoqueMin ? UI.pill('abaixo de ' + v.estoqueMin, 'warn') : UI.pill('ok', 'ok')) : '']; });
      const lotes = Object.values(s.lotes).filter(l => l.saldo > 0 && !l.orfao).sort((a, b) => (a.validade || '9999').localeCompare(b.validade || '9999'));
      const sugeridos = {}; lotes.forEach(l => { const k = l.estado + l.varianteId; if (!L.vencido(l, hoje) && !sugeridos[k]) sugeridos[k] = l.key; });
      const linL = lotes.map(l => [l.estado === 'massa' ? UI.pill('massa', 'est') : UI.pill('assado', 'acc'), esc(L.nomeVariante(d, l.varianteId)), esc(l.lote || '—'), L.fmtBR(l.data), validadePill(l.validade) + (sugeridos[l.estado + l.varianteId] === l.key ? ' ' + UI.pill('usar primeiro', 'ok') : ''), `${L.nf(l.saldo, 0)} / ${L.nf(l.inicial, 0)}`, L.brl4(l.cu.m + l.cu.e + l.cu.t), `<button class="btn sm lk" data-a="perdaLote" data-k="${l.key}" data-e="${l.estado}">Perda</button><button class="btn sm lk" data-a="ajusteLote" data-k="${l.key}" data-e="${l.estado}">Ajustar</button>`]);
      const ins = L.ativos(d.insumos).map(i => { const st = s.ins[i.id]; const q = st ? st.qtd : 0; return { i, q, baixo: i.estoqueMin && q < i.estoqueMin }; }).filter(x => x.baixo);
      html += `<div class="card"><h2>Por sabor e tamanho</h2><p class="muted small" style="margin-bottom:8px">Unidades dentro da validade, por estado. Vencidos aparecem à parte e não são usados automaticamente.</p>${UI.tabela([{ t: 'Item' }, { t: 'Sabor' }, { t: 'Tamanho' }, { t: 'Massa', n: 1 }, { t: 'Assados', n: 1 }, { t: 'Vencidos' }, { t: 'Peso total', n: 1 }, { t: 'Mínimo' }], linV, { vazio: UI.vazio('Nenhum produto cadastrado.', '', '<button class="btn" data-a="ir" data-r="produtos">Cadastrar produtos</button>') })}</div>
        <div class="card"><div class="card-h"><h2>Lotes</h2><div class="row"><button class="btn sm" data-a="novaPerda">Registrar perda</button><button class="btn sm" data-a="novoAjuste">Ajuste documentado</button></div></div>${UI.tabela([{ t: 'Estado' }, { t: 'Item' }, { t: 'Lote' }, { t: 'Feito em' }, { t: 'Validade' }, { t: 'Saldo / inicial', n: 1 }, { t: 'Custo/un.', n: 1 }, { t: '' }], linL, { vazio: UI.vazio('Nenhum lote com saldo.') })}</div>
        <div class="card"><div class="card-h"><h2>Ingredientes e embalagens abaixo do mínimo</h2><button class="btn sm lk" data-a="ir" data-r="compras">Ver todos</button></div>${UI.tabela([{ t: 'Item' }, { t: 'Estoque', n: 1 }, { t: 'Mínimo', n: 1 }], ins.map(x => [esc(x.i.nome), L.nf(x.q) + ' ' + x.i.unidade, L.nf(x.i.estoqueMin) + ' ' + x.i.unidade]), { vazio: UI.vazio('Tudo acima do mínimo.') })}</div>`;
    } else if (sub === 'producoes') {
      const ops = opsDe('producao');
      html += `<div class="card">${UI.tabela([{ t: 'Data' }, { t: 'Receita' }, { t: 'Lote' }, { t: 'Rendimento' }, { t: 'Custo', n: 1 }, { t: '' }], ops.map(o => ({ _cls: statusCls(o), c: [L.fmtBR(o.data), esc((d.receitas[o.receitaId] || {}).nome || '?') + ` <span class="tiny muted">v${o.versao}${o.mult !== 1 ? ' × ' + L.nf(o.mult) : ''}</span>` + (o.direto ? ' ' + UI.pill('direta, assada', 'acc') : ''), esc(o.lote || '—'), o.saidas.map(x => x.unidades + ' ' + esc(L.nomeVariante(d, x.varianteId))).join('<br>'), L.brl(o.custos.total), acoesOp(o, 'editarProducao')] })), { vazio: UI.vazio('Nenhuma produção registrada.', '', '<button class="btn pri" data-a="novaProducao">Produzir massa</button>') })}</div>`;
    } else if (sub === 'fornadas') {
      const ops = opsDe('fornada');
      html += `<div class="card">${UI.tabela([{ t: 'Data' }, { t: 'Assados' }, { t: 'Perdas' }, { t: 'Energia/gás', n: 1 }, { t: 'Trabalho', n: 1 }, { t: '' }], ops.map(o => ({ _cls: statusCls(o), c: [L.fmtBR(o.data), o.lotes.map(l => l.unidades + ' ' + esc(L.nomeVariante(d, l.varianteId))).join('<br>'), o.perdas.map(p => p.unidades + ' ' + esc(L.nomeVariante(d, p.varianteId))).join('<br>') || '—', L.brl(o.custos.energia) + (o.manual ? ' ' + UI.pill('manual', 'est') : ''), L.brl(o.custos.trabalho), acoesOp(o, 'editarFornada')] })), { vazio: UI.vazio('Nenhuma fornada registrada.', '', '<button class="btn pri" data-a="novaFornada">Registrar fornada</button>') })}</div>`;
    } else if (sub === 'perdas') {
      const ops = Object.values(d.ops).filter(o => o.k === 'perda' || o.k === 'ajuste').sort((a, b) => b.data.localeCompare(a.data));
      const nome = o => o.alvo === 'ins' ? esc((d.insumos[o.insumoId] || {}).nome || '?') : esc(L.nomeVariante(d, o.varianteId)) + ` <span class="tiny muted">${o.alvo}</span>`;
      html += `<div class="card"><div class="card-h"><h2>Perdas reais e ajustes</h2><div class="row"><button class="btn sm" data-a="novaPerda">Registrar perda</button><button class="btn sm" data-a="novoAjuste">Ajuste documentado</button></div></div>
        ${UI.tabela([{ t: 'Data' }, { t: 'Tipo' }, { t: 'Item' }, { t: 'Qtd.', n: 1 }, { t: 'Motivo' }, { t: 'Valor', n: 1 }, { t: '' }], ops.map(o => ({ _cls: statusCls(o), c: [L.fmtBR(o.data), o.k === 'perda' ? UI.pill('perda', 'crit') : UI.pill('ajuste', 'est'), nome(o), L.nf(o.k === 'perda' ? -o.qtd : o.delta), esc(o.motivo), L.brl(o.k === 'perda' ? -o.valor : o.valor), acoesOp(o)] })), { vazio: UI.vazio('Nenhuma perda ou ajuste.') })}
        <p class="tiny muted" style="margin-top:8px">Perdas dentro das fornadas (cookies que não ficaram bons) aparecem na aba Fornadas e no relatório de perdas.</p></div>`;
    } else {
      const movs = s.movs.slice(-120).reverse();
      const nomeAlvo = m => m.alvo === 'ins' ? esc((d.insumos[m.id] || {}).nome || '?') : esc(L.nomeVariante(d, (s.lotes[m.id] || {}).varianteId)) + ` <span class="tiny muted">${m.alvo}</span>`;
      const tipos = { compra: 'Compra', producao: 'Produção', fornada: 'Fornada', venda: 'Venda', perda: 'Perda', ajuste: 'Ajuste' };
      html += `<div class="card"><h2>Últimos movimentos de estoque</h2>${UI.tabela([{ t: 'Data' }, { t: 'Origem' }, { t: 'Item' }, { t: 'Quantidade', n: 1 }], movs.map(m => [L.fmtBR(m.data), tipos[m.k] || m.k, nomeAlvo(m), (m.q > 0 ? '+' : '') + L.nf(m.q, 3)]), { vazio: UI.vazio('Nenhum movimento.') })}</div>`;
    }
    return html;
  };
  UI.acoes.editarProducao = ds => F.producao(ds.id);
  UI.acoes.editarFornada = ds => F.fornada(ds.id);
  UI.acoes.perdaLote = ds => F.perda({ alvo: ds.e, key: ds.k });
  UI.acoes.ajusteLote = ds => F.ajuste({ alvo: ds.e, key: ds.k });

  // ================= COMPRAS E INGREDIENTES =================
  V.compras = function () {
    const sub = UI.subAtual('compras', 'insumos');
    let html = topo('Compras e ingredientes', `<button class="btn pri" data-a="novaCompra">Registrar compra</button>`)
      + UI.subtabs('compras', [['insumos', 'Ingredientes e embalagens'], ['compras', 'Compras'], ['kits', 'Conjuntos de embalagem'], ['impacto', 'Impacto de preços']]);
    const d = D(); const s = S(); const hoje = L.hoje();
    if (sub === 'insumos') {
      const lista = Object.values(d.insumos).sort((a, b) => (a.arquivado ? 1 : 0) - (b.arquivado ? 1 : 0) || a.nome.localeCompare(b.nome));
      const lin = lista.map(i => {
        const st = s.ins[i.id]; const q = st ? st.qtd : 0;
        const med = L.custoBaseInsumo(d, s, i.id, 'medio'); const ult = L.custoBaseInsumo(d, s, i.id, 'ultimo');
        const prox = st ? st.lotes.filter(l => l.saldo > 0 && l.validade).sort((a, b) => a.validade.localeCompare(b.validade))[0] : null;
        return { _cls: i.arquivado ? 'arq' : '', c: [esc(i.nome) + (i.tipo === 'embalagem' ? ' ' + UI.pill('embalagem', 'est') : ''), `${L.nf(q)} ${i.unidade}` + (i.estoqueMin && q < i.estoqueMin ? ' ' + UI.pill('baixo', 'warn') : ''), med.valor !== null ? L.brl4(med.valor) + `<div class="tiny muted">${esc(med.fonte)}</div>` : '—', ult.valor !== null ? L.brl4(ult.valor) : '—', st ? L.brl(Math.max(0, st.valor)) : '—', prox ? validadePill(prox.validade) : '', `<button class="btn sm lk" data-a="editarInsumo" data-id="${i.id}">Editar</button><button class="btn sm lk" data-a="histInsumo" data-id="${i.id}">Histórico</button><button class="btn sm lk" data-a="arquivar" data-col="insumos" data-id="${i.id}">${i.arquivado ? 'Reativar' : 'Arquivar'}</button>`] };
      });
      html += `<div class="card"><div class="card-h"><h2>Cadastro</h2><div class="row"><button class="btn sm" data-a="novoInsumo">+ Ingrediente</button><button class="btn sm" data-a="novaEmbalagem">+ Embalagem</button></div></div>
        <p class="muted small" style="margin-bottom:8px">Custos por unidade de controle (g, ml ou un.). O estoque é valorado pelo custo médio ponderado.</p>
        ${UI.tabela([{ t: 'Item' }, { t: 'Estoque', n: 1 }, { t: 'Custo médio', n: 1 }, { t: 'Última compra', n: 1 }, { t: 'Valor em estoque', n: 1 }, { t: 'Validade' }, { t: '' }], lin, { vazio: UI.vazio('Nenhum ingrediente cadastrado.', 'Cadastre cada ingrediente uma vez. Os preços se atualizam pelas compras.', '<button class="btn pri" data-a="novoInsumo">Cadastrar ingrediente</button>') })}</div>`;
    } else if (sub === 'compras') {
      const ops = opsDe('compra');
      const lin = ops.map(o => {
        const pago = L.sum(o.parcelas, p => L.sum(p.pagos, g => g.valor)); const aberto = L.r2(o.total - pago);
        const prox = o.parcelas.find(p => L.r2(p.valor - L.sum(p.pagos, g => g.valor)) > 0);
        return { _cls: statusCls(o), c: [L.fmtBR(o.data), esc(o.fornecedor || '—'), o.itens.map(i => esc((d.insumos[i.insumoId] || {}).nome || '?')).join(', '), L.brl(o.total), o.recebidoEm ? UI.pill('recebida ' + L.fmtBR(o.recebidoEm), 'ok') : `<button class="btn sm" data-a="receberCompra" data-id="${o.id}">Marcar recebida</button>`, aberto > 0 ? UI.pill(L.brl(aberto) + ' em aberto', prox && prox.venc < hoje ? 'crit' : 'warn') + (prox && o.status !== 'cancelado' ? ` <button class="btn sm lk" data-a="pagar" data-op="${o.id}" data-p="${prox.id}">Pagar</button>` : '') : UI.pill('paga', 'ok'), acoesOp(o, 'editarCompra')] };
      });
      html += `<div class="card"><p class="muted small" style="margin-bottom:8px">A mercadoria entra no estoque quando é recebida. O dinheiro sai quando a parcela é paga.</p>${UI.tabela([{ t: 'Data' }, { t: 'Fornecedor' }, { t: 'Itens' }, { t: 'Total', n: 1 }, { t: 'Estoque' }, { t: 'Pagamento' }, { t: '' }], lin, { vazio: UI.vazio('Nenhuma compra registrada.', '', '<button class="btn pri" data-a="novaCompra">Registrar compra</button>') })}</div>`;
    } else if (sub === 'kits') {
      const lin = Object.values(d.kits).map(k => ({ _cls: k.arquivado ? 'arq' : '', c: [esc(k.nome), k.uso === 'venda' ? UI.pill('venda', 'acc') : UI.pill('armazenamento', 'est'), k.itens.map(i => L.nf(i.qtd) + ' × ' + esc((d.insumos[i.insumoId] || {}).nome || '?')).join('<br>'), L.brl(L.custoKit(d, s, k.id, 'medio').valor), `<button class="btn sm lk" data-a="editarKit" data-id="${k.id}">Editar</button><button class="btn sm lk" data-a="arquivar" data-col="kits" data-id="${k.id}">${k.arquivado ? 'Reativar' : 'Arquivar'}</button>`] }));
      html += `<div class="card"><div class="card-h"><h2>Conjuntos de embalagem</h2><button class="btn sm" data-a="novoKit">+ Conjunto</button></div><p class="muted small" style="margin-bottom:8px">Combine caixa, saco, etiqueta, fita etc. Conjuntos de armazenamento são usados na produção; os de venda, na venda.</p>${UI.tabela([{ t: 'Nome' }, { t: 'Uso' }, { t: 'Itens' }, { t: 'Custo', n: 1 }, { t: '' }], lin, { vazio: UI.vazio('Nenhum conjunto.', 'Cadastre primeiro as embalagens em Ingredientes e embalagens.') })}</div>`;
    } else {
      const im = UI.pg.imp;
      const ins = d.insumos[im.insumoId];
      let res = '';
      if (ins) {
        const p = N(im.preco); const q = Number(ins.embQtd) || 0;
        const c = q > 0 ? L.converter(q, ins.embUnid || ins.unidade, ins) : { ok: false };
        if (p > 0 && c.ok) {
          const novoU = p / c.valor;
          const st = s.ins[ins.id] || { qtd: 0, valor: 0, lotes: [], hist: [], ultimo: null };
          const s2 = Object.assign({}, s, { ins: Object.assign({}, s.ins, { [ins.id]: Object.assign({}, st, { qtd: 0, valor: 0, ultimo: novoU, medioRef: novoU }) }) });
          const lin = L.ativos(d.variantes).map(v => { const a = L.custoVariante(d, s, v.id, im.criterio); const b = L.custoVariante(d, s2, v.id, im.criterio); return { v, a, b, dif: b.total - a.total }; }).filter(x => Math.abs(x.dif) > 1e-9);
          res = `<p class="small" style="margin:10px 0">Novo custo: <strong>${L.brl4(novoU)}</strong> por ${ins.unidade} (atual pelo ${im.criterio === 'medio' ? 'custo médio' : 'último preço'}: ${L.brl4(L.custoBaseInsumo(d, s, ins.id, im.criterio).valor || 0)}).</p>`
            + UI.tabela([{ t: 'Item' }, { t: 'Custo atual', n: 1 }, { t: 'Com o novo preço', n: 1 }, { t: 'Diferença', n: 1 }, { t: 'Margem no canal principal' }], lin.map(x => { const ch = Object.keys(x.v.precos || {})[0]; let mg = ''; if (ch && d.canais[ch]) { const tx = L.taxas(d, ch, d.canais[ch].formaPadraoId); const a1 = L.analisarPreco(x.v.precos[ch], x.a.total, tx, d.cfg.itensPorPedido); const a2 = L.analisarPreco(x.v.precos[ch], x.b.total, tx, d.cfg.itensPorPedido); mg = `${esc(d.canais[ch].nome)}: ${L.pct(a1.margemContrib)} → ${L.pct(a2.margemContrib)}`; } return [esc(L.nomeVariante(d, x.v.id)), L.brl4(x.a.total), L.brl4(x.b.total), (x.dif > 0 ? '+' : '') + L.brl4(x.dif), mg]; }), { vazio: UI.vazio('Nenhuma receita usa este item.') })
            + '<p class="tiny muted" style="margin-top:8px">Simulação: não altera cadastros, compras nem custos já registrados.</p>';
        } else res = '<p class="muted small" style="margin-top:10px">Informe o novo preço da embalagem.</p>';
      }
      html += `<div class="card"><h2>Impacto de um novo preço nas receitas</h2><div class="lg" style="margin-top:10px">${UI.sel(im, 'imp.insumoId', 'Ingrediente ou embalagem', UI.optsInsumos(im.insumoId, 'Escolha…')).replace('data-re="1"', '')}
        ${ins ? `<label class="f" for="fimpp"><span>Novo preço da embalagem de ${L.nf(ins.embQtd)} ${esc(ins.embUnid || ins.unidade)} (R$)</span><input type="text" inputmode="decimal" id="fimpp" data-b="imp.preco" value="${esc(im.preco)}"></label>` : ''}
        ${UI.sel(im, 'imp.criterio', 'Comparar com', UI.opts([{ v: 'medio', t: 'Custo médio do estoque' }, { v: 'ultimo', t: 'Último preço de compra' }], im.criterio)).replace('data-re="1"', '')}</div><div data-imp>${res}</div></div>`;
      UI.pgAtualizar = () => { /* recalcula ao sair do campo */ };
    }
    return html;
  };
  UI.acoes.novoInsumo = () => F.insumo(null, 'ingrediente');
  UI.acoes.novaEmbalagem = () => F.insumo(null, 'embalagem');
  UI.acoes.editarInsumo = ds => F.insumo(ds.id);
  UI.acoes.novoKit = () => F.kit(null);
  UI.acoes.editarKit = ds => F.kit(ds.id);
  UI.acoes.editarCompra = ds => F.compra(ds.id);
  UI.acoes.receberCompra = async ds => {
    const op = D().ops[ds.id]; if (!op) return;
    const r = L.prepararCompra(D(), Object.assign({}, op, { recebidoEm: L.hoje() }));
    if (!r.ok) { UI.toast(r.erro); return; }
    try { await UI.gravarOp(op.id, r.op, 'mercadoria recebida'); UI.toast('Mercadoria recebida: estoque atualizado.'); } catch (e) { UI.toast(e.message); }
  };
  UI.acoes.histInsumo = ds => {
    const d = D(); const s = S(); const i = d.insumos[ds.id]; const st = s.ins[ds.id];
    UI.abrir({
      titulo: 'Histórico — ' + i.nome, largura: 'larga',
      corpo: () => `<h3>Preços de compra</h3>${UI.tabela([{ t: 'Data' }, { t: 'Fornecedor' }, { t: 'Custo por ' + i.unidade, n: 1 }], (st ? st.hist : []).slice().reverse().map(h => [L.fmtBR(h.data), esc(h.fornecedor), L.brl4(h.custoUnit)]), { vazio: UI.vazio('Sem compras registradas.') })}
        <h3>Lotes</h3>${UI.tabela([{ t: 'Entrada' }, { t: 'Lote' }, { t: 'Validade' }, { t: 'Saldo estimado', n: 1 }], (st ? st.lotes : []).filter(l => l.saldo > 0).map(l => [L.fmtBR(l.data), esc(l.lote || '—'), validadePill(l.validade), L.nf(l.saldo) + ' ' + i.unidade]), { vazio: UI.vazio('Sem saldo.') })}
        <h3>Movimentos</h3>${UI.tabela([{ t: 'Data' }, { t: 'Origem' }, { t: 'Quantidade', n: 1 }], s.movs.filter(m => m.alvo === 'ins' && m.id === ds.id).slice(-80).reverse().map(m => [L.fmtBR(m.data), m.k, (m.q > 0 ? '+' : '') + L.nf(m.q) + ' ' + i.unidade]), { vazio: UI.vazio('Sem movimentos.') })}`,
    }, {});
  };

  // ================= PRODUTOS E RECEITAS =================
  V.produtos = function () {
    const sub = UI.subAtual('produtos', 'produtos');
    const d = D(); const s = S();
    let html = topo('Produtos e receitas') + UI.subtabs('produtos', [['produtos', 'Produtos e variações'], ['receitas', 'Receitas'], ['bases', 'Receitas base'], ['combos', 'Combos']]);
    if (sub === 'produtos') {
      const prods = Object.values(d.produtos).sort((a, b) => (a.arquivado ? 1 : 0) - (b.arquivado ? 1 : 0) || a.nome.localeCompare(b.nome));
      html += `<div class="row end"><button class="btn pri" data-a="novoProduto">+ Produto</button></div>`;
      if (!prods.length) html += `<div class="card">${UI.vazio('Nenhum produto cadastrado.', 'Comece pelo cookie; brownies e sobremesas entram depois, em outras categorias.', '<button class="btn pri" data-a="novoProduto">Cadastrar produto</button>')}</div>`;
      for (const p of prods) {
        const vars = Object.values(d.variantes).filter(v => v.produtoId === p.id).sort((a, b) => (a.arquivado ? 1 : 0) - (b.arquivado ? 1 : 0) || (a.sabor + a.tamanho).localeCompare(b.sabor + b.tamanho));
        const lin = vars.map(v => {
          const c = L.custoVariante(d, s, v.id, 'medio');
          const prontos = L.sum(Object.values(s.lotes).filter(l => l.varianteId === v.id && l.estado === 'assado' && l.saldo > 0 && !L.vencido(l, L.hoje())), l => l.saldo);
          const massa = L.sum(Object.values(s.lotes).filter(l => l.varianteId === v.id && l.estado === 'massa' && l.saldo > 0 && !L.vencido(l, L.hoje())), l => l.saldo);
          const precos = Object.entries(v.precos || {}).filter(([ch]) => d.canais[ch]).map(([ch, pr]) => { const tx = L.taxas(d, ch, d.canais[ch].formaPadraoId); const a = L.analisarPreco(pr, c.total, tx, d.cfg.itensPorPedido); const ok = a.margemContrib >= (d.cfg.margemDesejada || 0) / 100 - 1e-9; return `${esc(d.canais[ch].nome)} ${L.brl(pr)} ${UI.pill(L.pct(a.margemContrib, 0), c.total > 0 ? (a.contribuicao < 0 ? 'crit' : ok ? 'ok' : 'warn') : '')}`; }).join('<br>');
          return { _cls: v.arquivado ? 'arq' : '', c: [esc(v.sabor || '—'), esc(v.tamanho || '—'), v.pesoG ? L.nf(v.pesoG) + ' g' : '—', c.total > 0 ? L.brl4(c.total) + (c.avisos.length ? ' ' + UI.pill('incompleto', 'warn') : '') : UI.pill('sem custo', 'warn'), precos || '<span class="muted small">sem preço</span>', `${prontos} / ${massa}`, `<button class="btn sm lk" data-a="editarVariante" data-id="${v.id}">Editar</button><button class="btn sm lk" data-a="duplicarVariante" data-id="${v.id}">Duplicar</button><button class="btn sm lk" data-a="arquivar" data-col="variantes" data-id="${v.id}">${v.arquivado ? 'Reativar' : 'Arquivar'}</button>`] };
        });
        html += `<div class="card ${p.arquivado ? 'flat' : ''}"><div class="card-h"><div><h2>${esc(p.nome)}</h2><span class="muted small">${esc(p.categoria || '')}${p.arquivado ? ' · arquivado' : ''}</span></div><div class="row"><button class="btn sm" data-a="novaVariante" data-id="${p.id}">+ Sabor/tamanho</button><button class="btn sm lk" data-a="editarProduto" data-id="${p.id}">Editar</button><button class="btn sm lk" data-a="arquivar" data-col="produtos" data-id="${p.id}">${p.arquivado ? 'Reativar' : 'Arquivar'}</button></div></div>
          ${UI.tabela([{ t: 'Sabor' }, { t: 'Tamanho' }, { t: 'Peso', n: 1 }, { t: 'Custo/un.', n: 1 }, { t: 'Preço e margem por canal' }, { t: 'Assados / massa', n: 1 }, { t: '' }], lin, { vazio: UI.vazio('Sem variações.', 'Cada combinação de sabor e tamanho tem custo, preço, rendimento e estoque próprios.') })}</div>`;
      }
    } else if (sub === 'receitas') {
      const recs = Object.values(d.receitas).sort((a, b) => (a.arquivado ? 1 : 0) - (b.arquivado ? 1 : 0) || a.nome.localeCompare(b.nome));
      const lin = recs.map(r => {
        const v = L.ultimaVersao(r); const c = L.custoLote(d, s, v, 'medio');
        return { _cls: r.arquivado ? 'arq' : '', c: [esc(r.nome), `v${v.v} · ${L.fmtBR(v.data)}`, c.saidas.map(x => `${x.unidades} ${esc(L.nomeVariante(d, x.varianteId))} <span class="muted">(${L.brl4(x.m + x.t)}/un.)</span>`).join('<br>'), L.brl(c.total), v.validadeMassaDias ? v.validadeMassaDias + ' dias' : '—', `<button class="btn sm lk" data-a="produzirReceita" data-id="${r.id}">Produzir</button><button class="btn sm lk" data-a="editarReceita" data-id="${r.id}">Editar</button><button class="btn sm lk" data-a="duplicarReceita" data-id="${r.id}">Duplicar</button><button class="btn sm lk" data-a="versoesReceita" data-id="${r.id}">Versões</button><button class="btn sm lk" data-a="arquivar" data-col="receitas" data-id="${r.id}">${r.arquivado ? 'Reativar' : 'Arquivar'}</button>`] };
      });
      html += `<div class="card"><div class="card-h"><h2>Receitas de produção</h2><button class="btn pri" data-a="novaReceita">+ Receita</button></div><p class="muted small" style="margin-bottom:8px">Custo da massa por receita (ingredientes, embalagem de armazenamento e trabalho), pelo custo médio atual. Editar cria uma nova versão; produções antigas guardam o custo da época.</p>${UI.tabela([{ t: 'Receita' }, { t: 'Versão' }, { t: 'Rendimento' }, { t: 'Custo da massa', n: 1 }, { t: 'Validade da massa' }, { t: '' }], lin, { vazio: UI.vazio('Nenhuma receita.', 'Cadastre antes os ingredientes e as variações (sabor e tamanho).', '<button class="btn pri" data-a="novaReceita">Cadastrar receita</button>') })}</div>`;
    } else if (sub === 'bases') {
      const lin = Object.values(d.bases).map(b => { const v = L.ultimaVersao(b); const c = L.custoLote(d, s, { bases: [{ baseId: b.id, mult: 1 }], extras: [], saidas: [] }, 'medio'); return { _cls: b.arquivado ? 'arq' : '', c: [esc(b.nome), `v${v.v} · ${L.fmtBR(v.data)}`, v.ingredientes.length + ' ingredientes', L.brl(c.ingredientes), `<button class="btn sm lk" data-a="editarBase" data-id="${b.id}">Editar</button><button class="btn sm lk" data-a="duplicarBase" data-id="${b.id}">Duplicar</button><button class="btn sm lk" data-a="arquivar" data-col="bases" data-id="${b.id}">${b.arquivado ? 'Reativar' : 'Arquivar'}</button>`] }; });
      html += `<div class="card"><div class="card-h"><h2>Receitas base</h2><button class="btn pri" data-a="novaBase">+ Receita base</button></div><p class="muted small" style="margin-bottom:8px">Massa comum a vários sabores. Cada sabor usa a base e acrescenta seus ingredientes.</p>${UI.tabela([{ t: 'Nome' }, { t: 'Versão' }, { t: 'Composição' }, { t: 'Custo de 1 base', n: 1 }, { t: '' }], lin, { vazio: UI.vazio('Nenhuma receita base.') })}</div>`;
    } else {
      const lin = Object.values(d.combos).map(c => {
        const cc = L.custoCombo(d, s, c.id, 'medio');
        const comp = c.tipo === 'livre' ? `${c.livre.qtd} à escolha entre ${c.livre.permitidas.length} opções` : c.itens.map(i => i.qtd + ' ' + esc(L.nomeVariante(d, i.varianteId))).join('<br>');
        const precos = Object.entries(c.precos || {}).filter(([ch]) => d.canais[ch]).map(([ch, pr]) => { const tx = L.taxas(d, ch, d.canais[ch].formaPadraoId); const a = L.analisarPreco(pr, cc.max, tx, d.cfg.itensPorPedido); return `${esc(d.canais[ch].nome)} ${L.brl(pr)} ${UI.pill(L.pct(a.margemContrib, 0), a.contribuicao < 0 ? 'crit' : a.margemContrib >= (d.cfg.margemDesejada || 0) / 100 ? 'ok' : 'warn')}`; }).join('<br>');
        return { _cls: c.arquivado ? 'arq' : '', c: [esc(c.nome), c.tipo === 'livre' ? UI.pill('à escolha', 'acc') : UI.pill('fixo', 'est'), comp, c.tipo === 'livre' ? `${L.brl(cc.min)} a ${L.brl(cc.max)}` : L.brl(cc.medio), precos || '—', `<button class="btn sm lk" data-a="editarCombo" data-id="${c.id}">Editar</button><button class="btn sm lk" data-a="duplicarCombo" data-id="${c.id}">Duplicar</button><button class="btn sm lk" data-a="arquivar" data-col="combos" data-id="${c.id}">${c.arquivado ? 'Reativar' : 'Arquivar'}</button>`] };
      });
      html += `<div class="card"><div class="card-h"><h2>Combos</h2><button class="btn pri" data-a="novoCombo">+ Combo</button></div><p class="muted small" style="margin-bottom:8px">Combo não tem estoque próprio: a venda baixa os cookies e a embalagem do combo. Em combos à escolha, a margem mostrada usa o custo mais alto possível.</p>${UI.tabela([{ t: 'Combo' }, { t: 'Tipo' }, { t: 'Composição' }, { t: 'Custo', n: 1 }, { t: 'Preço e margem' }, { t: '' }], lin, { vazio: UI.vazio('Nenhum combo.') })}</div>`;
    }
    return html;
  };
  Object.assign(UI.acoes, {
    novoProduto: () => F.produto(null), editarProduto: ds => F.produto(ds.id),
    novaVariante: ds => F.variante(null, ds.id), editarVariante: ds => F.variante(ds.id), duplicarVariante: ds => F.variante(null, D().variantes[ds.id].produtoId, ds.id),
    novaReceita: () => F.receita(null), editarReceita: ds => F.receita(ds.id), duplicarReceita: ds => F.receita(ds.id, true), produzirReceita: ds => F.producao(null, { receitaId: ds.id }),
    novaBase: () => F.base(null), editarBase: ds => F.base(ds.id), duplicarBase: ds => F.base(ds.id, true),
    novoCombo: () => F.combo(null), editarCombo: ds => F.combo(ds.id), duplicarCombo: ds => F.combo(ds.id, true),
    versoesReceita: ds => {
      const r = D().receitas[ds.id]; const d = D();
      UI.abrir({ titulo: 'Versões — ' + r.nome, largura: 'larga', corpo: () => r.versoes.slice().reverse().map(v => `<div class="card flat"><h3>Versão ${v.v} · ${L.fmtBR(v.data)}</h3><div class="small">${(v.bases || []).map(b => L.nf(b.mult) + ' × ' + esc((d.bases[b.baseId] || {}).nome || '?')).join(', ')}${(v.extras || []).length ? ' + ' + v.extras.map(e => L.nf(e.qtd) + ' ' + e.unid + ' ' + esc((d.insumos[e.insumoId] || {}).nome || '?')).join(', ') : ''}</div><div class="small muted">Rende: ${(v.saidas || []).map(s => s.unidades + ' ' + esc(L.nomeVariante(d, s.varianteId))).join(', ')} · usada em ${Object.values(d.ops).filter(o => o.k === 'producao' && o.receitaId === r.id && o.versao === v.v).length} produção(ões)</div></div>`).join('') }, {});
    },
  });

  // ================= METAS E CALENDÁRIO =================
  V.metas = function () {
    const d = D(); const s = S(); const hoje = L.hoje();
    const pm = UI.pg.meta; const ym = pm.ym || hoje.slice(0, 7);
    const mi = L.metaInfo(d, ym, hoje);
    const cal = d.cal;
    const dias = []; const primeiro = L.diaSemana(ym + '-01');
    for (let i = 0; i < primeiro; i++) dias.push('<span></span>');
    for (let i = 1; i <= L.diasNoMes(ym); i++) {
      const dt = ym + '-' + String(i).padStart(2, '0');
      const folga = !L.diaDeVenda(d, dt);
      const vendeu = L.faturamentoProdutos(d, dt, dt) > 0;
      dias.push(`<button class="${folga ? 'folga' : ''} ${dt === hoje ? 'hoje' : ''} ${dt < hoje ? 'passado' : ''}" data-a="toggleFolga" data-d="${dt}" title="${folga ? 'Folga' + (cal.folgas[dt] ? ': ' + esc(cal.folgas[dt]) : '') : 'Dia de venda'}" aria-label="${L.fmtBR(dt)} ${folga ? 'folga' : 'dia de venda'}">${i}${vendeu ? '<span class="pt"></span>' : ''}</button>`);
    }
    const semana = L.DIAS_SEMANA.map((n, i) => `<button type="button" class="btn sm ${(cal.diasSemanaFolga || []).includes(i) ? 'pri' : ''}" data-a="toggleSemana" data-i="${i}">${n.slice(0, 3)}</button>`).join('');
    // mistura e equilíbrio
    const mixTr = L.traduzirValor(d, s, mi.restante, d.cfg.mix);
    const contrib = L.contribuicaoMix(d, s, d.cfg.mix, 'medio');
    const fixas = L.despesasFixasMes(d, ym);
    const lucro = N(pm.lucro) || 0;
    let equilibrio = '';
    if (contrib.ok) {
      if (contrib.porVenda <= 0) equilibrio = '<div class="nota erro">A mistura planejada não deixa contribuição positiva: cada venda não cobre seus custos e taxas.</div>';
      else {
        const nEq = Math.ceil(fixas.total / contrib.porVenda); const nLu = Math.ceil((fixas.total + lucro) / contrib.porVenda);
        const cap = Number(d.cfg.capacidadeMensal) || 0;
        const estoque = L.sum(Object.values(s.lotes).filter(l => l.saldo > 0 && !L.vencido(l, hoje)), l => l.saldo);
        equilibrio = UI.dl([
          ['Despesas fixas do mês', L.brl(fixas.total)], ['Contribuição média por venda da mistura', L.brl(contrib.porVenda)],
          ['Vendas para cobrir as despesas', nEq + ' vendas', 'tot'],
          lucro > 0 ? ['Vendas para cobrir despesas + lucro de ' + L.brl(lucro), nLu + ' vendas', 'tot'] : null,
          ['Capacidade de produção informada', cap ? L.nf(cap, 0) + ' un./mês ' + (nLu > cap ? UI.pill('insuficiente', 'crit') : UI.pill('suficiente', 'ok')) : '<span class="muted">não informada</span>'],
          ['Cookies em estoque (massa + assados válidos)', L.nf(estoque, 0) + ' un.'],
        ]) + `<p class="tiny muted">Contribuição = preço − materiais − energia estimada − taxas, sem o valor estimado do seu trabalho (pró-labore pago entra nas despesas). Energia e gás lançados como despesa ficam fora das fixas para não contar duas vezes${fixas.excluidas.length ? ` (${fixas.excluidas.length} lançamento(s) excluído(s))` : ''}. “Vendas” = itens da mistura; combos contam como uma venda.</p>`;
      }
    } else equilibrio = `<p class="muted small">${esc(contrib.erro)}</p>`;
    const itemSel = pm.itemId; let cen = '';
    if (itemSel) {
      const [tipo, id] = itemSel.split(':'); const ent = tipo === 'c' ? d.combos[id] : d.variantes[id];
      const canalId = pm.canalId || Object.keys((ent || {}).precos || {})[0];
      const pr = ent && ent.precos ? Number(ent.precos[canalId]) : 0;
      cen = pr > 0 ? `<p class="small">Para os ${L.brl(mi.restante)} que faltam: <strong>${Math.ceil(mi.restante / pr)}</strong> × ${esc(L.nomeItem(d, tipo, id))} a ${L.brl(pr)} (${esc((d.canais[canalId] || {}).nome || '')}).${mi.hojeEhDiaDeVenda && mi.faltaHoje > 0 ? ` Hoje: <strong>${Math.ceil(mi.faltaHoje / pr)}</strong>.` : ''}</p>` : '<p class="muted small">Esse item não tem preço no canal escolhido.</p>';
    }
    return `${topo('Metas e calendário')}
      <div class="card"><div class="row between"><div class="row"><button class="btn sm" data-a="mesMeta" data-n="-1" aria-label="Mês anterior">‹</button><h2>${esc(L.nomeMes(ym))}</h2><button class="btn sm" data-a="mesMeta" data-n="1" aria-label="Próximo mês">›</button></div>
        <label class="f" style="max-width:260px"><span>Meta de faturamento de produtos (R$)</span><input type="text" inputmode="decimal" id="pgMetaValor" data-b="metaValor" data-salvar="salvarMeta" value="${mi.meta ? String(mi.meta).replace('.', ',') : ''}" placeholder="Ex.: 3000"></label></div>
        <p class="tiny muted" style="margin-top:6px">Conta só vendas de produtos (após descontos). Taxas de entrega não entram na meta.</p></div>
      <div class="grid g2"><div class="card"><h2>Calendário</h2><p class="muted small" style="margin:4px 0 10px">Toque num dia para marcar folga ou pausa. O ponto indica dia com venda.</p>
          <div class="cal">${L.DIAS_SEMANA.map(n => `<span class="dow">${n.slice(0, 3)}</span>`).join('')}${dias.join('')}</div>
          <div class="f" style="margin-top:12px"><span>Folga fixa toda semana</span><div class="row">${semana}</div></div></div>
        <div class="card"><h2>Progresso</h2>${mi.meta > 0 ? `${UI.barra(mi.pctAlcancado, mi.atingida)}<div style="margin-top:12px">${UI.dl([
          ['Meta', L.brl(mi.meta)], ['Realizado', L.brl(mi.realizado)], ['Alcançado', L.pct(mi.pctAlcancado, 1)], ['Falta', L.brl(mi.restante)],
          ['Dias de venda no mês', mi.diasVendaMes], ['Dias de venda restantes' + (ym === hoje.slice(0, 7) ? ' (com hoje)' : ''), mi.diasRestantes],
          ym === hoje.slice(0, 7) && mi.hojeEhDiaDeVenda ? ['Meta de hoje', L.brl(mi.metaHoje)] : null,
          ym === hoje.slice(0, 7) && mi.hojeEhDiaDeVenda ? ['Vendido hoje', L.brl(mi.vendasHoje)] : null,
          ym === hoje.slice(0, 7) && mi.hojeEhDiaDeVenda ? ['Falta vender hoje', L.brl(mi.faltaHoje), 'tot'] : null,
          mi.porDia !== null && !mi.atingida ? ['Média necessária por dia restante', L.brl(mi.porDia)] : null,
        ])}</div>${mi.atingida ? '<div class="alerta ok" style="margin-top:10px"><span class="ic">✓</span><span>Meta atingida.</span></div>' : mi.semDias ? '<div class="alerta alto" style="margin-top:10px"><span class="ic">!</span><span>Não restam dias de venda neste mês.</span></div>' : ''}
          <p class="tiny muted" style="margin-top:8px">A meta de hoje = (meta − vendido até ontem) ÷ dias de venda restantes, incluindo hoje. Vendas de hoje reduzem o que falta.</p>` : UI.vazio('Sem meta para este mês.', 'Informe o valor acima.')}</div></div>
      <div class="grid g2"><div class="card"><div class="card-h"><h2>Quanto isso representa em vendas</h2><button class="btn sm" data-a="editarMix">Mistura planejada</button></div>
          ${mixTr.ok ? `<p class="small">Para os ${L.brl(mi.restante)} que faltam no mês, pela mistura planejada (preço médio ${L.brl(mixTr.precoMedio)}):</p><div class="small" style="margin:6px 0">${mixTr.itens.map(i => `<strong>${i.qtd}</strong> ${esc(i.nome)} <span class="muted">(${esc(i.canal)}, ${L.brl(i.preco)}, ${L.nf(i.peso)} partes)</span>`).join('<br>')}</div><p class="tiny muted">Estimativa arredondada para cima. Preços diferentes por canal e combos mudam o número; ajuste a mistura conforme a realidade.</p>` : `<p class="muted small">${esc(mixTr.erro)}</p>`}
          <div class="secao-f" style="margin-top:12px"><h3>Cenário com um item só</h3><div class="lg">
            <label class="f" for="pgMetaItem"><span>Item</span><select id="pgMetaItem" data-b="meta.itemId">${UI.opts(L.ativos(d.variantes).map(v => ({ v: 'v:' + v.id, t: L.nomeVariante(d, v.id) })).concat(L.ativos(d.combos).map(c => ({ v: 'c:' + c.id, t: 'Combo ' + c.nome }))), pm.itemId, 'Escolha…')}</select></label>
            <label class="f" for="pgMetaCanal"><span>Canal</span><select id="pgMetaCanal" data-b="meta.canalId">${UI.optsCanais(pm.canalId, 'Primeiro com preço')}</select></label></div>${cen}</div></div>
        <div class="card"><h2>Despesas e lucro desejado</h2><label class="f" style="max-width:260px;margin:8px 0"><span>Lucro desejado no mês (R$, opcional)</span><input type="text" inputmode="decimal" id="pgMetaLucro" data-b="meta.lucro" value="${esc(pm.lucro)}"></label>${equilibrio}</div></div>`;
  };
  Object.assign(UI.acoes, {
    mesMeta: ds => { UI.pg.meta.ym = L.addMesYM(UI.pg.meta.ym || L.hoje().slice(0, 7), +ds.n); UI.render(); },
    salvarMeta: async el => {
      const ym = UI.pg.meta.ym || L.hoje().slice(0, 7);
      const cal = L.clone(D().cal); const v = N(el.value);
      if (el.value.trim() === '') delete cal.metas[ym]; else if (v >= 0) cal.metas[ym] = L.r2(v); else { UI.toast('Valor inválido.'); return; }
      try { await L.Store.salvarCalendario(cal); UI.toast('Meta salva.'); } catch (e) { UI.toast(e.message); }
    },
    toggleFolga: async ds => {
      const cal = L.clone(D().cal); const dt = ds.d; const ds0 = L.diaSemana(dt);
      if (cal.folgas[dt]) delete cal.folgas[dt];
      else if ((cal.diasSemanaFolga || []).includes(ds0)) { cal.abertos = cal.abertos || {}; UI.toast('Este dia é folga fixa da semana. Desmarque o dia da semana para liberá-lo.'); return; }
      else cal.folgas[dt] = 'Folga';
      try { await L.Store.salvarCalendario(cal); } catch (e) { UI.toast(e.message); }
    },
    toggleSemana: async ds => {
      const cal = L.clone(D().cal); const i = +ds.i; cal.diasSemanaFolga = cal.diasSemanaFolga || [];
      const k = cal.diasSemanaFolga.indexOf(i); if (k >= 0) cal.diasSemanaFolga.splice(k, 1); else cal.diasSemanaFolga.push(i);
      try { await L.Store.salvarCalendario(cal); } catch (e) { UI.toast(e.message); }
    },
    editarMix: () => {
      const st0 = { mix: (D().cfg.mix || []).map(m => ({ ref: m.tipo + ':' + m.id, canalId: m.canalId, peso: m.peso })) };
      if (!st0.mix.length) st0.mix.push({ ref: '', canalId: '', peso: '1' });
      UI.abrir({
        titulo: 'Mistura planejada de vendas',
        acoes: { add: st => st.mix.push({ ref: '', canalId: '', peso: '1' }), rm: (st, ds) => st.mix.splice(+ds.i, 1) },
        corpo: st => `<p class="muted small">Como você espera que as vendas se dividam. Ex.: 3 partes de cookie grande no WhatsApp, 1 parte de combo no iFood. Usada para traduzir valores em quantidades e calcular o ponto de equilíbrio.</p>
          <div class="linhas">${st.mix.map((m, i) => `<div class="linha"><button type="button" class="x lx" data-fa="rm" data-i="${i}" aria-label="Remover">×</button><div class="lg">${UI.sel(st, `mix.${i}.ref`, 'Item', UI.opts(L.ativos(D().variantes).map(v => ({ v: 'v:' + v.id, t: L.nomeVariante(D(), v.id) })).concat(L.ativos(D().combos).map(c => ({ v: 'c:' + c.id, t: 'Combo ' + c.nome }))), m.ref, 'Escolha…'), { cls: 'w2' })}${UI.sel(st, `mix.${i}.canalId`, 'Canal', UI.optsCanais(m.canalId, 'Escolha…'))}${UI.campo(st, `mix.${i}.peso`, 'Partes', { tipo: 'num' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="add">+ Item</button></div>`,
        salvar: async st => {
          const mix = st.mix.filter(m => m.ref && m.canalId && N(m.peso) > 0).map(m => { const [tipo, id] = m.ref.split(':'); return { tipo, id, canalId: m.canalId, peso: N(m.peso) }; });
          const cfg = L.clone(D().cfg); cfg.mix = mix; await L.Store.salvarConfig(cfg); return 'Mistura salva.';
        },
      }, st0);
    },
  });
})(globalThis.L = globalThis.L || {});
