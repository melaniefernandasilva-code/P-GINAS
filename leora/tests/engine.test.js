/* Verificações com exemplos calculáveis. Rodar: node --test leora/tests */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.L = {};
require('../src/core.js');
require('../src/engine.js');
const L = globalThis.L;

const perto = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, obtido ${a}`);

function base() {
  const D = L.vazio();
  D.cfg.inicio = '2026-10-01';
  D.cfg.valorHora = 30;      // R$/h
  D.cfg.tarifaKwh = 1.0;     // R$/kWh
  D.cfg.tarifaGas = 10;      // R$/m³
  const ins = (id, nome, unidade, extra) => { D.insumos[id] = Object.assign({ id, nome, tipo: 'ingrediente', unidade, embQtd: 1, embUnid: unidade, precoEmb: 0 }, extra || {}); };
  ins('farinha', 'Farinha', 'g', { embQtd: 1, embUnid: 'kg' });
  ins('acucar', 'Açúcar', 'g', { embQtd: 1, embUnid: 'kg' });
  ins('leite', 'Leite', 'ml', { embQtd: 1, embUnid: 'L' });
  ins('choco', 'Gotas de chocolate', 'g', { embQtd: 1, embUnid: 'kg' });
  ins('sacovac', 'Saco a vácuo', 'un', { tipo: 'embalagem', subtipo: 'vacuo' });
  ins('saquinho', 'Saquinho individual', 'un', { tipo: 'embalagem', subtipo: 'individual' });
  ins('caixa4', 'Caixa combo 4', 'un', { tipo: 'embalagem', subtipo: 'combo' });
  D.kits.kArm = { id: 'kArm', nome: 'Vácuo', uso: 'armazenamento', itens: [{ insumoId: 'sacovac', qtd: 1 }] };
  D.kits.kInd = { id: 'kInd', nome: 'Individual', uso: 'venda', itens: [{ insumoId: 'saquinho', qtd: 1 }] };
  D.kits.kCombo = { id: 'kCombo', nome: 'Caixa 4', uso: 'venda', itens: [{ insumoId: 'caixa4', qtd: 1 }] };
  D.produtos.cookie = { id: 'cookie', nome: 'Cookie', categoria: 'Cookies' };
  D.fornos.f1 = { id: 'f1', nome: 'Elétrico', tipo: 'eletrico', potenciaW: 2000, fator: 0.5, preaqMin: 10 };
  D.fornos.g1 = { id: 'g1', nome: 'Gás', tipo: 'gas', consumoHora: 0.3 };
  const asr = { fornoId: 'f1', minForno: 12, preaqMin: 10, unidadesFornada: 10, minAtivoFornada: 6, minEmbalagemUnid: 0 };
  D.variantes.choc80 = { id: 'choc80', produtoId: 'cookie', sabor: 'Chocolate', tamanho: '80 g', pesoG: 80, kitVendaId: 'kInd', precos: { zap: 12, ifood: 16 }, assar: asr, perdaPct: 0, validadeAssadoDias: 3 };
  D.variantes.choc40 = { id: 'choc40', produtoId: 'cookie', sabor: 'Chocolate', tamanho: '40 g', pesoG: 40, kitVendaId: 'kInd', precos: { zap: 7 }, assar: asr, perdaPct: 0 };
  D.variantes.trad80 = { id: 'trad80', produtoId: 'cookie', sabor: 'Tradicional', tamanho: '80 g', pesoG: 80, kitVendaId: 'kInd', precos: { zap: 10 }, assar: asr, perdaPct: 0 };
  D.bases.b1 = { id: 'b1', nome: 'Massa base', versoes: [{ v: 1, data: '2026-10-01', ingredientes: [{ insumoId: 'farinha', qtd: 500, unid: 'g' }, { insumoId: 'acucar', qtd: 0.2, unid: 'kg' }] }] };
  D.receitas.rChoc = { id: 'rChoc', nome: 'Cookie chocolate', versoes: [{ v: 1, data: '2026-10-01', bases: [{ baseId: 'b1', mult: 1 }], extras: [{ insumoId: 'choco', qtd: 100, unid: 'g' }], saidas: [{ varianteId: 'choc80', unidades: 10 }], tempos: { preparo: 30, porcionamento: 10, embalagem: 5, outras: 0 }, kitArmazId: 'kArm', kitArmazQtd: 2, validadeMassaDias: 90 }] };
  D.receitas.rTrad = { id: 'rTrad', nome: 'Cookie tradicional', versoes: [{ v: 1, data: '2026-10-01', bases: [{ baseId: 'b1', mult: 1 }], extras: [], saidas: [{ varianteId: 'trad80', unidades: 9 }], tempos: { preparo: 30 }, kitArmazId: 'kArm', kitArmazQtd: 1, validadeMassaDias: 90 }] };
  D.canais.zap = { id: 'zap', nome: 'WhatsApp', tipo: 'direto', taxaPct: 0, taxaFixaPedido: 0, prazoDias: 0, formaPadraoId: 'pix' };
  D.canais.ifood = { id: 'ifood', nome: 'iFood', tipo: 'plataforma', taxaPct: 23, baseTaxa: 'produtos', taxaFixaPedido: 1, prazoDias: 30, pagamentoIncluso: true, formaPadraoId: 'plat' };
  D.formas.pix = { id: 'pix', nome: 'Pix', taxaPct: 0, taxaFixa: 0, prazoDias: 0 };
  D.formas.credito = { id: 'credito', nome: 'Crédito', taxaPct: 4, taxaFixa: 0, prazoDias: 30, antecipacaoPct: 2 };
  D.formas.plat = { id: 'plat', nome: 'Pagamento via plataforma', taxaPct: 3.5, taxaFixa: 0.5, prazoDias: 0 };
  D.combos.c4 = { id: 'c4', nome: 'Caixa 4 livres', tipo: 'livre', livre: { qtd: 4, permitidas: ['choc80', 'trad80'] }, kitVendaId: 'kCombo', precos: { zap: 40 } };
  return D;
}
let seq = 0;
function gravar(D, prep, id) {
  assert.ok(prep.ok, prep.erro);
  seq++;
  id = id || 'op' + seq;
  D.ops[id] = Object.assign({ id, criadoEm: '2026-10-01T00:' + String(seq).padStart(4, '0') + 'Z', status: 'ativo' }, prep.op);
  return D.ops[id];
}
function compraBasica(D) {
  return gravar(D, L.prepararCompra(D, {
    data: '2026-10-02', recebidoEm: '2026-10-02', fornecedor: 'Atacado',
    itens: [
      { insumoId: 'farinha', embs: 5, embQtd: 1, embUnid: 'kg', valor: 30 },
      { insumoId: 'acucar', embs: 2, embQtd: 1, embUnid: 'kg', valor: 10 },
      { insumoId: 'choco', embs: 1, embQtd: 1, embUnid: 'kg', valor: 60, lote: 'CH1', validade: '2027-03-01' },
      { insumoId: 'sacovac', embs: 1, embQtd: 50, embUnid: 'un', valor: 25 },
      { insumoId: 'saquinho', embs: 1, embQtd: 100, embUnid: 'un', valor: 20 },
      { insumoId: 'caixa4', embs: 1, embQtd: 10, embUnid: 'un', valor: 30 },
    ],
    extras: [{ descricao: 'Frete', valor: 17.5 }], rateio: 'valor',
    parcelas: [{ venc: '2026-10-02', valor: 96.25, pagos: [{ data: '2026-10-02', valor: 96.25 }] }, { venc: '2026-11-02', valor: 96.25 }],
  }), 'compra1');
}

test('conversões de unidades', () => {
  const D = base();
  assert.equal(L.converter(1, 'kg', D.insumos.farinha).valor, 1000);
  assert.equal(L.converter(2, 'L', D.insumos.leite).valor, 2000);
  const semEq = L.converter(100, 'g', D.insumos.leite);
  assert.equal(semEq.ok, false, 'volume→peso sem equivalência deve falhar');
  D.insumos.leite.gPorMl = 1.03;
  perto(L.converter(103, 'g', D.insumos.leite).valor, 100);
  assert.equal(L.converter(1, 'un', D.insumos.farinha).ok, false);
  assert.equal(L.num('1.234,56'), 1234.56);
  assert.equal(L.num('12,5'), 12.5);
});

test('compra parcelada com frete rateado por valor e custo médio ponderado', () => {
  const D = base();
  const c = compraBasica(D);
  assert.equal(c.total, 192.5);
  // frete 17,50 sobre 175 de mercadoria = 10%: farinha 30 → 33
  const far = c.itens[0]; assert.equal(far.extra, 3); assert.equal(far.custoTotal, 33);
  let S = L.estado(D);
  assert.equal(S.ins.farinha.qtd, 5000);
  perto(L.custoBaseInsumo(D, S, 'farinha', 'medio').valor, 0.0066, 1e-9);
  // nova compra mais cara: 1 kg por R$ 9,40 → médio (33 + 9,40)/6000
  gravar(D, L.prepararCompra(D, { data: '2026-10-05', recebidoEm: '2026-10-05', itens: [{ insumoId: 'farinha', embs: 1, embQtd: 1, embUnid: 'kg', valor: 9.4 }], parcelas: [{ venc: '2026-10-05', valor: 9.4 }] }));
  S = L.estado(D);
  perto(L.custoBaseInsumo(D, S, 'farinha', 'medio').valor, 42.4 / 6000, 1e-9);
  perto(L.custoBaseInsumo(D, S, 'farinha', 'ultimo').valor, 0.0094, 1e-9);
  // estoque entra pelo recebimento; dinheiro sai pelo pagamento
  const { pend } = L.fluxo(D);
  assert.equal(L.saldoCaixa(D), -96.25);
  assert.equal(pend.filter(p => p.lado === 'pagar').length, 2);
  // compra ainda não recebida não mexe no estoque
  gravar(D, L.prepararCompra(D, { data: '2026-10-06', recebidoEm: null, itens: [{ insumoId: 'acucar', embs: 1, embQtd: 1, embUnid: 'kg', valor: 5 }], parcelas: [{ venc: '2026-10-06', valor: 5 }] }));
  assert.equal(L.estado(D).ins.acucar.qtd, 2000);
  // parcelas que não fecham com o total são recusadas
  const ruim = L.prepararCompra(D, { data: '2026-10-06', itens: [{ insumoId: 'acucar', embs: 1, embQtd: 1, embUnid: 'kg', valor: 5 }], parcelas: [{ venc: '2026-10-06', valor: 4 }] });
  assert.equal(ruim.ok, false);
});

test('custo por receita e tamanho, com base compartilhada sem duplicar ingredientes', () => {
  const D = base(); compraBasica(D);
  const S = L.estado(D);
  // farinha 0,0066/g; açúcar (10+1)/2000 = 0,0055/g; chocolate 66/1000 = 0,066/g; saco vácuo 27,5/50 = 0,55
  const ver = L.ultimaVersao(D.receitas.rChoc);
  const lote = L.custoLote(D, S, ver, 'medio');
  perto(lote.ingredientes, 500 * 0.0066 + 200 * 0.0055 + 100 * 0.066); // 3,30 + 1,10 + 6,60 = 11,00
  perto(lote.embalagem, 2 * 0.55);
  perto(lote.trabalho, 45 / 60 * 30); // 22,50
  // uma receita com duas saídas de tamanhos diferentes divide pelo peso
  D.receitas.rChoc.versoes.push(Object.assign({}, ver, { v: 2, saidas: [{ varianteId: 'choc80', unidades: 5 }, { varianteId: 'choc40', unidades: 10 }] }));
  const l2 = L.custoLote(D, S, L.ultimaVersao(D.receitas.rChoc), 'medio');
  // pesos 400 g e 400 g → metade do custo para cada; 80 g custa o dobro de 40 g
  perto(l2.saidas[0].m * 5, l2.saidas[1].m * 10);
  perto(l2.saidas[0].m, 2 * l2.saidas[1].m);
  // custo completo por unidade de 80 g (versão 1)
  D.receitas.rChoc.versoes.pop();
  const cv = L.custoVariante(D, S, 'choc80', 'medio');
  perto(cv.ingredientes, 1.10); perto(cv.embArmaz, 0.11); perto(cv.trabPreparo, 2.25);
  // energia: 2 kW × (22/60) h × 0,5 × R$1 = 0,3667 por fornada de 10
  perto(cv.energia, 2 * (22 / 60) * 0.5 / 10, 1e-6);
  perto(cv.trabAssar, 6 / 60 * 30 / 10, 1e-6);
  perto(cv.embVenda, 0.22, 1e-6); // saquinho (20 + 2 de frete)/100
});

test('margem sobre o preço não é acréscimo sobre o custo', () => {
  const D = base();
  const tx = L.taxas(D, 'zap', 'pix');
  const s = L.precoSugerido(5, tx, 0.30, 1, 0);
  perto(s.preco, 5 / 0.7, 1e-9); // 7,142857
  const a = L.analisarPreco(5 * 1.3, 5, tx, 1, 0); // acréscimo de 30% → 6,50
  perto(a.margemContrib, 1.5 / 6.5, 1e-9); // só 23,1% de margem
  const ruim = L.precoSugerido(5, L.taxas(D, 'ifood', 'plat'), 0.8, 1, 0);
  assert.equal(ruim.preco, null, 'denominador ≤ 0 deve ser recusado');
});

test('taxas: pagamento incluso na plataforma não cobra maquininha de novo; bases diferentes', () => {
  const D = base();
  const ifood = L.taxas(D, 'ifood', 'credito');
  perto(ifood.pEff, 0.23, 1e-12);
  assert.equal(ifood.fixoPedido, 1);
  const direto = L.taxas(D, 'zap', 'credito');
  perto(direto.pEff, 0.04 + 0.02 * 0.96, 1e-12); // antecipação incide sobre o que sobra após a taxa do cartão
  // preço com taxa fixa por pedido distribuída pelos itens do pedido
  const s = L.precoSugerido(5, ifood, 0.3, 2, 0);
  perto(s.preco, (5 + 0.5) / (1 - 0.23 - 0.3), 1e-9);
  // venda diária: taxa fixa multiplica pelo número de pedidos, não pelo dia
  const v = { canalId: 'ifood', formaId: 'plat', pedidos: 5, linhas: [{ qtd: 10, precoUnit: 10, desconto: 0 }], entrega: { cobrada: 0 } };
  const cv = L.calcVenda(D, v);
  assert.equal(cv.tCanal, 23 + 5);
  assert.equal(cv.tPag, 0);
  assert.equal(cv.liquido, 72);
  // taxa do cartão incide sobre produtos + entrega; a comissão do canal direto (0) só sobre produtos
  D.canais.zap.taxaPct = 10;
  const cv2 = L.calcVenda(D, { canalId: 'zap', formaId: 'credito', linhas: [{ qtd: 1, precoUnit: 100 }], entrega: { cobrada: 10 } });
  assert.equal(cv2.tCanal, 10);
  assert.equal(cv2.tPag, 4.4);
  assert.equal(cv2.tAnt, r2(0.02 * (110 - 4.4)));
  // sem contagem de pedidos e com taxa fixa → exigida
  assert.equal(L.calcVenda(D, { canalId: 'ifood', formaId: 'plat', linhas: [{ qtd: 1, precoUnit: 10 }] }).precisaPedidos, true);
  // taxa efetiva informada substitui a prevista
  const cv3 = L.calcVenda(D, Object.assign({}, v, { taxasEfetivas: 30 }));
  assert.equal(cv3.taxas, 30); assert.equal(cv3.prevista, 28);
});
function r2(v) { return L.r2(v); }

function cadeia(D) {
  compraBasica(D);
  let S = L.estado(D);
  const prod = gravar(D, L.prepararProducao(D, S, { receitaId: 'rChoc', data: '2026-10-03', mult: 1, saidas: [{ varianteId: 'choc80', unidades: 10 }], minutos: 45, kitArmazQtd: 2, validadeDias: 90, lote: 'M1' }, 'prod1'), 'prod1');
  S = L.estado(D);
  const forn = gravar(D, L.prepararFornada(D, S, { data: '2026-10-04', usos: [{ fornoId: 'f1', minutos: 12, preaqMin: 10 }], linhas: [{ key: 'prod1:0', retiradas: 6, boas: 5 }], minAtivo: 6 }, 'forn1'), 'forn1');
  return { prod, forn };
}

test('produção, congelamento, fornada e venda sem baixa dupla', () => {
  const D = base();
  const { prod, forn } = cadeia(D);
  let S = L.estado(D);
  assert.equal(S.ins.farinha.qtd, 4500);
  assert.equal(S.ins.choco.qtd, 900);
  assert.equal(S.ins.sacovac.qtd, 48);
  assert.equal(S.lotes['prod1:0'].saldo, 4);       // 10 porções − 6 retiradas
  assert.equal(S.lotes['prod1:0'].validade, '2027-01-01');
  assert.equal(S.lotes['forn1:0'].saldo, 5);        // 5 boas, 1 perdida
  assert.equal(S.lotes['forn1:0'].validade, '2026-10-07');
  assert.equal(forn.perdas[0].unidades, 1);
  // custo do lote assado = massa + energia + trabalho do assamento só para as 5 boas
  const massaCu = prod.lotes[0].cu;
  perto(forn.lotes[0].cu.e, (2 * 22 / 60 * 0.5) / 5, 1e-6);
  perto(forn.lotes[0].cu.m, massaCu.m, 1e-9);
  // venda: só baixa assados e embalagem de venda
  const insAntes = JSON.stringify([S.ins.farinha.qtd, S.ins.choco.qtd, S.ins.sacovac.qtd]);
  const venda = gravar(D, L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 3, precoUnit: 12 }], recebidoNaHora: true }), 'v1');
  S = L.estado(D);
  assert.equal(JSON.stringify([S.ins.farinha.qtd, S.ins.choco.qtd, S.ins.sacovac.qtd]), insAntes);
  assert.equal(S.lotes['forn1:0'].saldo, 2);
  assert.equal(S.lotes['prod1:0'].saldo, 4, 'venda não pode mexer na massa congelada');
  assert.equal(S.ins.saquinho.qtd, 97);
  assert.equal(venda.recebimentos[0].pagos[0].valor, 36);
  // vender mais do que há assado é bloqueado (não presume assamento)
  const demais = L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 3, precoUnit: 12 }] });
  assert.equal(demais.ok, false);
  // lote vencido não é usado automaticamente
  const depois = L.prepararVenda(D, S, { data: '2026-10-09', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 1, precoUnit: 12 }] });
  assert.equal(depois.ok, false);
});

test('cancelamento reverte sem duplicar e bloqueia quando já houve uso', () => {
  const D = base(); cadeia(D);
  // cancelar a produção depois da fornada deixaria o lote de massa negativo
  const S = L.estado(D, { excluirId: 'prod1' });
  assert.ok(S.negativos.length > 0);
  // cancelar a fornada devolve as porções ao lote de massa uma única vez
  D.ops.forn1.status = 'cancelado';
  const S2 = L.estado(D);
  assert.equal(S2.lotes['prod1:0'].saldo, 10);
  assert.equal(S2.lotes['forn1:0'], undefined);
  D.ops.forn1.status = 'ativo';
  assert.equal(L.estado(D).lotes['prod1:0'].saldo, 4);
});

test('venda de combo livre exige composição e baixa componentes + caixa', () => {
  const D = base(); cadeia(D);
  let S = L.estado(D);
  // assa tradicional direto (produção sem congelamento)
  gravar(D, L.prepararProducao(D, S, { receitaId: 'rTrad', data: '2026-10-04', mult: 1, saidas: [{ varianteId: 'trad80', unidades: 9 }], minutos: 30, assar: { ativo: true, fornoId: 'f1', minForno: 12, preaqMin: 10, minAtivo: 5 } }, 'pd'), 'pd');
  S = L.estado(D);
  assert.equal(S.lotes['pd:0'].estado, 'assado');
  assert.equal(S.ins.sacovac.qtd, 48, 'produção direta não usa saco a vácuo');
  const semComp = L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'c', refId: 'c4', qtd: 1, precoUnit: 40 }] });
  assert.equal(semComp.ok, false);
  const ok = gravar(D, L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'c', refId: 'c4', qtd: 2, precoUnit: 40, composicao: [{ varianteId: 'choc80', qtd: 3 }, { varianteId: 'trad80', qtd: 5 }] }] }), 'vc');
  S = L.estado(D);
  assert.equal(S.lotes['forn1:0'].saldo, 2);
  assert.equal(S.lotes['pd:0'].saldo, 4);
  assert.equal(S.ins.caixa4.qtd, 8);
  assert.equal(S.ins.saquinho.qtd, 100, 'combo sem embalagem individual');
  // receita do combo conta uma vez; unidades de cookies contadas à parte
  const R = L.resultado(D, '2026-10-01', '2026-10-31');
  assert.equal(R.produtos, 80);
  assert.equal(R.combosVendidos, 2);
  assert.equal(R.unidadesVendidas, 8);
  // faixa de custo do combo livre antes de conhecer a composição
  const cc = L.custoCombo(D, L.estado(D), 'c4', 'medio');
  assert.ok(cc.max >= cc.min && cc.min > 0);
  assert.ok(ok.linhas[0].custo.emb > 0);
});

test('perdas reais movimentam estoque e resultado', () => {
  const D = base(); cadeia(D);
  const S = L.estado(D);
  const p = gravar(D, L.prepararPerda(D, S, { data: '2026-10-05', key: 'forn1:0', qtd: 1, motivo: 'Quebrou' }));
  assert.equal(L.estado(D).lotes['forn1:0'].saldo, 4);
  const R = L.resultado(D, '2026-10-01', '2026-10-31');
  // perda da fornada (1 porção de massa) + perda registrada (1 assado), parte de materiais
  perto(R.perdasM, D.ops.forn1.perdas[0].m + p.custo.m, 1e-6);
  // perda estimada para precificação não cria saída de dinheiro
  D.variantes.choc80.perdaPct = 10;
  const antes = L.saldoCaixa(D);
  const cv = L.custoVariante(D, L.estado(D), 'choc80', 'medio');
  assert.ok(cv.perdas > 0);
  assert.equal(L.saldoCaixa(D), antes);
  // rendimento que já desconta perdas não aplica a perda de novo
  D.receitas.rChoc.versoes[0].rendimentoJaDescontaPerdas = true;
  assert.equal(L.custoVariante(D, L.estado(D), 'choc80', 'medio').perdas, 0);
});

test('mudança de preço de ingrediente altera simulação sem reescrever o passado', () => {
  const D = base(); cadeia(D);
  let S = L.estado(D);
  const venda = gravar(D, L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 1, precoUnit: 12 }] }));
  const custoAntes = L.custoVariante(D, S, 'choc80', 'ultimo').total;
  const custoVendaAntes = venda.linhas[0].custo.m;
  const prodCusto = D.ops.prod1.custos.total;
  gravar(D, L.prepararCompra(D, { data: '2026-10-06', recebidoEm: '2026-10-06', itens: [{ insumoId: 'choco', embs: 1, embQtd: 1, embUnid: 'kg', valor: 120 }], parcelas: [{ venc: '2026-10-06', valor: 120 }] }));
  S = L.estado(D);
  assert.ok(L.custoVariante(D, S, 'choc80', 'ultimo').total > custoAntes);
  assert.equal(D.ops.prod1.custos.total, prodCusto);
  assert.equal(venda.linhas[0].custo.m, custoVendaAntes);
});

test('repasses parcelados não duplicam faturamento e conciliação registra a diferença', () => {
  const D = base(); cadeia(D);
  const S = L.estado(D);
  const v = gravar(D, L.prepararVenda(D, S, {
    data: '2026-10-04', canalId: 'zap', formaId: 'credito', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 2, precoUnit: 12 }],
  }));
  const liq = v.resumo.liquido; // 24 − 0,96 − 0,02×23,04 = 22,58
  assert.equal(liq, 22.58);
  assert.equal(v.recebimentos[0].data, '2026-11-03');
  const fat = L.faturamentoProdutos(D, '2026-10-01', '2026-10-31');
  v.recebimentos[0].pagos.push({ id: 'a', data: '2026-11-03', valor: 10 });
  v.recebimentos[0].pagos.push({ id: 'b', data: '2026-11-04', valor: 12.5 });
  assert.equal(L.faturamentoProdutos(D, '2026-10-01', '2026-10-31'), fat);
  assert.equal(L.saldoCaixa(D, '2026-11-30') - L.saldoCaixa(D, '2026-10-31'), 22.5);
  // encerrar com 8 centavos a menos vira taxa adicional, sem mexer nas vendas
  const antes = L.resultado(D, '2026-10-01', '2026-10-31');
  v.recebimentos[0].encerrado = true;
  const depois = L.resultado(D, '2026-10-01', '2026-10-31');
  perto(depois.taxas - antes.taxas, 0.08, 1e-9);
  assert.equal(depois.produtos, antes.produtos);
  assert.equal(L.fluxo(D).pend.filter(p => p.lado === 'receber').length, 0);
});

test('energia/gás: conta real substitui a estimativa, sem contar duas vezes', () => {
  const D = base(); cadeia(D);
  const S = L.estado(D);
  gravar(D, L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 5, precoUnit: 12 }] }));
  const R1 = L.resultado(D, '2026-10-01', '2026-10-31');
  assert.equal(R1.usaEnergiaReal, false);
  perto(R1.energiaNoResultado, R1.cmvE + R1.perdasE, 1e-9);
  perto(R1.kwh, 2 * 22 / 60 * 0.5, 1e-9);
  gravar(D, L.prepararLancamento(D, { natureza: 'despesa', categoria: 'energia', descricao: 'Parte da conta de luz', competencia: '2026-10-31', parcelas: [{ venc: '2026-11-10', valor: 4 }] }));
  const R2 = L.resultado(D, '2026-10-01', '2026-10-31');
  assert.equal(R2.usaEnergiaReal, true);
  assert.equal(R2.energiaNoResultado, 4);
  perto(R2.resultado, R1.resultado + R1.energiaNoResultado - 4, 0.011); // resultado arredondado em centavos
  // despesas fixas para ponto de equilíbrio não incluem energia (já está no custo do produto)
  const fx = L.despesasFixasMes(D, '2026-10');
  assert.equal(fx.total, 0); assert.equal(fx.excluidas.length, 1);
  // forno a gás: m³/h × h × tarifa
  perto(L.custoForno(D, D.fornos.g1, 30).valor, 0.3 * 0.5 * 10, 1e-9);
  D.fornos.g1.custoManualHora = 2;
  const man = L.custoForno(D, D.fornos.g1, 30);
  assert.equal(man.valor, 1); assert.equal(man.manual, true);
});

test('meta com folgas e mês sem dias restantes', () => {
  const D = base();
  D.cal.metas['2026-10'] = 2000;
  D.cal.diasSemanaFolga = [0, 1]; // domingo e segunda
  D.cal.folgas['2026-10-12'] = 'Feriado';
  // 11/10/2026 é domingo (folga): hoje não conta
  let m = L.metaInfo(D, '2026-10', '2026-10-11');
  assert.equal(m.hojeEhDiaDeVenda, false);
  // dias de venda de 13 a 31/10 sem dom/seg: 13..17 (5), 20..24 (5), 27..31 (5) = 15
  assert.equal(m.diasRestantes, 15);
  assert.equal(m.porDia, 133.33);
  // sábado 10/10 com venda no próprio dia
  cadeia(D);
  const S = L.estado(D);
  gravar(D, L.prepararVenda(D, S, { data: '2026-10-04', canalId: 'zap', formaId: 'pix', linhas: [{ tipo: 'v', refId: 'choc80', qtd: 1, precoUnit: 12 }] }));
  m = L.metaInfo(D, '2026-10', '2026-10-04'); // domingo também → usa 03/10 sábado
  m = L.metaInfo(D, '2026-10', '2026-10-03');
  assert.equal(m.hojeEhDiaDeVenda, true);
  assert.ok(m.metaHoje > 0);
  // meta atingida não mostra negativo
  D.cal.metas['2026-10'] = 5;
  m = L.metaInfo(D, '2026-10', '2026-10-30');
  assert.equal(m.atingida, true); assert.equal(m.restante, 0); assert.equal(m.faltaHoje, 0);
  // último dia é folga → sem dias restantes, sem dividir por zero
  D.cal.metas['2026-10'] = 3000;
  D.cal.folgas['2026-10-31'] = 'Pausa';
  m = L.metaInfo(D, '2026-10', '2026-10-31');
  assert.equal(m.semDias, true); assert.equal(m.porDia, null);
  // tradução em unidades arredonda para cima pela mistura planejada
  const t = L.traduzirValor(D, L.estado(D), 100, [{ tipo: 'v', id: 'choc80', canalId: 'zap', peso: 1 }, { tipo: 'c', id: 'c4', canalId: 'zap', peso: 1 }]);
  assert.ok(t.ok); perto(t.precoMedio, 26, 1e-9);
  assert.equal(t.itens[0].qtd, 2); // 100/26 = 3,85 vendas → metade de cada → 1,92 → 2
});

test('aporte não é venda; investimento em bens separado; recuperação', () => {
  const D = base();
  D.cfg.saldoInicial = 500; D.cfg.saldoInicialEhAporte = true;
  gravar(D, L.prepararLancamento(D, { natureza: 'aporte', descricao: 'Aporte', competencia: '2026-10-01', parcelas: [{ venc: '2026-10-01', valor: 1000, pagos: [{ data: '2026-10-01', valor: 1000 }] }] }));
  gravar(D, L.prepararLancamento(D, { natureza: 'investimento', origem: 'proprietaria', descricao: 'Batedeira que já era dela', competencia: '2026-10-01', valorProprietaria: 800 }));
  gravar(D, L.prepararLancamento(D, { natureza: 'investimento', descricao: 'Forno', competencia: '2026-10-02', vidaUtilMeses: 24, parcelas: [{ venc: '2026-10-02', valor: 1200, pagos: [{ data: '2026-10-02', valor: 1200 }] }] }));
  const R = L.resultado(D, '2026-10-01', '2026-10-31');
  assert.equal(R.produtos, 0);
  assert.equal(R.resultado, 0, 'sem depreciação ativa, equipamento não vira custo do mês');
  D.cfg.depreciacaoAtiva = true;
  assert.equal(L.resultado(D, '2026-10-01', '2026-10-31').depreciacao, 50);
  assert.equal(L.saldoCaixa(D), 300);
  const rec = L.recuperacao(D, '2026-10-31');
  assert.equal(rec.investido, 2300);
  assert.equal(rec.reinvestido, 1200);
  assert.equal(rec.devolvido, 0);
  assert.equal(rec.prazoMeses, null, 'sem dados suficientes não mostra prazo');
});

test('backup e restauração', () => {
  const D = base(); cadeia(D);
  const bk = JSON.parse(JSON.stringify(L.montarBackup(D)));
  const v = L.validarBackup(bk);
  assert.ok(v.ok, v.erros.join(';'));
  assert.equal(v.contagem.ops, 3);
  const D2 = L.vazio(); Object.assign(D2, bk.dados);
  assert.deepEqual(L.estado(D2).lotes, L.estado(D).lotes);
  assert.equal(L.validarBackup({ app: 'outro' }).ok, false);
  const mexido = JSON.parse(JSON.stringify(bk)); mexido.dados.ops.compra1.id = 'x';
  assert.equal(L.validarBackup(mexido).ok, false);
  mexido.esquema = 99; assert.equal(L.validarBackup(mexido).ok, false);
});
