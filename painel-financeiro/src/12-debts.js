/* Dívidas: cadastro, pagamentos, plano de quitação e acordos. */
const DEBT_TYPES = [['conta_atrasada', 'Conta atrasada'], ['emprestimo', 'Empréstimo'], ['parcelamento', 'Compra parcelada'], ['cartao_terceiro', 'Parcelas em cartão de outra pessoa'], ['acordo', 'Acordo'], ['outro', 'Outro']];

VIEWS.dividas = () => {
  const t = curTab('lista');
  const body = { lista: debtsList, plano: payoffView, acordo: agreementView }[t] || debtsList;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Dívidas</h1></div><button class="btn primary hide-m" data-act="newDebt">${icon('plus')}Dívida</button></header>
  ${tabs([['lista', 'Dívidas em aberto'], ['plano', 'Plano de quitação'], ['acordo', 'Simular acordo']], t)}${body()}`;
};

function debtsList() {
  const d = data();
  const active = S.debts.filter((x) => x.status === 'ativa').map((x) => E.debtInfo(S, d, x));
  const closed = S.debts.filter((x) => x.status !== 'ativa');
  const total = U.sum(active, (x) => x.balance || 0);
  const unknown = active.filter((x) => x.balance == null).length;
  const monthly = U.sum(active, (x) => x.pay || 0);
  return `<section class="kpis">
    ${kpi('Saldo devedor estimado', money(total), unknown ? `${U.plural(unknown, 'dívida', 'dívidas')} sem saldo informado não ${unknown === 1 ? 'entra' : 'entram'} na soma` : `${U.plural(active.length, 'dívida ativa', 'dívidas ativas')}`)}
    ${kpi('Pagamentos mensais contratados', money(monthly), 'parcelas e mínimos cadastrados')}
    ${kpi('Em atraso', String(active.filter((x) => x.overdue).length), 'dívidas com pagamento vencido', active.some((x) => x.overdue) ? 'bad' : '')}
    ${kpi('Crescendo com juros', String(active.filter((x) => x.growing).length), 'juros estimados maiores que o pagamento', active.some((x) => x.growing) ? 'bad' : '')}
  </section>
  <div class="actions"><button class="btn primary" data-act="newDebt">${icon('plus')}Nova dívida</button><button class="btn ghost" data-act="payDebtPick">Registrar pagamento</button></div>
  <div class="cards-grid">${active.length ? active.map(debtCard).join('') : emptyState('Nenhuma dívida em aberto cadastrada.')}</div>
  ${closed.length ? `<h3 class="sec">Quitadas e substituídas</h3><div class="card list">${closed.map((x) => `<button class="row" data-act="editDebt" data-id="${x.id}"><div class="row-main"><span class="row-t">${h(x.creditor)}</span><span class="row-s">${x.status === 'quitada' ? `Quitada${x.settledDate ? ' em ' + U.fmtDate(x.settledDate) : ''}${x.settledByPurchaseId ? ' com Pix no crédito' : ''}` : `Substituída por acordo${x.replacedDate ? ' em ' + U.fmtDate(x.replacedDate) : ''}`}</span></div></button>`).join('')}</div>` : ''}`;
}
function debtCard(x) {
  const d = x.d;
  const tags = [];
  if (x.overdue) tags.push(`<span class="pill st-vencido">${icon('alert')}Em atraso</span>`);
  if (x.growing) tags.push(`<span class="pill bad">${icon('up')}Crescendo</span>`);
  if (x.linked) tags.push(`<span class="pill soft">${icon('card')}Vinculada a cartão</span>`);
  if (x.missing.length) tags.push(`<span class="pill warn">Faltam dados</span>`);
  else if (x.stale) tags.push(`<span class="pill warn">Atualizar saldo</span>`);
  return `<button class="card debt" data-act="editDebt" data-id="${d.id}" id="rec-${d.id}"><div class="debt-h"><strong>${h(d.creditor)}</strong>${natChip(d.nature || 'pessoal')}</div>
  <span class="debt-type">${(DEBT_TYPES.find((t) => t[0] === d.type) || [0, 'Dívida'])[1]}</span>
  <span class="big-num">${x.balance == null ? '<span class="muted">saldo não informado</span>' : money(x.balance)}</span>
  <small class="muted">${h(x.basis)}</small>
  <dl class="dl compact">${x.pay ? `<dt>${d.installmentAmount ? 'Parcela' : 'Mínimo'}</dt><dd>${money(x.pay)}</dd>` : ''}${x.remainingInst != null ? `<dt>Parcelas restantes</dt><dd>${x.remainingInst}</dd>` : ''}${x.nextDue ? `<dt>Próximo vencimento</dt><dd>${U.fmtDate(x.nextDue)}</dd>` : ''}<dt>Juros</dt><dd>${x.monthlyRate != null ? `${U.pct(x.monthlyRate, 2)} ao mês${x.monthlyInterest ? `, cerca de ${money(x.monthlyInterest)}` : ''}` : 'não informados'}</dd></dl>
  <span class="row-tags">${tags.join('')}</span></button>`;
}

ACT.newDebt = () => debtForm();
ACT.editDebt = (dd) => debtForm(S.debts.find((x) => x.id === dd.id));
function debtForm(debt) {
  const isNew = !debt;
  const T = E.today();
  const purchases = S.purchases.filter((p) => p.status !== 'cancelada' && p.kind === 'compra');
  const linkedElsewhere = new Set(S.debts.filter((x) => x !== debt && x.status === 'ativa').flatMap((x) => x.linkedPurchaseIds || []));
  const fields = [
    { k: 'creditor', label: 'Credor ou descrição', type: 'text', req: true, placeholder: 'Ex.: Banco X, conta de luz de agosto' },
    { k: 'type', label: 'Tipo', type: 'select', options: DEBT_TYPES, half: true },
    { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], half: true },
    { k: 'linkMode', label: 'Parcelas já estão em um cartão cadastrado?', type: 'chips', options: [['nao', 'Não'], ['sim', 'Sim, vincular']], help: 'Vinculando, o saldo vem das parcelas da fatura e não é contado duas vezes.' },
    { k: 'linkedPurchaseIds', label: 'Compras no cartão que formam esta dívida', type: 'multi', options: purchases.filter((p) => !linkedElsewhere.has(p.id)).map((p) => [p.id, `${p.description} · ${cardName(p.cardId)}`]), when: (v) => v.linkMode === 'sim' },
    { k: 'balance', label: 'Saldo atualizado', type: 'money', min: 0, half: true, when: (v) => v.linkMode !== 'sim', help: 'Vazio = não sei ainda.' },
    { k: 'balanceDate', label: 'Data desse saldo', type: 'date', half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'rate', label: 'Juros (%)', type: 'number', min: 0, max: 100, step: 0.01, half: true, when: (v) => v.linkMode !== 'sim', help: 'Vazio = não sei.' },
    { k: 'ratePeriod', label: 'Período dos juros', type: 'select', options: [['mensal', 'Ao mês'], ['anual', 'Ao ano']], half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'installmentAmount', label: 'Valor da parcela', type: 'money', min: 0, half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'installmentsLeft', label: 'Parcelas restantes', type: 'number', min: 0, step: 1, half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'minPayment', label: 'Pagamento mínimo contratual', type: 'money', min: 0, half: true, when: (v) => v.linkMode !== 'sim' && !v.installmentAmount },
    { k: 'nextDueDate', label: 'Próximo vencimento ainda não pago', type: 'date', half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'overdueSince', label: 'Em atraso desde', type: 'date', half: true, when: (v) => v.linkMode !== 'sim' },
    { k: 'fees', label: 'Taxas e multas conhecidas', type: 'text', when: (v) => v.linkMode !== 'sim', placeholder: 'Ex.: multa 2% + mora 1% ao mês' },
    { k: 'payAccountId', label: 'Conta usada para pagar', type: 'select', options: accOptions(), when: (v) => v.linkMode !== 'sim' },
    { k: 'negotiation', label: 'Condições de negociação', type: 'textarea', placeholder: 'Propostas recebidas, descontos, contatos' },
    { k: 'notes', label: 'Observações', type: 'textarea' },
    ...(isNew ? [
      { k: 'creditIn', label: 'Esse empréstimo acabou de cair em uma das suas contas', type: 'check', when: (v) => v.type === 'emprestimo' },
      { k: 'creditAmount', label: 'Valor que entrou', type: 'money', min: 1, half: true, when: (v) => v.creditIn && v.type === 'emprestimo' },
      { k: 'creditAccount', label: 'Conta', type: 'select', options: accOptions(null, false), half: true, when: (v) => v.creditIn && v.type === 'emprestimo' },
    ] : []),
    { k: 'prev', type: 'info', info: (v) => {
      if (v.linkMode === 'sim') { const ids = new Set(v.linkedPurchaseIds || []); const tot = U.sum(S.purchases.filter((p) => ids.has(p.id)), (p) => U.sum(E.purchaseInstallments(p), (i) => i.amount)); return ids.size ? `<p class="muted small">Total das parcelas vinculadas (incluindo as já pagas na fatura): ${money(tot)}.</p>` : ''; }
      if (v.installmentAmount && v.installmentsLeft) return `<p class="muted small">${v.installmentsLeft} × ${money(v.installmentAmount)} = ${money(v.installmentAmount * v.installmentsLeft)} a pagar${v.balance ? `; saldo informado ${money(v.balance)}` : ''}.</p>`;
      return '';
    } },
  ];
  const values = debt ? { ...debt, linkMode: debt.linkedPurchaseIds && debt.linkedPurchaseIds.length ? 'sim' : 'nao' } : { type: 'emprestimo', nature: 'pessoal', ratePeriod: 'mensal', balanceDate: T, linkMode: 'nao', payAccountId: S.settings.defaultPesAccountId || '', creditAccount: S.settings.defaultPesAccountId || '' };
  let extra = '';
  if (debt) {
    const pays = S.entries.filter((e) => e.debtRef && e.debtRef.id === debt.id).sort((a, b) => ((a.paidDate || a.dueDate) < (b.paidDate || b.dueDate) ? 1 : -1));
    const occ = data().items.filter((i) => i.src === 'debt' && i.id === debt.id).slice(0, 6);
    extra = `<h3 class="sec">Pagamentos</h3><div class="list">${pays.map((e) => itemRow(data().items.find((i) => i.key === 'e:' + e.id) || { key: 'e:' + e.id, desc: e.description, amount: e.amount, status: e.status, date: e.paidDate || e.dueDate, cash: [] })).join('')}${occ.map((i) => itemRow(i)).join('')}</div>${debt.status === 'ativa' && values.linkMode !== 'sim' ? `<button class="btn ghost" data-act="payDebt" data-id="${debt.id}">${icon('check')}Registrar pagamento</button>` : ''}`;
    if (debt.replaces && debt.replaces.length) extra += `<p class="muted small">Este acordo substituiu: ${debt.replaces.map((id) => h((S.debts.find((x) => x.id === id) || {}).creditor || '?')).join(', ')}.</p>`;
  }
  const wrap = openForm({
    title: isNew ? 'Nova dívida' : debt.creditor, fields, values, wide: true,
    extraButtons: debt ? [
      ...(debt.status === 'ativa' ? [{ id: 'quit', label: 'Marcar como quitada', onClick: () => commit((st) => { const x = st.debts.find((y) => y.id === debt.id); x.status = 'quitada'; x.settledDate = E.today(); }, 'Dívida marcada como quitada.') }] : [{ id: 'reopen', label: 'Reabrir', onClick: () => commit((st) => { const x = st.debts.find((y) => y.id === debt.id); x.status = 'ativa'; }, 'Dívida reaberta.') }]),
      { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('debt', debt.id, debt.creditor) },
    ] : [],
    validate: (v) => v.creditIn && (!v.creditAmount || !v.creditAccount) ? { creditAmount: 'Informe o valor e a conta.' } : null,
    onSubmit: (v) => commit((st) => {
      const link = v.linkMode === 'sim';
      const obj = { creditor: v.creditor, type: v.type, nature: v.nature, balance: link ? null : v.balance, balanceDate: link ? null : (v.balanceDate || E.today()), rate: link ? null : v.rate, ratePeriod: v.ratePeriod || 'mensal', installmentAmount: link ? null : v.installmentAmount, installmentsLeft: link ? null : v.installmentsLeft, minPayment: link ? null : v.minPayment, nextDueDate: link ? null : v.nextDueDate, overdueSince: link ? null : v.overdueSince, fees: v.fees, payAccountId: v.payAccountId, negotiation: v.negotiation, notes: v.notes, linkedPurchaseIds: link ? (v.linkedPurchaseIds || []) : [] };
      if (isNew) {
        const nd = { id: U.uid('d_'), status: 'ativa', createdAt: Date.now(), ...obj };
        st.debts.push(nd);
        if (v.creditIn && v.creditAmount) st.entries.push({ id: U.uid('e_'), type: 'credito', description: `Empréstimo recebido: ${v.creditor}`, amount: v.creditAmount, accountId: v.creditAccount, nature: v.nature, dueDate: E.today(), paidDate: E.today(), status: 'pago', debtId: nd.id, createdAt: Date.now(), paidAt: Date.now() });
      } else Object.assign(st.debts.find((y) => y.id === debt.id), obj);
    }, isNew ? 'Dívida cadastrada.' : 'Dívida atualizada.'),
  });
  if (extra) wrap.querySelector('.form-err').insertAdjacentHTML('beforebegin', `<div class="sub">${extra}</div>`);
}

ACT.payDebtPick = () => {
  const act = S.debts.filter((x) => x.status === 'ativa' && !(x.linkedPurchaseIds || []).length);
  if (!act.length) { toast('Nenhuma dívida ativa para pagamento direto. Dívidas vinculadas a cartão são pagas pela fatura.', 'erro'); return; }
  openForm({ title: 'Pagamento de dívida', fields: [{ k: 'id', label: 'Dívida', type: 'select', options: act.map((x) => [x.id, x.creditor]) }], values: { id: act[0].id }, submitLabel: 'Continuar', onSubmit: (v) => { closeModal(); ACT.payDebt({ id: v.id }); } });
};
ACT.payDebt = (dd) => {
  const debt = S.debts.find((x) => x.id === dd.id);
  closeAllModals();
  const next = data().items.find((i) => i.src === 'debt' && i.id === debt.id && i.status !== 'pago');
  openForm({
    title: 'Pagamento: ' + debt.creditor,
    intro: next ? `<p class="muted">Próximo pagamento previsto: ${money(next.amount)} em ${U.fmtDate(next.date)}${next.label ? ` (${h(next.label)})` : ''}.</p>` : '',
    fields: [
      { k: 'mode', label: 'Este pagamento é', type: 'chips', options: next ? [['parcela', 'A parcela prevista'], ['avulso', 'Um valor avulso']] : [['avulso', 'Um valor avulso']] },
      { k: 'amount', label: 'Valor pago', type: 'money', req: true, min: 1, half: true },
      { k: 'paidDate', label: 'Data', type: 'date', req: true, half: true },
      { k: 'accountId', label: 'Saiu da conta', type: 'select', options: accOptions() },
    ],
    values: { mode: next ? 'parcela' : 'avulso', amount: next ? next.amount : null, paidDate: E.today(), accountId: debt.payAccountId || '' },
    onSubmit: (v) => commit((st) => {
      if (v.mode === 'parcela' && next) { const it = A.findItem(st, next.key, horizonTo()); A.confirm(st, it, { paidDate: v.paidDate, amount: v.amount, accountId: v.accountId || null }); }
      else { const n = -2 - st.entries.filter((e) => e.debtRef && e.debtRef.id === debt.id && e.debtRef.n < -1).length; st.entries.push({ id: U.uid('e_'), type: 'despesa', description: `Pagamento ${debt.creditor}`, amount: v.amount, nature: debt.nature || 'pessoal', accountId: v.accountId || null, dueDate: v.paidDate, paidDate: v.paidDate, status: 'pago', debtRef: { id: debt.id, n }, createdAt: Date.now(), paidAt: Date.now() }); }
    }, 'Pagamento registrado.'),
  });
};

/* ---------- Plano de quitação ---------- */
function payoffView() {
  const d = data();
  const cap = E.debtCapacity(S);
  const active = S.debts.filter((x) => x.status === 'ativa').map((x) => E.debtInfo(S, d, x));
  const contractual = U.sum(active, (x) => x.pay || 0);
  const suggested = contractual + cap.extra;
  const budget = S.settings.debtBudget ?? suggested;
  const av = E.payoff(S, d, budget, 'juros');
  const sb = E.payoff(S, d, budget, 'saldo');
  const noData = active.filter((x) => x.balance == null);
  const res = (p, title, desc) => {
    if (p.empty) return `<div class="card"><h3>${title}</h3><p class="muted">Sem dívidas com saldo conhecido para simular.</p></div>`;
    if (p.infeasible) return `<div class="card"><h3>${title}</h3><p class="txt-bad">O valor mensal (${money(budget)}) é menor que os pagamentos contratuais (${money(p.needed)}).</p></div>`;
    return `<div class="card"><h3>${title}</h3><p class="muted small">${desc}</p><dl class="dl compact"><dt>Prazo estimado</dt><dd>${p.done ? U.plural(p.months, 'mês', 'meses') : 'mais de 30 anos'}</dd><dt>Desembolso total</dt><dd>${money(p.totalPaid)}</dd><dt>Juros estimados</dt><dd>${money(p.totalInterest)}</dd></dl><ol class="mini">${p.debts.slice().sort((a, b) => (a.paidMonth || 999) - (b.paidMonth || 999)).map((x) => `<li><strong>${h(x.name)}</strong><small>${x.paidMonth ? `quitada no mês ${x.paidMonth}` : 'não quitada no período'}${x.rKnown ? '' : ' · juros desconhecidos'}</small></li>`).join('')}</ol></div>`;
  };
  return `<section class="card"><h2>Quanto dá para pagar por mês</h2>
    ${cap.deficit ? `<div class="banner warn">${icon('warn')}<div>Nos próximos 90 dias, as saídas pessoais cadastradas (${money(cap.outflow)}) ${cap.net < 0 ? `superam as entradas (${money(cap.inflow)}) em ${money(-cap.net)}` : `deixam o saldo pessoal negativo em algum momento (menor saldo ${money(cap.minBal)} em ${U.fmtDate(cap.minDate)})`}. Não há valor extra seguro para antecipar dívidas agora. Prioridades: completar os dados que faltam, cortar gastos que não são essenciais e avaliar negociação das dívidas mais caras ou em atraso.</div></div>` : ''}
    <dl class="dl compact"><dt>Entradas pessoais previstas em 90 dias</dt><dd>${money(cap.inflow)}</dd><dt>Saídas pessoais previstas em 90 dias</dt><dd>${money(cap.outflow)}</dd><dt>Das quais pagamentos contratuais de dívidas</dt><dd>${money(cap.contractual)}</dd><dt>Sobra média por mês</dt><dd>${money(cap.avg)}</dd><dt>Menor saldo pessoal no período</dt><dd>${money(cap.minBal)}</dd><dt>Valor extra possível por mês</dt><dd><strong>${money(cap.extra)}</strong></dd></dl>
    <p class="muted small">O extra é o menor valor entre a sobra média e o menor saldo do período, para não deixar faltar dinheiro. Inclui só o que está cadastrado. Se você também guarda para reserva ou objetivos, essa sobra precisa ser dividida: a mesma sobra não paga as duas coisas.</p>
    <div class="toolbar"><span>Valor mensal para dívidas: <strong>${money(budget)}</strong>${S.settings.debtBudget == null ? ' (sugerido: contratual + extra)' : ' (definido por você)'}</span><button class="btn ghost" data-act="editDebtBudget" data-sug="${suggested}">Ajustar</button></div></section>
  ${noData.length ? `<div class="banner soft">${icon('info')}<span>Fora da simulação por falta de saldo: ${noData.map((x) => h(x.d.creditor)).join(', ')}.</span></div>` : ''}
  <div class="two">${res(av, 'Priorizar juros maiores', 'O valor extra vai primeiro para a dívida com a maior taxa conhecida.')}${res(sb, 'Priorizar menores saldos', 'O valor extra vai primeiro para a dívida com o menor saldo, liberando parcelas mais cedo.')}</div>
  ${(av.notes || []).length ? `<p class="muted small">${[...new Set([...(av.notes || []), ...(sb.notes || [])])].map(h).join(' ')}</p>` : ''}
  <p class="muted small">Em ambas as estratégias as parcelas e mínimos contratuais continuam sendo pagos. As estimativas consideram juros compostos mensais sobre o saldo informado; não são o cálculo exato do credor. Nenhuma das estratégias é sempre melhor: compare prazo, custo e o alívio de parcelas.</p>`;
}
ACT.editDebtBudget = (d) => openForm({ title: 'Valor mensal para dívidas', fields: [{ k: 'debtBudget', label: 'Valor por mês (vazio = usar sugestão)', type: 'money', min: 0 }, { k: 'i', type: 'info', info: () => `<p class="muted small">Sugestão atual: ${money(+d.sug)}.</p>` }], values: { debtBudget: S.settings.debtBudget }, onSubmit: (v) => commit((st) => { st.settings.debtBudget = v.debtBudget; }, 'Valor salvo.') });

/* ---------- Simular acordo ---------- */
function agreementView() {
  const act = S.debts.filter((x) => x.status === 'ativa');
  if (!act.length) return emptyState('Cadastre as dívidas para simular um acordo.');
  const f = UI.agr = UI.agr || { debtIds: [], entry: 0, n: 12, installment: null, firstDue: U.addMonths(E.today(), 1), creditor: '' };
  let preview = '';
  if (f.debtIds.length && f.installment > 0 && f.n > 0) {
    const pv = A.agreementPreview(S, f);
    const sim = SIM.run(S, [{ type: 'negociacao', ...f }], 12);
    preview = `<div class="card"><h3>Impacto do acordo</h3><dl class="dl compact"><dt>Saldo substituído (estimado)</dt><dd>${money(pv.replacedBalance)}${pv.unknown.length ? ` <span class="txt-warn">(sem saldo: ${pv.unknown.map(h).join(', ')})</span>` : ''}</dd><dt>Total do acordo</dt><dd>${money(pv.total)}</dd><dt>Diferença</dt><dd class="${pv.cost > 0 ? 'txt-warn' : 'txt-good'}">${pv.cost > 0 ? `${money(pv.cost)} a mais` : `${money(-pv.cost)} a menos`}</dd><dt>Pagamento mensal</dt><dd>${money(pv.replacedMonthly)} para ${money(pv.newMonthly)}</dd><dt>Menor saldo em 12 meses</dt><dd>${money(sim.before.minBal)} para ${money(sim.after.minBal)}</dd><dt>Primeira falta prevista</dt><dd>${sim.before.firstNeg ? U.fmtDate(sim.before.firstNeg) : 'nenhuma'} para ${sim.after.firstNeg ? U.fmtDate(sim.after.firstNeg) : 'nenhuma'}</dd></dl>
    <p class="muted small">Ao confirmar, as dívidas escolhidas ficam como "substituídas" e só o acordo segue ativo. Nada é contado duas vezes.</p><button class="btn primary" data-act="confirmAgreement">Confirmar acordo</button></div>`;
  }
  return `<div class="two"><div class="card"><h3>Condições</h3>
    <div class="field"><label>Dívidas incluídas</label><div class="multi">${act.map((x) => `<label class="multiopt"><input type="checkbox" data-chg="agr" data-f="debt" value="${x.id}" ${f.debtIds.includes(x.id) ? 'checked' : ''}> <span>${h(x.creditor)}</span></label>`).join('')}</div></div>
    <div class="grid-f">
      <div class="field"><label for="ag_c">Nome do acordo</label><input id="ag_c" data-chg="agr" data-f="creditor" value="${h(f.creditor)}" placeholder="Ex.: Acordo Banco X"></div>
      <div class="field half"><label for="ag_e">Entrada</label><div class="money-in"><span>R$</span><input id="ag_e" inputmode="decimal" data-chg="agr" data-f="entry" value="${U.moneyInput(f.entry)}"></div></div>
      <div class="field half"><label for="ag_n">Parcelas</label><input id="ag_n" type="number" min="1" max="120" data-chg="agr" data-f="n" value="${f.n}"></div>
      <div class="field half"><label for="ag_i">Valor da parcela</label><div class="money-in"><span>R$</span><input id="ag_i" inputmode="decimal" data-chg="agr" data-f="installment" value="${U.moneyInput(f.installment)}"></div></div>
      <div class="field half"><label for="ag_d">Primeiro vencimento</label><input id="ag_d" type="date" data-chg="agr" data-f="firstDue" value="${f.firstDue}"></div>
    </div><p class="muted small">Taxas do acordo já devem estar incluídas no valor da parcela.</p></div>
    ${preview || '<div class="card"><p class="muted">Escolha as dívidas e informe parcelas e valor para ver o impacto antes de confirmar.</p></div>'}</div>`;
}
CHG.agr = (v, el) => {
  const f = UI.agr;
  if (el.dataset.f === 'debt') { f.debtIds = $$('[data-f="debt"]').filter((x) => x.checked).map((x) => x.value); }
  else if (el.dataset.f === 'entry' || el.dataset.f === 'installment') f[el.dataset.f] = U.toCents(v) || 0;
  else if (el.dataset.f === 'n') f.n = Math.max(1, parseInt(v, 10) || 1);
  else f[el.dataset.f] = v;
  render();
};
ACT.confirmAgreement = () => {
  const f = UI.agr;
  confirmBox({ title: 'Confirmar acordo?', body: `<p>Será criada a dívida "${h(f.creditor || 'Acordo')}" com ${f.entry ? `entrada de ${money(f.entry)} e ` : ''}${f.n} parcelas de ${money(f.installment)}, a partir de ${U.fmtDate(f.firstDue)}.</p><p>As dívidas ${f.debtIds.map((id) => h(S.debts.find((x) => x.id === id).creditor)).join(', ')} ficarão como substituídas.</p>`, confirmLabel: 'Confirmar acordo', onConfirm: () => { commit((st) => A.agreement(st, { ...f, accountId: S.settings.defaultPesAccountId }), 'Acordo registrado.'); UI.agr = null; UI.tab.dividas = 'lista'; render(); } });
};
