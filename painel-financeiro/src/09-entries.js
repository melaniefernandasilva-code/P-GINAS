/* Lançamentos: lista, detalhe de ocorrência, formulários de receita/despesa e recorrência. */

function horizonTo() { return U.addMonths(E.today(), Math.max(24, S.settings.horizon || 6)); }
function data() { return E.build(S, horizonTo()); }
function findItemByKey(key) { return data().items.find((i) => i.key === key) || null; }

function itemRow(it, opts = {}) {
  const inflow = it.cash ? it.cash.reduce((a, c) => a + c.delta, 0) : 0;
  const isTransfer = it.type === 'transferencia';
  const amtCls = isTransfer ? 'amt-neutral' : inflow > 0 ? 'amt-in' : inflow < 0 ? 'amt-out' : 'amt-neutral';
  const amt = isTransfer ? money(it.amount) : inflow !== 0 ? signed(inflow) : money(it.amount);
  const sub = [];
  if (opts.showDate !== false) sub.push(U.fmtDate(it.date));
  if (it.label) sub.push(h(it.label));
  if (it.type === 'transferencia') sub.push(`${h(accName(it.ref.fromId))} para ${h(accName(it.ref.toId))}`);
  else if (it.accountId !== undefined && it.src !== 'card') sub.push(h(it.accountId ? accName(it.accountId) : 'sem conta'));
  if (it.categoryId) sub.push(h(catName(it.categoryId)));
  if (it.ref?.paidByPurchaseId) sub.push('pago com Pix no crédito');
  return `<button class="row" data-act="item" data-key="${h(it.key)}" id="rec-${h(it.id || '')}"><div class="row-main"><span class="row-t">${h(it.desc || 'Sem descrição')}</span><span class="row-s">${sub.join(' · ')}</span><span class="row-tags">${statusPill(it)}${certPill(it.certainty)}${opts.nature ? natChip(it.nature) : ''}${it.src === 'series' || it.src === 'client' ? '<span class="pill soft">recorrente</span>' : ''}</span></div><strong class="row-amt ${amtCls}">${amt}</strong></button>`;
}
function cardRowHTML(r) {
  return `<button class="row" data-act="purchase" data-id="${h(r.p ? r.p.id : '')}" ${r.p && !r.p.virtual ? '' : 'disabled'}><div class="row-main"><span class="row-t">${h(r.desc)}</span><span class="row-s">Cartão ${h(cardName(r.cardId))} · fatura ${U.fmtMonth(r.month)}${r.label ? ' · ' + h(r.label) : ''} · ${h(r.kind === 'divida' ? 'pagamento de crédito' : catName(r.categoryId))}</span><span class="row-tags">${statusPill(r)}<span class="pill soft">${icon('card')}cartão</span></span></div><strong class="row-amt amt-out">${signed(-r.amount)}</strong></button>`;
}

/* ---------- Detalhe de uma ocorrência ---------- */
ACT.item = (d) => openItem(d.key);
function openItem(key) {
  const it = findItemByKey(key);
  if (!it) { toast('Registro não encontrado. Ele pode ter sido alterado.', 'erro'); return; }
  const srcText = {
    entry: 'Lançamento registrado.',
    series: 'Ocorrência gerada por uma recorrência. Ao confirmar ou editar, ela vira um lançamento registrado.',
    client: 'Mensalidade gerada pelo contrato do cliente, dentro da vigência.',
    debt: 'Pagamento previsto pela dívida cadastrada.',
    invoice: 'Valor restante da fatura do cartão. As compras já contam como despesa por categoria; o pagamento só movimenta o caixa.',
    plan: 'Aporte planejado na reserva ou objetivo. Não é despesa.',
    pix: 'Valor de Pix no crédito que entrou na conta. É crédito, não renda.',
  }[it.src] || '';
  const e = it.src === 'entry' ? it.ref : null;
  const rows = [
    ['Valor', money(Math.abs(it.amount))],
    ['Situação', statusPill(it) + ' ' + certPill(it.certainty)],
    [it.status === 'pago' ? 'Data efetiva' : 'Data prevista', U.fmtDate(it.status === 'pago' ? (it.paidDate || it.date) : it.dueDate || it.date)],
    it.status === 'pago' && it.dueDate && it.dueDate !== it.paidDate ? ['Data prevista', U.fmtDate(it.dueDate)] : null,
    it.nature ? ['Natureza', natChip(it.nature)] : null,
    it.type === 'transferencia' ? ['Contas', `${h(accName(e.fromId))} para ${h(accName(e.toId))}`] : it.accountId !== undefined ? ['Conta', h(it.accountId ? accName(it.accountId) : 'Sem conta definida')] : null,
    it.categoryId ? ['Categoria', h(catName(it.categoryId))] : null,
    e && e.method ? ['Forma de pagamento', h((METHODS.find((m) => m[0] === e.method) || [0, e.method])[1])] : null,
    it.label ? ['Parcela', h(it.label)] : null,
    e && e.notes ? ['Observações', h(e.notes)] : null,
  ].filter(Boolean);
  const implicit = (it.pnl || []).filter((p) => p.implicit && (p.kind === 'retirada' || p.kind === 'aporte_pro'));
  const btn = [];
  const canConfirm = it.status !== 'pago' && it.status !== 'cancelado' && ['entry', 'series', 'client', 'debt', 'invoice', 'plan'].includes(it.src) && it.type !== 'ajuste';
  if (canConfirm) btn.push(`<button class="btn primary" data-act="confirmItem" data-key="${h(key)}">${icon('check')}${it.cash?.some((c) => c.delta > 0) && it.type !== 'transferencia' ? 'Confirmar recebimento' : 'Confirmar pagamento'}</button>`);
  if (it.src === 'entry' && it.status === 'pago' && ['receita', 'despesa', 'transferencia'].includes(it.type)) btn.push(`<button class="btn ghost" data-act="unconfirm" data-id="${e.id}">Voltar para previsto</button>`);
  if (['entry', 'series', 'client', 'debt'].includes(it.src) && ['receita', 'despesa', 'transferencia'].includes(it.type)) btn.push(`<button class="btn ghost" data-act="editItem" data-key="${h(key)}">${icon('edit')}Editar</button>`);
  if (it.status !== 'cancelado' && ['series', 'client', 'debt'].includes(it.src) || (it.src === 'entry' && it.status === 'previsto')) btn.push(`<button class="btn ghost" data-act="cancelItem" data-key="${h(key)}">${icon('x')}Cancelar esta ocorrência</button>`);
  if (it.src === 'entry' && it.status === 'cancelado') btn.push(`<button class="btn ghost" data-act="uncancel" data-id="${e.id}">Reativar</button>`);
  if (it.src === 'entry') btn.push(`<button class="btn ghost danger-txt" data-act="deleteEntry" data-id="${e.id}">${icon('trash')}Excluir</button>`);
  if (it.src === 'series') btn.push(`<button class="btn ghost" data-act="editSeries" data-id="${it.id}">Abrir recorrência</button>`);
  if (it.src === 'client') btn.push(`<button class="btn ghost" data-act="go" data-route="profissional" data-tab="clientes" data-id="${it.id}">Abrir cliente</button>`);
  if (it.src === 'debt') btn.push(`<button class="btn ghost" data-act="go" data-route="dividas" data-id="${it.id}">Abrir dívida</button>`);
  if (it.src === 'invoice') btn.push(`<button class="btn ghost" data-act="invoice" data-key="${h(it.invKey)}">Ver fatura</button>`);
  if (e && e.seriesRef) btn.push(`<button class="btn ghost" data-act="editSeries" data-id="${e.seriesRef.id}">Abrir recorrência</button>`);
  openModal(`<p class="muted">${srcText}</p><dl class="dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${implicit.length ? `<div class="banner soft">${icon('swap')}<div>${implicit[0].kind === 'retirada' ? `Dinheiro da conta PJ usado para algo pessoal: conta como <strong>retirada</strong> de ${money(implicit[0].amount)} no profissional e como recurso recebido no pessoal.` : `Dinheiro pessoal usado para algo profissional: aparece como <strong>aporte do pessoal</strong> de ${money(implicit[0].amount)}.`} Para corrigir, edite a conta ou a natureza.</div></div>` : ''}<div class="actions wrap">${btn.join('')}</div>`, { title: it.desc || 'Registro' });
}

ACT.confirmItem = (d) => {
  const it = findItemByKey(d.key);
  if (!it) return;
  closeModal();
  const isIn = it.cash.some((c) => c.delta > 0) && it.type !== 'transferencia';
  const showAcc = it.type !== 'transferencia';
  openForm({
    title: isIn ? 'Confirmar recebimento' : 'Confirmar pagamento',
    intro: `<p><strong>${h(it.desc)}</strong>, previsto para ${U.fmtDate(it.dueDate || it.date)}.</p>`,
    fields: [
      { k: 'amount', label: isIn ? 'Valor recebido' : 'Valor pago', type: 'money', req: true, min: 1, half: true },
      { k: 'paidDate', label: 'Data efetiva', type: 'date', req: true, half: true },
      ...(showAcc ? [{ k: 'accountId', label: isIn ? 'Entrou na conta' : 'Saiu da conta', type: 'select', options: accOptions() }] : []),
      { k: 'note', type: 'info', info: (v) => it.src === 'invoice' && v.amount && v.amount < it.amount ? `<p class="muted">Pagamento parcial: ficam ${money(it.amount - v.amount)} em aberto nesta fatura.</p>` : '' },
    ],
    values: { amount: it.amount, paidDate: E.today(), accountId: it.accountId || '' },
    submitLabel: 'Confirmar',
    onSubmit: (v) => commit((st) => {
      const it2 = A.findItem(st, it.key, horizonTo());
      if (!it2) throw new Error('Registro não encontrado.');
      A.confirm(st, it2, { paidDate: v.paidDate, amount: v.amount, accountId: showAcc ? (v.accountId || null) : undefined });
    }, isIn ? 'Recebimento confirmado.' : 'Pagamento confirmado.'),
  });
};
ACT.unconfirm = (d) => commit((st) => A.unconfirm(st, d.id), 'Voltou para previsto.');
ACT.uncancel = (d) => commit((st) => { const e = st.entries.find((x) => x.id === d.id); e.status = 'previsto'; }, 'Ocorrência reativada.');
ACT.cancelItem = (d) => {
  const it = findItemByKey(d.key);
  confirmBox({ title: 'Cancelar esta ocorrência?', body: `<p>${h(it.desc)} de ${U.fmtDate(it.date)} deixa de contar nas projeções. As demais ocorrências continuam. Você pode reativar depois.</p>`, confirmLabel: 'Cancelar ocorrência', onConfirm: () => commit((st) => { const it2 = A.findItem(st, d.key, horizonTo()); A.cancelOccurrence(st, it2); }, 'Ocorrência cancelada.') });
};
ACT.deleteEntry = (d) => {
  const e = S.entries.find((x) => x.id === d.id);
  const extra = e.seriesRef || e.clientRef || e.debtRef ? '<p class="muted">Este lançamento veio de uma recorrência, cliente ou dívida. Ao excluir, a ocorrência prevista original volta a aparecer. Para que ela não conte, use "Cancelar esta ocorrência".</p>' : '';
  confirmBox({ title: 'Excluir lançamento?', body: `<p>${h(e.description)} (${money(e.amount)}) será removido.</p>${extra}`, confirmLabel: 'Excluir', danger: true, onConfirm: () => commit((st) => A.remove(st, 'entry', d.id), 'Lançamento excluído.') });
};

/* ---------- Formulário de receita/despesa ---------- */
function entryFields(mode) {
  // mode: 'new' | 'edit-entry' | 'edit-occ'
  const isNew = mode === 'new';
  return [
    { k: 'type', label: 'Tipo', type: 'chips', options: [['despesa', 'Despesa'], ['receita', 'Receita']], when: () => isNew },
    { k: 'description', label: 'Descrição', type: 'text', req: true, placeholder: 'Ex.: Canva, aluguel, mensalidade' },
    { k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true },
    { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], half: true, help: 'Depende do uso, não da conta ou cartão.' },
    { k: 'categoryId', label: 'Categoria', type: 'select', dynamic: true, options: (v) => catOptions(v.nature, v.type) },
    { k: 'payWith', label: 'Pagamento por', type: 'chips', options: [['conta', 'Conta'], ['cartao', 'Cartão de crédito']], when: (v) => isNew && v.type === 'despesa' },
    { k: 'accountId', label: 'Conta', type: 'select', options: accOptions(), when: (v) => v.type === 'receita' || v.payWith !== 'cartao' || !isNew, half: true },
    { k: 'cardId', label: 'Cartão', type: 'select', options: () => cardOptions().length ? cardOptions() : [['', 'Nenhum cartão cadastrado']], when: (v) => isNew && v.type === 'despesa' && v.payWith === 'cartao', half: true },
    { k: 'method', label: 'Forma', type: 'select', options: [['', 'Não informar'], ...METHODS], when: (v) => v.payWith !== 'cartao' || !isNew, half: true },
    { k: 'dueDate', label: (isNew ? 'Data prevista' : 'Data prevista'), type: 'date', req: true, half: true },
    { k: 'status', label: 'Situação', type: 'chips', options: (v) => [['previsto', 'Previsto'], ['pago', v.type === 'receita' ? 'Já recebido' : 'Já pago']], when: (v) => !(isNew && v.payWith === 'cartao' && v.type === 'despesa'), half: true },
    { k: 'paidDate', label: 'Data efetiva', type: 'date', when: (v) => v.status === 'pago' && !(isNew && v.payWith === 'cartao' && v.type === 'despesa'), half: true },
    { k: 'recurrence', label: 'Repetição', type: 'chips', options: (v) => v.payWith === 'cartao' && v.type === 'despesa' ? [['unica', 'Única ou parcelada'], ['recorrente', 'Assinatura mensal']] : [['unica', 'Única'], ['recorrente', 'Recorrente'], ['parcelada', 'Parcelada (boleto/carnê)']], when: () => isNew },
    { k: 'n', label: 'Parcelas no cartão', type: 'number', min: 1, max: 48, step: 1, half: true, when: (v) => isNew && v.payWith === 'cartao' && v.type === 'despesa' && v.recurrence !== 'recorrente', help: 'O valor acima é o total da compra.' },
    { k: 'frequency', label: 'Frequência', type: 'select', options: FREQS, half: true, when: (v) => isNew && v.recurrence === 'recorrente' && v.payWith !== 'cartao' },
    { k: 'endDate', label: 'Termina em (opcional)', type: 'date', half: true, when: (v) => isNew && v.recurrence === 'recorrente' },
    { k: 'count', label: 'Número de parcelas', type: 'number', min: 2, max: 360, step: 1, half: true, when: (v) => isNew && v.recurrence === 'parcelada', help: 'O valor acima é o de cada parcela.' },
    { k: 'certainty', label: 'Certeza do valor', type: 'chips', options: [['confirmado', 'Valor conhecido'], ['estimado', 'Estimativa']], help: 'Contas variáveis, como luz, podem ficar como estimativa.' },
    { k: 'notes', label: 'Observações', type: 'textarea' },
    { k: 'prev', type: 'info', info: (v) => {
      if (!isNew) return '';
      if (v.payWith === 'cartao' && v.type === 'despesa' && v.cardId && v.dueDate && v.recurrence !== 'recorrente') {
        const card = S.cards.find((c) => c.id === v.cardId); if (!card) return '';
        const m = E.invoiceMonthFor(card, v.dueDate); const n = v.n || 1;
        const parts = v.amount > 0 ? U.split(v.amount, n) : [];
        return `<div class="banner soft">${icon('card')}<div>Primeira parcela na fatura de <strong>${U.fmtMonth(m)}</strong> (vence ${U.fmtDate(E.invoiceDueDate(S, card, m))})${n > 1 && parts.length ? `, ${n}x de ${money(parts[1] ?? parts[0])}${parts[0] !== parts[1] ? ` (primeira ${money(parts[0])})` : ''}, última em ${U.fmtMonth(U.addMonthKey(m, n - 1))}` : ''}. Dá para ajustar o mês da fatura depois, na compra.</div></div>`;
      }
      return '';
    } },
  ];
}
function openEntryForm(preset = {}) {
  const T = E.today();
  const nature = preset.nature || (UI.route === 'profissional' ? 'profissional' : 'pessoal');
  const values = { type: 'despesa', nature, payWith: 'conta', status: 'previsto', dueDate: T, paidDate: T, recurrence: 'unica', frequency: 'mensal', n: 1, certainty: 'confirmado', accountId: nature === 'profissional' ? (S.settings.defaultProAccountId || '') : (S.settings.defaultPesAccountId || ''), ...preset };
  openForm({
    title: values.type === 'receita' ? 'Nova receita' : 'Nova despesa',
    fields: entryFields('new'),
    values,
    submitLabel: 'Salvar',
    validate: (v) => (v.payWith === 'cartao' && v.type === 'despesa' && !v.cardId ? { cardId: 'Cadastre um cartão primeiro, em Cartões.' } : v.endDate && v.endDate < v.dueDate ? { endDate: 'O término precisa ser depois da primeira data.' } : null),
    onSubmit: (v) => commit((st) => createEntryFromForm(st, v), 'Lançamento salvo.'),
  });
}
function createEntryFromForm(st, v) {
  const now = Date.now();
  if (v.type === 'despesa' && v.payWith === 'cartao') {
    const card = st.cards.find((c) => c.id === v.cardId);
    if (v.recurrence === 'recorrente') {
      st.series.push({ id: U.uid('s_'), type: 'despesa', description: v.description, amount: v.amount, categoryId: v.categoryId, nature: v.nature, accountId: null, cardId: v.cardId, method: 'cartao', frequency: 'mensal', startDate: v.dueDate, endDate: v.endDate, count: null, certainty: v.certainty, notes: v.notes || '', createdAt: now });
      return;
    }
    st.purchases.push({ id: U.uid('p_'), kind: 'compra', cardId: v.cardId, description: v.description, date: v.dueDate, categoryId: v.categoryId, nature: v.nature, mode: 'total', total: v.amount, n: v.n || 1, firstInvoice: E.invoiceMonthFor(card, v.dueDate), status: 'ativa', notes: v.notes || '', createdAt: now });
    return;
  }
  if (v.recurrence === 'recorrente' || v.recurrence === 'parcelada') {
    const s = { id: U.uid('s_'), type: v.type, description: v.description, amount: v.amount, categoryId: v.categoryId, nature: v.nature, accountId: v.accountId, method: v.method || '', frequency: v.recurrence === 'parcelada' ? 'mensal' : v.frequency, startDate: v.dueDate, endDate: v.recurrence === 'recorrente' ? v.endDate : null, count: v.recurrence === 'parcelada' ? v.count : null, certainty: v.certainty, notes: v.notes || '', createdAt: now };
    st.series.push(s);
    if (v.status === 'pago') {
      const it = A.findItem(st, `s:${s.id}#0`, U.addMonths(E.today(), 24));
      if (it) A.confirm(st, it, { paidDate: v.paidDate || v.dueDate });
    }
    return;
  }
  st.entries.push({ id: U.uid('e_'), type: v.type, description: v.description, amount: v.amount, categoryId: v.categoryId, nature: v.nature, accountId: v.accountId, method: v.method || '', dueDate: v.dueDate, paidDate: v.status === 'pago' ? (v.paidDate || v.dueDate) : null, status: v.status, certainty: v.certainty, notes: v.notes || '', createdAt: now, paidAt: v.status === 'pago' ? now : null });
}

ACT.editItem = (d) => {
  const it = findItemByKey(d.key);
  if (!it) return;
  closeModal();
  if (it.type === 'transferencia') return openTransferForm(it.ref);
  const base = it.src === 'entry' ? it.ref : { description: it.desc, amount: it.amount, nature: it.nature, categoryId: it.categoryId, accountId: it.accountId, method: it.ref?.method || '', dueDate: it.date, certainty: it.certainty === 'contratado' ? 'confirmado' : it.certainty, notes: '' };
  const recurring = it.src === 'series' || it.src === 'client' || (it.src === 'entry' && it.ref.seriesRef);
  const fields = entryFields('edit').filter((f) => !['status', 'paidDate'].includes(f.k));
  if (it.src === 'entry' && it.status === 'pago') fields.splice(fields.findIndex((f) => f.k === 'dueDate') + 1, 0, { k: 'paidDate', label: 'Data efetiva', type: 'date', half: true });
  if (recurring && it.src !== 'entry') fields.unshift({ k: 'scope', label: 'Aplicar a', type: 'chips', options: it.src === 'client' ? [['one', 'Só esta mensalidade'], ['future', 'Esta e as próximas (reajuste)']] : [['one', 'Só esta ocorrência'], ['future', 'Esta e as próximas']], help: 'Ocorrências já pagas não são alteradas.' });
  openForm({
    title: 'Editar ' + (it.type === 'receita' ? 'receita' : 'despesa'),
    fields,
    values: { ...base, type: it.type, scope: 'one', payWith: 'conta', paidDate: base.paidDate },
    onSubmit: (v) => commit((st) => {
      const it2 = A.findItem(st, it.key, horizonTo());
      const ch = { description: v.description, amount: v.amount, nature: v.nature, categoryId: v.categoryId, accountId: v.accountId, method: v.method, dueDate: v.dueDate, certainty: v.certainty, notes: v.notes };
      if (it.src === 'entry' && it.status === 'pago' && v.paidDate) ch.paidDate = v.paidDate;
      if (it.src === 'client' && v.scope === 'future') { A.editOccurrence(st, it2, { amount: v.amount }, 'future'); return; }
      const r = A.editOccurrence(st, it2, ch, v.scope || 'one');
      if (r && r.report && r.report.removed) toast(`${U.plural(r.report.removed, 'ocorrência futura editada antes foi substituída', 'ocorrências futuras editadas antes foram substituídas')}.`);
    }, 'Alteração salva.'),
  });
};

/* ---------- Recorrências ---------- */
ACT.editSeries = (d) => {
  const s = S.series.find((x) => x.id === d.id);
  if (!s) return;
  closeAllModals();
  const L = A.links(S, 'series', s.id);
  openForm({
    title: 'Recorrência: ' + s.description,
    intro: `<p class="muted">Alterações aqui valem para as ocorrências ainda não registradas. Para mudar só a partir de uma data, abra a ocorrência e escolha "Esta e as próximas". ${L.length ? `Já há ${L.map((x) => U.plural(x.count, x.label.slice(0, -1), x.label)).join(', ')}; elas não mudam.` : ''}</p>`,
    fields: [
      { k: 'description', label: 'Descrição', type: 'text', req: true },
      { k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true },
      { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], half: true },
      { k: 'categoryId', label: 'Categoria', type: 'select', dynamic: true, options: (v) => catOptions(v.nature, s.type) },
      ...(s.cardId ? [{ k: 'cardId', label: 'Cartão', type: 'select', options: cardOptions(), half: true }] : [{ k: 'accountId', label: 'Conta', type: 'select', options: accOptions(), half: true }]),
      { k: 'frequency', label: 'Frequência', type: 'select', options: FREQS, half: true },
      { k: 'startDate', label: 'Primeira data', type: 'date', req: true, half: true },
      { k: 'endDate', label: 'Termina em', type: 'date', half: true },
      { k: 'count', label: 'Número de ocorrências (vazio = sem limite)', type: 'number', min: 1, step: 1, half: true },
      { k: 'certainty', label: 'Certeza do valor', type: 'chips', options: [['confirmado', 'Valor conhecido'], ['estimado', 'Estimativa']] },
      { k: 'notes', label: 'Observações', type: 'textarea' },
    ],
    values: { ...s },
    extraButtons: [
      { id: 'arch', label: s.archived ? 'Reativar' : 'Encerrar recorrência', onClick: () => commit((st) => { const x = st.series.find((y) => y.id === s.id); if (x.archived) x.archived = false; else { x.endDate = U.addDays(E.today(), -1) < x.startDate ? x.startDate : U.addDays(E.today(), -1); x.archived = true; } }, s.archived ? 'Recorrência reativada.' : 'Recorrência encerrada. O histórico foi mantido.') },
      { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('series', s.id, s.description) },
    ],
    onSubmit: (v) => commit((st) => { const x = st.series.find((y) => y.id === s.id); Object.assign(x, { description: v.description, amount: v.amount, nature: v.nature, categoryId: v.categoryId, accountId: v.accountId ?? x.accountId, cardId: v.cardId ?? x.cardId, frequency: v.frequency, startDate: v.startDate, endDate: v.endDate, count: v.count || null, certainty: v.certainty, notes: v.notes }); }, 'Recorrência atualizada.'),
  });
};

// Exclusão com impacto explicado
function askDelete(type, id, name) {
  const L = A.links(S, type, id);
  const body = L.length
    ? `<p>${h(name)} tem vínculos:</p><ul>${L.map((x) => `<li>${U.plural(x.count, x.label.replace(/s$/, ''), x.label)}</li>`).join('')}</ul><p>Se excluir, esses registros continuam existindo, mas perdem a ligação. ${type === 'series' ? 'As ocorrências futuras ainda não registradas deixam de aparecer.' : ''} <strong>Arquivar</strong> mantém tudo e só esconde dos cadastros ativos.</p>`
    : `<p>${h(name)} será excluído. Não há registros vinculados.</p>`;
  const id2 = U.uid('ar');
  const el = openModal(`<div class="confirm-body">${body}</div><div class="actions wrap"><button class="btn ghost" data-act="closeModal">Voltar</button>${L.length && type !== 'entry' ? `<button class="btn ghost" id="${id2}">Arquivar</button>` : ''}<button class="btn danger" id="${id2}x">Excluir</button></div>`, { title: 'Excluir?' });
  if (L.length && type !== 'entry') el.querySelector('#' + id2).addEventListener('click', () => { closeAllModals(); commit((st) => { const coll = st[{ account: 'accounts', category: 'categories', client: 'clients', service: 'services', card: 'cards', debt: 'debts', series: 'series', reserve: 'reserves' }[type]]; const x = coll.find((y) => y.id === id); x.archived = true; if (type === 'series' && !x.endDate) x.endDate = U.addDays(E.today(), -1) < x.startDate ? x.startDate : U.addDays(E.today(), -1); }, 'Arquivado.'); });
  el.querySelector('#' + id2 + 'x').addEventListener('click', () => { closeAllModals(); commit((st) => A.remove(st, type, id), 'Excluído.'); });
}

/* ---------- Lista de lançamentos por natureza ---------- */
function entriesView(nature) {
  const T = E.today();
  const f = UI.filters[nature] = UI.filters[nature] || { month: U.monthKey(T), status: '', cat: UI.filters.cat || '', q: '', kind: '' };
  if (UI.filters.cat) { f.cat = UI.filters.cat; UI.filters.cat = null; }
  const d = data();
  let items = d.items.filter((it) => it.month === f.month && it.status !== undefined && ((it.nature === nature && ['receita', 'despesa', 'credito'].includes(it.type)) || (it.type === 'transferencia' && it.pnl.some((p) => p.nature === nature)) || (it.type === 'fatura' && it.src === 'entry' && nature === 'pessoal')));
  let cardRows = d.cardRows.filter((r) => r.nature === nature && r.month === f.month);
  if (f.status) { items = items.filter((i) => i.status === f.status); cardRows = cardRows.filter((r) => r.status === f.status); }
  if (f.cat) { items = items.filter((i) => i.categoryId === f.cat); cardRows = cardRows.filter((r) => r.categoryId === f.cat); }
  if (f.kind) { items = items.filter((i) => i.type === f.kind || (f.kind === 'cartao' && false)); if (f.kind !== 'despesa') cardRows = []; }
  if (f.q) { const q = U.norm(f.q); items = items.filter((i) => U.norm(i.desc).includes(q)); cardRows = cardRows.filter((r) => U.norm(r.desc).includes(q)); }
  const months = U.monthRange(U.addMonthKey(U.monthKey(E.orgStart(S)), 0), U.addMonthKey(U.monthKey(T), 12));
  if (!months.includes(f.month)) months.unshift(f.month);
  const series = S.series.filter((s) => s.nature === nature && !s.archived);
  const totIn = U.sum(items, (i) => Math.max(0, i.cash.reduce((a, c) => a + c.delta, 0)));
  const totOut = U.sum(items.filter((i) => i.type !== 'transferencia'), (i) => Math.max(0, -i.cash.reduce((a, c) => a + c.delta, 0))) + U.sum(cardRows, (r) => r.amount);
  return `
  <div class="toolbar">
    <label class="sel"><span class="sr">Mês</span><select data-chg="filt" data-nat="${nature}" data-f="month">${months.map((m) => `<option value="${m}" ${m === f.month ? 'selected' : ''}>${U.fmtMonthFull(m)}</option>`).join('')}</select></label>
    <label class="sel"><span class="sr">Situação</span><select data-chg="filt" data-nat="${nature}" data-f="status"><option value="">Todas as situações</option>${['previsto', 'pago', 'vencido', 'cancelado'].map((s) => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${s === 'pago' ? 'Pago ou recebido' : STATUS_LABEL[s]}</option>`).join('')}</select></label>
    <label class="sel"><span class="sr">Categoria</span><select data-chg="filt" data-nat="${nature}" data-f="cat"><option value="">Todas as categorias</option>${catOptions(nature, null, false).map(([v, l]) => `<option value="${v}" ${f.cat === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></label>
    <label class="sel"><span class="sr">Tipo</span><select data-chg="filt" data-nat="${nature}" data-f="kind"><option value="">Todos os tipos</option><option value="receita" ${f.kind === 'receita' ? 'selected' : ''}>Receitas</option><option value="despesa" ${f.kind === 'despesa' ? 'selected' : ''}>Despesas</option><option value="transferencia" ${f.kind === 'transferencia' ? 'selected' : ''}>Transferências</option></select></label>
    <input class="search" type="search" placeholder="Buscar" value="${h(f.q)}" data-chg="filt" data-nat="${nature}" data-f="q" aria-label="Buscar lançamentos">
  </div>
  <div class="sumline"><span>Entradas no filtro: <strong class="amt-in">${money(totIn)}</strong></span><span>Saídas no filtro: <strong class="amt-out">${money(totOut)}</strong></span></div>
  <div class="actions"><button class="btn primary" data-act="newEntry" data-type="despesa" data-nature="${nature}">${icon('plus')}Despesa</button><button class="btn ghost" data-act="newEntry" data-type="receita" data-nature="${nature}">${icon('plus')}Receita</button></div>
  <div class="card list">${items.length || cardRows.length ? items.map((i) => itemRow(i)).join('') + cardRows.map(cardRowHTML).join('') : emptyState('Nenhum lançamento com esses filtros neste mês.')}</div>
  <h3 class="sec">Recorrências ${nature === 'pessoal' ? 'pessoais' : 'profissionais'}</h3>
  <p class="muted small">Contas fixas e assinaturas que se repetem. As próximas ocorrências são geradas sozinhas e você confirma cada pagamento.</p>
  <div class="card list">${series.length ? series.map((s) => `<button class="row" data-act="editSeries" data-id="${s.id}"><div class="row-main"><span class="row-t">${h(s.description)}</span><span class="row-s">${E.FREQ_LABEL[s.frequency] || 'Mensal'} desde ${U.fmtDate(s.startDate)}${s.endDate ? ` até ${U.fmtDate(s.endDate)}` : ''}${s.count ? ` · ${s.count} ocorrências` : ''} · ${s.cardId ? 'cartão ' + h(cardName(s.cardId)) : h(accName(s.accountId))} · ${h(catName(s.categoryId))}</span><span class="row-tags">${certPill(s.certainty)}${s.type === 'receita' ? '<span class="pill soft">receita</span>' : ''}</span></div><strong class="row-amt ${s.type === 'receita' ? 'amt-in' : 'amt-out'}">${money(s.amount)}</strong></button>`).join('') : emptyState('Nenhuma recorrência cadastrada.')}</div>`;
}
CHG.filt = (val, el) => { const f = UI.filters[el.dataset.nat]; f[el.dataset.f] = val; render(); };
ACT.newEntry = (d) => openEntryForm({ type: d.type || 'despesa', nature: d.nature || undefined, ...(d.recurrence ? { recurrence: d.recurrence } : {}) });

/* ---------- Lançamento rápido ---------- */
ACT.quickAdd = () => {
  const opts = [
    ['newEntry', 'despesa', 'Despesa', 'Conta, compra, gasto', 'down'],
    ['newEntry', 'receita', 'Receita', 'Venda pontual, entrada', 'up'],
    ['newPurchase', '', 'Compra no cartão', 'À vista ou parcelada', 'card'],
    ['newTransfer', '', 'Transferência', 'Entre suas contas ou retirada', 'swap'],
    ['newPix', '', 'Pix no crédito', 'Crédito no cartão', 'card'],
    ['payDebtPick', '', 'Pagamento de dívida', 'Parcela ou quitação', 'debt'],
  ];
  openModal(`<div class="quick">${opts.map(([a, t, l, s, ic]) => `<button class="quick-btn" data-act="qa" data-target="${a}" ${t ? `data-type="${t}"` : ''}>${icon(ic)}<span><strong>${l}</strong><small>${s}</small></span></button>`).join('')}</div>`, { title: 'Lançar' });
};
ACT.qa = (d) => { closeAllModals(); ACT[d.target](d); };
