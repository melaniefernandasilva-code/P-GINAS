// Testes do motor de cálculo: node tests/engine.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { console, Intl, Math, Date, JSON };
vm.createContext(ctx);
for (const f of ['01-util.js', '02-model.js', '03-engine.js', '04-actions.js', '05-sim.js']) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').replace(/^const (\w+) = /m, 'var $1 = ');
  vm.runInContext(code, ctx, { filename: f });
}
const { U, M, E, A, SIM } = ctx;

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '\n     ', e.message); } }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || ''} esperado ${JSON.stringify(b)}, obtido ${JSON.stringify(a)}`); }

E.setToday('2026-10-12');
function base() {
  const st = M.defaultState();
  st.settings.startDate = '2026-10-01';
  st.accounts.push({ id: 'pes1', name: 'Nubank', type: 'pessoal', initialBalance: 100000, refDate: '2026-10-12', balanceSetAt: 1 });
  st.accounts.push({ id: 'pes2', name: 'Inter', type: 'pessoal', initialBalance: 0, refDate: '2026-10-12', balanceSetAt: 1 });
  st.accounts.push({ id: 'pj', name: 'PJ', type: 'pj', initialBalance: 500000, refDate: '2026-10-12', balanceSetAt: 1 });
  st.cards.push({ id: 'cp', name: 'Meu cartão', owner: 'proprio', closingDay: 3, dueDay: 10, payAccountId: 'pes1', defaultNature: 'pessoal' });
  st.cards.push({ id: 'cm', name: 'Cartão da mãe', owner: 'mae', closingDay: 25, dueDay: 5, payAccountId: 'pes1', defaultNature: 'pessoal', avoid: true });
  return st;
}
const months = ['2026-10', '2026-11', '2026-12'];

t('utilidades: valores e datas de fim de mês', () => {
  eq(U.toCents('1.234,56'), 123456); eq(U.toCents('1234.56'), 123456); eq(U.toCents('1.234'), 123400); eq(U.toCents('-50'), -5000);
  eq(U.addMonths('2026-01-31', 1), '2026-02-28'); eq(U.addMonths('2026-01-31', 2, 31), '2026-03-31');
  eq(U.split(10000, 3), [3334, 3333, 3333]);
  eq(U.parseDateAny('31/02/2026'), null); eq(U.parseDateAny('05/11/2026'), '2026-11-05');
});

t('transferência entre contas não cria receita nem despesa', () => {
  const st = base();
  A.transfer(st, { fromId: 'pj', toId: 'pes1', amount: 200000, date: '2026-10-12', purpose: 'retirada' });
  st.meta.rev++;
  const data = E.build(st, '2027-01-31');
  const rp = E.results(st, data, 'profissional', months), rs = E.results(st, data, 'pessoal', months);
  eq(rp.receita.total, 0); eq(rp.despesa.total, 0); eq(rs.receita.total, 0);
  eq(rp.retirada.total, 200000, 'retirada no profissional'); eq(rs.recurso.total, 200000, 'recurso no pessoal');
  const b = E.balances(st, data);
  eq(b.byId.pj.balance, 300000); eq(b.byId.pes1.balance, 300000); eq(b.total, 600000, 'total inalterado');
});

t('assinatura profissional no cartão pessoal conta como despesa profissional', () => {
  const st = base();
  st.series.push({ id: 's1', type: 'despesa', description: 'Canva', amount: 3500, categoryId: 'c_pro_ferr', nature: 'profissional', cardId: 'cp', frequency: 'mensal', startDate: '2026-10-15' });
  const data = E.build(st, '2027-01-31');
  const rp = E.results(st, data, 'profissional', ['2026-11']), rs = E.results(st, data, 'pessoal', ['2026-11']);
  eq(rp.despesa.total, 3500, 'despesa profissional na fatura de novembro'); eq(rs.despesa.total, 0, 'não é despesa pessoal');
  const inv = data.invoices['cp|2026-11'];
  eq(inv.itemsTotal, 3500, 'entra na fatura');
  // pagar com conta pessoal gera aporte do pessoal para o profissional, não despesa pessoal
  A.payInvoice(st, 'cp', '2026-11', { amount: 3500, date: '2026-11-10', accountId: 'pes1' }); st.meta.rev++;
  const d2 = E.build(st, '2027-01-31');
  eq(E.results(st, d2, 'pessoal', ['2026-11']).despesa.total, 0);
  eq(E.results(st, d2, 'pessoal', ['2026-11']).aporte_pro.total, 3500, 'registrado como dinheiro pessoal usado no profissional');
});

t('compra parcelada e pagamento de fatura não duplicam despesa', () => {
  const st = base();
  st.purchases.push({ id: 'p1', kind: 'compra', cardId: 'cp', description: 'Notebook', date: '2026-10-12', categoryId: 'c_pes_compras', nature: 'pessoal', mode: 'total', total: 300000, n: 3, firstInvoice: E.invoiceMonthFor(st.cards[0], '2026-10-12'), status: 'ativa' });
  eq(st.purchases[0].firstInvoice, '2026-11', 'compra após o fechamento cai na fatura seguinte');
  st.meta.rev++;
  let data = E.build(st, '2027-03-31');
  eq(E.results(st, data, 'pessoal', ['2026-11', '2026-12', '2027-01']).despesa.total, 300000);
  A.payInvoice(st, 'cp', '2026-11', { amount: 100000, date: '2026-11-10', accountId: 'pes1' }); st.meta.rev++;
  data = E.build(st, '2027-03-31');
  const r = E.results(st, data, 'pessoal', ['2026-11', '2026-12', '2027-01']);
  eq(r.despesa.total, 300000, 'despesa continua 3.000, sem somar o pagamento');
  eq(r.despesa.pago, 100000, 'uma parcela paga');
  eq(data.invoices['cp|2026-11'].remaining, 0);
  const p = E.projection(st, { to: '2027-03-31', data });
  eq(U.sum(p.events.filter((e) => e.it.src === 'invoice'), (e) => -e.delta), 200000, 'restam duas faturas no caixa');
});

t('fatura informada maior que as compras mostra a diferença sem somar duas vezes', () => {
  const st = base();
  st.purchases.push({ id: 'p1', kind: 'compra', cardId: 'cp', description: 'Mercado', date: '2026-10-02', categoryId: 'c_pes_alim', nature: 'pessoal', mode: 'total', total: 40000, n: 1, firstInvoice: '2026-10', status: 'ativa' });
  A.setInvoice(st, 'cp|2026-10', { informed: 100000 }); st.meta.rev++;
  const data = E.build(st, '2027-01-31');
  const inv = data.invoices['cp|2026-10'];
  eq(inv.payable, 100000); eq(inv.diff, 60000);
  eq(E.results(st, data, 'pessoal', ['2026-10']).despesa.total, 100000, 'compras + diferença = total informado');
});

t('Pix no crédito não vira renda e preserva o custo', () => {
  const st = base();
  A.pixCredit(st, { cardId: 'cp', net: 100000, total: 120000, n: 4, date: '2026-10-12', destination: 'conta', accountId: 'pes1', description: 'Pagar aluguel' }); st.meta.rev++;
  const data = E.build(st, '2027-03-31');
  const all = E.results(st, data, 'pessoal', U.monthRange('2026-10', '2027-03'));
  eq(all.receita.total, 0, 'não é renda'); eq(all.credito.total, 100000, 'crédito recebido');
  eq(all.despesa.total, 20000, 'custo de juros/tarifas como despesa'); eq(all.divida.total, 100000, 'principal como pagamento de crédito');
  const b = E.balances(st, data); eq(b.byId.pes1.balance, 200000, 'dinheiro entrou na conta');
});

t('Pix no crédito para quitar dívida não deixa as duas obrigações abertas', () => {
  const st = base();
  st.debts.push({ id: 'd1', creditor: 'Conta de luz atrasada', type: 'conta_atrasada', nature: 'pessoal', balance: 50000, balanceDate: '2026-10-12', status: 'ativa', overdueSince: '2026-09-20', nextDueDate: '2026-09-20', linkedPurchaseIds: [] });
  A.pixCredit(st, { cardId: 'cp', net: 50000, total: 56000, n: 2, date: '2026-10-12', destination: 'divida', destDebtId: 'd1' }); st.meta.rev++;
  const data = E.build(st, '2027-03-31');
  eq(st.debts[0].status, 'quitada');
  eq(data.items.filter((i) => i.src === 'debt').length, 0, 'dívida de origem não gera mais pagamento');
  eq(U.sum(Object.values(data.invoices), (i) => i.itemsTotal), 56000, 'só o Pix parcelado continua');
});

t('contrato encerrado não gera mensalidades depois do término', () => {
  const st = base();
  st.clients.push({ id: 'c1', name: 'Plane', amount: 250000, startDate: '2026-01-10', endDate: '2026-12-31', dueDay: 10, frequency: 'mensal', status: 'ativo', renewal: 'nao_confirmada', adjustments: [], accountId: 'pj' });
  const data = E.build(st, '2027-06-30');
  const occ = data.items.filter((i) => i.src === 'client');
  eq(occ.map((i) => i.date), ['2026-10-10', '2026-11-10', '2026-12-10'], 'só dentro da vigência e a partir do início da organização');
  eq(occ[0].status, 'vencido', 'outubro em atraso');
});

t('reajuste só entra quando confirmado', () => {
  const st = base();
  st.clients.push({ id: 'c1', name: 'Solvian', amount: 300000, startDate: '2026-10-01', dueDay: 15, status: 'ativo', adjustments: [{ date: '2026-12-01', amount: 350000, confirmed: false }], accountId: 'pj' });
  let data = E.build(st, '2027-01-31');
  eq(data.items.filter((i) => i.src === 'client').map((i) => i.amount), [300000, 300000, 300000, 300000]);
  st.clients[0].adjustments[0].confirmed = true; st.meta.rev++;
  data = E.build(st, '2027-01-31');
  eq(data.items.filter((i) => i.src === 'client').map((i) => i.amount), [300000, 300000, 350000, 350000]);
});

t('dívida vinculada a parcelas do cartão não duplica a obrigação', () => {
  const st = base();
  st.purchases.push({ id: 'pm', kind: 'compra', cardId: 'cm', description: 'Parcelas no cartão da mãe', date: '2026-01-10', categoryId: 'c_pes_compras', nature: 'pessoal', mode: 'restante', installmentValue: 45000, remaining: 5, paidBefore: 7, firstInvoice: '2026-11', status: 'ativa' });
  st.debts.push({ id: 'd2', creditor: 'Mãe (cartão)', type: 'parcelamento', nature: 'pessoal', balance: null, status: 'ativa', linkedPurchaseIds: ['pm'] });
  const data = E.build(st, '2027-06-30');
  const info = E.debtInfo(st, data, st.debts[0]);
  eq(info.balance, 225000, 'saldo da dívida = parcelas restantes'); eq(info.linked, true);
  eq(data.items.filter((i) => i.src === 'debt').length, 0, 'dívida vinculada não gera pagamentos próprios');
  const p = E.projection(st, { to: '2027-06-30', data });
  eq(U.sum(p.events.filter((e) => e.delta < 0), (e) => -e.delta), 225000, 'saídas só pelas faturas');
  const last = Object.values(data.invoices).filter((i) => i.cardId === 'cm').map((i) => i.month).sort().pop();
  eq(last, '2027-03', 'última parcela');
  eq(data.cardRows.find((r) => r.p && r.p.id === 'pm').label, '8/12', 'numeração continua das já pagas');
});

t('saldo inicial não infla faturamento', () => {
  const st = base();
  const data = E.build(st, '2027-01-31');
  eq(E.results(st, data, 'profissional', months).receita.total, 0);
  eq(E.balances(st, data).byId.pj.balance, 500000);
});

t('reserva: aporte sai da conta, não é despesa e não é alocado duas vezes', () => {
  const st = base();
  st.reserves.push({ id: 'r1', nature: 'pessoal', kind: 'reserva', name: 'Emergência', initialBalance: 0, months: 6, base: { mode: 'manual', manual: 300000 } });
  st.reserves.push({ id: 'r2', nature: 'pessoal', kind: 'objetivo', name: 'Viagem', initialBalance: 0, target: 500000 });
  A.reserveMove(st, { reserveId: 'r1', op: 'aporte', amount: 50000, date: '2026-10-12', accountId: 'pes1' }); st.meta.rev++;
  const data = E.build(st, '2027-01-31');
  eq(E.results(st, data, 'pessoal', months).despesa.total, 0, 'não é despesa');
  eq(E.balances(st, data).byId.pes1.balance, 50000, 'dinheiro livre reduz');
  const i1 = E.reserveInfo(st, data, st.reserves[0]), i2 = E.reserveInfo(st, data, st.reserves[1]);
  eq(i1.balance, 50000); eq(i2.balance, 0, 'outro objetivo não recebe o mesmo dinheiro');
  eq(i1.target, 1800000); eq(i1.covered, 50000 / 300000);
  let threw = false; try { A.reserveMove(st, { reserveId: 'r2', op: 'retirada', amount: 1, date: '2026-10-12', accountId: 'pes1' }); } catch (e) { threw = true; }
  eq(threw, true, 'não retira mais do que tem');
});

t('editar só esta ocorrência ou as futuras sem duplicar e sem mexer nas pagas', () => {
  const st = base();
  st.series.push({ id: 's1', type: 'despesa', description: 'Aluguel', amount: 150000, categoryId: 'c_pes_moradia', nature: 'pessoal', accountId: 'pes1', frequency: 'mensal', startDate: '2026-10-31' });
  let data = E.build(st, '2027-03-31');
  let occ = data.items.filter((i) => i.ref && i.ref.id === 's1' || (i.src === 'entry' && i.ref.seriesRef));
  eq(occ.map((i) => i.date), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31'], 'fim de mês respeitado');
  // paga outubro e antecipa fevereiro
  A.confirm(st, occ[0], { paidDate: '2026-10-12' });
  A.confirm(st, occ[4], { paidDate: '2026-10-12' });
  st.meta.rev++;
  data = E.build(st, '2027-03-31');
  const dec = data.items.find((i) => i.src === 'series' && i.date === '2026-12-31');
  A.editOccurrence(st, dec, { amount: 170000 }, 'future'); st.meta.rev++;
  data = E.build(st, '2027-03-31');
  const all = data.items.filter((i) => (i.src === 'series' && (i.id === 's1' || st.series.find((s) => s.id === i.id)?.parentId === 's1')) || (i.src === 'entry' && i.ref.seriesRef));
  eq(all.length, 6, 'sem duplicação');
  eq(all.map((i) => [i.date, i.amount, i.status === 'pago']), [['2026-10-12', 150000, true], ['2026-10-12', 150000, true], ['2026-11-30', 150000, false], ['2026-12-31', 170000, false], ['2027-01-31', 170000, false], ['2027-03-31', 170000, false]]);
});

t('cancelar uma ocorrência remove a saída prevista', () => {
  const st = base();
  st.series.push({ id: 's1', type: 'despesa', description: 'Academia', amount: 10000, nature: 'pessoal', accountId: 'pes1', frequency: 'mensal', startDate: '2026-11-05' });
  let data = E.build(st, '2027-01-31');
  A.cancelOccurrence(st, data.items.find((i) => i.src === 'series')); st.meta.rev++;
  data = E.build(st, '2027-01-31');
  eq(E.projection(st, { to: '2027-01-31', data }).totalOut, 20000);
});

t('importação CSV detecta duplicidades', () => {
  const st = base();
  st.entries.push({ id: 'x', type: 'despesa', description: 'Padaria', amount: 1250, nature: 'pessoal', accountId: 'pes1', dueDate: '2026-10-05', paidDate: '2026-10-05', status: 'pago' });
  const { rows } = A.parseCSV('Data;Descrição;Valor\n05/10/2026;Padaria;-12,50\n06/10/2026;"Mercado; feira";-80,00\n06/10/2026;"Mercado; feira";-80,00\n07/10/2026;Pix cliente;1.500,00\n32/10/2026;Erro;10');
  const prev = A.csvPreview(st, rows, { map: { date: 0, desc: 1, amount: 2 }, hasHeader: true, signMode: 'sinal', accountId: 'pes1', nature: 'pessoal' });
  eq(prev.map((r) => [r.dup, r.include, r.type]), [['já existe no painel', false, 'despesa'], [null, true, 'despesa'], ['repetido no arquivo', false, 'despesa'], [null, true, 'receita'], [null, false, 'receita']]);
  eq(A.csvCommit(st, prev), 2);
  eq(A.csvCommit(st, A.csvPreview(st, rows, { map: { date: 0, desc: 1, amount: 2 }, hasHeader: true, signMode: 'sinal', accountId: 'pes1', nature: 'pessoal' })), 0, 'reimportar não duplica');
});

t('simulação não altera os dados reais', () => {
  const st = base();
  st.clients.push({ id: 'c1', name: 'Trívia', amount: 200000, startDate: '2026-10-01', dueDay: 20, status: 'ativo', adjustments: [], accountId: 'pj' });
  const snap = JSON.stringify(st);
  const r = SIM.run(st, [{ type: 'fim_contrato', clientId: 'c1', endDate: '2026-11-30' }, { type: 'compra', description: 'Câmera', amount: 400000, cardId: 'cp', n: 4, date: '2026-10-12' }, { type: 'retirada', amount: 100000, date: '2026-10-20', monthly: true, months: 3 }], 6);
  eq(JSON.stringify(st), snap, 'estado real idêntico');
  eq(r.errors, []);
  if (!(r.after.end < r.before.end)) throw new Error('cenário deveria reduzir o saldo final');
});

t('backup: exportar e restaurar preserva os dados', () => {
  const st = base();
  st.entries.push({ id: 'x', type: 'receita', description: 'Venda', amount: 5000, nature: 'profissional', accountId: 'pj', dueDate: '2026-10-20', status: 'previsto' });
  const json = JSON.stringify({ app: 'painel-financeiro-mel', version: 1, exportedAt: 'x', data: st });
  const obj = JSON.parse(json);
  eq(M.validateBackup(obj), []);
  const restored = M.migrate(obj.data);
  eq(JSON.stringify(restored.entries), JSON.stringify(st.entries)); eq(restored.accounts.length, 3);
  eq(M.validateBackup({ foo: 1 }).length > 0, true, 'arquivo estranho é recusado');
});

t('projeção: menor saldo e primeiro dia de falta', () => {
  const st = base();
  st.entries.push({ id: 'big', type: 'despesa', description: 'Conta grande', amount: 150000, nature: 'pessoal', accountId: 'pes1', dueDate: '2026-10-20', status: 'previsto' });
  const p = E.projection(st, { to: '2026-12-31', nature: 'pessoal' });
  eq(p.start, 100000); eq(p.firstNeg, '2026-10-20'); eq(p.minBal, -50000);
});

t('despesa pessoal paga pela conta PJ vira retirada implícita', () => {
  const st = base();
  st.entries.push({ id: 'luz', type: 'despesa', description: 'Luz', amount: 20000, categoryId: 'c_pes_casa', nature: 'pessoal', accountId: 'pj', dueDate: '2026-10-12', paidDate: '2026-10-12', status: 'pago', paidAt: 5 });
  const data = E.build(st, '2026-12-31');
  const rp = E.results(st, data, 'profissional', ['2026-10']), rs = E.results(st, data, 'pessoal', ['2026-10']);
  eq(rp.despesa.total, 0, 'não reduz resultado operacional'); eq(rp.retirada.total, 20000);
  eq(rs.despesa.total, 20000); eq(rs.recurso.total, 20000);
});

t('dívida com juros desconhecidos não inventa taxa; estratégias comparáveis', () => {
  const st = base();
  st.debts.push({ id: 'a', creditor: 'Empréstimo A', nature: 'pessoal', balance: 300000, balanceDate: '2026-10-12', rate: 5, ratePeriod: 'mensal', installmentAmount: 30000, installmentsLeft: 12, nextDueDate: '2026-11-05', status: 'ativa' });
  st.debts.push({ id: 'b', creditor: 'Conta atrasada', nature: 'pessoal', balance: 50000, balanceDate: '2026-10-12', rate: null, status: 'ativa', type: 'conta_atrasada', overdueSince: '2026-09-01' });
  const data = E.build(st, '2027-12-31');
  const i = E.debtInfo(st, data, st.debts[1]); eq(i.monthlyRate, null); eq(i.monthlyInterest, null);
  const j = E.payoff(st, data, 60000, 'juros'), s = E.payoff(st, data, 60000, 'saldo');
  if (!j.done || !s.done) throw new Error('deveria quitar');
  if (!(j.totalInterest <= s.totalInterest)) throw new Error('juros maiores primeiro não deveria custar mais juros neste caso');
  eq(j.notes.some((n) => n.includes('taxa desconhecida')), true);
  eq(E.payoff(st, data, 10000, 'juros').infeasible, true, 'orçamento menor que parcelas contratuais');
});

t('acordo substitui dívidas sem contar as duas', () => {
  const st = base();
  st.debts.push({ id: 'b', creditor: 'Banco', nature: 'pessoal', balance: 200000, balanceDate: '2026-10-12', installmentAmount: 25000, installmentsLeft: 10, nextDueDate: '2026-10-20', status: 'ativa' });
  A.agreement(st, { debtIds: ['b'], creditor: 'Acordo Banco', entry: 20000, n: 6, installment: 30000, firstDue: '2026-11-20', accountId: 'pes1' }); st.meta.rev++;
  const data = E.build(st, '2027-12-31');
  eq(data.items.filter((i) => i.src === 'debt' && i.id === 'b').length, 0);
  eq(U.sum(data.items.filter((i) => (i.src === 'debt' || (i.src === 'entry' && i.ref.debtRef))), (i) => i.amount), 200000);
});

t('acumulação: taxa anual convertida corretamente', () => {
  const r = E.accumulate({ initial: 0, monthly: 10000, months: 12, rate: 12, ratePeriod: 'anual', timing: 'fim' });
  const rm = Math.pow(1.12, 1 / 12) - 1;
  if (Math.abs(r.monthlyRate - rm) > 1e-12) throw new Error('taxa mensal equivalente errada');
  eq(r.contributed, 120000);
  if (!(r.final > 120000 && r.final < 127000)) throw new Error('saldo final fora do esperado: ' + r.final);
  const z = E.accumulate({ initial: 1000, monthly: 0, months: 3, rate: 0 }); eq(z.final, 1000);
});

t('alertas usam dados reais e não quebram com estado vazio', () => {
  const empty = M.defaultState();
  const a0 = E.alerts(empty);
  eq(a0.some((a) => a.key === 'setup'), true);
  const st = base();
  st.purchases.push({ id: 'pz', kind: 'compra', cardId: 'cm', description: 'Sapato', date: '2026-10-10', nature: 'pessoal', mode: 'total', total: 20000, n: 1, firstInvoice: '2026-11', status: 'ativa' });
  st.meta.rev++;
  eq(E.alerts(st).some((a) => a.kind === 'evitar'), true, 'compra no cartão a evitar');
});

console.log(`\n${pass} ok, ${fail} falhas`);
process.exit(fail ? 1 : 0);
