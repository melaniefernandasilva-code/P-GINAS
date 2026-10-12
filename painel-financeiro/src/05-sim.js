/* Simulador de decisões: aplica hipóteses sobre uma cópia do estado e compara. */
const SIM = (() => {
  const TYPES = {
    novo_cliente: 'Novo cliente',
    venda_pontual: 'Venda pontual',
    fim_contrato: 'Fim de contrato',
    atraso: 'Atraso de recebimento',
    compra: 'Compra à vista ou parcelada',
    pix: 'Pix no crédito',
    negociacao: 'Negociação de dívida',
    corte: 'Corte de gasto recorrente',
    retirada: 'Retirada pessoal',
    aporte: 'Aporte em reserva ou objetivo',
    prazo: 'Mudança de prazo de objetivo',
  };

  function describe(st, h) {
    const name = (coll, id) => (st[coll].find((x) => x.id === id) || {}).name || (st[coll].find((x) => x.id === id) || {}).creditor || (st[coll].find((x) => x.id === id) || {}).description || '?';
    switch (h.type) {
      case 'novo_cliente': return `Novo cliente "${h.name}" de ${U.money(h.amount)} por mês a partir de ${U.fmtDate(h.startDate)}` + (h.months ? ` por ${U.plural(h.months, 'mês', 'meses')}` : ', sem data de término');
      case 'venda_pontual': return `Venda pontual "${h.description}" de ${U.money(h.amount)} em ${U.fmtDate(h.date)}`;
      case 'fim_contrato': return `Contrato de ${name('clients', h.clientId)} terminando em ${U.fmtDate(h.endDate)}`;
      case 'atraso': return `Pagamentos de ${name('clients', h.clientId)} chegando ${U.plural(h.days, 'dia')} depois`;
      case 'compra': return `Compra "${h.description}" de ${U.money(h.amount)} ` + (h.cardId ? `no cartão ${name('cards', h.cardId)} em ${h.n || 1}x` : `à vista em ${U.fmtDate(h.date)}`);
      case 'pix': return `Pix no crédito: recebe ${U.money(h.net)}, paga ${U.money(h.total)} em ${h.n}x no cartão ${name('cards', h.cardId)}`;
      case 'negociacao': return `Acordo: entrada de ${U.money(h.entry || 0)} e ${h.n}x de ${U.money(h.installment)}, substituindo ${h.debtIds.map((id) => name('debts', id)).join(', ')}`;
      case 'corte': return `Reduzir "${name('series', h.seriesId)}" para ${U.money(h.newAmount)} a partir de ${U.fmtDate(h.fromDate)}`;
      case 'retirada': return h.monthly ? `Retirada de ${U.money(h.amount)} por mês durante ${U.plural(h.months || 1, 'mês', 'meses')}, a partir de ${U.fmtDate(h.date)}` : `Retirada única de ${U.money(h.amount)} em ${U.fmtDate(h.date)}`;
      case 'aporte': return h.monthly ? `Aporte mensal de ${U.money(h.amount)} em ${name('reserves', h.reserveId)}` : `Aporte de ${U.money(h.amount)} em ${name('reserves', h.reserveId)} em ${U.fmtDate(h.date)}`;
      case 'prazo': return `Novo prazo de ${name('reserves', h.reserveId)}: ${U.fmtDate(h.deadline)}`;
    }
    return h.type;
  }

  // Aplica a hipótese no estado informado. real=true quando o usuário confirma aplicar nos dados reais.
  function apply(st, h, real = false) {
    const cert = real ? 'confirmado' : 'hipotetico';
    const T = E.today();
    switch (h.type) {
      case 'novo_cliente': {
        const endDate = h.months ? U.addDays(U.addMonths(h.startDate, h.months), -1) : null;
        st.clients.push({ id: U.uid('cl_'), name: h.name, serviceId: h.serviceId || null, amount: h.amount, startDate: h.startDate, endDate, dueDay: h.dueDay || U.parse(h.startDate).d, frequency: 'mensal', status: 'ativo', renewal: endDate ? 'nao_confirmada' : 'sem_termino', adjustments: [], accountId: h.accountId || st.settings.defaultProAccountId, categoryId: 'c_pro_mens', notes: real ? 'Criado a partir do simulador' : '', hypothetical: !real });
        break;
      }
      case 'venda_pontual':
        st.entries.push({ id: U.uid('e_'), type: 'receita', description: h.description, amount: h.amount, categoryId: 'c_pro_pont', nature: 'profissional', accountId: h.accountId || st.settings.defaultProAccountId, dueDate: h.date, status: 'previsto', certainty: cert, createdAt: Date.now() });
        break;
      case 'fim_contrato': {
        const c = st.clients.find((x) => x.id === h.clientId); if (c) { c.endDate = h.endDate; c.renewal = 'nao_confirmada'; }
        break;
      }
      case 'atraso': {
        const c = st.clients.find((x) => x.id === h.clientId); if (c) c.delayDays = (c.delayDays || 0) + (h.days || 0);
        break;
      }
      case 'compra': {
        if (h.cardId) {
          const card = st.cards.find((c) => c.id === h.cardId);
          st.purchases.push({ id: U.uid('p_'), kind: 'compra', cardId: h.cardId, description: h.description, date: h.date, categoryId: h.categoryId || null, nature: h.nature || 'pessoal', mode: 'total', total: h.amount, n: h.n || 1, firstInvoice: E.invoiceMonthFor(card, h.date), status: 'ativa', createdAt: Date.now(), hypothetical: !real });
        } else st.entries.push({ id: U.uid('e_'), type: 'despesa', description: h.description, amount: h.amount, categoryId: h.categoryId || null, nature: h.nature || 'pessoal', accountId: h.accountId, dueDate: h.date, status: 'previsto', certainty: cert, createdAt: Date.now() });
        break;
      }
      case 'pix':
        A.pixCredit(st, { cardId: h.cardId, net: h.net, total: h.total, n: h.n, date: h.date || T, destination: h.accountId ? 'conta' : 'nenhum', accountId: h.accountId, description: h.description || 'Pix no crédito', nature: h.nature || 'pessoal' });
        break;
      case 'negociacao':
        A.agreement(st, { debtIds: h.debtIds, creditor: h.creditor || 'Acordo simulado', entry: h.entry || 0, entryDate: h.entryDate || T, n: h.n, installment: h.installment, firstDue: h.firstDue, accountId: h.accountId || null });
        break;
      case 'corte': {
        const s = st.series.find((x) => x.id === h.seriesId);
        if (!s) break;
        let n = 0; const anchor = U.parse(s.startDate).d;
        while (E.nth(s.startDate, s.frequency, n, anchor) < h.fromDate && n < 2000) n++;
        A.splitSeries(st, s.id, n, { amount: h.newAmount });
        break;
      }
      case 'retirada': {
        const pj = h.fromId || st.accounts.find((a) => a.type === 'pj' && !a.archived)?.id;
        const pes = h.toId || st.accounts.find((a) => a.type === 'pessoal' && !a.archived)?.id;
        if (!pj || !pes) throw new Error('Cadastre uma conta PJ e uma pessoal para simular retiradas.');
        const times = h.monthly ? (h.months || 1) : 1;
        for (let i = 0; i < times; i++) A.transfer(st, { fromId: pj, toId: pes, amount: h.amount, date: U.addMonths(h.date, i), status: 'previsto', purpose: 'retirada', description: 'Retirada pessoal' + (real ? '' : ' (simulada)') });
        break;
      }
      case 'aporte': {
        const r = st.reserves.find((x) => x.id === h.reserveId); if (!r) break;
        if (h.monthly) { r.monthlyPlan = h.amount; r.planAccountId = h.accountId || r.planAccountId; }
        else st.entries.push({ id: U.uid('e_'), type: 'reserva', reserveId: r.id, op: 'aporte', amount: h.amount, accountId: h.accountId || r.planAccountId, dueDate: h.date, status: 'previsto', description: `Aporte em ${r.name}`, createdAt: Date.now() });
        break;
      }
      case 'prazo': {
        const r = st.reserves.find((x) => x.id === h.reserveId); if (!r) break;
        r.deadline = h.deadline;
        const info = E.reserveInfo(st, E.build(st, U.addMonths(T, 6)), r);
        if (info.requiredMonthly) r.monthlyPlan = info.requiredMonthly;
        break;
      }
    }
    st.meta.rev++;
  }

  function metrics(st, months) {
    const T = E.today();
    const to = U.addMonths(T, months || st.settings.horizon || 6);
    const data = E.build(st, to);
    const p = E.projection(st, { to, data });
    const pp = E.projection(st, { to, nature: 'pessoal', data });
    const pr = E.projection(st, { to, nature: 'profissional', data });
    const to90 = U.addDays(T, 90);
    const commit90 = U.sum(p.events.filter((e) => e.delta < 0 && e.date <= to90), (e) => -e.delta);
    const debts = st.debts.filter((d) => d.status === 'ativa').map((d) => E.debtInfo(st, data, d));
    const debtTotal = U.sum(debts, (x) => x.balance || 0);
    const budget = st.settings.debtBudget || U.sum(debts, (x) => x.pay || 0);
    const pay = budget ? E.payoff(st, data, budget, 'juros') : null;
    const reserves = st.reserves.filter((r) => !r.archived).map((r) => {
      const info = E.reserveInfo(st, data, r);
      const planned = U.sum(data.items.filter((i) => i.src === 'plan' && i.id === r.id), (i) => i.amount) + U.sum(st.entries.filter((e) => e.type === 'reserva' && e.reserveId === r.id && e.status === 'previsto' && e.dueDate <= to), (e) => e.amount);
      const endBal = info.balance + planned;
      return { name: r.name, endBal, target: info.target, progress: info.target ? Math.min(1, endBal / info.target) : null };
    });
    return { to, end: p.end, minBal: p.minBal, minDate: p.minDate, firstNeg: p.firstNeg, negDays: p.negDays, pesFirstNeg: pp.firstNeg, pesMin: pp.minBal, proFirstNeg: pr.firstNeg, proMin: pr.minBal, commit90, debtTotal, payoffMonths: pay && !pay.infeasible && !pay.empty ? pay.months : null, payoffInfeasible: !!(pay && pay.infeasible), reserves, proj: p };
  }

  function run(st, hyps, months) {
    const before = metrics(st, months);
    const clone = U.clone(st);
    const errors = [];
    for (const h of hyps) { try { apply(clone, h, false); } catch (e) { errors.push(`${TYPES[h.type]}: ${e.message}`); } }
    const after = metrics(clone, months);
    return { before, after, errors };
  }

  return { TYPES, describe, apply, metrics, run };
})();
if (typeof module !== 'undefined') module.exports = { SIM };
