/* LEORA — dados da demonstração (só em memória, identificados como exemplo). */
(function (L) {
  'use strict';
  L.demo = function () {
    const D = L.vazio();
    const hoje = L.hoje();
    const dia = n => L.addDias(hoje, n);
    let seq = 0;
    const grava = (r, data) => {
      if (!r.ok) { console.warn('demo:', r.erro); return null; }
      const id = 'demo-' + (++seq);
      D.ops[id] = Object.assign({ id, criadoEm: new Date(Date.parse(data + 'T12:00:00Z') + seq * 1000).toISOString(), status: 'ativo', historico: [{ em: data + 'T12:00:00Z', acao: 'registrado' }] }, r.op);
      return D.ops[id];
    };
    Object.assign(D.cfg, { inicio: dia(-45), saldoInicial: 800, saldoInicialEhAporte: true, valorHora: 25, tarifaKwh: 0.95, tarifaGas: 0, margemDesejada: 35, itensPorPedido: 2, capacidadeMensal: 600 });
    D.cfg.mix = [{ tipo: 'v', id: 'xv1', canalId: 'xc1', peso: 3 }, { tipo: 'c', id: 'xcb', canalId: 'xc1', peso: 1 }, { tipo: 'v', id: 'xv1', canalId: 'xc2', peso: 1 }];
    D.cfg.rateio = { ativo: true, vendasPlanejadas: 300, categorias: ['trafego', 'assinaturas', 'outras'] };
    D.cal.metas[hoje.slice(0, 7)] = 2500;
    D.cal.diasSemanaFolga = [1];
    const ins = (id, nome, unidade, embQtd, embUnid, preco, extra) => { D.insumos[id] = Object.assign({ id, nome, tipo: 'ingrediente', unidade, embQtd, embUnid, precoEmb: preco, estoqueMin: null }, extra || {}); };
    ins('xi1', 'Farinha de trigo (exemplo)', 'g', 1, 'kg', 6.5, { estoqueMin: 1000 });
    ins('xi2', 'Açúcar mascavo (exemplo)', 'g', 1, 'kg', 14);
    ins('xi3', 'Manteiga (exemplo)', 'g', 200, 'g', 11.9, { controlaLote: true });
    ins('xi4', 'Ovos (exemplo)', 'un', 12, 'un', 13, { gPorUn: 50 });
    ins('xi5', 'Chocolate em gotas (exemplo)', 'g', 1, 'kg', 62, { controlaLote: true });
    ins('xi6', 'Castanha-do-pará (exemplo)', 'g', 500, 'g', 48);
    ins('xe1', 'Saco a vácuo (exemplo)', 'un', 100, 'un', 45, { tipo: 'embalagem', subtipo: 'vacuo' });
    ins('xe2', 'Saquinho individual (exemplo)', 'un', 100, 'un', 22, { tipo: 'embalagem', subtipo: 'individual', estoqueMin: 30 });
    ins('xe3', 'Caixa para 4 (exemplo)', 'un', 20, 'un', 38, { tipo: 'embalagem', subtipo: 'combo' });
    ins('xe4', 'Etiqueta (exemplo)', 'un', 200, 'un', 30, { tipo: 'embalagem', subtipo: 'outra' });
    D.kits.xk1 = { id: 'xk1', nome: 'Vácuo para congelar', uso: 'armazenamento', itens: [{ insumoId: 'xe1', qtd: 1 }] };
    D.kits.xk2 = { id: 'xk2', nome: 'Individual com etiqueta', uso: 'venda', itens: [{ insumoId: 'xe2', qtd: 1 }, { insumoId: 'xe4', qtd: 1 }] };
    D.kits.xk3 = { id: 'xk3', nome: 'Caixa 4 com etiqueta', uso: 'venda', itens: [{ insumoId: 'xe3', qtd: 1 }, { insumoId: 'xe4', qtd: 1 }] };
    D.canais.xc1 = { id: 'xc1', nome: 'WhatsApp', tipo: 'direto', taxaPct: 0, baseTaxa: 'produtos', taxaFixaPedido: 0, prazoDias: 0, pagamentoIncluso: false, formaPadraoId: 'xf1' };
    D.canais.xc2 = { id: 'xc2', nome: 'iFood (exemplo de taxas)', tipo: 'plataforma', taxaPct: 23, baseTaxa: 'produtos', taxaFixaPedido: 0, prazoDias: 30, pagamentoIncluso: true, formaPadraoId: 'xf4' };
    D.formas.xf1 = { id: 'xf1', nome: 'Pix', taxaPct: 0, taxaFixa: 0, prazoDias: 0, antecipacaoPct: 0 };
    D.formas.xf2 = { id: 'xf2', nome: 'Crédito (exemplo)', taxaPct: 4.5, taxaFixa: 0, prazoDias: 30, antecipacaoPct: 0 };
    D.formas.xf3 = { id: 'xf3', nome: 'Dinheiro', taxaPct: 0, taxaFixa: 0, prazoDias: 0, antecipacaoPct: 0 };
    D.formas.xf4 = { id: 'xf4', nome: 'Pagamento via plataforma', taxaPct: 0, taxaFixa: 0, prazoDias: 0, antecipacaoPct: 0 };
    D.fornos.xo1 = { id: 'xo1', nome: 'Forno elétrico (exemplo)', tipo: 'eletrico', potenciaW: 1750, fator: 0.6, preaqMin: 15 };
    D.produtos.xp1 = { id: 'xp1', nome: 'Cookie', categoria: 'Cookies' };
    const assar = { fornoId: 'xo1', minForno: 13, preaqMin: 15, unidadesFornada: 9, minAtivoFornada: 8, minEmbalagemUnid: 1 };
    D.variantes.xv1 = { id: 'xv1', produtoId: 'xp1', sabor: 'Chocolate', tamanho: 'Grande', pesoG: 90, validadeAssadoDias: 5, estoqueMin: 10, kitVendaId: 'xk2', perdaPct: 5, precos: { xc1: 12, xc2: 16 }, assar };
    D.variantes.xv2 = { id: 'xv2', produtoId: 'xp1', sabor: 'Chocolate', tamanho: 'Mini', pesoG: 30, validadeAssadoDias: 5, estoqueMin: null, kitVendaId: 'xk2', perdaPct: 5, precos: { xc1: 5 }, assar: Object.assign({}, assar, { minForno: 9, unidadesFornada: 20 }) };
    D.variantes.xv3 = { id: 'xv3', produtoId: 'xp1', sabor: 'Castanha', tamanho: 'Grande', pesoG: 90, validadeAssadoDias: 5, estoqueMin: 6, kitVendaId: 'xk2', perdaPct: 5, precos: { xc1: 14, xc2: 18 }, assar };
    D.bases.xb1 = { id: 'xb1', nome: 'Massa base', versoes: [{ v: 1, data: dia(-45), ingredientes: [{ insumoId: 'xi1', qtd: 300, unid: 'g' }, { insumoId: 'xi2', qtd: 220, unid: 'g' }, { insumoId: 'xi3', qtd: 200, unid: 'g' }, { insumoId: 'xi4', qtd: 2, unid: 'un' }], massaG: 830 }] };
    D.receitas.xr1 = { id: 'xr1', nome: 'Cookie chocolate', versoes: [{ v: 1, data: dia(-45), bases: [{ baseId: 'xb1', mult: 1 }], extras: [{ insumoId: 'xi5', qtd: 250, unid: 'g' }], saidas: [{ varianteId: 'xv1', unidades: 9 }, { varianteId: 'xv2', unidades: 6 }], tempos: { preparo: 25, porcionamento: 15, embalagem: 10, outras: 0 }, kitArmazId: 'xk1', kitArmazQtd: 2, validadeMassaDias: 90, rendimentoJaDescontaPerdas: false }] };
    D.receitas.xr2 = { id: 'xr2', nome: 'Cookie castanha', versoes: [{ v: 1, data: dia(-45), bases: [{ baseId: 'xb1', mult: 1 }], extras: [{ insumoId: 'xi6', qtd: 180, unid: 'g' }], saidas: [{ varianteId: 'xv3', unidades: 11 }], tempos: { preparo: 25, porcionamento: 12, embalagem: 8, outras: 0 }, kitArmazId: 'xk1', kitArmazQtd: 2, validadeMassaDias: 90, rendimentoJaDescontaPerdas: false }] };
    D.combos.xcb = { id: 'xcb', nome: 'Caixa com 4', tipo: 'livre', livre: { qtd: 4, permitidas: ['xv1', 'xv3'] }, kitVendaId: 'xk3', usarEmbIndividual: false, precos: { xc1: 44, xc2: 58 } };
    D.promocoes.xpr = { id: 'xpr', nome: 'Leve 4 no fim de semana', alvoTipo: 'c', alvoId: 'xcb', canalId: 'xc1', descTipo: 'valor', desc: 2, kitVendaId: '', inicio: dia(-45), fim: '', ativa: true };
    D.recorrencias.xrc1 = { id: 'xrc1', descricao: 'Tráfego pago (exemplo)', natureza: 'despesa', categoria: 'trafego', valor: 150, dia: 5, inicio: dia(-45).slice(0, 7), fim: null, intervaloMeses: 1, ativa: true };
    D.recorrencias.xrc2 = { id: 'xrc2', descricao: 'Canva (exemplo)', natureza: 'despesa', categoria: 'assinaturas', valor: 35, dia: 12, inicio: dia(-45).slice(0, 7), fim: null, intervaloMeses: 1, ativa: true };

    // lançamentos iniciais
    grava(L.prepararLancamento(D, { natureza: 'investimento', origem: 'proprietaria', descricao: 'Batedeira (já era da proprietária)', competencia: dia(-45), valorProprietaria: 450, tipoInvestimento: 'equipamento', vidaUtilMeses: 36 }), dia(-45));
    grava(L.prepararLancamento(D, { natureza: 'investimento', descricao: 'Formas e utensílios', competencia: dia(-44), tipoInvestimento: 'utensilio', parcelas: [{ venc: dia(-44), valor: 180, pagos: [{ data: dia(-44), valor: 180 }] }] }), dia(-44));
    // compra parcelada com frete
    grava(L.prepararCompra(D, {
      data: dia(-40), recebidoEm: dia(-39), fornecedor: 'Atacadista (exemplo)', rateio: 'valor', extras: [{ descricao: 'Frete', valor: 15 }],
      itens: [
        { insumoId: 'xi1', embs: 5, embQtd: 1, embUnid: 'kg', valor: 31 }, { insumoId: 'xi2', embs: 3, embQtd: 1, embUnid: 'kg', valor: 40.5 },
        { insumoId: 'xi3', embs: 10, embQtd: 200, embUnid: 'g', valor: 115, lote: 'MT-01', validade: dia(40) }, { insumoId: 'xi4', embs: 2, embQtd: 12, embUnid: 'un', valor: 25 },
        { insumoId: 'xi5', embs: 2, embQtd: 1, embUnid: 'kg', valor: 120, lote: 'CH-7', validade: dia(150) }, { insumoId: 'xi6', embs: 2, embQtd: 500, embUnid: 'g', valor: 92 },
        { insumoId: 'xe1', embs: 1, embQtd: 100, embUnid: 'un', valor: 45 }, { insumoId: 'xe2', embs: 1, embQtd: 100, embUnid: 'un', valor: 22 },
        { insumoId: 'xe3', embs: 1, embQtd: 20, embUnid: 'un', valor: 38 }, { insumoId: 'xe4', embs: 1, embQtd: 200, embUnid: 'un', valor: 30 },
      ],
      parcelas: [{ venc: dia(-40), valor: 286.75, pagos: [{ data: dia(-40), valor: 286.75 }] }, { venc: dia(-10), valor: 286.75, pagos: [{ data: dia(-10), valor: 286.75 }] }],
    }), dia(-40));
    // produções
    grava(L.prepararProducao(D, L.estado(D), { receitaId: 'xr1', data: dia(-36), mult: 5, saidas: [{ varianteId: 'xv1', unidades: 45 }, { varianteId: 'xv2', unidades: 29 }], minutos: 170, kitArmazQtd: 10, validadeDias: 90, lote: 'M-CH1' }, 'demo-' + (seq + 1)), dia(-36));
    grava(L.prepararProducao(D, L.estado(D), { receitaId: 'xr2', data: dia(-35), mult: 3, saidas: [{ varianteId: 'xv3', unidades: 32 }], minutos: 110, kitArmazQtd: 6, validadeDias: 90, lote: 'M-CA1' }, 'demo-' + (seq + 1)), dia(-35));
    grava(L.prepararLancamento(D, { natureza: 'despesa', categoria: 'trafego', descricao: 'Tráfego pago (exemplo)', competencia: dia(-30), recorrenciaId: 'xrc1', parcelas: [{ venc: dia(-30), valor: 150, pagos: [{ data: dia(-30), valor: 150 }] }] }), dia(-30));
    // ciclo: fornada + vendas a cada 3 dias
    let n = 0;
    for (let k = -33; k <= -1; k += 3) {
      n++;
      const S = L.estado(D); const data = dia(k);
      const lc = L.lotesDisponiveis(S, 'massa', 'xv1', data)[0], lca = L.lotesDisponiveis(S, 'massa', 'xv3', data)[0], lm = L.lotesDisponiveis(S, 'massa', 'xv2', data)[0];
      const linhas = [];
      if (lc && lc.saldo >= 3) linhas.push({ key: lc.key, retiradas: Math.min(lc.saldo, 3), boas: Math.min(lc.saldo, 3) - (n % 4 === 0 ? 1 : 0) });
      if (lca && lca.saldo >= 2) linhas.push({ key: lca.key, retiradas: Math.min(lca.saldo, 2), boas: Math.min(lca.saldo, 2) });
      if (lm && lm.saldo >= 2 && n % 2) linhas.push({ key: lm.key, retiradas: Math.min(lm.saldo, 3), boas: Math.min(lm.saldo, 3) });
      if (!linhas.length) continue;
      const f = grava(L.prepararFornada(D, S, { data, usos: [{ fornoId: 'xo1', minutos: 13, preaqMin: 15 }], linhas, minAtivo: 8 }, 'demo-' + (seq + 1)), data);
      if (!f) continue;
      const S2 = L.estado(D);
      const disp = id => L.sum(L.lotesDisponiveis(S2, 'assado', id, data).filter(l => !L.vencido(l, data)), l => l.saldo);
      let ch = disp('xv1'), ca = disp('xv3'); const mi = disp('xv2');
      const lv = [];
      if (n % 3 === 0 && ca >= 1 && ch + Math.min(ca, 3) >= 4) {
        const qCa = Math.min(ca, 3), qCh = 4 - qCa;
        lv.push({ tipo: 'c', refId: 'xcb', qtd: 1, precoUnit: 44, desconto: 2, promoId: 'xpr', composicao: [{ varianteId: 'xv1', qtd: qCh }, { varianteId: 'xv3', qtd: qCa }].filter(x => x.qtd > 0) });
        ch -= qCh; ca -= qCa;
      }
      if (ch >= 2) lv.push({ tipo: 'v', refId: 'xv1', qtd: ch - 1, precoUnit: 12 });
      if (mi >= 2) lv.push({ tipo: 'v', refId: 'xv2', qtd: mi, precoUnit: 5 });
      if (ca >= 1) lv.push({ tipo: 'v', refId: 'xv3', qtd: ca, precoUnit: 14 });
      if (lv.length) grava(L.prepararVenda(D, S2, { data, canalId: 'xc1', formaId: n % 2 ? 'xf1' : 'xf3', linhas: lv, recebidoNaHora: true, entrega: n % 3 === 0 ? { cobrada: 8, custo: 7 } : {} }), data);
      const S3 = L.estado(D); const sobra = L.sum(L.lotesDisponiveis(S3, 'assado', 'xv1', data).filter(l => !L.vencido(l, data)), l => l.saldo);
      if (sobra >= 1 && n % 2 === 0) grava(L.prepararVenda(D, S3, { data, canalId: 'xc2', formaId: 'xf4', pedidos: 1, linhas: [{ tipo: 'v', refId: 'xv1', qtd: 1, precoUnit: 16 }] }), data);
    }
    // repasse do iFood já recebido em parte
    for (const o of Object.values(D.ops)) if (o.k === 'venda' && o.canalId === 'xc2') for (const r of o.recebimentos) if (r.data <= hoje) r.pagos.push({ id: L.uid('g'), data: r.data, valor: r.valor });
    // perda registrada
    const S4 = L.estado(D); const lp = L.lotesDisponiveis(S4, 'massa', 'xv3', hoje)[0];
    if (lp) grava(L.prepararPerda(D, S4, { data: dia(-2), key: lp.key, qtd: 1, motivo: 'Caiu / contaminou' }), dia(-2));
    return D;
  };
})(globalThis.L = globalThis.L || {});
