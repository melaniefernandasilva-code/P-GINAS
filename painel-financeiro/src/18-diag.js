/* Diagnósticos por regras, plano de ação e revisão semanal. */

VIEWS.diagnostico = () => {
  const t = curTab('alertas');
  const body = { alertas: alertsView, analise: analysisView, plano: planView, revisao: reviewView }[t] || alertsView;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Diagnósticos e plano de ação</h1></div></header>
  ${tabs([['alertas', 'Alertas'], ['analise', 'Análise'], ['plano', 'Plano de ação'], ['revisao', 'Revisão semanal']], t)}${body()}`;
};

function alertsView() {
  const nat = UI.filters.alNat || '';
  const all = safeAlerts();
  const list = all.filter((a) => !nat || a.nature === nat);
  const n = (p) => list.filter((a) => a.prio === p).length;
  return `<div class="toolbar"><label class="sel"><span class="sr">Natureza</span><select data-chg="setFilter" data-key="alNat"><option value="">Todas</option><option value="pessoal" ${nat === 'pessoal' ? 'selected' : ''}>Pessoal</option><option value="profissional" ${nat === 'profissional' ? 'selected' : ''}>Profissional</option><option value="geral" ${nat === 'geral' ? 'selected' : ''}>Geral</option></select></label><span class="muted small">${n(1)} de prioridade alta, ${n(2)} média, ${n(3)} para acompanhar</span><button class="btn ghost sm" data-act="go" data-route="config" data-tab="alertas">Ajustar limites e antecedência</button></div>
  <p class="muted small">Alertas calculados por regras a partir dos seus registros, sempre que algo muda. Cada um mostra período, valores e o motivo. Não há inteligência artificial conectada: os textos são montados por regras fixas.</p>
  ${list.length ? `<ul class="alerts big">${list.map((a) => alertFull(a)).join('')}</ul>` : emptyState('Nenhum alerta com os dados atuais.')}`;
}
function alertFull(a) {
  const k = 'al:' + a.key;
  const open = UI.expanded[k];
  const ic = a.prio === 1 ? 'alert' : a.prio === 2 ? 'warn' : 'info';
  return `<li class="alert p${a.prio}"><span class="a-ic">${icon(ic)}</span><div class="a-body"><button class="a-t link-plain" data-act="toggle" data-k="${h(k)}" aria-expanded="${!!open}">${h(a.title)}</button><span class="a-s">${a.prio === 1 ? 'Prioridade alta' : a.prio === 2 ? 'Prioridade média' : 'Para acompanhar'} · ${natChip(a.nature)} · ${h(a.period)}${a.value != null ? ' · ' + money(Math.abs(a.value)) : ''}</span>
  ${open ? `<div class="a-more"><p><strong>Motivo:</strong> ${h(a.reason)}</p><p><strong>Próxima ação:</strong> ${h(a.action)}</p><div class="actions wrap">${a.link ? `<button class="btn ghost sm" ${linkAttrs(a.link)}>Ver registros</button>` : ''}${a.task ? `<button class="btn ghost sm" data-act="go" data-route="diagnostico" data-tab="plano">Ver no plano de ação</button>` : ''}</div></div>` : ''}</div></li>`;
}

/* ---------- Análise ---------- */
function analysisView() {
  const d = data();
  return `<p class="muted">Análise montada por regras transparentes com os seus registros. Cada número indica de onde vem. Pessoal e profissional ficam separados.</p>
  ${analysisBlock('profissional', d)}${analysisBlock('pessoal', d)}
  <section class="card"><h2>Indicadores</h2><p class="muted small">Não existe uma nota única de saúde financeira aqui: uma nota esconderia lacunas dos dados. Estes indicadores têm critérios explícitos.</p>${indicators(d)}</section>`;
}
function analysisBlock(nature, d) {
  const T = E.today();
  const cm = U.monthKey(T);
  const r = E.results(S, d, nature, [cm]);
  const bal = E.balances(S, d);
  const p90 = E.projection(S, { to: U.addDays(T, 90), nature, data: d });
  const al = safeAlerts().filter((a) => a.nature === nature);
  const habits = habitObservations(nature, d);
  const bullets = [];
  if (nature === 'profissional') {
    bullets.push(`Faturamento previsto em ${U.fmtMonth(cm)}: ${money(r.receita.total)} (${money(r.receita.pago)} já recebido).`);
    bullets.push(`Resultado operacional previsto no mês: ${money(r.resultado)}${r.resultado < 0 ? ', ou seja, despesas maiores que o faturamento' : ''}.`);
    if (r.retirada.total) bullets.push(`Retiradas para o pessoal no mês: ${money(r.retirada.total)}.`);
  } else {
    const com = E.commitment(S, d, [cm]);
    bullets.push(com.renda > 0 ? `Entradas pessoais em ${U.fmtMonth(cm)}: ${money(com.renda)}; saídas: ${money(com.total)} (${U.pct(com.pct.total)} das entradas).` : `Sem entradas pessoais cadastradas em ${U.fmtMonth(cm)}; saídas de ${money(com.total)}.`);
    if (com.cartoes) bullets.push(`Cartões representam ${money(com.cartoes)} das saídas do mês.`);
    if (com.dividas) bullets.push(`Pagamentos de dívidas no mês: ${money(com.dividas)}.`);
  }
  bullets.push(p90.firstNeg ? `Falta de dinheiro prevista em ${U.fmtDate(p90.firstNeg)} (menor saldo ${money(p90.minBal)}).` : `Sem falta prevista nos próximos 90 dias com o que está cadastrado (menor saldo ${money(p90.minBal)}).`);
  const highs = al.filter((a) => a.prio === 1).length;
  if (highs) bullets.push(`${U.plural(highs, 'alerta de prioridade alta', 'alertas de prioridade alta')}.`);
  const k = 'an:' + nature;
  const open = UI.expanded[k];
  const commits = d.items.filter((i) => (i.status === 'previsto' || i.status === 'vencido') && i.date <= U.addDays(T, 30) && i.cash.some((c) => c.delta < 0) && (i.nature === nature || (nature === 'pessoal' && i.src === 'invoice'))).slice(0, 10);
  const actions = al.filter((a) => a.task).slice(0, 6);
  return `<section class="card"><div class="card-h"><h2>${icon(nature === 'pessoal' ? 'user' : 'briefcase')}${NAT[nature]}</h2><button class="link" data-act="toggle" data-k="${k}">${open ? 'Resumo' : 'Análise detalhada'}</button></div>
  <ul class="bullets">${bullets.map((b) => `<li>${h(b)}</li>`).join('')}</ul>
  ${open ? `
    <h3 class="sec">Situação atual</h3><dl class="dl compact"><dt>Dinheiro atribuído hoje</dt><dd>${money(bal.byNature[nature])}</dd><dt>${nature === 'pessoal' ? 'Despesas do mês' : 'Despesas operacionais do mês'}</dt><dd>${money(r.despesa.total)} (pagas ${money(r.despesa.pago)})</dd><dt>Em atraso</dt><dd>${money(r.despesa.vencido + r.divida.vencido)} em saídas${nature === 'profissional' ? `, ${money(r.receita.vencido)} em recebimentos` : ''}</dd></dl>
    <h3 class="sec">Compromissos dos próximos 30 dias</h3><div class="list">${commits.length ? commits.map((i) => itemRow(i)).join('') : '<p class="muted small">Nenhum.</p>'}</div>
    <h3 class="sec">Principais riscos</h3>${al.length ? `<ul class="alerts">${al.slice(0, 6).map(alertItem).join('')}</ul>` : '<p class="muted small">Nenhum risco identificado pelas regras.</p>'}
    <h3 class="sec">Comportamento observado</h3><ul class="bullets">${habits.map((x) => `<li>${x}</li>`).join('')}</ul>
    <h3 class="sec">Ações em ordem de prioridade</h3>${actions.length ? `<ol class="bullets">${actions.map((a) => `<li><strong>${h(a.task)}</strong>: ${h(a.action)}</li>`).join('')}</ol>` : '<p class="muted small">Nenhuma ação urgente pelas regras atuais.</p>'}
  ` : ''}</section>`;
}
function habitObservations(nature, d) {
  const T = E.today();
  const out = [];
  const startM = U.monthKey(E.orgStart(S));
  const lastFull = U.addMonthKey(U.monthKey(T), -1);
  const fullMonths = lastFull >= startM ? U.monthsDiff(startM, lastFull) + (E.orgStart(S).slice(8) === '01' ? 1 : 0) : 0;
  if (fullMonths < 2) {
    out.push(`Ainda é cedo para conclusões sobre hábitos: ${fullMonths ? `há ${U.plural(fullMonths, 'mês completo', 'meses completos')}` : 'não há nenhum mês completo'} de registros desde ${U.fmtDate(E.orgStart(S))}. As comparações começam a partir de 2 meses completos.`);
  } else {
    const prevN = Math.min(3, fullMonths - 1);
    const prevMonths = U.monthRange(U.addMonthKey(lastFull, -prevN), U.addMonthKey(lastFull, -1));
    const last = E.results(S, d, nature, [lastFull]);
    const prev = prevMonths.map((m) => E.results(S, d, nature, [m]));
    let any = false;
    for (const c of Object.values(last.byCategory)) {
      const avg = U.sum(prev, (p) => p.byCategory[c.id]?.total || 0) / prevN;
      if (c.total > avg * 1.2 && c.total - avg > 5000) {
        const prevLast = prev[prev.length - 1].byCategory[c.id]?.total || 0;
        const prevBefore = prev.length > 1 ? (prev[prev.length - 2].byCategory[c.id]?.total || 0) : null;
        const trend = prevBefore != null && prevLast > prevBefore && c.total > prevLast;
        out.push(`${h(c.name)}: ${money(c.total)} em ${U.fmtMonth(lastFull)}, contra média de ${money(Math.round(avg))} em ${prevMonths.map(U.fmtMonth).join(', ')}. ${trend ? 'Aumentou em meses seguidos, o que indica tendência.' : 'Pode ser uma mudança pontual; vale observar o próximo mês.'}`);
        any = true;
      }
    }
    if (!any) out.push(`Nenhuma categoria subiu mais de 20% em ${U.fmtMonth(lastFull)} em relação à média dos meses anteriores.`);
  }
  const since = U.addDays(T, -60);
  const latePaid = S.entries.filter((e) => e.nature === nature && e.type === 'despesa' && e.status === 'pago' && e.paidDate && e.dueDate && e.paidDate > e.dueDate && e.paidDate >= since);
  if (latePaid.length) out.push(`${U.plural(latePaid.length, 'conta paga', 'contas pagas')} depois do vencimento nos últimos 60 dias (${latePaid.slice(0, 3).map((e) => h(e.description)).join(', ')}${latePaid.length > 3 ? '...' : ''}).`);
  const pix = S.purchases.filter((p) => p.kind === 'pix_credito' && p.nature === nature && p.status !== 'cancelada' && p.date >= since);
  if (pix.length) out.push(`${U.plural(pix.length, 'operação', 'operações')} de Pix no crédito nos últimos 60 dias, com custo de ${money(U.sum(pix, (p) => (p.total || 0) - (p.net || 0)))}.`);
  if (nature === 'pessoal') {
    const avoid = new Set([...(S.settings.avoidCardIds || []), ...S.cards.filter((c) => c.avoid).map((c) => c.id)]);
    const np = S.purchases.filter((p) => avoid.has(p.cardId) && p.status !== 'cancelada' && p.mode !== 'restante' && p.date >= (S.settings.cardGoalStart || E.orgStart(S)));
    if (avoid.size) out.push(np.length ? `${U.plural(np.length, 'compra nova', 'compras novas')} em cartões marcados para deixar de usar, somando ${money(U.sum(np, (p) => p.total || 0))}.` : 'Nenhuma compra nova nos cartões marcados para deixar de usar.');
  }
  return out;
}
function indicators(d) {
  const T = E.today();
  const p = E.projection(S, { to: U.addMonths(T, 6), data: d });
  const com = E.commitment(S, d, [U.monthKey(T)]);
  const res = S.reserves.filter((r) => !r.archived && r.kind === 'reserva').map((r) => E.reserveInfo(S, d, r));
  const debts = S.debts.filter((x) => x.status === 'ativa').map((x) => E.debtInfo(S, d, x));
  const rows = [
    ['Dias até a primeira falta de dinheiro', p.firstNeg ? U.plural(U.diffDays(T, p.firstNeg), 'dia') : 'nenhuma em 6 meses', 'Projeção de todas as contas com o que está cadastrado.' + (p.partial.length ? ' Projeção parcial.' : '')],
    ['Entradas pessoais comprometidas no mês', com.renda > 0 ? U.pct(com.pct.total) : 'sem entradas cadastradas', `Saídas pessoais do mês (${money(com.total)}) divididas pelas entradas pessoais (${money(com.renda)}).`],
    ...res.map((x) => [`Cobertura da ${x.r.name}`, x.covered != null ? `${x.covered.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de ${x.months} meses` : 'sem base definida', `Saldo da reserva dividido pelo custo mensal (${h(x.base.explain)}).`]),
    ['Dívidas com dados incompletos', `${debts.filter((x) => x.missing.length).length} de ${debts.length}`, 'Sem saldo, taxa ou vencimento, as estimativas de juros e prazo ficam limitadas.'],
  ];
  return `<div class="list">${rows.map(([l, v, c]) => `<div class="row static"><div class="row-main"><span class="row-t">${l}</span><span class="row-s">${c}</span></div><strong class="row-amt">${v}</strong></div>`).join('')}</div>`;
}

/* ---------- Plano de ação ---------- */
function currentTasks() {
  const T = E.today();
  const fromAlerts = safeAlerts().filter((a) => a.task).map((a) => ({ key: a.key, title: a.task, reason: a.reason, prio: a.prio, nature: a.nature, link: a.link, auto: true, due: a.kind === 'falta' ? a.key.split(':')[2] : null }));
  const seen = new Set();
  const list = [];
  for (const t of fromAlerts) { const tk = U.norm(t.title); if (seen.has(tk)) continue; seen.add(tk); list.push(t); }
  for (const m of S.manualTasks) list.push({ key: m.id, title: m.title, reason: m.notes || '', prio: m.prio || 2, nature: m.nature || 'geral', manual: true, due: m.due });
  return list.map((t) => {
    const st = S.tasks[t.key] || {};
    let status = st.status || 'pendente';
    if (status === 'adiado' && st.until && st.until <= T) status = 'pendente';
    return { ...t, status, until: st.until, doneAt: st.doneAt, priority: st.priority };
  });
}
function planView() {
  const tasks = currentTasks();
  const pend = tasks.filter((t) => t.status === 'pendente').sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0) || a.prio - b.prio);
  const later = tasks.filter((t) => t.status === 'adiado');
  const done = tasks.filter((t) => t.status === 'feito');
  const row = (t) => `<li class="task p${t.prio} ${t.status}"><div class="task-main"><strong>${h(t.title)}</strong><small>${t.priority ? '<span class="pill soft">escolhida na revisão</span> ' : ''}${natChip(t.nature)} ${t.due ? `prazo ${U.fmtDate(t.due)} · ` : ''}${t.status === 'adiado' ? `adiada até ${U.fmtDate(t.until)} · ` : ''}${t.status === 'feito' ? `concluída em ${U.fmtDate(t.doneAt)} · ` : ''}${t.auto ? 'gerada por alerta' : 'criada por você'}</small>${t.reason ? `<small class="muted">${h(t.reason).slice(0, 220)}${t.reason.length > 220 ? '...' : ''}</small>` : ''}</div><div class="task-act">${t.status !== 'feito' ? `<button class="btn primary sm" data-act="taskDone" data-k="${h(t.key)}">${icon('check')}Concluir</button><button class="btn ghost sm" data-act="taskSnooze" data-k="${h(t.key)}">Adiar</button>` : `<button class="btn ghost sm" data-act="taskReopen" data-k="${h(t.key)}">Reabrir</button>`}${t.link ? `<button class="icon-btn" ${linkAttrs(t.link)} aria-label="Abrir registro">${icon('right')}</button>` : ''}${t.manual ? `<button class="icon-btn" data-act="taskDel" data-k="${h(t.key)}" aria-label="Excluir">${icon('trash')}</button>` : ''}</div></li>`;
  return `<p class="muted">Tarefas curtas criadas a partir dos alertas, sem repetição. Quando o motivo de um alerta deixa de existir, a tarefa sai da lista sozinha.</p>
  <div class="actions"><button class="btn ghost" data-act="taskNew">${icon('plus')}Tarefa própria</button></div>
  <section class="card"><h2>Para fazer (${pend.length})</h2>${pend.length ? `<ul class="tasks">${pend.map(row).join('')}</ul>` : '<p class="muted">Nada pendente.</p>'}</section>
  ${later.length ? `<section class="card"><h2>Adiadas</h2><ul class="tasks">${later.map(row).join('')}</ul></section>` : ''}
  ${done.length ? `<section class="card"><h2>Concluídas</h2><ul class="tasks">${done.slice(0, 20).map(row).join('')}</ul></section>` : ''}`;
}
ACT.taskDone = (d) => commit((st) => { st.tasks[d.k] = { ...(st.tasks[d.k] || {}), status: 'feito', doneAt: E.today() }; }, 'Tarefa concluída.');
ACT.taskReopen = (d) => commit((st) => { st.tasks[d.k] = { ...(st.tasks[d.k] || {}), status: 'pendente' }; }, 'Tarefa reaberta.');
ACT.taskSnooze = (d) => openForm({ title: 'Adiar tarefa', fields: [{ k: 'until', label: 'Lembrar de novo em', type: 'date', req: true }], values: { until: U.addDays(E.today(), 7) }, validate: (v) => (v.until <= E.today() ? { until: 'Escolha uma data futura.' } : null), onSubmit: (v) => commit((st) => { st.tasks[d.k] = { ...(st.tasks[d.k] || {}), status: 'adiado', until: v.until }; }, 'Tarefa adiada.') });
ACT.taskDel = (d) => commit((st) => { st.manualTasks = st.manualTasks.filter((x) => x.id !== d.k); delete st.tasks[d.k]; }, 'Tarefa excluída.');
ACT.taskNew = () => openForm({ title: 'Nova tarefa', fields: [{ k: 'title', label: 'O que fazer', type: 'text', req: true }, { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional'], ['geral', 'Geral']] }, { k: 'due', label: 'Prazo (opcional)', type: 'date', half: true }, { k: 'prio', label: 'Prioridade', type: 'select', options: [[1, 'Alta'], [2, 'Média'], [3, 'Baixa']], half: true }, { k: 'notes', label: 'Motivo ou observação', type: 'textarea' }], values: { nature: 'geral', prio: 2 },
  onSubmit: (v) => commit((st) => { const t = U.norm(v.title); if (st.manualTasks.some((x) => U.norm(x.title) === t)) throw new Error('Já existe uma tarefa com esse texto.'); st.manualTasks.push({ id: U.uid('t_'), ...v, prio: +v.prio, createdAt: E.today() }); }, 'Tarefa criada.') });

/* ---------- Revisão semanal ---------- */
function snapshot(d) {
  const T = E.today();
  const bal = E.balances(S, d);
  const p = E.projection(S, { to: U.addDays(T, 60), data: d });
  const debts = S.debts.filter((x) => x.status === 'ativa').map((x) => E.debtInfo(S, d, x));
  return { date: T, total: bal.total, pessoal: bal.byNature.pessoal, profissional: bal.byNature.profissional, overdue: d.items.filter((i) => i.status === 'vencido').length, firstNeg: p.firstNeg, minBal: p.minBal, debtTotal: U.sum(debts, (x) => x.balance || 0), reserved: U.sum(S.reserves.filter((r) => !r.archived), (r) => E.reserveBalance(S, r)) };
}
function reviewView() {
  const step = UI.revStep || 0;
  const d = data();
  const T = E.today();
  const last = S.reviews[S.reviews.length - 1];
  const steps = ['Atualizar saldos', 'Conferir entradas', 'Confirmar pagamentos', 'Próximos vencimentos', 'Risco de falta', 'Escolher ações'];
  let body = '';
  if (step === 0) {
    const bal = E.balances(S, d);
    body = `<p>Abra o app de cada banco e compare com o saldo calculado. Se estiver diferente, atualize.</p><div class="list">${S.accounts.filter((a) => !a.archived).map((a) => `<div class="row static"><div class="row-main"><span class="row-t">${h(a.name)}</span><span class="row-s">calculado: ${bal.byId[a.id].known ? money(bal.byId[a.id].balance) : 'não informado'}</span></div><button class="btn ghost sm" data-act="adjustBal" data-id="${a.id}">Atualizar</button></div>`).join('') || '<p class="muted">Nenhuma conta cadastrada.</p>'}</div>`;
  } else if (step === 1) {
    const recv = d.items.filter((i) => i.type === 'receita' && (i.status === 'vencido' || (i.status === 'previsto' && i.date <= U.addDays(T, 7))));
    body = `<p>Recebimentos em atraso ou previstos para os próximos 7 dias. Confirme os que já entraram.</p><div class="list">${recv.length ? recv.map((i) => itemRow(i)).join('') : '<p class="muted">Nada a conferir.</p>'}</div>`;
  } else if (step === 2) {
    const pays = d.items.filter((i) => i.type !== 'receita' && i.cash.some((c) => c.delta < 0) && (i.status === 'vencido' || (i.status === 'previsto' && i.date <= T)));
    body = `<p>Saídas que já venceram e ainda não foram confirmadas. Se já pagou, confirme. Se não, elas continuam como atraso.</p><div class="list">${pays.length ? pays.map((i) => itemRow(i, { nature: true })).join('') : '<p class="muted">Tudo confirmado.</p>'}</div>`;
  } else if (step === 3) {
    const next = d.items.filter((i) => i.status === 'previsto' && i.date > T && i.date <= U.addDays(T, 14) && i.cash.some((c) => c.delta < 0));
    body = `<p>Vencimentos dos próximos 14 dias: ${money(U.sum(next, (i) => i.amount))} no total.</p><div class="list">${next.length ? next.map((i) => itemRow(i, { nature: true })).join('') : '<p class="muted">Nada previsto.</p>'}</div>`;
  } else if (step === 4) {
    const p = E.projection(S, { to: U.addDays(T, 60), data: d });
    body = `${partialBanner(p.partial)}<dl class="dl compact"><dt>Saldo hoje</dt><dd>${money(p.start)}</dd><dt>Menor saldo em 60 dias</dt><dd class="${p.minBal < 0 ? 'txt-bad' : ''}">${money(p.minBal)} em ${U.fmtDate(p.minDate)}</dd><dt>Primeiro dia de falta</dt><dd>${p.firstNeg ? `<span class="txt-bad">${U.fmtDate(p.firstNeg)}</span>` : 'nenhum previsto'}</dd></dl>${lineChart(p.days, { height: 150 })}`;
  } else {
    const al = safeAlerts().filter((a) => a.task).slice(0, 8);
    const chosen = UI.revChosen = UI.revChosen || new Set();
    const snap = snapshot(d);
    const diff = last ? `<h3 class="sec">O que mudou desde ${U.fmtDate(last.date)}</h3><dl class="dl compact"><dt>Total nas contas</dt><dd>${money(last.total)} para ${money(snap.total)} (${signed(snap.total - last.total)})</dd><dt>Itens em atraso</dt><dd>${last.overdue} para ${snap.overdue}</dd><dt>Saldo das dívidas</dt><dd>${money(last.debtTotal)} para ${money(snap.debtTotal)} (${signed(snap.debtTotal - last.debtTotal)})</dd><dt>Reservado</dt><dd>${money(last.reserved || 0)} para ${money(snap.reserved)}</dd><dt>Primeira falta prevista</dt><dd>${last.firstNeg ? U.fmtDate(last.firstNeg) : 'nenhuma'} para ${snap.firstNeg ? U.fmtDate(snap.firstNeg) : 'nenhuma'}</dd></dl>` : '<p class="muted small">Esta é a primeira revisão: a próxima vai mostrar o que mudou.</p>';
    body = `<p>Escolha até 3 ações para focar nesta semana. Elas ficam no topo do plano de ação.</p>${al.length ? `<ul class="checklist">${al.map((a) => `<li><label><input type="checkbox" data-chg="revPick" value="${h(a.key)}" ${chosen.has(a.key) ? 'checked' : ''}> <strong>${h(a.task)}</strong> <small class="muted">${h(a.action)}</small></label></li>`).join('')}</ul>` : '<p class="muted">Nenhuma ação sugerida pelos alertas.</p>'}${diff}<div class="field"><label for="rev_notes">Anotações da semana (opcional)</label><textarea id="rev_notes" rows="2"></textarea></div><button class="btn primary" data-act="revFinish">Concluir revisão</button>`;
  }
  return `<p class="muted">Leva poucos minutos. ${last ? `Última revisão: ${U.fmtDate(last.date)}.` : 'Nenhuma revisão feita ainda.'}</p>
  <ol class="rev-steps">${steps.map((s, i) => `<li><button class="${i === step ? 'on' : ''} ${i < step ? 'done' : ''}" data-act="revGo" data-i="${i}"><span class="step-dot">${i < step ? icon('check') : i + 1}</span>${s}</button></li>`).join('')}</ol>
  <section class="card"><h2>${steps[step]}</h2>${body}<div class="actions">${step > 0 ? `<button class="btn ghost" data-act="revGo" data-i="${step - 1}">Voltar</button>` : ''}<span class="spacer"></span>${step < steps.length - 1 ? `<button class="btn primary" data-act="revGo" data-i="${step + 1}">Próximo</button>` : ''}</div></section>
  ${S.reviews.length ? `<section class="card"><h2>Revisões anteriores</h2><div class="list">${S.reviews.slice().reverse().slice(0, 8).map((r) => `<div class="row static"><div class="row-main"><span class="row-t">${U.fmtDate(r.date)}</span><span class="row-s">total ${money(r.total)} · ${r.overdue} em atraso · dívidas ${money(r.debtTotal)}${r.notes ? ' · ' + h(r.notes) : ''}</span></div></div>`).join('')}</div></section>` : ''}`;
}
ACT.revGo = (d) => { UI.revStep = +d.i; render(); window.scrollTo(0, 0); };
CHG.revPick = (v, el) => { const s = UI.revChosen; if (el.checked) { if (s.size >= 3) { el.checked = false; toast('Escolha no máximo 3 ações.', 'erro'); return; } s.add(v); } else s.delete(v); };
ACT.revFinish = () => {
  const notes = ($('#rev_notes') || {}).value || '';
  const snap = snapshot(data());
  const chosen = [...(UI.revChosen || [])];
  commit((st) => {
    st.reviews.push({ ...snap, notes, chosen });
    if (st.reviews.length > 104) st.reviews = st.reviews.slice(-104);
    for (const k of Object.keys(st.tasks)) if (st.tasks[k].priority) delete st.tasks[k].priority;
    for (const k of chosen) st.tasks[k] = { ...(st.tasks[k] || {}), status: 'pendente', priority: true };
  }, 'Revisão concluída.');
  UI.revStep = 0; UI.revChosen = null; go('diagnostico', 'plano');
};
