/* Motor de cálculo. Funções puras sobre o estado: ocorrências, faturas,
   saldos, projeções, resultados por natureza, dívidas, reservas e alertas.
   Regras centrais:
   - Valores sempre em centavos (inteiros).
   - Lançamentos recorrentes geram ocorrências virtuais; ao confirmar ou editar uma,
     ela vira um lançamento real com referência (seriesRef/clientRef/debtRef) e a
     virtual deixa de existir. Isso evita duplicação.
   - Compras no cartão geram despesa por categoria no mês da fatura. O pagamento da
     fatura só movimenta o caixa.
   - Transferências, aportes em reserva, Pix no crédito e empréstimos recebidos não
     contam como receita nem despesa.
   - A natureza do dinheiro em caixa segue o tipo da conta (PJ = profissional).
     Despesa pessoal paga com conta PJ vira retirada implícita, e vice-versa. */
const E = (() => {
  let TODAY = null;
  const today = () => TODAY || U.today();
  const setToday = (d) => { TODAY = d; };
  const orgStart = (st) => st.settings.startDate || today();

  const FREQ = { semanal: { d: 7 }, quinzenal: { d: 14 }, mensal: { m: 1 }, bimestral: { m: 2 }, trimestral: { m: 3 }, semestral: { m: 6 }, anual: { m: 12 } };
  const FREQ_LABEL = { semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };
  const monthlyFactor = (freq) => { const f = FREQ[freq] || FREQ.mensal; return f.d ? 30.4375 / f.d : 1 / f.m; };

  function nth(start, freq, n, anchor) {
    const f = FREQ[freq] || FREQ.mensal;
    return f.d ? U.addDays(start, f.d * n) : U.addMonths(start, f.m * n, anchor);
  }
  // Percorre ocorrências com data em [from, to]
  function occ(start, freq, { count = null, end = null, from = null, to, anchor }, cb) {
    if (!start || !to) return;
    const f = FREQ[freq] || FREQ.mensal;
    let n = 0;
    if (from && from > start) {
      n = f.d ? Math.floor(U.diffDays(start, from) / f.d) - 1 : Math.floor(U.monthsDiff(start, from) / f.m) - 1;
      n = Math.max(0, n);
    }
    for (let guard = 0; guard < 3000; n++, guard++) {
      if (count != null && n >= count) break;
      const d = nth(start, freq, n, anchor);
      if (end && d > end) break;
      if (d > to) break;
      if (!from || d >= from) cb(n, d);
    }
  }

  const accNatureOf = (a) => (a ? (a.type === 'pj' ? 'profissional' : 'pessoal') : null);

  function clientFirstDue(c) {
    if (!c.startDate) return null;
    const p = U.parse(c.startDate);
    let d0 = U.iso(p.y, p.m, c.dueDay || p.d);
    if (d0 < c.startDate) d0 = U.addMonths(d0, 1, c.dueDay || p.d);
    return d0;
  }
  function clientAmountAt(c, date) {
    let amt = c.amount || 0;
    const adj = (c.adjustments || []).filter((a) => a.confirmed && a.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (adj.length) amt = adj[adj.length - 1].amount;
    return amt;
  }
  function clientEnd(c) {
    if (c.status === 'encerrado') return c.endDate || c.closedDate || today();
    return c.endDate || null;
  }

  // Fatura: mês (AAAA-MM) do vencimento em que uma compra feita em "date" cai
  function invoiceMonthFor(card, date) {
    if (!card || !date) return date ? U.monthKey(date) : null;
    const p = U.parse(date);
    const cd = card.closingDay || 1, dd = card.dueDay || 10;
    let closing = U.iso(p.y, p.m, cd);
    if (date >= closing) closing = U.addMonths(closing, 1, cd);
    const c = U.parse(closing);
    const due = dd > cd ? U.iso(c.y, c.m, dd) : U.iso(c.y, c.m + 1, dd);
    return U.monthKey(due);
  }
  function invoiceDueDate(st, card, month) {
    const inv = st.invoices[`${card.id}|${month}`];
    if (inv && inv.dueOverride) return inv.dueOverride;
    return U.iso(+month.slice(0, 4), +month.slice(5, 7), card.dueDay || 10);
  }

  // Parcelas de uma compra: [{i, month, amount, fee, label}]
  function purchaseInstallments(p) {
    if (!p || p.status === 'cancelada' || !p.firstInvoice) return [];
    let amounts, offset = 0, total;
    if (p.mode === 'restante') {
      const n = Math.max(0, p.remaining || 0);
      amounts = Array.isArray(p.customAmounts) && p.customAmounts.length === n ? p.customAmounts.slice() : Array.from({ length: n }, () => p.installmentValue || 0);
      offset = p.paidBefore || 0;
      total = offset + n;
    } else {
      const n = Math.max(1, p.n || 1);
      amounts = Array.isArray(p.customAmounts) && p.customAmounts.length === n ? p.customAmounts.slice() : U.split(p.total || 0, n);
      total = n;
    }
    // Pix no crédito: parte de juros/tarifas distribuída pelas parcelas
    let fees = amounts.map(() => 0);
    if (p.kind === 'pix_credito') {
      const sumAmt = U.sum(amounts);
      const feeTotal = p.net != null ? Math.max(0, sumAmt - p.net) : (p.fees || 0);
      if (sumAmt > 0 && feeTotal > 0) {
        fees = amounts.map((a) => Math.floor(feeTotal * a / sumAmt));
        fees[0] += feeTotal - U.sum(fees);
      }
    }
    return amounts.map((amount, i) => ({ i, month: U.addMonthKey(p.firstInvoice, i), amount, fee: fees[i], label: total > 1 ? `${offset + i + 1}/${total}` : '' }));
  }

  function monthlyRate(d) {
    if (d.rate === null || d.rate === undefined || d.rate === '') return null;
    const r = Number(d.rate) / 100;
    if (!isFinite(r)) return null;
    return d.ratePeriod === 'anual' ? Math.pow(1 + r, 1 / 12) - 1 : r;
  }

  /* ---------- Construção do razão (itens de caixa e de resultado) ---------- */
  const cache = new WeakMap();

  function build(st, to) {
    const T = today();
    const key = `${st.meta.rev}|${to}|${T}|${st.settings.startDate}`;
    const c = cache.get(st);
    if (c && c.key === key) return c.data;
    const data = buildRaw(st, to);
    cache.set(st, { key, data });
    return data;
  }

  function buildRaw(st, to) {
    const T = today();
    const os = orgStart(st);
    const acc = Object.fromEntries(st.accounts.map((a) => [a.id, a]));
    const cards = Object.fromEntries(st.cards.map((c) => [c.id, c]));
    const cats = Object.fromEntries(st.categories.map((c) => [c.id, c]));
    const accNat = (id) => accNatureOf(acc[id]);
    const items = [];
    const status = (paid, due) => (paid ? 'pago' : due < T ? 'vencido' : 'previsto');

    const mat = { s: new Map(), c: new Map(), d: new Map(), ps: new Map() };
    for (const e of st.entries) {
      if (e.seriesRef) mat.s.set(e.seriesRef.id + '#' + e.seriesRef.n, e);
      if (e.clientRef) mat.c.set(e.clientRef.id + '#' + e.clientRef.n, e);
      if (e.debtRef) mat.d.set(e.debtRef.id + '#' + e.debtRef.n, e);
    }
    for (const p of st.purchases) if (p.seriesRef) mat.ps.set(p.seriesRef.id + '#' + p.seriesRef.n, p);

    // Retirada ou aporte implícito quando a natureza do lançamento difere da conta
    function cross(nature, accountId, amount, month, outflow) {
      const an = accNat(accountId);
      if (!an || an === nature || !amount) return [];
      const fromPro = outflow ? an === 'profissional' : nature === 'profissional';
      return fromPro
        ? [{ nature: 'profissional', kind: 'retirada', amount, month, implicit: true }, { nature: 'pessoal', kind: 'recurso', amount, month, implicit: true }]
        : [{ nature: 'pessoal', kind: 'aporte_pro', amount, month, implicit: true }, { nature: 'profissional', kind: 'aporte_recebido', amount, month, implicit: true }];
    }

    function pushFlow(base, { type, nature, amount, accountId, categoryId, debt, certainty, paidByPurchase }) {
      const month = U.monthKey(base.status === 'pago' ? (base.paidDate || base.date) : base.dueDate || base.date);
      const it = { ...base, type, nature, amount, accountId, categoryId, certainty, month, cash: [], pnl: [] };
      if (base.status === 'cancelado') { items.push(it); return it; }
      if (type === 'receita') {
        it.cash.push({ accountId, delta: amount });
        it.pnl.push({ nature, kind: 'receita', categoryId, amount, month }, ...cross(nature, accountId, amount, month, false));
      } else {
        if (!paidByPurchase) it.cash.push({ accountId, delta: -amount });
        it.pnl.push({ nature, kind: debt ? 'divida' : 'despesa', categoryId, amount, month });
        if (!paidByPurchase) it.pnl.push(...cross(nature, accountId, amount, month, true));
      }
      items.push(it);
      return it;
    }

    // 1) Lançamentos reais
    const invoicePayments = {};
    for (const e of st.entries) {
      const paid = e.status === 'pago';
      const cancelled = e.status === 'cancelado';
      const date = paid ? (e.paidDate || e.dueDate) : e.dueDate;
      const base = { key: 'e:' + e.id, src: 'entry', id: e.id, ref: e, date, dueDate: e.dueDate, paidDate: e.paidDate, paidAt: e.paidAt || 0, status: cancelled ? 'cancelado' : status(paid, e.dueDate), desc: e.description };
      if (e.type === 'receita' || e.type === 'despesa') {
        pushFlow(base, { type: e.type, nature: e.nature, amount: e.amount, accountId: e.accountId, categoryId: e.categoryId, debt: !!e.debtRef, certainty: e.clientRef ? 'contratado' : (e.certainty || 'confirmado'), paidByPurchase: !!e.paidByPurchaseId });
      } else if (e.type === 'transferencia') {
        const it = { ...base, type: 'transferencia', amount: e.amount, nature: null, month: U.monthKey(date), certainty: 'confirmado', cash: [], pnl: [] };
        if (!cancelled) {
          it.cash.push({ accountId: e.fromId, delta: -e.amount }, { accountId: e.toId, delta: e.amount });
          const fn = accNat(e.fromId), tn = accNat(e.toId);
          if (fn && tn && fn !== tn) {
            if (fn === 'profissional') it.pnl.push({ nature: 'profissional', kind: 'retirada', amount: e.amount, month: it.month }, { nature: 'pessoal', kind: 'recurso', amount: e.amount, month: it.month });
            else it.pnl.push({ nature: 'pessoal', kind: 'aporte_pro', amount: e.amount, month: it.month }, { nature: 'profissional', kind: 'aporte_recebido', amount: e.amount, month: it.month });
          }
        }
        items.push(it);
      } else if (e.type === 'fatura') {
        const it = { ...base, type: 'fatura', amount: e.amount, accountId: e.accountId, cardId: e.cardId, invMonth: e.month, month: U.monthKey(date), certainty: 'confirmado', cash: [], pnl: [] };
        if (!cancelled) {
          it.cash.push({ accountId: e.accountId, delta: -e.amount });
          if (paid) (invoicePayments[`${e.cardId}|${e.month}`] = invoicePayments[`${e.cardId}|${e.month}`] || []).push(e);
        }
        items.push(it);
      } else if (e.type === 'reserva') {
        const it = { ...base, type: 'reserva', amount: e.amount, accountId: e.accountId, reserveId: e.reserveId, op: e.op, month: U.monthKey(date), certainty: 'confirmado', cash: [], pnl: [] };
        if (!cancelled && e.accountId && e.op !== 'rendimento') it.cash.push({ accountId: e.accountId, delta: e.op === 'retirada' ? e.amount : -e.amount });
        items.push(it);
      } else if (e.type === 'ajuste') {
        items.push({ ...base, type: 'ajuste', amount: e.delta, accountId: e.accountId, month: U.monthKey(date), certainty: 'confirmado', cash: cancelled ? [] : [{ accountId: e.accountId, delta: e.delta }], pnl: [] });
      } else if (e.type === 'credito') {
        const it = { ...base, type: 'credito', amount: e.amount, accountId: e.accountId, nature: e.nature, month: U.monthKey(date), certainty: 'confirmado', cash: [], pnl: [] };
        if (!cancelled) { it.cash.push({ accountId: e.accountId, delta: e.amount }); it.pnl.push({ nature: e.nature, kind: 'credito', amount: e.amount, month: it.month }); }
        items.push(it);
      }
    }

    // 2) Recorrências (ocorrências virtuais)
    const virtualCard = [];
    for (const s of st.series) {
      if (s.archived || !s.startDate) continue;
      const card = s.cardId ? cards[s.cardId] : null;
      occ(s.startDate, s.frequency, { count: s.count ?? null, end: s.endDate || null, from: U.maxDate(os, s.startDate), to, anchor: U.parse(s.startDate).d }, (n, d) => {
        const k = s.id + '#' + n;
        const total = s.count ? s.count + (s.labelOffset || 0) : null;
        const label = total ? `${n + 1 + (s.labelOffset || 0)}/${total}` : '';
        if (card) {
          if (mat.ps.has(k)) return;
          virtualCard.push({ id: 'vs:' + k, virtual: true, cardId: card.id, description: s.description, date: d, categoryId: s.categoryId, nature: s.nature, kind: 'compra', mode: 'total', total: s.amount, n: 1, firstInvoice: invoiceMonthFor(card, d), seriesRef: { id: s.id, n }, status: 'ativa', label });
          return;
        }
        if (mat.s.has(k)) return;
        const base = { key: 's:' + k, src: 'series', id: s.id, n, ref: s, virtual: true, date: d, dueDate: d, status: status(false, d), desc: s.description, label };
        pushFlow(base, { type: s.type, nature: s.nature, amount: s.amount, accountId: s.accountId, categoryId: s.categoryId, certainty: s.certainty || 'confirmado' });
      });
    }

    // 3) Clientes: mensalidades dentro da vigência
    for (const c of st.clients) {
      if (c.archived || c.status === 'pausado') continue;
      const d0 = clientFirstDue(c);
      if (!d0) continue;
      occ(d0, c.frequency || 'mensal', { end: clientEnd(c), from: os, to, anchor: c.dueDay || U.parse(d0).d }, (n, d0n) => {
        if (mat.c.has(c.id + '#' + n)) return;
        const d = c.delayDays ? U.addDays(d0n, c.delayDays) : d0n; // atraso simulado
        const base = { key: 'c:' + c.id + '#' + n, src: 'client', id: c.id, n, ref: c, virtual: true, date: d, dueDate: d, status: status(false, d), desc: c.name };
        pushFlow(base, { type: 'receita', nature: 'profissional', amount: clientAmountAt(c, d), accountId: c.accountId || st.settings.defaultProAccountId, categoryId: c.categoryId || 'c_pro_mens', certainty: 'contratado' });
      });
    }

    // 4) Dívidas (não vinculadas a cartão)
    for (const d of st.debts) {
      if (d.status !== 'ativa' || (d.linkedPurchaseIds && d.linkedPurchaseIds.length)) continue;
      const accountId = d.payAccountId || st.settings.defaultPesAccountId;
      const mk = (n, date, amount, extra = {}) => {
        if (mat.d.has(d.id + '#' + n)) return;
        const base = { key: 'd:' + d.id + '#' + n, src: 'debt', id: d.id, n, ref: d, virtual: true, date, dueDate: date, status: status(false, date), desc: d.creditor, ...extra };
        pushFlow(base, { type: 'despesa', nature: d.nature || 'pessoal', amount, accountId, categoryId: null, debt: true, certainty: extra.estimated ? 'estimado' : 'contratado' });
      };
      if (d.installmentAmount && d.installmentsLeft && d.nextDueDate) {
        const anchor = U.parse(d.nextDueDate).d;
        occ(d.nextDueDate, 'mensal', { count: d.installmentsLeft, to, anchor }, (n, date) => mk(n, date, d.installmentAmount, { label: `${n + 1}/${d.installmentsLeft} restantes` }));
      } else if (d.minPayment && d.nextDueDate) {
        const anchor = U.parse(d.nextDueDate).d;
        occ(d.nextDueDate, 'mensal', { to, anchor }, (n, date) => mk(n, date, d.minPayment, { estimated: true, label: 'pagamento mínimo' }));
      } else {
        const info = debtBalanceEstimate(st, d, T);
        mk(0, d.nextDueDate || T, info.balance || 0, { unknownAmount: info.balance == null, label: 'saldo total' });
      }
    }

    // 5) Cartões: parcelas por fatura
    const invoices = {};
    const getInv = (cardId, month) => {
      const k = `${cardId}|${month}`;
      if (!invoices[k]) {
        const card = cards[cardId];
        const dueDate = card ? invoiceDueDate(st, card, month) : U.iso(+month.slice(0, 4), +month.slice(5, 7), 10);
        invoices[k] = { key: k, cardId, month, dueDate, items: [], itemsTotal: 0, informed: st.invoices[k]?.informed ?? null, payments: invoicePayments[k] || [], preStart: dueDate < os };
      }
      return invoices[k];
    };
    const allPurch = st.purchases.filter((p) => p.status !== 'cancelada' && cards[p.cardId]).concat(virtualCard);
    for (const p of allPurch) {
      for (const ins of purchaseInstallments(p)) {
        const inv = getInv(p.cardId, ins.month);
        inv.items.push({ p, ...ins, nature: p.nature || cards[p.cardId].defaultNature || 'pessoal', categoryId: p.categoryId, label: ins.label || p.label || '' });
        inv.itemsTotal += ins.amount;
      }
    }
    for (const k of Object.keys(invoicePayments)) { const [cid, m] = k.split('|'); if (cards[cid]) getInv(cid, m); }
    for (const k of Object.keys(st.invoices)) { const [cid, m] = k.split('|'); if (cards[cid] && st.invoices[k].informed != null) getInv(cid, m); }

    const cardRows = [];
    for (const inv of Object.values(invoices)) {
      const card = cards[inv.cardId];
      inv.payable = inv.informed != null ? inv.informed : inv.itemsTotal;
      inv.diff = inv.informed != null ? inv.informed - inv.itemsTotal : 0;
      inv.paid = U.sum(inv.payments, (e) => e.amount);
      inv.remaining = Math.max(0, inv.payable - inv.paid);
      inv.status = inv.preStart && inv.paid === 0 ? 'anterior' : inv.remaining <= 0 && inv.payable > 0 ? 'paga' : inv.paid > 0 ? 'parcial' : inv.dueDate < T ? 'vencida' : 'aberta';
      if (inv.payable === 0 && inv.paid === 0) inv.status = 'sem valor';
      // participação por natureza (itens + diferença na natureza padrão do cartão)
      const share = { pessoal: 0, profissional: 0 };
      for (const it of inv.items) share[it.nature] += it.amount;
      if (inv.diff > 0) share[card.defaultNature || 'pessoal'] += inv.diff;
      const tot = share.pessoal + share.profissional;
      inv.share = tot > 0 ? { pessoal: share.pessoal / tot, profissional: share.profissional / tot } : { pessoal: card.defaultNature === 'profissional' ? 0 : 1, profissional: card.defaultNature === 'profissional' ? 1 : 0 };
      if (inv.status === 'anterior') continue;
      const pst = inv.remaining <= 0 && inv.payable > 0 ? 'pago' : inv.dueDate < T ? 'vencido' : 'previsto';
      for (const it of inv.items) {
        const base = { src: 'card', cardId: inv.cardId, invKey: inv.key, month: inv.month, status: pst, p: it.p, label: it.label, desc: it.p.description, nature: it.nature, date: inv.dueDate, certainty: it.p.virtual ? 'confirmado' : 'contratado' };
        if (it.p.kind === 'pix_credito') {
          if (it.fee) cardRows.push({ ...base, kind: 'despesa', categoryId: it.nature === 'profissional' ? 'sys_juros_pro' : 'sys_juros_pes', amount: it.fee });
          if (it.amount - it.fee) cardRows.push({ ...base, kind: 'divida', categoryId: null, amount: it.amount - it.fee });
        } else cardRows.push({ ...base, kind: 'despesa', categoryId: it.categoryId, amount: it.amount });
      }
      if (inv.diff > 0) {
        const nat = card.defaultNature || 'pessoal';
        cardRows.push({ src: 'card', cardId: inv.cardId, invKey: inv.key, month: inv.month, status: pst, desc: 'Diferença entre fatura informada e compras cadastradas', nature: nat, kind: 'despesa', categoryId: nat === 'profissional' ? 'sys_fatdif_pro' : 'sys_fatdif_pes', amount: inv.diff, date: inv.dueDate, certainty: 'confirmado', isDiff: true });
      }
      // saldo restante da fatura vira saída prevista
      if (inv.remaining > 0) {
        const accountId = card.payAccountId || null;
        const it = { key: 'i:' + inv.key, src: 'invoice', id: inv.key, invKey: inv.key, cardId: inv.cardId, type: 'fatura', virtual: true, date: inv.dueDate, dueDate: inv.dueDate, status: inv.dueDate < T ? 'vencido' : 'previsto', desc: `Fatura ${card.name} ${U.fmtMonth(inv.month)}`, amount: inv.remaining, accountId, month: inv.month, certainty: 'contratado', cash: [{ accountId, delta: -inv.remaining }], pnl: [], nature: inv.share.profissional > 0.5 ? 'profissional' : 'pessoal' };
        for (const n of ['pessoal', 'profissional']) if (inv.share[n] > 0) it.pnl.push(...cross(n, accountId, Math.round(inv.remaining * inv.share[n]), inv.month, true));
        items.push(it);
      }
    }
    // pagamentos de fatura: retirada implícita conforme natureza dos itens
    for (const it of items) {
      if (it.type !== 'fatura' || it.src !== 'entry' || it.status === 'cancelado') continue;
      const inv = invoices[`${it.cardId}|${it.invMonth}`];
      const share = inv ? inv.share : { pessoal: 1, profissional: 0 };
      for (const n of ['pessoal', 'profissional']) if (share[n] > 0) it.pnl.push(...cross(n, it.accountId, Math.round(it.amount * share[n]), it.month, true));
    }

    // 6) Pix no crédito: valor líquido que entrou na conta (crédito, não renda)
    for (const p of st.purchases) {
      if (p.kind !== 'pix_credito' || p.status === 'cancelada' || p.destination !== 'conta' || !p.accountId || !p.net) continue;
      const st2 = p.date <= T ? 'pago' : 'previsto';
      items.push({ key: 'px:' + p.id, src: 'pix', id: p.id, ref: p, type: 'credito', date: p.date, dueDate: p.date, paidDate: p.date, paidAt: p.createdAt || 0, status: st2, desc: 'Pix no crédito: ' + p.description, amount: p.net, accountId: p.accountId, nature: p.nature, month: U.monthKey(p.date), certainty: 'confirmado', cash: [{ accountId: p.accountId, delta: p.net }], pnl: [{ nature: p.nature, kind: 'credito', amount: p.net, month: U.monthKey(p.date) }] });
    }

    // 7) Aportes planejados em reservas e objetivos
    if (st.settings.includePlannedContributions) {
      for (const r of st.reserves) {
        if (r.archived || !r.monthlyPlan || !r.planAccountId) continue;
        let bal = reserveBalance(st, r);
        const startM = U.monthKey(T);
        const endM = U.minDate(U.monthKey(to), r.deadline ? U.monthKey(r.deadline) : null) || U.monthKey(to);
        for (const m of U.monthRange(startM, endM)) {
          if (r.target != null && bal >= r.target) break;
          const date = U.iso(+m.slice(0, 4), +m.slice(5, 7), r.planDay || 5);
          if (date < T || date > to) continue;
          const done = st.entries.some((e) => e.type === 'reserva' && e.reserveId === r.id && e.op === 'aporte' && e.status !== 'cancelado' && U.monthKey(e.paidDate || e.dueDate) === m);
          if (done) continue;
          const amt = r.target != null ? Math.min(r.monthlyPlan, r.target - bal) : r.monthlyPlan;
          bal += amt;
          items.push({ key: 'r:' + r.id + '#' + m, src: 'plan', id: r.id, ref: r, type: 'reserva', op: 'aporte', virtual: true, date, dueDate: date, status: 'previsto', desc: `Aporte planejado: ${r.name}`, amount: amt, accountId: r.planAccountId, nature: r.nature, month: m, certainty: 'planejado', cash: [{ accountId: r.planAccountId, delta: -amt }], pnl: [] });
        }
      }
    }

    const pnlRows = [];
    for (const it of items) {
      if (it.status === 'cancelado') continue;
      for (const p of it.pnl) pnlRows.push({ ...p, status: it.status, certainty: it.certainty, item: it, card: false });
    }
    for (const r of cardRows) pnlRows.push({ ...r, card: true, item: r });

    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return { items, invoices, cardRows, pnlRows, to, today: T, orgStart: os };
  }

  /* ---------- Saldos ---------- */
  function realizedCounts(item, a, upTo) {
    if (item.status !== 'pago') return false;
    const d = item.paidDate || item.date;
    if (upTo && d > upTo) return false;
    if (!a.refDate) return true;
    if (d > a.refDate) return true;
    if (d < a.refDate) return false;
    return (item.paidAt || 0) > (a.balanceSetAt || 0);
  }
  function balances(st, data, upTo) {
    upTo = upTo || today();
    const byId = {};
    for (const a of st.accounts) byId[a.id] = { balance: a.initialBalance || 0, known: a.initialBalance !== null && a.initialBalance !== undefined, account: a };
    let unassigned = 0;
    for (const it of data.items) {
      if (it.status !== 'pago') continue;
      for (const c of it.cash) {
        const b = byId[c.accountId];
        if (!b) { if ((it.paidDate || it.date) <= upTo) unassigned += c.delta; continue; }
        if (realizedCounts(it, b.account, upTo)) b.balance += c.delta;
      }
    }
    const active = st.accounts.filter((a) => !a.archived);
    const total = U.sum(active, (a) => byId[a.id].balance);
    const byNature = { pessoal: 0, profissional: 0 };
    for (const a of active) {
      const b = byId[a.id].balance;
      const n = accNatureOf(a);
      const other = n === 'pessoal' ? 'profissional' : 'pessoal';
      const alloc = a.allocOther ? Math.max(0, Math.min(a.allocOther, Math.max(0, b))) : 0;
      byNature[n] += b - alloc;
      byNature[other] += alloc;
    }
    return { byId, total, byNature, unassigned, unknown: active.filter((a) => !byId[a.id].known).length };
  }

  /* ---------- Projeção de caixa ---------- */
  // opts: {to, accountIds, nature, includeOverdueRecv, extra:[items]}
  function projection(st, opts = {}) {
    const T = today();
    const to = opts.to || U.addMonths(T, st.settings.horizon || 6);
    const data = opts.data || build(st, to);
    const bal = balances(st, data, T);
    const accSet = opts.accountIds ? new Set(opts.accountIds) : null;
    const nature = opts.nature || null;
    const inclRecv = opts.includeOverdueRecv ?? st.settings.overdueReceivables === 'incluir';
    const acc = Object.fromEntries(st.accounts.map((a) => [a.id, a]));
    const accOk = (id, itemNature) => {
      const a = acc[id];
      if (accSet) return accSet.has(id);
      if (!a) return nature ? itemNature === nature : true;
      if (a.archived) return false;
      return nature ? accNatureOf(a) === nature : true;
    };
    let start;
    if (accSet) start = U.sum([...accSet], (id) => bal.byId[id]?.balance || 0);
    else if (nature) start = bal.byNature[nature];
    else start = bal.total;

    const events = [];
    const overdueRecv = [];
    const all = data.items.concat(opts.extra || []);
    for (const it of all) {
      if (it.status === 'cancelado') continue;
      const future = it.status === 'previsto' || it.status === 'vencido' || (it.status === 'pago' && (it.paidDate || it.date) > T);
      if (!future) continue;
      for (const c of it.cash) {
        if (!accOk(c.accountId, it.nature)) continue;
        let date = it.status === 'vencido' ? T : (it.status === 'pago' ? (it.paidDate || it.date) : it.date);
        if (it.status === 'vencido' && c.delta > 0 && !inclRecv) { overdueRecv.push({ it, amount: c.delta }); continue; }
        if (date > to) continue;
        if (date < T) date = T;
        events.push({ date, delta: c.delta, it });
      }
    }
    events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.delta - b.delta));
    const days = [];
    let b = start, minBal = start, minDate = T, firstNeg = start < 0 ? T : null, negDays = 0;
    let ei = 0, totalIn = 0, totalOut = 0;
    const months = {};
    for (let d = T, g = 0; d <= to && g < 4000; d = U.addDays(d, 1), g++) {
      let inn = 0, out = 0; const evs = [];
      while (ei < events.length && events[ei].date === d) { const e = events[ei++]; if (e.delta >= 0) inn += e.delta; else out -= e.delta; evs.push(e); }
      b += inn - out; totalIn += inn; totalOut += out;
      const mk = U.monthKey(d);
      const M = months[mk] = months[mk] || { month: mk, start: b - inn + out, in: 0, out: 0, inBy: {}, outBy: {}, end: 0, min: Infinity, minDate: null };
      M.in += inn; M.out += out; M.end = b;
      for (const e of evs) {
        const c = e.it.certainty || 'confirmado';
        if (e.delta >= 0) M.inBy[c] = (M.inBy[c] || 0) + e.delta;
        else { const t = e.it.src === 'invoice' ? 'cartoes' : e.it.type === 'reserva' ? 'reservas' : e.it.type === 'transferencia' ? 'transferencias' : (e.it.pnl || []).some((p) => p.kind === 'divida') ? 'dividas' : 'despesas'; M.outBy[t] = (M.outBy[t] || 0) - e.delta; }
      }
      if (b < M.min) { M.min = b; M.minDate = d; }
      if (b < minBal) { minBal = b; minDate = d; }
      if (b < 0) { negDays++; if (!firstNeg) firstNeg = d; }
      days.push({ date: d, in: inn, out: out, bal: b, events: evs });
    }
    const partial = [];
    if (bal.unknown) partial.push(`${U.plural(bal.unknown, 'conta')} sem saldo informado`);
    const s = st.setup;
    if (!s.accounts) partial.push('etapa de contas não concluída');
    if (!s.clients) partial.push('clientes ainda não cadastrados');
    if (!s.fixed) partial.push('custos fixos ainda não cadastrados');
    if (!s.cards) partial.push('cartões ainda não cadastrados');
    if (!s.debts) partial.push('dívidas ainda não cadastradas');
    const unassignedOut = events.filter((e) => !acc[e.it.cash.find((c) => c.delta === e.delta)?.accountId]).length;
    if (unassignedOut && !accSet) partial.push(`${U.plural(unassignedOut, 'movimentação', 'movimentações')} sem conta definida`);
    return { from: T, to, start, end: b, totalIn, totalOut, minBal, minDate, firstNeg, negDays, days, months: Object.values(months), overdueRecv, partial, events };
  }

  /* ---------- Resultados por natureza ---------- */
  function results(st, data, nature, months) {
    const set = new Set(months);
    const rows = data.pnlRows.filter((r) => r.nature === nature && set.has(r.month));
    const cats = Object.fromEntries(st.categories.map((c) => [c.id, c]));
    const z = () => ({ pago: 0, previsto: 0, vencido: 0, total: 0 });
    const out = { receita: z(), despesa: z(), divida: z(), retirada: z(), recurso: z(), credito: z(), aporte_pro: z(), aporte_recebido: z(), byCategory: {}, byCertainty: {}, rows, implicitRetirada: 0, implicitRecurso: 0, card: z(), essential: z() };
    for (const r of rows) {
      const b = out[r.kind]; if (!b) continue;
      b[r.status] += r.amount; b.total += r.amount;
      if (r.kind === 'receita') out.byCertainty[r.certainty] = (out.byCertainty[r.certainty] || 0) + r.amount;
      if (r.kind === 'despesa') {
        const k = r.categoryId || 'sem';
        const c = out.byCategory[k] = out.byCategory[k] || { id: k, name: cats[k]?.name || 'Sem categoria', total: 0, pago: 0, previsto: 0, vencido: 0, limit: cats[k]?.limit ?? null, essential: !!cats[k]?.essential };
        c.total += r.amount; c[r.status] += r.amount;
        if (cats[k]?.essential && !r.card) { out.essential[r.status] += r.amount; out.essential.total += r.amount; }
      }
      if (r.card && (r.kind === 'despesa' || r.kind === 'divida')) { out.card[r.status] += r.amount; out.card.total += r.amount; }
      if (r.implicit && r.kind === 'retirada') out.implicitRetirada += r.amount;
      if (r.implicit && r.kind === 'recurso') out.implicitRecurso += r.amount;
    }
    out.resultado = out.receita.total - out.despesa.total;
    out.resultadoRealizado = out.receita.pago - out.despesa.pago;
    return out;
  }

  // Comprometimento da renda pessoal em um período (sem duplicação)
  function commitment(st, data, months) {
    const r = results(st, data, 'pessoal', months);
    const cats = Object.fromEntries(st.categories.map((c) => [c.id, c]));
    const renda = r.receita.total + r.recurso.total;
    let essenciais = 0, cartoes = 0, dividas = 0, outros = 0;
    for (const x of r.rows) {
      if (x.kind !== 'despesa' && x.kind !== 'divida') continue;
      if (x.card) cartoes += x.amount;
      else if (x.kind === 'divida') dividas += x.amount;
      else if (cats[x.categoryId]?.essential) essenciais += x.amount;
      else outros += x.amount;
    }
    const total = essenciais + cartoes + dividas + outros;
    const p = (v) => (renda > 0 ? v / renda : null);
    return { months, renda, essenciais, cartoes, dividas, outros, total, creditos: r.credito.total, pct: { essenciais: p(essenciais), cartoes: p(cartoes), dividas: p(dividas), outros: p(outros), total: p(total) }, sobra: renda - total };
  }

  /* ---------- Dívidas ---------- */
  function debtBalanceEstimate(st, d, T) {
    T = T || today();
    if (d.balance === null || d.balance === undefined) {
      if (d.installmentAmount && d.installmentsLeft) {
        const paidN = st.entries.filter((e) => e.debtRef && e.debtRef.id === d.id && e.status === 'pago').length;
        return { balance: d.installmentAmount * Math.max(0, d.installmentsLeft - paidN), basis: 'parcelas restantes x valor da parcela (sem saldo informado)', estimated: true };
      }
      return { balance: null, basis: 'saldo não informado', estimated: true };
    }
    const paid = U.sum(st.entries.filter((e) => e.debtRef && e.debtRef.id === d.id && e.status === 'pago' && (!d.balanceDate || (e.paidDate || e.dueDate) > d.balanceDate)), (e) => e.amount);
    const r = monthlyRate(d);
    let bal = d.balance;
    let basis = `saldo informado em ${U.fmtDate(d.balanceDate)}`;
    let estimated = false;
    if (r && d.balanceDate && T > d.balanceDate) {
      const months = U.diffDays(d.balanceDate, T) / 30.4375;
      bal = Math.round(d.balance * Math.pow(1 + r, months));
      basis += `, com juros de ${U.pct(r, 2)} ao mês por ${months.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses`;
      estimated = true;
    }
    if (paid) { bal -= paid; basis += `, menos ${U.money(paid)} pagos depois dessa data`; estimated = true; }
    return { balance: Math.max(0, bal), basis, estimated };
  }

  function debtInfo(st, data, d) {
    const T = today();
    const r = monthlyRate(d);
    let balance, basis, estimated, linked = false, remainingInst = null, nextDue = null;
    if (d.linkedPurchaseIds && d.linkedPurchaseIds.length) {
      linked = true;
      const ids = new Set(d.linkedPurchaseIds);
      let sum = 0, cnt = 0;
      for (const inv of Object.values(data.invoices)) {
        if (inv.status === 'paga' || inv.status === 'anterior') continue;
        for (const it of inv.items) if (ids.has(it.p.id)) { sum += it.amount; cnt++; if (!nextDue || inv.dueDate < nextDue) nextDue = inv.dueDate; }
      }
      balance = sum; basis = 'soma das parcelas de cartão vinculadas ainda não pagas'; estimated = false; remainingInst = cnt;
    } else {
      const e = debtBalanceEstimate(st, d, T);
      balance = e.balance; basis = e.basis; estimated = e.estimated;
      const occs = data.items.filter((it) => it.src === 'debt' && it.id === d.id && it.status !== 'pago');
      if (d.installmentsLeft) remainingInst = Math.max(0, d.installmentsLeft - st.entries.filter((x) => x.debtRef && x.debtRef.id === d.id && x.status === 'pago').length);
      nextDue = occs.length ? occs[0].date : null;
    }
    const monthlyInterest = r && balance ? Math.round(balance * r) : null;
    const pay = d.installmentAmount || d.minPayment || null;
    const growing = !!(monthlyInterest && (!pay || pay <= monthlyInterest));
    const overdue = !!d.overdueSince || data.items.some((it) => it.src === 'debt' && it.id === d.id && it.status === 'vencido');
    const stale = !linked && d.balanceDate ? U.diffDays(d.balanceDate, T) > (st.settings.staleDays || 30) : !linked;
    const missing = [];
    if (!linked && (d.balance === null || d.balance === undefined)) missing.push('saldo atualizado');
    if (!linked && r === null && d.type !== 'conta_atrasada') missing.push('taxa de juros');
    if (!linked && !d.nextDueDate && !d.overdueSince) missing.push('próximo vencimento');
    return { d, balance, basis, estimated, linked, monthlyRate: r, monthlyInterest, pay, growing, overdue, stale, missing, remainingInst, nextDue };
  }

  // Simula quitação com orçamento mensal fixo. order: 'juros' | 'saldo'
  function payoff(st, data, budget, order) {
    const list = st.debts.filter((d) => d.status === 'ativa').map((d) => debtInfo(st, data, d)).filter((x) => x.balance && x.balance > 0);
    const notes = [];
    const ds = list.map((x) => ({ id: x.d.id, name: x.d.creditor, bal: x.balance, r: x.monthlyRate || 0, rKnown: x.monthlyRate !== null, min: Math.min(x.pay || 0, x.balance), paidMonth: null, interest: 0, paid: 0, linked: x.linked }));
    for (const x of ds) if (!x.rKnown) notes.push(`${x.name}: taxa desconhecida, juros não estimados (considerado 0%).`);
    const mins = U.sum(ds, (x) => x.min);
    if (!ds.length) return { empty: true, notes };
    if (budget < mins) return { infeasible: true, needed: mins, notes, debts: ds };
    const sorter = order === 'juros' ? (a, b) => b.r - a.r || a.bal - b.bal : (a, b) => a.bal - b.bal || b.r - a.r;
    let month = 0, totalPaid = 0, totalInterest = 0;
    const timeline = [];
    while (ds.some((x) => x.bal > 0) && month < 360) {
      month++;
      for (const x of ds) if (x.bal > 0) { const i = Math.round(x.bal * x.r); x.bal += i; x.interest += i; totalInterest += i; }
      let avail = budget;
      for (const x of ds) if (x.bal > 0) { const p = Math.min(x.min, x.bal); x.bal -= p; x.paid += p; avail -= p; totalPaid += p; }
      const active = ds.filter((x) => x.bal > 0 && !x.linked).sort(sorter);
      for (const x of active) { if (avail <= 0) break; const p = Math.min(avail, x.bal); x.bal -= p; x.paid += p; avail -= p; totalPaid += p; }
      for (const x of ds) if (x.bal <= 0 && !x.paidMonth) x.paidMonth = month;
      timeline.push({ month, remaining: U.sum(ds, (x) => x.bal) });
      if (month > 2 && timeline[month - 1].remaining >= timeline[month - 2].remaining && avail <= 0 && totalInterest > 0 && month > 24) { notes.push('Com esse valor mensal o saldo não diminui.'); break; }
    }
    if (ds.some((x) => x.linked)) notes.push('Dívidas vinculadas a cartão seguem as parcelas da fatura; não recebem valor extra.');
    return { months: month, totalPaid, totalInterest, debts: ds, timeline, notes, done: !ds.some((x) => x.bal > 0) };
  }

  /* ---------- Reservas e objetivos ---------- */
  function reserveBalance(st, r, upTo) {
    let b = r.initialBalance || 0;
    for (const e of st.entries) {
      if (e.type !== 'reserva' || e.reserveId !== r.id || e.status !== 'pago') continue;
      if (upTo && (e.paidDate || e.dueDate) > upTo) continue;
      b += e.op === 'retirada' ? -e.amount : e.amount;
    }
    return b;
  }
  function seriesMonthly(s) { return Math.round((s.amount || 0) * monthlyFactor(s.frequency)); }
  function reserveBase(st, data, r) {
    const b = r.base || {};
    if (b.mode === 'manual') return { value: b.manual ?? null, explain: b.manual != null ? 'valor-base informado manualmente' : 'valor-base manual ainda não informado' };
    if (b.mode === 'media') {
      const n = b.avgMonths || 3;
      const T = today();
      const last = U.addMonthKey(U.monthKey(T), -1);
      const first = U.addMonthKey(last, -(n - 1));
      const startM = U.monthKey(orgStart(st));
      if (first < startM) return { value: null, explain: `ainda não há ${n} meses completos de histórico desde o início (${U.fmtMonth(startM)}). Use itens cadastrados ou valor manual.` };
      const set = new Set(b.categoryIds || []);
      const rows = data.pnlRows.filter((x) => x.nature === r.nature && x.kind === 'despesa' && x.status === 'pago' && x.month >= first && x.month <= last && (!set.size || set.has(x.categoryId)));
      return { value: Math.round(U.sum(rows, (x) => x.amount) / n), explain: `média das despesas pagas de ${U.fmtMonth(first)} a ${U.fmtMonth(last)}` + (set.size ? ' nas categorias escolhidas' : '') };
    }
    const ids = new Set(b.seriesIds || []);
    const chosen = st.series.filter((s) => ids.has(s.id) && !s.archived && s.type === 'despesa');
    const extra = b.extra || 0;
    const v = U.sum(chosen, seriesMonthly) + extra;
    if (!chosen.length && !extra) return { value: null, explain: 'nenhuma despesa escolhida para compor a base' };
    return { value: v, explain: `soma mensal de ${U.plural(chosen.length, 'despesa recorrente', 'despesas recorrentes')} escolhidas` + (extra ? ` mais ${U.money(extra)} adicionados` : '') };
  }
  function reserveInfo(st, data, r) {
    const balance = reserveBalance(st, r);
    const out = { r, balance };
    if (r.kind === 'reserva') {
      const base = reserveBase(st, data, r);
      out.base = base;
      const months = r.months || 6;
      out.months = months;
      out.target = base.value != null ? base.value * months : (r.target ?? null);
      out.covered = base.value ? balance / base.value : null;
    } else out.target = r.target ?? null;
    out.missing = out.target != null ? Math.max(0, out.target - balance) : null;
    out.progress = out.target ? Math.min(1, balance / out.target) : null;
    if (r.deadline && out.missing) {
      const m = Math.max(1, U.monthsDiff(U.monthKey(today()), U.monthKey(r.deadline)));
      out.requiredMonthly = Math.ceil(out.missing / m);
      out.monthsLeft = m;
    }
    return out;
  }

  // Simulador de acumulação
  function accumulate({ initial = 0, monthly = 0, months = 12, rate = 0, ratePeriod = 'anual', timing = 'fim', adminYear = 0, taxPct = 0 }) {
    const conv = (x) => Math.pow(1 + x, 1 / 12) - 1;
    const rm = ratePeriod === 'anual' ? conv(rate / 100) : rate / 100;
    const am = adminYear ? conv(adminYear / 100) : 0;
    const net = (1 + rm) / (1 + am) - 1;
    let bal = initial, contributed = initial;
    const rows = [];
    for (let m = 1; m <= months; m++) {
      if (timing === 'inicio') { bal += monthly; contributed += monthly; }
      const gain = bal * net;
      bal += gain;
      if (timing !== 'inicio') { bal += monthly; contributed += monthly; }
      rows.push({ m, bal: Math.round(bal), contributed: Math.round(contributed), gain: Math.round(bal - contributed) });
    }
    const grossGain = bal - contributed;
    const tax = grossGain > 0 ? grossGain * (taxPct / 100) : 0;
    return { monthlyRate: rm, netMonthlyRate: net, equivalentYear: Math.pow(1 + net, 12) - 1, rows, contributed: Math.round(contributed), gain: Math.round(grossGain), tax: Math.round(tax), final: Math.round(bal - tax) };
  }

  /* ---------- Retirada sugerida e capacidade de pagamento ---------- */
  function proFixedMonthly(st) {
    return U.sum(st.series.filter((s) => !s.archived && s.type === 'despesa' && s.nature === 'profissional' && (!s.endDate || s.endDate >= today())), seriesMonthly);
  }
  function withdrawSuggestion(st, opts = {}) {
    const T = today();
    const days = opts.days || st.settings.withdrawDays || 30;
    const to = U.addDays(T, days);
    const horizon = U.addDays(T, Math.max(days, 90));
    const data = build(st, U.maxDate(horizon, U.addMonths(T, st.settings.horizon || 6)));
    const bal = balances(st, data, T);
    const proj = projection(st, { to, nature: 'profissional', data });
    const inflow = U.sum(proj.events.filter((e) => e.delta > 0 && e.it.certainty !== 'estimado'), (e) => e.delta);
    const estIn = U.sum(proj.events.filter((e) => e.delta > 0 && e.it.certainty === 'estimado'), (e) => e.delta);
    const outflow = U.sum(proj.events.filter((e) => e.delta < 0), (e) => -e.delta);
    const fixed = proFixedMonthly(st);
    const buffer = st.settings.proBufferMode === 'valor' ? (st.settings.proBufferValue || 0) : Math.round(fixed * (st.settings.proBufferMonths ?? 1));
    const cash = bal.byNature.profissional;
    const margin = cash + inflow - outflow - buffer;
    const minMargin = proj.minBal - buffer; // mesmo que o fim seja positivo, não pode furar o colchão no caminho
    const suggested = Math.max(0, Math.min(margin, minMargin));
    const notes = [];
    if (!st.accounts.some((a) => a.type === 'pj')) notes.push('Nenhuma conta PJ cadastrada.');
    if (bal.unknown) notes.push('Há contas sem saldo informado.');
    if (!st.setup.clients) notes.push('Clientes ainda não cadastrados: as entradas podem estar incompletas.');
    if (!fixed && st.settings.proBufferMode !== 'valor') notes.push('Sem custos fixos profissionais cadastrados, o colchão de segurança é zero.');
    return { days, to, cash, inflow, estIn, outflow, buffer, fixed, margin, minMargin, minBal: proj.minBal, minDate: proj.minDate, suggested, safe: suggested > 0, notes, proj };
  }
  function withdrawImpact(st, amount, date) {
    const T = today();
    const to = U.addDays(T, 90);
    const pj = st.accounts.find((a) => a.type === 'pj' && !a.archived);
    const pes = st.accounts.find((a) => a.type === 'pessoal' && !a.archived);
    if (!pj || !pes) return null;
    const it = { key: 'hyp:ret', src: 'hyp', type: 'transferencia', date: date || T, status: 'previsto', amount, cash: [{ accountId: pj.id, delta: -amount }, { accountId: pes.id, delta: amount }], pnl: [], certainty: 'hipotetico' };
    const before = projection(st, { to, nature: 'profissional' });
    const after = projection(st, { to, nature: 'profissional', extra: [it] });
    const afterPes = projection(st, { to, nature: 'pessoal', extra: [it] });
    const beforePes = projection(st, { to, nature: 'pessoal' });
    return { before, after, beforePes, afterPes };
  }
  function debtCapacity(st) {
    const T = today();
    const to = U.addDays(T, 90);
    const data = build(st, U.maxDate(to, U.addMonths(T, st.settings.horizon || 6)));
    const proj = projection(st, { to, nature: 'pessoal', data });
    const inflow = U.sum(proj.events.filter((e) => e.delta > 0), (e) => e.delta);
    const outflow = U.sum(proj.events.filter((e) => e.delta < 0), (e) => -e.delta);
    const contractual = U.sum(proj.events.filter((e) => e.delta < 0 && (e.it.pnl || []).some((p) => p.kind === 'divida')), (e) => -e.delta);
    const net = inflow - outflow;
    const avg = Math.round(net / 3);
    const extra = Math.max(0, Math.min(avg, proj.minBal));
    return { to, start: proj.start, inflow, outflow, contractual, net, avg, minBal: proj.minBal, minDate: proj.minDate, extra, deficit: net < 0 || proj.minBal < 0, proj };
  }

  /* ---------- Alertas por regras ---------- */
  function alerts(st) {
    const T = today();
    const s = st.settings;
    const horizonTo = U.addMonths(T, Math.max(s.horizon || 6, 3));
    const data = build(st, horizonTo);
    const out = [];
    const add = (a) => out.push(a);
    const acc = Object.fromEntries(st.accounts.map((a) => [a.id, a]));
    const cards = Object.fromEntries(st.cards.map((c) => [c.id, c]));

    // Falta de dinheiro
    const shortTo = U.addDays(T, s.shortfallDays || 60);
    const views = [[null, 'geral', 'no total das contas'], ['pessoal', 'pessoal', 'no dinheiro pessoal'], ['profissional', 'profissional', 'no caixa profissional']];
    for (const [nat, label, txt] of views) {
      if (!st.accounts.length) break;
      const p = projection(st, { to: shortTo, nature: nat, data });
      if (p.firstNeg) {
        const day = p.days.find((d) => d.date === p.firstNeg);
        const outs = p.events.filter((e) => e.delta < 0 && e.date <= p.firstNeg).sort((a, b) => a.delta - b.delta).slice(0, 3);
        add({ key: `falta:${label}:${p.firstNeg}`, prio: 1, nature: label, kind: 'falta', title: `Falta de dinheiro prevista ${txt} em ${U.fmtDate(p.firstNeg)}`, period: `${U.fmtDate(T)} a ${U.fmtDate(shortTo)}`, value: day ? day.bal : p.minBal,
          reason: `Saldo inicial ${U.money(p.start)}. Saldo previsto em ${U.fmtDate(p.firstNeg)}: ${U.money(day?.bal)}. Menor saldo do período: ${U.money(p.minBal)} em ${U.fmtDate(p.minDate)}. Maiores saídas até lá: ${outs.map((e) => `${e.it.desc} (${U.money(-e.delta)} em ${U.fmtDay(e.date)})`).join('; ') || 'nenhuma'}.` + (p.partial.length ? ` Projeção parcial: ${p.partial.join(', ')}.` : ''),
          action: 'Veja no calendário quais saídas podem ser adiadas ou negociadas e quais entradas podem ser antecipadas.', link: { route: 'calendario' }, task: `Revisar saídas antes de ${U.fmtDate(p.firstNeg)}` });
      }
    }

    // Contas vencidas e próximas
    const dueTo = U.addDays(T, s.dueAlertDays ?? 5);
    const overdue = data.items.filter((it) => it.status === 'vencido' && it.cash.some((c) => c.delta < 0));
    const dueSoon = data.items.filter((it) => it.status === 'previsto' && it.date <= dueTo && it.date >= T && it.cash.some((c) => c.delta < 0) && it.src !== 'plan');
    for (const it of overdue.slice(0, 12)) {
      add({ key: `vencido:${it.key}`, prio: 1, nature: it.nature || 'pessoal', kind: 'vencido', title: `${it.desc} está em atraso desde ${U.fmtDate(it.dueDate || it.date)}`, period: `venceu há ${U.plural(U.diffDays(it.dueDate || it.date, T), 'dia')}`, value: it.amount,
        reason: `Valor previsto de ${U.money(it.amount)} sem pagamento confirmado no painel.` + (it.unknownAmount ? ' O valor da dívida ainda não foi informado.' : ''), action: 'Se já pagou, confirme o pagamento. Se não, veja se dá para pagar ou negociar.', link: linkFor(it), task: `Resolver: ${it.desc}`, ref: it.key });
    }
    if (overdue.length > 12) add({ key: 'vencido:muitos', prio: 1, nature: 'geral', kind: 'vencido', title: `Mais ${overdue.length - 12} contas em atraso`, period: 'até hoje', value: U.sum(overdue.slice(12), (i) => i.amount), reason: 'Lista completa no calendário, filtro "Em atraso".', action: 'Confirme pagamentos já feitos e priorize as demais.', link: { route: 'calendario' } });
    for (const it of dueSoon.slice(0, 10)) {
      add({ key: `vence:${it.key}`, prio: 2, nature: it.nature || 'pessoal', kind: 'vence', title: `${it.desc} vence em ${U.fmtDate(it.date)}`, period: `em ${U.plural(U.diffDays(T, it.date), 'dia')}`, value: it.amount, reason: `Pagamento previsto de ${U.money(it.amount)}` + (it.accountId && acc[it.accountId] ? ` pela conta ${acc[it.accountId].name}.` : ', sem conta definida.'), action: 'Confira se há saldo na conta e confirme quando pagar.', link: linkFor(it), ref: it.key });
    }

    // Recebimentos atrasados
    const lateRecv = data.items.filter((it) => it.status === 'vencido' && it.cash.some((c) => c.delta > 0) && it.type === 'receita');
    for (const it of lateRecv.slice(0, 10)) {
      add({ key: `atraso:${it.key}`, prio: 1, nature: 'profissional', kind: 'atraso', title: `${it.desc}: recebimento atrasado desde ${U.fmtDate(it.dueDate)}`, period: `${U.plural(U.diffDays(it.dueDate, T), 'dia')} de atraso`, value: it.amount,
        reason: `Entrada prevista de ${U.money(it.amount)} ainda não confirmada.` + (s.overdueReceivables === 'excluir' ? ' Esse valor não está entrando na projeção principal até ser recebido.' : ' Esse valor está entrando na projeção como se chegasse hoje.'), action: 'Confirme se já recebeu ou envie um lembrete ao cliente.', link: { route: 'profissional', tab: 'clientes' }, task: `Cobrar ou confirmar: ${it.desc}`, ref: it.key });
    }

    // Contratos terminando e reajustes
    for (const c of st.clients) {
      if (c.archived || c.status !== 'ativo') continue;
      if (c.endDate && c.endDate >= T && U.diffDays(T, c.endDate) <= (s.contractAlertDays ?? 60) && c.renewal !== 'confirmada') {
        const monthsAfter = Math.max(0, U.monthsDiff(U.monthKey(c.endDate), U.monthKey(horizonTo)));
        add({ key: `contrato:${c.id}:${c.endDate}`, prio: 2, nature: 'profissional', kind: 'contrato', title: `Contrato de ${c.name} termina em ${U.fmtDate(c.endDate)}`, period: `faltam ${U.plural(U.diffDays(T, c.endDate), 'dia')}`, value: clientAmountAt(c, c.endDate),
          reason: `Renovação não confirmada. Sem renovação, deixam de entrar ${U.money(clientAmountAt(c, c.endDate))} por mês, cerca de ${U.money(clientAmountAt(c, c.endDate) * monthsAfter)} até ${U.fmtMonth(U.monthKey(horizonTo))}.`, action: 'Converse sobre renovação e registre a decisão no cadastro do cliente.', link: { route: 'profissional', tab: 'clientes', id: c.id }, task: `Conversar sobre renovação com ${c.name}` });
      }
      for (const a of c.adjustments || []) {
        if (!a.confirmed && a.date >= T && U.diffDays(T, a.date) <= (s.adjustAlertDays ?? 30)) add({ key: `reajuste:${c.id}:${a.date}`, prio: 3, nature: 'profissional', kind: 'reajuste', title: `Reajuste de ${c.name} previsto para ${U.fmtDate(a.date)}`, period: `em ${U.plural(U.diffDays(T, a.date), 'dia')}`, value: a.amount, reason: `Novo valor previsto: ${U.money(a.amount)} (atual ${U.money(clientAmountAt(c, T))}). Enquanto não for confirmado, a projeção usa o valor atual.`, action: 'Confirme o reajuste com o cliente e marque como confirmado.', link: { route: 'profissional', tab: 'clientes', id: c.id }, task: `Confirmar reajuste com ${c.name}` });
      }
    }

    // Categorias
    const curM = U.monthKey(T);
    for (const nat of ['pessoal', 'profissional']) {
      const r = results(st, data, nat, [curM]);
      const income = nat === 'pessoal' ? r.receita.total + r.recurso.total : r.receita.total;
      for (const c of Object.values(r.byCategory)) {
        if (c.limit && c.total > c.limit) add({ key: `limite:${c.id}:${curM}`, prio: 2, nature: nat, kind: 'limite', title: `${c.name} acima do limite em ${U.fmtMonth(curM)}`, period: U.fmtMonthFull(curM), value: c.total - c.limit, reason: `Gasto pago e previsto no mês: ${U.money(c.total)}. Limite definido: ${U.money(c.limit)}. Diferença: ${U.money(c.total - c.limit)}.`, action: 'Veja os lançamentos dessa categoria e decida o que pode esperar.', link: { route: nat, tab: 'lancamentos', cat: c.id }, task: `Revisar gastos de ${c.name}` });
        else if (!c.essential && income > 0 && c.total / income > (s.categoryAlertPct || 30) / 100) add({ key: `peso:${c.id}:${curM}`, prio: 3, nature: nat, kind: 'limite', title: `${c.name} consome ${U.pct(c.total / income)} das entradas de ${U.fmtMonth(curM)}`, period: U.fmtMonthFull(curM), value: c.total, reason: `${U.money(c.total)} de ${U.money(income)} em entradas ${nat === 'pessoal' ? 'pessoais (renda + retiradas)' : 'profissionais'} no mês. Referência de alerta: ${s.categoryAlertPct || 30}%.`, action: 'Avalie se esse valor é pontual ou se está se repetindo.', link: { route: nat, tab: 'lancamentos', cat: c.id } });
      }
    }

    // Cartões comprometendo próximas entradas
    {
      const to30 = U.addDays(T, 30);
      const p = projection(st, { to: to30, nature: 'pessoal', data });
      const inflow = U.sum(p.events.filter((e) => e.delta > 0), (e) => e.delta);
      const cardsOut = U.sum(p.events.filter((e) => e.delta < 0 && e.it.src === 'invoice'), (e) => -e.delta);
      if (cardsOut > 0) {
        if (inflow <= 0) add({ key: `cartaorenda:${curM}`, prio: 2, nature: 'pessoal', kind: 'cartao', title: 'Faturas a pagar nos próximos 30 dias sem entrada pessoal prevista', period: `${U.fmtDate(T)} a ${U.fmtDate(to30)}`, value: cardsOut, reason: `Faturas previstas: ${U.money(cardsOut)}. Nenhuma entrada pessoal ou retirada cadastrada no período.`, action: 'Cadastre as retiradas previstas ou outras entradas pessoais para ver o comprometimento real.', link: { route: 'cartoes' } });
        else if (cardsOut / inflow > (s.cardCommitPct || 30) / 100) add({ key: `cartaorenda:${curM}`, prio: 2, nature: 'pessoal', kind: 'cartao', title: `Cartões já comprometem ${U.pct(cardsOut / inflow)} das entradas pessoais dos próximos 30 dias`, period: `${U.fmtDate(T)} a ${U.fmtDate(to30)}`, value: cardsOut, reason: `Faturas previstas: ${U.money(cardsOut)}. Entradas pessoais previstas (inclui retiradas): ${U.money(inflow)}. Referência de alerta: ${s.cardCommitPct || 30}%.`, action: 'Evite novas compras no cartão até a próxima fatura fechar.', link: { route: 'cartoes' } });
      }
    }

    // Nova operação de crédito
    const since = U.addDays(T, -30);
    for (const p of st.purchases) if (p.kind === 'pix_credito' && p.status !== 'cancelada' && p.date >= since) {
      const total = p.mode === 'restante' ? (p.installmentValue || 0) * (p.remaining || 0) : p.total;
      add({ key: `credito:${p.id}`, prio: 2, nature: p.nature || 'pessoal', kind: 'credito', title: `Pix no crédito em ${U.fmtDate(p.date)}: ${p.description}`, period: 'últimos 30 dias', value: total, reason: `Recebido ${U.money(p.net)}, a pagar ${U.money(total)} em ${U.plural(p.n || p.remaining || 1, 'parcela')}. Custo: ${U.money(Math.max(0, total - (p.net || 0)))}. Crédito aumenta o dinheiro agora e cria uma obrigação nas próximas faturas.`, action: 'Veja no calendário o que levou à necessidade do crédito e se ela pode se repetir.', link: { route: 'cartoes', tab: 'pix' } });
    }
    for (const e of st.entries) if (e.type === 'credito' && e.status !== 'cancelado' && (e.paidDate || e.dueDate) >= since) add({ key: `credito:${e.id}`, prio: 2, nature: e.nature || 'pessoal', kind: 'credito', title: `Novo crédito recebido: ${e.description}`, period: 'últimos 30 dias', value: e.amount, reason: `${U.money(e.amount)} entraram como crédito, não como renda. A dívida correspondente aparece em Dívidas.`, action: 'Confira se a dívida está cadastrada com parcelas e juros.', link: { route: 'dividas' } });

    // Dívidas
    for (const d of st.debts) {
      if (d.status !== 'ativa') continue;
      const info = debtInfo(st, data, d);
      if (info.growing) add({ key: `juros:${d.id}`, prio: 2, nature: d.nature || 'pessoal', kind: 'juros', title: `${d.creditor}: dívida crescendo com juros`, period: 'estimativa mensal', value: info.monthlyInterest, reason: `Saldo estimado ${U.money(info.balance)} (${info.basis}). Juros estimados de ${U.money(info.monthlyInterest)} por mês` + (info.pay ? `, maior ou igual ao pagamento de ${U.money(info.pay)}.` : ', sem pagamento mensal cadastrado.'), action: 'Avalie negociar ou priorizar essa dívida no plano de quitação.', link: { route: 'dividas', id: d.id }, task: `Avaliar negociação: ${d.creditor}` });
      if (info.missing.length) add({ key: `dadosdivida:${d.id}`, prio: 3, nature: d.nature || 'pessoal', kind: 'dados', title: `${d.creditor}: faltam dados`, period: 'cadastro', value: null, reason: `Sem ${info.missing.join(', ')}. Sem esses dados, o painel não estima juros nem prazo dessa dívida.`, action: 'Consulte o credor e complete o cadastro.', link: { route: 'dividas', id: d.id }, task: `Completar dados da dívida ${d.creditor}` });
      else if (info.stale) add({ key: `atualizar:${d.id}`, prio: 3, nature: d.nature || 'pessoal', kind: 'dados', title: `${d.creditor}: saldo informado há mais de ${s.staleDays || 30} dias`, period: `atualizado em ${U.fmtDate(d.balanceDate)}`, value: info.balance, reason: 'Saldo antigo deixa as estimativas menos confiáveis.', action: 'Atualize o saldo com o credor.', link: { route: 'dividas', id: d.id }, task: `Atualizar saldo: ${d.creditor}` });
    }

    // Retirada comprometendo o profissional
    if (st.accounts.some((a) => a.type === 'pj')) {
      const p = projection(st, { to: U.addDays(T, 60), nature: 'profissional', data });
      const fixed = proFixedMonthly(st);
      const buffer = s.proBufferMode === 'valor' ? (s.proBufferValue || 0) : Math.round(fixed * (s.proBufferMonths ?? 1));
      const ret = U.sum(p.events.filter((e) => e.it.pnl?.some((x) => x.nature === 'profissional' && x.kind === 'retirada')), (e) => -Math.min(0, e.delta));
      if (ret > 0 && p.minBal < buffer) add({ key: `retirada:${p.minDate}`, prio: p.minBal < 0 ? 1 : 2, nature: 'profissional', kind: 'retirada', title: 'Retiradas previstas deixam o caixa profissional abaixo do colchão', period: `próximos 60 dias`, value: buffer - p.minBal, reason: `Retiradas previstas: ${U.money(ret)}. Menor saldo profissional: ${U.money(p.minBal)} em ${U.fmtDate(p.minDate)}. Colchão configurado: ${U.money(buffer)}.`, action: 'Reduza ou adie uma retirada, ou confirme entradas antes dela.', link: { route: 'profissional', tab: 'meta' }, task: 'Rever valor das retiradas' });
    }

    // Metas e aportes incompatíveis
    for (const r of st.reserves) {
      if (r.archived) continue;
      const info = reserveInfo(st, data, r);
      if (info.requiredMonthly && r.monthlyPlan != null && r.monthlyPlan < info.requiredMonthly) add({ key: `meta:${r.id}`, prio: 3, nature: r.nature, kind: 'meta', title: `${r.name}: aporte planejado não alcança o prazo`, period: `até ${U.fmtDate(r.deadline)}`, value: info.requiredMonthly - r.monthlyPlan, reason: `Faltam ${U.money(info.missing)} em ${U.plural(info.monthsLeft, 'mês', 'meses')}: seriam ${U.money(info.requiredMonthly)} por mês. Planejado: ${U.money(r.monthlyPlan)}.`, action: 'Ajuste o prazo, o valor-alvo ou o aporte no simulador.', link: { route: 'reservas' } });
      if (r.monthlyPlan && s.includePlannedContributions) {
        const p = projection(st, { to: U.addDays(T, 90), nature: r.nature, data });
        if (p.firstNeg && p.events.some((e) => e.it.src === 'plan' && e.it.id === r.id && e.date <= p.firstNeg)) add({ key: `metacaixa:${r.id}`, prio: 2, nature: r.nature, kind: 'meta', title: `Aporte em ${r.name} aparece antes de uma falta de dinheiro`, period: `até ${U.fmtDate(p.firstNeg)}`, value: r.monthlyPlan, reason: `O caixa ${r.nature} fica negativo em ${U.fmtDate(p.firstNeg)} com os aportes planejados incluídos.`, action: 'Pause ou reduza o aporte até o caixa voltar a ficar positivo.', link: { route: 'reservas' }, task: `Rever aporte em ${r.name}` });
      }
    }

    // Cartões que estou tentando deixar de usar
    const avoid = new Set([...(s.avoidCardIds || []), ...st.cards.filter((c) => c.avoid).map((c) => c.id)]);
    const goalStart = s.cardGoalStart || orgStart(st);
    for (const p of st.purchases) {
      if (!avoid.has(p.cardId) || p.status === 'cancelada' || p.mode === 'restante') continue;
      if (p.date >= goalStart && p.date >= U.addDays(T, -45)) add({ key: `evitar:${p.id}`, prio: 2, nature: p.nature || 'pessoal', kind: 'evitar', title: `Nova compra no cartão ${cards[p.cardId]?.name}`, period: U.fmtDate(p.date), value: p.total, reason: `Você marcou esse cartão para deixar de usar. Compra: ${p.description}, ${U.money(p.total)}${p.n > 1 ? ` em ${p.n}x` : ''}.`, action: 'Veja se dá para usar outra forma de pagamento nas próximas compras.', link: { route: 'cartoes', id: p.cardId } });
    }

    // Informações insuficientes
    const missingSteps = M.SETUP_STEPS.filter((x) => !st.setup[x.key]);
    if (missingSteps.length) add({ key: 'setup', prio: 3, nature: 'geral', kind: 'dados', title: `${U.plural(missingSteps.length, 'etapa', 'etapas')} da configuração ainda não ${missingSteps.length === 1 ? 'foi concluída' : 'foram concluídas'}`, period: 'configuração', value: null, reason: missingSteps.map((x) => `${x.title}: ${x.limit}`).join(' '), action: 'Continue a configuração guiada quando puder.', link: { route: 'config', tab: 'guia' } });
    for (const a of st.accounts) if (!a.archived && (a.initialBalance === null || a.initialBalance === undefined)) add({ key: `saldo:${a.id}`, prio: 2, nature: 'geral', kind: 'dados', title: `Conta ${a.name} sem saldo informado`, period: 'cadastro', value: null, reason: 'A projeção considera zero para essa conta, o que pode esconder sobras ou faltas.', action: 'Informe o saldo atual da conta.', link: { route: 'contas', id: a.id }, task: `Informar saldo da conta ${a.name}` });
    for (const c of st.cards) if (!c.archived && !c.payAccountId) add({ key: `cartaoconta:${c.id}`, prio: 3, nature: 'geral', kind: 'dados', title: `Cartão ${c.name} sem conta de pagamento`, period: 'cadastro', value: null, reason: 'As faturas entram no total, mas não aparecem na projeção por conta.', action: 'Escolha de qual conta sai o pagamento da fatura.', link: { route: 'cartoes', id: c.id } });
    const lastRev = st.reviews[st.reviews.length - 1];
    if (st.setup.accounts && (!lastRev || U.diffDays(lastRev.date, T) > (s.reviewEveryDays || 7))) add({ key: `revisao:${lastRev?.date || 'nunca'}`, prio: 3, nature: 'geral', kind: 'revisao', title: lastRev ? `Última revisão semanal em ${U.fmtDate(lastRev.date)}` : 'Nenhuma revisão semanal feita ainda', period: 'rotina', value: null, reason: 'A revisão mantém saldos e pagamentos atualizados, o que deixa as projeções confiáveis.', action: 'Faça a revisão semanal (leva poucos minutos).', link: { route: 'diagnostico', tab: 'revisao' }, task: 'Fazer a revisão semanal' });

    out.sort((a, b) => a.prio - b.prio);
    return out;
  }

  function linkFor(it) {
    if (it.src === 'invoice') return { route: 'cartoes', id: it.cardId };
    if (it.src === 'debt') return { route: 'dividas', id: it.id };
    if (it.src === 'client') return { route: 'profissional', tab: 'clientes', id: it.id };
    return { route: 'calendario', date: it.date };
  }

  return { today, setToday, orgStart, FREQ, FREQ_LABEL, monthlyFactor, nth, occ, accNatureOf, clientFirstDue, clientAmountAt, clientEnd, invoiceMonthFor, invoiceDueDate, purchaseInstallments, monthlyRate, build, balances, projection, results, commitment, debtBalanceEstimate, debtInfo, payoff, reserveBalance, reserveBase, reserveInfo, seriesMonthly, accumulate, proFixedMonthly, withdrawSuggestion, withdrawImpact, debtCapacity, alerts };
})();
if (typeof module !== 'undefined') module.exports = { E };
