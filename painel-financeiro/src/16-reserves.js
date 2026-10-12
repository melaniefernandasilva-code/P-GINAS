/* Reservas de emergência, objetivos e simulador de acumulação. */

VIEWS.reservas = () => {
  const t = curTab('pessoal');
  const body = t === 'simulador' ? accumView() : reservesView(t === 'profissional' ? 'profissional' : 'pessoal');
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Reservas e investimentos</h1></div></header>
  ${tabs([['pessoal', 'Pessoal'], ['profissional', 'Profissional'], ['simulador', 'Simulador de acumulação']], t)}${body}`;
};

function reservesView(nature) {
  const d = data();
  const list = S.reserves.filter((r) => r.nature === nature && !r.archived);
  const arch = S.reserves.filter((r) => r.nature === nature && r.archived);
  const bal = E.balances(S, d);
  const reserved = U.sum(list, (r) => E.reserveBalance(S, r));
  const free = bal.byNature[nature];
  const com = nature === 'pessoal' ? E.commitment(S, d, [U.monthKey(E.today()), U.addMonthKey(U.monthKey(E.today()), 1), U.addMonthKey(U.monthKey(E.today()), 2)]) : null;
  const deficit = com && com.sobra < 0;
  const plans = U.sum(list, (r) => r.monthlyPlan || 0);
  return `<section class="kpis">
    ${kpi('Dinheiro livre', money(free), `nas contas, atribuído ao ${nature}`)}
    ${kpi('Reservado', money(reserved), 'separado em reservas e objetivos')}
    ${kpi('Total', money(free + reserved), 'livre + reservado')}
    ${kpi('Aportes mensais planejados', money(plans), S.settings.includePlannedContributions ? 'incluídos na projeção de caixa' : 'fora da projeção (ver Configurações)')}
  </section>
  ${deficit ? `<div class="banner warn">${icon('warn')}<div>Nos próximos 3 meses, as saídas pessoais cadastradas superam as entradas em ${money(-com.sobra)}. Antes de planejar aportes, o painel recomenda cobrir esse déficit. Aportes planejados que gerem falta de dinheiro aparecem nos alertas.</div></div>` : ''}
  <p class="muted small">Aporte em reserva não é despesa nem renda: o dinheiro sai da conta (livre) e passa a ficar reservado. Cada reserva tem saldo próprio, então o mesmo dinheiro nunca é contado em duas metas.</p>
  <div class="actions"><button class="btn primary" data-act="newReserve" data-nature="${nature}" data-kind="reserva">${icon('plus')}Reserva de emergência</button><button class="btn ghost" data-act="newReserve" data-nature="${nature}" data-kind="objetivo">${icon('plus')}Objetivo</button></div>
  <div class="cards-grid">${list.length ? list.map((r) => reserveCard(r, d)).join('') : emptyState(`Nenhuma reserva ${nature} criada ainda.`)}</div>
  ${arch.length ? `<h3 class="sec">Arquivadas</h3><div class="card list">${arch.map((r) => `<button class="row" data-act="editReserve" data-id="${r.id}"><div class="row-main"><span class="row-t">${h(r.name)}</span></div><strong class="row-amt">${money(E.reserveBalance(S, r))}</strong></button>`).join('')}</div>` : ''}`;
}
function reserveCard(r, d) {
  const info = E.reserveInfo(S, d, r);
  const moves = S.entries.filter((e) => e.type === 'reserva' && e.reserveId === r.id && e.status === 'pago').slice(-3).reverse();
  return `<div class="card ccard" id="rec-${r.id}"><div class="debt-h"><strong>${h(r.name)}</strong><span class="pill soft">${r.kind === 'reserva' ? 'reserva de emergência' : 'objetivo'}</span></div>
  <span class="big-num">${money(info.balance)}</span>
  ${info.target != null ? `${progressBar(info.progress, 'Progresso')}<small>${U.pct(info.progress)} de ${money(info.target)} · faltam ${money(info.missing)}</small>` : '<small class="muted">Sem valor-alvo definido.</small>'}
  <dl class="dl compact">
    ${r.kind === 'reserva' ? `<dt>Custo mensal da base</dt><dd>${info.base.value != null ? money(info.base.value) : '<span class="muted">não definido</span>'}</dd><dt>Meses de cobertura desejados</dt><dd>${info.months}</dd><dt>Meses cobertos hoje</dt><dd>${info.covered != null ? info.covered.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 'sem base'}</dd>` : ''}
    ${r.deadline ? `<dt>Prazo</dt><dd>${U.fmtDate(r.deadline)}</dd>` : ''}
    ${info.requiredMonthly ? `<dt>Aporte necessário</dt><dd>${money(info.requiredMonthly)} por mês</dd>` : ''}
    <dt>Aporte planejado</dt><dd>${r.monthlyPlan ? `${money(r.monthlyPlan)} por mês, dia ${r.planDay || 5}, da conta ${h(accName(r.planAccountId))}` : 'nenhum'}</dd>
  </dl>
  ${r.kind === 'reserva' ? `<small class="muted">Base: ${h(info.base.explain)}.</small>` : ''}
  ${moves.length ? `<ul class="mini">${moves.map((e) => `<li><strong>${e.op === 'retirada' ? '−' : '+'}${money(e.amount)}</strong><small>${e.op} em ${U.fmtDate(e.paidDate)}</small></li>`).join('')}</ul>` : ''}
  <div class="actions wrap"><button class="btn primary sm" data-act="reserveMove" data-id="${r.id}" data-op="aporte">Aporte</button><button class="btn ghost sm" data-act="reserveMove" data-id="${r.id}" data-op="retirada">Retirada</button><button class="btn ghost sm" data-act="reserveMove" data-id="${r.id}" data-op="rendimento">Rendimento</button><button class="btn ghost sm" data-act="editReserve" data-id="${r.id}">${icon('edit')}Editar</button></div></div>`;
}

ACT.newReserve = (d) => { closeAllModals(); reserveForm(null, d.nature || 'pessoal', d.kind || 'reserva'); };
ACT.editReserve = (d) => reserveForm(S.reserves.find((r) => r.id === d.id));
function reserveForm(r, nature, kind) {
  const isNew = !r;
  nature = r ? r.nature : nature;
  kind = r ? r.kind : kind;
  const series = S.series.filter((s) => !s.archived && s.type === 'despesa' && s.nature === nature);
  const v = r ? { ...r, baseMode: r.base?.mode || 'itens', seriesIds: r.base?.seriesIds || [], manual: r.base?.manual ?? null, extra: r.base?.extra ?? null, avgMonths: r.base?.avgMonths || 3, categoryIds: r.base?.categoryIds || [] } : { nature, kind, name: kind === 'reserva' ? `Reserva de emergência ${nature}` : '', months: 6, baseMode: 'itens', seriesIds: series.filter((s) => (S.categories.find((c) => c.id === s.categoryId) || {}).essential).map((s) => s.id), initialBalance: 0, initialDate: E.today(), planDay: 5, planAccountId: nature === 'profissional' ? S.settings.defaultProAccountId : S.settings.defaultPesAccountId, avgMonths: 3 };
  const fields = [
    { k: 'name', label: 'Nome', type: 'text', req: true },
    ...(kind === 'reserva' ? [
      { k: 'months', label: 'Meses de cobertura', type: 'chips', options: [[3, '3 meses'], [6, '6 meses'], [9, '9 meses'], [12, '12 meses']], help: 'Outro valor: escolha o mais próximo e ajuste depois em "meses personalizados".' },
      { k: 'monthsCustom', label: 'Meses personalizados (opcional)', type: 'number', min: 1, max: 60, step: 1, half: true },
      { k: 'baseMode', label: 'Como calcular o custo mensal', type: 'chips', options: [['itens', 'Despesas cadastradas'], ['media', 'Média do histórico'], ['manual', 'Valor manual']] },
      { k: 'seriesIds', label: 'Despesas recorrentes que entram na base', type: 'multi', options: series.map((s) => [s.id, `${s.description} (${money(E.seriesMonthly(s))}/mês)`]), when: (x) => x.baseMode === 'itens' },
      { k: 'extra', label: 'Valor adicional por mês (opcional)', type: 'money', min: 0, when: (x) => x.baseMode === 'itens', help: 'Para gastos que ainda não estão cadastrados como recorrentes, como mercado.' },
      { k: 'avgMonths', label: 'Meses de histórico', type: 'number', min: 1, max: 12, step: 1, when: (x) => x.baseMode === 'media' },
      { k: 'categoryIds', label: 'Categorias (vazio = todas)', type: 'multi', options: catOptions(nature, 'despesa', false), when: (x) => x.baseMode === 'media' },
      { k: 'manual', label: 'Custo mensal', type: 'money', min: 0, when: (x) => x.baseMode === 'manual' },
    ] : [
      { k: 'target', label: 'Valor-alvo', type: 'money', min: 1, half: true, req: true },
      { k: 'deadline', label: 'Prazo', type: 'date', half: true },
    ]),
    { k: 'initialBalance', label: 'Saldo que já está guardado', type: 'money', min: 0, half: true, when: () => isNew || !S.entries.some((e) => e.reserveId === r.id), help: 'Dinheiro que já está separado fora das contas cadastradas.' },
    { k: 'initialDate', label: 'Data desse saldo', type: 'date', half: true, when: () => isNew || !S.entries.some((e) => e.reserveId === r.id) },
    { k: 'monthlyPlan', label: 'Aporte mensal planejado', type: 'money', min: 0, half: true },
    { k: 'planDay', label: 'Dia do aporte', type: 'number', min: 1, max: 31, step: 1, half: true, when: (x) => x.monthlyPlan > 0 },
    { k: 'planAccountId', label: 'Conta de onde sai o aporte', type: 'select', options: accOptions(), when: (x) => x.monthlyPlan > 0 },
    { k: 'notes', label: 'Observações (onde o dinheiro está guardado, por exemplo)', type: 'textarea' },
    { k: 'prev', type: 'info', info: (x) => {
      if (kind === 'reserva') {
        const months = x.monthsCustom || +x.months || 6;
        const fake = { ...x, kind, months, base: { mode: x.baseMode, seriesIds: x.seriesIds, manual: x.manual, extra: x.extra, avgMonths: x.avgMonths, categoryIds: x.categoryIds } };
        const info = E.reserveInfo(S, data(), { ...fake, id: r?.id || 'tmp' });
        return info.base.value != null ? `<div class="banner soft">${icon('target')}<div>Custo mensal: <strong>${money(info.base.value)}</strong> (${h(info.base.explain)}). Reserva necessária: <strong>${money(info.target)}</strong> para ${months} meses.${x.monthlyPlan ? ` Com ${money(x.monthlyPlan)} por mês, faltariam cerca de ${Math.ceil(Math.max(0, info.target - (info.balance || 0)) / x.monthlyPlan)} meses.` : ''}</div></div>` : `<p class="txt-warn small">${h(info.base.explain)}.</p>`;
      }
      if (x.target && x.deadline) { const m = Math.max(1, U.monthsDiff(U.monthKey(E.today()), U.monthKey(x.deadline))); return `<p class="small">Para chegar a ${money(x.target)} em ${U.plural(m, 'mês', 'meses')}: cerca de ${money(Math.ceil(Math.max(0, x.target - (r ? E.reserveBalance(S, r) : x.initialBalance || 0)) / m))} por mês.</p>`; }
      return '';
    } },
  ];
  openForm({
    title: isNew ? (kind === 'reserva' ? 'Nova reserva de emergência' : 'Novo objetivo') : r.name, fields, values: v, wide: true,
    validate: (x) => (x.monthlyPlan > 0 && !x.planAccountId ? { planAccountId: 'Escolha a conta do aporte.' } : null),
    extraButtons: r ? [{ id: 'arch', label: r.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const y = st.reserves.find((z) => z.id === r.id); y.archived = !y.archived; }, 'Atualizado.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('reserve', r.id, r.name) }] : [],
    onSubmit: (x) => commit((st) => {
      const obj = { name: x.name, nature, kind, monthlyPlan: x.monthlyPlan, planDay: x.planDay || 5, planAccountId: x.planAccountId, notes: x.notes };
      if (kind === 'reserva') { obj.months = x.monthsCustom || +x.months || 6; obj.base = { mode: x.baseMode, seriesIds: x.seriesIds || [], manual: x.manual, extra: x.extra, avgMonths: x.avgMonths || 3, categoryIds: x.categoryIds || [] }; }
      else { obj.target = x.target; obj.deadline = x.deadline; }
      if (x.initialBalance !== undefined && x.initialBalance !== null) { obj.initialBalance = x.initialBalance; obj.initialDate = x.initialDate; }
      if (isNew) st.reserves.push({ id: U.uid('r_'), archived: false, createdAt: Date.now(), initialBalance: 0, ...obj });
      else Object.assign(st.reserves.find((z) => z.id === r.id), obj);
    }, 'Salvo.'),
  });
}
ACT.reserveMove = (d) => {
  const r = S.reserves.find((x) => x.id === d.id);
  const bal = E.reserveBalance(S, r);
  const labels = { aporte: ['Aporte em ' + r.name, 'Sai da conta'], retirada: ['Retirada de ' + r.name, 'Vai para a conta'], rendimento: ['Rendimento de ' + r.name, ''] };
  openForm({
    title: labels[d.op][0],
    intro: d.op === 'retirada' ? `<p class="muted">Saldo da reserva: ${money(bal)}. A retirada volta para o dinheiro livre.</p>` : d.op === 'rendimento' ? '<p class="muted">Informe o rendimento que apareceu no extrato. Ele aumenta a reserva sem passar pelas contas e não conta como renda do mês.</p>' : `<p class="muted">O dinheiro sai da conta e passa a ficar reservado. Não é despesa.</p>`,
    fields: [{ k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true }, { k: 'date', label: 'Data', type: 'date', req: true, half: true }, ...(d.op !== 'rendimento' ? [{ k: 'accountId', label: labels[d.op][1], type: 'select', options: accOptions(null, false) }] : [])],
    values: { amount: d.op === 'aporte' ? r.monthlyPlan : null, date: E.today(), accountId: r.planAccountId || '' },
    onSubmit: (v) => commit((st) => A.reserveMove(st, { reserveId: r.id, op: d.op, ...v }), 'Movimentação registrada.'),
  });
};

/* ---------- Simulador de acumulação ---------- */
function accumView() {
  const f = UI.acc = UI.acc || { initial: 0, monthly: 50000, months: 24, rate: 10, ratePeriod: 'anual', timing: 'fim', adminYear: 0, taxPct: 0 };
  const r = E.accumulate(f);
  const W = 640, H = 180, pl = 56, pb = 24, pt = 10;
  const max = Math.max(1, ...r.rows.map((x) => x.bal));
  const x = (i) => pl + (i / Math.max(1, r.rows.length - 1)) * (W - pl - 10);
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const lineBal = r.rows.map((row, i) => `${x(i)},${y(row.bal)}`).join(' ');
  const lineCon = r.rows.map((row, i) => `${x(i)},${y(row.contributed)}`).join(' ');
  const step = Math.max(1, Math.round(r.rows.length / 6));
  const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução simulada"><line x1="${pl}" x2="${W - 10}" y1="${y(max)}" y2="${y(max)}" class="grid"/><text x="${pl - 6}" y="${y(max) + 4}" text-anchor="end" class="axis">${U.moneyShort(max)}</text><line x1="${pl}" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" class="grid"/><text x="${pl - 6}" y="${y(0) + 4}" text-anchor="end" class="axis">R$ 0</text><polyline points="${lineCon}" class="line2"/><polyline points="${lineBal}" class="line"/>${r.rows.map((row, i) => i % step === 0 || i === r.rows.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="axis">${row.m}</text>` : '').join('')}</svg><div class="legend"><span><i class="sw sw-in"></i>Saldo estimado</span><span><i class="sw sw-con"></i>Total aportado</span></div>`;
  const inp = (k, label, type = 'money', extra = '') => `<div class="field half"><label for="ac_${k}">${label}</label>${type === 'money' ? `<div class="money-in"><span>R$</span><input id="ac_${k}" inputmode="decimal" data-chg="acc" data-f="${k}" value="${U.moneyInput(f[k])}"></div>` : `<input id="ac_${k}" type="number" step="any" data-chg="acc" data-f="${k}" value="${f[k]}" ${extra}>`}</div>`;
  return `<p class="muted">Simulação para entender o efeito de aportes e rendimento no tempo. Rendimento estimado não é garantido e não entra como receita confirmada. O painel não recomenda produtos.</p>
  <div class="two"><div class="card"><div class="grid-f">
    ${inp('initial', 'Saldo inicial')}${inp('monthly', 'Aporte mensal')}${inp('months', 'Prazo (meses)', 'number', 'min="1" max="600"')}
    ${inp('rate', 'Taxa de rendimento (%)', 'number', 'min="0"')}
    <div class="field half"><label for="ac_rp">Taxa informada ao</label><select id="ac_rp" data-chg="acc" data-f="ratePeriod"><option value="anual" ${f.ratePeriod === 'anual' ? 'selected' : ''}>Ano</option><option value="mensal" ${f.ratePeriod === 'mensal' ? 'selected' : ''}>Mês</option></select></div>
    <div class="field half"><label for="ac_t">Aporte no</label><select id="ac_t" data-chg="acc" data-f="timing"><option value="fim" ${f.timing === 'fim' ? 'selected' : ''}>Fim do mês</option><option value="inicio" ${f.timing === 'inicio' ? 'selected' : ''}>Início do mês</option></select></div>
    ${inp('adminYear', 'Taxa de administração (% ao ano, opcional)', 'number', 'min="0"')}${inp('taxPct', 'Imposto sobre o rendimento (%, opcional)', 'number', 'min="0" max="100"')}
  </div><p class="muted small">Taxa equivalente: ${U.pct(r.monthlyRate, 3)} ao mês${f.ratePeriod === 'anual' ? ` (de ${f.rate}% ao ano, por juros compostos)` : `, ou ${U.pct(Math.pow(1 + r.monthlyRate, 12) - 1, 2)} ao ano`}. Taxas e imposto só entram se você informar.</p></div>
  <div class="card"><section class="kpis k2">${kpi('Total aportado', money(r.contributed))}${kpi('Rendimento estimado', money(r.gain))}${f.taxPct ? kpi('Imposto informado', money(r.tax)) : ''}${kpi('Saldo final estimado', money(r.final), `em ${U.plural(f.months, 'mês', 'meses')}`)}</section>${chart}</div></div>
  <section class="card"><h2>Evolução mês a mês</h2><div class="table-wrap"><table class="tbl"><thead><tr><th>Mês</th><th>Aportado</th><th>Rendimento acumulado</th><th>Saldo</th></tr></thead><tbody>${r.rows.map((row) => `<tr><td>${row.m}</td><td>${money(row.contributed)}</td><td>${money(row.gain)}</td><td>${money(row.bal)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
CHG.acc = (v, el) => { const k = el.dataset.f; const f = UI.acc; if (k === 'initial' || k === 'monthly') f[k] = Math.max(0, U.toCents(v) || 0); else if (k === 'ratePeriod' || k === 'timing') f[k] = v; else f[k] = Math.max(0, Number(v) || 0); if (k === 'months') f.months = Math.min(600, Math.max(1, Math.round(f.months))); render(); };
