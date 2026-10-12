/* Configurações, categorias, alertas, backup, exportação e importação CSV. */

VIEWS.config = () => {
  const t = curTab('geral');
  const body = { geral: configGeneral, guia: guideView, categorias: categoriesView, alertas: alertSettingsView, backup: backupView, importar: csvImportView }[t] || configGeneral;
  return `<header class="page-h"><div><p class="eyebrow">Módulo</p><h1>Configurações e backup</h1></div></header>
  ${tabs([['geral', 'Geral'], ['guia', 'Configuração guiada'], ['categorias', 'Categorias'], ['alertas', 'Alertas'], ['backup', 'Backup e exportação'], ['importar', 'Importar CSV']], t)}${body()}`;
};

function storageInfo() {
  const m = STORE.getMode();
  if (UI.demo) return `<div class="banner warn">${icon('flask')}<div>Modo demonstração ativo: nada do que você fizer agora é salvo.</div></div>`;
  return m === 'nuvem'
    ? `<div class="banner soft">${icon('cloud')}<div><strong>Onde ficam seus dados:</strong> no armazenamento deste painel no Claude, numa área privada da sua conta (nem quem tiver o link vê). Você acessa os mesmos dados no computador e no celular, desde que esteja com a mesma conta Claude. Uma cópia fica também neste navegador, para não perder alterações se a gravação falhar. Mesmo assim, exporte o backup em JSON de vez em quando.</div></div>`
    : `<div class="banner warn">${icon('warn')}<div><strong>Onde ficam seus dados:</strong> só neste navegador, porque o armazenamento do Claude não está disponível nesta visualização. Eles não aparecem em outros aparelhos e podem se perder se os dados do navegador forem limpos. Exporte o backup em JSON com frequência.</div></div>`;
}

function configGeneral() {
  const s = S.settings;
  return `${storageInfo()}
  <section class="card"><h2>Preferências</h2><dl class="dl">
    <dt>Data de início da organização</dt><dd>${s.startDate ? U.fmtDate(s.startDate) : 'não definida'}</dd>
    <dt>Período padrão das projeções</dt><dd>${s.horizon} meses</dd>
    <dt>Aportes planejados na projeção de caixa</dt><dd>${s.includePlannedContributions ? 'incluídos' : 'não incluídos'}</dd>
    <dt>Recebimentos em atraso</dt><dd>${s.overdueReceivables === 'incluir' ? 'contam como se chegassem hoje' : 'ficam fora da projeção até serem recebidos'}</dd>
    <dt>Meta de reduzir cartões: contar compras novas a partir de</dt><dd>${U.fmtDate(s.cardGoalStart || E.orgStart(S))}</dd>
    <dt>Conta padrão pessoal</dt><dd>${h(accName(s.defaultPesAccountId))}</dd>
    <dt>Conta padrão profissional</dt><dd>${h(accName(s.defaultProAccountId))}</dd>
  </dl><button class="btn primary" data-act="editSettings">Alterar</button></section>
  <section class="card"><h2>Modo demonstração</h2><p>Mostra o painel com dados fictícios para você conhecer as funções. Fica separado dos seus dados, identificado no topo e não é salvo.</p>${UI.demo ? '<button class="btn primary" data-act="demoOff">Sair da demonstração</button>' : '<button class="btn ghost" data-act="demoOn">Abrir demonstração</button>'}</section>
  <section class="card"><h2>Sobre os cálculos</h2><ul class="bullets">
    <li>Saldo inicial de conta não conta como receita.</li>
    <li>Transferências entre suas contas, aportes em reserva, Pix no crédito e empréstimos recebidos não contam como receita nem despesa.</li>
    <li>Compras no cartão contam por categoria no mês da fatura; o pagamento da fatura só tira o dinheiro da conta.</li>
    <li>Despesa pessoal paga pela conta PJ conta como retirada no profissional, sem reduzir o resultado operacional.</li>
    <li>Mensalidades só são geradas dentro da vigência do contrato. Renovação não confirmada não entra.</li>
    <li>Diagnósticos e alertas são gerados por regras fixas, sem inteligência artificial conectada.</li>
  </ul></section>`;
}
ACT.editSettings = () => openForm({
  title: 'Preferências',
  fields: [
    { k: 'startDate', label: 'Data de início da organização', type: 'date', req: true, help: 'Recorrências e mensalidades são geradas a partir desta data.' },
    { k: 'horizon', label: 'Período padrão das projeções (meses)', type: 'select', options: [[3, '3 meses'], [6, '6 meses'], [12, '12 meses'], [24, '24 meses']], half: true },
    { k: 'includePlannedContributions', label: 'Incluir aportes planejados em reservas na projeção de caixa', type: 'check' },
    { k: 'overdueReceivables', label: 'Recebimentos em atraso', type: 'chips', options: [['excluir', 'Deixar fora da projeção'], ['incluir', 'Contar como se chegassem hoje']] },
    { k: 'cardGoalStart', label: 'Contar compras novas em cartões a evitar a partir de', type: 'date', half: true },
    { k: 'defaultPesAccountId', label: 'Conta padrão pessoal', type: 'select', options: accOptions('pessoal'), half: true },
    { k: 'defaultProAccountId', label: 'Conta padrão profissional', type: 'select', options: accOptions('pj'), half: true },
  ],
  values: { ...S.settings, startDate: S.settings.startDate || E.today(), horizon: String(S.settings.horizon) },
  onSubmit: (v) => commit((st) => { Object.assign(st.settings, v, { horizon: +v.horizon }); if (!st.setup.start) st.setup.start = 'feito'; }, 'Preferências salvas.'),
});

/* ---------- Categorias ---------- */
function categoriesView() {
  const groups = [['profissional', 'receita', 'Receitas profissionais'], ['profissional', 'despesa', 'Despesas profissionais'], ['pessoal', 'receita', 'Entradas pessoais'], ['pessoal', 'despesa', 'Despesas pessoais']];
  return `<p class="muted">Sugestões iniciais que você pode renomear, arquivar ou excluir. Categorias essenciais entram no cálculo de comprometimento e na base da reserva. Arquivar mantém o histórico.</p>
  <div class="actions"><button class="btn primary" data-act="catForm">${icon('plus')}Nova categoria</button></div>
  ${groups.map(([n, k, title]) => { const list = S.categories.filter((c) => c.nature === n && c.kind === k); return `<section class="card"><h2>${title}</h2><div class="list">${list.map((c) => `<button class="row" data-act="catForm" data-id="${c.id}"><div class="row-main"><span class="row-t">${h(c.name)}</span><span class="row-s">${c.essential ? 'essencial · ' : ''}${c.limit != null ? `limite ${money(c.limit)} · ` : ''}${c.system ? 'usada nos cálculos' : ''}${c.archived ? 'arquivada' : ''}</span></div>${icon('right')}</button>`).join('')}</div></section>`; }).join('')}`;
}
ACT.catForm = (d) => {
  const c = d.id ? S.categories.find((x) => x.id === d.id) : null;
  openForm({
    title: c ? c.name : 'Nova categoria',
    fields: [{ k: 'name', label: 'Nome', type: 'text', req: true }, { k: 'nature', label: 'Natureza', type: 'chips', options: [['pessoal', 'Pessoal'], ['profissional', 'Profissional']], when: () => !c || !c.system }, { k: 'kind', label: 'Tipo', type: 'chips', options: [['despesa', 'Despesa'], ['receita', 'Receita']], when: () => !c || !c.system }, { k: 'essential', label: 'Essencial', type: 'check', when: (v) => v.kind === 'despesa' }, { k: 'limit', label: 'Limite mensal (opcional)', type: 'money', min: 0, when: (v) => v.kind === 'despesa' }],
    values: c ? { ...c } : { nature: 'pessoal', kind: 'despesa' },
    extraButtons: c && !c.system ? [{ id: 'arch', label: c.archived ? 'Desarquivar' : 'Arquivar', onClick: () => commit((st) => { const x = st.categories.find((y) => y.id === c.id); x.archived = !x.archived; }, 'Categoria atualizada.') }, { id: 'del', label: 'Excluir', cls: 'ghost danger-txt', onClick: () => askDelete('category', c.id, c.name) }] : [],
    validate: (v) => (S.categories.some((x) => x.id !== c?.id && U.norm(x.name) === U.norm(v.name) && x.nature === (v.nature || c?.nature) && x.kind === (v.kind || c?.kind)) ? { name: 'Já existe uma categoria com esse nome.' } : null),
    onSubmit: (v) => commit((st) => { if (c) { const x = st.categories.find((y) => y.id === c.id); x.name = v.name; x.essential = !!v.essential; x.limit = v.limit; if (!c.system) { x.nature = v.nature; x.kind = v.kind; } } else st.categories.push({ id: U.uid('c_'), name: v.name, nature: v.nature, kind: v.kind, essential: !!v.essential, limit: v.limit, archived: false, system: false }); }, 'Categoria salva.'),
  });
};

/* ---------- Alertas ---------- */
function alertSettingsView() {
  const s = S.settings;
  return `<section class="card"><h2>Limites e antecedência dos alertas</h2><dl class="dl">
    <dt>Avisar vencimentos com antecedência de</dt><dd>${s.dueAlertDays} dias</dd>
    <dt>Avisar término de contrato com antecedência de</dt><dd>${s.contractAlertDays} dias</dd>
    <dt>Avisar reajustes com antecedência de</dt><dd>${s.adjustAlertDays} dias</dd>
    <dt>Procurar falta de dinheiro nos próximos</dt><dd>${s.shortfallDays} dias</dd>
    <dt>Categoria pesando mais que</dt><dd>${s.categoryAlertPct}% das entradas do mês</dd>
    <dt>Faturas comprometendo mais que</dt><dd>${s.cardCommitPct}% das entradas pessoais em 30 dias</dd>
    <dt>Saldo de dívida considerado antigo após</dt><dd>${s.staleDays} dias</dd>
    <dt>Lembrar da revisão semanal após</dt><dd>${s.reviewEveryDays} dias</dd>
  </dl><button class="btn primary" data-act="editAlertSettings">Alterar</button></section>`;
}
ACT.editAlertSettings = () => openForm({
  title: 'Alertas',
  fields: [['dueAlertDays', 'Antecedência de vencimentos (dias)', 0, 60], ['contractAlertDays', 'Antecedência de término de contrato (dias)', 1, 365], ['adjustAlertDays', 'Antecedência de reajustes (dias)', 1, 365], ['shortfallDays', 'Procurar falta de dinheiro nos próximos (dias)', 7, 730], ['categoryAlertPct', 'Peso de categoria (%)', 1, 100], ['cardCommitPct', 'Faturas sobre entradas pessoais (%)', 1, 200], ['staleDays', 'Saldo de dívida antigo após (dias)', 1, 365], ['reviewEveryDays', 'Lembrar revisão após (dias)', 1, 60]].map(([k, l, min, max]) => ({ k, label: l, type: 'number', min, max, step: 1, req: true, half: true })),
  values: { ...S.settings }, onSubmit: (v) => commit((st) => Object.assign(st.settings, v), 'Alertas atualizados.'),
});

/* ---------- Backup e exportação ---------- */
function backupView() {
  const local = STORE.readLocal();
  return `${storageInfo()}
  <section class="card"><h2>Backup completo (JSON)</h2><p>Contém tudo: contas, lançamentos, clientes, cartões, dívidas, reservas, configurações, tarefas e cenários. Use para guardar uma cópia ou restaurar em outro lugar.</p>
    <div class="actions wrap"><button class="btn primary" data-act="exportJSON">${icon('down')}Exportar backup</button><label class="btn ghost file-btn">${icon('up')}Restaurar backup<input type="file" accept=".json,application/json" data-chg="importJSON" hidden></label></div>
    <p class="muted small">Restaurar substitui os dados atuais pelos do arquivo, depois de mostrar um resumo e pedir confirmação. Antes de substituir, o painel guarda uma cópia do estado atual neste navegador.</p>
    ${local && local.preImport ? `<button class="btn ghost sm" data-act="restorePreImport">Voltar ao estado anterior à última restauração</button>` : ''}</section>
  <section class="card"><h2>Exportar planilhas (CSV)</h2><p class="muted small">Arquivos separados por ponto e vírgula, abrem no Excel e no Google Planilhas.</p><div class="actions wrap">
    <button class="btn ghost" data-act="exportCSV" data-k="lancamentos">Lançamentos registrados</button>
    <button class="btn ghost" data-act="exportCSV" data-k="previstos">Previsões (próximos 12 meses)</button>
    <button class="btn ghost" data-act="exportCSV" data-k="clientes">Clientes</button>
    <button class="btn ghost" data-act="exportCSV" data-k="compras">Compras no cartão</button>
    <button class="btn ghost" data-act="exportCSV" data-k="dividas">Dívidas</button>
    <button class="btn ghost" data-act="exportCSV" data-k="contas">Contas</button>
  </div></section>`;
}
async function saveFile(filename, text) {
  let dl = null;
  try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename, data: text }); toast('Arquivo entregue para salvar.'); return; }
    catch (e) { if (e && e.code === 'declined') { toast('Download cancelado.'); return; } if (e && e.code === 'rate_limited') { toast('Aguarde um instante e tente de novo.', 'erro'); return; } }
  }
  const el = openModal(`<p>Não consegui oferecer o download nesta visualização. Copie o conteúdo abaixo e salve num arquivo chamado <strong>${h(filename)}</strong>.</p><textarea class="dump" readonly rows="10">${h(text)}</textarea><div class="actions"><button class="btn primary" data-act="copyDump">Copiar</button></div>`, { title: 'Salvar arquivo', wide: true });
  el.querySelector('textarea').addEventListener('focus', (e) => e.target.select());
}
ACT.copyDump = (d, btn) => { const ta = btn.closest('.modal').querySelector('textarea'); navigator.clipboard.writeText(ta.value).then(() => toast('Copiado.'), () => { ta.focus(); ta.select(); toast('Selecionei o texto: use copiar do seu aparelho.'); }); };
ACT.exportJSON = () => {
  const payload = { app: 'painel-financeiro-mel', version: M.SCHEMA, exportedAt: new Date().toISOString(), data: S };
  saveFile(`backup-financeiro-${E.today()}.json`, JSON.stringify(payload, null, 1));
};
CHG.importJSON = (v, el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = () => {
    let obj;
    try { obj = JSON.parse(rd.result); } catch (e) { toast('O arquivo não é um JSON válido.', 'erro'); return; }
    const errs = M.validateBackup(obj);
    if (errs.length) { toast(errs[0], 'erro'); return; }
    const st = M.migrate(obj.app ? obj.data : obj);
    confirmBox({
      title: 'Restaurar este backup?',
      body: `<p>Arquivo ${obj.exportedAt ? `exportado em ${U.fmtDate(obj.exportedAt.slice(0, 10))}` : 'sem data de exportação'}. Contém:</p><ul><li>${U.plural(st.accounts.length, 'conta')}</li><li>${U.plural(st.entries.length, 'lançamento')}</li><li>${U.plural(st.clients.length, 'cliente')}</li><li>${U.plural(st.cards.length, 'cartão', 'cartões')} e ${U.plural(st.purchases.length, 'compra')}</li><li>${U.plural(st.debts.length, 'dívida')}</li><li>${U.plural(st.reserves.length, 'reserva ou objetivo', 'reservas e objetivos')}</li></ul><p><strong>Os dados atuais serão substituídos.</strong> Uma cópia deles fica guardada neste navegador.</p>`,
      confirmLabel: 'Restaurar', danger: true,
      onConfirm: () => {
        try { const cur = STORE.readLocal() || {}; localStorage.setItem('painel-fin-mel-v1', JSON.stringify({ ...cur, preImport: S })); } catch (e) {}
        const rev = (S.meta.rev || 0) + 1;
        S = st; S.meta.rev = rev; UI.undo = null;
        if (UI.demo) { UI.demo = false; UI.realState = null; }
        STORE.save(S, true);
        try { const cur = STORE.readLocal() || {}; cur.preImport = cur.preImport || null; } catch (e) {}
        render(); toast('Backup restaurado.');
      },
    });
  };
  rd.readAsText(file);
  el.value = '';
};
ACT.restorePreImport = () => {
  const local = STORE.readLocal();
  if (!local || !local.preImport) return;
  confirmBox({ title: 'Voltar ao estado anterior?', body: '<p>Os dados atuais serão substituídos pelo que havia antes da última restauração de backup.</p>', confirmLabel: 'Voltar', onConfirm: () => { const rev = S.meta.rev + 1; S = M.migrate(local.preImport); S.meta.rev = rev; STORE.save(S, true); render(); toast('Estado anterior recuperado.'); } });
};
ACT.exportCSV = (d) => {
  const T = E.today();
  const dd = E.build(S, U.addMonths(T, 12));
  let headers, rows;
  const st = (s) => STATUS_LABEL[s] || s;
  if (d.k === 'lancamentos') {
    headers = ['Tipo', 'Descrição', 'Valor', 'Natureza', 'Categoria', 'Conta', 'Conta destino', 'Forma', 'Data prevista', 'Data efetiva', 'Situação', 'Observações'];
    rows = S.entries.map((e) => [e.type, e.description, U.moneyInput(e.type === 'ajuste' ? e.delta : e.amount), e.nature || '', e.categoryId ? catName(e.categoryId) : '', e.type === 'transferencia' ? accName(e.fromId) : e.accountId ? accName(e.accountId) : '', e.type === 'transferencia' ? accName(e.toId) : '', e.method || '', U.fmtDate(e.dueDate), U.fmtDate(e.paidDate), st(e.status), e.notes || '']);
  } else if (d.k === 'previstos') {
    headers = ['Data', 'Descrição', 'Entrada', 'Saída', 'Natureza', 'Conta', 'Situação', 'Certeza', 'Origem'];
    rows = dd.items.filter((i) => i.status !== 'pago' && i.status !== 'cancelado' && i.cash.length).map((i) => { const net = i.cash.reduce((a, c) => a + c.delta, 0); return [U.fmtDate(i.date), i.desc, net > 0 ? U.moneyInput(net) : '', net < 0 ? U.moneyInput(-net) : '', i.nature || '', i.accountId ? accName(i.accountId) : '', st(i.status), CERT_LABEL[i.certainty] || '', i.src]; });
  } else if (d.k === 'clientes') {
    headers = ['Cliente', 'Valor atual', 'Início', 'Término', 'Dia de vencimento', 'Recorrência', 'Status', 'Renovação', 'Observações'];
    rows = S.clients.map((c) => [c.name, U.moneyInput(E.clientAmountAt(c, T)), U.fmtDate(c.startDate), U.fmtDate(c.endDate), c.dueDay, c.frequency, c.status, c.renewal, c.notes || '']);
  } else if (d.k === 'compras') {
    headers = ['Cartão', 'Descrição', 'Data', 'Tipo', 'Natureza', 'Categoria', 'Parcela', 'Fatura', 'Valor', 'Situação da fatura'];
    rows = [];
    for (const inv of Object.values(dd.invoices)) for (const it of inv.items) if (!it.p.virtual) rows.push([cardName(inv.cardId), it.p.description, U.fmtDate(it.p.date), it.p.kind === 'pix_credito' ? 'Pix no crédito' : 'Compra', it.nature, catName(it.categoryId), it.label, U.fmtMonth(inv.month), U.moneyInput(it.amount), inv.status]);
  } else if (d.k === 'dividas') {
    headers = ['Credor', 'Tipo', 'Natureza', 'Saldo informado', 'Data do saldo', 'Saldo estimado hoje', 'Juros', 'Período', 'Parcela', 'Parcelas restantes', 'Próximo vencimento', 'Status'];
    rows = S.debts.map((x) => { const i = E.debtInfo(S, dd, x); return [x.creditor, x.type, x.nature, U.moneyInput(x.balance), U.fmtDate(x.balanceDate), U.moneyInput(i.balance), x.rate ?? '', x.ratePeriod || '', U.moneyInput(x.installmentAmount), i.remainingInst ?? '', U.fmtDate(i.nextDue), x.status]; });
  } else {
    const b = E.balances(S, dd);
    headers = ['Conta', 'Tipo', 'Banco', 'Saldo de referência', 'Data de referência', 'Saldo calculado hoje'];
    rows = S.accounts.map((a) => [a.name, a.type, a.bank || '', U.moneyInput(a.initialBalance), U.fmtDate(a.refDate), U.moneyInput(b.byId[a.id].balance)]);
  }
  saveFile(`${d.k}-${T}.csv`, A.toCSV(headers, rows));
};

/* ---------- Importação CSV ---------- */
function csvImportView() {
  const c = UI.csv;
  if (!c) return `<section class="card"><h2>Importar lançamentos de um CSV</h2><p>Para complementar o cadastro manual com extratos exportados do banco em CSV. Você escolhe as colunas, vê uma prévia, e o painel aponta erros e possíveis duplicidades antes de confirmar. Leitura de PDF não está disponível.</p><label class="btn primary file-btn">${icon('up')}Escolher arquivo CSV<input type="file" accept=".csv,text/csv,text/plain" data-chg="csvFile" hidden></label><p class="muted small">Os lançamentos importados entram como já pagos ou recebidos, na data do extrato.</p></section>`;
  const cols = (c.rows[0] || []).map((x, i) => [i, c.hasHeader ? `${x || 'Coluna ' + (i + 1)}` : `Coluna ${i + 1}: ${(x || '').slice(0, 18)}`]);
  const sel = (k, label, opt = false) => `<div class="field half"><label for="csv_${k}">${label}</label><select id="csv_${k}" data-chg="csvMap" data-k="${k}">${opt ? '<option value="">Não usar</option>' : ''}${cols.map(([i, l]) => `<option value="${i}" ${String(c.map[k]) === String(i) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>`;
  let prev = [];
  if (c.accountId) prev = A.csvPreview(S, c.rows, { map: c.map, hasHeader: c.hasHeader, signMode: c.signMode, accountId: c.accountId, nature: c.nature, defaultCat: { despesa: c.catDesp || null, receita: c.catRec || null } });
  if (c.overrides) for (const p of prev) if (p.i in c.overrides) p.include = c.overrides[p.i] && !p.errs.length;
  c.preview = prev;
  const ok = prev.filter((p) => p.include).length;
  return `<section class="card"><h2>Arquivo: ${h(c.name)}</h2><p class="muted small">${U.plural(c.rows.length, 'linha')} encontradas, separador "${c.delim === '\t' ? 'tab' : c.delim}".</p>
    <label class="check-inline"><input type="checkbox" data-chg="csvOpt" data-k="hasHeader" ${c.hasHeader ? 'checked' : ''}> A primeira linha é o cabeçalho</label>
    <div class="grid-f">${sel('date', 'Coluna da data')}${sel('desc', 'Coluna da descrição')}${sel('amount', 'Coluna do valor')}
      <div class="field half"><label for="csv_sm">Entrada ou saída</label><select id="csv_sm" data-chg="csvOpt" data-k="signMode"><option value="sinal" ${c.signMode === 'sinal' ? 'selected' : ''}>Pelo sinal do valor (negativo = saída)</option><option value="coluna" ${c.signMode === 'coluna' ? 'selected' : ''}>Por uma coluna de tipo</option><option value="despesa" ${c.signMode === 'despesa' ? 'selected' : ''}>Tudo é saída</option><option value="receita" ${c.signMode === 'receita' ? 'selected' : ''}>Tudo é entrada</option></select></div>
      ${c.signMode === 'coluna' ? sel('type', 'Coluna do tipo (D/C, débito/crédito)') : ''}${sel('category', 'Coluna de categoria (opcional)', true)}
      <div class="field half"><label for="csv_acc">Conta</label><select id="csv_acc" data-chg="csvOpt" data-k="accountId"><option value="">Escolha a conta do extrato</option>${accOptions(null, false).map(([v, l]) => `<option value="${v}" ${c.accountId === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
      <div class="field half"><label for="csv_nat">Natureza</label><select id="csv_nat" data-chg="csvOpt" data-k="nature"><option value="pessoal" ${c.nature === 'pessoal' ? 'selected' : ''}>Pessoal</option><option value="profissional" ${c.nature === 'profissional' ? 'selected' : ''}>Profissional</option></select></div>
      <div class="field half"><label for="csv_cd">Categoria padrão das saídas</label><select id="csv_cd" data-chg="csvOpt" data-k="catDesp">${catOptions(c.nature, 'despesa').map(([v, l]) => `<option value="${v}" ${c.catDesp === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
      <div class="field half"><label for="csv_cr">Categoria padrão das entradas</label><select id="csv_cr" data-chg="csvOpt" data-k="catRec">${catOptions(c.nature, 'receita').map(([v, l]) => `<option value="${v}" ${c.catRec === v ? 'selected' : ''}>${h(l)}</option>`).join('')}</select></div>
    </div></section>
  ${c.accountId ? `<section class="card"><h2>Prévia</h2><p class="small">${ok} para importar · ${prev.filter((p) => p.dup).length} possíveis duplicidades · ${prev.filter((p) => p.errs.length).length} com erro. Desmarque o que não quiser. Transferências entre suas próprias contas devem ser lançadas como transferência, não importadas como receita ou despesa.</p>
    <div class="list">${prev.slice(0, 300).map((p) => `<label class="row static ${p.errs.length ? 'err-row' : ''}"><input type="checkbox" data-chg="csvRow" data-i="${p.i}" ${p.include ? 'checked' : ''} ${p.errs.length ? 'disabled' : ''}><div class="row-main"><span class="row-t">${h(p.desc)}</span><span class="row-s">${p.date ? U.fmtDate(p.date) : 'sem data'} · ${p.type === 'receita' ? 'entrada' : 'saída'}${p.errs.length ? ` · <span class="txt-bad">${p.errs.join(', ')}</span>` : ''}${p.dup ? ` · <span class="txt-warn">${p.dup}</span>` : ''}</span></div><strong class="row-amt ${p.type === 'receita' ? 'amt-in' : 'amt-out'}">${p.amount != null ? money(p.amount) : ''}</strong></label>`).join('')}</div>${prev.length > 300 ? '<p class="muted small">Mostrando as primeiras 300 linhas; todas serão consideradas.</p>' : ''}
    <div class="actions"><button class="btn ghost" data-act="csvCancel">Cancelar</button><button class="btn primary" data-act="csvCommit" ${ok ? '' : 'disabled'}>Importar ${U.plural(ok, 'lançamento')}</button></div></section>` : '<p class="muted">Escolha a conta do extrato para ver a prévia.</p>'}`;
}
CHG.csvFile = (v, el) => {
  const f = el.files && el.files[0];
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const { rows, delim } = A.parseCSV(String(rd.result));
    if (!rows.length) { toast('Não encontrei linhas no arquivo.', 'erro'); return; }
    const head = rows[0].map((x) => U.norm(x));
    const find = (re, def) => { const i = head.findIndex((x) => re.test(x)); return i >= 0 ? i : def; };
    UI.csv = { name: f.name, rows, delim, hasHeader: true, map: { date: find(/data|date/, 0), desc: find(/desc|hist|memo|lanc/, 1), amount: find(/valor|amount|quantia/, 2), type: find(/tipo|d\/c|natureza/, 3), category: find(/categ/, '') }, signMode: 'sinal', accountId: '', nature: 'pessoal', catDesp: '', catRec: '', overrides: {} };
    render();
  };
  rd.readAsText(f);
  el.value = '';
};
CHG.csvMap = (v, el) => { UI.csv.map[el.dataset.k] = v === '' ? null : +v; UI.csv.overrides = {}; render(); };
CHG.csvOpt = (v, el) => { UI.csv[el.dataset.k] = el.type === 'checkbox' ? el.checked : v; UI.csv.overrides = {}; render(); };
CHG.csvRow = (v, el) => { UI.csv.overrides[+el.dataset.i] = el.checked; };
ACT.csvCancel = () => { UI.csv = null; render(); };
ACT.csvCommit = () => {
  const prev = UI.csv.preview.map((p) => ({ ...p, include: (UI.csv.overrides[p.i] ?? p.include) && !p.errs.length }));
  const n = prev.filter((p) => p.include).length;
  confirmBox({ title: 'Importar lançamentos?', body: `<p>${U.plural(n, 'lançamento será criado', 'lançamentos serão criados')} na conta ${h(accName(UI.csv.accountId))}, como já pagos ou recebidos.</p>`, confirmLabel: 'Importar', onConfirm: () => { commit((st) => A.csvCommit(st, prev), `${U.plural(n, 'lançamento importado', 'lançamentos importados')}.`); UI.csv = null; render(); } });
};
