/* LEORA — motor de cálculo. Funções puras sobre o conjunto de dados D.
 *
 * Princípio central: cada operação (compra, produção, fornada, venda, perda,
 * ajuste) guarda, no momento do registro, a lista congelada de movimentos de
 * estoque (`mov`) e os custos que valiam naquele dia. O estoque atual é a
 * soma dos movimentos das operações ativas. Cancelar = marcar a operação como
 * cancelada; os movimentos deixam de contar, sem gerar estornos duplicados.
 * Editar = substituir a operação inteira (mesmo id), validando o resultado.
 */
(function (L) {
  'use strict';
  const { r2, r6, sum, converter, addDias, mesDe, diasNoMes, diaSemana, addMesYM, diffDias } = L;
  const EPS = 1e-6;
  const ESQUEMA = 1;

  // ---------- padrões ----------
  const CATEGORIAS_DESPESA = [
    { id: 'energia', nome: 'Energia (parte da confeitaria)', especial: 'energia' },
    { id: 'gas', nome: 'Gás (parte da confeitaria)', especial: 'gas' },
    { id: 'trafego', nome: 'Tráfego pago' },
    { id: 'assinaturas', nome: 'Assinaturas e aplicativos' },
    { id: 'prolabore', nome: 'Pró-labore', especial: 'prolabore' },
    { id: 'frete', nome: 'Frete e despesas de compra' },
    { id: 'impostos', nome: 'Impostos e taxas' },
    { id: 'manutencao', nome: 'Manutenção' },
    { id: 'outras', nome: 'Outras despesas' },
  ];
  function configPadrao() {
    return {
      esquema: ESQUEMA,
      nome: 'LEORA Confeitaria Artesanal',
      inicio: null,
      saldoInicial: 0,
      saldoInicialEhAporte: true,
      valorHora: 0,
      tarifaKwh: 0,
      tarifaGas: 0,
      unidadeGas: 'm³',
      criterioFornada: 'peso', // 'peso' | 'unidades'
      margemDesejada: 30,
      itensPorPedido: 1,
      alertaDiasContas: 3,
      alertaDiasLotes: 7,
      capacidadeMensal: null,
      categoriasDespesa: CATEGORIAS_DESPESA.map(c => Object.assign({}, c)),
      categoriasProduto: ['Cookies'],
      mix: [], // [{tipo:'v'|'c', id, canalId, peso}]
      rateio: { ativo: false, vendasPlanejadas: null, categorias: [] },
      depreciacaoAtiva: false,
      impostos: [], // [{nome, pct}] — começa vazio, sem alíquotas presumidas
      receitaPorVariante: {},
    };
  }
  function calendarioPadrao() { return { metas: {}, folgas: {}, diasSemanaFolga: [] }; }
  function vazio() {
    return {
      cfg: configPadrao(), cal: calendarioPadrao(), logo: null,
      insumos: {}, kits: {}, bases: {}, produtos: {}, variantes: {}, receitas: {}, combos: {},
      canais: {}, formas: {}, fornos: {}, promocoes: {}, recorrencias: {}, ops: {},
    };
  }
  const COLECOES = ['insumos', 'kits', 'bases', 'produtos', 'variantes', 'receitas', 'combos', 'canais', 'formas', 'fornos', 'promocoes', 'recorrencias'];

  // ---------- nomes ----------
  function nomeVariante(D, id) {
    const v = D.variantes[id]; if (!v) return '(item removido)';
    const p = D.produtos[v.produtoId];
    return [p ? p.nome : '', v.sabor, v.tamanho].filter(Boolean).join(' · ');
  }
  function nomeItem(D, tipo, id) { return tipo === 'c' ? (D.combos[id] ? 'Combo ' + D.combos[id].nome : '(combo removido)') : nomeVariante(D, id); }
  function ativos(obj) { return Object.values(obj || {}).filter(x => !x.arquivado); }
  function ultimaVersao(r) { return r && r.versoes && r.versoes.length ? r.versoes[r.versoes.length - 1] : null; }
  function opsAtivas(D) { return Object.values(D.ops).filter(o => o.status !== 'cancelado'); }
  function catDespesa(D, id) { return (D.cfg.categoriasDespesa || []).find(c => c.id === id) || { id, nome: id || 'Sem categoria' }; }

  // ---------- estado de estoque (replay dos movimentos congelados) ----------
  function estado(D, opts) {
    opts = opts || {};
    const S = { ins: {}, lotes: {}, movs: [], negativos: [] };
    const ops = Object.values(D.ops).filter(o => o.status !== 'cancelado' && o.id !== opts.excluirId);
    if (opts.incluir) ops.push(opts.incluir);
    const lista = [];
    for (const op of ops) (op.mov || []).forEach((m, i) => lista.push({ m, op, i, data: m.data || op.data }));
    lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : (a.op.criadoEm || '') < (b.op.criadoEm || '') ? -1 : (a.op.criadoEm || '') > (b.op.criadoEm || '') ? 1 : a.i - b.i));
    for (const { m, op, data } of lista) {
      if (opts.ate && data > opts.ate) continue;
      if (m.alvo === 'ins') aplicarInsumo(S, m, op, data);
      else aplicarLote(S, m, op, data);
      S.movs.push({ data, op: op.id, k: op.k, alvo: m.alvo, id: m.id || m.key, q: m.q, v: m.v });
    }
    for (const [id, st] of Object.entries(S.ins)) if (st.qtd < -EPS) S.negativos.push({ alvo: 'ins', id, qtd: st.qtd });
    for (const [key, l] of Object.entries(S.lotes)) if (l.saldo < -EPS) S.negativos.push({ alvo: l.estado, id: key, qtd: l.saldo });
    return S;
  }
  function stIns(S, id) {
    return S.ins[id] || (S.ins[id] = { qtd: 0, valor: 0, ultimo: null, medioRef: null, lotes: [], hist: [] });
  }
  function aplicarInsumo(S, m, op, data) {
    const st = stIns(S, m.id);
    if (m.q > 0) {
      st.qtd += m.q; st.valor += Number(m.v) || 0;
      st.lotes.push({ op: op.id, lote: m.lote || '', validade: m.validade || null, data, saldo: m.q });
      if (op.k === 'compra') {
        st.ultimo = m.q > 0 ? (Number(m.v) || 0) / m.q : st.ultimo;
        st.hist.push({ data, custoUnit: st.ultimo, op: op.id, fornecedor: op.fornecedor || '' });
      }
    } else if (m.q < 0) {
      const q = -m.q;
      const medio = st.qtd > EPS ? st.valor / st.qtd : (st.medioRef || st.ultimo || 0);
      st.valor -= medio * q; st.qtd -= q;
      if (st.qtd <= EPS) { st.medioRef = medio; st.valor = st.qtd < -EPS ? st.qtd * medio : 0; }
      consumirLotesInsumo(st, q, data, m.loteRef);
    }
    if (st.qtd > EPS) st.medioRef = st.valor / st.qtd;
  }
  function consumirLotesInsumo(st, q, data, loteRef) {
    let falta = q;
    if (loteRef) {
      const l = st.lotes.find(x => x.op === loteRef && x.saldo > EPS);
      if (l) { const u = Math.min(l.saldo, falta); l.saldo -= u; falta -= u; }
    }
    const ordem = st.lotes.filter(l => l.saldo > EPS).sort((a, b) => {
      const va = !a.validade || a.validade >= data, vb = !b.validade || b.validade >= data;
      if (va !== vb) return va ? -1 : 1;
      if ((a.validade || '9999') !== (b.validade || '9999')) return (a.validade || '9999') < (b.validade || '9999') ? -1 : 1;
      return a.data < b.data ? -1 : 1;
    });
    for (const l of ordem) { if (falta <= EPS) break; const u = Math.min(l.saldo, falta); l.saldo -= u; falta -= u; }
  }
  function aplicarLote(S, m, op, data) {
    let l = S.lotes[m.key];
    if (m.q > 0 && m.cria) {
      l = S.lotes[m.key] = {
        key: m.key, op: op.id, estado: m.alvo, varianteId: m.varianteId, data, validade: m.validade || null,
        lote: m.lote || '', cu: m.cu || { m: 0, e: 0, t: 0 }, pesoUnitG: m.pesoUnitG || null,
        inicial: m.q, saldo: m.q, origem: m.origem || null,
      };
      return;
    }
    if (!l) { // movimento sobre lote inexistente (origem cancelada): registra negativo
      l = S.lotes[m.key] = { key: m.key, op: null, estado: m.alvo, varianteId: m.varianteId || null, data, validade: null, lote: '?', cu: { m: 0, e: 0, t: 0 }, inicial: 0, saldo: 0, origem: null, orfao: true };
    }
    l.saldo += m.q;
  }

  // Lotes com saldo, por estado ('massa' | 'assado'), ordenados pela validade mais próxima.
  function lotesDisponiveis(S, estadoL, varianteId, data) {
    return Object.values(S.lotes)
      .filter(l => l.estado === estadoL && l.saldo > EPS && (!varianteId || l.varianteId === varianteId) && (!data || l.data <= data))
      .sort((a, b) => ((a.validade || '9999') < (b.validade || '9999') ? -1 : (a.validade || '9999') > (b.validade || '9999') ? 1 : a.data < b.data ? -1 : 1));
  }
  function vencido(l, data) { return !!(l.validade && l.validade < data); }
  function disponivelInsumo(S, id, data) {
    const st = S.ins[id]; if (!st) return { total: 0, valido: 0, vencido: 0 };
    let valido = 0, venc = 0;
    for (const l of st.lotes) if (l.saldo > EPS) { if (l.validade && l.validade < data) venc += l.saldo; else valido += l.saldo; }
    // diferenças de arredondamento: o total manda
    const total = Math.max(0, st.qtd);
    if (valido + venc > total + EPS) valido = Math.max(0, total - venc);
    return { total, valido, vencido: venc };
  }

  // ---------- custos de insumos ----------
  function precoCadastroBase(ins) {
    const p = Number(ins.precoEmb), q = Number(ins.embQtd);
    if (!(p > 0) || !(q > 0)) return null;
    const c = converter(q, ins.embUnid || ins.unidade, ins);
    return c.ok && c.valor > 0 ? p / c.valor : null;
  }
  /** Custo por unidade base (g, ml ou un). criterio: 'medio' | 'ultimo'. */
  function custoBaseInsumo(D, S, id, criterio) {
    const ins = D.insumos[id]; if (!ins) return { valor: null, fonte: 'item removido' };
    const st = S.ins[id];
    const cad = precoCadastroBase(ins);
    if (criterio === 'ultimo') {
      if (st && st.ultimo !== null) return { valor: st.ultimo, fonte: 'última compra' };
    } else {
      if (st && st.qtd > EPS) return { valor: st.valor / st.qtd, fonte: 'custo médio do estoque' };
      if (st && st.medioRef) return { valor: st.medioRef, fonte: 'último custo médio' };
      if (st && st.ultimo !== null) return { valor: st.ultimo, fonte: 'última compra' };
    }
    if (cad !== null) return { valor: cad, fonte: 'preço do cadastro' };
    return { valor: null, fonte: 'sem preço' };
  }
  function custoKit(D, S, kitId, criterio) {
    const k = D.kits[kitId]; if (!k) return { valor: 0, itens: [], avisos: [] };
    const avisos = []; const itens = [];
    for (const it of k.itens || []) {
      const c = custoBaseInsumo(D, S, it.insumoId, criterio);
      if (c.valor === null) avisos.push(`Sem preço para ${(D.insumos[it.insumoId] || {}).nome || 'item'} no conjunto ${k.nome}.`);
      itens.push({ insumoId: it.insumoId, qtd: Number(it.qtd) || 0, custo: (c.valor || 0) * (Number(it.qtd) || 0) });
    }
    return { valor: sum(itens, i => i.custo), itens, avisos };
  }

  // ---------- receitas ----------
  /** Soma os ingredientes da receita (bases × multiplicador + adicionais), agrupando por insumo. */
  function expandirVersao(D, versao, mult) {
    mult = mult || 1;
    const mapa = {}; const erros = [];
    const add = (insumoId, qtd, unid, origem) => {
      const ins = D.insumos[insumoId];
      if (!ins) { erros.push(`Ingrediente removido em ${origem}.`); return; }
      const c = converter(Number(qtd) || 0, unid || ins.unidade, ins);
      if (!c.ok) { erros.push(c.erro); return; }
      mapa[insumoId] = (mapa[insumoId] || 0) + c.valor * mult;
    };
    for (const b of versao.bases || []) {
      const base = D.bases[b.baseId];
      const bv = b.versaoFixa ? (base && base.versoes.find(x => x.v === b.versaoFixa)) : ultimaVersao(base);
      if (!bv) { erros.push('Receita base não encontrada.'); continue; }
      const fator = Number(b.mult) || 0;
      for (const ing of bv.ingredientes || []) add(ing.insumoId, (Number(ing.qtd) || 0) * fator, ing.unid, 'base ' + base.nome);
    }
    for (const ing of versao.extras || []) add(ing.insumoId, ing.qtd, ing.unid, 'adicionais');
    return { insumos: Object.entries(mapa).map(([insumoId, qtd]) => ({ insumoId, qtd: r6(qtd) })), erros };
  }
  function receitaDaVariante(D, varId) {
    const fixa = (D.cfg.receitaPorVariante || {})[varId];
    if (fixa && D.receitas[fixa] && !D.receitas[fixa].arquivado) return D.receitas[fixa];
    const cand = ativos(D.receitas).filter(r => { const v = ultimaVersao(r); return v && (v.saidas || []).some(s => s.varianteId === varId); });
    cand.sort((a, b) => (ultimaVersao(b).data || '').localeCompare(ultimaVersao(a).data || ''));
    return cand[0] || null;
  }
  /** Divide um valor entre itens por peso (unidades × peso) ou por unidades. */
  function ratear(total, itens, criterio) {
    const pesos = itens.map(it => criterio === 'unidades' || !(it.pesoG > 0) ? it.unidades : it.unidades * it.pesoG);
    const semPeso = criterio !== 'unidades' && itens.some(it => !(it.pesoG > 0));
    const usarUn = semPeso; // mistura sem peso cadastrado → cai para unidades, avisando
    const p2 = usarUn ? itens.map(it => it.unidades) : pesos;
    const tot = sum(p2);
    return { partes: p2.map(p => (tot > 0 ? total * p / tot : 0)), criterioUsado: usarUn ? 'unidades' : criterio, aviso: usarUn && criterio !== 'unidades' ? 'Algum item está sem peso cadastrado; a divisão foi feita por unidades.' : null };
  }
  /** Custo de um lote de massa (1 receita × mult) e divisão entre as saídas. */
  function custoLote(D, S, versao, criterio, mult) {
    mult = mult || 1;
    const avisos = [];
    const exp = expandirVersao(D, versao, mult);
    avisos.push(...exp.erros);
    const insumos = exp.insumos.map(i => {
      const c = custoBaseInsumo(D, S, i.insumoId, criterio);
      if (c.valor === null) avisos.push(`Sem preço para ${D.insumos[i.insumoId].nome}. Cadastre o preço ou registre uma compra.`);
      return Object.assign({}, i, { custoUnit: c.valor || 0, custo: (c.valor || 0) * i.qtd, fonte: c.fonte });
    });
    const ingredientes = sum(insumos, i => i.custo);
    const kitQ = (Number(versao.kitArmazQtd) || 0) * mult;
    const kit = versao.kitArmazId ? custoKit(D, S, versao.kitArmazId, criterio) : { valor: 0, avisos: [] };
    avisos.push(...kit.avisos);
    const embalagem = kit.valor * kitQ;
    const t = versao.tempos || {};
    const minutos = ((Number(t.preparo) || 0) + (Number(t.porcionamento) || 0) + (Number(t.embalagem) || 0) + (Number(t.outras) || 0)) * mult;
    const trabalho = minutos / 60 * (Number(D.cfg.valorHora) || 0);
    const saidas = (versao.saidas || []).map(s => ({ varianteId: s.varianteId, unidades: (Number(s.unidades) || 0) * mult, pesoG: Number((D.variantes[s.varianteId] || {}).pesoG) || 0 }));
    const rm = ratear(ingredientes + embalagem, saidas, 'peso');
    const rt = ratear(trabalho, saidas, 'peso');
    if (rm.aviso) avisos.push(rm.aviso);
    const out = saidas.map((s, i) => ({
      varianteId: s.varianteId, unidades: s.unidades,
      m: s.unidades > 0 ? rm.partes[i] / s.unidades : 0,
      t: s.unidades > 0 ? rt.partes[i] / s.unidades : 0,
    }));
    return { insumos, ingredientes, embalagem, minutos, trabalho, total: ingredientes + embalagem + trabalho, saidas: out, avisos, criterioRateio: rm.criterioUsado };
  }

  // ---------- forno (energia elétrica e gás) ----------
  function custoForno(D, forno, minutos) {
    const h = (Number(minutos) || 0) / 60;
    if (!forno) return { valor: 0, kwh: 0, gas: 0, manual: false, avisos: ['Forno não cadastrado.'] };
    const avisos = [];
    if (forno.tipo === 'gas') {
      if (Number(forno.custoManualHora) > 0) return { valor: h * Number(forno.custoManualHora), kwh: 0, gas: 0, manual: true, avisos: ['Gás: estimativa manual por hora informada por você.'] };
      const consumo = (Number(forno.consumoHora) || 0) * h;
      if (!(Number(forno.consumoHora) > 0)) avisos.push(`Informe o consumo do forno ${forno.nome} por hora (${D.cfg.unidadeGas || 'm³'}/h) ou uma estimativa manual.`);
      if (!(Number(D.cfg.tarifaGas) > 0)) avisos.push('Informe a tarifa do gás nas configurações.');
      return { valor: consumo * (Number(D.cfg.tarifaGas) || 0), kwh: 0, gas: consumo, manual: false, avisos };
    }
    const kw = (Number(forno.potenciaW) || 0) / 1000;
    const fator = Number(forno.fator) > 0 ? Number(forno.fator) : 1;
    const kwh = kw * h * fator;
    if (!(kw > 0)) avisos.push(`Informe a potência do forno ${forno.nome}.`);
    if (!(Number(D.cfg.tarifaKwh) > 0)) avisos.push('Informe a tarifa de energia (R$/kWh) nas configurações.');
    return { valor: kwh * (Number(D.cfg.tarifaKwh) || 0), kwh, gas: 0, manual: false, avisos };
  }

  // ---------- custo unitário completo de uma variação (para simular preço) ----------
  function custoVariante(D, S, varId, criterio, opcoes) {
    opcoes = opcoes || {};
    const v = D.variantes[varId];
    const r = { ingredientes: 0, embArmaz: 0, trabPreparo: 0, energia: 0, trabAssar: 0, perdas: 0, embVenda: 0, trabEmbVenda: 0, total: 0, m: 0, e: 0, t: 0, avisos: [], receita: null };
    if (!v) { r.avisos.push('Item não encontrado.'); return r; }
    const vh = Number(D.cfg.valorHora) || 0;
    const rec = receitaDaVariante(D, varId);
    let perdaJaNoRendimento = false;
    if (!rec) r.avisos.push('Sem receita cadastrada para este item.');
    else {
      const ver = ultimaVersao(rec);
      r.receita = { id: rec.id, nome: rec.nome, v: ver.v };
      perdaJaNoRendimento = !!ver.rendimentoJaDescontaPerdas;
      const lote = custoLote(D, S, ver, criterio, 1);
      r.avisos.push(...lote.avisos);
      const s = lote.saidas.find(x => x.varianteId === varId);
      if (s && s.unidades > 0) {
        const fIng = lote.ingredientes + lote.embalagem > 0 ? lote.ingredientes / (lote.ingredientes + lote.embalagem) : 1;
        r.ingredientes = s.m * fIng; r.embArmaz = s.m * (1 - fIng); r.trabPreparo = s.t;
      } else r.avisos.push('A receita não informa o rendimento deste item.');
    }
    const a = v.assar || {};
    const forno = D.fornos[a.fornoId];
    const unF = Number(a.unidadesFornada) || 0;
    if (forno && unF > 0) {
      const cf = custoForno(D, forno, (Number(a.minForno) || 0) + (Number(a.preaqMin) || 0));
      r.avisos.push(...cf.avisos);
      r.energia = cf.valor / unF;
      r.energiaManual = cf.manual;
      r.trabAssar = (Number(a.minAtivoFornada) || 0) / 60 * vh / unF;
    } else r.avisos.push('Informe forno e unidades por fornada para estimar energia/gás.');
    const p = perdaJaNoRendimento ? 0 : Math.min(0.95, Math.max(0, (Number(v.perdaPct) || 0) / 100));
    const prod = r.ingredientes + r.embArmaz + r.trabPreparo + r.energia + r.trabAssar;
    r.perdas = p > 0 ? prod * (p / (1 - p)) : 0;
    r.perdaPct = p; r.perdaJaNoRendimento = perdaJaNoRendimento;
    const kitId = opcoes.kitVendaId !== undefined ? opcoes.kitVendaId : v.kitVendaId;
    if (!opcoes.semEmbVenda && kitId) {
      const k = custoKit(D, S, kitId, criterio); r.embVenda = k.valor; r.avisos.push(...k.avisos);
    }
    if (!opcoes.semEmbVenda) r.trabEmbVenda = (Number(a.minEmbalagemUnid) || 0) / 60 * vh;
    if (!(vh > 0)) r.avisos.push('Valor da sua hora de trabalho está zerado nas configurações.');
    const fp = prod > 0 ? r.perdas / prod : 0;
    r.m = (r.ingredientes + r.embArmaz) * (1 + fp) + r.embVenda;
    r.e = r.energia * (1 + fp);
    r.t = (r.trabPreparo + r.trabAssar) * (1 + fp) + r.trabEmbVenda;
    r.total = r.m + r.e + r.t;
    r.avisos = [...new Set(r.avisos)];
    return r;
  }
  /** Custo do combo. Para combos livres devolve faixa (mínimo, médio, máximo). */
  function custoCombo(D, S, comboId, criterio, kitOverride) {
    const c = D.combos[comboId];
    const out = { min: 0, max: 0, medio: 0, embalagem: 0, avisos: [], unidades: 0, m: 0, e: 0, t: 0 };
    if (!c) return out;
    const kitId = kitOverride !== undefined ? kitOverride : c.kitVendaId;
    if (kitId) { const k = custoKit(D, S, kitId, criterio); out.embalagem = k.valor; out.avisos.push(...k.avisos); }
    const op = { semEmbVenda: !c.usarEmbIndividual };
    if (c.tipo === 'livre') {
      const q = Number((c.livre || {}).qtd) || 0;
      const custos = ((c.livre || {}).permitidas || []).map(id => custoVariante(D, S, id, criterio, op));
      if (!custos.length) { out.avisos.push('Escolha os sabores permitidos no combo.'); return out; }
      custos.forEach(x => out.avisos.push(...x.avisos));
      const tot = custos.map(x => x.total);
      out.unidades = q;
      out.min = Math.min(...tot) * q + out.embalagem;
      out.max = Math.max(...tot) * q + out.embalagem;
      out.medio = sum(tot) / tot.length * q + out.embalagem;
      out.m = sum(custos, x => x.m) / custos.length * q + out.embalagem;
      out.e = sum(custos, x => x.e) / custos.length * q;
      out.t = sum(custos, x => x.t) / custos.length * q;
    } else {
      let tot = 0;
      for (const it of c.itens || []) {
        const x = custoVariante(D, S, it.varianteId, criterio, op);
        out.avisos.push(...x.avisos);
        const q = Number(it.qtd) || 0;
        tot += x.total * q; out.unidades += q; out.m += x.m * q; out.e += x.e * q; out.t += x.t * q;
      }
      out.m += out.embalagem;
      out.min = out.max = out.medio = tot + out.embalagem;
    }
    out.avisos = [...new Set(out.avisos)];
    return out;
  }

  // ---------- taxas de canal e pagamento ----------
  /** Taxas percentuais sobre o preço e fixas por pedido, respeitando a base de cada uma. */
  function taxas(D, canalId, formaId) {
    const c = D.canais[canalId] || {}; const f = D.formas[formaId] || {};
    const incluso = !!c.pagamentoIncluso;
    const pc = (Number(c.taxaPct) || 0) / 100;
    const pp = incluso ? 0 : (Number(f.taxaPct) || 0) / 100;
    const pa = incluso ? 0 : (Number(f.antecipacaoPct) || 0) / 100;
    // antecipação incide sobre o valor que sobra depois da taxa da maquininha
    const pEff = pc + pp + pa * (1 - pp);
    const fixoPedido = (Number(c.taxaFixaPedido) || 0) + (incluso ? 0 : (Number(f.taxaFixa) || 0));
    const prazo = incluso || c.tipo === 'plataforma' ? (Number(c.prazoDias) || 0) : (Number(f.prazoDias) || 0);
    return { pc, pp, pa, pEff, fixoPedido, incluso, prazo, canal: c, forma: f };
  }
  /** Preço pela margem desejada: (custos + fixas) / (1 − taxas% − margem). */
  function precoSugerido(custo, tx, margem, itensPorPedido, rateio) {
    const n = Math.max(1, Number(itensPorPedido) || 1);
    const F = tx.fixoPedido / n;
    const denom = 1 - tx.pEff - margem;
    if (!(denom > 0)) return { preco: null, denom, F, erro: `As taxas (${L.pct(tx.pEff)}) mais a margem desejada (${L.pct(margem)}) chegam a 100% ou mais do preço. Reduza a margem.` };
    return { preco: (custo + F + (rateio || 0)) / denom, denom, F };
  }
  /** Resultado de um preço escolhido. */
  function analisarPreco(preco, custo, tx, itensPorPedido, rateio, custoDinheiro) {
    const n = Math.max(1, Number(itensPorPedido) || 1);
    const F = tx.fixoPedido / n;
    const taxasValor = preco * tx.pEff + F;
    const contribuicao = preco - custo - taxasValor; // sobra antes das despesas fixas
    const lucro = contribuicao - (rateio || 0);
    const minimo = (1 - tx.pEff) > 0 ? (custo + F) / (1 - tx.pEff) : null;
    const minimoRateio = (1 - tx.pEff) > 0 ? (custo + F + (rateio || 0)) / (1 - tx.pEff) : null;
    return {
      preco, taxasValor, contribuicao, lucro, rateio: rateio || 0,
      margemContrib: preco > 0 ? contribuicao / preco : 0,
      margemLucro: preco > 0 ? lucro / preco : 0,
      markup: custo > 0 ? (preco - custo) / custo : 0,
      contribDinheiro: custoDinheiro !== undefined ? preco - custoDinheiro - taxasValor : null,
      minimo, minimoRateio,
    };
  }
  /** Despesas mensais rateadas por unidade (só quando ativado e com vendas planejadas). */
  function rateioMensal(D, ym) {
    const r = D.cfg.rateio || {};
    const desp = despesasFixasMes(D, ym);
    const cats = r.categorias && r.categorias.length ? r.categorias : null;
    const itens = desp.itens.filter(i => !cats || cats.includes(i.categoria));
    const total = sum(itens, i => i.valor);
    const vendas = Number(r.vendasPlanejadas) || 0;
    return { ativo: !!r.ativo && vendas > 0, total, vendas, porUnidade: vendas > 0 ? total / vendas : 0, itens, excluidas: desp.excluidas };
  }

  // ---------- vendas ----------
  function calcVenda(D, v) {
    const linhas = v.linhas || [];
    const bruto = r2(sum(linhas, l => (Number(l.qtd) || 0) * (Number(l.precoUnit) || 0)));
    const descontos = r2(sum(linhas, l => Number(l.desconto) || 0));
    const produtos = r2(bruto - descontos);
    const entrega = r2(Number((v.entrega || {}).cobrada) || 0);
    const tx = taxas(D, v.canalId, v.formaId);
    const c = tx.canal; const f = tx.forma;
    const pedidos = Number(v.pedidos) || 0;
    const baseCanal = c.baseTaxa === 'produtos_entrega' ? produtos + entrega : produtos;
    const tCanal = r2(tx.pc * baseCanal + (Number(c.taxaFixaPedido) || 0) * pedidos);
    let tPag = 0, tAnt = 0;
    if (!tx.incluso) {
      tPag = r2(tx.pp * (produtos + entrega) + (Number(f.taxaFixa) || 0) * pedidos);
      tAnt = r2(tx.pa * (produtos + entrega - tPag));
    }
    const prevista = r2(tCanal + tPag + tAnt);
    const temEfetiva = v.taxasEfetivas !== null && v.taxasEfetivas !== undefined && v.taxasEfetivas !== '';
    const efetiva = temEfetiva ? r2(Number(v.taxasEfetivas)) : null;
    const usada = temEfetiva ? efetiva : prevista;
    const precisaPedidos = !temEfetiva && ((Number(c.taxaFixaPedido) || 0) > 0 || (!tx.incluso && (Number(f.taxaFixa) || 0) > 0)) && !(pedidos > 0);
    const ajusteRecebimento = r2(sum(v.recebimentos || [], rc => rc.encerrado ? (Number(rc.valor) || 0) - sum(rc.pagos, p => p.valor) : 0));
    const liquido = r2(produtos + entrega - usada);
    return { bruto, descontos, produtos, entrega, tCanal, tPag, tAnt, prevista, efetiva, taxas: r2(usada + ajusteRecebimento), ajusteRecebimento, liquido, prazo: tx.prazo, precisaPedidos, custoEntrega: r2(Number((v.entrega || {}).custo) || 0) };
  }

  // ---------- preparação das operações (congela custos e movimentos) ----------
  function erro(msg, extra) { return Object.assign({ ok: false, erro: msg }, extra || {}); }

  function prepararCompra(D, f) {
    const itens = [];
    for (const it of f.itens || []) {
      const ins = D.insumos[it.insumoId];
      if (!ins) return erro('Escolha o ingrediente/embalagem em todas as linhas.');
      const embs = Number(it.embs), embQtd = Number(it.embQtd), valor = r2(Number(it.valor));
      if (!(embs > 0) || !(embQtd > 0)) return erro(`Informe quantidade e tamanho da embalagem de ${ins.nome}.`);
      if (!(valor >= 0)) return erro(`Informe o valor pago em ${ins.nome}.`);
      const c = converter(embs * embQtd, it.embUnid || ins.unidade, ins);
      if (!c.ok) return erro(c.erro);
      itens.push({ insumoId: it.insumoId, embs, embQtd, embUnid: it.embUnid || ins.unidade, valor, lote: it.lote || '', validade: it.validade || null, qBase: r6(c.valor) });
    }
    if (!itens.length) return erro('Adicione pelo menos um item.');
    const extras = (f.extras || []).filter(e => Number(e.valor) > 0).map(e => ({ descricao: e.descricao || 'Despesa adicional', valor: r2(Number(e.valor)) }));
    const totExtras = r2(sum(extras, e => e.valor));
    const rateio = f.rateio || 'valor';
    let partes = itens.map(() => 0);
    if (totExtras > 0 && rateio !== 'separado') {
      if (rateio === 'quantidade') {
        const un = new Set(itens.map(i => D.insumos[i.insumoId].unidade));
        if (un.size > 1) return erro('Para dividir as despesas por quantidade, todos os itens precisam ter a mesma unidade (g, ml ou un). Use a divisão por valor ou lance a despesa separada.');
        const tq = sum(itens, i => i.qBase); partes = itens.map(i => totExtras * i.qBase / tq);
      } else {
        const tv = sum(itens, i => i.valor);
        partes = tv > 0 ? itens.map(i => totExtras * i.valor / tv) : itens.map(() => totExtras / itens.length);
      }
    }
    itens.forEach((it, i) => { it.extra = r2(partes[i]); it.custoTotal = r2(it.valor + partes[i]); it.custoUnit = it.qBase > 0 ? it.custoTotal / it.qBase : 0; });
    // acerto de centavos na última linha
    if (rateio !== 'separado' && totExtras > 0) { const dif = r2(totExtras - sum(itens, i => i.extra)); itens[itens.length - 1].extra = r2(itens[itens.length - 1].extra + dif); itens[itens.length - 1].custoTotal = r2(itens[itens.length - 1].custoTotal + dif); }
    const total = r2(sum(itens, i => i.valor) + totExtras);
    const parcelas = (f.parcelas || []).map(p => ({ id: p.id || L.uid('p'), venc: p.venc, valor: r2(Number(p.valor)), pagos: (p.pagos || []).map(x => ({ id: x.id || L.uid('g'), data: x.data, valor: r2(Number(x.valor)) })) }));
    if (!parcelas.length) return erro('Informe como a compra será paga.');
    if (parcelas.some(p => !p.venc || !(p.valor > 0))) return erro('Cada parcela precisa de vencimento e valor.');
    if (Math.abs(r2(sum(parcelas, p => p.valor)) - total) > 0.009) return erro(`As parcelas somam ${L.brl(sum(parcelas, p => p.valor))}, mas a compra totaliza ${L.brl(total)}.`);
    for (const p of parcelas) if (r2(sum(p.pagos, x => x.valor)) > p.valor + 0.009) return erro('Um pagamento ficou maior que a parcela.');
    const mov = f.recebidoEm ? itens.map(it => ({ alvo: 'ins', id: it.insumoId, q: it.qBase, v: it.custoTotal, lote: it.lote, validade: it.validade, data: f.recebidoEm })) : [];
    return { ok: true, op: { k: 'compra', data: f.data, fornecedor: f.fornecedor || '', recebidoEm: f.recebidoEm || null, itens, extras, rateio, totalExtras: totExtras, total, parcelas, obs: f.obs || '', mov } };
  }

  /** Consome insumos verificando o estoque válido na data. */
  function consumir(D, S, lista, data, criterio) {
    const faltas = []; const consumos = [];
    for (const c of lista) {
      if (!(c.qtd > EPS)) continue;
      const ins = D.insumos[c.insumoId];
      const disp = disponivelInsumo(S, c.insumoId, data);
      if (disp.valido + EPS < c.qtd) faltas.push({ insumoId: c.insumoId, nome: ins ? ins.nome : '?', precisa: c.qtd, tem: disp.valido, vencido: disp.vencido, unidade: ins ? ins.unidade : '' });
      const cu = custoBaseInsumo(D, S, c.insumoId, criterio || 'medio');
      consumos.push({ insumoId: c.insumoId, qtd: r6(c.qtd), custoUnit: cu.valor || 0, custo: r6((cu.valor || 0) * c.qtd) });
    }
    return { faltas, consumos };
  }
  function msgFaltas(D, faltas) {
    return 'Estoque insuficiente: ' + faltas.map(f => `${f.nome} (precisa ${L.nf(f.precisa)} ${f.unidade}, há ${L.nf(f.tem)} ${f.unidade} dentro da validade${f.vencido > EPS ? `, ${L.nf(f.vencido)} vencidos` : ''})`).join('; ') + '.';
  }
  function agregarKit(D, kitId, qtd, mapa) {
    const k = D.kits[kitId]; if (!k) return;
    for (const it of k.itens || []) mapa[it.insumoId] = (mapa[it.insumoId] || 0) + (Number(it.qtd) || 0) * qtd;
  }

  /** Produção de massa (ou produção direta já assada quando f.assar está preenchido). */
  function prepararProducao(D, S, f, id) {
    const rec = D.receitas[f.receitaId];
    if (!rec) return erro('Escolha a receita.');
    const ver = f.versao ? rec.versoes.find(x => x.v === f.versao) : ultimaVersao(rec);
    const mult = Number(f.mult) || 0;
    if (!(mult > 0)) return erro('Informe quantas receitas foram feitas (ex.: 1 ou 0,5).');
    const exp = expandirVersao(D, ver, mult);
    if (exp.erros.length) return erro(exp.erros.join(' '));
    const mapa = {}; exp.insumos.forEach(i => { mapa[i.insumoId] = (mapa[i.insumoId] || 0) + i.qtd; });
    const kitQ = Number(f.kitArmazQtd) || 0;
    const direto = !!(f.assar && f.assar.ativo);
    if (ver.kitArmazId && kitQ > 0 && !direto) agregarKit(D, ver.kitArmazId, kitQ, mapa);
    const lista = Object.entries(mapa).map(([insumoId, qtd]) => ({ insumoId, qtd }));
    const { faltas, consumos } = consumir(D, S, lista, f.data);
    if (faltas.length) return erro(msgFaltas(D, faltas), { faltas });
    const saidas = (f.saidas || []).filter(s => Number(s.unidades) > 0).map(s => ({ varianteId: s.varianteId, unidades: Math.round(Number(s.unidades)), pesoG: Number((D.variantes[s.varianteId] || {}).pesoG) || 0 }));
    if (!saidas.length) return erro('Informe o rendimento real (unidades boas) de pelo menos um item.');
    const materiais = sum(consumos, c => c.custo);
    const minutos = Number(f.minutos) || 0;
    const trabalho = minutos / 60 * (Number(D.cfg.valorHora) || 0);
    const rm = ratear(materiais, saidas, 'peso'); const rt = ratear(trabalho, saidas, 'peso');
    let energia = 0, usosForno = [], tAssar = 0, consumoForno = { kwh: 0, gas: 0 };
    let re = { partes: saidas.map(() => 0) }, rta = { partes: saidas.map(() => 0) };
    if (direto) {
      const fo = D.fornos[f.assar.fornoId];
      if (!fo) return erro('Escolha o forno usado.');
      const cf = custoForno(D, fo, (Number(f.assar.minForno) || 0) + (Number(f.assar.preaqMin) || 0));
      energia = cf.valor; consumoForno = { kwh: cf.kwh, gas: cf.gas };
      usosForno = [{ fornoId: fo.id, minutos: Number(f.assar.minForno) || 0, preaqMin: Number(f.assar.preaqMin) || 0, valor: r6(cf.valor), kwh: cf.kwh, gas: cf.gas, manual: cf.manual }];
      tAssar = (Number(f.assar.minAtivo) || 0) / 60 * (Number(D.cfg.valorHora) || 0);
      re = ratear(energia, saidas, D.cfg.criterioFornada); rta = ratear(tAssar, saidas, D.cfg.criterioFornada);
    }
    const validadeDias = f.validadeDias === '' || f.validadeDias === null || f.validadeDias === undefined ? null : Number(f.validadeDias);
    const lotes = saidas.map((s, i) => {
      const v = D.variantes[s.varianteId];
      const vAss = v && v.validadeAssadoDias !== null && v.validadeAssadoDias !== undefined && v.validadeAssadoDias !== '' ? Number(v.validadeAssadoDias) : null;
      return {
        key: id + ':' + i, varianteId: s.varianteId, unidades: s.unidades, pesoUnitG: s.pesoG || null,
        cu: { m: r6(rm.partes[i] / s.unidades), e: r6(re.partes[i] / s.unidades), t: r6((rt.partes[i] + rta.partes[i]) / s.unidades) },
        validade: direto ? (vAss !== null ? addDias(f.data, vAss) : null) : (validadeDias !== null ? addDias(f.data, validadeDias) : null),
      };
    });
    const estadoL = direto ? 'assado' : 'massa';
    const mov = consumos.map(c => ({ alvo: 'ins', id: c.insumoId, q: -c.qtd, v: c.custo }))
      .concat(lotes.map(l => ({ alvo: estadoL, key: l.key, cria: true, varianteId: l.varianteId, q: l.unidades, cu: l.cu, validade: l.validade, lote: f.lote || '', pesoUnitG: l.pesoUnitG })));
    const previsto = (ver.saidas || []).map(s => ({ varianteId: s.varianteId, unidades: (Number(s.unidades) || 0) * mult }));
    return {
      ok: true, op: {
        k: 'producao', data: f.data, receitaId: rec.id, versao: ver.v, mult, lote: f.lote || '', minutos,
        kitArmazQtd: direto ? 0 : kitQ, consumos, saidas, previsto, lotes, direto, usosForno, consumoForno,
        minAtivoAssar: direto ? Number(f.assar.minAtivo) || 0 : 0,
        custos: { materiais: r2(materiais), trabalho: r2(trabalho + tAssar), energia: r2(energia), total: r2(materiais + trabalho + tAssar + energia) },
        validadeDias, obs: f.obs || '', mov,
      },
    };
  }

  /** Fornada: retira porções de massa congelada e gera lotes assados ligados à origem. */
  function prepararFornada(D, S, f, id) {
    const usos = (f.usos || []).filter(u => u.fornoId);
    if (!usos.length) return erro('Informe o forno e o tempo de uso.');
    const linhas = (f.linhas || []).filter(l => l.key && Number(l.retiradas) > 0);
    if (!linhas.length) return erro('Escolha pelo menos um lote de massa e a quantidade retirada.');
    const usado = {};
    for (const l of linhas) {
      const lo = S.lotes[l.key];
      if (!lo || lo.estado !== 'massa') return erro('Lote de massa não encontrado.');
      const ret = Math.round(Number(l.retiradas)); const boas = Math.round(Number(l.boas));
      if (!(boas >= 0) || boas > ret) return erro('As unidades boas não podem passar das unidades retiradas.');
      if (vencido(lo, f.data)) return erro(`O lote ${lo.lote || ''} de ${nomeVariante(D, lo.varianteId)} venceu em ${L.fmtBR(lo.validade)}. Registre a perda em vez de assar.`);
      if (lo.data > f.data) return erro(`O lote de ${nomeVariante(D, lo.varianteId)} foi produzido depois da data da fornada.`);
      usado[l.key] = (usado[l.key] || 0) + ret;
      if (usado[l.key] > lo.saldo + EPS) return erro(`O lote de ${nomeVariante(D, lo.varianteId)} tem só ${L.nf(lo.saldo, 0)} porções.`);
    }
    let energia = 0; const usosOut = []; let kwh = 0, gas = 0, manual = false;
    for (const u of usos) {
      const fo = D.fornos[u.fornoId]; if (!fo) return erro('Forno não encontrado.');
      const cf = custoForno(D, fo, (Number(u.minutos) || 0) + (Number(u.preaqMin) || 0));
      energia += cf.valor; kwh += cf.kwh; gas += cf.gas; manual = manual || cf.manual;
      usosOut.push({ fornoId: fo.id, minutos: Number(u.minutos) || 0, preaqMin: Number(u.preaqMin) || 0, valor: r6(cf.valor), kwh: cf.kwh, gas: cf.gas, manual: cf.manual });
    }
    const vh = Number(D.cfg.valorHora) || 0;
    const minAtivo = Number(f.minAtivo) || 0;
    const trabalho = minAtivo / 60 * vh;
    const itens = linhas.map(l => { const lo = S.lotes[l.key]; return { lo, ret: Math.round(Number(l.retiradas)), boas: Math.round(Number(l.boas)), unidades: Math.round(Number(l.boas)), pesoG: lo.pesoUnitG || Number((D.variantes[lo.varianteId] || {}).pesoG) || 0 }; });
    if (!itens.some(i => i.boas > 0)) return erro('Nenhuma unidade boa informada. Para registrar só a perda, use “Registrar perda”.');
    const re = ratear(energia, itens, D.cfg.criterioFornada); const rt = ratear(trabalho, itens, D.cfg.criterioFornada);
    const lotes = []; const perdas = []; const mov = [];
    itens.forEach((it, i) => {
      const lo = it.lo; const v = D.variantes[lo.varianteId] || {};
      mov.push({ alvo: 'massa', key: lo.key, q: -it.ret });
      if (it.ret > it.boas) perdas.push({ varianteId: lo.varianteId, unidades: it.ret - it.boas, valor: r2((lo.cu.m + lo.cu.e + lo.cu.t) * (it.ret - it.boas)), m: r6(lo.cu.m * (it.ret - it.boas)), t: r6(lo.cu.t * (it.ret - it.boas)), origem: lo.key });
      if (it.boas > 0) {
        const vAss = v.validadeAssadoDias !== null && v.validadeAssadoDias !== undefined && v.validadeAssadoDias !== '' ? Number(v.validadeAssadoDias) : null;
        const cu = { m: r6(lo.cu.m), e: r6(lo.cu.e + re.partes[i] / it.boas), t: r6(lo.cu.t + rt.partes[i] / it.boas) };
        const key = id + ':' + i;
        lotes.push({ key, varianteId: lo.varianteId, unidades: it.boas, cu, validade: vAss !== null ? addDias(f.data, vAss) : null, origem: lo.key });
        mov.push({ alvo: 'assado', key, cria: true, varianteId: lo.varianteId, q: it.boas, cu, validade: vAss !== null ? addDias(f.data, vAss) : null, lote: f.lote || lo.lote || '', pesoUnitG: it.pesoG || null, origem: lo.key });
      }
    });
    return {
      ok: true, op: {
        k: 'fornada', data: f.data, lote: f.lote || '', usos: usosOut, linhas: itens.map(it => ({ key: it.lo.key, varianteId: it.lo.varianteId, retiradas: it.ret, boas: it.boas })),
        minAtivo, consumoForno: { kwh, gas }, manual, custos: { energia: r2(energia), trabalho: r2(trabalho) }, criterio: re.criterioUsado,
        lotes, perdas, obs: f.obs || '', mov,
      },
    };
  }

  /** Venda do dia: baixa assados (validade mais próxima primeiro) e embalagens de venda. */
  function prepararVenda(D, S, f) {
    if (!D.canais[f.canalId]) return erro('Escolha o canal de venda.');
    if (!D.formas[f.formaId]) return erro('Escolha a forma de pagamento.');
    const linhasIn = (f.linhas || []).filter(l => l.refId && Number(l.qtd) > 0);
    if (!linhasIn.length) return erro('Adicione pelo menos um item vendido com quantidade.');
    const saldo = {}; for (const l of Object.values(S.lotes)) if (l.estado === 'assado') saldo[l.key] = l.saldo;
    const emb = {}; const linhas = []; const mov = [];
    const vh = Number(D.cfg.valorHora) || 0;
    const alocar = (varianteId, qtd) => {
      const lotes = lotesDisponiveis(S, 'assado', varianteId, f.data).filter(l => !vencido(l, f.data));
      let falta = qtd; const al = [];
      for (const lo of lotes) {
        if (falta <= 0) break;
        const s = saldo[lo.key] || 0; if (s <= EPS) continue;
        const u = Math.min(s, falta); saldo[lo.key] = s - u; falta -= u;
        al.push({ key: lo.key, varianteId, unidades: u, cu: lo.cu });
      }
      return { al, falta };
    };
    for (const l of linhasIn) {
      const qtd = Math.round(Number(l.qtd));
      const preco = r2(Number(l.precoUnit));
      if (!(preco >= 0)) return erro('Informe o preço praticado de cada item.');
      const desconto = r2(Number(l.desconto) || 0);
      if (desconto < 0 || desconto > r2(preco * qtd)) return erro('O desconto não pode ser maior que o valor da linha.');
      const promo = l.promoId ? D.promocoes[l.promoId] : null;
      let comp = [];
      let kitMapa = {};
      if (l.tipo === 'c') {
        const c = D.combos[l.refId]; if (!c) return erro('Combo não encontrado.');
        if (c.tipo === 'livre') {
          const q = (Number((c.livre || {}).qtd) || 0) * qtd;
          comp = (l.composicao || []).filter(x => Number(x.qtd) > 0).map(x => ({ varianteId: x.varianteId, qtd: Math.round(Number(x.qtd)) }));
          const tot = sum(comp, x => x.qtd);
          if (tot !== q) return erro(`Combo ${c.nome}: a composição informada soma ${tot} unidades, mas ${qtd} combo(s) levam ${q}.`);
          const perm = (c.livre || {}).permitidas || [];
          if (comp.some(x => perm.length && !perm.includes(x.varianteId))) return erro(`Combo ${c.nome}: há sabor fora dos permitidos.`);
        } else comp = (c.itens || []).map(it => ({ varianteId: it.varianteId, qtd: (Number(it.qtd) || 0) * qtd }));
        const kitId = promo && promo.kitVendaId ? promo.kitVendaId : c.kitVendaId;
        if (kitId) agregarKit(D, kitId, qtd, kitMapa);
        if (c.usarEmbIndividual) comp.forEach(x => { const v = D.variantes[x.varianteId]; if (v && v.kitVendaId) agregarKit(D, v.kitVendaId, x.qtd, kitMapa); });
      } else {
        if (!D.variantes[l.refId]) return erro('Item não encontrado.');
        comp = [{ varianteId: l.refId, qtd }];
        const v = D.variantes[l.refId];
        const kitId = promo && promo.kitVendaId ? promo.kitVendaId : v.kitVendaId;
        if (kitId) agregarKit(D, kitId, qtd, kitMapa);
      }
      const alocs = [];
      for (const x of comp) {
        const r = alocar(x.varianteId, x.qtd);
        if (r.falta > 0) {
          const disp = sum(lotesDisponiveis(S, 'assado', x.varianteId, f.data).filter(lo => !vencido(lo, f.data)), lo => lo.saldo);
          return erro(`Não há ${nomeVariante(D, x.varianteId)} assado suficiente em ${L.fmtBR(f.data)}: faltam ${r.falta} (disponível ${L.nf(disp, 0)}). Registre a fornada antes da venda ou faça um ajuste documentado.`, { faltaAssado: { varianteId: x.varianteId, falta: r.falta } });
        }
        alocs.push(...r.al);
      }
      for (const [k, q] of Object.entries(kitMapa)) emb[k] = (emb[k] || 0) + q;
      const minEmb = sum(comp, x => ((D.variantes[x.varianteId] || {}).assar || {}).minEmbalagemUnid * x.qtd || 0);
      const custo = {
        m: r6(sum(alocs, a => a.cu.m * a.unidades)), e: r6(sum(alocs, a => a.cu.e * a.unidades)),
        t: r6(sum(alocs, a => a.cu.t * a.unidades) + minEmb / 60 * vh), emb: 0,
      };
      linhas.push({ id: l.id || L.uid('l'), tipo: l.tipo === 'c' ? 'c' : 'v', refId: l.refId, qtd, precoUnit: preco, desconto, promoId: l.promoId || null, composicao: comp, unidades: sum(comp, x => x.qtd), alocacoes: alocs.map(a => ({ key: a.key, varianteId: a.varianteId, unidades: a.unidades })), custo, _kit: kitMapa });
      alocs.forEach(a => mov.push({ alvo: 'assado', key: a.key, q: -a.unidades }));
    }
    const lista = Object.entries(emb).map(([insumoId, qtd]) => ({ insumoId, qtd }));
    const { faltas, consumos } = consumir(D, S, lista, f.data);
    if (faltas.length) return erro(msgFaltas(D, faltas) + ' (embalagens de venda)', { faltas });
    // custo das embalagens atribuído a cada linha
    const cuIns = {}; consumos.forEach(c => { cuIns[c.insumoId] = c.custoUnit; });
    for (const ln of linhas) { ln.custo.emb = r6(sum(Object.entries(ln._kit), ([id, q]) => (cuIns[id] || 0) * q)); ln.custo.m = r6(ln.custo.m + ln.custo.emb); delete ln._kit; }
    consumos.forEach(c => mov.push({ alvo: 'ins', id: c.insumoId, q: -c.qtd, v: c.custo }));
    const op = {
      k: 'venda', data: f.data, canalId: f.canalId, formaId: f.formaId, pedidos: Number(f.pedidos) || 0,
      linhas, entrega: { cobrada: r2(Number((f.entrega || {}).cobrada) || 0), custo: r2(Number((f.entrega || {}).custo) || 0) },
      taxasEfetivas: f.taxasEfetivas === '' || f.taxasEfetivas === null || f.taxasEfetivas === undefined ? null : r2(Number(f.taxasEfetivas)),
      embalagens: consumos, obs: f.obs || '', mov,
    };
    const cv = calcVenda(D, op);
    if (cv.precisaPedidos) return erro('Há taxa fixa por pedido neste canal/forma de pagamento. Informe quantos pedidos houve (a contagem do dia) ou o total de taxas efetivamente cobrado.');
    if (cv.liquido < 0) return erro('As taxas ficaram maiores que o valor vendido. Confira os valores.');
    let rec = (f.recebimentos || []).filter(r => Number(r.valor) > 0).map(r => ({ id: r.id || L.uid('r'), data: r.data, valor: r2(Number(r.valor)), pagos: (r.pagos || []).map(p => ({ id: p.id || L.uid('g'), data: p.data, valor: r2(Number(p.valor)) })), encerrado: !!r.encerrado }));
    if (!rec.length) rec = [{ id: L.uid('r'), data: addDias(f.data, cv.prazo), valor: cv.liquido, pagos: f.recebidoNaHora ? [{ id: L.uid('g'), data: f.data, valor: cv.liquido }] : [], encerrado: false }];
    if (Math.abs(r2(sum(rec, r => r.valor)) - cv.liquido) > 0.009) return erro(`Os recebimentos previstos somam ${L.brl(sum(rec, r => r.valor))}, mas o líquido da venda é ${L.brl(cv.liquido)}.`);
    op.recebimentos = rec;
    op.resumo = cv;
    return { ok: true, op };
  }

  function prepararPerda(D, S, f) {
    const qtd = Number(f.qtd);
    if (!(qtd > 0)) return erro('Informe a quantidade perdida.');
    if (!f.motivo) return erro('Informe o motivo da perda.');
    if (f.alvo === 'ins') {
      const ins = D.insumos[f.insumoId]; if (!ins) return erro('Escolha o ingrediente/embalagem.');
      const st = S.ins[f.insumoId] || { qtd: 0 };
      if (st.qtd + EPS < qtd) return erro(`Há só ${L.nf(st.qtd)} ${ins.unidade} de ${ins.nome} no estoque.`);
      const cu = custoBaseInsumo(D, S, f.insumoId, 'medio').valor || 0;
      return { ok: true, op: { k: 'perda', data: f.data, alvo: 'ins', insumoId: f.insumoId, loteRef: f.loteRef || null, qtd, motivo: f.motivo, valor: r2(cu * qtd), custo: { m: r6(cu * qtd), e: 0, t: 0 }, obs: f.obs || '', mov: [{ alvo: 'ins', id: f.insumoId, q: -qtd, v: r6(cu * qtd), loteRef: f.loteRef || null }] } };
    }
    const lo = S.lotes[f.key];
    if (!lo) return erro('Escolha o lote.');
    const q = Math.round(qtd);
    if (lo.saldo + EPS < q) return erro(`O lote tem só ${L.nf(lo.saldo, 0)} unidades.`);
    const c = { m: r6(lo.cu.m * q), e: r6(lo.cu.e * q), t: r6(lo.cu.t * q) };
    return { ok: true, op: { k: 'perda', data: f.data, alvo: lo.estado, key: lo.key, varianteId: lo.varianteId, qtd: q, motivo: f.motivo, valor: r2(c.m + c.e + c.t), custo: c, obs: f.obs || '', mov: [{ alvo: lo.estado, key: lo.key, q: -q }] } };
  }

  function prepararAjuste(D, S, f) {
    const delta = Number(f.delta);
    if (!delta) return erro('Informe a diferença (positiva para entrada, negativa para saída).');
    if (!f.motivo || String(f.motivo).trim().length < 3) return erro('Descreva o motivo do ajuste (fica no histórico).');
    if (f.alvo === 'ins') {
      const ins = D.insumos[f.insumoId]; if (!ins) return erro('Escolha o ingrediente/embalagem.');
      const st = S.ins[f.insumoId] || { qtd: 0 };
      if (delta < 0 && st.qtd + delta < -EPS) return erro(`O estoque de ${ins.nome} ficaria negativo.`);
      const cuInf = Number(f.custoUnit);
      const cu = delta > 0 && cuInf >= 0 && f.custoUnit !== '' && f.custoUnit !== undefined && f.custoUnit !== null ? cuInf : (custoBaseInsumo(D, S, f.insumoId, 'medio').valor || 0);
      const v = r6(cu * Math.abs(delta));
      return { ok: true, op: { k: 'ajuste', data: f.data, alvo: 'ins', insumoId: f.insumoId, delta, motivo: f.motivo, valor: r2(delta > 0 ? v : -v), custo: { m: delta > 0 ? v : -v, e: 0, t: 0 }, mov: [{ alvo: 'ins', id: f.insumoId, q: delta, v, lote: f.lote || '', validade: f.validade || null }] } };
    }
    const lo = S.lotes[f.key]; if (!lo) return erro('Escolha o lote.');
    const d = Math.round(delta);
    if (lo.saldo + d < -EPS) return erro('O lote ficaria negativo.');
    const s = Math.sign(d), a = Math.abs(d);
    const c = { m: r6(s * lo.cu.m * a), e: r6(s * lo.cu.e * a), t: r6(s * lo.cu.t * a) };
    return { ok: true, op: { k: 'ajuste', data: f.data, alvo: lo.estado, key: lo.key, varianteId: lo.varianteId, delta: d, motivo: f.motivo, valor: r2(c.m + c.e + c.t), custo: c, mov: [{ alvo: lo.estado, key: lo.key, q: d }] } };
  }

  function prepararLancamento(D, f) {
    const nat = f.natureza;
    if (!['despesa', 'receita', 'aporte', 'retirada', 'investimento'].includes(nat)) return erro('Escolha o tipo de lançamento.');
    if (!f.descricao) return erro('Descreva o lançamento.');
    const parcelas = (f.parcelas || []).map(p => ({ id: p.id || L.uid('p'), venc: p.venc, valor: r2(Number(p.valor)), pagos: (p.pagos || []).map(x => ({ id: x.id || L.uid('g'), data: x.data, valor: r2(Number(x.valor)) })) }));
    const origem = nat === 'investimento' ? (f.origem || 'caixa') : 'caixa';
    if (origem === 'caixa') {
      if (!parcelas.length) return erro('Informe valor e vencimento.');
      if (parcelas.some(p => !p.venc || !(p.valor > 0))) return erro('Cada parcela precisa de vencimento e valor maior que zero.');
      for (const p of parcelas) if (r2(sum(p.pagos, x => x.valor)) > p.valor + 0.009) return erro('Um pagamento ficou maior que a parcela.');
    }
    const valorProp = r2(Number(f.valorProprietaria) || 0);
    if (origem === 'proprietaria' && !(valorProp > 0)) return erro('Informe o valor do bem trazido pela proprietária.');
    const total = origem === 'proprietaria' ? valorProp : r2(sum(parcelas, p => p.valor));
    return {
      ok: true, op: {
        k: 'lanc', natureza: nat, data: f.competencia || f.data, competencia: f.competencia || f.data, categoria: nat === 'despesa' ? (f.categoria || 'outras') : (f.categoria || ''),
        descricao: f.descricao, parcelas: origem === 'proprietaria' ? [] : parcelas, total, origem,
        vidaUtilMeses: nat === 'investimento' ? (Number(f.vidaUtilMeses) || null) : null,
        tipoInvestimento: nat === 'investimento' ? (f.tipoInvestimento || 'equipamento') : null,
        recorrenciaId: f.recorrenciaId || null, mesRef: f.mesRef || null, obs: f.obs || '', mov: [],
      },
    };
  }

  // ---------- financeiro ----------
  /** Todos os eventos de caixa (dinheiro que entrou ou saiu) e as pendências. */
  function fluxo(D) {
    const caixa = []; const pend = [];
    const cfg = D.cfg;
    if (Number(cfg.saldoInicial)) caixa.push({ data: cfg.inicio || '2000-01-01', valor: r2(cfg.saldoInicial), tipo: 'saldo', desc: 'Saldo inicial', grupo: cfg.saldoInicialEhAporte ? 'aporte' : 'saldo' });
    for (const op of opsAtivas(D)) {
      if (op.k === 'compra') {
        for (const p of op.parcelas || []) {
          for (const g of p.pagos || []) caixa.push({ data: g.data, valor: -g.valor, tipo: 'compra', desc: 'Compra ' + (op.fornecedor || ''), op: op.id, grupo: 'operacional' });
          const rest = r2(p.valor - sum(p.pagos, g => g.valor));
          if (rest > 0.004) pend.push({ lado: 'pagar', venc: p.venc, valor: rest, total: p.valor, desc: 'Compra ' + (op.fornecedor || '') + ' (' + L.fmtBR(op.data) + ')', op: op.id, parcela: p.id, k: 'compra' });
        }
      } else if (op.k === 'venda') {
        const canal = (D.canais[op.canalId] || {}).nome || 'Venda';
        for (const r of op.recebimentos || []) {
          for (const g of r.pagos || []) caixa.push({ data: g.data, valor: g.valor, tipo: 'venda', desc: 'Recebimento ' + canal, op: op.id, grupo: 'operacional' });
          const rest = r2(r.valor - sum(r.pagos, g => g.valor));
          if (!r.encerrado && rest > 0.004) pend.push({ lado: 'receber', venc: r.data, valor: rest, total: r.valor, desc: 'Vendas ' + canal + ' de ' + L.fmtBR(op.data), op: op.id, parcela: r.id, k: 'venda' });
        }
        const ce = Number((op.entrega || {}).custo) || 0;
        if (ce > 0) caixa.push({ data: op.data, valor: -ce, tipo: 'entrega', desc: 'Custo de entrega própria', op: op.id, grupo: 'operacional' });
      } else if (op.k === 'lanc') {
        if (op.origem === 'proprietaria') continue; // bem trazido pela proprietária: não passa pelo caixa
        const sinal = op.natureza === 'receita' || op.natureza === 'aporte' ? 1 : -1;
        const grupo = op.natureza === 'aporte' ? 'aporte' : op.natureza === 'retirada' ? 'retirada' : op.natureza === 'investimento' ? 'investimento' : 'operacional';
        for (const p of op.parcelas || []) {
          for (const g of p.pagos || []) caixa.push({ data: g.data, valor: sinal * g.valor, tipo: op.natureza, desc: op.descricao, op: op.id, grupo, categoria: op.categoria });
          const rest = r2(p.valor - sum(p.pagos, g => g.valor));
          if (rest > 0.004) pend.push({ lado: sinal > 0 ? 'receber' : 'pagar', venc: p.venc, valor: rest, total: p.valor, desc: op.descricao, op: op.id, parcela: p.id, k: 'lanc', natureza: op.natureza });
        }
      }
    }
    caixa.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    pend.sort((a, b) => (a.venc < b.venc ? -1 : 1));
    return { caixa, pend };
  }
  function saldoCaixa(D, ate) { return r2(sum(fluxo(D).caixa.filter(c => !ate || c.data <= ate), c => c.valor)); }

  /** Recorrências que ainda não viraram lançamento no mês. */
  function recorrenciasPendentes(D, ym) {
    const out = [];
    for (const r of ativos(D.recorrencias)) {
      if (r.ativa === false) continue;
      if (r.inicio && ym < r.inicio) continue;
      if (r.fim && ym > r.fim) continue;
      const iv = Math.max(1, Number(r.intervaloMeses) || 1);
      if (r.inicio) { const [y1, m1] = r.inicio.split('-').map(Number); const [y2, m2] = ym.split('-').map(Number); if (((y2 - y1) * 12 + (m2 - m1)) % iv !== 0) continue; }
      const id = 'rec-' + r.id + '-' + ym.replace('-', '');
      const existe = D.ops[id];
      if (existe) continue;
      const dia = Math.min(Number(r.dia) || 1, diasNoMes(ym));
      out.push({ recorrenciaId: r.id, id, venc: ym + '-' + String(dia).padStart(2, '0'), valor: r2(Number(r.valor) || 0), descricao: r.descricao, categoria: r.categoria, natureza: r.natureza || 'despesa' });
    }
    return out;
  }
  /** Despesas fixas de um mês: lançadas + recorrências ainda não lançadas. Energia/gás ficam de fora (já estão no custo do produto). */
  function despesasFixasMes(D, ym) {
    const itens = []; const excluidas = [];
    const esp = id => (catDespesa(D, id).especial || null);
    for (const op of opsAtivas(D)) {
      if (op.k !== 'lanc' || op.natureza !== 'despesa' || mesDe(op.competencia) !== ym) continue;
      const it = { descricao: op.descricao, categoria: op.categoria, valor: op.total, lancado: true };
      (esp(op.categoria) === 'energia' || esp(op.categoria) === 'gas' ? excluidas : itens).push(it);
    }
    for (const r of recorrenciasPendentes(D, ym)) {
      if (r.natureza !== 'despesa') continue;
      const it = { descricao: r.descricao, categoria: r.categoria, valor: r.valor, lancado: false };
      (esp(r.categoria) === 'energia' || esp(r.categoria) === 'gas' ? excluidas : itens).push(it);
    }
    return { itens, excluidas, total: r2(sum(itens, i => i.valor)) };
  }
  /** Previsão de caixa mês a mês. */
  function previsao(D, hojeStr, meses) {
    const { pend } = fluxo(D);
    let saldo = saldoCaixa(D, hojeStr);
    const out = [];
    const ym0 = mesDe(hojeStr);
    for (let i = 0; i < meses; i++) {
      const ym = addMesYM(ym0, i);
      const doMes = pend.filter(p => (i === 0 ? mesDe(p.venc) <= ym : mesDe(p.venc) === ym));
      const entra = r2(sum(doMes.filter(p => p.lado === 'receber'), p => p.valor));
      let sai = r2(sum(doMes.filter(p => p.lado === 'pagar'), p => p.valor));
      const recs = recorrenciasPendentes(D, ym);
      const recSai = r2(sum(recs.filter(r => r.natureza !== 'receita'), r => r.valor));
      const recEnt = r2(sum(recs.filter(r => r.natureza === 'receita'), r => r.valor));
      saldo = r2(saldo + entra + recEnt - sai - recSai);
      out.push({ ym, entra: r2(entra + recEnt), sai: r2(sai + recSai), recorrencias: recSai, saldo, atrasadosIncluidos: i === 0 });
    }
    return out;
  }

  // ---------- resultado por competência ----------
  function filtraLinha(D, ln, f) {
    if (!f) return true;
    const vars = ln.tipo === 'c' ? (ln.composicao || []).map(x => x.varianteId) : [ln.refId];
    const vs = vars.map(id => D.variantes[id]).filter(Boolean);
    if (f.produtoId && !vs.some(v => v.produtoId === f.produtoId)) return false;
    if (f.sabor && !vs.some(v => v.sabor === f.sabor)) return false;
    if (f.tamanho && !vs.some(v => v.tamanho === f.tamanho)) return false;
    if (f.categoria && !vs.some(v => ((D.produtos[v.produtoId] || {}).categoria) === f.categoria)) return false;
    if (f.tipo && ln.tipo !== f.tipo) return false;
    return true;
  }
  function resultado(D, de, ate, filtros) {
    filtros = filtros || {};
    const temFiltroProduto = !!(filtros.produtoId || filtros.sabor || filtros.tamanho || filtros.categoria || filtros.tipo);
    const R = {
      bruto: 0, descontos: 0, produtos: 0, entregaCobrada: 0, taxas: 0, taxasPrevistas: 0, vendasLiquidas: 0,
      cmvM: 0, cmvE: 0, cmvT: 0, perdasM: 0, perdasE: 0, perdasT: 0, ajustes: 0, custoEntrega: 0,
      despesas: {}, despesasTotal: 0, energiaReal: 0, gasReal: 0, energiaEstimada: 0, prolabore: 0,
      depreciacao: 0, impostos: 0, unidadesVendidas: 0, combosVendidos: 0, linhas: [], kwh: 0, gas: 0,
      energiaProduzida: 0,
    };
    const dentro = d => d >= de && d <= ate;
    for (const op of opsAtivas(D)) {
      if (op.k === 'venda' && dentro(op.data) && (!filtros.canalId || op.canalId === filtros.canalId)) {
        const cv = calcVenda(D, op);
        const totLinhas = sum(op.linhas, l => l.qtd * l.precoUnit - (l.desconto || 0));
        for (const ln of op.linhas) {
          if (!filtraLinha(D, ln, filtros)) continue;
          const rec = r2(ln.qtd * ln.precoUnit - (ln.desconto || 0));
          const share = totLinhas > 0 ? rec / totLinhas : 0;
          const tx = r2(cv.taxas * share);
          R.bruto += ln.qtd * ln.precoUnit; R.descontos += ln.desconto || 0;
          R.taxas += tx; R.taxasPrevistas += cv.prevista * share;
          R.cmvM += ln.custo.m; R.cmvE += ln.custo.e; R.cmvT += ln.custo.t;
          R.unidadesVendidas += ln.unidades || 0; if (ln.tipo === 'c') R.combosVendidos += ln.qtd;
          R.linhas.push({ data: op.data, op: op.id, canalId: op.canalId, formaId: op.formaId, ln, receita: rec, taxas: tx, custo: ln.custo });
        }
        if (!temFiltroProduto) { R.entregaCobrada += cv.entrega; R.custoEntrega += cv.custoEntrega; }
      }
      if (op.k === 'perda' && dentro(op.data)) { R.perdasM += op.custo.m; R.perdasE += op.custo.e; R.perdasT += op.custo.t; }
      if (op.k === 'fornada' && dentro(op.data)) {
        for (const p of op.perdas || []) { R.perdasM += p.m || 0; R.perdasT += p.t || 0; }
        R.kwh += (op.consumoForno || {}).kwh || 0; R.gas += (op.consumoForno || {}).gas || 0; R.energiaProduzida += op.custos.energia || 0;
      }
      if (op.k === 'producao' && dentro(op.data) && op.direto) { R.kwh += (op.consumoForno || {}).kwh || 0; R.gas += (op.consumoForno || {}).gas || 0; R.energiaProduzida += op.custos.energia || 0; }
      if (op.k === 'ajuste' && dentro(op.data)) R.ajustes += (op.custo.m || 0) + (op.custo.e || 0); // trabalho estimado fica fora
      if (op.k === 'compra' && dentro(op.data) && op.rateio === 'separado' && op.totalExtras > 0) {
        R.despesas.frete = (R.despesas.frete || 0) + op.totalExtras;
      }
      if (op.k === 'lanc' && op.natureza === 'despesa' && dentro(op.competencia)) {
        const esp = catDespesa(D, op.categoria).especial;
        if (esp === 'energia') R.energiaReal += op.total;
        else if (esp === 'gas') R.gasReal += op.total;
        else { R.despesas[op.categoria] = (R.despesas[op.categoria] || 0) + op.total; if (esp === 'prolabore') R.prolabore += op.total; }
      }
      if (op.k === 'lanc' && op.natureza === 'receita' && dentro(op.competencia) && !temFiltroProduto) {
        R.outrasReceitas = (R.outrasReceitas || 0) + op.total;
      }
      if (op.k === 'lanc' && op.natureza === 'investimento' && D.cfg.depreciacaoAtiva && op.vidaUtilMeses > 0) {
        // depreciação linear mensal a partir do mês da compra
        const m0 = mesDe(op.competencia);
        let ym = mesDe(de);
        while (ym <= mesDe(ate)) {
          const n = (Number(ym.slice(0, 4)) - Number(m0.slice(0, 4))) * 12 + Number(ym.slice(5)) - Number(m0.slice(5));
          if (n >= 0 && n < op.vidaUtilMeses) R.depreciacao += op.total / op.vidaUtilMeses;
          ym = addMesYM(ym, 1);
        }
      }
    }
    R.produtos = r2(R.bruto - R.descontos);
    for (const imp of D.cfg.impostos || []) if (Number(imp.pct) > 0) R.impostos += R.produtos * Number(imp.pct) / 100;
    R.vendasLiquidas = r2(R.produtos + R.entregaCobrada - R.taxas);
    R.despesasTotal = r2(sum(Object.values(R.despesas)));
    // energia/gás: usa a conta real lançada (parte da confeitaria) quando existir no período; senão, a estimativa.
    R.energiaEstimada = R.cmvE + R.perdasE;
    R.usaEnergiaReal = (R.energiaReal + R.gasReal) > 0;
    R.energiaNoResultado = R.usaEnergiaReal ? R.energiaReal + R.gasReal : R.energiaEstimada;
    R.cmvMateriais = r2(R.cmvM); R.perdasMateriais = r2(R.perdasM);
    // contribuição: vendas líquidas − materiais/embalagens − energia estimada dos vendidos − custo de entrega
    R.contribuicao = r2(R.vendasLiquidas - R.cmvM - R.cmvE - R.custoEntrega - R.impostos);
    // ajustes negativos (faltas) reduzem; positivos (sobras encontradas) aumentam
    R.resultado = r2(R.vendasLiquidas + (R.outrasReceitas || 0) - R.cmvM - R.perdasM + R.ajustes - R.energiaNoResultado - R.custoEntrega - R.despesasTotal - R.depreciacao - R.impostos);
    R.trabalhoEstimado = r2(R.cmvT + R.perdasT);
    return R;
  }

  // ---------- metas ----------
  function diaDeVenda(D, d) {
    const cal = D.cal || {};
    if ((cal.folgas || {})[d]) return false;
    if ((cal.diasSemanaFolga || []).includes(diaSemana(d))) return false;
    return true;
  }
  function faturamentoProdutos(D, de, ate) {
    let t = 0;
    for (const op of opsAtivas(D)) if (op.k === 'venda' && op.data >= de && op.data <= ate) t += sum(op.linhas, l => l.qtd * l.precoUnit - (l.desconto || 0));
    return r2(t);
  }
  function metaInfo(D, ym, hojeStr) {
    const meta = Number(((D.cal || {}).metas || {})[ym]) || 0;
    const ini = ym + '-01'; const fim = ym + '-' + String(diasNoMes(ym)).padStart(2, '0');
    const realizado = faturamentoProdutos(D, ini, fim);
    const dias = []; for (let d = 1; d <= diasNoMes(ym); d++) dias.push(ym + '-' + String(d).padStart(2, '0'));
    const diasVenda = dias.filter(d => diaDeVenda(D, d));
    const out = { ym, meta, realizado, pctAlcancado: meta > 0 ? realizado / meta : 0, restante: r2(Math.max(0, meta - realizado)), atingida: meta > 0 && realizado >= meta, diasVendaMes: diasVenda.length };
    const mesAtual = mesDe(hojeStr) === ym;
    const futuro = ym > mesDe(hojeStr);
    let restantes = futuro ? diasVenda : mesAtual ? diasVenda.filter(d => d >= hojeStr) : [];
    out.diasRestantes = restantes.length;
    out.hojeEhDiaDeVenda = mesAtual && diaDeVenda(D, hojeStr);
    if (mesAtual) {
      const ateOntem = faturamentoProdutos(D, ini, addDias(hojeStr, -1));
      const hojeV = faturamentoProdutos(D, hojeStr, hojeStr);
      out.vendasHoje = hojeV;
      const faltaInicioDia = Math.max(0, meta - ateOntem);
      if (out.hojeEhDiaDeVenda && restantes.length > 0) {
        out.metaHoje = r2(faltaInicioDia / restantes.length);
        out.faltaHoje = r2(Math.max(0, out.metaHoje - hojeV));
      } else { out.metaHoje = 0; out.faltaHoje = 0; }
      const depoisDeHoje = restantes.filter(d => d > hojeStr).length;
      out.porDiaDepois = depoisDeHoje > 0 ? r2(out.restante / depoisDeHoje) : null;
      out.diasDepoisDeHoje = depoisDeHoje;
    } else if (futuro) {
      out.metaHoje = null; out.porDiaDepois = restantes.length ? r2(meta / restantes.length) : null;
    }
    out.semDias = meta > 0 && !out.atingida && restantes.length === 0;
    out.porDia = restantes.length ? r2(out.restante / restantes.length) : null;
    return out;
  }
  /** Converte um valor em reais em quantidades estimadas, pela mistura planejada ou item único. */
  function traduzirValor(D, S, valor, mix) {
    const itens = (mix || []).map(m => {
      const preco = Number(((m.tipo === 'c' ? D.combos[m.id] : D.variantes[m.id]) || {}).precos ? ((m.tipo === 'c' ? D.combos[m.id] : D.variantes[m.id]).precos[m.canalId]) : 0) || 0;
      return Object.assign({}, m, { preco, peso: Number(m.peso) || 0 });
    }).filter(m => m.peso > 0);
    const totPeso = sum(itens, i => i.peso);
    if (!itens.length || !(totPeso > 0)) return { ok: false, erro: 'Monte a mistura planejada de vendas (itens, canal e participação).' };
    if (itens.some(i => !(i.preco > 0))) return { ok: false, erro: 'Algum item da mistura está sem preço no canal escolhido.' };
    const precoMedio = sum(itens, i => i.preco * i.peso) / totPeso;
    const totalUnidades = valor > 0 ? valor / precoMedio : 0;
    return {
      ok: true, precoMedio,
      itens: itens.map(i => ({ ...i, nome: nomeItem(D, i.tipo, i.id), canal: (D.canais[i.canalId] || {}).nome, qtd: valor > 0 ? Math.ceil(totalUnidades * i.peso / totPeso) : 0 })),
    };
  }
  /** Contribuição média por venda da mistura (sem o valor estimado do trabalho). */
  function contribuicaoMix(D, S, mix, criterio) {
    const itens = (mix || []).filter(m => Number(m.peso) > 0);
    if (!itens.length) return { ok: false, erro: 'Monte a mistura planejada de vendas.' };
    let tot = 0, totP = 0; const det = [];
    for (const m of itens) {
      const ent = m.tipo === 'c' ? D.combos[m.id] : D.variantes[m.id];
      const preco = ent && ent.precos ? Number(ent.precos[m.canalId]) || 0 : 0;
      if (!(preco > 0)) return { ok: false, erro: 'Algum item da mistura está sem preço no canal.' };
      const c = m.tipo === 'c' ? custoCombo(D, S, m.id, criterio) : custoVariante(D, S, m.id, criterio);
      const custoDin = m.tipo === 'c' ? c.m + c.e : c.m + c.e;
      const canal = D.canais[m.canalId] || {};
      const tx = taxas(D, m.canalId, canal.formaPadraoId);
      const a = analisarPreco(preco, custoDin, tx, D.cfg.itensPorPedido, 0);
      det.push({ nome: nomeItem(D, m.tipo, m.id), preco, contrib: a.contribuicao, peso: Number(m.peso) });
      tot += a.contribuicao * Number(m.peso); totP += Number(m.peso);
    }
    return { ok: true, porVenda: tot / totP, det };
  }

  // ---------- alertas ----------
  function alertas(D, S, hojeStr) {
    const out = [];
    const cfg = D.cfg;
    const mi = metaInfo(D, mesDe(hojeStr), hojeStr);
    if (mi.meta > 0) {
      if (mi.atingida) out.push({ nivel: 'ok', area: 'metas', txt: `Meta de ${L.nomeMes(mi.ym)} atingida: ${L.brl(mi.realizado)} de ${L.brl(mi.meta)}.` });
      else if (mi.semDias) out.push({ nivel: 'alto', area: 'metas', txt: `Não há mais dias de venda em ${L.nomeMes(mi.ym)} e faltam ${L.brl(mi.restante)} para a meta.` });
      else if (mi.hojeEhDiaDeVenda && mi.faltaHoje > 0) out.push({ nivel: 'medio', area: 'metas', txt: `Faltam ${L.brl(mi.faltaHoje)} em vendas hoje para seguir no ritmo da meta.` });
    }
    const { pend } = fluxo(D);
    for (const p of pend) {
      const d = diffDias(hojeStr, p.venc);
      if (d < 0) out.push({ nivel: 'alto', area: 'financeiro', txt: `${p.lado === 'pagar' ? 'Conta atrasada' : 'Recebimento atrasado'}: ${p.desc} — ${L.brl(p.valor)}, venceu em ${L.fmtBR(p.venc)}.` });
      else if (d <= (Number(cfg.alertaDiasContas) || 0)) out.push({ nivel: 'medio', area: 'financeiro', txt: `${p.lado === 'pagar' ? 'Conta a pagar' : 'A receber'} ${d === 0 ? 'hoje' : 'em ' + d + ' dia(s)'}: ${p.desc} — ${L.brl(p.valor)}.` });
    }
    for (const ins of ativos(D.insumos)) {
      const st = S.ins[ins.id];
      const q = st ? st.qtd : 0;
      if (Number(ins.estoqueMin) > 0 && q < Number(ins.estoqueMin)) out.push({ nivel: 'medio', area: 'estoque', txt: `Estoque baixo: ${ins.nome} — ${L.nf(q)} ${ins.unidade} (mínimo ${L.nf(ins.estoqueMin)}).` });
      if (st) for (const l of st.lotes) if (l.saldo > EPS && l.validade) {
        const d = diffDias(hojeStr, l.validade);
        if (d < 0) out.push({ nivel: 'alto', area: 'estoque', txt: `${ins.nome}: lote ${l.lote || ''} vencido em ${L.fmtBR(l.validade)} (${L.nf(l.saldo)} ${ins.unidade}).` });
        else if (d <= (Number(cfg.alertaDiasLotes) || 0)) out.push({ nivel: 'medio', area: 'estoque', txt: `${ins.nome}: lote ${l.lote || ''} vence em ${L.fmtBR(l.validade)}.` });
      }
    }
    for (const l of Object.values(S.lotes)) {
      if (l.saldo <= EPS || !l.validade) continue;
      const d = diffDias(hojeStr, l.validade);
      const nome = `${l.estado === 'massa' ? 'Massa' : 'Assado'} ${nomeVariante(D, l.varianteId)}${l.lote ? ' (lote ' + l.lote + ')' : ''}`;
      if (d < 0) out.push({ nivel: 'alto', area: 'estoque', txt: `${nome}: ${L.nf(l.saldo, 0)} un. vencidas desde ${L.fmtBR(l.validade)}. Registre a perda.` });
      else if (d <= (Number(cfg.alertaDiasLotes) || 0)) out.push({ nivel: 'medio', area: 'estoque', txt: `${nome}: ${L.nf(l.saldo, 0)} un. vencem em ${L.fmtBR(l.validade)}.` });
    }
    for (const v of ativos(D.variantes)) {
      if (Number(v.estoqueMin) > 0) {
        const tot = sum(Object.values(S.lotes).filter(l => l.varianteId === v.id && l.saldo > 0 && !vencido(l, hojeStr)), l => l.saldo);
        if (tot < Number(v.estoqueMin)) out.push({ nivel: 'medio', area: 'estoque', txt: `${nomeVariante(D, v.id)}: ${L.nf(tot, 0)} un. entre massa e assados (mínimo ${v.estoqueMin}).` });
      }
    }
    // margem abaixo da desejada
    const margem = (Number(cfg.margemDesejada) || 0) / 100;
    if (margem > 0) {
      for (const v of ativos(D.variantes)) {
        const p = D.produtos[v.produtoId]; if (p && p.arquivado) continue;
        let custo = null;
        for (const [canalId, preco] of Object.entries(v.precos || {})) {
          const canal = D.canais[canalId]; if (!canal || canal.arquivado || !(Number(preco) > 0)) continue;
          if (!custo) custo = custoVariante(D, S, v.id, 'medio');
          if (!(custo.total > 0)) break;
          const a = analisarPreco(Number(preco), custo.total, taxas(D, canalId, canal.formaPadraoId), cfg.itensPorPedido, 0);
          if (a.margemContrib < margem - 1e-9) out.push({ nivel: a.contribuicao < 0 ? 'alto' : 'medio', area: 'precos', txt: `${nomeVariante(D, v.id)} no ${canal.nome}: margem de ${L.pct(a.margemContrib)} (desejada ${L.pct(margem)})${a.contribuicao < 0 ? ' — preço abaixo do custo' : ''}.` });
        }
      }
    }
    const ordem = { alto: 0, medio: 1, ok: 2 };
    return out.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
  }

  // ---------- recuperação do investimento ----------
  function recuperacao(D, hojeStr) {
    const { caixa } = fluxo(D);
    let investido = 0, aportes = 0, emBens = 0, devolvido = 0, reinvestido = 0, operacional = 0;
    if (D.cfg.saldoInicialEhAporte && Number(D.cfg.saldoInicial) > 0) investido += Number(D.cfg.saldoInicial);
    for (const op of opsAtivas(D)) {
      if (op.k !== 'lanc') continue;
      if (op.natureza === 'aporte') { const pago = sum(op.parcelas, p => sum(p.pagos, g => g.valor)); aportes += pago; }
      if (op.natureza === 'investimento' && op.origem === 'proprietaria') emBens += op.total;
    }
    investido += aportes + emBens;
    const porMes = {};
    for (const c of caixa) {
      if (c.data > hojeStr) continue;
      if (c.grupo === 'retirada') devolvido += -c.valor;
      if (c.grupo === 'investimento') reinvestido += -c.valor;
      if (c.grupo === 'operacional') { operacional += c.valor; const ym = mesDe(c.data); porMes[ym] = (porMes[ym] || 0) + c.valor; }
    }
    const disponivel = Math.max(0, operacional - reinvestido - devolvido);
    const falta = Math.max(0, investido - devolvido);
    // prazo: média dos últimos 3 meses completos de caixa operacional, exigindo pelo menos 2 meses
    const ymHoje = mesDe(hojeStr);
    const meses = [1, 2, 3].map(i => addMesYM(ymHoje, -i)).filter(ym => porMes[ym] !== undefined);
    let prazoMeses = null, media = null;
    if (meses.length >= 2) {
      media = sum(meses, ym => porMes[ym]) / meses.length;
      if (media > 0 && falta > 0) prazoMeses = Math.ceil(Math.max(0, falta - disponivel) / media);
    }
    const lucroAcumulado = D.cfg.inicio ? resultado(D, D.cfg.inicio, hojeStr).resultado : null;
    return { investido: r2(investido), aportes: r2(aportes), emBens: r2(emBens), devolvido: r2(devolvido), reinvestido: r2(reinvestido), operacional: r2(operacional), disponivel: r2(disponivel), falta: r2(falta), mesesBase: meses, media, prazoMeses, lucroAcumulado };
  }

  // ---------- backup ----------
  function validarBackup(obj) {
    const erros = [];
    if (!obj || typeof obj !== 'object') return { ok: false, erros: ['O arquivo não é um backup válido.'] };
    if (obj.app !== 'LEORA') erros.push('O arquivo não parece ser um backup do sistema LEORA.');
    if (typeof obj.esquema !== 'number') erros.push('Versão do esquema ausente.');
    else if (obj.esquema > ESQUEMA) erros.push(`Backup de versão mais nova (${obj.esquema}) que este sistema (${ESQUEMA}).`);
    const d = obj.dados || {};
    if (!d.cfg || typeof d.cfg !== 'object') erros.push('Configurações ausentes.');
    for (const c of COLECOES.concat(['ops'])) if (d[c] && typeof d[c] !== 'object') erros.push(`Coleção ${c} inválida.`);
    for (const c of COLECOES.concat(['ops'])) for (const [id, x] of Object.entries(d[c] || {})) {
      if (!x || typeof x !== 'object' || x.id !== id) { erros.push(`Registro ${id} em ${c} está incompleto.`); break; }
      if (!/^[A-Za-z0-9_\-.~:@+]{1,180}$/.test(id)) { erros.push(`Identificador inválido em ${c}: ${id}`); break; }
    }
    for (const op of Object.values(d.ops || {})) if (!op.k || !op.data) { erros.push(`Operação ${op.id} sem tipo ou data.`); break; }
    const contagem = {}; for (const c of COLECOES.concat(['ops'])) contagem[c] = Object.keys(d[c] || {}).length;
    return { ok: erros.length === 0, erros, contagem };
  }
  function montarBackup(D) {
    const dados = { cfg: D.cfg, cal: D.cal, logo: D.logo };
    for (const c of COLECOES.concat(['ops'])) dados[c] = D[c];
    return { app: 'LEORA', esquema: ESQUEMA, geradoEm: new Date().toISOString(), dados: L.clone(dados) };
  }

  Object.assign(L, {
    ESQUEMA, EPS, COLECOES, CATEGORIAS_DESPESA, configPadrao, calendarioPadrao, vazio,
    nomeVariante, nomeItem, ativos, ultimaVersao, opsAtivas, catDespesa,
    estado, lotesDisponiveis, vencido, disponivelInsumo,
    precoCadastroBase, custoBaseInsumo, custoKit, expandirVersao, receitaDaVariante, ratear, custoLote, custoForno,
    custoVariante, custoCombo, taxas, precoSugerido, analisarPreco, rateioMensal, calcVenda,
    prepararCompra, prepararProducao, prepararFornada, prepararVenda, prepararPerda, prepararAjuste, prepararLancamento,
    fluxo, saldoCaixa, recorrenciasPendentes, despesasFixasMes, previsao, resultado, diaDeVenda, faturamentoProdutos,
    metaInfo, traduzirValor, contribuicaoMix, alertas, recuperacao, validarBackup, montarBackup, filtraLinha,
  });
})(globalThis.L = globalThis.L || {});
