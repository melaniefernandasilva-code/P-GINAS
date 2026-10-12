/* Ações que alteram o estado. Usadas pela interface e pelo simulador
   (que aplica as mesmas ações sobre uma cópia, sem tocar nos dados reais). */
const A = (() => {
  const now = () => Date.now();

  function findItem(st, key, to) {
    const T = E.today();
    const horizon = to || U.addMonths(T, 60);
    const data = E.build(st, horizon);
    return data.items.find((i) => i.key === key) || null;
  }

  // Cria um lançamento real a partir de uma ocorrência virtual
  function materialize(st, item, changes = {}) {
    if (item.src === 'entry') return st.entries.find((e) => e.id === item.id);
    let e;
    const base = { id: U.uid('e_'), createdAt: now(), status: 'previsto', dueDate: item.date, paidDate: null, notes: '' };
    if (item.src === 'series') {
      const s = item.ref;
      e = { ...base, type: s.type, description: s.description + (item.label ? ` (${item.label})` : ''), amount: s.amount, categoryId: s.categoryId, nature: s.nature, accountId: s.accountId, method: s.method || '', certainty: s.certainty || 'confirmado', seriesRef: { id: s.id, n: item.n } };
    } else if (item.src === 'client') {
      const c = item.ref;
      e = { ...base, type: 'receita', description: `Mensalidade ${c.name}`, amount: item.amount, categoryId: c.categoryId || 'c_pro_mens', nature: 'profissional', accountId: item.accountId, method: 'pix', certainty: 'contratado', clientRef: { id: c.id, n: item.n } };
    } else if (item.src === 'debt') {
      const d = item.ref;
      e = { ...base, type: 'despesa', description: `Pagamento ${d.creditor}` + (item.label ? ` (${item.label})` : ''), amount: item.amount, categoryId: null, nature: d.nature || 'pessoal', accountId: item.accountId, method: '', certainty: 'contratado', debtRef: { id: d.id, n: item.n } };
    } else throw new Error('Essa ocorrência não pode ser convertida em lançamento.');
    Object.assign(e, changes);
    st.entries.push(e);
    return e;
  }

  function confirm(st, item, { paidDate, amount, accountId } = {}) {
    if (item.src === 'invoice') return payInvoice(st, item.cardId, item.invKey.split('|')[1], { amount: amount ?? item.amount, date: paidDate || E.today(), accountId: accountId || item.accountId });
    if (item.src === 'plan') return reserveMove(st, { reserveId: item.id, op: 'aporte', amount: amount ?? item.amount, date: paidDate || E.today(), accountId: accountId || item.accountId });
    const e = materialize(st, item);
    e.status = 'pago';
    e.paidDate = paidDate || E.today();
    e.paidAt = now();
    if (amount != null) e.amount = amount;
    if (accountId !== undefined && accountId !== null) e.accountId = accountId;
    return e;
  }
  function unconfirm(st, entryId) {
    const e = st.entries.find((x) => x.id === entryId);
    if (!e) return;
    e.status = 'previsto'; e.paidDate = null; e.paidAt = null;
  }
  function cancelOccurrence(st, item) {
    const e = materialize(st, item);
    e.status = 'cancelado';
    return e;
  }

  // Divide uma recorrência a partir da ocorrência n, aplicando "changes" dali em diante.
  function splitSeries(st, seriesId, n, changes) {
    const s = st.series.find((x) => x.id === seriesId);
    if (!s) throw new Error('Recorrência não encontrada.');
    const anchor = U.parse(s.startDate).d;
    const occDate = E.nth(s.startDate, s.frequency, n, anchor);
    const report = { kept: 0, moved: 0, removed: 0 };
    const mats = st.entries.filter((e) => e.seriesRef && e.seriesRef.id === s.id && e.seriesRef.n >= n);
    const mPurch = st.purchases.filter((p) => p.seriesRef && p.seriesRef.id === s.id && p.seriesRef.n >= n);
    if (n === 0) {
      Object.assign(s, changes);
      for (const e of mats) if (e.status === 'previsto') { st.entries.splice(st.entries.indexOf(e), 1); report.removed++; } else report.kept++;
      return { series: s, report };
    }
    const ns = { ...U.clone(s), ...changes, id: U.uid('s_'), createdAt: now(), startDate: changes.startDate || occDate, labelOffset: (s.labelOffset || 0) + n, count: s.count ? s.count - n : null, parentId: s.id };
    if (changes.startDate && changes.startDate !== occDate) ns.labelOffset = (s.labelOffset || 0) + n;
    s.endDate = U.addDays(occDate, -1);
    if (s.count) s.count = n;
    for (const e of mats) {
      if (e.status === 'previsto') { st.entries.splice(st.entries.indexOf(e), 1); report.removed++; }
      else { e.seriesRef = { id: ns.id, n: e.seriesRef.n - n }; report.moved++; }
    }
    for (const p of mPurch) p.seriesRef = { id: ns.id, n: p.seriesRef.n - n };
    st.series.push(ns);
    return { series: ns, report };
  }

  // Edita uma ocorrência: scope 'one' (só esta) ou 'future' (esta e as próximas)
  function editOccurrence(st, item, changes, scope = 'one') {
    if (scope === 'future' && item.src === 'series') {
      const map = {};
      for (const k of ['amount', 'description', 'categoryId', 'nature', 'accountId', 'method', 'certainty']) if (k in changes) map[k] = changes[k];
      if (changes.dueDate && changes.dueDate !== item.date) map.startDate = changes.dueDate;
      return splitSeries(st, item.id, item.n, map);
    }
    if (scope === 'future' && item.src === 'client') {
      const c = item.ref;
      if ('amount' in changes) { c.adjustments = c.adjustments || []; c.adjustments.push({ id: U.uid('a_'), date: item.date, amount: changes.amount, confirmed: true }); }
      return { client: c };
    }
    const e = materialize(st, item);
    for (const k of Object.keys(changes)) e[k] = changes[k];
    return { entry: e };
  }

  /* ---------- Impacto de exclusões ---------- */
  function links(st, type, id) {
    const L = [];
    const push = (label, list) => { if (list.length) L.push({ label, count: list.length, list }); };
    if (type === 'account') {
      push('lançamentos', st.entries.filter((e) => e.accountId === id || e.fromId === id || e.toId === id));
      push('recorrências', st.series.filter((s) => s.accountId === id));
      push('clientes', st.clients.filter((c) => c.accountId === id));
      push('cartões (conta de pagamento)', st.cards.filter((c) => c.payAccountId === id));
      push('dívidas', st.debts.filter((d) => d.payAccountId === id));
      push('reservas', st.reserves.filter((r) => r.planAccountId === id));
    } else if (type === 'category') {
      push('lançamentos', st.entries.filter((e) => e.categoryId === id));
      push('recorrências', st.series.filter((s) => s.categoryId === id));
      push('compras no cartão', st.purchases.filter((p) => p.categoryId === id));
      push('clientes', st.clients.filter((c) => c.categoryId === id));
    } else if (type === 'client') {
      push('recebimentos registrados', st.entries.filter((e) => e.clientRef && e.clientRef.id === id));
    } else if (type === 'service') {
      push('clientes', st.clients.filter((c) => c.serviceId === id));
    } else if (type === 'card') {
      push('compras', st.purchases.filter((p) => p.cardId === id));
      push('pagamentos de fatura', st.entries.filter((e) => e.type === 'fatura' && e.cardId === id));
      push('recorrências no cartão', st.series.filter((s) => s.cardId === id));
    } else if (type === 'debt') {
      push('pagamentos registrados', st.entries.filter((e) => e.debtRef && e.debtRef.id === id));
    } else if (type === 'series') {
      push('ocorrências já registradas', st.entries.filter((e) => e.seriesRef && e.seriesRef.id === id));
      push('cobranças no cartão já registradas', st.purchases.filter((p) => p.seriesRef && p.seriesRef.id === id));
    } else if (type === 'reserve') {
      push('movimentações', st.entries.filter((e) => e.type === 'reserva' && e.reserveId === id));
    }
    return L;
  }
  const COLL = { account: 'accounts', category: 'categories', client: 'clients', service: 'services', card: 'cards', debt: 'debts', series: 'series', reserve: 'reserves', entry: 'entries', purchase: 'purchases' };
  // Exclui um registro. Vínculos são desfeitos (os registros vinculados continuam existindo).
  function remove(st, type, id) {
    const coll = st[COLL[type]];
    const idx = coll.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (type === 'category' && coll[idx].system) throw new Error('Categorias usadas nos cálculos não podem ser excluídas. Você pode renomeá-las.');
    if (type === 'reserve' && links(st, 'reserve', id).length) throw new Error('Essa reserva tem movimentações. Arquive em vez de excluir, para manter o histórico do dinheiro.');
    for (const g of links(st, type, id)) {
      for (const x of g.list) {
        if (type === 'account') { for (const k of ['accountId', 'fromId', 'toId', 'payAccountId', 'planAccountId']) if (x[k] === id) x[k] = null; }
        if (type === 'category' && x.categoryId === id) x.categoryId = null;
        if (type === 'client' && x.clientRef) { x.description = x.description || 'Recebimento'; delete x.clientRef; }
        if (type === 'service') x.serviceId = null;
        if (type === 'card') { if (x.cardId === id && x.type === 'fatura') x.notes = (x.notes || '') + ' (cartão excluído)'; if (st.purchases.includes(x)) x.status = 'cancelada'; if (st.series.includes(x)) x.cardId = null; }
        if (type === 'debt' && x.debtRef) delete x.debtRef;
        if (type === 'series' && x.seriesRef) delete x.seriesRef;
      }
    }
    if (type === 'debt') for (const d of st.debts) { if (d.replacedBy === id) d.replacedBy = null; }
    if (type === 'purchase') for (const d of st.debts) if (d.linkedPurchaseIds) d.linkedPurchaseIds = d.linkedPurchaseIds.filter((x) => x !== id);
    if (type === 'entry') { const e = coll[idx]; if (e.paidByPurchaseId) { /* nada a desfazer */ } }
    coll.splice(idx, 1);
  }

  /* ---------- Operações específicas ---------- */
  function transfer(st, { fromId, toId, amount, date, status = 'pago', purpose = 'movimentacao', description = '', notes = '' }) {
    if (!fromId || !toId) throw new Error('Escolha a conta de origem e a de destino.');
    if (fromId === toId) throw new Error('Origem e destino precisam ser contas diferentes.');
    if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
    const e = { id: U.uid('e_'), type: 'transferencia', fromId, toId, amount, dueDate: date, paidDate: status === 'pago' ? date : null, status, purpose, description: description || 'Transferência entre contas', notes, createdAt: now(), paidAt: status === 'pago' ? now() : null };
    st.entries.push(e);
    return e;
  }
  function payInvoice(st, cardId, month, { amount, date, accountId }) {
    if (!(amount > 0)) throw new Error('Informe o valor pago.');
    const card = st.cards.find((c) => c.id === cardId);
    const e = { id: U.uid('e_'), type: 'fatura', cardId, month, amount, accountId: accountId || card?.payAccountId || null, dueDate: date, paidDate: date, status: 'pago', description: `Pagamento fatura ${card?.name || ''} ${U.fmtMonth(month)}`, createdAt: now(), paidAt: now() };
    st.entries.push(e);
    return e;
  }
  function setInvoice(st, key, patch) {
    st.invoices[key] = { ...(st.invoices[key] || {}), ...patch };
    if (st.invoices[key].informed === null && !st.invoices[key].dueOverride && !st.invoices[key].notes) delete st.invoices[key];
  }

  // Pix no crédito
  function pixCredit(st, p) {
    const card = st.cards.find((c) => c.id === p.cardId);
    if (!card) throw new Error('Escolha o cartão usado no Pix no crédito.');
    if (!(p.net > 0)) throw new Error('Informe o valor que foi disponibilizado.');
    if (!(p.total >= p.net)) throw new Error('O total a pagar não pode ser menor que o valor recebido.');
    const pur = { id: U.uid('p_'), kind: 'pix_credito', cardId: p.cardId, description: p.description || 'Pix no crédito', date: p.date, categoryId: null, nature: p.nature || 'pessoal', mode: 'total', total: p.total, n: p.n || 1, firstInvoice: p.firstInvoice || E.invoiceMonthFor(card, p.date), net: p.net, destination: p.destination || 'nenhum', accountId: p.destination === 'conta' ? p.accountId : null, destDebtId: null, destEntryId: null, status: 'ativa', notes: p.notes || '', createdAt: now() };
    st.purchases.push(pur);
    if (p.destination === 'entrada' && p.destItemKey) {
      const it = findItem(st, p.destItemKey);
      if (it) { const e = confirm(st, it, { paidDate: p.date }); e.paidByPurchaseId = pur.id; e.method = 'pix_credito'; pur.destEntryId = e.id; }
    }
    if (p.destination === 'divida' && p.destDebtId) {
      const d = st.debts.find((x) => x.id === p.destDebtId);
      if (d) {
        const info = E.debtBalanceEstimate(st, d);
        if (info.balance != null && p.net < info.balance) { d.balance = info.balance - p.net; d.balanceDate = p.date; d.notes = (d.notes || '') + ` Parte paga com Pix no crédito em ${U.fmtDate(p.date)}.`; }
        else { d.status = 'quitada'; d.settledByPurchaseId = pur.id; d.settledDate = p.date; }
        pur.destDebtId = d.id;
      }
    }
    return pur;
  }

  // Acordo de dívida: substitui as dívidas escolhidas por uma nova
  function agreementPreview(st, { debtIds, entry = 0, n, installment }) {
    const data = E.build(st, U.addMonths(E.today(), 24));
    const replaced = debtIds.map((id) => st.debts.find((d) => d.id === id)).filter(Boolean).map((d) => E.debtInfo(st, data, d));
    const replacedBalance = U.sum(replaced, (x) => x.balance || 0);
    const unknown = replaced.filter((x) => x.balance == null).map((x) => x.d.creditor);
    const total = (entry || 0) + (installment || 0) * (n || 0);
    const replacedMonthly = U.sum(replaced, (x) => x.pay || 0);
    return { replaced, replacedBalance, unknown, total, cost: total - replacedBalance, replacedMonthly, newMonthly: installment || 0 };
  }
  function agreement(st, { debtIds, creditor, entry = 0, entryDate, n, installment, firstDue, rate = null, notes = '', accountId = null, nature = 'pessoal' }) {
    if (!debtIds.length) throw new Error('Escolha ao menos uma dívida para o acordo.');
    if (!(n > 0) || !(installment > 0) || !firstDue) throw new Error('Informe número de parcelas, valor e primeiro vencimento.');
    const nd = { id: U.uid('d_'), creditor: creditor || 'Acordo', type: 'acordo', nature, balance: installment * n, balanceDate: E.today(), rate, ratePeriod: 'mensal', nextDueDate: firstDue, installmentsLeft: n, installmentAmount: installment, minPayment: null, overdueSince: null, negotiation: '', notes, status: 'ativa', replaces: debtIds.slice(), linkedPurchaseIds: [], payAccountId: accountId, createdAt: now() };
    st.debts.push(nd);
    for (const id of debtIds) { const d = st.debts.find((x) => x.id === id); if (d) { d.status = 'substituida'; d.replacedBy = nd.id; d.replacedDate = E.today(); } }
    if (entry > 0) st.entries.push({ id: U.uid('e_'), type: 'despesa', description: `Entrada do acordo ${nd.creditor}`, amount: entry, categoryId: null, nature, accountId, dueDate: entryDate || E.today(), paidDate: null, status: 'previsto', certainty: 'contratado', debtRef: { id: nd.id, n: -1 }, createdAt: now() });
    return nd;
  }

  function reserveMove(st, { reserveId, op, amount, date, accountId }) {
    if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
    if (op !== 'rendimento' && !accountId) throw new Error('Escolha a conta de origem ou destino do dinheiro.');
    const r = st.reserves.find((x) => x.id === reserveId);
    if (op === 'retirada' && r && amount > E.reserveBalance(st, r)) throw new Error('A retirada é maior que o saldo da reserva.');
    const e = { id: U.uid('e_'), type: 'reserva', reserveId, op, amount, accountId: op === 'rendimento' ? null : accountId, dueDate: date, paidDate: date, status: 'pago', description: `${op === 'aporte' ? 'Aporte em' : op === 'retirada' ? 'Retirada de' : 'Rendimento de'} ${r ? r.name : 'reserva'}`, createdAt: now(), paidAt: now() };
    st.entries.push(e);
    return e;
  }

  // Ajusta o saldo de uma conta para o valor conferido no banco
  function adjustBalance(st, accountId, newBalance, date) {
    const a = st.accounts.find((x) => x.id === accountId);
    if (!a) throw new Error('Conta não encontrada.');
    if (a.initialBalance === null || a.initialBalance === undefined) {
      a.initialBalance = newBalance; a.refDate = date || E.today(); a.balanceSetAt = now();
      return { delta: 0, first: true };
    }
    const data = E.build(st, U.addMonths(E.today(), 1));
    const cur = E.balances(st, data).byId[accountId].balance;
    const delta = newBalance - cur;
    if (delta === 0) return { delta: 0 };
    st.entries.push({ id: U.uid('e_'), type: 'ajuste', accountId, delta, amount: Math.abs(delta), dueDate: date || E.today(), paidDate: date || E.today(), status: 'pago', description: `Ajuste de saldo ${a.name}`, notes: 'Diferença entre o saldo calculado e o saldo conferido. Não é receita nem despesa.', createdAt: now(), paidAt: now() });
    return { delta };
  }

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const counts = { ';': (first.match(/;/g) || []).length, ',': (first.match(/,/g) || []).length, '\t': (first.match(/\t/g) || []).length };
    const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ';';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return { delim, rows: rows.filter((r) => r.some((c) => c.trim() !== '')) };
  }
  const dupKey = (date, amount, desc) => `${date}|${Math.abs(amount)}|${U.norm(desc).slice(0, 24)}`;
  // map: {date, desc, amount, type?, category?} => índices de coluna; signMode: 'sinal' | 'coluna' | 'despesa' | 'receita'
  function csvPreview(st, rows, { map, hasHeader = true, signMode = 'sinal', accountId, nature, defaultCat }) {
    const body = hasHeader ? rows.slice(1) : rows;
    const existing = new Set(st.entries.filter((e) => e.type === 'receita' || e.type === 'despesa').map((e) => dupKey(e.paidDate || e.dueDate, e.amount, e.description)));
    const seen = new Set();
    const cats = st.categories;
    return body.map((r, i) => {
      const errs = [];
      const date = U.parseDateAny(r[map.date]);
      if (!date) errs.push('data inválida');
      let amount = U.toCents(r[map.amount]);
      if (amount === null) errs.push('valor inválido');
      const desc = (r[map.desc] || '').trim() || 'Sem descrição';
      let type;
      if (signMode === 'sinal') type = amount < 0 ? 'despesa' : 'receita';
      else if (signMode === 'coluna') { const t = U.norm(r[map.type] || ''); type = /^(d|saida|debito|despesa|-)/.test(t) ? 'despesa' : 'receita'; }
      else type = signMode;
      if (amount !== null) amount = Math.abs(amount);
      if (amount === 0) errs.push('valor zero');
      let categoryId = defaultCat?.[type] || null;
      if (map.category != null && r[map.category]) {
        const found = cats.find((c) => U.norm(c.name) === U.norm(r[map.category]) && c.kind === type);
        if (found) categoryId = found.id;
      }
      const k = date && amount != null ? dupKey(date, amount, desc) : null;
      const dup = k && existing.has(k) ? 'já existe no painel' : k && seen.has(k) ? 'repetido no arquivo' : null;
      if (k) seen.add(k);
      return { i, date, amount, desc, type, categoryId, accountId, nature, errs, dup, include: !errs.length && !dup };
    });
  }
  function csvCommit(st, previewRows) {
    let n = 0;
    for (const r of previewRows) {
      if (!r.include || r.errs.length) continue;
      st.entries.push({ id: U.uid('e_'), type: r.type, description: r.desc, amount: r.amount, categoryId: r.categoryId, nature: r.nature, accountId: r.accountId, method: '', dueDate: r.date, paidDate: r.date, status: 'pago', certainty: 'confirmado', notes: 'Importado de CSV', createdAt: now(), paidAt: now(), imported: true });
      n++;
    }
    return n;
  }
  function toCSV(headers, rows) {
    const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [headers.map(q).join(';'), ...rows.map((r) => r.map(q).join(';'))].join('\r\n');
  }

  return { findItem, materialize, confirm, unconfirm, cancelOccurrence, splitSeries, editOccurrence, links, remove, transfer, payInvoice, setInvoice, pixCredit, agreementPreview, agreement, reserveMove, adjustBalance, parseCSV, csvPreview, csvCommit, toCSV, dupKey };
})();
if (typeof module !== 'undefined') module.exports = { A };
