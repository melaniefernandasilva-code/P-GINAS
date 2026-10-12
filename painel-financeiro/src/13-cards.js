/* Cartões: cadastro, faturas, compras, parcelas e Pix no crédito. */

VIEWS.cartoes = () => {
  const t = curTab('cartoes');
  const body = { cartoes: cardsView, faturas: invoicesView, compras: purchasesView, pix: pixView }[t] || cardsView;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Cartões</h1></div><button class="btn primary hide-m" data-act="newPurchase">${icon('plus')}Compra</button></header>
  ${tabs([['cartoes', 'Cartões'], ['faturas', 'Faturas'], ['compras', 'Compras e parcelas'], ['pix', 'Pix no crédito']], t)}${body()}`;
};

function cardStats(card, d) {
  const T = E.today();
  const invs = Object.values(d.invoices).filter((i) => i.cardId === card.id && i.status !== 'anterior').sort((a, b) => (a.month < b.month ? -1 : 1));
  const open = invs.filter((i) => i.remaining > 0);
  const next = open[0];
  const remainingTotal = U.sum(open, (i) => i.remaining);
  const lastMonth = invs.filter((i) => i.items.length).map((i) => i.month).pop() || null;
  const goalStart = S.settings.cardGoalStart || E.orgStart(S);
  const newPurch = S.purchases.filter((p) => p.cardId === card.id && p.status !== 'cancelada' && p.mode !== 'restante' && p.date >= goalStart);
  return { invs, open, next, remainingTotal, lastMonth, newPurch };
}

function cardsView() {
  const d = data();
  const cards = S.cards.filter((c) => !c.archived);
  const months = U.monthRange(U.monthKey(E.today()), U.addMonthKey(U.monthKey(E.today()), 11));
  const bars = months.map((m) => ({ label: U.fmtMonth(m).slice(0, 3), in: 0, out: U.sum(Object.values(d.invoices).filter((i) => i.month === m && i.status !== 'anterior'), (i) => i.remaining) }));
  return `<div class="actions"><button class="btn primary" data-act="newCard">${icon('plus')}Novo cartão</button><button class="btn ghost" data-act="newPurchase">${icon('plus')}Compra</button><button class="btn ghost" data-act="newPurchase" data-old="1">${icon('plus')}Parcelas restantes de compra antiga</button></div>
  <div class="cards-grid">${cards.length ? cards.map((c) => {
    const s = cardStats(c, d);
    const isMom = c.owner === 'mae';
    const endM = c.endMonth || (isMom ? '2027-02' : null);
    const avoid = c.avoid || (S.settings.avoidCardIds || []).includes(c.id);
    return `<div class="card ccard ${isMom ? 'mom' : ''}" id="rec-${c.id}"><div class="debt-h"><strong>${h(c.name)}</strong>${isMom ? '<span class="pill soft">cartão da mãe</span>' : ''}${avoid ? `<span class="pill warn">${icon('target')}deixar de usar</span>` : ''}</div>
    <small class="muted">Fecha dia ${c.closingDay}, vence dia ${c.dueDay} · paga pela conta ${h(accName(c.payAccountId))}</small>
    <dl class="dl compact"><dt>Próxima fatura</dt><dd>${s.next ? `${money(s.next.remaining)} em ${U.fmtDate(s.next.dueDate)}` : 'nada em aberto'}</dd><dt>Total ainda a pagar</dt><dd>${money(s.remainingTotal)}</dd><dt>${isMom ? 'Limite' : 'Limite'}</dt><dd>${isMom ? 'não acompanhado (só a sua parte)' : c.limit != null ? money(c.limit) : 'não informado'}</dd>${s.lastMonth ? `<dt>Última parcela cadastrada</dt><dd>${U.fmtMonth(s.lastMonth)}</dd>` : ''}</dl>
    ${isMom ? `<div class="banner ${s.lastMonth && endM && s.lastMonth > endM ? 'warn' : 'soft'}">${icon('calendar')}<div>Previsão de fim das suas parcelas: <strong>${U.fmtMonth(endM)}</strong>${s.lastMonth ? (s.lastMonth > endM ? `. Há parcelas cadastradas até ${U.fmtMonth(s.lastMonth)}, depois da data prevista.` : s.lastMonth < endM ? `. Pelas parcelas cadastradas, termina antes: ${U.fmtMonth(s.lastMonth)}.` : '. As parcelas cadastradas batem com essa data.') : '. Nenhuma parcela cadastrada ainda.'}</div></div>` : ''}
    ${avoid ? `<p class="small ${s.newPurch.length ? 'txt-warn' : 'txt-good'}">${s.newPurch.length ? `${icon('warn')} ${U.plural(s.newPurch.length, 'compra nova', 'compras novas')} desde ${U.fmtDate(S.settings.cardGoalStart || E.orgStart(S))}: ${money(U.sum(s.newPurch, (p) => p.total || 0))}` : `${icon('ok')} Nenhuma compra nova desde ${U.fmtDate(S.settings.cardGoalStart || E.orgStart(S))}.`}</p>` : ''}
    <div class="actions wrap"><button class="btn ghost sm" data-act="editCard" data-id="${c.id}">${icon('edit')}Editar</button><button class="btn ghost sm" data-act="tab" data-tab="faturas">Faturas</button></div></div>`;
  }).join('') : emptyState('Nenhum cartão cadastrado.')}</div>
  ${cards.length ? `<section class="card"><h2>Faturas previstas nos próximos 12 meses</h2><p class="muted small">Soma do que falta pagar em todos os cartões, por mês de vencimento. Parcelas já cadastradas entram automaticamente.</p>${barsChart(bars)}</section>` : ''}`;
}

ACT.newCard = () => cardForm();
ACT.editCard = (d) => cardForm(S.cards.find((c) => c.id === d.id));
function cardForm(c) {
  openForm({
    title: c ? c.name : 'Novo cartão',
    fields: [
      { k: 'name', label: 'Nome do cartão', type: 'text', req: true, placeholder: 'Ex.: Nubank roxinho' },
      { k: 'owner', label: 'Titular', type: 'chips', options: [['proprio', 'Meu'], ['mae', 'Da minha mãe'], ['outro', 'De outra pessoa']] },
      { k: 'holder', label: 'Nome do titular', type: 'text', when: (v) => v.owner !== 'proprio', half: true },
      { k: 'limit', label: 'Limite total', type: 'money', min: 0, half: true, when: (v) => v.owner === 'proprio', help: 'Opcional.' },
      { k: 'closingDay', label: 'Dia de fechamento', type: 'number', min: 1, max: 31, step: 1, req: true, half: true },
      { k: 'dueDay', label: 'Dia de vencimento', type: 'number', min: 1, max: 31, step: 1, req: true, half: true },
      { k: 'payAccountId', label: 'Conta usada para pagar a fatura', type: 'select', options: accOptions(), help: 'No cartão da sua mãe, é a conta de onde sai o dinheiro que você repassa.' },
      { k: 'defaultNature', label: 'Uso principal', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], help: 'Cada compra pode ter sua própria natureza.' },
      { k: 'endMonth', label: 'Previsão de fim das parcelas sob sua responsabilidade', type: 'month', when: (v) => v.owner !== 'proprio' },
      { k: 'avoid', label: 'Quero deixar de usar este cartão (avisar novas compras)', type: 'check' },
      { k: 'notes', label: 'Observações', type: 'textarea' },
      { k: 'i', type: 'info', info: (v) => v.owner !== 'proprio' ? '<p class="muted small">Neste cartão, o painel acompanha só as compras sob sua responsabilidade. A fatura total e o limite disponível não são presumidos.</p>' : '' },
    ],
    values: c ? { ...c } : { owner: 'proprio', closingDay: 1, dueDay: 10, defaultNature: 'pessoal', avoid: false, payAccountId: S.settings.defaultPesAccountId || '', endMonth: '2027-02' },
    extraButtons: c ? [{ id: 'arch', label: c.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const x = st.cards.find((y) => y.id === c.id); x.archived = !x.archived; }, 'Cartão atualizado.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('card', c.id, c.name) }] : [],
    onSubmit: (v) => commit((st) => { if (v.owner === 'proprio') v.endMonth = null; if (c) Object.assign(st.cards.find((y) => y.id === c.id), v); else st.cards.push({ id: U.uid('k_'), archived: false, createdAt: Date.now(), ...v }); }, 'Cartão salvo.'),
  });
}

/* ---------- Faturas ---------- */
function invoicesView() {
  const d = data();
  const cardF = UI.filters.invCard || '';
  const T = E.today();
  let invs = Object.values(d.invoices).filter((i) => i.status !== 'anterior' && (!cardF || i.cardId === cardF) && (i.remaining > 0 || i.month >= U.addMonthKey(U.monthKey(T), -2)));
  invs.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return `<div class="toolbar"><label class="sel"><span class="sr">Cartão</span><select data-chg="setFilter" data-key="invCard"><option value="">Todos os cartões</option>${cardOptions().map(([v, l]) => `<option value="${v}" ${cardF === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></label></div>
  <p class="muted small">As compras contam como despesa por categoria no mês da fatura. Pagar a fatura só tira o dinheiro da conta e quita as compras, sem gerar outra despesa.</p>
  <div class="card list">${invs.length ? invs.map((i) => `<button class="row" data-act="invoice" data-key="${h(i.key)}"><div class="row-main"><span class="row-t">${h(cardName(i.cardId))} · ${U.fmtMonthFull(i.month)}</span><span class="row-s">vence ${U.fmtDate(i.dueDate)} · ${U.plural(i.items.length, 'item', 'itens')} somando ${money(i.itemsTotal)}${i.informed != null ? ` · informado ${money(i.informed)}` : ''}${i.paid ? ` · pago ${money(i.paid)}` : ''}</span><span class="row-tags"><span class="pill inv-${i.status.replace(' ', '')}">${{ paga: 'Paga', parcial: 'Paga em parte', aberta: 'Em aberto', vencida: 'Vencida', 'sem valor': 'Sem valor' }[i.status] || i.status}</span>${i.diff ? `<span class="pill warn">diferença ${money(i.diff)}</span>` : ''}</span></div><strong class="row-amt">${money(i.remaining > 0 ? i.remaining : i.payable)}</strong></button>`).join('') : emptyState('Nenhuma fatura em aberto.')}</div>`;
}
ACT.invoice = (dd) => {
  closeAllModals();
  const d = data();
  const inv = d.invoices[dd.key];
  if (!inv) { toast('Fatura não encontrada.', 'erro'); return; }
  const card = S.cards.find((c) => c.id === inv.cardId);
  const items = inv.items.map((it) => `<div class="row static"><div class="row-main"><span class="row-t">${h(it.p.description)}</span><span class="row-s">${it.label ? h(it.label) + ' · ' : ''}${natChip(it.nature)} ${it.p.kind === 'pix_credito' ? 'Pix no crédito' : h(catName(it.categoryId))}${it.p.virtual ? ' · assinatura' : ''}</span></div><strong class="row-amt">${money(it.amount)}</strong></div>`).join('');
  const pays = inv.payments.map((e) => `<div class="row static"><div class="row-main"><span class="row-t">Pagamento em ${U.fmtDate(e.paidDate)}</span><span class="row-s">${h(accName(e.accountId))}</span></div><div class="row-act"><strong>${money(e.amount)}</strong><button class="icon-btn" data-act="delPayment" data-id="${e.id}" aria-label="Excluir pagamento">${icon('trash')}</button></div></div>`).join('');
  openModal(`<dl class="dl compact"><dt>Vencimento</dt><dd>${U.fmtDate(inv.dueDate)}</dd><dt>Soma dos itens cadastrados</dt><dd>${money(inv.itemsTotal)}</dd><dt>Total informado da fatura</dt><dd>${inv.informed != null ? money(inv.informed) : '<span class="muted">não informado</span>'}</dd>${inv.diff ? `<dt>Diferença</dt><dd class="txt-warn">${money(inv.diff)} ${inv.diff > 0 ? '(conta como "valor sem detalhamento")' : '(itens maiores que o total informado: confira)'}</dd>` : ''}<dt>Valor a pagar</dt><dd><strong>${money(inv.payable)}</strong></dd><dt>Pago</dt><dd>${money(inv.paid)}</dd><dt>Em aberto</dt><dd><strong>${money(inv.remaining)}</strong></dd></dl>
  ${card.owner !== 'proprio' ? '<p class="muted small">Cartão de outra pessoa: este valor é só a sua parte.</p>' : ''}
  <div class="actions wrap">${inv.remaining > 0 ? `<button class="btn primary" data-act="payInvoiceForm" data-key="${h(inv.key)}">${icon('check')}Registrar pagamento</button>` : ''}<button class="btn ghost" data-act="invoiceInformed" data-key="${h(inv.key)}">Informar total da fatura</button><button class="btn ghost" data-act="invoiceDue" data-key="${h(inv.key)}">Ajustar vencimento</button></div>
  <h3 class="sec">Itens (${inv.items.length})</h3><div class="list">${items || '<p class="muted small">Nenhum item cadastrado nesta fatura.</p>'}</div>
  ${pays ? `<h3 class="sec">Pagamentos</h3><div class="list">${pays}</div>` : ''}`, { title: `Fatura ${card.name} · ${U.fmtMonthFull(inv.month)}`, wide: true });
};
ACT.payInvoiceForm = (dd) => {
  const inv = data().invoices[dd.key];
  const card = S.cards.find((c) => c.id === inv.cardId);
  closeAllModals();
  openForm({ title: 'Pagar fatura', intro: `<p>${h(card.name)} · ${U.fmtMonthFull(inv.month)}: ${money(inv.remaining)} em aberto.</p>`, fields: [{ k: 'amount', label: 'Valor pago', type: 'money', req: true, min: 1, half: true }, { k: 'date', label: 'Data', type: 'date', req: true, half: true }, { k: 'accountId', label: 'Conta', type: 'select', options: accOptions(null, false) }, { k: 'i', type: 'info', info: (v) => v.amount && v.amount < inv.remaining ? `<p class="muted small">Pagamento parcial: ficam ${money(inv.remaining - v.amount)} em aberto.</p>` : v.amount > inv.remaining ? '<p class="txt-warn small">Valor maior que o saldo da fatura.</p>' : '' }],
    values: { amount: inv.remaining, date: E.today(), accountId: card.payAccountId || S.accounts[0]?.id },
    validate: (v) => (!v.accountId ? { accountId: 'Escolha a conta.' } : null),
    onSubmit: (v) => commit((st) => A.payInvoice(st, inv.cardId, inv.month, v), 'Pagamento da fatura registrado.') });
};
ACT.invoiceInformed = (dd) => {
  const inv = data().invoices[dd.key];
  closeAllModals();
  openForm({ title: 'Total informado da fatura', intro: '<p class="muted">Use quando souber o total da fatura mas não tiver cadastrado todas as compras. O painel não soma o total às compras: mostra a diferença explicitamente.</p>', fields: [{ k: 'informed', label: 'Total da fatura (vazio = usar soma dos itens)', type: 'money', min: 0 }, { k: 'i', type: 'info', info: (v) => v.informed != null && !Number.isNaN(v.informed) ? `<p class="small">Itens cadastrados: ${money(inv.itemsTotal)}. Diferença: ${money(v.informed - inv.itemsTotal)}.</p>` : '' }], values: { informed: inv.informed },
    onSubmit: (v) => commit((st) => A.setInvoice(st, inv.key, { informed: v.informed }), 'Fatura atualizada.') });
};
ACT.invoiceDue = (dd) => {
  const inv = data().invoices[dd.key];
  closeAllModals();
  openForm({ title: 'Vencimento desta fatura', fields: [{ k: 'dueOverride', label: 'Data de vencimento (vazio = dia padrão do cartão)', type: 'date' }], values: { dueOverride: S.invoices[inv.key]?.dueOverride || null }, onSubmit: (v) => commit((st) => A.setInvoice(st, inv.key, { dueOverride: v.dueOverride }), 'Vencimento ajustado.') });
};
ACT.delPayment = (dd) => confirmBox({ title: 'Excluir pagamento?', body: '<p>O valor volta a ficar em aberto na fatura e o saldo da conta é recalculado.</p>', danger: true, confirmLabel: 'Excluir', onConfirm: () => { closeAllModals(); commit((st) => A.remove(st, 'entry', dd.id), 'Pagamento excluído.'); } });

/* ---------- Compras ---------- */
function purchasesView() {
  const cardF = UI.filters.purCard || '';
  const show = UI.filters.purShow || 'ativas';
  const d = data();
  let list = S.purchases.filter((p) => p.kind === 'compra' && (!cardF || p.cardId === cardF) && (show === 'todas' || p.status !== 'cancelada'));
  const rem = (p) => { let s = 0, n = 0; for (const inv of Object.values(d.invoices)) { if (inv.status === 'paga' || inv.status === 'anterior') continue; for (const it of inv.items) if (it.p.id === p.id) { s += it.amount; n++; } } return { s, n }; };
  list = list.map((p) => ({ p, r: rem(p) }));
  if (show === 'ativas') list = list.filter((x) => x.r.n > 0 || x.p.date >= U.addDays(E.today(), -40));
  list.sort((a, b) => (a.p.date < b.p.date ? 1 : -1));
  return `<div class="toolbar"><label class="sel"><span class="sr">Cartão</span><select data-chg="setFilter" data-key="purCard"><option value="">Todos os cartões</option>${cardOptions().map(([v, l]) => `<option value="${v}" ${cardF === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></label><label class="sel"><span class="sr">Mostrar</span><select data-chg="setFilter" data-key="purShow"><option value="ativas" ${show === 'ativas' ? 'selected' : ''}>Com parcelas a pagar ou recentes</option><option value="todas" ${show === 'todas' ? 'selected' : ''}>Todas, inclusive canceladas</option></select></label></div>
  <div class="actions"><button class="btn primary" data-act="newPurchase">${icon('plus')}Compra</button><button class="btn ghost" data-act="newPurchase" data-old="1">${icon('plus')}Parcelas restantes de compra antiga</button></div>
  <div class="card list">${list.length ? list.map(({ p, r }) => `<button class="row" data-act="purchase" data-id="${p.id}" id="rec-${p.id}"><div class="row-main"><span class="row-t">${h(p.description)}</span><span class="row-s">${h(cardName(p.cardId))} · ${U.fmtDate(p.date)} · ${p.mode === 'restante' ? `${p.remaining} parcelas restantes de ${money(p.installmentValue)}` : `${p.n}x`} · ${h(catName(p.categoryId))} · primeira fatura ${U.fmtMonth(p.firstInvoice)}</span><span class="row-tags">${natChip(p.nature)}${p.status === 'cancelada' ? '<span class="pill st-cancelado">cancelada</span>' : r.n ? `<span class="pill soft">${U.plural(r.n, 'parcela a pagar', 'parcelas a pagar')}</span>` : '<span class="pill st-pago">quitada</span>'}</span></div><strong class="row-amt">${money(p.mode === 'restante' ? p.installmentValue * p.remaining : p.total)}</strong></button>`).join('') : emptyState('Nenhuma compra neste filtro.')}</div>`;
}
ACT.newPurchase = (d) => purchaseForm(null, { old: d && d.old === '1' });
ACT.purchase = (d) => { const p = S.purchases.find((x) => x.id === d.id); if (!p) return; closeAllModals(); if (p.kind === 'pix_credito') return pixForm(p); purchaseForm(p); };
function purchaseForm(p, { old = false } = {}) {
  if (!S.cards.filter((c) => !c.archived).length) { toast('Cadastre um cartão primeiro.', 'erro'); go('cartoes', 'cartoes'); return; }
  const isNew = !p;
  const T = E.today();
  const v = p ? { ...p, customText: p.customAmounts ? p.customAmounts.map(U.moneyInput).join('; ') : '' } : { cardId: cardOptions()[0][0], date: T, nature: 'pessoal', mode: old ? 'restante' : 'total', n: 1, paidBefore: 0, firstInvoice: null };
  if (!v.firstInvoice) { const c = S.cards.find((x) => x.id === v.cardId); v.firstInvoice = old ? U.addMonthKey(U.monthKey(T), 1) : E.invoiceMonthFor(c, v.date); }
  const fields = [
    { k: 'cardId', label: 'Cartão', type: 'select', options: cardOptions(), half: true },
    { k: 'mode', label: 'Tipo de cadastro', type: 'chips', options: [['total', 'Compra nova (valor total)'], ['restante', 'Só o que falta pagar']], half: true },
    { k: 'description', label: 'Descrição', type: 'text', req: true },
    { k: 'date', label: 'Data da compra', type: 'date', req: true, half: true, help: 'Para compras antigas, pode ser aproximada.' },
    { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], half: true },
    { k: 'categoryId', label: 'Categoria', type: 'select', dynamic: true, options: (x) => catOptions(x.nature, 'despesa') },
    { k: 'total', label: 'Valor total', type: 'money', min: 1, half: true, when: (x) => x.mode === 'total' },
    { k: 'n', label: 'Parcelas', type: 'number', min: 1, max: 48, step: 1, half: true, when: (x) => x.mode === 'total' },
    { k: 'installmentValue', label: 'Valor de cada parcela', type: 'money', min: 1, half: true, when: (x) => x.mode === 'restante' },
    { k: 'remaining', label: 'Parcelas que faltam', type: 'number', min: 1, max: 120, step: 1, half: true, when: (x) => x.mode === 'restante' },
    { k: 'paidBefore', label: 'Parcelas já pagas antes (só para numerar)', type: 'number', min: 0, step: 1, half: true, when: (x) => x.mode === 'restante' },
    { k: 'firstInvoice', label: 'Fatura da primeira parcela a pagar', type: 'month', req: true, half: true, help: 'Calculada pela data e pelo fechamento. Corrija se o emissor usou outro mês.' },
    { k: 'customText', label: 'Valores diferentes por parcela (opcional)', type: 'text', placeholder: 'Ex.: 150,10; 149,95; 149,95', help: 'Use quando o emissor distribuir os centavos de outro jeito. Deixe vazio para dividir igualmente.' },
    { k: 'notes', label: 'Observações', type: 'textarea' },
    { k: 'prev', type: 'info', info: (x) => {
      const pp = { ...x, kind: 'compra', status: 'ativa', customAmounts: parseCustom(x.customText) };
      if (!pp.firstInvoice) return '';
      const ins = E.purchaseInstallments(pp);
      if (!ins.length) return '';
      const card = S.cards.find((c) => c.id === x.cardId);
      return `<div class="banner soft">${icon('card')}<div>${ins.length === 1 ? `Parcela única de ${money(ins[0].amount)} na fatura de ${U.fmtMonth(ins[0].month)}` : `${ins.length} parcelas: ${money(ins[0].amount)}${ins[1] && ins[1].amount !== ins[0].amount ? ` (primeira) e ${money(ins[1].amount)}` : ' cada'}, de ${U.fmtMonth(ins[0].month)} a ${U.fmtMonth(ins[ins.length - 1].month)}`}. Total: ${money(U.sum(ins, (i) => i.amount))}. ${card && card.owner === 'mae' && card.endMonth && ins[ins.length - 1].month > card.endMonth ? `<strong>Termina depois de ${U.fmtMonth(card.endMonth)}, previsão do cartão.</strong>` : ''}</div></div>`;
    } },
  ];
  openForm({
    title: isNew ? (old ? 'Parcelas restantes' : 'Compra no cartão') : p.description, fields, values: v, wide: true,
    validate: (x) => {
      if (x.mode === 'total' && !(x.total > 0)) return { total: 'Informe o valor total.' };
      if (x.mode === 'restante' && (!(x.installmentValue > 0) || !(x.remaining > 0))) return { installmentValue: 'Informe o valor e quantas parcelas faltam.' };
      const c = parseCustom(x.customText);
      if (x.customText && !c) return { customText: 'Não consegui ler os valores. Separe com ponto e vírgula.' };
      const n = x.mode === 'total' ? (x.n || 1) : x.remaining;
      if (c && c.length !== n) return { customText: `Informe exatamente ${n} valores.` };
      if (c && x.mode === 'total' && U.sum(c) !== x.total) return { customText: `A soma (${money(U.sum(c))}) precisa ser igual ao total (${money(x.total)}).` };
      return null;
    },
    extraButtons: p ? [{ id: 'cancel', label: p.status === 'cancelada' ? 'Reativar' : 'Cancelar compra', onClick: () => commit((st) => { const x = st.purchases.find((y) => y.id === p.id); x.status = x.status === 'cancelada' ? 'ativa' : 'cancelada'; }, p.status === 'cancelada' ? 'Compra reativada.' : 'Compra cancelada. Ela sai das faturas futuras.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => confirmBox({ title: 'Excluir compra?', body: '<p>A compra sai de todas as faturas, inclusive das já pagas, o que muda o histórico de despesas. Se ela foi estornada, prefira "Cancelar compra".</p>', danger: true, confirmLabel: 'Excluir', onConfirm: () => { closeAllModals(); commit((st) => A.remove(st, 'purchase', p.id), 'Compra excluída.'); } }) }] : [],
    onSubmit: (x) => commit((st) => {
      const obj = { cardId: x.cardId, mode: x.mode, description: x.description, date: x.date, nature: x.nature, categoryId: x.categoryId, total: x.mode === 'total' ? x.total : null, n: x.mode === 'total' ? (x.n || 1) : null, installmentValue: x.mode === 'restante' ? x.installmentValue : null, remaining: x.mode === 'restante' ? x.remaining : null, paidBefore: x.mode === 'restante' ? (x.paidBefore || 0) : 0, firstInvoice: x.firstInvoice, customAmounts: parseCustom(x.customText), notes: x.notes };
      if (isNew) st.purchases.push({ id: U.uid('p_'), kind: 'compra', status: 'ativa', createdAt: Date.now(), ...obj });
      else Object.assign(st.purchases.find((y) => y.id === p.id), obj);
    }, isNew ? 'Compra registrada.' : 'Compra atualizada.'),
  });
  // recalcula a fatura sugerida ao trocar cartão ou data em compra nova
  if (isNew) {
    const f = $('#modals .modal-wrap:last-child form');
    const upd = () => { const c = S.cards.find((y) => y.id === f.querySelector('[name=cardId]').value); const dt = f.querySelector('[name=date]').value; const mode = f.querySelector('input[name=mode]:checked')?.value; if (c && dt && mode === 'total') f.querySelector('[name=firstInvoice]').value = E.invoiceMonthFor(c, dt); f.dispatchEvent(new Event('input')); };
    f.querySelector('[name=cardId]').addEventListener('change', upd);
    f.querySelector('[name=date]').addEventListener('change', upd);
  }
}
function parseCustom(t) {
  if (!t || !String(t).trim()) return null;
  const parts = String(t).split(';').map((s) => U.toCents(s.trim()));
  if (parts.some((x) => x === null || x <= 0)) return null;
  return parts;
}

/* ---------- Pix no crédito ---------- */
function pixView() {
  const list = S.purchases.filter((p) => p.kind === 'pix_credito').sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = U.sum(list.filter((p) => p.status !== 'cancelada'), (p) => (p.total || 0) - (p.net || 0));
  return `<p class="muted">Pix no crédito aumenta o dinheiro disponível na hora, mas não é renda: vira parcelas nas próximas faturas, com juros e tarifas. O custo (total a pagar menos o valor recebido) aparece como despesa de "Juros e tarifas de crédito".</p>
  <div class="sumline"><span>Custo total cadastrado em juros e tarifas: <strong class="amt-out">${money(total)}</strong></span></div>
  <div class="actions"><button class="btn primary" data-act="newPix">${icon('plus')}Registrar Pix no crédito</button></div>
  <div class="card list">${list.length ? list.map((p) => `<button class="row" data-act="purchase" data-id="${p.id}"><div class="row-main"><span class="row-t">${h(p.description)}</span><span class="row-s">${U.fmtDate(p.date)} · ${h(cardName(p.cardId))} · recebido ${money(p.net)} · ${p.n}x · ${{ conta: 'entrou na conta ' + accName(p.accountId), entrada: 'pagou uma conta prevista', divida: 'pagou uma dívida', nenhum: 'destino não informado' }[p.destination] || ''}</span><span class="row-tags">${p.status === 'cancelada' ? '<span class="pill st-cancelado">cancelado</span>' : ''}<span class="pill bad">custo ${money((p.total || 0) - (p.net || 0))}</span></span></div><strong class="row-amt">${money(p.total)}</strong></button>`).join('') : emptyState('Nenhum Pix no crédito registrado.')}</div>`;
}
ACT.newPix = () => pixForm();
function pixForm(p) {
  if (!S.cards.filter((c) => !c.archived).length) { toast('Cadastre um cartão primeiro.', 'erro'); return; }
  const isNew = !p;
  const T = E.today();
  const d = data();
  const openBills = d.items.filter((i) => (i.status === 'previsto' || i.status === 'vencido') && i.type === 'despesa' && ['entry', 'series'].includes(i.src) && i.date <= U.addDays(T, 45));
  const debts = S.debts.filter((x) => x.status === 'ativa' && !(x.linkedPurchaseIds || []).length);
  const v = p ? { ...p } : { cardId: cardOptions()[0][0], date: T, n: 1, nature: 'pessoal', destination: 'conta', accountId: S.settings.defaultPesAccountId || '' };
  openForm({
    title: isNew ? 'Pix no crédito' : p.description, wide: true,
    fields: [
      { k: 'description', label: 'Para que foi', type: 'text', req: true, placeholder: 'Ex.: pagar o aluguel' },
      { k: 'cardId', label: 'Cartão', type: 'select', options: cardOptions(), half: true },
      { k: 'date', label: 'Data', type: 'date', req: true, half: true },
      { k: 'net', label: 'Valor disponibilizado (líquido)', type: 'money', req: true, min: 1, half: true },
      { k: 'total', label: 'Total a pagar no cartão', type: 'money', req: true, min: 1, half: true, help: 'Soma de todas as parcelas com juros e tarifas.' },
      { k: 'n', label: 'Parcelas', type: 'number', min: 1, max: 48, step: 1, req: true, half: true },
      { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], half: true },
      ...(isNew ? [
        { k: 'destination', label: 'O dinheiro foi usado para', type: 'chips', options: [['conta', 'Entrou em uma conta'], ['entrada', 'Pagar uma conta prevista'], ['divida', 'Pagar uma dívida'], ['nenhum', 'Não informar']] },
        { k: 'accountId', label: 'Conta', type: 'select', options: accOptions(null, false), when: (x) => x.destination === 'conta' },
        { k: 'destItemKey', label: 'Conta paga com o Pix', type: 'select', options: [['', 'Escolha'], ...openBills.map((i) => [i.key, `${i.desc} · ${money(i.amount)} · ${U.fmtDate(i.date)}`])], when: (x) => x.destination === 'entrada', help: 'Ela será marcada como paga, sem tirar dinheiro de conta.' },
        { k: 'destDebtId', label: 'Dívida paga com o Pix', type: 'select', options: [['', 'Escolha'], ...debts.map((x) => [x.id, x.creditor])], when: (x) => x.destination === 'divida', help: 'A dívida é quitada (ou reduzida) para não contar a dívida antiga e o Pix ao mesmo tempo.' },
      ] : []),
      { k: 'notes', label: 'Observações', type: 'textarea' },
      { k: 'prev', type: 'info', info: (x) => x.net > 0 && x.total >= x.net ? `<div class="banner warn">${icon('warn')}<div>Custo deste crédito: <strong>${money(x.total - x.net)}</strong> (${U.pct((x.total - x.net) / x.net, 1)} sobre o valor recebido). ${x.n > 1 ? `${x.n} parcelas de cerca de ${money(Math.round(x.total / x.n))}.` : ''}</div></div>` : '' },
    ],
    values: v,
    validate: (x) => (x.total < x.net ? { total: 'O total a pagar não pode ser menor que o valor recebido.' } : x.destination === 'entrada' && !x.destItemKey ? { destItemKey: 'Escolha a conta paga.' } : x.destination === 'divida' && !x.destDebtId ? { destDebtId: 'Escolha a dívida.' } : x.destination === 'conta' && !x.accountId ? { accountId: 'Escolha a conta.' } : null),
    extraButtons: p ? [{ id: 'cancel', label: p.status === 'cancelada' ? 'Reativar' : 'Cancelar', onClick: () => commit((st) => { const x = st.purchases.find((y) => y.id === p.id); x.status = x.status === 'cancelada' ? 'ativa' : 'cancelada'; }, 'Atualizado.') }] : [],
    onSubmit: (x) => commit((st) => {
      if (isNew) A.pixCredit(st, x);
      else { const y = st.purchases.find((z) => z.id === p.id); Object.assign(y, { description: x.description, cardId: x.cardId, date: x.date, net: x.net, total: x.total, n: x.n, nature: x.nature, notes: x.notes }); }
    }, isNew ? 'Pix no crédito registrado.' : 'Atualizado.'),
  });
}
