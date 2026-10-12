/* Contas e transferências. */

VIEWS.contas = () => {
  const t = curTab('contas');
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Contas e transferências</h1></div><button class="btn primary hide-m" data-act="newTransfer">${icon('swap')}Transferir</button></header>
  ${tabs([['contas', 'Contas'], ['transferencias', 'Transferências']], t)}${t === 'transferencias' ? transfersView() : accountsView()}`;
};

function accountsView() {
  const d = data();
  const bal = E.balances(S, d);
  const showArch = UI.filters.accArch;
  const list = S.accounts.filter((a) => !!a.archived === !!showArch);
  const reserved = U.sum(S.reserves.filter((r) => !r.archived), (r) => E.reserveBalance(S, r));
  return `<section class="kpis">
    ${kpi('Total nas contas', money(bal.total), bal.unknown ? `${U.plural(bal.unknown, 'conta', 'contas')} sem saldo informado` : 'dinheiro livre')}
    ${kpi('Atribuído ao pessoal', money(bal.byNature.pessoal), 'pelo tipo da conta e atribuições')}
    ${kpi('Atribuído ao profissional', money(bal.byNature.profissional), 'não é lucro: inclui o que já tem destino')}
    ${kpi('Reservado (fora das contas)', money(reserved), 'reservas e objetivos')}
  </section>
  <div class="actions"><button class="btn primary" data-act="newAccount" data-type="pessoal">${icon('plus')}Conta pessoal</button><button class="btn primary" data-act="newAccount" data-type="pj">${icon('plus')}Conta PJ</button><label class="check-inline"><input type="checkbox" data-chg="setFilter" data-key="accArch" ${showArch ? 'checked' : ''}> Mostrar arquivadas</label></div>
  <div class="cards-grid">${list.length ? list.map((a) => {
    const b = bal.byId[a.id];
    const isDefault = S.settings.defaultProAccountId === a.id || S.settings.defaultPesAccountId === a.id;
    return `<div class="card ccard" id="rec-${a.id}"><div class="debt-h"><strong>${h(a.name)}</strong><span class="chip nat-${a.type === 'pj' ? 'profissional' : 'pessoal'}">${a.type === 'pj' ? 'PJ' : 'Pessoal'}</span>${isDefault ? '<span class="pill soft">padrão</span>' : ''}</div>
      <small class="muted">${h(a.bank || '')}</small>
      <span class="big-num">${b.known ? money(b.balance) : '<span class="muted">saldo não informado</span>'}</span>
      <small class="muted">${b.known ? `Saldo de ${money(a.initialBalance)} em ${U.fmtDate(a.refDate)}, mais o que foi confirmado depois.` : 'Informe o saldo para a projeção usar esta conta.'}</small>
      ${a.allocOther ? `<p class="small">${money(a.allocOther)} deste saldo pertencem ao ${a.type === 'pj' ? 'pessoal' : 'profissional'}.</p>` : ''}
      <div class="actions wrap"><button class="btn primary sm" data-act="adjustBal" data-id="${a.id}">Atualizar saldo</button><button class="btn ghost sm" data-act="editAccount" data-id="${a.id}">${icon('edit')}Editar</button><button class="btn ghost sm" data-act="accStatement" data-id="${a.id}">Movimentações</button></div></div>`;
  }).join('') : emptyState(showArch ? 'Nenhuma conta arquivada.' : 'Nenhuma conta cadastrada. Comece pelas suas duas contas pessoais e a conta PJ.')}</div>
  ${explain('accHow', 'Como o painel trata o saldo das contas', '<p>O saldo informado não conta como receita. A partir da data de referência, só entram os pagamentos e recebimentos que você confirmar. Use "Atualizar saldo" na revisão semanal: se houver diferença, o painel registra um ajuste (não é receita nem despesa) e mostra o valor.</p><p>A natureza do dinheiro segue o tipo da conta. Como o dinheiro circula entre as três contas, você pode indicar uma parte do saldo que pertence à outra natureza (em Editar). O mesmo valor nunca é atribuído às duas.</p>')}`;
}
ACT.newAccount = (d) => accountForm(null, d.type);
ACT.editAccount = (d) => accountForm(S.accounts.find((a) => a.id === d.id));
function accountForm(a, type) {
  const isNew = !a;
  const T = E.today();
  const v = a ? { ...a, isDefault: S.settings.defaultProAccountId === a.id || S.settings.defaultPesAccountId === a.id } : { type: type || 'pessoal', refDate: T, initialBalance: null, isDefault: !S.accounts.some((x) => x.type === (type || 'pessoal')) };
  openForm({
    title: isNew ? 'Nova conta' : a.name,
    fields: [
      { k: 'name', label: 'Nome', type: 'text', req: true, placeholder: 'Ex.: Nubank pessoal' },
      { k: 'type', label: 'Tipo', type: 'chips', options: [['pessoal', 'Pessoal'], ['pj', 'PJ']], half: true },
      { k: 'bank', label: 'Banco (opcional)', type: 'text', half: true },
      { k: 'initialBalance', label: 'Saldo na data de referência', type: 'money', half: true, help: 'Vazio = ainda não informado (diferente de zero). Pode ser negativo, por exemplo -150,00.' },
      { k: 'refDate', label: 'Data de referência', type: 'date', req: true, half: true },
      { k: 'allocOther', label: 'Parte do saldo que pertence à outra natureza', type: 'money', min: 0, help: 'Opcional. Ex.: dinheiro de cliente que caiu na conta pessoal e ainda vai voltar para a PJ.' },
      { k: 'isDefault', label: 'Usar como conta padrão para novos lançamentos deste tipo', type: 'check' },
      { k: 'notes', label: 'Observações', type: 'textarea' },
    ],
    values: v,
    extraButtons: a ? [{ id: 'arch', label: a.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const x = st.accounts.find((y) => y.id === a.id); x.archived = !x.archived; }, 'Conta atualizada.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('account', a.id, a.name) }] : [],
    onSubmit: (x) => commit((st) => {
      let acc = isNew ? null : st.accounts.find((y) => y.id === a.id);
      const changedBase = isNew || acc.initialBalance !== x.initialBalance || acc.refDate !== x.refDate;
      const obj = { name: x.name, type: x.type, bank: x.bank, initialBalance: x.initialBalance, refDate: x.refDate, allocOther: x.allocOther, notes: x.notes };
      if (changedBase) obj.balanceSetAt = Date.now();
      if (isNew) { acc = { id: U.uid('a_'), archived: false, createdAt: Date.now(), ...obj }; st.accounts.push(acc); }
      else Object.assign(acc, obj);
      const key = acc.type === 'pj' ? 'defaultProAccountId' : 'defaultPesAccountId';
      if (x.isDefault) st.settings[key] = acc.id;
      else if (st.settings[key] === acc.id) st.settings[key] = null;
    }, isNew ? 'Conta cadastrada.' : 'Conta atualizada.'),
  });
}
ACT.adjustBal = (d) => {
  const a = S.accounts.find((x) => x.id === d.id);
  const b = E.balances(S, data()).byId[a.id];
  openForm({
    title: 'Atualizar saldo: ' + a.name,
    intro: b.known ? `<p>Saldo calculado pelo painel: <strong>${money(b.balance)}</strong>. Informe o saldo que aparece no banco agora.</p>` : '<p>Informe o saldo atual da conta.</p>',
    fields: [{ k: 'value', label: 'Saldo no banco', type: 'money', req: true }, { k: 'date', label: 'Data', type: 'date', req: true }, { k: 'i', type: 'info', info: (v) => b.known && v.value != null && !Number.isNaN(v.value) && v.value !== b.balance ? `<p class="small">Diferença de <strong>${signed(v.value - b.balance)}</strong>. Será registrada como ajuste de saldo, sem contar como receita ou despesa. Vale conferir se faltou confirmar algum pagamento ou recebimento.</p>` : '' }],
    values: { value: b.known ? b.balance : null, date: E.today() },
    onSubmit: (v) => commit((st) => { const r = A.adjustBalance(st, a.id, v.value, v.date); if (r.delta) setTimeout(() => toast(`Ajuste de ${signed(r.delta)} registrado.`), 50); }, 'Saldo atualizado.'),
  });
};
ACT.accStatement = (dd) => {
  const a = S.accounts.find((x) => x.id === dd.id);
  const d = data();
  const T = E.today();
  const items = d.items.filter((i) => i.cash.some((c) => c.accountId === a.id) && i.status !== 'cancelado' && (i.date <= U.addDays(T, 30))).slice(-60).reverse();
  openModal(`<p class="muted">Movimentações confirmadas e previstas até ${U.fmtDate(U.addDays(T, 30))}, mais recentes primeiro.</p><div class="list">${items.length ? items.map((i) => itemRow(i, { nature: true })).join('') : '<p class="muted">Nenhuma movimentação.</p>'}</div>`, { title: 'Movimentações: ' + a.name, wide: true });
};

/* ---------- Transferências ---------- */
function transfersView() {
  const list = S.entries.filter((e) => e.type === 'transferencia').sort((a, b) => ((a.paidDate || a.dueDate) < (b.paidDate || b.dueDate) ? 1 : -1));
  const d = data();
  return `<p class="muted">Transferências entre suas contas não contam como receita nem despesa. Da PJ para uma conta pessoal, contam como <strong>retirada</strong> no profissional e como recurso recebido no pessoal. Da pessoal para a PJ, como aporte.</p>
  <div class="actions"><button class="btn primary" data-act="newTransfer">${icon('swap')}Nova transferência</button><button class="btn ghost" data-act="newTransfer" data-purpose="retirada">Planejar retirada</button></div>
  <div class="card list">${list.length ? list.map((e) => itemRow(d.items.find((i) => i.key === 'e:' + e.id))).join('') : emptyState('Nenhuma transferência registrada.')}</div>`;
}
ACT.newTransfer = (d) => openTransferForm(null, d && d.purpose === 'retirada' ? { purpose: 'retirada', status: 'previsto', fromId: S.accounts.find((a) => a.type === 'pj' && !a.archived)?.id, toId: S.accounts.find((a) => a.type === 'pessoal' && !a.archived)?.id } : {});
function openTransferForm(e, preset = {}) {
  if (S.accounts.filter((a) => !a.archived).length < 2) { toast('Cadastre pelo menos duas contas para transferir.', 'erro'); return; }
  const T = E.today();
  const isNew = !e;
  const v = e ? { ...e, date: e.paidDate || e.dueDate } : { date: T, status: 'pago', purpose: 'movimentacao', repeat: 1, ...preset };
  const purposeAuto = (x) => { const f = S.accounts.find((a) => a.id === x.fromId), t = S.accounts.find((a) => a.id === x.toId); if (!f || !t) return ''; if (f.type === 'pj' && t.type === 'pessoal') return 'Será registrada como <strong>retirada pessoal</strong>.'; if (f.type === 'pessoal' && t.type === 'pj') return 'Será registrada como <strong>aporte do pessoal no profissional</strong>.'; return 'Movimentação entre contas do mesmo tipo: não muda nenhum resultado.'; };
  openForm({
    title: isNew ? 'Transferência entre contas' : 'Editar transferência',
    fields: [
      { k: 'fromId', label: 'De', type: 'select', options: accOptions(null, false), half: true },
      { k: 'toId', label: 'Para', type: 'select', options: accOptions(null, false), half: true },
      { k: 'amount', label: 'Valor', type: 'money', req: true, min: 1, half: true },
      { k: 'date', label: 'Data', type: 'date', req: true, half: true },
      { k: 'status', label: 'Situação', type: 'chips', options: [['pago', 'Já feita'], ['previsto', 'Planejada']] },
      { k: 'repeat', label: 'Repetir por quantos meses', type: 'number', min: 1, max: 24, step: 1, when: (x) => isNew && x.status === 'previsto', help: 'Cria uma transferência planejada por mês.' },
      { k: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex.: Retirada de outubro' },
      { k: 'notes', label: 'Observações', type: 'textarea' },
      { k: 'i', type: 'info', info: (x) => `<p class="small">${purposeAuto(x)}</p>` },
    ],
    values: v,
    validate: (x) => (x.fromId === x.toId ? { toId: 'Escolha contas diferentes.' } : null),
    extraButtons: e ? [{ id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => confirmBox({ title: 'Excluir transferência?', body: '<p>Os saldos das duas contas serão recalculados.</p>', danger: true, confirmLabel: 'Excluir', onConfirm: () => { closeAllModals(); commit((st) => A.remove(st, 'entry', e.id), 'Transferência excluída.'); } }) }] : [],
    onSubmit: (x) => commit((st) => {
      const f = st.accounts.find((a) => a.id === x.fromId), t = st.accounts.find((a) => a.id === x.toId);
      const purpose = f.type === 'pj' && t.type === 'pessoal' ? 'retirada' : f.type === 'pessoal' && t.type === 'pj' ? 'aporte' : 'movimentacao';
      if (isNew) {
        const times = x.status === 'previsto' ? (x.repeat || 1) : 1;
        for (let i = 0; i < times; i++) A.transfer(st, { fromId: x.fromId, toId: x.toId, amount: x.amount, date: U.addMonths(x.date, i), status: x.status, purpose, description: x.description || (purpose === 'retirada' ? 'Retirada pessoal' : 'Transferência entre contas'), notes: x.notes });
      } else {
        const y = st.entries.find((z) => z.id === e.id);
        Object.assign(y, { fromId: x.fromId, toId: x.toId, amount: x.amount, dueDate: x.date, paidDate: x.status === 'pago' ? x.date : null, status: x.status, purpose, description: x.description, notes: x.notes });
        if (x.status === 'pago' && !y.paidAt) y.paidAt = Date.now();
      }
    }, 'Transferência salva.'),
  });
}
