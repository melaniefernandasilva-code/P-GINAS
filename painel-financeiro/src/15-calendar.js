/* Calendário (mensal e diário) e projeções de caixa. */

VIEWS.calendario = () => {
  const t = curTab('mes');
  const body = { mes: calMonthView, dia: calListView, projecao: projectionView }[t] || calMonthView;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Calendário e projeções</h1></div><button class="btn primary hide-m" data-act="quickAdd">${icon('plus')}Lançar</button></header>
  ${tabs([['mes', 'Mês'], ['dia', 'Lista por dia'], ['projecao', 'Projeção de caixa']], t)}${body()}`;
};

function calFilter(items) {
  const nat = UI.filters.calNat || '';
  const kind = UI.filters.calKind || '';
  return items.filter((i) => {
    if (i.status === 'cancelado' || !i.cash.length) return false;
    if (nat && i.nature !== nat && !(i.type === 'transferencia')) return false;
    const net = i.cash.reduce((a, c) => a + c.delta, 0);
    if (kind === 'in' && !(net > 0)) return false;
    if (kind === 'out' && !(net < 0)) return false;
    if (kind === 'late' && i.status !== 'vencido') return false;
    if (kind === 'transf' && i.type !== 'transferencia') return false;
    return true;
  });
}
function calToolbar() {
  const nat = UI.filters.calNat || '', kind = UI.filters.calKind || '';
  return `<label class="sel"><span class="sr">Natureza</span><select data-chg="setFilter" data-key="calNat"><option value="">Pessoal e profissional</option><option value="pessoal" ${nat === 'pessoal' ? 'selected' : ''}>Só pessoal</option><option value="profissional" ${nat === 'profissional' ? 'selected' : ''}>Só profissional</option></select></label>
  <label class="sel"><span class="sr">Tipo</span><select data-chg="setFilter" data-key="calKind"><option value="">Tudo</option><option value="in" ${kind === 'in' ? 'selected' : ''}>Recebimentos</option><option value="out" ${kind === 'out' ? 'selected' : ''}>Vencimentos e parcelas</option><option value="transf" ${kind === 'transf' ? 'selected' : ''}>Transferências</option><option value="late" ${kind === 'late' ? 'selected' : ''}>Em atraso</option></select></label>`;
}

function calMonthView() {
  const T = E.today();
  const m = UI.calMonth || U.monthKey(T);
  const sel = UI.calDay || T;
  const d = data();
  const items = calFilter(d.items.filter((i) => U.monthKey(i.date) === m || (i.status === 'vencido' && m === U.monthKey(T))));
  const byDay = {};
  for (const i of items) { const day = i.status === 'vencido' && m === U.monthKey(T) ? i.date : i.date; (byDay[day] = byDay[day] || []).push(i); }
  const first = m + '-01';
  const startW = U.weekday(first);
  const dim = U.dim(+m.slice(0, 4), +m.slice(5, 7));
  let cells = '';
  for (let i = 0; i < startW; i++) cells += '<div class="cal-c empty" aria-hidden="true"></div>';
  for (let day = 1; day <= dim; day++) {
    const ds = `${m}-${U.pad(day)}`;
    const list = byDay[ds] || [];
    const inn = U.sum(list, (i) => Math.max(0, i.cash.reduce((a, c) => a + c.delta, 0)));
    const out = U.sum(list.filter((i) => i.type !== 'transferencia'), (i) => Math.max(0, -i.cash.reduce((a, c) => a + c.delta, 0)));
    const late = list.some((i) => i.status === 'vencido');
    cells += `<button class="cal-c ${ds === T ? 'today' : ''} ${ds === sel ? 'sel' : ''} ${late ? 'late' : ''}" data-act="calDay" data-d="${ds}" aria-label="${U.fmtDate(ds)}: ${list.length} registros"><span class="cal-n">${day}</span>${inn ? `<span class="cal-in">+${U.moneyShort(inn).replace('R$ ', '')}</span>` : ''}${out ? `<span class="cal-out">−${U.moneyShort(out).replace('R$ ', '')}</span>` : ''}${list.length ? `<span class="cal-dots">${list.slice(0, 4).map((i) => `<i class="d-${i.status}"></i>`).join('')}</span>` : ''}</button>`;
  }
  const dayItems = calFilter(d.items.filter((i) => i.date === sel));
  const overdue = U.monthKey(sel) === U.monthKey(T) ? calFilter(d.items.filter((i) => i.status === 'vencido')) : [];
  return `<div class="toolbar"><div class="month-nav"><button class="icon-btn" data-act="calNav" data-n="-1" aria-label="Mês anterior">${icon('left')}</button><strong>${U.fmtMonthFull(m)}</strong><button class="icon-btn" data-act="calNav" data-n="1" aria-label="Próximo mês">${icon('right')}</button><button class="btn ghost sm" data-act="calToday">Hoje</button></div>${calToolbar()}</div>
  <div class="card cal"><div class="cal-h">${U.WEEK.map((w) => `<span>${w}</span>`).join('')}</div><div class="cal-g">${cells}</div>
  <div class="legend"><span><i class="sw d-previsto"></i>Previsto</span><span><i class="sw d-pago"></i>Pago ou recebido</span><span><i class="sw d-vencido"></i>Em atraso</span></div></div>
  <section class="card"><h2>${U.fmtDate(sel)}</h2><div class="list">${dayItems.length ? dayItems.map((i) => itemRow(i, { showDate: false, nature: true })).join('') : emptyState('Nada neste dia.')}</div></section>
  ${overdue.length ? `<section class="card"><h2>${icon('alert')}Em atraso</h2><div class="list">${overdue.map((i) => itemRow(i, { nature: true })).join('')}</div></section>` : ''}`;
}
ACT.calDay = (d) => { UI.calDay = d.d; render(); };
ACT.calNav = (d) => { UI.calMonth = U.addMonthKey(UI.calMonth || U.monthKey(E.today()), +d.n); render(); };
ACT.calToday = () => { UI.calMonth = U.monthKey(E.today()); UI.calDay = E.today(); render(); };

function calListView() {
  const T = E.today();
  const days = +(UI.filters.listDays || 30);
  const to = U.addDays(T, days);
  const d = data();
  const items = calFilter(d.items.filter((i) => (i.date >= T && i.date <= to && i.status !== 'pago') || i.status === 'vencido' || (i.status === 'pago' && i.date >= U.addDays(T, -7) && i.date <= T)));
  const groups = U.groupBy(items, (i) => (i.status === 'vencido' ? '0000-atraso' : i.date));
  const keys = Object.keys(groups).sort();
  return `<div class="toolbar"><label class="sel"><span class="sr">Período</span><select data-chg="setFilter" data-key="listDays">${[7, 15, 30, 60, 90].map((x) => `<option value="${x}" ${days === x ? 'selected' : ''}>Próximos ${x} dias</option>`).join('')}</select></label>${calToolbar()}</div>
  <p class="muted small">Inclui o que está em atraso e o que foi confirmado nos últimos 7 dias.</p>
  ${keys.length ? keys.map((k) => { const list = groups[k]; const net = U.sum(list.filter((i) => i.type !== 'transferencia'), (i) => i.cash.reduce((a, c) => a + c.delta, 0)); return `<section class="day-g"><h3>${k === '0000-atraso' ? `${icon('alert')} Em atraso` : `${U.WEEK[U.weekday(k)]}, ${U.fmtDate(k)}${k === T ? ' · hoje' : ''}`}<span class="${net < 0 ? 'amt-out' : 'amt-in'}">${signed(net)}</span></h3><div class="card list">${list.map((i) => itemRow(i, { showDate: k === '0000-atraso', nature: true })).join('')}</div></section>`; }).join('') : emptyState('Nada previsto no período.')}`;
}

/* ---------- Projeção ---------- */
function projectionView() {
  const T = E.today();
  const pm = UI.projMonths;
  const to = pm === 'custom' ? (UI.projCustom || U.addMonths(T, 6)) : U.addMonths(T, +pm);
  const view = UI.projView;
  const opts = { to };
  if (view === 'pessoal' || view === 'profissional') opts.nature = view;
  if (view === 'conta' && UI.projAccount) opts.accountIds = [UI.projAccount];
  const p = E.projection(S, opts);
  // cenários separados
  const delay = +(UI.filters.scDelay || 0);
  const endClient = UI.filters.scEndClient || '';
  const endDate = UI.filters.scEndDate || U.addMonths(T, 1);
  let sc = null;
  if (delay || endClient) {
    const hyps = [];
    if (delay) for (const c of S.clients.filter((x) => !x.archived && x.status === 'ativo')) hyps.push({ type: 'atraso', clientId: c.id, days: delay });
    if (endClient) hyps.push({ type: 'fim_contrato', clientId: endClient, endDate });
    const clone = U.clone(S);
    for (const hh of hyps) SIM.apply(clone, hh);
    sc = E.projection(clone, opts);
  }
  const months = p.months;
  return `<div class="toolbar">
    <label class="sel"><span class="sr">Período</span><select data-chg="projMonths">${[3, 6, 12, 24].map((x) => `<option value="${x}" ${String(pm) === String(x) ? 'selected' : ''}>${x} meses</option>`).join('')}<option value="custom" ${pm === 'custom' ? 'selected' : ''}>Personalizado</option></select></label>
    ${pm === 'custom' ? `<label class="sel">até <input type="date" data-chg="projCustom" value="${h(to)}" min="${T}"></label>` : ''}
    <label class="sel"><span class="sr">Visão</span><select data-chg="projView"><option value="geral" ${view === 'geral' ? 'selected' : ''}>Todas as contas</option><option value="pessoal" ${view === 'pessoal' ? 'selected' : ''}>Pessoal</option><option value="profissional" ${view === 'profissional' ? 'selected' : ''}>Profissional</option><option value="conta" ${view === 'conta' ? 'selected' : ''}>Por conta</option></select></label>
    ${view === 'conta' ? `<label class="sel"><span class="sr">Conta</span><select data-chg="projAccount"><option value="">Escolha a conta</option>${S.accounts.filter((a) => !a.archived).map((a) => `<option value="${a.id}" ${UI.projAccount === a.id ? 'selected' : ''}>${h(a.name)}</option>`).join('')}</select></label>` : ''}
  </div>
  ${partialBanner(p.partial)}
  ${view === 'pessoal' || view === 'profissional' ? `<div class="banner soft">${icon('info')}<span>Visão por natureza: o saldo inicial vem das contas do tipo ${view === 'pessoal' ? 'pessoal' : 'PJ'}, ajustado pelas atribuições que você fez. Como o dinheiro circula entre as contas, é uma aproximação.</span></div>` : ''}
  <section class="kpis">
    ${kpi('Saldo inicial (hoje)', money(p.start))}
    ${kpi('Entradas previstas', `<span class="amt-in">${money(p.totalIn)}</span>`, p.overdueRecv.length ? `${money(U.sum(p.overdueRecv, (x) => x.amount))} em atraso fora da conta` : '')}
    ${kpi('Saídas previstas', `<span class="amt-out">${money(p.totalOut)}</span>`)}
    ${kpi('Saldo final', money(p.end), `em ${U.fmtDate(p.to)}`, p.end < 0 ? 'bad' : '')}
    ${kpi('Menor saldo', money(p.minBal), U.fmtDate(p.minDate), p.minBal < 0 ? 'bad' : '')}
    ${kpi('Primeiro dia de insuficiência', p.firstNeg ? U.fmtDate(p.firstNeg) : 'nenhum', p.firstNeg ? `${U.plural(p.negDays, 'dia', 'dias')} no negativo` : 'no período', p.firstNeg ? 'bad' : 'good')}
  </section>
  <section class="card"><h2>Saldo dia a dia</h2>${lineChart(p.days, { height: 200 })}${sc ? `<h3 class="sec">Cenário: ${[delay ? `recebimentos de clientes com ${delay} dias de atraso` : '', endClient ? `contrato de ${h((S.clients.find((c) => c.id === endClient) || {}).name)} terminando em ${U.fmtDate(endDate)}` : ''].filter(Boolean).join(' e ')}</h3>${lineChart(sc.days, { height: 160 })}<p class="small">Menor saldo no cenário: <strong>${money(sc.minBal)}</strong> em ${U.fmtDate(sc.minDate)} · primeira falta: ${sc.firstNeg ? `<span class="txt-bad">${U.fmtDate(sc.firstNeg)}</span>` : 'nenhuma'} · saldo final ${money(sc.end)} (${signed(sc.end - p.end)} em relação à projeção principal)</p>` : ''}</section>
  <section class="card"><h2>Cenários separados</h2><p class="muted small">Não alteram seus dados nem a projeção principal.</p>
    <div class="grid-f">
      <div class="field half"><label for="sc_d">Atraso nos recebimentos de clientes</label><select id="sc_d" data-chg="setFilter" data-key="scDelay">${[0, 5, 10, 15, 30, 45].map((x) => `<option value="${x}" ${delay === x ? 'selected' : ''}>${x ? x + ' dias' : 'Sem atraso'}</option>`).join('')}</select></div>
      <div class="field half"><label for="sc_c">Término de contrato</label><select id="sc_c" data-chg="setFilter" data-key="scEndClient"><option value="">Nenhum</option>${S.clients.filter((c) => !c.archived && c.status === 'ativo').map((c) => `<option value="${c.id}" ${endClient === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('')}</select></div>
      ${endClient ? `<div class="field half"><label for="sc_e">Último dia do contrato</label><input id="sc_e" type="date" data-chg="setFilter" data-key="scEndDate" value="${h(endDate)}"></div>` : ''}
    </div>
    <label class="check-inline"><input type="checkbox" data-chg="toggleOverdueRecv" ${S.settings.overdueReceivables === 'incluir' ? 'checked' : ''}> Contar recebimentos em atraso como se chegassem hoje (na projeção principal)</label></section>
  <section class="card"><h2>Mês a mês</h2><div class="months">${months.map((mm) => `<div class="mcard ${mm.min < 0 ? 'neg' : ''}"><strong>${U.fmtMonthFull(mm.month)}</strong><dl class="dl compact"><dt>Saldo no início</dt><dd>${money(mm.start)}</dd><dt>Entradas</dt><dd class="amt-in">${money(mm.in)}</dd>${Object.entries(mm.inBy).map(([k, v]) => `<dt class="sub">${CERT_LABEL[k] || k}</dt><dd class="sub">${money(v)}</dd>`).join('')}<dt>Saídas</dt><dd class="amt-out">${money(mm.out)}</dd>${Object.entries(mm.outBy).map(([k, v]) => `<dt class="sub">${{ despesas: 'Despesas', cartoes: 'Faturas de cartão', dividas: 'Dívidas', reservas: 'Aportes planejados', transferencias: 'Transferências' }[k] || k}</dt><dd class="sub">${money(v)}</dd>`).join('')}<dt>Saldo no fim</dt><dd><strong>${money(mm.end)}</strong></dd><dt>Menor saldo</dt><dd class="${mm.min < 0 ? 'txt-bad' : ''}">${money(mm.min)} (${U.fmtDay(mm.minDate)})</dd></dl></div>`).join('')}</div>
  <p class="muted small">Contratado: mensalidades de clientes e parcelas. Confirmado: valores conhecidos. Estimado: contas variáveis. Planejado: aportes em reservas. Hipóteses do simulador nunca entram aqui. Pagamentos já confirmados não são reaplicados.</p></section>`;
}
CHG.projMonths = (v) => { UI.projMonths = v === 'custom' ? 'custom' : +v; render(); };
CHG.projCustom = (v) => { if (U.validISO(v) && v > E.today()) { UI.projCustom = U.diffDays(E.today(), v) > 3660 ? U.addMonths(E.today(), 120) : v; render(); } };
CHG.projView = (v) => { UI.projView = v; render(); };
CHG.projAccount = (v) => { UI.projAccount = v; render(); };
CHG.toggleOverdueRecv = (v, el) => commit((st) => { st.settings.overdueReceivables = el.checked ? 'incluir' : 'excluir'; }, 'Preferência salva.', { noUndo: true });
