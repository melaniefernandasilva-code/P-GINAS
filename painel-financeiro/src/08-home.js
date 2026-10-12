/* Início, configuração guiada e visão conjunta. */

function setupProgress() {
  const steps = M.SETUP_STEPS.map((s) => ({ ...s, st: S.setup[s.key] }));
  const done = steps.filter((s) => s.st === 'feito').length;
  return { steps, done, total: steps.length };
}

VIEWS.inicio = () => {
  const T = E.today();
  const sp = setupProgress();
  const d = data();
  const hasAny = S.accounts.length || S.clients.length || S.entries.length || S.series.length;
  const greet = `<header class="page-h"><div><p class="eyebrow">${U.fmtDate(T)} · início da organização: ${S.settings.startDate ? U.fmtDate(S.settings.startDate) : 'não definido'}</p><h1>Olá, Mel</h1></div><button class="btn primary hide-m" data-act="quickAdd">${icon('plus')}Lançar</button></header>`;
  if (!hasAny) {
    return greet + `<section class="card hero-empty"><h2>Vamos começar do zero, com calma</h2><p>O painel ainda não tem dados. Nada aqui é preenchido por conta própria: tudo o que aparecer vai vir do que você cadastrar. A configuração é dividida em etapas curtas e você pode pular e voltar depois.</p><div class="actions"><button class="btn primary" data-act="go" data-route="config" data-tab="guia">Começar a configuração guiada</button><button class="btn ghost" data-act="demoOn">Ver uma demonstração</button></div><p class="muted small">A demonstração usa dados fictícios em um modo separado, identificado no topo da tela. Ela não mistura nada com os seus dados.</p></section>` + setupCard(sp);
  }
  const bal = E.balances(S, d);
  const reserved = U.sum(S.reserves.filter((r) => !r.archived), (r) => E.reserveBalance(S, r));
  const to30 = U.addDays(T, 30);
  const p30 = E.projection(S, { to: to30, data: d });
  const pH = E.projection(S, { to: U.addMonths(T, S.settings.horizon || 6), data: d });
  const cm = U.monthKey(T);
  const rp = E.results(S, d, 'profissional', [cm]);
  const rs = E.results(S, d, 'pessoal', [cm]);
  const com = E.commitment(S, d, [cm]);
  const al = safeAlerts().filter((a) => a.prio <= 2).slice(0, 5);
  const upcoming = d.items.filter((i) => (i.status === 'previsto' || i.status === 'vencido') && i.date <= U.addDays(T, 7) && i.cash.length).slice(0, 8);
  return greet + `
  ${sp.done < sp.total ? setupCard(sp, true) : ''}
  ${partialBanner(pH.partial)}
  <section class="kpis">
    ${kpi('Dinheiro em contas hoje', money(bal.total), `livre para uso; reservado à parte: ${money(reserved)}`)}
    ${kpi('Próximos 30 dias', `<span class="amt-in">+${U.moneyShort(p30.totalIn)}</span> <span class="amt-out">−${U.moneyShort(p30.totalOut)}</span>`, `saldo previsto em ${U.fmtDate(to30)}: ${money(p30.end)}`)}
    ${kpi('Menor saldo previsto', money(pH.minBal), `${U.fmtDate(pH.minDate)}, em ${S.settings.horizon || 6} meses`, pH.minBal < 0 ? 'bad' : '')}
    ${kpi('Primeiro dia de falta', pH.firstNeg ? U.fmtDate(pH.firstNeg) : 'nenhum previsto', pH.firstNeg ? 'no total das contas' : `até ${U.fmtDate(pH.to)}, com o que está cadastrado`, pH.firstNeg ? 'bad' : 'good')}
  </section>
  ${al.length ? `<section class="card"><div class="card-h"><h2>${icon('alert')}Atenção agora</h2><button class="link" data-act="go" data-route="diagnostico">Ver todos</button></div><ul class="alerts">${al.map(alertItem).join('')}</ul></section>` : ''}
  <section class="two">
    <div class="card"><div class="card-h"><h2>${icon('briefcase')}Profissional em ${U.fmtMonth(cm)}</h2><button class="link" data-act="go" data-route="profissional">Abrir</button></div>
      <dl class="dl compact">
        <dt>Faturamento recebido</dt><dd class="amt-in">${money(rp.receita.pago)}</dd>
        <dt>A receber no mês</dt><dd>${money(rp.receita.previsto + rp.receita.vencido)}${rp.receita.vencido ? ` <span class="txt-bad">(${money(rp.receita.vencido)} em atraso)</span>` : ''}</dd>
        <dt>Despesas operacionais</dt><dd class="amt-out">${money(rp.despesa.total)}</dd>
        <dt>Resultado operacional previsto</dt><dd><strong class="${rp.resultado < 0 ? 'txt-bad' : ''}">${money(rp.resultado)}</strong></dd>
        <dt>Retiradas pessoais</dt><dd>${money(rp.retirada.total)}</dd>
        <dt>Caixa profissional hoje</dt><dd>${money(bal.byNature.profissional)}</dd>
      </dl></div>
    <div class="card"><div class="card-h"><h2>${icon('user')}Pessoal em ${U.fmtMonth(cm)}</h2><button class="link" data-act="go" data-route="pessoal">Abrir</button></div>
      <dl class="dl compact">
        <dt>Entradas (renda + retiradas)</dt><dd class="amt-in">${money(com.renda)}</dd>
        <dt>Saídas previstas e pagas</dt><dd class="amt-out">${money(com.total)}</dd>
        <dt>Comprometido</dt><dd>${com.renda > 0 ? `<strong class="${com.pct.total > 1 ? 'txt-bad' : ''}">${U.pct(com.pct.total)}</strong> das entradas do mês` : '<span class="muted">sem entradas cadastradas no mês</span>'}</dd>
        <dt>Cartões no mês</dt><dd>${money(com.cartoes)}</dd>
        <dt>Dívidas no mês</dt><dd>${money(com.dividas)}</dd>
        <dt>Dinheiro pessoal hoje</dt><dd>${money(bal.byNature.pessoal)}</dd>
      </dl></div>
  </section>
  <section class="card"><div class="card-h"><h2>${icon('calendar')}Próximos 7 dias e atrasos</h2><button class="link" data-act="go" data-route="calendario">Calendário</button></div>
    <div class="list">${upcoming.length ? upcoming.map((i) => itemRow(i, { nature: true })).join('') : emptyState('Nada previsto para os próximos 7 dias.')}</div></section>
  ${jointView(d, bal)}`;
};

function setupCard(sp, compact) {
  const next = sp.steps.find((s) => !s.st);
  return `<section class="card setup"><div class="card-h"><h2>${icon('task')}Configuração guiada</h2><span class="muted">${sp.done} de ${sp.total} etapas concluídas</span></div>${progressBar(sp.done / sp.total, 'Progresso da configuração')}
  <ol class="steps">${sp.steps.map((s) => `<li class="step st-${s.st || 'pendente'}"><span class="step-dot">${s.st === 'feito' ? icon('check') : s.st === 'pulado' ? icon('right') : ''}</span><span><strong>${s.title}</strong>${!compact ? `<small>${s.desc}</small>` : ''}${s.st !== 'feito' && !compact ? `<small class="muted">Enquanto isso: ${s.limit}</small>` : ''}</span><span class="step-st">${s.st === 'feito' ? 'Concluída' : s.st === 'pulado' ? 'Pulada' : 'Pendente'}</span></li>`).join('')}</ol>
  ${next ? `<div class="actions"><button class="btn primary" data-act="go" data-route="config" data-tab="guia">Continuar: ${next.title}</button></div>` : ''}</section>`;
}

function alertItem(a) {
  const ic = a.prio === 1 ? 'alert' : a.prio === 2 ? 'warn' : 'info';
  return `<li class="alert p${a.prio}"><span class="a-ic">${icon(ic)}</span><div class="a-body"><span class="a-t">${h(a.title)}</span><span class="a-s">${a.prio === 1 ? 'Prioridade alta' : a.prio === 2 ? 'Prioridade média' : 'Para acompanhar'} · ${natChip(a.nature)} ${a.value != null ? '· ' + money(Math.abs(a.value)) : ''}</span></div>${a.link ? `<button class="icon-btn" ${linkAttrs(a.link)} aria-label="Abrir">${icon('right')}</button>` : ''}</li>`;
}

// Visão conjunta: como o dinheiro circula entre pessoal e profissional
function jointView(d, bal) {
  const T = E.today();
  const cm = U.monthKey(T);
  const rp = E.results(S, d, 'profissional', [cm]);
  const rs = E.results(S, d, 'pessoal', [cm]);
  const open = UI.expanded.joint;
  return `<section class="card"><div class="card-h"><h2>${icon('swap')}Visão conjunta da circulação</h2><button class="link" data-act="toggle" data-k="joint">${open ? 'Esconder' : 'Mostrar'}</button></div>
  ${open ? `<p class="muted small">Mostra por onde o dinheiro passou em ${U.fmtMonthFull(cm)}, sempre com a origem. Não substitui as visões separadas.</p>
  <div class="flow">
    <div class="flow-box"><span class="eyebrow">Profissional</span><strong>${money(bal.byNature.profissional)}</strong><small>caixa atribuído hoje</small></div>
    <div class="flow-arrows"><span>Retiradas ${money(rp.retirada.total)} ${icon('right')}</span><small>${rp.implicitRetirada ? `inclui ${money(rp.implicitRetirada)} de contas pessoais pagas pela PJ ou receitas que caíram em conta pessoal` : 'só transferências registradas'}</small><span>${icon('left')} Aportes ${money(rs.aporte_pro.total)}</span><small>dinheiro pessoal usado no profissional</small></div>
    <div class="flow-box"><span class="eyebrow">Pessoal</span><strong>${money(bal.byNature.pessoal)}</strong><small>dinheiro atribuído hoje</small></div>
  </div>
  <h3 class="sec">Saldo por conta</h3>
  <div class="list">${S.accounts.filter((a) => !a.archived).map((a) => `<div class="row static"><div class="row-main"><span class="row-t">${h(a.name)}</span><span class="row-s">${a.type === 'pj' ? 'PJ' : 'Pessoal'}${a.allocOther ? ` · ${money(a.allocOther)} atribuídos ao ${a.type === 'pj' ? 'pessoal' : 'profissional'}` : ''}${bal.byId[a.id].known ? '' : ' · saldo não informado'}</span></div><strong class="row-amt">${money(bal.byId[a.id].balance)}</strong></div>`).join('')}</div>
  <p class="muted small">Atribuição por natureza: o saldo de cada conta pertence à natureza do tipo da conta, a não ser que você indique uma parte para a outra natureza (em Contas). Como o dinheiro circula entre as três contas, essa divisão é uma aproximação.</p>` : ''}</section>`;
}

/* ---------- Configuração guiada ---------- */
function guideView() {
  const sp = setupProgress();
  const cur = UI.guideStep || (sp.steps.find((s) => !s.st) || sp.steps[0]).key;
  const step = sp.steps.find((s) => s.key === cur);
  const body = GUIDE[cur] ? GUIDE[cur]() : '';
  return `<p class="muted">Cada etapa é curta. O progresso fica salvo e dá para pular e voltar quando quiser. Nada é preenchido por você: o painel mostra só o que for cadastrado.</p>
  ${progressBar(sp.done / sp.total, 'Progresso')}
  <div class="guide">
    <ol class="guide-nav">${sp.steps.map((s, i) => `<li><button class="${s.key === cur ? 'on' : ''} st-${s.st || 'pendente'}" data-act="guideStep" data-k="${s.key}"><span class="step-dot">${s.st === 'feito' ? icon('check') : i + 1}</span><span>${s.title}</span></button></li>`).join('')}</ol>
    <div class="card guide-body"><h2>${step.title}</h2><p>${step.desc}</p>${step.st !== 'feito' ? `<p class="banner soft">${icon('info')}<span>${step.limit}</span></p>` : ''}${body}
      <div class="actions wrap">${step.st === 'feito' ? `<button class="btn ghost" data-act="guideSet" data-k="${cur}" data-v="">Reabrir etapa</button>` : `<button class="btn ghost" data-act="guideSet" data-k="${cur}" data-v="pulado">Pular por enquanto</button><button class="btn primary" data-act="guideSet" data-k="${cur}" data-v="feito">Concluir etapa</button>`}</div></div>
  </div>`;
}
ACT.guideStep = (d) => { UI.guideStep = d.k; render(); };
ACT.guideSet = (d) => {
  if (d.k === 'start' && d.v === 'feito' && !S.settings.startDate) { toast('Escolha a data de início antes de concluir.', 'erro'); return; }
  commit((st) => { st.setup[d.k] = d.v || null; }, d.v === 'feito' ? 'Etapa concluída.' : d.v === 'pulado' ? 'Etapa pulada. Você pode voltar depois.' : 'Etapa reaberta.');
  if (d.v) { const next = M.SETUP_STEPS.find((s) => !S.setup[s.key]); UI.guideStep = next ? next.key : d.k; render(); }
};

const GUIDE = {
  start: () => `<form class="inline-form" data-form="start"><label>Data de início <input type="date" id="g_start" value="${h(S.settings.startDate || E.today())}"></label><button class="btn primary" type="button" data-act="saveStart">Salvar data</button></form>
    <p class="muted small">Recorrências e mensalidades passam a ser geradas a partir dessa data. Nada anterior é criado. Saldos das contas são informados na próxima etapa, com a data de referência de cada um.</p>`,
  accounts: () => `${listMini(S.accounts.filter((a) => !a.archived).map((a) => [a.name, `${a.type === 'pj' ? 'PJ' : 'Pessoal'} · saldo ${a.initialBalance == null ? 'não informado' : money(a.initialBalance)} em ${U.fmtDate(a.refDate)}`]), 'Nenhuma conta cadastrada.')}
    <div class="actions wrap"><button class="btn primary" data-act="newAccount" data-type="pessoal">${icon('plus')}Conta pessoal</button><button class="btn primary" data-act="newAccount" data-type="pj">${icon('plus')}Conta PJ</button></div>
    <p class="muted small">Saldo vazio fica como "não informado", diferente de zero. Você pode informar depois.</p>`,
  clients: () => `${listMini(S.clients.filter((c) => !c.archived).map((c) => [c.name, `${money(c.amount)} por mês, vence dia ${c.dueDay}${c.endDate ? `, até ${U.fmtDate(c.endDate)}` : ', sem término'}`]), 'Nenhum cliente cadastrado.')}
    <div class="actions wrap"><button class="btn primary" data-act="newClient">${icon('plus')}Cliente</button><button class="btn ghost" data-act="newService">${icon('plus')}Serviço ou produto</button><button class="btn ghost" data-act="newEntry" data-type="receita" data-nature="profissional">${icon('plus')}Entrada pontual já combinada</button></div>`,
  fixed: () => `${listMini(S.series.filter((s) => !s.archived && s.type === 'despesa').map((s) => [s.description, `${money(s.amount)} ${(E.FREQ_LABEL[s.frequency] || '').toLowerCase()} · ${NAT[s.nature]}`]), 'Nenhum custo fixo cadastrado.')}
    <div class="actions wrap"><button class="btn primary" data-act="newEntry" data-type="despesa" data-nature="pessoal" data-recurrence="recorrente">${icon('plus')}Custo fixo pessoal</button><button class="btn primary" data-act="newEntry" data-type="despesa" data-nature="profissional" data-recurrence="recorrente">${icon('plus')}Custo fixo profissional</button><button class="btn ghost" data-act="newEntry" data-type="despesa">${icon('plus')}Conta única conhecida</button></div>
    <p class="muted small">Para contas que variam, como luz, marque "Estimativa". Assinaturas no cartão: escolha "Cartão de crédito" e "Assinatura mensal".</p>`,
  cards: () => `${listMini(S.cards.filter((c) => !c.archived).map((c) => [c.name, `${c.owner === 'mae' ? 'Cartão da mãe · ' : ''}fecha dia ${c.closingDay}, vence dia ${c.dueDay}`]), 'Nenhum cartão cadastrado.')}
    <div class="actions wrap"><button class="btn primary" data-act="newCard">${icon('plus')}Cartão</button><button class="btn ghost" data-act="newPurchase" data-old="1">${icon('plus')}Parcelas que ainda faltam</button></div>
    <p class="muted small">Para compras antigas, informe só o valor da parcela, quantas faltam e a próxima fatura. Não precisa cadastrar o que já foi pago.</p>`,
  debts: () => `${listMini(S.debts.filter((d) => d.status === 'ativa').map((d) => [d.creditor, `${d.balance == null ? 'saldo não informado' : money(d.balance)}${d.installmentsLeft ? ` · ${d.installmentsLeft} parcelas restantes` : ''}`]), 'Nenhuma dívida cadastrada.')}
    <div class="actions wrap"><button class="btn primary" data-act="newDebt">${icon('plus')}Dívida</button></div>
    <p class="muted small">Se só souber o saldo atual, tudo bem. Juros desconhecidos ficam em branco e o painel avisa que a estimativa é limitada. Parcelas que já estão em um cartão podem ser vinculadas à dívida, sem duplicar.</p>`,
  goals: () => `<ul class="checklist"><li><button class="link" data-act="go" data-route="config" data-tab="categorias">Revisar categorias e limites</button></li><li><button class="link" data-act="go" data-route="profissional" data-tab="meta">Definir meta mensal de faturamento</button></li><li><button class="link" data-act="newReserve" data-nature="pessoal" data-kind="reserva">Criar reserva de emergência pessoal</button></li><li><button class="link" data-act="newReserve" data-nature="profissional" data-kind="reserva">Criar reserva profissional</button></li><li><button class="link" data-act="newReserve" data-nature="pessoal" data-kind="objetivo">Criar um objetivo</button></li></ul>`,
};
function listMini(rows, empty) { return rows.length ? `<ul class="mini">${rows.map(([t, s]) => `<li><strong>${h(t)}</strong><small>${s}</small></li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`; }
ACT.saveStart = () => {
  const v = $('#g_start').value;
  if (!U.validISO(v)) { toast('Escolha uma data válida.', 'erro'); return; }
  commit((st) => { st.settings.startDate = v; if (!st.settings.cardGoalStart) st.settings.cardGoalStart = v; }, 'Data de início salva.');
};
