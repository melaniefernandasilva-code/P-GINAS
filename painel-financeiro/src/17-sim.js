/* Simulador de decisões. Nada aqui altera os dados reais, até você confirmar "Aplicar". */

VIEWS.simulador = () => {
  const T = E.today();
  const hyps = UI.scenario;
  const months = UI.simMonths || 6;
  let cmp = '';
  if (hyps.length) {
    const r = SIM.run(S, hyps, months);
    const row = (label, a, b, fmt = money, better = 'maior') => {
      const diff = typeof a === 'number' && typeof b === 'number' ? b - a : null;
      const good = diff == null || diff === 0 ? '' : (better === 'maior' ? diff > 0 : diff < 0) ? 'txt-good' : 'txt-bad';
      return `<tr><th scope="row">${label}</th><td>${fmt(a)}</td><td>${fmt(b)}</td><td class="${good}">${diff == null ? '' : diff === 0 ? 'igual' : (fmt === money ? signed(diff) : (diff > 0 ? '+' : '') + diff)}</td></tr>`;
    };
    const d = (x) => (x ? U.fmtDate(x) : 'nenhuma');
    const mo = (x) => (x == null ? 'sem dados' : U.plural(x, 'mês', 'meses'));
    const resRows = r.before.reserves.map((rb, i) => { const ra = r.after.reserves[i] || rb; return `<tr><th scope="row">${h(rb.name)} no fim do período</th><td>${money(rb.endBal)}${rb.progress != null ? ` (${U.pct(rb.progress)})` : ''}</td><td>${money(ra.endBal)}${ra.progress != null ? ` (${U.pct(ra.progress)})` : ''}</td><td>${signed(ra.endBal - rb.endBal)}</td></tr>`; }).join('');
    cmp = `<section class="card"><h2>Comparação em ${U.plural(months, 'mês', 'meses')}</h2>${r.errors.length ? `<p class="txt-bad small">${r.errors.map(h).join(' ')}</p>` : ''}
    <div class="table-wrap"><table class="tbl cmp"><thead><tr><th></th><th>Atual</th><th>Simulado</th><th>Diferença</th></tr></thead><tbody>
    ${row('Saldo final (todas as contas)', r.before.end, r.after.end)}
    ${row('Menor saldo', r.before.minBal, r.after.minBal)}
    <tr><th scope="row">Primeiro dia de falta</th><td>${d(r.before.firstNeg)}</td><td class="${r.after.firstNeg && (!r.before.firstNeg || r.after.firstNeg < r.before.firstNeg) ? 'txt-bad' : ''}">${d(r.after.firstNeg)}</td><td></td></tr>
    ${row('Dias no negativo', r.before.negDays, r.after.negDays, (x) => String(x), 'menor')}
    <tr><th scope="row">Primeira falta no pessoal</th><td>${d(r.before.pesFirstNeg)}</td><td>${d(r.after.pesFirstNeg)}</td><td></td></tr>
    <tr><th scope="row">Primeira falta no profissional</th><td>${d(r.before.proFirstNeg)}</td><td>${d(r.after.proFirstNeg)}</td><td></td></tr>
    ${row('Compromissos nos próximos 90 dias', r.before.commit90, r.after.commit90, money, 'menor')}
    ${row('Saldo das dívidas', r.before.debtTotal, r.after.debtTotal, money, 'menor')}
    <tr><th scope="row">Tempo estimado de quitação</th><td>${r.before.payoffInfeasible ? 'orçamento insuficiente' : mo(r.before.payoffMonths)}</td><td>${r.after.payoffInfeasible ? 'orçamento insuficiente' : mo(r.after.payoffMonths)}</td><td></td></tr>
    ${resRows}
    </tbody></table></div>
    <div class="two"><div><h3 class="sec">Atual</h3>${lineChart(r.before.proj.days, { height: 150 })}</div><div><h3 class="sec">Simulado</h3>${lineChart(r.after.proj.days, { height: 150 })}</div></div>
    <p class="muted small">Tempo de quitação usa o valor mensal para dívidas definido em Dívidas (ou a soma das parcelas) e a estratégia de juros maiores.</p></section>`;
  }
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Simulador de decisões</h1></div></header>
  <p class="muted">Monte um cenário com uma ou mais hipóteses e compare com a situação atual. Seus dados reais não mudam. Hipóteses continuam hipóteses até você escolher aplicar e confirmar.</p>
  <section class="card"><div class="card-h"><h2>Cenário em montagem</h2><label class="sel"><span class="sr">Período</span><select data-chg="simMonths">${[3, 6, 12, 24].map((x) => `<option value="${x}" ${months === x ? 'selected' : ''}>${x} meses</option>`).join('')}</select></label></div>
    ${hyps.length ? `<ol class="hyps">${hyps.map((x, i) => `<li><span class="pill cert-hipotetico">Hipótese</span> <span>${h(SIM.describe(S, x))}</span><button class="icon-btn" data-act="simDel" data-i="${i}" aria-label="Remover">${icon('x')}</button></li>`).join('')}</ol>` : '<p class="muted">Nenhuma hipótese ainda.</p>'}
    <div class="actions wrap"><button class="btn primary" data-act="simAdd">${icon('plus')}Adicionar hipótese</button>${hyps.length ? `<button class="btn ghost" data-act="simSave">Salvar cenário</button><button class="btn ghost" data-act="simApply">Aplicar nos dados reais</button><button class="btn ghost" data-act="simClear">Limpar</button>` : ''}</div></section>
  ${cmp}
  <section class="card"><h2>Cenários salvos</h2>${S.scenarios.length ? `<div class="list">${S.scenarios.map((sc) => `<div class="row static"><div class="row-main"><span class="row-t">${h(sc.name)}</span><span class="row-s">${sc.items.map((x) => h(SIM.TYPES[x.type])).join(', ')} · salvo em ${U.fmtDate(sc.date)}</span></div><div class="row-act"><button class="btn ghost sm" data-act="simLoad" data-id="${sc.id}">Abrir</button><button class="btn ghost sm" data-act="simCombine" data-id="${sc.id}">Combinar</button><button class="icon-btn" data-act="simDelSaved" data-id="${sc.id}" aria-label="Excluir">${icon('trash')}</button></div></div>`).join('')}</div>` : '<p class="muted">Nenhum cenário salvo.</p>'}<p class="muted small">"Combinar" junta as hipóteses de um cenário salvo ao cenário em montagem.</p></section>`;
};
CHG.simMonths = (v) => { UI.simMonths = +v; render(); };
ACT.simDel = (d) => { UI.scenario.splice(+d.i, 1); render(); };
ACT.simClear = () => { UI.scenario = []; render(); };
ACT.simLoad = (d) => { UI.scenario = U.clone(S.scenarios.find((x) => x.id === d.id).items); render(); };
ACT.simCombine = (d) => { UI.scenario = UI.scenario.concat(U.clone(S.scenarios.find((x) => x.id === d.id).items)); render(); };
ACT.simDelSaved = (d) => commit((st) => { st.scenarios = st.scenarios.filter((x) => x.id !== d.id); }, 'Cenário excluído.');
ACT.simSave = () => openForm({ title: 'Salvar cenário', fields: [{ k: 'name', label: 'Nome do cenário', type: 'text', req: true }], values: {}, onSubmit: (v) => commit((st) => { st.scenarios.push({ id: U.uid('sc_'), name: v.name, date: E.today(), items: U.clone(UI.scenario) }); }, 'Cenário salvo.') });

ACT.simAdd = () => {
  openModal(`<div class="quick">${Object.entries(SIM.TYPES).map(([k, l]) => `<button class="quick-btn" data-act="simType" data-t="${k}"><span><strong>${l}</strong></span></button>`).join('')}</div>`, { title: 'Que hipótese simular?' });
};
ACT.simType = (d) => {
  closeAllModals();
  const T = E.today();
  const t = d.t;
  const clients = S.clients.filter((c) => !c.archived && c.status === 'ativo').map((c) => [c.id, c.name]);
  const debts = S.debts.filter((x) => x.status === 'ativa').map((x) => [x.id, x.creditor]);
  const reserves = S.reserves.filter((r) => !r.archived).map((r) => [r.id, r.name]);
  const series = S.series.filter((s) => !s.archived && s.type === 'despesa').map((s) => [s.id, `${s.description} (${money(s.amount)})`]);
  const need = (list, msg) => { if (!list.length) { toast(msg, 'erro'); return false; } return true; };
  const F = {
    novo_cliente: [[{ k: 'name', label: 'Nome', type: 'text', req: true }, { k: 'amount', label: 'Mensalidade', type: 'money', req: true, min: 1, half: true }, { k: 'startDate', label: 'Início', type: 'date', req: true, half: true }, { k: 'dueDay', label: 'Dia do vencimento', type: 'number', min: 1, max: 31, half: true }, { k: 'months', label: 'Duração em meses (vazio = sem término)', type: 'number', min: 1, half: true }], { startDate: U.addMonths(T, 1), dueDay: 10 }],
    venda_pontual: [[{ k: 'description', label: 'Descrição', type: 'text', req: true }, { k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true }, { k: 'date', label: 'Data prevista do recebimento', type: 'date', req: true, half: true }], { date: U.addDays(T, 15) }],
    fim_contrato: [[{ k: 'clientId', label: 'Cliente', type: 'select', options: clients }, { k: 'endDate', label: 'Último dia do contrato', type: 'date', req: true }], { clientId: clients[0]?.[0], endDate: U.addMonths(T, 1) }, () => need(clients, 'Cadastre clientes ativos primeiro.')],
    atraso: [[{ k: 'clientId', label: 'Cliente', type: 'select', options: clients }, { k: 'days', label: 'Dias de atraso', type: 'number', min: 1, max: 120, req: true }], { clientId: clients[0]?.[0], days: 15 }, () => need(clients, 'Cadastre clientes ativos primeiro.')],
    compra: [[{ k: 'description', label: 'Descrição', type: 'text', req: true }, { k: 'amount', label: 'Valor total', type: 'money', req: true, min: 1, half: true }, { k: 'date', label: 'Data', type: 'date', req: true, half: true }, { k: 'pay', label: 'Pagamento', type: 'chips', options: [['conta', 'À vista na conta'], ['cartao', 'No cartão']] }, { k: 'accountId', label: 'Conta', type: 'select', options: accOptions(null, false), when: (v) => v.pay === 'conta' }, { k: 'cardId', label: 'Cartão', type: 'select', options: cardOptions(), when: (v) => v.pay === 'cartao' }, { k: 'n', label: 'Parcelas', type: 'number', min: 1, max: 48, when: (v) => v.pay === 'cartao' }, { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']] }], { date: T, pay: 'conta', n: 1, nature: 'pessoal', accountId: S.accounts[0]?.id, cardId: S.cards[0]?.id }],
    pix: [[{ k: 'cardId', label: 'Cartão', type: 'select', options: cardOptions() }, { k: 'net', label: 'Valor recebido', type: 'money', req: true, min: 1, half: true }, { k: 'total', label: 'Total a pagar', type: 'money', req: true, min: 1, half: true }, { k: 'n', label: 'Parcelas', type: 'number', min: 1, max: 48, half: true }, { k: 'date', label: 'Data', type: 'date', req: true, half: true }, { k: 'accountId', label: 'Conta que recebe', type: 'select', options: accOptions(null, false) }], { date: T, n: 6, cardId: S.cards[0]?.id, accountId: S.settings.defaultPesAccountId || S.accounts[0]?.id }, () => need(cardOptions(), 'Cadastre um cartão primeiro.')],
    negociacao: [[{ k: 'debtIds', label: 'Dívidas', type: 'multi', options: debts, req: true }, { k: 'entry', label: 'Entrada', type: 'money', min: 0, half: true }, { k: 'n', label: 'Parcelas', type: 'number', min: 1, req: true, half: true }, { k: 'installment', label: 'Valor da parcela', type: 'money', min: 1, req: true, half: true }, { k: 'firstDue', label: 'Primeiro vencimento', type: 'date', req: true, half: true }], { n: 12, firstDue: U.addMonths(T, 1) }, () => need(debts, 'Cadastre dívidas primeiro.')],
    corte: [[{ k: 'seriesId', label: 'Gasto recorrente', type: 'select', options: series }, { k: 'newAmount', label: 'Novo valor (0 = cancelar)', type: 'money', min: 0, req: true, half: true }, { k: 'fromDate', label: 'A partir de', type: 'date', req: true, half: true }], { seriesId: series[0]?.[0], fromDate: T, newAmount: 0 }, () => need(series, 'Cadastre gastos recorrentes primeiro.')],
    retirada: [[{ k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true }, { k: 'date', label: 'Data', type: 'date', req: true, half: true }, { k: 'monthly', label: 'Repetir todo mês', type: 'check' }, { k: 'months', label: 'Por quantos meses', type: 'number', min: 1, max: 24, when: (v) => v.monthly }], { date: T, months: 6 }],
    aporte: [[{ k: 'reserveId', label: 'Reserva ou objetivo', type: 'select', options: reserves }, { k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true }, { k: 'monthly', label: 'Aporte mensal (substitui o planejado)', type: 'check' }, { k: 'date', label: 'Data', type: 'date', when: (v) => !v.monthly, half: true }, { k: 'accountId', label: 'Conta de origem', type: 'select', options: accOptions(null, false) }], { reserveId: reserves[0]?.[0], date: T, accountId: S.accounts[0]?.id }, () => need(reserves, 'Crie uma reserva ou objetivo primeiro.')],
    prazo: [[{ k: 'reserveId', label: 'Objetivo', type: 'select', options: reserves }, { k: 'deadline', label: 'Novo prazo', type: 'date', req: true }], { reserveId: reserves[0]?.[0], deadline: U.addMonths(T, 12) }, () => need(reserves, 'Crie um objetivo primeiro.')],
  }[t];
  if (F[2] && !F[2]()) return;
  openForm({ title: SIM.TYPES[t], fields: F[0], values: F[1], submitLabel: 'Adicionar ao cenário', onSubmit: (v) => {
    const hh = { type: t, ...v };
    if (t === 'compra' && v.pay === 'conta') hh.cardId = null;
    UI.scenario.push(hh); closeModal(); render();
  } });
};
ACT.simApply = () => {
  const appl = UI.scenario.filter((x) => x.type !== 'atraso');
  const skip = UI.scenario.filter((x) => x.type === 'atraso');
  confirmBox({
    title: 'Aplicar nos dados reais?',
    body: `<p>Estes registros serão criados ou alterados:</p><ul>${appl.map((x) => `<li>${h(SIM.describe(S, x))}</li>`).join('')}</ul>${skip.length ? `<p class="muted">Não serão aplicados (são só hipóteses de comportamento): ${skip.map((x) => h(SIM.describe(S, x))).join('; ')}.</p>` : ''}<p>Depois de aplicados, viram compromissos reais: aparecem nas projeções como previstos ou contratados. Você pode desfazer logo em seguida.</p>`,
    confirmLabel: 'Aplicar', onConfirm: () => { commit((st) => { for (const x of appl) SIM.apply(st, x, true); }, 'Cenário aplicado.'); UI.scenario = []; render(); },
  });
};
