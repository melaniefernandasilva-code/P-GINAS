/* LEORA — formulários de operações: compras, pagamentos, produção, fornada, perdas, ajustes, vendas, recebimentos e lançamentos financeiros. */
(function (L) {
  'use strict';
  const UI = L.UI; const esc = UI.esc; const N = L.num; const F = UI.forms;
  const D = () => UI.D();
  const linhaX = (acao, i) => `<button type="button" class="x lx" data-fa="${acao}" data-i="${i}" aria-label="Remover linha">×</button>`;
  const erroPrevia = r => `<div class="nota erro">${esc(r.erro)}${r.faltas || r.faltaAssado ? `<div class="row" style="margin-top:8px">${r.faltaAssado ? '<button type="button" class="btn sm" data-a="atalhoFornada">Registrar fornada</button>' : ''}<button type="button" class="btn sm" data-a="atalhoAjuste">Ajuste de estoque</button>${r.faltas ? '<button type="button" class="btn sm" data-a="atalhoCompra">Registrar compra</button>' : ''}</div>` : ''}</div>`;
  const sEx = id => L.estado(D(), { excluirId: id });
  function parcelasIguais(total, n, primeiro) {
    const out = []; const base = Math.floor(total / n * 100) / 100;
    for (let i = 0; i < n; i++) out.push({ venc: L.addMeses(primeiro, i), valor: i === n - 1 ? L.r2(total - base * (n - 1)) : base, pagos: [] });
    return out;
  }
  // pagamento: 'avista_pago' | 'avista_prazo' | 'parcelado' | 'personalizado'
  function blocoPagamento(st, rotulo) {
    const modo = st.pagamento;
    return `<div class="secao-f"><h3>${rotulo || 'Pagamento'}</h3>${UI.segmento(st, 'pagamento', [['avista_pago', 'À vista, já pago'], ['avista_prazo', 'Pagar depois'], ['parcelado', 'Parcelado'], ['personalizado', 'Personalizar']])}
      ${modo === 'avista_pago' ? UI.campo(st, 'dataPgto', 'Data do pagamento', { tipo: 'date' }) : ''}
      ${modo === 'avista_prazo' ? UI.campo(st, 'venc', 'Vencimento', { tipo: 'date' }) : ''}
      ${modo === 'parcelado' ? `<div class="lg">${UI.campo(st, 'nParcelas', 'Número de parcelas', { tipo: 'int' })}${UI.campo(st, 'primeiroVenc', '1º vencimento', { tipo: 'date' })}</div>${UI.chk(st, 'primeiraPaga', 'A 1ª parcela já foi paga no vencimento')}` : ''}
      ${modo === 'personalizado' ? `<div class="linhas">${st.parcelas.map((p, i) => `<div class="linha">${(p.pagos || []).length ? '' : linhaX('rmP', i)}<div class="lg">${UI.campo(st, `parcelas.${i}.venc`, 'Vencimento', { tipo: 'date' })}${UI.campo(st, `parcelas.${i}.valor`, 'Valor (R$)', { tipo: 'num' })}</div>${(p.pagos || []).length ? `<small class="muted">Pago: ${p.pagos.map(g => L.brl(g.valor) + ' em ' + L.fmtBR(g.data)).join(', ')}</small>` : ''}</div>`).join('')}</div><div><button type="button" class="btn sm" data-fa="addP">+ Parcela</button></div>` : ''}</div>`;
  }
  function montarParcelas(st, total) {
    if (st.pagamento === 'avista_pago') return [{ venc: st.dataPgto || st.data, valor: total, pagos: [{ data: st.dataPgto || st.data, valor: total }] }];
    if (st.pagamento === 'avista_prazo') { if (!st.venc) UI.falha('Informe o vencimento.'); return [{ venc: st.venc, valor: total, pagos: [] }]; }
    if (st.pagamento === 'parcelado') {
      const n = Math.round(N(st.nParcelas)); if (!(n >= 1 && n <= 60)) UI.falha('Número de parcelas entre 1 e 60.');
      if (!st.primeiroVenc) UI.falha('Informe o 1º vencimento.');
      const ps = parcelasIguais(total, n, st.primeiroVenc);
      if (st.primeiraPaga) ps[0].pagos = [{ data: ps[0].venc, valor: ps[0].valor }];
      return ps;
    }
    return st.parcelas.map(p => ({ id: p.id, venc: p.venc, valor: N(p.valor), pagos: p.pagos || [] }));
  }
  const acoesParcelas = { addP: st => st.parcelas.push({ venc: st.data, valor: '', pagos: [] }), rmP: (st, ds) => st.parcelas.splice(+ds.i, 1) };

  // ---------- compra ----------
  F.compra = function (id, inicial) {
    const op = id ? D().ops[id] : null;
    const st0 = op ? {
      _id: id, data: op.data, recebido: !!op.recebidoEm, recebidoEm: op.recebidoEm || L.hoje(), fornecedor: op.fornecedor,
      itens: op.itens.map(i => ({ insumoId: i.insumoId, embs: i.embs, embQtd: i.embQtd, embUnid: i.embUnid, valor: i.valor, lote: i.lote, validade: i.validade || '' })),
      extras: (op.extras || []).map(e => Object.assign({}, e)), rateio: op.rateio, pagamento: 'personalizado', parcelas: L.clone(op.parcelas), obs: op.obs || '',
    } : Object.assign({ _id: L.uid('cp'), data: L.hoje(), recebido: true, recebidoEm: L.hoje(), fornecedor: '', itens: [{ insumoId: '', embs: '1', embQtd: '', embUnid: '', valor: '', lote: '', validade: '' }], extras: [], rateio: 'valor', pagamento: 'avista_pago', dataPgto: L.hoje(), venc: L.hoje(), nParcelas: '2', primeiroVenc: L.addMeses(L.hoje(), 1), primeiraPaga: false, parcelas: [], obs: '' }, inicial || {});
    UI.abrir({
      titulo: id ? 'Editar compra' : 'Registrar compra', largura: 'larga',
      acoes: Object.assign({
        add: st => st.itens.push({ insumoId: '', embs: '1', embQtd: '', embUnid: '', valor: '', lote: '', validade: '' }), rm: (st, ds) => st.itens.splice(+ds.i, 1),
        addE: st => st.extras.push({ descricao: 'Frete', valor: '' }), rmE: (st, ds) => st.extras.splice(+ds.i, 1),
        novoIns: () => F.insumo(null),
      }, acoesParcelas),
      aoMudar: (st, p) => {
        const m = p.match(/^itens\.(\d+)\.insumoId$/);
        if (m) { const it = st.itens[+m[1]]; const ins = D().insumos[it.insumoId]; if (ins) { it.embQtd = ins.embQtd || ''; it.embUnid = ins.embUnid || ins.unidade; if (ins.precoEmb && !it.valor) it.valor = L.r2(ins.precoEmb * (N(it.embs) || 1)); } }
      },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'data', 'Data da compra', { tipo: 'date' })}${UI.campo(st, 'fornecedor', 'Fornecedor', { cls: 'w2' })}</div>
        ${UI.chk(st, 'recebido', 'Mercadoria já recebida (entra no estoque)')}${st.recebido ? UI.campo(st, 'recebidoEm', 'Recebida em', { tipo: 'date' }) : '<p class="muted small">O estoque só aumenta quando você marcar o recebimento.</p>'}
        <div class="secao-f"><h3>Itens</h3><div class="linhas">${st.itens.map((it, i) => {
          const ins = D().insumos[it.insumoId];
          const unids = ins ? L.unidadesCompativeis(ins) : [];
          return `<div class="linha">${linhaX('rm', i)}<div class="lg">${UI.sel(st, `itens.${i}.insumoId`, 'Ingrediente ou embalagem', UI.optsInsumos(it.insumoId, 'Escolha…'), { cls: 'w2' })}
            ${UI.campo(st, `itens.${i}.embs`, 'Qtd. de embalagens', { tipo: 'num' })}${UI.campo(st, `itens.${i}.embQtd`, 'Conteúdo de cada', { tipo: 'num' })}
            ${UI.sel(st, `itens.${i}.embUnid`, 'Unidade', UI.opts(unids.map(u => ({ v: u, t: u })), it.embUnid))}${UI.campo(st, `itens.${i}.valor`, 'Valor total pago (R$)', { tipo: 'num' })}
            ${ins && ins.controlaLote ? UI.campo(st, `itens.${i}.lote`, 'Lote') + UI.campo(st, `itens.${i}.validade`, 'Validade', { tipo: 'date' }) : ''}</div></div>`;
        }).join('')}</div><div class="row"><button type="button" class="btn sm" data-fa="add">+ Item</button><button type="button" class="btn sm lk" data-fa="novoIns">Cadastrar novo ingrediente</button></div></div>
        <div class="secao-f"><h3>Despesas adicionais da compra</h3><div class="linhas">${st.extras.map((e, i) => `<div class="linha">${linhaX('rmE', i)}<div class="lg">${UI.campo(st, `extras.${i}.descricao`, 'Descrição')}${UI.campo(st, `extras.${i}.valor`, 'Valor (R$)', { tipo: 'num' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="addE">+ Frete ou taxa</button></div>
          ${st.extras.length ? `<div class="f"><span>Como distribuir</span>${UI.segmento(st, 'rateio', [['valor', 'Pelo valor dos itens'], ['quantidade', 'Pela quantidade'], ['separado', 'Despesa separada']])}<small>${{ valor: 'Cada item recebe uma parte proporcional ao valor pago e o custo do estoque sobe nessa proporção.', quantidade: 'Proporcional à quantidade (só quando todos os itens usam a mesma unidade).', separado: 'Não entra no custo dos ingredientes; vai para despesas do mês (Frete e despesas de compra).' }[st.rateio]}</small></div>` : ''}</div>
        ${blocoPagamento(st)}
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}`,
      previa: st => {
        const r = prep(st, true);
        if (!r.ok) return `<div class="nota">${esc(r.erro)}</div>`;
        const o = r.op;
        return `<div class="eyebrow">Resumo</div>${UI.tabela([{ t: 'Item' }, { t: 'Entra no estoque', n: 1 }, { t: 'Custo c/ adicionais', n: 1 }, { t: 'Custo por unidade', n: 1 }], o.itens.map(i => { const ins = D().insumos[i.insumoId]; return [esc(ins.nome), L.nf(i.qBase) + ' ' + ins.unidade, L.brl(i.custoTotal), L.brl4(i.custoUnit) + '/' + ins.unidade]; }))}
          ${UI.dl([['Total da compra', L.brl(o.total), 'tot'], ['Parcelas', o.parcelas.map(p => L.brl(p.valor) + ' em ' + L.fmtBR(p.venc)).join(' · ')]])}`;
      },
      salvar: async st => {
        const r = prep(st, false); if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(st._id, r.op, 'compra editada');
        return 'Compra registrada: estoque, preços e contas a pagar atualizados.';
      },
    }, st0);
    function prep(st, simular) {
      try {
        const itensVal = st.itens.filter(i => i.insumoId).map(i => ({ insumoId: i.insumoId, embs: N(i.embs), embQtd: N(i.embQtd), embUnid: i.embUnid, valor: N(i.valor), lote: i.lote, validade: i.validade }));
        const extras = st.extras.map(e => ({ descricao: e.descricao, valor: N(e.valor) }));
        const total = L.r2(L.sum(itensVal, i => i.valor || 0) + L.sum(extras, e => e.valor || 0));
        let parcelas;
        try { parcelas = montarParcelas(st, total); } catch (e) { if (simular) parcelas = [{ venc: st.data, valor: total, pagos: [] }]; else throw e; }
        return L.prepararCompra(D(), { data: st.data, fornecedor: st.fornecedor, recebidoEm: st.recebido ? st.recebidoEm : null, itens: itensVal, extras, rateio: st.rateio, parcelas, obs: st.obs });
      } catch (e) { return { ok: false, erro: e.message }; }
    }
  };

  // ---------- pagamento / recebimento de parcela ----------
  F.pagar = function (opId, parcelaId) {
    const op = D().ops[opId]; if (!op) return;
    const venda = op.k === 'venda';
    const lista = venda ? op.recebimentos : op.parcelas;
    const p = lista.find(x => x.id === parcelaId); if (!p) return;
    const resta = L.r2(p.valor - L.sum(p.pagos, g => g.valor));
    UI.abrir({
      titulo: venda ? 'Registrar recebimento' : (op.k === 'lanc' && (op.natureza === 'receita' || op.natureza === 'aporte') ? 'Registrar entrada' : 'Registrar pagamento'), largura: 'estreita',
      corpo: st => `<p class="small">${venda ? 'Previsto' : 'Parcela'}: <strong>${L.brl(p.valor)}</strong> com vencimento em ${L.fmtBR(venda ? p.data : p.venc)}. Em aberto: <strong>${L.brl(resta)}</strong>.</p>
        <div class="lg">${UI.campo(st, 'data', 'Data em que o dinheiro ' + (venda ? 'entrou' : 'saiu'), { tipo: 'date' })}${UI.campo(st, 'valor', 'Valor (R$)', { tipo: 'num' })}</div>
        ${venda ? UI.chk(st, 'encerrar', 'Encerrar este recebimento com o valor informado', 'Use quando o repasse veio diferente do previsto. A diferença entra como taxa adicional da venda, sem alterar o faturamento.') : ''}`,
      salvar: async st => {
        const v = N(st.valor); if (!(v >= 0)) UI.falha('Informe o valor.');
        if (!(v > 0) && !st.encerrar) UI.falha('Informe o valor.');
        if (v > resta + 0.009) UI.falha('O valor passa do que está em aberto (' + L.brl(resta) + ').');
        const novo = L.clone(op);
        const alvo = (venda ? novo.recebimentos : novo.parcelas).find(x => x.id === parcelaId);
        if (v > 0) alvo.pagos.push({ id: L.uid('g'), data: st.data, valor: L.r2(v) });
        if (st.encerrar) alvo.encerrado = true;
        await UI.gravarOp(opId, novo, venda ? 'recebimento registrado' : 'pagamento registrado');
        return venda ? 'Recebimento registrado.' : 'Pagamento registrado.';
      },
    }, { data: L.hoje(), valor: resta, encerrar: false });
  };
  F.estornarPagamento = async function (opId, parcelaId, pagoId) {
    const op = D().ops[opId]; if (!op) return;
    const ok = await UI.confirmar({ titulo: 'Desfazer pagamento', texto: 'O valor volta a ficar em aberto. O registro fica no histórico da operação.', botao: 'Desfazer' });
    if (!ok) return;
    const novo = L.clone(op);
    const lista = op.k === 'venda' ? novo.recebimentos : novo.parcelas;
    const p = lista.find(x => x.id === parcelaId); p.pagos = p.pagos.filter(g => g.id !== pagoId); p.encerrado = false;
    try { await UI.gravarOp(opId, novo, 'pagamento desfeito'); UI.toast('Pagamento desfeito.'); } catch (e) { UI.toast(e.message); }
  };

  // ---------- produção de massa ----------
  F.producao = function (id, inicial) {
    const op = id ? D().ops[id] : null;
    function defaults(st) {
      const r = D().receitas[st.receitaId]; if (!r) return;
      const v = L.ultimaVersao(r); const m = N(st.mult) || 1;
      st.saidas = (v.saidas || []).map(s => ({ varianteId: s.varianteId, unidades: Math.round(s.unidades * m) }));
      const t = v.tempos || {};
      st.minutos = L.r2(((t.preparo || 0) + (t.porcionamento || 0) + (t.embalagem || 0) + (t.outras || 0)) * m);
      st.kitArmazQtd = v.kitArmazId ? Math.ceil((v.kitArmazQtd || 0) * m) : 0;
      st.validadeDias = v.validadeMassaDias === null || v.validadeMassaDias === undefined ? '' : v.validadeMassaDias;
    }
    const st0 = op ? {
      _id: id, receitaId: op.receitaId, data: op.data, mult: op.mult, saidas: op.saidas.map(s => ({ varianteId: s.varianteId, unidades: s.unidades })), minutos: op.minutos, kitArmazQtd: op.kitArmazQtd,
      validadeDias: op.validadeDias === null ? '' : op.validadeDias, lote: op.lote, obs: op.obs,
      assar: op.direto ? { ativo: true, fornoId: op.usosForno[0].fornoId, minForno: op.usosForno[0].minutos, preaqMin: op.usosForno[0].preaqMin, minAtivo: op.minAtivoAssar } : { ativo: false },
    } : Object.assign({ _id: L.uid('pd'), receitaId: '', data: L.hoje(), mult: '1', saidas: [], minutos: '', kitArmazQtd: '', validadeDias: '', lote: 'M' + L.hoje().slice(2).replace(/-/g, ''), assar: { ativo: false, fornoId: '', minForno: '', preaqMin: '', minAtivo: '' }, obs: '' }, inicial || {});
    if (!op && st0.receitaId) defaults(st0);
    UI.abrir({
      titulo: id ? 'Editar produção' : 'Registrar produção de massa', largura: 'larga',
      aoMudar: (st, p) => {
        if (p === 'receitaId') defaults(st);
        if (p === 'assar.fornoId') { const f = D().fornos[st.assar.fornoId]; if (f && !st.assar.preaqMin) st.assar.preaqMin = f.preaqMin || ''; const v = D().variantes[(st.saidas[0] || {}).varianteId]; if (v && v.assar && !st.assar.minForno) { st.assar.minForno = v.assar.minForno || ''; st.assar.minAtivo = v.assar.minAtivoFornada || ''; } }
      },
      acoes: { recalcular: st => defaults(st) },
      corpo: st => {
        const rec = D().receitas[st.receitaId];
        return `<div class="lg">${UI.sel(st, 'receitaId', 'Receita', UI.opts(L.ativos(D().receitas).map(r => ({ v: r.id, t: r.nome + ' (v' + L.ultimaVersao(r).v + ')' })), st.receitaId, 'Escolha…'), { cls: 'w2' })}
          ${UI.campo(st, 'data', 'Data', { tipo: 'date' })}${UI.campo(st, 'lote', 'Código do lote')}</div>
        ${rec ? `<div class="lg">${UI.campo(st, 'mult', 'Quantas receitas (ex.: 1, 2 ou 0,5)', { tipo: 'num' })}<div class="f"><span>&nbsp;</span><button type="button" class="btn sm" data-fa="recalcular">Recalcular pela receita</button></div></div>
        <div class="secao-f"><h3>Rendimento real (unidades boas)</h3><p class="muted small">Conte as porções que realmente saíram. A diferença para o previsto fica registrada.</p>
          <div class="lg">${st.saidas.map((s, i) => UI.campo(st, `saidas.${i}.unidades`, esc(L.nomeVariante(D(), s.varianteId)), { tipo: 'int' })).join('')}</div></div>
        <div class="lg">${UI.campo(st, 'minutos', 'Trabalho ativo (min)', { tipo: 'num' })}
          ${st.assar.ativo ? '' : UI.campo(st, 'kitArmazQtd', 'Embalagens de armazenamento usadas', { tipo: 'num' }) + UI.campo(st, 'validadeDias', 'Validade da massa (dias)', { tipo: 'int', ajuda: 'Prazo definido por você; o sistema não certifica validade sanitária.' })}</div>
        <div class="secao-f">${UI.chk(st, 'assar.ativo', 'Assar agora, sem congelar (produção direta)', 'Gera lote assado direto, com energia e trabalho do assamento.')}
          ${st.assar.ativo ? `<div class="lg">${UI.sel(st, 'assar.fornoId', 'Forno', UI.optsFornos(st.assar.fornoId, 'Escolha…'))}${UI.campo(st, 'assar.minForno', 'Minutos no forno', { tipo: 'num' })}${UI.campo(st, 'assar.preaqMin', 'Pré-aquecimento (min)', { tipo: 'num' })}${UI.campo(st, 'assar.minAtivo', 'Trabalho ativo no assamento (min)', { tipo: 'num' })}</div>` : ''}</div>` : ''}
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}`;
      },
      previa: st => {
        if (!st.receitaId) return '<p class="muted small">Escolha a receita para ver consumo e custos.</p>';
        const r = prep(st); if (!r.ok) return erroPrevia(r);
        const o = r.op;
        const cons = UI.tabela([{ t: 'Sai do estoque' }, { t: 'Quantidade', n: 1 }, { t: 'Custo', n: 1 }], o.consumos.map(c => { const i = D().insumos[c.insumoId]; return [esc(i.nome), L.nf(c.qtd) + ' ' + i.unidade, L.brl(c.custo)]; }));
        const lot = UI.tabela([{ t: o.direto ? 'Lote assado' : 'Lote de massa' }, { t: 'Unidades', n: 1 }, { t: 'Custo/un.', n: 1 }, { t: 'Validade' }], o.lotes.map(l => [esc(L.nomeVariante(D(), l.varianteId)), l.unidades, L.brl4(l.cu.m + l.cu.e + l.cu.t), l.validade ? L.fmtBR(l.validade) : '<span class="muted">não informada</span>']));
        const prev = o.previsto.map(p => { const real = (o.saidas.find(s => s.varianteId === p.varianteId) || {}).unidades || 0; return real !== p.unidades ? `${esc(L.nomeVariante(D(), p.varianteId))}: previsto ${p.unidades}, real ${real}` : ''; }).filter(Boolean);
        return `${cons}${lot}${UI.dl([['Materiais', L.brl(o.custos.materiais)], ['Trabalho (estimado)', L.brl(o.custos.trabalho)], o.direto ? ['Energia/gás (estimativa)', L.brl(o.custos.energia)] : null, ['Custo do lote', L.brl(o.custos.total), 'tot']])}${prev.length ? `<div class="nota small">Rendimento diferente do previsto: ${prev.join('; ')}.</div>` : ''}`;
      },
      salvar: async st => {
        const r = prep(st); if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(st._id, r.op, 'produção editada');
        return r.op.direto ? 'Produção direta registrada: ingredientes baixados e lote assado criado.' : 'Produção registrada: ingredientes baixados e lote de massa criado.';
      },
    }, st0);
    function prep(st) {
      try { return L.prepararProducao(D(), sEx(st._id), Object.assign({}, st, { saidas: st.saidas.map(s => ({ varianteId: s.varianteId, unidades: N(s.unidades) })), mult: N(st.mult), minutos: N(st.minutos), kitArmazQtd: N(st.kitArmazQtd), validadeDias: st.validadeDias === '' ? null : N(st.validadeDias) }), st._id); }
      catch (e) { return { ok: false, erro: e.message }; }
    }
  };

  // ---------- fornada ----------
  F.fornada = function (id, inicial) {
    const op = id ? D().ops[id] : null;
    const st0 = op ? { _id: id, data: op.data, lote: op.lote, usos: op.usos.map(u => ({ fornoId: u.fornoId, minutos: u.minutos, preaqMin: u.preaqMin })), linhas: op.linhas.map(l => ({ key: l.key, retiradas: l.retiradas, boas: l.boas })), minAtivo: op.minAtivo, obs: op.obs, venderDepois: false }
      : Object.assign({ _id: L.uid('fn'), data: L.hoje(), lote: '', usos: [{ fornoId: (L.ativos(D().fornos)[0] || {}).id || '', minutos: '', preaqMin: (L.ativos(D().fornos)[0] || {}).preaqMin || '' }], linhas: [{ key: '', retiradas: '', boas: '' }], minAtivo: '', obs: '', venderDepois: false }, inicial || {});
    UI.abrir({
      titulo: id ? 'Editar fornada' : 'Registrar fornada', largura: 'larga',
      acoes: {
        add: st => st.linhas.push({ key: '', retiradas: '', boas: '' }), rm: (st, ds) => st.linhas.splice(+ds.i, 1),
        addU: st => st.usos.push({ fornoId: '', minutos: '', preaqMin: '' }), rmU: (st, ds) => st.usos.splice(+ds.i, 1),
      },
      aoMudar: (st, p) => {
        const m = p.match(/^linhas\.(\d+)\.key$/);
        if (m) { const lo = sEx(st._id).lotes[st.linhas[+m[1]].key]; const v = lo && D().variantes[lo.varianteId]; if (v && v.assar) { if (!st.usos[0].minutos && v.assar.minForno) st.usos[0].minutos = v.assar.minForno; if (!st.minAtivo && v.assar.minAtivoFornada) st.minAtivo = v.assar.minAtivoFornada; } }
        const u = p.match(/^usos\.(\d+)\.fornoId$/); if (u) { const f = D().fornos[st.usos[+u[1]].fornoId]; if (f && !st.usos[+u[1]].preaqMin) st.usos[+u[1]].preaqMin = f.preaqMin || ''; }
      },
      corpo: st => {
        const S = sEx(st._id);
        const lotes = L.lotesDisponiveis(S, 'massa', null, st.data);
        const porVar = {};
        lotes.forEach(l => { if (!L.vencido(l, st.data) && !porVar[l.varianteId]) porVar[l.varianteId] = l.key; });
        const optsLotes = UI.opts(lotes.map(l => ({ v: l.key, t: `${L.nomeVariante(D(), l.varianteId)} · ${l.lote || 'sem código'} · ${L.nf(l.saldo, 0)} un. · ${l.validade ? (L.vencido(l, st.data) ? 'VENCIDO ' : 'vence ') + L.fmtBR(l.validade) : 'sem validade'}${porVar[l.varianteId] === l.key ? ' · usar primeiro' : ''}` })), '', 'Escolha o lote de massa…');
        return `<div class="lg">${UI.campo(st, 'data', 'Data', { tipo: 'date', re: 1 })}${UI.campo(st, 'lote', 'Código do lote assado (opcional)')}</div>
        ${lotes.length ? '' : '<div class="nota">Não há massa congelada disponível nesta data. Registre uma produção de massa ou use a produção direta.</div>'}
        <div class="secao-f"><h3>Massa retirada do congelador</h3><p class="muted small">O sistema indica o lote com validade mais próxima. Lotes vencidos não podem ser assados.</p>
          <div class="linhas">${st.linhas.map((l, i) => `<div class="linha">${linhaX('rm', i)}<div class="lg">${UI.sel(st, `linhas.${i}.key`, 'Lote', optsLotes.replace(`value="${esc(l.key)}"`, `value="${esc(l.key)}" selected`), { cls: 'w2' })}${UI.campo(st, `linhas.${i}.retiradas`, 'Porções retiradas', { tipo: 'int' })}${UI.campo(st, `linhas.${i}.boas`, 'Cookies bons', { tipo: 'int', ajuda: 'Vazio = todos bons.' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="add">+ Lote</button></div></div>
        <div class="secao-f"><h3>Forno</h3><div class="linhas">${st.usos.map((u, i) => `<div class="linha">${st.usos.length > 1 ? linhaX('rmU', i) : ''}<div class="lg">${UI.sel(st, `usos.${i}.fornoId`, 'Forno', UI.optsFornos(u.fornoId, 'Escolha…'))}${UI.campo(st, `usos.${i}.minutos`, 'Minutos assando', { tipo: 'num' })}${UI.campo(st, `usos.${i}.preaqMin`, 'Pré-aquecimento (min)', { tipo: 'num' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="addU">+ Outro forno</button></div>
          ${UI.campo(st, 'minAtivo', 'Seu trabalho ativo na fornada (min)', { tipo: 'num', ajuda: 'Não inclua o tempo em que o forno trabalha sozinho.' })}</div>
        ${id ? '' : UI.chk(st, 'venderDepois', 'Registrar a venda destes cookies em seguida')}
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}`;
      },
      previa: st => {
        if (!st.linhas.some(l => l.key && N(l.retiradas) > 0)) return '<p class="muted small">Escolha o lote de massa e quantas porções foram ao forno.</p>';
        const r = prep(st); if (!r.ok) return erroPrevia(r);
        const o = r.op;
        return `${UI.tabela([{ t: 'Lote assado' }, { t: 'Bons', n: 1 }, { t: 'Custo/un.', n: 1 }, { t: 'Validade' }], o.lotes.map(l => [esc(L.nomeVariante(D(), l.varianteId)), l.unidades, L.brl4(l.cu.m + l.cu.e + l.cu.t), l.validade ? L.fmtBR(l.validade) : '<span class="muted">cadastre a validade do assado</span>']))}
          ${UI.dl([['Energia/gás (estimativa)' + (o.manual ? ' · manual' : ''), L.brl(o.custos.energia) + (o.consumoForno.kwh ? ` · ${L.nf(o.consumoForno.kwh, 3)} kWh` : '') + (o.consumoForno.gas ? ` · ${L.nf(o.consumoForno.gas, 3)} ${esc(D().cfg.unidadeGas)}` : '')], ['Trabalho (estimado)', L.brl(o.custos.trabalho)], o.perdas.length ? ['Perdas na fornada', o.perdas.map(p => p.unidades + ' un. ' + esc(L.nomeVariante(D(), p.varianteId))).join(', ') + ' · ' + L.brl(L.sum(o.perdas, p => p.valor))] : null])}
          <p class="tiny muted">Energia e trabalho divididos ${o.criterio === 'unidades' ? 'pelas unidades' : 'pelo peso de massa'} dos cookies bons. Ingredientes não são baixados de novo.</p>`;
      },
      salvar: async st => {
        const r = prep(st); if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(st._id, r.op, 'fornada editada');
        if (st.venderDepois) setTimeout(() => F.venda(null, { linhasIniciais: r.op.lotes.map(l => ({ tipo: 'v', refId: l.varianteId, qtd: l.unidades })), data: st.data }), 50);
        return 'Fornada registrada: massa retirada e lote assado criado.';
      },
    }, st0);
    function prep(st) {
      try { return L.prepararFornada(D(), sEx(st._id), Object.assign({}, st, { linhas: st.linhas.map(l => ({ key: l.key, retiradas: N(l.retiradas), boas: l.boas === '' || l.boas === null || l.boas === undefined ? N(l.retiradas) : N(l.boas) })), minAtivo: N(st.minAtivo), usos: st.usos.map(u => ({ fornoId: u.fornoId, minutos: N(u.minutos), preaqMin: N(u.preaqMin) })) }), st._id); }
      catch (e) { return { ok: false, erro: e.message }; }
    }
  };

  // ---------- perda ----------
  const MOTIVOS = ['Queimou', 'Quebrou ou deformou', 'Venceu', 'Caiu / contaminou', 'Degustação ou amostra', 'Outro'];
  F.perda = function (inicial) {
    const st0 = Object.assign({ _id: L.uid('pe'), data: L.hoje(), alvo: 'assado', key: '', insumoId: '', qtd: '', motivoSel: 'Queimou', motivo: '', obs: '' }, inicial || {});
    UI.abrir({
      titulo: 'Registrar perda real',
      corpo: st => {
        const S = UI.S();
        const lotes = Object.values(S.lotes).filter(l => l.estado === st.alvo && l.saldo > 0);
        return `<div class="f"><span>O que foi perdido</span>${UI.segmento(st, 'alvo', [['assado', 'Cookie assado'], ['massa', 'Massa congelada'], ['ins', 'Ingrediente/embalagem']])}</div>
        <div class="lg">${st.alvo === 'ins' ? UI.sel(st, 'insumoId', 'Item', UI.optsInsumos(st.insumoId, 'Escolha…'), { cls: 'w2' })
          : UI.sel(st, 'key', 'Lote', UI.opts(lotes.map(l => ({ v: l.key, t: `${L.nomeVariante(D(), l.varianteId)} · ${l.lote || 'sem código'} · ${L.nf(l.saldo, 0)} un.${l.validade ? ' · val. ' + L.fmtBR(l.validade) : ''}` })), st.key, 'Escolha…'), { cls: 'w2' })}
          ${UI.campo(st, 'qtd', 'Quantidade' + (st.alvo === 'ins' ? ' (' + ((D().insumos[st.insumoId] || {}).unidade || '') + ')' : ' (un.)'), { tipo: 'num' })}${UI.campo(st, 'data', 'Data', { tipo: 'date' })}</div>
        <div class="lg">${UI.sel(st, 'motivoSel', 'Motivo', UI.opts(MOTIVOS.map(m => ({ v: m, t: m })), st.motivoSel))}${st.motivoSel === 'Outro' ? UI.campo(st, 'motivo', 'Descreva', { cls: 'w2' }) : ''}</div>
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}
        <p class="muted small">A perda real sai do estoque e entra no resultado. A perda esperada usada no preço não gera saída de dinheiro.</p>`;
      },
      previa: st => { const r = prep(st); return r.ok ? `<div class="small">Valor da perda: <strong>${L.brl(r.op.valor)}</strong> (custo registrado do lote)</div>` : `<div class="nota">${esc(r.erro)}</div>`; },
      salvar: async st => { const r = prep(st); if (!r.ok) UI.falha(r.erro); await UI.gravarOp(st._id, r.op); return 'Perda registrada.'; },
    }, st0);
    function prep(st) { return L.prepararPerda(D(), UI.S(), { data: st.data, alvo: st.alvo, key: st.key, insumoId: st.insumoId, qtd: N(st.qtd), motivo: st.motivoSel === 'Outro' ? st.motivo : st.motivoSel, obs: st.obs }); }
  };

  // ---------- ajuste documentado ----------
  F.ajuste = function (inicial) {
    const st0 = Object.assign({ _id: L.uid('aj'), data: L.hoje(), alvo: 'ins', key: '', insumoId: '', delta: '', motivo: '', custoUnit: '', lote: '', validade: '' }, inicial || {});
    UI.abrir({
      titulo: 'Ajuste de estoque',
      corpo: st => {
        const S = UI.S();
        const lotes = Object.values(S.lotes).filter(l => l.estado === st.alvo && !l.orfao);
        const ins = D().insumos[st.insumoId];
        const atual = st.alvo === 'ins' ? (ins ? `${L.nf((S.ins[st.insumoId] || { qtd: 0 }).qtd)} ${ins.unidade}` : '') : (S.lotes[st.key] ? L.nf(S.lotes[st.key].saldo, 0) + ' un.' : '');
        return `<p class="muted small">Use para corrigir contagem (sobra ou falta encontrada). O motivo fica registrado no histórico.</p>
        <div class="f"><span>Corrigir</span>${UI.segmento(st, 'alvo', [['ins', 'Ingrediente/embalagem'], ['massa', 'Lote de massa'], ['assado', 'Lote assado']])}</div>
        <div class="lg">${st.alvo === 'ins' ? UI.sel(st, 'insumoId', 'Item', UI.optsInsumos(st.insumoId, 'Escolha…'), { cls: 'w2' })
          : UI.sel(st, 'key', 'Lote', UI.opts(lotes.map(l => ({ v: l.key, t: `${L.nomeVariante(D(), l.varianteId)} · ${l.lote || 'sem código'} · ${L.nf(l.saldo, 0)} un.` })), st.key, 'Escolha…'), { cls: 'w2' })}
          ${UI.campo(st, 'delta', 'Diferença (+ entra, − sai)', { tipo: 'num', ph: 'Ex.: -120 ou 3' })}${UI.campo(st, 'data', 'Data', { tipo: 'date' })}</div>
        ${atual ? `<p class="small">Saldo atual no sistema: <strong>${atual}</strong></p>` : ''}
        ${st.alvo === 'ins' && N(st.delta) > 0 ? `<div class="lg">${UI.campo(st, 'custoUnit', `Custo por ${ins ? ins.unidade : 'unidade'} (vazio = custo médio)`, { tipo: 'num' })}${ins && ins.controlaLote ? UI.campo(st, 'lote', 'Lote') + UI.campo(st, 'validade', 'Validade', { tipo: 'date' }) : ''}</div>` : ''}
        ${UI.campo(st, 'motivo', 'Motivo do ajuste', { ph: 'Ex.: contagem física em 10/10' })}`;
      },
      previa: st => { const r = prep(st); return r.ok ? `<div class="small">Efeito no valor do estoque: <strong>${L.brl(r.op.valor)}</strong></div>` : `<div class="nota">${esc(r.erro)}</div>`; },
      salvar: async st => { const r = prep(st); if (!r.ok) UI.falha(r.erro); await UI.gravarOp(st._id, r.op); return 'Ajuste registrado.'; },
    }, st0);
    function prep(st) { return L.prepararAjuste(D(), UI.S(), { data: st.data, alvo: st.alvo, key: st.key, insumoId: st.insumoId, delta: N(st.delta), motivo: st.motivo, custoUnit: st.custoUnit === '' ? '' : N(st.custoUnit), lote: st.lote, validade: st.validade }); }
  };

  // ---------- venda do dia ----------
  function precoDe(tipo, refId, canalId) { const e = tipo === 'c' ? D().combos[refId] : D().variantes[refId]; return e && e.precos && e.precos[canalId] ? e.precos[canalId] : ''; }
  function descontoPromo(l) {
    const p = D().promocoes[l.promoId]; if (!p) return 0;
    const q = N(l.qtd) || 0; const pr = N(l.precoUnit) || 0;
    return L.r2(p.descTipo === 'pct' ? pr * q * (N(p.desc) || 0) / 100 : Math.min(pr, N(p.desc) || 0) * q);
  }
  F.venda = function (id, inicial) {
    const op = id ? D().ops[id] : null;
    const canal0 = L.ativos(D().canais)[0];
    const novaLinha = (o) => Object.assign({ id: L.uid('l'), tipo: 'v', refId: '', qtd: '', precoUnit: '', desconto: '', promoId: '', composicao: [] }, o || {});
    let st0;
    if (op) {
      st0 = {
        _id: id, data: op.data, canalId: op.canalId, formaId: op.formaId, pedidos: op.pedidos || '', obs: op.obs || '',
        linhas: op.linhas.map(l => ({ id: l.id, tipo: l.tipo, refId: l.refId, qtd: l.qtd, precoUnit: l.precoUnit, desconto: l.desconto || '', promoId: l.promoId || '', composicao: l.tipo === 'c' && (D().combos[l.refId] || {}).tipo === 'livre' ? l.composicao.map(x => ({ varianteId: x.varianteId, qtd: x.qtd })) : [] })),
        entrega: { cobrada: op.entrega.cobrada || '', custo: op.entrega.custo || '' }, taxasEfetivas: op.taxasEfetivas === null ? '' : op.taxasEfetivas,
        recPers: true, recebimentos: L.clone(op.recebimentos), recebidoNaHora: false,
      };
    } else {
      const ini = inicial || {};
      st0 = { _id: L.uid('vd'), data: ini.data || L.hoje(), canalId: canal0 ? canal0.id : '', formaId: canal0 ? canal0.formaPadraoId || '' : '', pedidos: '', obs: '', linhas: [], entrega: { cobrada: '', custo: '' }, taxasEfetivas: '', recPers: false, recebimentos: [], recebidoNaHora: true };
      st0.linhas = (ini.linhasIniciais || [{}]).map(l => novaLinha(Object.assign({}, l, { precoUnit: l.refId ? precoDe(l.tipo || 'v', l.refId, st0.canalId) : '' })));
    }
    UI.abrir({
      titulo: id ? 'Editar vendas' : 'Registrar vendas do dia', largura: 'larga',
      acoes: {
        add: st => st.linhas.push(novaLinha()), addC: st => st.linhas.push(novaLinha({ tipo: 'c' })), rm: (st, ds) => st.linhas.splice(+ds.i, 1),
        addR: st => st.recebimentos.push({ data: st.data, valor: '', pagos: [] }), rmR: (st, ds) => st.recebimentos.splice(+ds.i, 1),
      },
      aoMudar: (st, p) => {
        if (p === 'canalId') { const c = D().canais[st.canalId]; if (c && c.formaPadraoId) st.formaId = c.formaPadraoId; st.linhas.forEach(l => { const pr = precoDe(l.tipo, l.refId, st.canalId); if (pr) l.precoUnit = pr; }); }
        const m = p.match(/^linhas\.(\d+)\.(refId|promoId|qtd|precoUnit|tipo)$/);
        if (m) {
          const l = st.linhas[+m[1]];
          if (m[2] === 'refId' || m[2] === 'tipo') { l.precoUnit = precoDe(l.tipo, l.refId, st.canalId); l.composicao = []; l.promoId = ''; l.desconto = ''; }
          if (l.promoId) l.desconto = descontoPromo(l);
          const c = l.tipo === 'c' ? D().combos[l.refId] : null;
          if (c && c.tipo === 'livre' && !l.composicao.length) l.composicao = (c.livre.permitidas || []).map(v => ({ varianteId: v, qtd: '' }));
        }
        if (['canalId', 'formaId', 'data'].includes(p) && !st.recPers) st.recebidoNaHora = L.taxas(D(), st.canalId, st.formaId).prazo === 0;
      },
      corpo: st => {
        const tx = L.taxas(D(), st.canalId, st.formaId);
        const promos = (tipo, refId) => L.ativos(D().promocoes).filter(p => p.ativa !== false && p.alvoTipo === tipo && p.alvoId === refId && (!p.canalId || p.canalId === st.canalId) && (!p.inicio || p.inicio <= st.data) && (!p.fim || p.fim >= st.data));
        return `<div class="lg">${UI.campo(st, 'data', 'Data das vendas', { tipo: 'date', re: 1 })}${UI.sel(st, 'canalId', 'Canal', UI.optsCanais(st.canalId, 'Escolha…'))}${UI.sel(st, 'formaId', 'Forma de pagamento', UI.optsFormas(st.formaId, 'Escolha…'))}
          ${UI.campo(st, 'pedidos', 'Nº de pedidos/transações', { tipo: 'int', ajuda: tx.fixoPedido > 0 ? 'Necessário: há taxa fixa por pedido.' : 'Opcional.' })}</div>
        <p class="muted small">Registre os totais do dia por item. Se o mesmo item saiu com preços diferentes, use linhas separadas. Pagamentos diferentes (Pix, crédito) vão em registros separados.</p>
        <div class="linhas">${st.linhas.map((l, i) => {
          const c = l.tipo === 'c' ? D().combos[l.refId] : null;
          const pr = promos(l.tipo, l.refId);
          return `<div class="linha">${linhaX('rm', i)}<div class="lg">
            ${UI.sel(st, `linhas.${i}.refId`, l.tipo === 'c' ? 'Combo' : 'Item', l.tipo === 'c' ? UI.opts(L.ativos(D().combos).map(x => ({ v: x.id, t: x.nome })), l.refId, 'Escolha…') : UI.optsVariantes(l.refId, 'Escolha…'), { cls: 'w2' })}
            ${UI.campo(st, `linhas.${i}.qtd`, l.tipo === 'c' ? 'Combos vendidos' : 'Quantidade', { tipo: 'int', re: 1 })}${UI.campo(st, `linhas.${i}.precoUnit`, 'Preço unitário (R$)', { tipo: 'num', re: 1 })}
            ${pr.length ? UI.sel(st, `linhas.${i}.promoId`, 'Promoção', UI.opts(pr.map(p => ({ v: p.id, t: p.nome })), l.promoId, 'Sem promoção')) : ''}
            ${UI.campo(st, `linhas.${i}.desconto`, 'Desconto total da linha (R$)', { tipo: 'num' })}</div>
            ${c && c.tipo === 'livre' ? `<div class="f"><span>Composição vendida (total ${(N(l.qtd) || 0) * (c.livre.qtd || 0)} un.)</span><div class="lg">${l.composicao.map((x, j) => UI.campo(st, `linhas.${i}.composicao.${j}.qtd`, esc(L.nomeVariante(D(), x.varianteId)), { tipo: 'int' })).join('')}</div><small>Some todas as unidades dos combos iguais.</small></div>` : ''}</div>`;
        }).join('')}</div>
        <div class="row"><button type="button" class="btn sm" data-fa="add">+ Item</button><button type="button" class="btn sm" data-fa="addC">+ Combo</button></div>
        <div class="secao-f"><h3>Entrega própria</h3><div class="lg">${UI.campo(st, 'entrega.cobrada', 'Taxa de entrega cobrada dos clientes (R$)', { tipo: 'num' })}${UI.campo(st, 'entrega.custo', 'Pago ao entregador (R$)', { tipo: 'num' })}</div>
          <p class="muted tiny">Em plataformas com entregador parceiro, deixe em branco: a taxa paga pelo cliente à plataforma não é receita da LEORA.</p></div>
        <div class="secao-f"><h3>Taxas e recebimento</h3>${UI.campo(st, 'taxasEfetivas', 'Taxas efetivamente cobradas (R$, opcional)', { tipo: 'num', ajuda: 'Se informar, substitui a previsão e o sistema mostra a diferença.' })}
          ${UI.chk(st, 'recPers', 'Informar recebimentos em datas ou valores diferentes')}
          ${st.recPers ? `<div class="linhas">${st.recebimentos.map((r, i) => `<div class="linha">${(r.pagos || []).length ? '' : linhaX('rmR', i)}<div class="lg">${UI.campo(st, `recebimentos.${i}.data`, 'Data prevista', { tipo: 'date' })}${UI.campo(st, `recebimentos.${i}.valor`, 'Valor (R$)', { tipo: 'num' })}</div>${(r.pagos || []).length ? `<small class="muted">Recebido: ${r.pagos.map(g => L.brl(g.valor) + ' em ' + L.fmtBR(g.data)).join(', ')}</small>` : ''}</div>`).join('')}</div><div><button type="button" class="btn sm" data-fa="addR">+ Recebimento</button></div>`
          : UI.chk(st, 'recebidoNaHora', 'O dinheiro já entrou (Pix, dinheiro ou débito na hora)')}</div>
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}`;
      },
      previa: st => {
        if (!st.linhas.some(l => l.refId && N(l.qtd) > 0)) return '<p class="muted small">Escolha os itens e as quantidades para ver taxas, líquido e o que sai do estoque.</p>';
        const r = prep(st); if (!r.ok) return erroPrevia(r);
        const o = r.op; const cv = o.resumo;
        const custoM = L.sum(o.linhas, l => l.custo.m), custoE = L.sum(o.linhas, l => l.custo.e), custoT = L.sum(o.linhas, l => l.custo.t);
        const contrib = cv.produtos - cv.taxas + cv.entrega - cv.custoEntrega - custoM - custoE;
        return `<div class="grid g2"><div>${UI.dl([
          ['Bruto (preço × quantidade)', L.brl(cv.bruto)], cv.descontos ? ['Descontos', '− ' + L.brl(cv.descontos)] : null, ['Vendas de produtos', L.brl(cv.produtos)],
          cv.entrega ? ['Entrega cobrada', L.brl(cv.entrega)] : null,
          ['Taxas ' + (cv.efetiva !== null ? 'informadas' : 'previstas'), '− ' + L.brl(cv.efetiva !== null ? cv.efetiva : cv.prevista)],
          cv.efetiva !== null ? ['Previsão das taxas', L.brl(cv.prevista) + ` (diferença ${L.brl(cv.efetiva - cv.prevista)})`] : null,
          ['Líquido a receber', L.brl(cv.liquido), 'tot'],
        ])}</div><div>${UI.dl([
          cv.tCanal ? ['Comissão do canal', L.brl(cv.tCanal)] : null, cv.tPag ? ['Taxa da forma de pagamento', L.brl(cv.tPag)] : null, cv.tAnt ? ['Antecipação', L.brl(cv.tAnt)] : null,
          ['Recebimento', o.recebimentos.map(x => L.brl(x.valor) + ' em ' + L.fmtBR(x.data) + ((x.pagos || []).length ? ' (recebido)' : '')).join(' · ')],
          cv.entrega || cv.custoEntrega ? ['Entrega: cobrado − pago', L.brl(cv.entrega - cv.custoEntrega)] : null,
          ['Custo dos produtos (materiais + energia)', L.brl(custoM + custoE)],
          ['Contribuição em dinheiro', L.brl(contrib), 'tot'],
          ['Seu trabalho estimado nestes itens', L.brl(custoT)],
        ])}</div></div><p class="tiny muted">Sai do estoque: ${o.linhas.map(l => l.alocacoes.map(a => `${a.unidades} ${esc(L.nomeVariante(D(), a.varianteId))} (lote ${esc((UI.S().lotes[a.key] || {}).lote || a.key)})`).join(', ')).join('; ')}${o.embalagens.length ? ' + embalagens de venda' : ''}. Massa e ingredientes não são baixados de novo.</p>`;
      },
      salvar: async st => {
        const r = prep(st); if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(st._id, r.op, 'vendas editadas');
        return 'Vendas registradas.';
      },
    }, st0);
    function prep(st) {
      try {
        const f = {
          data: st.data, canalId: st.canalId, formaId: st.formaId, pedidos: N(st.pedidos) || 0, obs: st.obs,
          linhas: st.linhas.map(l => ({ id: l.id, tipo: l.tipo, refId: l.refId, qtd: N(l.qtd), precoUnit: N(l.precoUnit), desconto: N(l.desconto) || 0, promoId: l.promoId, composicao: l.composicao.map(x => ({ varianteId: x.varianteId, qtd: N(x.qtd) || 0 })) })),
          entrega: { cobrada: N(st.entrega.cobrada) || 0, custo: N(st.entrega.custo) || 0 }, taxasEfetivas: st.taxasEfetivas === '' ? null : N(st.taxasEfetivas),
          recebidoNaHora: !st.recPers && st.recebidoNaHora,
          recebimentos: st.recPers ? st.recebimentos.map(r => ({ id: r.id, data: r.data, valor: N(r.valor), pagos: r.pagos || [], encerrado: r.encerrado })) : [],
        };
        return L.prepararVenda(D(), sEx(st._id), f);
      } catch (e) { return { ok: false, erro: e.message }; }
    }
  };

  // ---------- lançamento financeiro ----------
  const NATUREZAS = [['despesa', 'Despesa'], ['aporte', 'Aporte da proprietária'], ['investimento', 'Investimento'], ['retirada', 'Devolução à proprietária'], ['receita', 'Outra entrada']];
  F.lancamento = function (id, inicial) {
    const op = id ? D().ops[id] : null;
    const st0 = op ? Object.assign({ _id: id, valor: op.total, pagamento: op.origem === 'proprietaria' ? 'avista_pago' : 'personalizado', parcelas: L.clone(op.parcelas), valorProprietaria: op.total, competencia: op.competencia }, L.clone(op))
      : Object.assign({ _id: L.uid('lc'), natureza: 'despesa', descricao: '', categoria: 'outras', competencia: L.hoje(), valor: '', pagamento: 'avista_pago', dataPgto: L.hoje(), venc: L.hoje(), nParcelas: '2', primeiroVenc: L.hoje(), primeiraPaga: false, parcelas: [], origem: 'caixa', tipoInvestimento: 'equipamento', vidaUtilMeses: '', valorProprietaria: '', obs: '' }, inicial || {});
    UI.abrir({
      titulo: id ? 'Editar lançamento' : 'Novo lançamento financeiro',
      acoes: acoesParcelas,
      corpo: st => `<div class="f"><span>Tipo</span>${UI.segmento(st, 'natureza', NATUREZAS)}</div>
        <p class="muted small">${{
          despesa: 'Gasto da operação (tráfego, assinaturas, parte da conta de luz/gás, pró-labore…). Compras de ingredientes e embalagens são lançadas em Compras.',
          aporte: 'Dinheiro que você colocou no negócio. Não é venda nem lucro; conta como investimento a recuperar.',
          investimento: 'Equipamentos, utensílios e estrutura. Não vira custo dos cookies do mês; a depreciação é opcional.',
          retirada: 'Dinheiro devolvido a você (recuperação do investimento ou distribuição). Pró-labore é uma despesa: lance como Despesa › Pró-labore.',
          receita: 'Entrada que não é venda de produtos (ex.: reembolso).',
        }[st.natureza]}</p>
        <div class="lg">${UI.campo(st, 'descricao', 'Descrição', { cls: 'w2' })}${st.natureza === 'despesa' ? UI.sel(st, 'categoria', 'Categoria', UI.opts((D().cfg.categoriasDespesa || []).map(c => ({ v: c.id, t: c.nome })), st.categoria)) : ''}
          ${UI.campo(st, 'competencia', 'Data de referência (competência)', { tipo: 'date' })}</div>
        ${st.natureza === 'investimento' ? `<div class="lg">${UI.sel(st, 'tipoInvestimento', 'Tipo', UI.opts([{ v: 'equipamento', t: 'Equipamento' }, { v: 'utensilio', t: 'Utensílio' }, { v: 'estrutura', t: 'Estrutura/instalação' }, { v: 'outro', t: 'Outro' }], st.tipoInvestimento))}
          ${UI.campo(st, 'vidaUtilMeses', 'Vida útil (meses, opcional)', { tipo: 'int' })}</div>
          <div class="f"><span>Como foi pago</span>${UI.segmento(st, 'origem', [['caixa', 'Com dinheiro do negócio (reinvestimento)'], ['proprietaria', 'Bem que a proprietária trouxe']])}</div>` : ''}
        ${st.natureza === 'investimento' && st.origem === 'proprietaria' ? UI.campo(st, 'valorProprietaria', 'Valor do bem (R$)', { tipo: 'num', ajuda: 'Entra como investimento da proprietária; não passa pelo caixa.' })
          : `${st.pagamento === 'personalizado' ? '' : UI.campo(st, 'valor', 'Valor total (R$)', { tipo: 'num' })}${blocoPagamento(st, st.natureza === 'aporte' || st.natureza === 'receita' ? 'Entrada do dinheiro' : 'Pagamento')}`}
        ${UI.campo(st, 'obs', 'Observações', { tipo: 'area' })}`,
      salvar: async st => {
        const total = N(st.valor);
        let parcelas = [];
        if (!(st.natureza === 'investimento' && st.origem === 'proprietaria')) {
          if (st.pagamento !== 'personalizado' && !(total > 0)) UI.falha('Informe o valor.');
          parcelas = montarParcelas(Object.assign({}, st, { data: st.competencia }), L.r2(total));
        }
        const r = L.prepararLancamento(D(), Object.assign({}, st, { parcelas, valorProprietaria: N(st.valorProprietaria) }));
        if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(st._id, r.op, 'lançamento editado');
        return 'Lançamento salvo.';
      },
    }, st0);
  };
  F.lancarRecorrencia = async function (rec) {
    const r = L.prepararLancamento(D(), { natureza: rec.natureza, descricao: rec.descricao, categoria: rec.categoria, competencia: rec.venc, parcelas: [{ venc: rec.venc, valor: rec.valor, pagos: [] }], recorrenciaId: rec.recorrenciaId, mesRef: rec.venc.slice(0, 7) });
    if (!r.ok) { UI.toast(r.erro); return; }
    try { await UI.gravarOp(rec.id, r.op); UI.toast('Conta lançada: ' + rec.descricao); } catch (e) { UI.toast(e.message); }
  };

  // ---------- energia e gás: conta real × estimativa ----------
  F.contaEnergia = function (tipo, ym) {
    ym = ym || L.addMesYM(L.hoje().slice(0, 7), -1);
    UI.abrir({
      titulo: tipo === 'gas' ? 'Parte da conta de gás' : 'Parte da conta de energia', largura: 'larga',
      corpo: st => {
        const ini = st.mes + '-01', fim = st.mes + '-' + String(L.diasNoMes(st.mes)).padStart(2, '0');
        const R = L.resultado(D(), ini, fim);
        const consumo = tipo === 'gas' ? R.gas : R.kwh;
        const un = tipo === 'gas' ? (D().cfg.unidadeGas || 'm³') : 'kWh';
        const tarifa = tipo === 'gas' ? D().cfg.tarifaGas : D().cfg.tarifaKwh;
        const calc = calcConta(st, consumo, tarifa);
        st._calc = calc;
        return `<p class="muted small">A conta da casa é compartilhada. Aqui você separa só a parte da confeitaria, a partir das fornadas registradas no mês. A conta inteira nunca é atribuída ao negócio.</p>
          <div class="lg">${UI.campo(st, 'mes', 'Mês da conta', { tipo: 'month', re: 1 })}${UI.campo(st, 'total', 'Valor total da conta (R$)', { tipo: 'num' })}${UI.campo(st, 'consumoConta', `Consumo total na conta (${un})`, { tipo: 'num' })}</div>
          <div class="lg">${UI.campo(st, 'fixa', 'Parte fixa da conta (R$)', { tipo: 'num', ajuda: 'Taxa mínima, disponibilidade, iluminação pública etc.' })}${UI.campo(st, 'pctFixa', '% da parte fixa para a confeitaria', { tipo: 'num', ajuda: 'Critério seu. Deixe 0 se preferir não dividir.' })}
            ${UI.campo(st, 'venc', 'Vencimento', { tipo: 'date' })}</div>
          <div class="previa">${UI.dl([
            ['Consumo estimado das fornadas do mês', `${L.nf(consumo, 3)} ${un}`],
            ['Estimativa pela tarifa cadastrada', L.brl(consumo * (Number(tarifa) || 0))],
            calc.porConta !== null ? ['Pelo preço médio da conta (variável ÷ consumo)', L.brl(calc.porConta)] : null,
            ['Parte fixa atribuída', L.brl(calc.fixaParte)],
            ['Parte da confeitaria sugerida', L.brl(calc.sugerido), 'tot'],
          ])}<p class="tiny muted">${calc.porConta !== null ? 'Usa o preço médio da sua conta: (total − parte fixa) ÷ consumo total × consumo estimado das fornadas.' : 'Informe total e consumo da conta para usar o preço real; até lá vale a tarifa cadastrada.'} Quando esta despesa é lançada, o resultado do mês usa este valor real no lugar da estimativa de energia dos produtos, sem somar os dois.</p></div>
          ${UI.campo(st, 'valorFinal', 'Valor a lançar como despesa (R$)', { tipo: 'num', ph: L.nf(calc.sugerido, 2) })}`;
      },
      rotuloSalvar: 'Lançar despesa',
      salvar: async st => {
        const v = st.valorFinal !== '' ? N(st.valorFinal) : L.r2(st._calc.sugerido);
        if (!(v > 0)) UI.falha('Não há valor para lançar.');
        const fim = st.mes + '-' + String(L.diasNoMes(st.mes)).padStart(2, '0');
        const r = L.prepararLancamento(D(), { natureza: 'despesa', categoria: tipo === 'gas' ? 'gas' : 'energia', descricao: (tipo === 'gas' ? 'Gás' : 'Energia') + ' — parte da confeitaria ' + L.nomeMesCurto(st.mes), competencia: fim, parcelas: [{ venc: st.venc || fim, valor: L.r2(v), pagos: [] }] });
        if (!r.ok) UI.falha(r.erro);
        await UI.gravarOp(L.uid('lc'), r.op);
        return 'Despesa lançada.';
      },
    }, { mes: ym, total: '', consumoConta: '', fixa: '', pctFixa: '', venc: '', valorFinal: '' });
    function calcConta(st, consumo, tarifa) {
      const total = N(st.total) || 0, cc = N(st.consumoConta) || 0, fixa = N(st.fixa) || 0, pf = (N(st.pctFixa) || 0) / 100;
      const porConta = total > 0 && cc > 0 ? Math.max(0, total - fixa) / cc * consumo : null;
      const variavel = porConta !== null ? porConta : consumo * (Number(tarifa) || 0);
      const fixaParte = fixa * pf;
      return { porConta, fixaParte, sugerido: L.r2(variavel + fixaParte) };
    }
  };

  // atalhos de correção a partir de mensagens de falta
  UI.acoes.atalhoFornada = () => F.fornada(null);
  UI.acoes.atalhoAjuste = () => F.ajuste();
  UI.acoes.atalhoCompra = () => F.compra(null);
})(globalThis.L = globalThis.L || {});
