/* Financeiro pessoal: resumo, comprometimento, lançamentos e limites por categoria. */

VIEWS.pessoal = () => {
  const t = curTab('resumo');
  const body = { resumo: pesSummary, lancamentos: () => entriesView('pessoal'), limites: limitsView }[t] || pesSummary;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Financeiro pessoal</h1></div><button class="btn primary hide-m" data-act="newEntry" data-nature="pessoal">${icon('plus')}Lançar</button></header>
  ${tabs([['resumo', 'Resumo'], ['lancamentos', 'Lançamentos'], ['limites', 'Limites por categoria']], t)}${body()}`;
};

function pesSummary() {
  const T = E.today();
  const m = UI.filters.pesMonth || U.monthKey(T);
  const d = data();
  const r = E.results(S, d, 'pessoal', [m]);
  const com = E.commitment(S, d, [m]);
  const bal = E.balances(S, d);
  const proj = E.projection(S, { to: U.addDays(T, 90), nature: 'pessoal', data: d });
  const cats = Object.values(r.byCategory).sort((a, b) => b.total - a.total).map((c) => ({ label: c.name, value: c.total, limit: c.limit }));
  const nextMonths = U.monthRange(U.monthKey(T), U.addMonthKey(U.monthKey(T), 5));
  const bars = nextMonths.map((k) => { const c = E.commitment(S, d, [k]); return { label: U.fmtMonth(k).slice(0, 3), in: c.renda, out: c.total }; });
  const den = `${money(com.renda)} em entradas pessoais de ${U.fmtMonthFull(m)} (renda própria ${money(r.receita.total)} + retiradas e recursos do profissional ${money(r.recurso.total)})`;
  const line = (label, v, p, note) => `<li><span>${label}</span><strong>${money(v)}</strong><span class="muted">${com.renda > 0 ? U.pct(p) : 'sem base'}</span>${note ? `<small>${note}</small>` : ''}</li>`;
  return `<div class="toolbar">${monthPicker('pesMonth', monthsAround())}</div>
  <section class="kpis">
    ${kpi('Entradas pessoais', money(com.renda), `recebido ${money(r.receita.pago + r.recurso.pago)}`)}
    ${kpi('Saídas do mês', money(com.total), `pagas ${money(r.despesa.pago + r.divida.pago)}`)}
    ${kpi('Sobra ou falta no mês', money(com.sobra), com.renda > 0 ? 'entradas menos saídas, sem duplicar cartões' : 'cadastre retiradas ou receitas pessoais', com.sobra < 0 ? 'bad' : '')}
    ${kpi('Dinheiro pessoal hoje', money(bal.byNature.pessoal), 'saldo atribuído ao pessoal nas contas')}
  </section>
  ${com.creditos ? `<div class="banner warn">${icon('warn')}<div>Entraram <strong>${money(com.creditos)}</strong> como crédito neste mês (empréstimo ou Pix no crédito). Isso aumenta o dinheiro agora, mas não é renda e vira obrigação nas próximas faturas ou parcelas.</div></div>` : ''}
  <section class="card"><h2>Quanto das entradas está comprometido</h2>
    ${com.renda > 0 ? '' : `<div class="banner soft">${icon('info')}<span>Sem entradas pessoais cadastradas em ${U.fmtMonthFull(m)}, os percentuais não podem ser calculados. Isso não significa que os gastos estão sob controle: cadastre as retiradas previstas do profissional.</span></div>`}
    <ul class="commit">${line('Contas essenciais (fora do cartão)', com.essenciais, com.pct.essenciais, 'moradia, casa, mercado, transporte, saúde')}${line('Cartões (compras e parcelas da fatura do mês)', com.cartoes, com.pct.cartoes)}${line('Dívidas (parcelas e acordos)', com.dividas, com.pct.dividas)}${line('Outros gastos', com.outros, com.pct.outros)}<li class="total"><span>Total</span><strong>${money(com.total)}</strong><span>${com.renda > 0 ? U.pct(com.pct.total) : 'sem base'}</span></li></ul>
    <p class="muted small">Base dos percentuais: ${den}. Cada gasto entra uma vez só: compras no cartão contam no grupo Cartões, não na categoria essencial.</p></section>
  <section class="card"><h2>Próximos 6 meses</h2>${barsChart(bars)}</section>
  <section class="card"><h2>Dinheiro pessoal nos próximos 90 dias</h2>${partialBanner(proj.partial)}${lineChart(proj.days)}<p class="small">Menor saldo: <strong>${money(proj.minBal)}</strong> em ${U.fmtDate(proj.minDate)}${proj.firstNeg ? ` · <span class="txt-bad">${icon('warn')} falta prevista em ${U.fmtDate(proj.firstNeg)}</span>` : ''}</p></section>
  <section class="card"><h2>Gastos por categoria em ${U.fmtMonth(m)}</h2>${hbars(cats, com.renda || null)}${com.renda ? '<p class="muted small">Percentual sobre as entradas pessoais do mês.</p>' : ''}</section>`;
}

function limitsView() {
  const T = E.today();
  const d = data();
  const months = [U.monthKey(T), U.addMonthKey(U.monthKey(T), 1), U.addMonthKey(U.monthKey(T), 2)];
  const com = E.commitment(S, d, months);
  const renda = Math.round(com.renda / 3);
  const fixedOut = Math.round((com.essenciais + com.cartoes + com.dividas) / 3);
  const free = renda - fixedOut;
  const cats = S.categories.filter((c) => c.nature === 'pessoal' && c.kind === 'despesa' && !c.archived && !c.system);
  const nonEss = cats.filter((c) => !c.essential);
  const r = E.results(S, d, 'pessoal', months);
  const spentBy = (id) => Math.round((r.byCategory[id]?.total || 0) / 3);
  const totalNE = U.sum(nonEss, (c) => spentBy(c.id));
  let sugg = {};
  if (free > 0 && nonEss.length) {
    for (const c of nonEss) {
      const share = totalNE > 0 ? spentBy(c.id) / totalNE : 1 / nonEss.length;
      sugg[c.id] = Math.floor(free * 0.8 * share / 1000) * 1000;
    }
  }
  return `<section class="card"><h2>Base para sugerir limites</h2>
    <dl class="dl compact"><dt>Entradas pessoais médias por mês</dt><dd>${money(renda)}</dd><dt>Essenciais, cartões e dívidas por mês</dt><dd>${money(fixedOut)}</dd><dt>Sobra para os demais gastos</dt><dd><strong class="${free < 0 ? 'txt-bad' : ''}">${money(free)}</strong></dd></dl>
    <p class="muted small">Média de ${months.map(U.fmtMonth).join(', ')}, com o que está cadastrado (pago e previsto).</p>
    ${free <= 0 ? `<div class="banner warn">${icon('warn')}<div>As obrigações cadastradas já superam as entradas em ${money(-free)} por mês. Antes de pensar em limites, reserva ou investimento, o ponto é cobrir esse déficit: veja o plano de ação e as dívidas.</div></div>` : `<p class="small">Sugestão: até 80% da sobra distribuída entre as categorias não essenciais, na proporção do que você já gasta nelas (ou por igual, se ainda não houver gastos). Os outros 20% ficam livres para imprevistos ou para o plano de dívidas e reservas. Não é uma regra pronta: ajuste como fizer sentido.</p>`}
  </section>
  <section class="card"><h2>Limites mensais</h2><div class="list">${cats.map((c) => `<div class="row static"><div class="row-main"><span class="row-t">${h(c.name)} ${c.essential ? '<span class="pill soft">essencial</span>' : ''}</span><span class="row-s">média atual ${money(spentBy(c.id))}${sugg[c.id] ? ` · sugestão ${money(sugg[c.id])}` : ''}</span></div><div class="row-act"><strong>${c.limit != null ? money(c.limit) : '<span class="muted">sem limite</span>'}</strong><button class="btn ghost sm" data-act="setLimit" data-id="${c.id}" data-sug="${sugg[c.id] || ''}">${c.limit != null ? 'Alterar' : 'Definir'}</button></div></div>`).join('')}</div>
  ${Object.keys(sugg).length ? `<div class="actions"><button class="btn ghost" data-act="applySugg" data-s='${h(JSON.stringify(sugg))}'>Aplicar sugestões nas categorias sem limite</button></div>` : ''}</section>`;
}
ACT.setLimit = (d) => {
  const c = S.categories.find((x) => x.id === d.id);
  openForm({ title: 'Limite: ' + c.name, fields: [{ k: 'limit', label: 'Limite mensal (vazio = sem limite)', type: 'money', min: 0 }, { k: 'info', type: 'info', info: () => d.sug ? `<p class="muted small">Sugestão calculada: ${money(+d.sug)}.</p>` : '' }], values: { limit: c.limit ?? (d.sug ? +d.sug : null) }, onSubmit: (v) => commit((st) => { st.categories.find((x) => x.id === d.id).limit = v.limit; }, 'Limite salvo.') });
};
ACT.applySugg = (d) => { const s = JSON.parse(d.s); commit((st) => { for (const [id, v] of Object.entries(s)) { const c = st.categories.find((x) => x.id === id); if (c && c.limit == null && v > 0) c.limit = v; } }, 'Sugestões aplicadas. Todas podem ser editadas.'); };
