/* Financeiro profissional: resumo, clientes, serviços, lançamentos, meta e retirada. */

VIEWS.profissional = () => {
  const t = curTab('resumo');
  const body = { resumo: proSummary, clientes: clientsView, servicos: servicesView, lancamentos: () => entriesView('profissional'), meta: goalView }[t] || proSummary;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Financeiro profissional</h1></div><button class="btn primary hide-m" data-act="newEntry" data-nature="profissional">${icon('plus')}Lançar</button></header>
  ${tabs([['resumo', 'Resumo'], ['clientes', 'Clientes'], ['servicos', 'Serviços'], ['lancamentos', 'Lançamentos'], ['meta', 'Meta e retirada']], t)}${body()}`;
};

function monthPicker(key, months) {
  const cur = UI.filters[key] || U.monthKey(E.today());
  return `<label class="sel"><span class="sr">Mês</span><select data-chg="setFilter" data-key="${key}">${months.map((m) => `<option value="${m}" ${m === cur ? 'selected' : ''}>${U.fmtMonthFull(m)}</option>`).join('')}</select></label>`;
}
CHG.setFilter = (v, el) => { UI.filters[el.dataset.key] = el.type === 'checkbox' ? el.checked : v; render(); };
const monthsAround = () => U.monthRange(U.monthKey(E.orgStart(S)) < U.monthKey(E.today()) ? U.monthKey(E.orgStart(S)) : U.monthKey(E.today()), U.addMonthKey(U.monthKey(E.today()), 12));

function proSummary() {
  const T = E.today();
  const m = UI.filters.proMonth || U.monthKey(T);
  const d = data();
  const r = E.results(S, d, 'profissional', [m]);
  const bal = E.balances(S, d);
  const nextMonths = U.monthRange(U.monthKey(T), U.addMonthKey(U.monthKey(T), 5));
  const bars = nextMonths.map((k) => { const x = E.results(S, d, 'profissional', [k]); return { label: U.fmtMonth(k).slice(0, 3), in: x.receita.total, out: x.despesa.total }; });
  const proj = E.projection(S, { to: U.addDays(T, 90), nature: 'profissional', data: d });
  const cats = Object.values(r.byCategory).sort((a, b) => b.total - a.total).map((c) => ({ label: c.name, value: c.total, limit: c.limit }));
  const late = d.items.filter((i) => i.src === 'client' && i.status === 'vencido' || (i.src === 'entry' && i.type === 'receita' && i.nature === 'profissional' && i.status === 'vencido'));
  const ending = S.clients.filter((c) => !c.archived && c.status === 'ativo' && c.endDate && c.endDate >= T && U.diffDays(T, c.endDate) <= (S.settings.contractAlertDays || 60));
  const byCert = r.byCertainty;
  return `<div class="toolbar">${monthPicker('proMonth', monthsAround())}</div>
  <section class="kpis">
    ${kpi('Faturamento recebido', money(r.receita.pago), `previsto no mês: ${money(r.receita.total)}`)}
    ${kpi('Despesas operacionais', money(r.despesa.total), `pagas ${money(r.despesa.pago)}, a pagar ${money(r.despesa.previsto + r.despesa.vencido)}`)}
    ${kpi('Resultado operacional', money(r.resultado), 'faturamento menos despesas profissionais, sem retiradas nem dívidas pessoais', r.resultado < 0 ? 'bad' : '')}
    ${kpi('Caixa profissional hoje', money(bal.byNature.profissional), 'saldo atribuído ao profissional; não é o mesmo que lucro')}
  </section>
  <div class="two">
    <div class="card"><h2>Origem do faturamento do mês</h2>
      <dl class="dl compact"><dt>Contratado (clientes)</dt><dd>${money(byCert.contratado || 0)}</dd><dt>Pontual confirmado</dt><dd>${money(byCert.confirmado || 0)}</dd><dt>Estimado</dt><dd>${money(byCert.estimado || 0)}</dd><dt>Em atraso</dt><dd class="${r.receita.vencido ? 'txt-bad' : ''}">${money(r.receita.vencido)}</dd></dl>
      <p class="muted small">Hipóteses de venda ficam no simulador e na meta. Elas não entram aqui.</p></div>
    <div class="card"><h2>Retiradas e circulação</h2>
      <dl class="dl compact"><dt>Retiradas para o pessoal</dt><dd>${money(r.retirada.total)}</dd><dt>Das quais implícitas</dt><dd>${money(r.implicitRetirada)}</dd><dt>Dinheiro pessoal usado aqui</dt><dd>${money(r.aporte_recebido.total)}</dd></dl>
      ${explain('proImpl', 'O que é retirada implícita?', '<p>Quando uma conta pessoal é paga com a conta PJ, ou um cliente paga na conta pessoal, o dinheiro saiu do profissional para o pessoal sem uma transferência. O painel registra isso como retirada, sem reduzir o resultado operacional. Para corrigir, edite a conta ou a natureza do lançamento.</p>')}</div>
  </div>
  <section class="card"><h2>Próximos 6 meses</h2><p class="muted small">Faturamento previsto (contratado, pontual e estimado) e despesas profissionais por mês. Meses após o fim de um contrato já mostram a redução.</p>${barsChart(bars)}</section>
  <section class="card"><h2>Caixa profissional nos próximos 90 dias</h2>${partialBanner(proj.partial)}${lineChart(proj.days)}<p class="small">Menor saldo: <strong>${money(proj.minBal)}</strong> em ${U.fmtDate(proj.minDate)}${proj.firstNeg ? ` · <span class="txt-bad">${icon('warn')} falta prevista em ${U.fmtDate(proj.firstNeg)}</span>` : ''}${proj.overdueRecv.length ? ` · ${money(U.sum(proj.overdueRecv, (x) => x.amount))} em atraso fora da projeção` : ''}</p></section>
  <div class="two">
    <section class="card"><h2>Pagamentos atrasados de clientes</h2><div class="list">${late.length ? late.map((i) => itemRow(i)).join('') : emptyState('Nenhum recebimento atrasado.')}</div></section>
    <section class="card"><h2>Contratos terminando</h2><div class="list">${ending.length ? ending.map((c) => `<button class="row" data-act="editClient" data-id="${c.id}"><div class="row-main"><span class="row-t">${h(c.name)}</span><span class="row-s">termina em ${U.fmtDate(c.endDate)} · renovação ${c.renewal === 'confirmada' ? 'confirmada' : 'não confirmada'}</span></div><strong class="row-amt">${money(E.clientAmountAt(c, c.endDate))}</strong></button>`).join('') : emptyState(`Nenhum contrato termina nos próximos ${S.settings.contractAlertDays || 60} dias.`)}</div></section>
  </div>
  <section class="card"><h2>Despesas por categoria em ${U.fmtMonth(m)}</h2>${hbars(cats, r.receita.total || null)}${r.receita.total ? '<p class="muted small">Percentual sobre o faturamento previsto do mês.</p>' : ''}</section>`;
}

/* ---------- Clientes ---------- */
function clientsView() {
  const T = E.today();
  const showArch = UI.filters.clientsArch;
  const list = S.clients.filter((c) => !!c.archived === !!showArch);
  const d = data();
  const monthly = U.sum(S.clients.filter((c) => !c.archived && c.status === 'ativo' && (!c.endDate || c.endDate >= T)), (c) => Math.round(E.clientAmountAt(c, T) * E.monthlyFactor(c.frequency)));
  return `<div class="sumline"><span>Receita contratada ativa: <strong>${money(monthly)}</strong> por mês</span><span>${U.plural(S.clients.filter((c) => !c.archived && c.status === 'ativo').length, 'cliente ativo', 'clientes ativos')}</span></div>
  <div class="actions"><button class="btn primary" data-act="newClient">${icon('plus')}Novo cliente</button><label class="check-inline"><input type="checkbox" data-chg="setFilter" data-key="clientsArch" ${showArch ? 'checked' : ''}> Mostrar arquivados</label></div>
  <div class="card list">${list.length ? list.map((c) => {
    const late = d.items.filter((i) => i.src === 'client' && i.id === c.id && i.status === 'vencido');
    const next = d.items.find((i) => i.src === 'client' && i.id === c.id && i.status === 'previsto');
    const svc = S.services.find((s) => s.id === c.serviceId);
    const ending = c.endDate && c.endDate >= T && U.diffDays(T, c.endDate) <= (S.settings.contractAlertDays || 60);
    const pendingAdj = (c.adjustments || []).filter((a) => !a.confirmed && a.date >= T);
    return `<button class="row" data-act="editClient" data-id="${c.id}" id="rec-${c.id}"><div class="row-main"><span class="row-t">${h(c.name)}</span><span class="row-s">${svc ? h(svc.name) + ' · ' : ''}${E.FREQ_LABEL[c.frequency || 'mensal']}, vence dia ${c.dueDay} · desde ${U.fmtDate(c.startDate)}${c.endDate ? ` até ${U.fmtDate(c.endDate)}` : ', sem término'}${next ? ` · próxima em ${U.fmtDate(next.date)}` : ''}</span><span class="row-tags"><span class="pill cl-${c.status}">${{ ativo: 'Ativo', pausado: 'Pausado', encerrado: 'Encerrado' }[c.status] || c.status}</span>${late.length ? `<span class="pill st-vencido">${icon('alert')}${U.plural(late.length, 'atraso', 'atrasos')}</span>` : ''}${ending ? `<span class="pill warn">${icon('clock')}termina em ${U.diffDays(T, c.endDate)} dias</span>` : ''}${pendingAdj.length ? `<span class="pill soft">reajuste previsto ${U.fmtDate(pendingAdj[0].date)}</span>` : ''}${c.endDate && c.renewal !== 'confirmada' && c.endDate >= T ? '<span class="pill soft">renovação não confirmada</span>' : ''}</span></div><strong class="row-amt">${money(E.clientAmountAt(c, T))}</strong></button>`;
  }).join('') : emptyState(showArch ? 'Nenhum cliente arquivado.' : 'Nenhum cliente cadastrado. Cadastre suas mensalidades para ver o faturamento previsto.')}</div>`;
}
ACT.newClient = () => clientForm();
ACT.editClient = (d) => clientForm(S.clients.find((c) => c.id === d.id));
function clientForm(c) {
  const isNew = !c;
  const T = E.today();
  const v = c ? { ...c } : { status: 'ativo', frequency: 'mensal', startDate: T, dueDay: 10, renewal: 'sem_termino', accountId: S.settings.defaultProAccountId || (S.accounts.find((a) => a.type === 'pj')?.id || ''), categoryId: 'c_pro_mens' };
  const d = data();
  const adj = c ? (c.adjustments || []) : [];
  const recv = c ? d.items.filter((i) => (i.src === 'client' && i.id === c.id) || (i.src === 'entry' && i.ref.clientRef && i.ref.clientRef.id === c.id)).slice(0, 14) : [];
  const fields = [
    { k: 'name', label: 'Nome do cliente', type: 'text', req: true },
    { k: 'serviceId', label: 'Serviço', type: 'select', options: [['', 'Sem serviço vinculado'], ...S.services.filter((s) => !s.archived).map((s) => [s.id, `${s.name} (${money(s.price)})`])], half: true },
    { k: 'amount', label: 'Valor da mensalidade', type: 'money', req: true, min: 1, half: true, help: 'Para reajustes, use a lista abaixo; o histórico fica preservado.' },
    { k: 'startDate', label: 'Início do contrato', type: 'date', req: true, half: true },
    { k: 'endDate', label: 'Término do contrato', type: 'date', half: true, help: 'Vazio = sem data de término.' },
    { k: 'dueDay', label: 'Dia do vencimento', type: 'number', min: 1, max: 31, step: 1, req: true, half: true, help: 'Dia 31 em meses curtos vira o último dia.' },
    { k: 'frequency', label: 'Recorrência', type: 'select', options: [['mensal', 'Mensal'], ['bimestral', 'Bimestral'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual']], half: true },
    { k: 'status', label: 'Status', type: 'chips', options: [['ativo', 'Ativo'], ['pausado', 'Pausado'], ['encerrado', 'Encerrado']] },
    { k: 'renewal', label: 'Renovação', type: 'chips', options: [['sem_termino', 'Sem término'], ['nao_confirmada', 'Não confirmada'], ['confirmada', 'Confirmada']], when: (x) => !!x.endDate, help: 'Renovação confirmada não estende sozinha o contrato: atualize a data de término quando assinar.' },
    { k: 'accountId', label: 'Conta que recebe', type: 'select', options: accOptions(), half: true },
    { k: 'categoryId', label: 'Categoria', type: 'select', options: catOptions('profissional', 'receita'), half: true },
    { k: 'notes', label: 'Observações', type: 'textarea' },
    { k: 'info', type: 'info', info: (x) => x.status === 'encerrado' && !x.endDate ? '<p class="muted small">Sem data de término, o encerramento vale a partir de hoje.</p>' : x.status === 'pausado' ? '<p class="muted small">Pausado: nenhuma mensalidade é gerada até reativar.</p>' : '' },
  ];
  const extra = c ? `<h3 class="sec">Reajustes</h3>${adj.length ? `<ul class="mini">${adj.map((a) => `<li><strong>${money(a.amount)} a partir de ${U.fmtDate(a.date)}</strong><small>${a.confirmed ? 'confirmado, já entra nas projeções' : 'previsto, ainda não entra nas projeções'} · <button class="link" data-act="toggleAdj" data-id="${c.id}" data-adj="${a.id || a.date}">${a.confirmed ? 'marcar como não confirmado' : 'confirmar'}</button> · <button class="link danger-txt" data-act="delAdj" data-id="${c.id}" data-adj="${a.id || a.date}">remover</button></small></li>`).join('')}</ul>` : '<p class="muted small">Nenhum reajuste registrado.</p>'}<button class="btn ghost" data-act="addAdj" data-id="${c.id}">${icon('plus')}Reajuste</button>
    <h3 class="sec">Mensalidades</h3><div class="list">${recv.length ? recv.map((i) => itemRow(i)).join('') : '<p class="muted small">Nenhuma mensalidade no período.</p>'}</div>` : '';
  const wrap = openForm({
    title: isNew ? 'Novo cliente' : c.name, fields, values: v, wide: true,
    validate: (x) => x.endDate && x.endDate < x.startDate ? { endDate: 'O término precisa ser depois do início.' } : null,
    extraButtons: c ? [{ id: 'arch', label: c.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const x = st.clients.find((y) => y.id === c.id); x.archived = !x.archived; }, c.archived ? 'Cliente reativado.' : 'Cliente arquivado. O histórico foi mantido.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('client', c.id, c.name) }] : [],
    onSubmit: (x) => commit((st) => {
      const obj = { name: x.name, serviceId: x.serviceId, amount: x.amount, startDate: x.startDate, endDate: x.endDate, dueDay: x.dueDay, frequency: x.frequency, status: x.status, renewal: x.endDate ? x.renewal || 'nao_confirmada' : 'sem_termino', accountId: x.accountId, categoryId: x.categoryId, notes: x.notes };
      if (x.status === 'encerrado' && !x.endDate) obj.endDate = E.today();
      if (isNew) st.clients.push({ id: U.uid('cl_'), adjustments: [], createdAt: Date.now(), ...obj });
      else Object.assign(st.clients.find((y) => y.id === c.id), obj);
    }, isNew ? 'Cliente cadastrado.' : 'Cliente atualizado.'),
  });
  if (extra) wrap.querySelector('.form-err').insertAdjacentHTML('beforebegin', `<div class="sub">${extra}</div>`);
  const sel = wrap.querySelector('[name=serviceId]');
  if (sel) sel.addEventListener('change', () => { const s = S.services.find((y) => y.id === sel.value); const a = wrap.querySelector('[name=amount]'); if (s && !a.value) a.value = U.moneyInput(s.price); });
}
ACT.addAdj = (d) => {
  const c = S.clients.find((x) => x.id === d.id);
  openForm({ title: 'Reajuste de ' + c.name, fields: [{ k: 'date', label: 'Vale a partir de', type: 'date', req: true, half: true }, { k: 'amount', label: 'Novo valor', type: 'money', req: true, min: 1, half: true }, { k: 'confirmed', label: 'Reajuste já confirmado com o cliente', type: 'check' }], values: { date: E.today(), amount: c.amount, confirmed: false },
    onSubmit: (v) => commit((st) => { const x = st.clients.find((y) => y.id === c.id); x.adjustments = x.adjustments || []; x.adjustments.push({ id: U.uid('a_'), date: v.date, amount: v.amount, confirmed: v.confirmed }); }, 'Reajuste registrado.', { keepModal: false }) });
};
const adjMatch = (a, key) => (a.id || a.date) === key;
ACT.toggleAdj = (d) => commit((st) => { const a = st.clients.find((y) => y.id === d.id).adjustments.find((x) => adjMatch(x, d.adj)); a.confirmed = !a.confirmed; }, 'Reajuste atualizado.');
ACT.delAdj = (d) => commit((st) => { const c = st.clients.find((y) => y.id === d.id); c.adjustments = c.adjustments.filter((x) => !adjMatch(x, d.adj)); }, 'Reajuste removido.');

/* ---------- Serviços ---------- */
function servicesView() {
  const list = S.services.filter((s) => !s.archived);
  const arch = S.services.filter((s) => s.archived);
  return `<p class="muted">Seus serviços e produtos com preço. Os preços são usados na meta de faturamento para calcular combinações de vendas.</p>
  <div class="actions"><button class="btn primary" data-act="newService">${icon('plus')}Serviço ou produto</button></div>
  <div class="card list">${list.length ? list.map((s) => `<button class="row" data-act="editService" data-id="${s.id}"><div class="row-main"><span class="row-t">${h(s.name)}</span><span class="row-s">${s.kind === 'produto' ? 'Produto' : 'Serviço'}${s.recurring ? ' · mensal' : ' · pontual'}${s.notes ? ' · ' + h(s.notes) : ''}</span></div><strong class="row-amt">${money(s.price)}</strong></button>`).join('') : emptyState('Nenhum serviço cadastrado.')}</div>
  ${arch.length ? `<h3 class="sec">Arquivados</h3><div class="card list">${arch.map((s) => `<button class="row" data-act="editService" data-id="${s.id}"><div class="row-main"><span class="row-t">${h(s.name)}</span></div><strong class="row-amt">${money(s.price)}</strong></button>`).join('')}</div>` : ''}`;
}
ACT.newService = () => serviceForm();
ACT.editService = (d) => serviceForm(S.services.find((s) => s.id === d.id));
function serviceForm(s) {
  openForm({
    title: s ? s.name : 'Novo serviço ou produto',
    fields: [{ k: 'name', label: 'Nome', type: 'text', req: true }, { k: 'kind', label: 'Tipo', type: 'chips', options: [['servico', 'Serviço'], ['produto', 'Produto']], half: true }, { k: 'price', label: 'Preço', type: 'money', req: true, min: 1, half: true }, { k: 'recurring', label: 'Cobrado por mês (mensalidade)', type: 'check' }, { k: 'notes', label: 'Observações', type: 'textarea' }],
    values: s ? { ...s } : { kind: 'servico', recurring: true },
    extraButtons: s ? [{ id: 'arch', label: s.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const x = st.services.find((y) => y.id === s.id); x.archived = !x.archived; }, 'Atualizado.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('service', s.id, s.name) }] : [],
    onSubmit: (v) => commit((st) => { if (s) Object.assign(st.services.find((y) => y.id === s.id), v); else st.services.push({ id: U.uid('sv_'), archived: false, ...v }); }, 'Serviço salvo.'),
  });
}

/* ---------- Meta e retirada ---------- */
function goalView() {
  const T = E.today();
  const m = UI.filters.goalMonth || U.monthKey(T);
  const d = data();
  const r = E.results(S, d, 'profissional', [m]);
  const goal = S.settings.proGoal;
  const have = (r.byCertainty.contratado || 0) + (r.byCertainty.confirmado || 0);
  const est = r.byCertainty.estimado || 0;
  const gap = goal ? Math.max(0, goal - have) : null;
  const svcs = S.services.filter((s) => !s.archived && s.price > 0).sort((a, b) => b.price - a.price);
  let combos = '';
  if (goal && gap > 0) {
    if (!svcs.length) combos = '<p class="muted">Cadastre serviços com preço para ver combinações.</p>';
    else {
      const singles = svcs.map((s) => `<li><strong>${Math.ceil(gap / s.price)} × ${h(s.name)}</strong> <small class="muted">(${money(Math.ceil(gap / s.price) * s.price)})</small></li>`);
      const mixes = [];
      if (svcs.length >= 2) {
        const [a, b] = svcs;
        const maxA = Math.ceil(gap / a.price);
        for (let i = 1; i < maxA && mixes.length < 3; i++) { const rest = gap - i * a.price; if (rest <= 0) break; const j = Math.ceil(rest / b.price); mixes.push(`<li><strong>${i} × ${h(a.name)} + ${j} × ${h(b.name)}</strong> <small class="muted">(${money(i * a.price + j * b.price)})</small></li>`); }
      }
      combos = `<ul class="mini">${singles.concat(mixes).join('')}</ul><p class="muted small">Quantidades arredondadas para cima, com seus preços cadastrados. São hipóteses: não entram na previsão real. Para testar o efeito no caixa, use o simulador.</p>`;
    }
  }
  const days = UI.filters.wdDays || S.settings.withdrawDays || 30;
  const w = E.withdrawSuggestion(S, { days });
  const adj = UI.filters.wdAmount != null ? UI.filters.wdAmount : w.suggested;
  const imp = adj > 0 ? E.withdrawImpact(S, adj, T) : null;
  return `<div class="two">
  <section class="card"><h2>${icon('target')}Meta mensal de faturamento</h2>
    <div class="toolbar">${monthPicker('goalMonth', monthsAround())}<button class="btn ghost" data-act="editGoal">${goal ? 'Alterar meta' : 'Definir meta'}</button></div>
    ${goal ? `<dl class="dl compact"><dt>Meta</dt><dd>${money(goal)}</dd><dt>Contratado e pontual confirmado</dt><dd>${money(have)}</dd><dt>Estimado (não garantido)</dt><dd>${money(est)}</dd><dt>Falta faturar</dt><dd><strong class="${gap > 0 ? 'txt-warn' : 'txt-good'}">${gap > 0 ? money(gap) : 'meta atingida'}</strong></dd></dl>${progressBar(have / goal, 'Progresso da meta')}
    ${gap > 0 ? `<h3 class="sec">Combinações possíveis para fechar ${money(gap)}</h3>${combos}` : ''}` : emptyState('Defina uma meta para ver quanto falta e as combinações de vendas.')}
  </section>
  <section class="card"><h2>${icon('swap')}Retirada pessoal sugerida</h2>
    <div class="toolbar"><label class="sel"><span class="sr">Período</span><select data-chg="setFilter" data-key="wdDays">${[30, 60, 90].map((x) => `<option value="${x}" ${+days === x ? 'selected' : ''}>Próximos ${x} dias</option>`).join('')}</select></label><button class="btn ghost" data-act="editBuffer">Colchão de segurança</button></div>
    <div class="big-num ${w.safe ? '' : 'txt-warn'}">${w.safe ? money(w.suggested) : 'Sem margem segura'}</div>
    <p class="small">${w.safe ? `É o maior valor que pode sair hoje sem deixar o caixa profissional abaixo do colchão até ${U.fmtDate(w.to)}, com o que está cadastrado.` : 'Com os dados cadastrados, qualquer retirada agora deixaria o caixa profissional abaixo do colchão de segurança em algum momento do período.'}</p>
    ${explain('wdCalc', 'Ver o cálculo', `<dl class="dl compact"><dt>Caixa profissional hoje</dt><dd>${money(w.cash)}</dd><dt>+ Entradas contratadas e confirmadas até ${U.fmtDate(w.to)}</dt><dd>${money(w.inflow)}</dd><dt>− Saídas profissionais previstas (inclui retiradas já planejadas e aportes)</dt><dd>${money(w.outflow)}</dd><dt>− Colchão de segurança</dt><dd>${money(w.buffer)}</dd><dt>= Sobra no fim do período</dt><dd>${money(w.margin)}</dd><dt>Menor saldo no caminho, menos colchão</dt><dd>${money(w.minMargin)} (${U.fmtDate(w.minDate)})</dd></dl><p class="muted small">A sugestão é o menor dos dois últimos valores. Entradas estimadas (${money(w.estIn)}) não foram consideradas. Colchão: ${S.settings.proBufferMode === 'valor' ? 'valor fixo definido por você' : `${S.settings.proBufferMonths ?? 1} mês(es) de custos fixos profissionais (${money(w.fixed)} por mês)`}.</p>${w.notes.length ? `<p class="txt-warn small">${w.notes.join(' ')}</p>` : ''}`)}
    <div class="field"><label for="wd_amt">Ajustar valor da retirada</label><div class="money-in"><span>R$</span><input id="wd_amt" inputmode="decimal" value="${U.moneyInput(adj)}" data-chg="wdAmount"></div></div>
    ${imp ? `<dl class="dl compact"><dt>Menor saldo profissional em 90 dias</dt><dd>${money(imp.before.minBal)} para <strong class="${imp.after.minBal < 0 ? 'txt-bad' : ''}">${money(imp.after.minBal)}</strong></dd><dt>Primeira falta no profissional</dt><dd>${imp.after.firstNeg ? `<span class="txt-bad">${U.fmtDate(imp.after.firstNeg)}</span>` : 'nenhuma'}</dd><dt>Menor saldo pessoal em 90 dias</dt><dd>${money(imp.beforePes.minBal)} para ${money(imp.afterPes.minBal)}</dd></dl>
    <button class="btn primary" data-act="planWithdraw" data-amount="${adj}">Registrar esta retirada</button>` : '<p class="muted small">Cadastre uma conta PJ e uma pessoal para ver o impacto.</p>'}
  </section></div>`;
}
CHG.wdAmount = (v) => { const c = U.toCents(v); UI.filters.wdAmount = c == null ? 0 : Math.max(0, c); render(); };
ACT.editGoal = () => openForm({ title: 'Meta mensal de faturamento', fields: [{ k: 'proGoal', label: 'Meta por mês', type: 'money', min: 0 }], values: { proGoal: S.settings.proGoal }, onSubmit: (v) => commit((st) => { st.settings.proGoal = v.proGoal; }, 'Meta salva.') });
ACT.editBuffer = () => openForm({
  title: 'Colchão de segurança profissional',
  intro: '<p class="muted">Valor que deve sempre ficar no caixa profissional. A retirada sugerida nunca deixa o saldo abaixo dele.</p>',
  fields: [{ k: 'proBufferMode', label: 'Como calcular', type: 'chips', options: [['meses', 'Meses de custos fixos'], ['valor', 'Valor fixo']] }, { k: 'proBufferMonths', label: 'Meses de custos fixos profissionais', type: 'number', min: 0, max: 24, step: 0.5, when: (v) => v.proBufferMode === 'meses' }, { k: 'proBufferValue', label: 'Valor fixo', type: 'money', min: 0, when: (v) => v.proBufferMode === 'valor' }],
  values: { ...S.settings }, onSubmit: (v) => commit((st) => { Object.assign(st.settings, v); }, 'Colchão atualizado.'),
});
ACT.planWithdraw = (d) => openTransferForm(null, { amount: +d.amount, purpose: 'retirada', fromId: S.accounts.find((a) => a.type === 'pj' && !a.archived)?.id, toId: S.accounts.find((a) => a.type === 'pessoal' && !a.archived)?.id, status: 'previsto', description: 'Retirada pessoal' });
