/* LEORA — formulários de cadastro (ingredientes, embalagens, produtos, receitas, combos, canais, pagamentos, fornos, promoções, recorrências, configurações). */
(function (L) {
  'use strict';
  const UI = L.UI; const esc = UI.esc; const N = L.num;
  const F = UI.forms = {};
  const D = () => UI.D();
  const S = () => UI.S();
  const reqNome = (v, o) => { if (!String(v || '').trim()) UI.falha('Informe o nome' + (o ? ' ' + o : '') + '.'); };
  const numOuNull = v => { const n = N(v); return Number.isFinite(n) ? n : null; };
  const numPos = (v, rot) => { const n = N(v); if (!(n >= 0)) UI.falha(`Informe ${rot} (número maior ou igual a zero).`); return n; };
  const linhaX = (acao, i) => `<button type="button" class="x lx" data-fa="${acao}" data-i="${i}" aria-label="Remover linha">×</button>`;

  // ---------- ingrediente / embalagem ----------
  F.insumo = function (id, tipoPadrao) {
    const x = id ? L.clone(D().insumos[id]) : { id: L.uid('i'), nome: '', tipo: tipoPadrao || 'ingrediente', subtipo: 'individual', unidade: 'g', embQtd: '', embUnid: 'kg', precoEmb: '', fornecedor: '', estoqueMin: '', controlaLote: false, gPorMl: '', gPorUn: '' };
    UI.abrir({
      titulo: id ? 'Editar ' + (x.tipo === 'embalagem' ? 'embalagem' : 'ingrediente') : (x.tipo === 'embalagem' ? 'Nova embalagem' : 'Novo ingrediente'),
      aoMudar: (st, p) => { if (p === 'unidade') st.embUnid = st.unidade === 'g' ? 'kg' : st.unidade === 'ml' ? 'L' : 'un'; },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome', { cls: 'w2', ph: st.tipo === 'embalagem' ? 'Ex.: Saco a vácuo 20x30' : 'Ex.: Farinha de trigo' })}
          ${UI.sel(st, 'tipo', 'Tipo', UI.opts([{ v: 'ingrediente', t: 'Ingrediente' }, { v: 'embalagem', t: 'Embalagem ou material' }], st.tipo))}
          ${st.tipo === 'embalagem' ? UI.sel(st, 'subtipo', 'Uso da embalagem', UI.opts([{ v: 'individual', t: 'Individual' }, { v: 'combo', t: 'Combo' }, { v: 'vacuo', t: 'Armazenamento a vácuo' }, { v: 'comemorativa', t: 'Data comemorativa' }, { v: 'outra', t: 'Etiqueta, fita, outros' }], st.subtipo)) : ''}
        </div>
        <div class="lg">${UI.sel(st, 'unidade', 'Controlar estoque em', UI.opts([{ v: 'g', t: 'gramas (g)' }, { v: 'ml', t: 'mililitros (ml)' }, { v: 'un', t: 'unidades (un)' }], st.unidade), { ajuda: 'Receitas e compras convertem para esta unidade.' })}
          ${UI.campo(st, 'embQtd', 'Embalagem comprada: quantidade', { tipo: 'num', ph: 'Ex.: 1' })}
          ${UI.sel(st, 'embUnid', 'Unidade da embalagem', UI.opts(L.unidadesCompativeis(Object.assign({}, st, { gPorMl: N(st.gPorMl), gPorUn: N(st.gPorUn) })).map(u => ({ v: u, t: u })), st.embUnid))}
          ${UI.campo(st, 'precoEmb', 'Preço da embalagem (R$)', { tipo: 'num', ajuda: 'Usado até a primeira compra registrada.' })}
        </div>
        <div class="lg">${UI.campo(st, 'fornecedor', 'Fornecedor (opcional)')}
          ${UI.campo(st, 'estoqueMin', `Estoque mínimo (${st.unidade})`, { tipo: 'num', ajuda: 'Gera alerta quando ficar abaixo.' })}</div>
        ${UI.chk(st, 'controlaLote', 'Controlar lote e validade nas compras')}
        <div class="secao-f"><h3>Equivalências (opcional)</h3><p class="muted small">O sistema só converte volume em peso, ou unidade em peso, quando você informa a equivalência.</p>
          <div class="lg">${UI.campo(st, 'gPorMl', 'Gramas por ml', { tipo: 'num', ph: 'Ex.: leite 1,03', re: 1 })}${UI.campo(st, 'gPorUn', 'Gramas por unidade', { tipo: 'num', ph: 'Ex.: ovo 50', re: 1 })}</div></div>`,
      previa: st => {
        const ins = Object.assign({}, st, { embQtd: N(st.embQtd), precoEmb: N(st.precoEmb), gPorMl: N(st.gPorMl), gPorUn: N(st.gPorUn) });
        const c = L.precoCadastroBase(ins);
        const stq = S().ins[st.id];
        return `<div class="small">${c !== null ? `Preço de cadastro: <strong>${L.brl4(c)}</strong> por ${esc(st.unidade)}` : 'Informe quantidade e preço da embalagem para calcular o custo por ' + esc(st.unidade) + '.'}${stq ? ` · Estoque atual: ${L.nf(stq.qtd)} ${esc(st.unidade)} · custo médio ${L.brl4(stq.qtd > 0 ? stq.valor / stq.qtd : stq.medioRef || 0)}` : ''}</div>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        if (id && st.unidade !== D().insumos[id].unidade && S().ins[id]) UI.falha('Este item já tem movimentações; a unidade de controle não pode mudar. Crie um novo item.');
        const o = Object.assign({}, st, { nome: st.nome.trim(), embQtd: numOuNull(st.embQtd), precoEmb: numOuNull(st.precoEmb), estoqueMin: numOuNull(st.estoqueMin), gPorMl: numOuNull(st.gPorMl), gPorUn: numOuNull(st.gPorUn) });
        if (o.embQtd !== null) { const c = L.converter(o.embQtd, o.embUnid, o); if (!c.ok) UI.falha(c.erro); }
        await UI.salvarCad('insumos', o); return 'Salvo.';
      },
    }, x);
  };

  // ---------- conjunto de embalagem ----------
  F.kit = function (id) {
    const x = id ? L.clone(D().kits[id]) : { id: L.uid('k'), nome: '', uso: 'venda', itens: [{ insumoId: '', qtd: '1' }] };
    UI.abrir({
      titulo: id ? 'Editar conjunto de embalagem' : 'Novo conjunto de embalagem',
      acoes: { add: st => st.itens.push({ insumoId: '', qtd: '1' }), rm: (st, ds) => st.itens.splice(+ds.i, 1) },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome', { cls: 'w2', ph: 'Ex.: Caixa presente 4 cookies' })}
          ${UI.sel(st, 'uso', 'Usado em', UI.opts([{ v: 'venda', t: 'Venda (sai junto com o produto)' }, { v: 'armazenamento', t: 'Produção / armazenamento' }], st.uso))}</div>
        <p class="muted small">Embalagem de armazenamento é baixada na produção da massa. Embalagem de venda é baixada na venda. Assim nada é cobrado nem baixado duas vezes.</p>
        <div class="linhas">${st.itens.map((it, i) => `<div class="linha">${linhaX('rm', i)}<div class="lg">${UI.sel(st, `itens.${i}.insumoId`, 'Item', UI.optsInsumos(it.insumoId, 'Escolha…'), { cls: 'w2' })}${UI.campo(st, `itens.${i}.qtd`, 'Quantidade', { tipo: 'num' })}</div></div>`).join('')}</div>
        <div><button type="button" class="btn sm" data-fa="add">+ Item</button></div>`,
      previa: st => {
        const k = { id: st.id, nome: st.nome, itens: st.itens.filter(i => i.insumoId).map(i => ({ insumoId: i.insumoId, qtd: N(i.qtd) || 0 })) };
        const d2 = Object.assign({}, D(), { kits: Object.assign({}, D().kits, { [st.id]: k }) });
        const c = L.custoKit(d2, S(), st.id, 'medio');
        return `<div class="small">Custo atual do conjunto: <strong>${L.brl(c.valor)}</strong> (custo médio)${c.avisos.length ? '<br>' + c.avisos.map(esc).join('<br>') : ''}</div>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        const itens = st.itens.filter(i => i.insumoId).map(i => ({ insumoId: i.insumoId, qtd: numPos(i.qtd, 'a quantidade') }));
        if (!itens.length) UI.falha('Adicione pelo menos um item.');
        await UI.salvarCad('kits', Object.assign({}, st, { nome: st.nome.trim(), itens })); return 'Conjunto salvo.';
      },
    }, x);
  };

  // ---------- produto ----------
  F.produto = function (id) {
    const cats = D().cfg.categoriasProduto || ['Cookies'];
    const x = id ? L.clone(D().produtos[id]) : { id: L.uid('p'), nome: '', categoria: cats[0] || '', novaCategoria: '' };
    UI.abrir({
      titulo: id ? 'Editar produto' : 'Novo produto', largura: 'estreita',
      corpo: st => `${UI.campo(st, 'nome', 'Nome do produto', { ph: 'Ex.: Cookie' })}
        ${UI.sel(st, 'categoria', 'Categoria', UI.opts(cats.map(c => ({ v: c, t: c })).concat([{ v: '__nova', t: '+ Nova categoria' }]), st.categoria))}
        ${st.categoria === '__nova' ? UI.campo(st, 'novaCategoria', 'Nome da nova categoria', { ph: 'Ex.: Brownies' }) : ''}
        <p class="muted small">Sabores, tamanhos, pesos e preços ficam nas variações do produto.</p>`,
      salvar: async st => {
        reqNome(st.nome);
        let cat = st.categoria;
        if (cat === '__nova') {
          cat = String(st.novaCategoria || '').trim(); if (!cat) UI.falha('Informe a nova categoria.');
          const cfg = L.clone(D().cfg); cfg.categoriasProduto = [...new Set((cfg.categoriasProduto || []).concat([cat]))];
          await L.Store.salvarConfig(cfg);
        }
        const o = { id: st.id, nome: st.nome.trim(), categoria: cat, arquivado: !!st.arquivado, criadoEm: st.criadoEm };
        await UI.salvarCad('produtos', o);
        return 'Produto salvo.';
      },
      depois: st => { if (!id) F.variante(null, st.id); },
    }, x);
  };

  // ---------- variação (sabor × tamanho) ----------
  F.variante = function (id, produtoId, copiarDe) {
    const base0 = copiarDe ? L.clone(D().variantes[copiarDe]) : null;
    const x = id ? L.clone(D().variantes[id]) : Object.assign({ produtoId: produtoId || '', sabor: '', tamanho: '', pesoG: '', validadeAssadoDias: '', estoqueMin: '', kitVendaId: '', perdaPct: '', precos: {}, assar: { fornoId: '', minForno: '', preaqMin: '', unidadesFornada: '', minAtivoFornada: '', minEmbalagemUnid: '' } }, base0 || {}, { id: L.uid('v'), arquivado: false });
    if (copiarDe) { x.sabor = x.sabor + ' (cópia)'; }
    x.assar = x.assar || {}; x.precos = x.precos || {};
    x._receitaPadrao = (D().cfg.receitaPorVariante || {})[x.id] || '';
    const canais = L.ativos(D().canais);
    UI.abrir({
      titulo: id ? 'Editar variação' : 'Nova variação', largura: 'larga',
      aoMudar: (st, p) => { if (p === 'assar.fornoId' && !st.assar.preaqMin) { const f = D().fornos[st.assar.fornoId]; if (f && f.preaqMin) st.assar.preaqMin = f.preaqMin; } },
      corpo: st => `
        <div class="secao-f"><div class="lg">
          ${UI.sel(st, 'produtoId', 'Produto', UI.opts(L.ativos(D().produtos).map(p => ({ v: p.id, t: p.nome })), st.produtoId, 'Escolha…'))}
          ${UI.campo(st, 'sabor', 'Sabor', { ph: 'Ex.: Chocolate belga' })}
          ${UI.campo(st, 'tamanho', 'Tamanho', { ph: 'Ex.: Grande' })}
          ${UI.campo(st, 'pesoG', 'Peso por unidade (g)', { tipo: 'num', ajuda: 'Peso da porção de massa.' })}
        </div><div class="lg">
          ${UI.campo(st, 'validadeAssadoDias', 'Validade do assado (dias)', { tipo: 'int', ajuda: 'Deixe vazio se ainda não definiu. Não é presumida.' })}
          ${UI.campo(st, 'estoqueMin', 'Estoque mínimo (un.)', { tipo: 'int' })}
          ${UI.sel(st, 'kitVendaId', 'Embalagem de venda', UI.optsKits(st.kitVendaId, 'venda'))}
          ${UI.campo(st, 'perdaPct', 'Perda esperada (%)', { tipo: 'num', ajuda: 'Das unidades produzidas que não chegam a ser vendidas.' })}
        </div></div>
        <div class="secao-f"><h3>Assamento (para estimar energia e trabalho)</h3><div class="lg">
          ${UI.sel(st, 'assar.fornoId', 'Forno usado', UI.optsFornos(st.assar.fornoId, 'Escolha…'))}
          ${UI.campo(st, 'assar.minForno', 'Minutos no forno', { tipo: 'num' })}
          ${UI.campo(st, 'assar.preaqMin', 'Pré-aquecimento (min)', { tipo: 'num' })}
          ${UI.campo(st, 'assar.unidadesFornada', 'Unidades por fornada', { tipo: 'int' })}
          ${UI.campo(st, 'assar.minAtivoFornada', 'Trabalho ativo na fornada (min)', { tipo: 'num', ajuda: 'Colocar e tirar do forno, conferir. Não conte o tempo de forno.' })}
          ${UI.campo(st, 'assar.minEmbalagemUnid', 'Embalar para venda (min/un.)', { tipo: 'num' })}
        </div></div>
        <div class="secao-f"><h3>Preços por canal</h3>${canais.length ? `<div class="lg">${canais.map(c => UI.campo(st, 'precos.' + c.id, c.nome + ' (R$)', { tipo: 'num' })).join('')}</div>` : '<p class="muted small">Cadastre canais de venda em Configurações para definir preços.</p>'}</div>
        <div class="secao-f">${UI.sel(st, '_receitaPadrao', 'Receita usada para o custo', UI.opts(L.ativos(D().receitas).filter(r => (L.ultimaVersao(r).saidas || []).some(s => s.varianteId === st.id)).map(r => ({ v: r.id, t: r.nome })), st._receitaPadrao, 'A mais recente que produz este item'))}</div>`,
      previa: st => {
        const d2 = Object.assign({}, D(), { variantes: Object.assign({}, D().variantes, { [st.id]: normVar(st) }) });
        const c = L.custoVariante(d2, S(), st.id, 'medio');
        return `<div class="eyebrow">Custo estimado por unidade (custo médio)</div>${resumoCusto(c)}`;
      },
      salvar: async st => {
        if (!st.produtoId) UI.falha('Escolha o produto.');
        if (!String(st.sabor).trim() && !String(st.tamanho).trim()) UI.falha('Informe sabor e/ou tamanho.');
        const o = normVar(st);
        const dup = L.ativos(D().variantes).find(v => v.id !== o.id && v.produtoId === o.produtoId && (v.sabor || '').toLowerCase() === (o.sabor || '').toLowerCase() && (v.tamanho || '').toLowerCase() === (o.tamanho || '').toLowerCase());
        if (dup) UI.falha('Já existe essa combinação de sabor e tamanho para o produto.');
        await UI.salvarCad('variantes', o);
        const cfg = L.clone(D().cfg); cfg.receitaPorVariante = cfg.receitaPorVariante || {};
        if ((cfg.receitaPorVariante[o.id] || '') !== (st._receitaPadrao || '')) { if (st._receitaPadrao) cfg.receitaPorVariante[o.id] = st._receitaPadrao; else delete cfg.receitaPorVariante[o.id]; await L.Store.salvarConfig(cfg); }
        return 'Variação salva.';
      },
    }, x);
  };
  function normVar(st) {
    const precos = {}; for (const [k, v] of Object.entries(st.precos || {})) { const n = N(v); if (n > 0) precos[k] = n; }
    const a = st.assar || {};
    return {
      id: st.id, produtoId: st.produtoId, sabor: String(st.sabor || '').trim(), tamanho: String(st.tamanho || '').trim(),
      pesoG: numOuNull(st.pesoG), validadeAssadoDias: numOuNull(st.validadeAssadoDias), estoqueMin: numOuNull(st.estoqueMin),
      kitVendaId: st.kitVendaId || '', perdaPct: numOuNull(st.perdaPct), precos, arquivado: !!st.arquivado, criadoEm: st.criadoEm,
      assar: { fornoId: a.fornoId || '', minForno: numOuNull(a.minForno), preaqMin: numOuNull(a.preaqMin), unidadesFornada: numOuNull(a.unidadesFornada), minAtivoFornada: numOuNull(a.minAtivoFornada), minEmbalagemUnid: numOuNull(a.minEmbalagemUnid) },
    };
  }
  UI.normVar = normVar;
  function resumoCusto(c) {
    const lin = [
      ['Ingredientes', c.ingredientes], ['Embalagem de armazenamento', c.embArmaz], ['Trabalho de preparo', c.trabPreparo],
      ['Energia/gás do forno (estimativa)', c.energia], ['Trabalho no assamento', c.trabAssar], ['Perdas esperadas', c.perdas],
      ['Embalagem de venda', c.embVenda], ['Trabalho de embalar', c.trabEmbVenda],
    ].filter(l => l[1] > 0);
    return UI.dl(lin.map(l => [l[0], L.brl4(l[1])]).concat([['Custo total por unidade', L.brl4(c.total), 'tot']]))
      + (c.perdaJaNoRendimento ? '<p class="tiny muted">Perdas não somadas: o rendimento da receita já desconta as perdas.</p>' : '')
      + (c.avisos.length ? `<div class="nota small">${c.avisos.map(esc).join('<br>')}</div>` : '');
  }
  UI.resumoCusto = resumoCusto;

  // ---------- receita base ----------
  F.base = function (id, copiar) {
    const o0 = id ? D().bases[id] : null;
    const v0 = o0 ? L.ultimaVersao(o0) : null;
    const x = { id: copiar || !id ? L.uid('b') : id, nome: o0 ? o0.nome + (copiar ? ' (cópia)' : '') : '', ingredientes: v0 ? L.clone(v0.ingredientes) : [{ insumoId: '', qtd: '', unid: 'g' }], massaG: v0 ? v0.massaG || '' : '', notas: v0 ? v0.notas || '' : '', fator: '' };
    const edit = id && !copiar;
    UI.abrir({
      titulo: edit ? 'Editar receita base' : 'Nova receita base', largura: 'larga',
      acoes: {
        add: st => st.ingredientes.push({ insumoId: '', qtd: '', unid: 'g' }),
        rm: (st, ds) => st.ingredientes.splice(+ds.i, 1),
        escalar: st => { const f = N(st.fator); if (!(f > 0)) return; st.ingredientes.forEach(i => { i.qtd = L.r6(N(i.qtd) * f); }); if (N(st.massaG) > 0) st.massaG = L.r2(N(st.massaG) * f); st.fator = ''; st._escalada = true; },
      },
      aoMudar: (st, p) => { const m = p.match(/^ingredientes\.(\d+)\.insumoId$/); if (m) { const ins = D().insumos[st.ingredientes[+m[1]].insumoId]; if (ins) st.ingredientes[+m[1]].unid = ins.unidade; } },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome', { cls: 'w2', ph: 'Ex.: Massa base de cookie' })}${UI.campo(st, 'massaG', 'Peso da massa pronta (g, opcional)', { tipo: 'num' })}</div>
        <p class="muted small">Receitas base são compartilhadas entre sabores. Na receita de cada sabor você indica quantas bases usa e os ingredientes adicionais. O custo soma tudo por ingrediente, sem duplicar.</p>
        <div class="linhas">${st.ingredientes.map((it, i) => linhaIngrediente(st, 'ingredientes', it, i)).join('')}</div>
        <div class="row"><button type="button" class="btn sm" data-fa="add">+ Ingrediente</button></div>
        <div class="secao-f"><h3>Ajustar quantidades</h3><div class="row">${UI.campo(st, 'fator', 'Multiplicar tudo por', { tipo: 'num', ph: 'Ex.: 1,5' })}<button type="button" class="btn sm" data-fa="escalar">Aplicar</button></div>
          ${st._escalada ? '<div class="nota small">Quantidades multiplicadas. Confira o rendimento real das receitas que usam esta base: escalar não garante o mesmo rendimento.</div>' : ''}</div>
        ${UI.campo(st, 'notas', 'Modo de preparo / observações', { tipo: 'area' })}`,
      previa: st => {
        const ver = { ingredientes: limparIng(st.ingredientes, false) };
        const d2 = Object.assign({}, D(), { bases: Object.assign({}, D().bases, { [st.id]: { id: st.id, nome: st.nome, versoes: [ver] } }) });
        const c = L.custoLote(d2, S(), { bases: [{ baseId: st.id, mult: 1 }], extras: [], saidas: [] }, 'medio');
        return `<div class="small">Custo dos ingredientes de 1 base: <strong>${L.brl(c.ingredientes)}</strong> (custo médio)${c.avisos.length ? '<br>' + c.avisos.map(esc).join('<br>') : ''}</div>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        const ing = limparIng(st.ingredientes, true);
        if (!ing.length) UI.falha('Adicione os ingredientes.');
        const ver = { ingredientes: ing, massaG: numOuNull(st.massaG), notas: st.notas || '' };
        const atual = edit ? L.clone(D().bases[id]) : { id: st.id, nome: st.nome.trim(), versoes: [] };
        atual.nome = st.nome.trim();
        const ult = L.ultimaVersao(atual);
        if (!ult || JSON.stringify(ult.ingredientes) !== JSON.stringify(ver.ingredientes) || ult.massaG !== ver.massaG || ult.notas !== ver.notas) atual.versoes.push(Object.assign({ v: (ult ? ult.v : 0) + 1, data: L.hoje() }, ver));
        await UI.salvarCad('bases', atual); return 'Receita base salva.';
      },
    }, x);
  };
  function linhaIngrediente(st, col, it, i) {
    const ins = D().insumos[it.insumoId];
    const unids = ins ? L.unidadesCompativeis(ins) : ['g', 'kg', 'ml', 'L', 'un'];
    return `<div class="linha">${linhaX('rm', i)}<div class="lg">${UI.sel(st, `${col}.${i}.insumoId`, 'Ingrediente', UI.optsInsumos(it.insumoId, 'Escolha…'), { cls: 'w2' })}
      ${UI.campo(st, `${col}.${i}.qtd`, 'Quantidade', { tipo: 'num' })}${UI.sel(st, `${col}.${i}.unid`, 'Unidade', UI.opts(unids.map(u => ({ v: u, t: u })), it.unid))}</div></div>`;
  }
  function limparIng(lista, validar) {
    const out = [];
    for (const i of lista) {
      if (!i.insumoId) continue;
      const q = N(i.qtd);
      if (validar && !(q > 0)) UI.falha('Informe a quantidade de todos os ingredientes.');
      const ins = D().insumos[i.insumoId];
      if (validar && ins) { const c = L.converter(1, i.unid, ins); if (!c.ok) UI.falha(c.erro); }
      out.push({ insumoId: i.insumoId, qtd: q || 0, unid: i.unid });
    }
    return out;
  }

  // ---------- receita de produção ----------
  F.receita = function (id, copiar) {
    const o0 = id ? D().receitas[id] : null;
    const v0 = o0 ? L.ultimaVersao(o0) : null;
    const x = v0 ? Object.assign(L.clone(v0), { id: copiar ? L.uid('r') : id, nome: o0.nome + (copiar ? ' (cópia)' : '') }) : {
      id: L.uid('r'), nome: '', bases: [], extras: [], saidas: [{ varianteId: '', unidades: '' }], tempos: { preparo: '', porcionamento: '', embalagem: '', outras: '' },
      kitArmazId: '', kitArmazQtd: '', validadeMassaDias: 90, rendimentoJaDescontaPerdas: false, etapas: '', equipamentos: '',
    };
    x.tempos = x.tempos || {}; x.fator = '';
    const edit = id && !copiar;
    UI.abrir({
      titulo: edit ? 'Editar receita' : 'Nova receita', largura: 'larga',
      acoes: {
        addB: st => st.bases.push({ baseId: '', mult: '1' }), rmB: (st, ds) => st.bases.splice(+ds.i, 1),
        add: st => st.extras.push({ insumoId: '', qtd: '', unid: 'g' }), rm: (st, ds) => st.extras.splice(+ds.i, 1),
        addS: st => st.saidas.push({ varianteId: '', unidades: '' }), rmS: (st, ds) => st.saidas.splice(+ds.i, 1),
        escalar: st => { const f = N(st.fator); if (!(f > 0)) return; st.bases.forEach(b => { b.mult = L.r6(N(b.mult) * f); }); st.extras.forEach(e => { e.qtd = L.r6(N(e.qtd) * f); }); st.saidas.forEach(s => { s.unidades = Math.round(N(s.unidades) * f); }); st.kitArmazQtd = Math.ceil((N(st.kitArmazQtd) || 0) * f) || ''; st.fator = ''; st._escalada = true; },
      },
      aoMudar: (st, p) => { const m = p.match(/^extras\.(\d+)\.insumoId$/); if (m) { const ins = D().insumos[st.extras[+m[1]].insumoId]; if (ins) st.extras[+m[1]].unid = ins.unidade; } },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome da receita', { cls: 'w2', ph: 'Ex.: Cookie chocolate belga' })}</div>
        <div class="secao-f"><h3>Receitas base usadas</h3>
          <div class="linhas">${st.bases.map((b, i) => `<div class="linha"><button type="button" class="x lx" data-fa="rmB" data-i="${i}" aria-label="Remover">×</button><div class="lg">${UI.sel(st, `bases.${i}.baseId`, 'Receita base', UI.opts(L.ativos(D().bases).map(b2 => ({ v: b2.id, t: b2.nome })), b.baseId, 'Escolha…'), { cls: 'w2' })}${UI.campo(st, `bases.${i}.mult`, 'Quantas bases (ex.: 1 ou 0,5)', { tipo: 'num' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="addB">+ Receita base</button></div></div>
        <div class="secao-f"><h3>Ingredientes adicionais deste sabor</h3>
          <div class="linhas">${st.extras.map((it, i) => linhaIngrediente(st, 'extras', it, i)).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="add">+ Ingrediente</button></div></div>
        <div class="secao-f"><h3>Rendimento real vendável</h3>
          <p class="muted small">Quantas unidades boas saem de uma receita, por tamanho. Se o mesmo lote vira tamanhos diferentes, o custo é dividido pelo peso de massa de cada tamanho.</p>
          <div class="linhas">${st.saidas.map((s, i) => `<div class="linha"><button type="button" class="x lx" data-fa="rmS" data-i="${i}" aria-label="Remover">×</button><div class="lg">${UI.sel(st, `saidas.${i}.varianteId`, 'Sabor e tamanho', UI.optsVariantes(s.varianteId, 'Escolha…'), { cls: 'w2' })}${UI.campo(st, `saidas.${i}.unidades`, 'Unidades', { tipo: 'int' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="addS">+ Tamanho</button></div>
          ${UI.chk(st, 'rendimentoJaDescontaPerdas', 'O rendimento informado já desconta as perdas', 'Marque para não aplicar a perda esperada da variação de novo.')}</div>
        <div class="secao-f"><h3>Trabalho ativo (minutos por receita)</h3><div class="lg">
          ${UI.campo(st, 'tempos.preparo', 'Preparo', { tipo: 'num' })}${UI.campo(st, 'tempos.porcionamento', 'Porcionamento', { tipo: 'num' })}
          ${UI.campo(st, 'tempos.embalagem', 'Embalar para congelar', { tipo: 'num' })}${UI.campo(st, 'tempos.outras', 'Outras etapas', { tipo: 'num' })}</div>
          <p class="muted tiny">O tempo de forno não entra aqui; o trabalho do assamento fica na variação.</p></div>
        <div class="secao-f"><h3>Armazenamento</h3><div class="lg">
          ${UI.sel(st, 'kitArmazId', 'Embalagem de armazenamento', UI.optsKits(st.kitArmazId, 'armazenamento'))}
          ${UI.campo(st, 'kitArmazQtd', 'Quantas por receita', { tipo: 'num' })}
          ${UI.campo(st, 'validadeMassaDias', 'Validade da massa congelada (dias)', { tipo: 'int', ajuda: 'Prazo que você definiu para esta receita e condição de armazenamento.' })}</div></div>
        <div class="secao-f"><h3>Ajustar quantidades</h3><div class="row">${UI.campo(st, 'fator', 'Multiplicar tudo por', { tipo: 'num', ph: 'Ex.: 2' })}<button type="button" class="btn sm" data-fa="escalar">Aplicar</button></div>
          ${st._escalada ? '<div class="nota small">Quantidades e rendimento multiplicados. Confira o rendimento real na próxima produção e corrija aqui.</div>' : ''}</div>
        <div class="lg">${UI.campo(st, 'etapas', 'Etapas', { tipo: 'area', cls: 'w2' })}${UI.campo(st, 'equipamentos', 'Equipamentos', { tipo: 'area', cls: 'w2' })}</div>`,
      previa: st => {
        const ver = normRec(st, false);
        const c = L.custoLote(D(), S(), ver, 'medio');
        const lin = c.saidas.map(s => `<tr><td>${esc(L.nomeVariante(D(), s.varianteId))}</td><td class="n">${s.unidades}</td><td class="n">${L.brl4(s.m)}</td><td class="n">${L.brl4(s.t)}</td></tr>`).join('');
        return `<div class="eyebrow">Custo por receita (custo médio)</div>${UI.dl([['Ingredientes', L.brl(c.ingredientes)], ['Embalagem de armazenamento', L.brl(c.embalagem)], ['Trabalho (' + L.nf(c.minutos) + ' min)', L.brl(c.trabalho)], ['Total da massa', L.brl(c.total), 'tot']])}
          ${lin ? `<div class="tbl-w"><table><thead><tr><th>Item</th><th class="n">Un.</th><th class="n">Materiais/un.</th><th class="n">Trabalho/un.</th></tr></thead><tbody>${lin}</tbody></table></div>` : ''}
          ${c.avisos.length ? `<div class="nota small">${[...new Set(c.avisos)].map(esc).join('<br>')}</div>` : ''}<p class="tiny muted">Energia do forno, embalagem de venda e perdas entram no custo da variação.</p>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        const ver = normRec(st, true);
        if (!ver.bases.length && !ver.extras.length) UI.falha('Adicione uma receita base ou ingredientes.');
        if (!ver.saidas.length) UI.falha('Informe o rendimento de pelo menos um sabor/tamanho.');
        const exp = L.expandirVersao(D(), ver, 1); if (exp.erros.length) UI.falha(exp.erros.join(' '));
        const atual = edit ? L.clone(D().receitas[id]) : { id: st.id, versoes: [] };
        atual.nome = st.nome.trim();
        const ult = L.ultimaVersao(atual);
        const semData = v => { const c = L.clone(v); delete c.v; delete c.data; return JSON.stringify(c); };
        if (!ult || semData(ult) !== JSON.stringify(ver)) atual.versoes.push(Object.assign({ v: (ult ? ult.v : 0) + 1, data: L.hoje() }, ver));
        await UI.salvarCad('receitas', atual);
        return ult && atual.versoes.length > 1 && L.ultimaVersao(atual).v !== ult.v ? `Nova versão ${L.ultimaVersao(atual).v} salva. Produções antigas mantêm o custo da época.` : 'Receita salva.';
      },
    }, x);
  };
  function normRec(st, validar) {
    const bases = st.bases.filter(b => b.baseId).map(b => { const m = N(b.mult); if (validar && !(m > 0)) UI.falha('Informe quantas bases são usadas.'); return { baseId: b.baseId, mult: m || 0 }; });
    const saidas = st.saidas.filter(s => s.varianteId).map(s => { const u = Math.round(N(s.unidades)); if (validar && !(u > 0)) UI.falha('Informe as unidades de cada tamanho.'); return { varianteId: s.varianteId, unidades: u || 0 }; });
    if (validar && new Set(saidas.map(s => s.varianteId)).size !== saidas.length) UI.falha('O mesmo sabor/tamanho aparece duas vezes no rendimento.');
    const t = st.tempos || {};
    return {
      bases, extras: limparIng(st.extras, validar), saidas,
      tempos: { preparo: N(t.preparo) || 0, porcionamento: N(t.porcionamento) || 0, embalagem: N(t.embalagem) || 0, outras: N(t.outras) || 0 },
      kitArmazId: st.kitArmazId || '', kitArmazQtd: N(st.kitArmazQtd) || 0,
      validadeMassaDias: numOuNull(st.validadeMassaDias), rendimentoJaDescontaPerdas: !!st.rendimentoJaDescontaPerdas,
      etapas: st.etapas || '', equipamentos: st.equipamentos || '',
    };
  }

  // ---------- combo ----------
  F.combo = function (id, copiar) {
    const x = id ? Object.assign(L.clone(D().combos[id]), copiar ? { id: L.uid('c'), nome: D().combos[id].nome + ' (cópia)' } : {}) : { id: L.uid('c'), nome: '', tipo: 'fixo', itens: [{ varianteId: '', qtd: '1' }], livre: { qtd: '', permitidas: [] }, kitVendaId: '', usarEmbIndividual: false, precos: {} };
    x.livre = x.livre || { qtd: '', permitidas: [] }; x.itens = x.itens || []; x.precos = x.precos || {};
    const canais = L.ativos(D().canais);
    UI.abrir({
      titulo: id && !copiar ? 'Editar combo' : 'Novo combo', largura: 'larga',
      acoes: {
        add: st => st.itens.push({ varianteId: '', qtd: '1' }), rm: (st, ds) => st.itens.splice(+ds.i, 1),
        perm: (st, ds) => { const p = st.livre.permitidas; const i = p.indexOf(ds.id); if (i >= 0) p.splice(i, 1); else p.push(ds.id); },
      },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome do combo', { cls: 'w2', ph: 'Ex.: Caixa com 4' })}</div>
        <div class="f"><span>Composição</span>${UI.segmento(st, 'tipo', [['fixo', 'Fixa'], ['livre', 'Sabores à escolha']])}</div>
        ${st.tipo === 'livre' ? `${UI.campo(st, 'livre.qtd', 'Unidades por combo', { tipo: 'int' })}
          <div class="f"><span>Sabores/tamanhos permitidos</span><div class="row">${L.ativos(D().variantes).map(v => `<button type="button" class="btn sm ${st.livre.permitidas.includes(v.id) ? 'pri' : ''}" data-fa="perm" data-id="${v.id}">${esc(L.nomeVariante(D(), v.id))}</button>`).join('') || '<span class="muted small">Cadastre variações primeiro.</span>'}</div></div>
          <p class="muted small">Na venda você informa a composição efetivamente vendida.</p>`
        : `<div class="linhas">${st.itens.map((it, i) => `<div class="linha">${linhaX('rm', i)}<div class="lg">${UI.sel(st, `itens.${i}.varianteId`, 'Item', UI.optsVariantes(it.varianteId, 'Escolha…'), { cls: 'w2' })}${UI.campo(st, `itens.${i}.qtd`, 'Quantidade', { tipo: 'int' })}</div></div>`).join('')}</div><div><button type="button" class="btn sm" data-fa="add">+ Item</button></div>`}
        <div class="lg">${UI.sel(st, 'kitVendaId', 'Embalagem do combo', UI.optsKits(st.kitVendaId, 'venda'))}</div>
        ${UI.chk(st, 'usarEmbIndividual', 'Também usar a embalagem individual de cada cookie', 'Deixe desmarcado se os cookies vão soltos na caixa do combo.')}
        <div class="secao-f"><h3>Preço por canal</h3>${canais.length ? `<div class="lg">${canais.map(c => UI.campo(st, 'precos.' + c.id, c.nome + ' (R$)', { tipo: 'num' })).join('')}</div>` : '<p class="muted small">Cadastre canais em Configurações.</p>'}</div>`,
      previa: st => {
        const o = normCombo(st, false);
        const d2 = Object.assign({}, D(), { combos: Object.assign({}, D().combos, { [o.id]: o }) });
        const c = L.custoCombo(d2, S(), o.id, 'medio');
        return `<div class="small">${o.tipo === 'livre' ? `Custo conforme a escolha: de <strong>${L.brl(c.min)}</strong> a <strong>${L.brl(c.max)}</strong> (média ${L.brl(c.medio)})` : `Custo do combo: <strong>${L.brl(c.medio)}</strong>`} · ${c.unidades} unidade(s) · embalagem ${L.brl(c.embalagem)}${c.avisos.length ? `<div class="nota small">${c.avisos.map(esc).join('<br>')}</div>` : ''}</div>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        const o = normCombo(st, true);
        await UI.salvarCad('combos', o); return 'Combo salvo.';
      },
    }, x);
  };
  function normCombo(st, validar) {
    const precos = {}; for (const [k, v] of Object.entries(st.precos || {})) { const n = N(v); if (n > 0) precos[k] = n; }
    const o = { id: st.id, nome: String(st.nome || '').trim(), tipo: st.tipo, kitVendaId: st.kitVendaId || '', usarEmbIndividual: !!st.usarEmbIndividual, precos, arquivado: !!st.arquivado, criadoEm: st.criadoEm };
    if (st.tipo === 'livre') {
      o.livre = { qtd: Math.round(N(st.livre.qtd)) || 0, permitidas: st.livre.permitidas.slice() }; o.itens = [];
      if (validar && !(o.livre.qtd > 0)) UI.falha('Informe quantas unidades vão no combo.');
      if (validar && !o.livre.permitidas.length) UI.falha('Escolha os sabores permitidos.');
    } else {
      o.itens = st.itens.filter(i => i.varianteId).map(i => ({ varianteId: i.varianteId, qtd: Math.round(N(i.qtd)) || 0 })); o.livre = null;
      if (validar && (!o.itens.length || o.itens.some(i => !(i.qtd > 0)))) UI.falha('Informe os itens e quantidades do combo.');
    }
    return o;
  }

  // ---------- canal de venda ----------
  F.canal = function (id) {
    const x = id ? L.clone(D().canais[id]) : { id: L.uid('ch'), nome: '', tipo: 'direto', taxaPct: '', baseTaxa: 'produtos', taxaFixaPedido: '', prazoDias: '', pagamentoIncluso: false, formaPadraoId: '' };
    UI.abrir({
      titulo: id ? 'Editar canal' : 'Novo canal de venda',
      aoMudar: (st, p) => { if (p === 'tipo' && st.tipo === 'plataforma' && !id) st.pagamentoIncluso = true; },
      corpo: st => `
        <div class="lg">${UI.campo(st, 'nome', 'Nome', { cls: 'w2', ph: 'Ex.: WhatsApp, iFood' })}
          ${UI.sel(st, 'tipo', 'Tipo', UI.opts([{ v: 'direto', t: 'Venda direta' }, { v: 'plataforma', t: 'Plataforma (ex.: iFood)' }], st.tipo))}</div>
        <div class="lg">${UI.campo(st, 'taxaPct', 'Comissão do canal (%)', { tipo: 'num', ajuda: 'Deixe 0 na venda direta.' })}
          ${UI.sel(st, 'baseTaxa', 'A comissão incide sobre', UI.opts([{ v: 'produtos', t: 'Só os produtos' }, { v: 'produtos_entrega', t: 'Produtos + entrega cobrada' }], st.baseTaxa))}
          ${UI.campo(st, 'taxaFixaPedido', 'Taxa fixa por pedido (R$)', { tipo: 'num' })}
          ${st.tipo === 'plataforma' ? UI.campo(st, 'prazoDias', 'Prazo do repasse (dias)', { tipo: 'int' }) : ''}</div>
        ${UI.chk(st, 'pagamentoIncluso', 'A plataforma recebe o pagamento do cliente', 'Marcado: a taxa da maquininha/forma de pagamento não é cobrada de novo; vale só a taxa da plataforma.')}
        ${UI.sel(st, 'formaPadraoId', 'Forma de pagamento mais comum (para simulações e alertas)', UI.optsFormas(st.formaPadraoId, 'Escolha…'))}
        <p class="muted small">Nenhuma taxa oficial é presumida. Use os valores do seu contrato.</p>`,
      salvar: async st => {
        reqNome(st.nome);
        await UI.salvarCad('canais', Object.assign({}, st, { nome: st.nome.trim(), taxaPct: N(st.taxaPct) || 0, taxaFixaPedido: N(st.taxaFixaPedido) || 0, prazoDias: Math.round(N(st.prazoDias)) || 0 }));
        return 'Canal salvo.';
      },
    }, x);
  };
  F.forma = function (id) {
    const x = id ? L.clone(D().formas[id]) : { id: L.uid('fp'), nome: '', taxaPct: '', taxaFixa: '', prazoDias: '', antecipacaoPct: '' };
    UI.abrir({
      titulo: id ? 'Editar forma de pagamento' : 'Nova forma de pagamento', largura: 'estreita',
      corpo: st => `${UI.campo(st, 'nome', 'Nome', { ph: 'Ex.: Pix, Crédito, Débito' })}
        <div class="lg">${UI.campo(st, 'taxaPct', 'Taxa (%)', { tipo: 'num' })}${UI.campo(st, 'taxaFixa', 'Taxa fixa por transação (R$)', { tipo: 'num' })}
        ${UI.campo(st, 'prazoDias', 'Prazo para receber (dias)', { tipo: 'int' })}${UI.campo(st, 'antecipacaoPct', 'Antecipação (%)', { tipo: 'num', ajuda: 'Incide sobre o valor que sobra após a taxa.' })}</div>`,
      salvar: async st => {
        reqNome(st.nome);
        await UI.salvarCad('formas', Object.assign({}, st, { nome: st.nome.trim(), taxaPct: N(st.taxaPct) || 0, taxaFixa: N(st.taxaFixa) || 0, prazoDias: Math.round(N(st.prazoDias)) || 0, antecipacaoPct: N(st.antecipacaoPct) || 0 }));
        return 'Forma de pagamento salva.';
      },
    }, x);
  };
  F.forno = function (id) {
    const x = id ? L.clone(D().fornos[id]) : { id: L.uid('fo'), nome: '', tipo: 'eletrico', potenciaW: '', fator: '', preaqMin: '', consumoHora: '', custoManualHora: '' };
    UI.abrir({
      titulo: id ? 'Editar forno' : 'Novo forno',
      corpo: st => `<div class="lg">${UI.campo(st, 'nome', 'Nome', { cls: 'w2', ph: 'Ex.: Forno elétrico 44 L' })}${UI.sel(st, 'tipo', 'Tipo', UI.opts([{ v: 'eletrico', t: 'Elétrico' }, { v: 'gas', t: 'Gás encanado' }], st.tipo))}${UI.campo(st, 'preaqMin', 'Pré-aquecimento padrão (min)', { tipo: 'num' })}</div>
        ${st.tipo === 'gas' ? `<div class="lg">${UI.campo(st, 'consumoHora', `Consumo por hora (${esc(D().cfg.unidadeGas || 'm³')}/h)`, { tipo: 'num', ajuda: 'Na mesma unidade da conta de gás.' })}${UI.campo(st, 'custoManualHora', 'Ou estimativa manual (R$/hora)', { tipo: 'num', ajuda: 'Use se não souber o consumo. Fica marcada como estimativa manual.' })}</div>`
        : `<div class="lg">${UI.campo(st, 'potenciaW', 'Potência (W)', { tipo: 'num', ajuda: 'Veja na etiqueta. Para kW, multiplique por 1000.' })}${UI.campo(st, 'fator', 'Fator médio de funcionamento (0 a 1)', { tipo: 'num', ajuda: 'Opcional. O termostato liga e desliga; 1 = ligado o tempo todo.' })}</div>`}`,
      previa: st => {
        const fo = Object.assign({}, st, { potenciaW: N(st.potenciaW), fator: N(st.fator), consumoHora: N(st.consumoHora), custoManualHora: N(st.custoManualHora) });
        const c = L.custoForno(D(), fo, 60);
        return `<div class="small">Estimativa por hora de uso: <strong>${L.brl(c.valor)}</strong>${c.kwh ? ` (${L.nf(c.kwh, 3)} kWh)` : ''}${c.gas ? ` (${L.nf(c.gas, 3)} ${esc(D().cfg.unidadeGas)})` : ''}. ${st.tipo === 'gas' ? '' : 'Potência nominal não significa consumo constante; por isso é estimativa.'}${c.avisos.length ? '<br>' + c.avisos.map(esc).join('<br>') : ''}</div>`;
      },
      salvar: async st => {
        reqNome(st.nome);
        const f = N(st.fator); if (Number.isFinite(f) && (f <= 0 || f > 1)) UI.falha('O fator deve ficar entre 0 e 1.');
        await UI.salvarCad('fornos', Object.assign({}, st, { nome: st.nome.trim(), potenciaW: numOuNull(st.potenciaW), fator: numOuNull(st.fator), preaqMin: numOuNull(st.preaqMin), consumoHora: numOuNull(st.consumoHora), custoManualHora: numOuNull(st.custoManualHora) }));
        return 'Forno salvo.';
      },
    }, x);
  };

  // ---------- promoção ----------
  F.promocao = function (id, inicial) {
    const x = id ? L.clone(D().promocoes[id]) : Object.assign({ id: L.uid('pr'), nome: '', alvoTipo: 'v', alvoId: '', canalId: '', descTipo: 'pct', desc: '', kitVendaId: '', inicio: L.hoje(), fim: '', ativa: true }, inicial || {});
    UI.abrir({
      titulo: id ? 'Editar promoção' : 'Nova promoção',
      corpo: st => `${UI.campo(st, 'nome', 'Nome', { ph: 'Ex.: Dia das Mães' })}
        <div class="f"><span>Aplica-se a</span>${UI.segmento(st, 'alvoTipo', [['v', 'Item'], ['c', 'Combo']])}</div>
        <div class="lg">${UI.sel(st, 'alvoId', st.alvoTipo === 'c' ? 'Combo' : 'Item', st.alvoTipo === 'c' ? UI.opts(L.ativos(D().combos).map(c => ({ v: c.id, t: c.nome })), st.alvoId, 'Escolha…') : UI.optsVariantes(st.alvoId, 'Escolha…'), { cls: 'w2' })}
          ${UI.sel(st, 'canalId', 'Canal', UI.optsCanais(st.canalId, 'Todos'))}</div>
        <div class="lg"><div class="f"><span>Desconto</span>${UI.segmento(st, 'descTipo', [['pct', '%'], ['valor', 'R$ por unidade']])}</div>${UI.campo(st, 'desc', 'Valor do desconto', { tipo: 'num' })}
          ${UI.sel(st, 'kitVendaId', 'Embalagem comemorativa (opcional)', UI.optsKits(st.kitVendaId, 'venda', 'Manter a embalagem normal'))}</div>
        <div class="lg">${UI.campo(st, 'inicio', 'Início', { tipo: 'date' })}${UI.campo(st, 'fim', 'Fim', { tipo: 'date' })}</div>
        ${UI.chk(st, 'ativa', 'Disponível para selecionar nas vendas')}
        <p class="muted small">A promoção só vale nas linhas de venda em que você a selecionar. O preço efetivo fica gravado em cada venda.</p>`,
      salvar: async st => {
        reqNome(st.nome); if (!st.alvoId) UI.falha('Escolha o item ou combo.');
        const d = N(st.desc); if (!(d >= 0)) UI.falha('Informe o desconto.');
        if (st.descTipo === 'pct' && d >= 100) UI.falha('Desconto percentual precisa ser menor que 100%.');
        await UI.salvarCad('promocoes', Object.assign({}, st, { desc: d })); return 'Promoção salva.';
      },
    }, x);
  };

  // ---------- recorrência ----------
  F.recorrencia = function (id) {
    const x = id ? L.clone(D().recorrencias[id]) : { id: L.uid('rc'), descricao: '', natureza: 'despesa', categoria: 'outras', valor: '', dia: '10', inicio: L.hoje().slice(0, 7), fim: '', intervaloMeses: '1', ativa: true };
    UI.abrir({
      titulo: id ? 'Editar recorrência' : 'Nova conta recorrente',
      corpo: st => `${UI.campo(st, 'descricao', 'Descrição', { ph: 'Ex.: Canva, tráfego pago' })}
        <div class="lg">${UI.sel(st, 'natureza', 'Tipo', UI.opts([{ v: 'despesa', t: 'Despesa' }, { v: 'retirada', t: 'Devolução/retirada para a proprietária' }, { v: 'receita', t: 'Outra receita' }], st.natureza))}
          ${st.natureza === 'despesa' ? UI.sel(st, 'categoria', 'Categoria', UI.opts((D().cfg.categoriasDespesa || []).map(c => ({ v: c.id, t: c.nome })), st.categoria)) : ''}
          ${UI.campo(st, 'valor', 'Valor (R$)', { tipo: 'num' })}${UI.campo(st, 'dia', 'Dia do vencimento', { tipo: 'int' })}</div>
        <div class="lg">${UI.campo(st, 'inicio', 'Primeiro mês', { tipo: 'month' })}${UI.campo(st, 'fim', 'Último mês (opcional)', { tipo: 'month' })}${UI.campo(st, 'intervaloMeses', 'Repetir a cada (meses)', { tipo: 'int' })}</div>
        ${UI.chk(st, 'ativa', 'Ativa')}
        <p class="muted small">Recorrências aparecem na previsão e viram conta a pagar quando você lançá-las no mês (Financeiro › Contas).</p>`,
      salvar: async st => {
        if (!String(st.descricao).trim()) UI.falha('Informe a descrição.');
        const v = N(st.valor); if (!(v > 0)) UI.falha('Informe o valor.');
        const dia = Math.round(N(st.dia)); if (!(dia >= 1 && dia <= 31)) UI.falha('Dia entre 1 e 31.');
        if (!st.inicio) UI.falha('Informe o primeiro mês.');
        await UI.salvarCad('recorrencias', Object.assign({}, st, { descricao: st.descricao.trim(), valor: v, dia, intervaloMeses: Math.max(1, Math.round(N(st.intervaloMeses)) || 1), fim: st.fim || null }));
        return 'Recorrência salva.';
      },
    }, x);
  };

  // ---------- configurações gerais ----------
  F.config = function () {
    const c = L.clone(D().cfg);
    UI.abrir({
      titulo: 'Configurações gerais', largura: 'larga',
      corpo: st => `
        <div class="secao-f"><h3>Negócio</h3><div class="lg">${UI.campo(st, 'inicio', 'Início das operações', { tipo: 'date' })}
          ${UI.campo(st, 'saldoInicial', 'Saldo inicial em caixa (R$)', { tipo: 'num' })}</div>
          ${UI.chk(st, 'saldoInicialEhAporte', 'O saldo inicial veio da proprietária (conta como investimento a recuperar)')}</div>
        <div class="secao-f"><h3>Custos para precificar</h3><div class="lg">
          ${UI.campo(st, 'valorHora', 'Valor da sua hora de trabalho (R$)', { tipo: 'num', ajuda: 'Usado só para calcular preço. Não cria despesa nem retirada.' })}
          ${UI.campo(st, 'tarifaKwh', 'Tarifa de energia (R$/kWh)', { tipo: 'num', ajuda: 'Com impostos e bandeira, conforme sua conta.' })}
          ${UI.campo(st, 'tarifaGas', 'Tarifa do gás (R$ por unidade)', { tipo: 'num' })}
          ${UI.campo(st, 'unidadeGas', 'Unidade cobrada do gás', { ph: 'm³' })}
          ${UI.sel(st, 'criterioFornada', 'Dividir energia e trabalho da fornada por', UI.opts([{ v: 'peso', t: 'Peso da massa (un. × peso)' }, { v: 'unidades', t: 'Unidades' }], st.criterioFornada))}
        </div></div>
        <div class="secao-f"><h3>Preço e metas</h3><div class="lg">
          ${UI.campo(st, 'margemDesejada', 'Margem desejada (% do preço)', { tipo: 'num' })}
          ${UI.campo(st, 'itensPorPedido', 'Itens por pedido (premissa)', { tipo: 'num', ajuda: 'Divide taxas fixas por pedido nas simulações.' })}
          ${UI.campo(st, 'capacidadeMensal', 'Capacidade de produção por mês (un.)', { tipo: 'int', ajuda: 'Opcional. Usada para checar se a meta cabe.' })}
        </div></div>
        <div class="secao-f"><h3>Alertas</h3><div class="lg">
          ${UI.campo(st, 'alertaDiasContas', 'Avisar contas com quantos dias de antecedência', { tipo: 'int' })}
          ${UI.campo(st, 'alertaDiasLotes', 'Avisar lotes que vencem em até (dias)', { tipo: 'int' })}</div></div>
        <div class="secao-f"><h3>Investimentos</h3>${UI.chk(st, 'depreciacaoAtiva', 'Descontar depreciação dos equipamentos no resultado', 'Opcional. Usa a vida útil informada em cada investimento.')}</div>`,
      salvar: async st => {
        const o = Object.assign({}, st);
        for (const k of ['saldoInicial', 'valorHora', 'tarifaKwh', 'tarifaGas', 'margemDesejada', 'itensPorPedido', 'alertaDiasContas', 'alertaDiasLotes']) o[k] = N(st[k]) || 0;
        o.capacidadeMensal = numOuNull(st.capacidadeMensal);
        if (o.margemDesejada >= 100) UI.falha('A margem precisa ser menor que 100%.');
        if (!(o.itensPorPedido >= 1)) o.itensPorPedido = 1;
        await L.Store.salvarConfig(o); return 'Configurações salvas.';
      },
    }, c);
  };
  F.categorias = function () {
    const c = L.clone(D().cfg);
    const st0 = { cats: c.categoriasDespesa.map(x => Object.assign({}, x)), prods: (c.categoriasProduto || []).join(', '), impostos: (c.impostos || []).map(x => Object.assign({}, x)) };
    UI.abrir({
      titulo: 'Categorias e impostos', largura: 'larga',
      acoes: { add: st => st.cats.push({ id: L.uid('cat'), nome: '' }), rm: (st, ds) => st.cats.splice(+ds.i, 1), addI: st => st.impostos.push({ nome: '', pct: '' }), rmI: (st, ds) => st.impostos.splice(+ds.i, 1) },
      corpo: st => `<div class="secao-f"><h3>Categorias de despesa</h3>
        <div class="linhas">${st.cats.map((x, i) => `<div class="linha">${x.especial ? '' : `<button type="button" class="x lx" data-fa="rm" data-i="${i}" aria-label="Remover">×</button>`}<div class="lg">${UI.campo(st, `cats.${i}.nome`, x.especial ? 'Categoria especial: ' + { energia: 'energia', gas: 'gás', prolabore: 'pró-labore' }[x.especial] : 'Nome', { cls: 'w2' })}</div></div>`).join('')}</div>
        <div><button type="button" class="btn sm" data-fa="add">+ Categoria</button></div></div>
        <div class="secao-f"><h3>Categorias de produto</h3>${UI.campo(st, 'prods', 'Separe por vírgula', { ph: 'Cookies, Brownies, Sobremesas' })}</div>
        <div class="secao-f"><h3>Impostos (formalização futura)</h3><p class="muted small">Sem alíquota presumida e sem cálculo de enquadramento. Informe somente quando souber o percentual que se aplica a você; ele é descontado das vendas de produtos no resultado.</p>
          <div class="linhas">${st.impostos.map((x, i) => `<div class="linha"><button type="button" class="x lx" data-fa="rmI" data-i="${i}" aria-label="Remover">×</button><div class="lg">${UI.campo(st, `impostos.${i}.nome`, 'Nome')}${UI.campo(st, `impostos.${i}.pct`, '% sobre vendas de produtos', { tipo: 'num' })}</div></div>`).join('')}</div>
          <div><button type="button" class="btn sm" data-fa="addI">+ Imposto</button></div></div>`,
      salvar: async st => {
        const cfg = L.clone(D().cfg);
        cfg.categoriasDespesa = st.cats.filter(x => String(x.nome).trim()).map(x => Object.assign({}, x, { nome: String(x.nome).trim() }));
        cfg.categoriasProduto = String(st.prods || '').split(',').map(s => s.trim()).filter(Boolean);
        cfg.impostos = st.impostos.filter(x => String(x.nome).trim() && N(x.pct) > 0).map(x => ({ nome: String(x.nome).trim(), pct: N(x.pct) }));
        await L.Store.salvarConfig(cfg); return 'Salvo.';
      },
    }, st0);
  };
})(globalThis.L = globalThis.L || {});
