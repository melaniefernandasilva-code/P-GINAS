/* Núcleo da interface: estado da tela, commit, eventos, formulários, modais, gráficos. */
let S = null;
const UI = {
  route: 'inicio', tab: {}, filters: {}, demo: false, realState: null, undo: null,
  calMonth: null, calDay: null, projMonths: 6, projCustom: null, projView: 'geral', projAccount: '',
  scenario: [], expanded: {}, ready: false,
};
const ACT = {};      // ações de clique: data-act
const CHG = {};      // ações de mudança: data-chg
const VIEWS = {};    // rotas

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const h = U.esc;

/* ---------- Ícones ---------- */
const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  debt: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/><path d="M15 8h3v3"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  piggy: '<path d="M5 11a7 6 0 0 1 13-2h2v4l-2 1-1 3h-3v-2h-4v2H7l-1-3a5 5 0 0 1-1-3z"/><circle cx="15" cy="10" r=".8" fill="currentColor"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  down: '<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
  up: '<path d="M12 20V8M6 13l6-6 6 6M5 4h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  warn: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5"/>',
  cloud: '<path d="M7 18a5 5 0 0 1 0-10 6 6 0 0 1 11 2 4 4 0 0 1-1 8H7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- Rótulos ---------- */
const NAT = { pessoal: 'Pessoal', profissional: 'Profissional', geral: 'Geral' };
const STATUS_LABEL = { pago: 'Pago', previsto: 'Previsto', vencido: 'Em atraso', cancelado: 'Cancelado' };
const CERT_LABEL = { realizado: 'Realizado', contratado: 'Contratado', confirmado: 'Confirmado', estimado: 'Estimado', planejado: 'Planejado', hipotetico: 'Hipótese' };
const METHODS = [['pix', 'Pix'], ['boleto', 'Boleto'], ['debito', 'Débito'], ['transferencia', 'Transferência'], ['dinheiro', 'Dinheiro'], ['debito_auto', 'Débito automático'], ['outro', 'Outro']];
const FREQS = Object.entries(E.FREQ_LABEL);
const natChip = (n) => n ? `<span class="chip nat-${n}">${NAT[n] || n}</span>` : '';
function statusPill(it) {
  const st = it.status;
  const isIn = it.cash ? it.cash.some((c) => c.delta > 0) && !it.cash.some((c) => c.delta < 0) : it.type === 'receita';
  const label = st === 'pago' ? (isIn ? 'Recebido' : 'Pago') : st === 'vencido' ? 'Em atraso' : STATUS_LABEL[st] || st;
  const ic = st === 'pago' ? 'check' : st === 'vencido' ? 'alert' : st === 'cancelado' ? 'x' : 'clock';
  return `<span class="pill st-${st}">${icon(ic)}${label}</span>`;
}
const certPill = (c) => c && c !== 'confirmado' && c !== 'realizado' ? `<span class="pill cert-${c}">${CERT_LABEL[c] || c}</span>` : '';
const accName = (id) => (S.accounts.find((a) => a.id === id) || {}).name || 'sem conta';
const catName = (id) => (S.categories.find((c) => c.id === id) || {}).name || 'Sem categoria';
const cardName = (id) => (S.cards.find((c) => c.id === id) || {}).name || 'cartão';
const accOptions = (filter, withNone = true) => [...(withNone ? [['', 'Sem conta definida']] : []), ...S.accounts.filter((a) => !a.archived && (!filter || a.type === filter)).map((a) => [a.id, `${a.name} (${a.type === 'pj' ? 'PJ' : 'pessoal'})`])];
const catOptions = (nature, kind, withNone = true) => [...(withNone ? [['', 'Sem categoria']] : []), ...S.categories.filter((c) => !c.archived && (!nature || c.nature === nature) && (!kind || c.kind === kind)).map((c) => [c.id, c.name])];
const cardOptions = () => S.cards.filter((c) => !c.archived).map((c) => [c.id, c.name + (c.owner === 'mae' ? ' (da mãe)' : '')]);
const money = U.money;
const signed = (c) => (c > 0 ? '+' : c < 0 ? '−' : '') + U.money(Math.abs(c));

/* ---------- Estado e gravação ---------- */
function commit(fn, msg, opts = {}) {
  const before = JSON.stringify(S);
  const draft = JSON.parse(before);
  let result;
  try { result = fn(draft); }
  catch (e) { toast(e.message || 'Não foi possível concluir.', 'erro'); return false; }
  S = draft;
  S.meta.rev = (S.meta.rev || 0) + 1;
  S.meta.updatedAt = new Date().toISOString();
  UI.undo = { json: before, msg };
  if (!UI.demo) STORE.save(S, opts.immediate);
  closeModal(opts.keepModal);
  render();
  if (msg) toast(msg + (UI.demo ? ' (demonstração: nada é salvo)' : ''), 'ok', !opts.noUndo);
  return result === undefined ? true : result;
}
function undo() {
  if (!UI.undo) return;
  const cur = S.meta.rev;
  S = JSON.parse(UI.undo.json);
  S.meta.rev = cur + 1;
  UI.undo = null;
  if (!UI.demo) STORE.save(S);
  render();
  toast('Alteração desfeita.', 'ok');
}
ACT.undo = undo;

/* ---------- Navegação ---------- */
const NAV = [
  ['inicio', 'Início', 'home'],
  ['profissional', 'Profissional', 'briefcase'],
  ['pessoal', 'Pessoal', 'user'],
  ['dividas', 'Dívidas', 'debt'],
  ['cartoes', 'Cartões', 'card'],
  ['contas', 'Contas e transferências', 'bank'],
  ['calendario', 'Calendário e projeções', 'calendar'],
  ['reservas', 'Reservas e investimentos', 'piggy'],
  ['simulador', 'Simulador', 'flask'],
  ['diagnostico', 'Diagnósticos e plano', 'pulse'],
  ['config', 'Configurações e backup', 'gear'],
];
function go(route, tab, extra = {}) {
  UI.route = route;
  if (tab) UI.tab[route] = tab;
  Object.assign(UI.filters, extra.filters || {});
  if (extra.date) { UI.calDay = extra.date; UI.calMonth = U.monthKey(extra.date); }
  UI.focus = extra.id || null;
  closeDrawer();
  render();
  window.scrollTo(0, 0);
  try { localStorage.setItem('painel-fin-mel-route', JSON.stringify({ route, tab: UI.tab })); } catch (e) {}
}
ACT.go = (d) => go(d.route, d.tab, { id: d.id, date: d.date, filters: d.cat ? { cat: d.cat } : {} });
ACT.tab = (d) => { UI.tab[UI.route] = d.tab; render(); };
ACT.drawer = () => { $('#drawer').hidden = false; };
const closeDrawer = () => { const d = $('#drawer'); if (d) d.hidden = true; };
ACT.closeDrawer = closeDrawer;
ACT.toggle = (d) => { UI.expanded[d.k] = !UI.expanded[d.k]; render(); };
const linkAttrs = (l) => l ? `data-act="go" data-route="${l.route}"${l.tab ? ` data-tab="${l.tab}"` : ''}${l.id ? ` data-id="${l.id}"` : ''}${l.date ? ` data-date="${l.date}"` : ''}${l.cat ? ` data-cat="${l.cat}"` : ''}` : '';

function tabs(list, current) {
  return `<div class="tabs" role="tablist">${list.map(([k, l]) => `<button role="tab" class="tab ${current === k ? 'on' : ''}" aria-selected="${current === k}" data-act="tab" data-tab="${k}">${l}</button>`).join('')}</div>`;
}
const curTab = (def) => UI.tab[UI.route] || def;

/* ---------- Renderização ---------- */
function render() {
  if (!S) return;
  const v = VIEWS[UI.route] || VIEWS.inicio;
  let html;
  try { html = v(); }
  catch (e) { console.error(e); html = `<div class="card empty">${icon('warn')}<p>Algo deu errado ao montar esta tela: ${h(e.message)}</p><p class="muted">Seus dados não foram alterados. Tente outra seção ou recarregue.</p></div>`; }
  $('#main').innerHTML = html;
  $$('.nav-item').forEach((el) => el.classList.toggle('on', el.dataset.route === UI.route));
  $('#demo-banner').hidden = !UI.demo;
  renderStatus();
  const alertsN = safeAlerts().filter((a) => a.prio === 1).length;
  $$('.alert-count').forEach((el) => { el.textContent = alertsN || ''; el.hidden = !alertsN; });
  if (UI.focus) { const el = document.getElementById('rec-' + UI.focus); if (el) { el.classList.add('focus'); el.scrollIntoView({ block: 'center' }); } UI.focus = null; }
}
let _alertsCache = { rev: -1, list: [] };
function safeAlerts() {
  if (_alertsCache.rev === S.meta.rev && _alertsCache.day === E.today() && _alertsCache.st === S) return _alertsCache.list;
  let list = [];
  try { list = E.alerts(S); } catch (e) { console.error(e); }
  _alertsCache = { rev: S.meta.rev, list, day: E.today(), st: S };
  return list;
}
function renderStatus() {
  const el = $('#save-status');
  if (!el) return;
  if (UI.demo) { el.className = 'save st-demo'; el.innerHTML = `${icon('flask')}<span>Demonstração</span>`; return; }
  const s = STORE.getStatus();
  const m = STORE.getMode();
  const ic = s.state === 'salvando' ? 'clock' : s.state === 'erro' ? 'warn' : m === 'nuvem' ? 'cloud' : 'info';
  el.className = 'save st-' + s.state;
  el.innerHTML = `${icon(ic)}<span>${h(s.msg || (m === 'nuvem' ? 'Salvo no Claude' : 'Salvo neste navegador'))}</span>` + (s.state === 'erro' ? ' <button class="link" data-act="retrySave">Tentar de novo</button>' : '');
}
ACT.retrySave = () => STORE.retry(S);

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(msg, kind = 'ok', withUndo = false) {
  const el = $('#toast');
  el.className = 'toast show t-' + kind;
  el.innerHTML = `${icon(kind === 'erro' ? 'warn' : 'check')}<span>${h(msg)}</span>` + (withUndo && UI.undo ? '<button class="link" data-act="undo">Desfazer</button>' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, kind === 'erro' ? 6000 : 4500);
}

/* ---------- Modais ---------- */
const modalStack = [];
function openModal(html, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${h(opts.title || '')}"><div class="modal-head"><h2>${h(opts.title || '')}</h2><button class="icon-btn" data-act="closeModal" aria-label="Fechar">${icon('x')}</button></div><div class="modal-body">${html}</div></div>`;
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) closeModal(); });
  $('#modals').appendChild(wrap);
  modalStack.push({ el: wrap, opts });
  document.body.classList.add('noscroll');
  setTimeout(() => { const f = wrap.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea'); if (f && window.innerWidth > 700) f.focus(); }, 30);
  return wrap;
}
function closeModal(keep) {
  if (keep) return;
  const m = modalStack.pop();
  if (m) m.el.remove();
  if (!modalStack.length) document.body.classList.remove('noscroll');
}
function closeAllModals() { while (modalStack.length) closeModal(); }
ACT.closeModal = () => closeModal();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) closeModal(); });

function confirmBox({ title, body, confirmLabel = 'Confirmar', danger = false, onConfirm, cancelLabel = 'Voltar' }) {
  const id = U.uid('cf');
  const el = openModal(`<div class="confirm-body">${body}</div><div class="actions"><button class="btn ghost" data-act="closeModal">${cancelLabel}</button><button class="btn ${danger ? 'danger' : 'primary'}" id="${id}">${h(confirmLabel)}</button></div>`, { title });
  el.querySelector('#' + id).addEventListener('click', () => { closeModal(); onConfirm(); });
}

/* ---------- Formulários ---------- */
// field: {k,label,type,options,req,help,when,placeholder,half,min,max,step,info(v),dynamic}
function fieldHTML(f, v, vals) {
  const id = 'f_' + f.k;
  const val = v ?? '';
  const req = f.req ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const help = f.help ? `<small class="help">${f.help}</small>` : '';
  const opts = typeof f.options === 'function' ? f.options(vals) : f.options || [];
  let input = '';
  switch (f.type) {
    case 'money': input = `<div class="money-in"><span>R$</span><input id="${id}" name="${f.k}" inputmode="decimal" autocomplete="off" value="${h(typeof val === 'number' ? U.moneyInput(val) : val)}" placeholder="${h(f.placeholder || '0,00')}"></div>`; break;
    case 'date': input = `<input id="${id}" name="${f.k}" type="date" value="${h(val)}">`; break;
    case 'month': input = `<input id="${id}" name="${f.k}" type="month" value="${h(val)}">`; break;
    case 'number': input = `<input id="${id}" name="${f.k}" type="number" inputmode="decimal" value="${h(val)}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}" placeholder="${h(f.placeholder || '')}">`; break;
    case 'select': input = `<select id="${id}" name="${f.k}">${opts.map(([o, l]) => `<option value="${h(o)}" ${String(o) === String(val) ? 'selected' : ''}>${h(l)}</option>`).join('')}</select>`; break;
    case 'textarea': input = `<textarea id="${id}" name="${f.k}" rows="2" placeholder="${h(f.placeholder || '')}">${h(val)}</textarea>`; break;
    case 'check': return `<div class="field check ${f.half ? 'half' : ''}" data-k="${f.k}"><label><input type="checkbox" id="${id}" name="${f.k}" ${val ? 'checked' : ''}> <span>${f.label}</span></label>${help}</div>`;
    case 'chips': input = `<div class="chips-in" role="radiogroup">${opts.map(([o, l]) => `<label class="chipopt"><input type="radio" name="${f.k}" value="${h(o)}" ${String(o) === String(val) ? 'checked' : ''}><span>${h(l)}</span></label>`).join('')}</div>`; break;
    case 'multi': { const set = new Set(val || []); input = `<div class="multi">${opts.map(([o, l]) => `<label class="multiopt"><input type="checkbox" data-multi="${f.k}" value="${h(o)}" ${set.has(o) ? 'checked' : ''}> <span>${h(l)}</span></label>`).join('') || '<p class="muted">Nada cadastrado ainda.</p>'}</div>`; break; }
    case 'info': return `<div class="field info ${f.half ? 'half' : ''}" data-k="${f.k}" data-info="1">${f.info ? f.info(vals) : ''}</div>`;
    default: input = `<input id="${id}" name="${f.k}" type="text" value="${h(val)}" placeholder="${h(f.placeholder || '')}" autocomplete="off">`;
  }
  return `<div class="field ${f.half ? 'half' : ''}" data-k="${f.k}"><label for="${id}">${f.label}${req}</label>${input}${help}<small class="err" hidden></small></div>`;
}
function readForm(form, fields) {
  const v = {};
  for (const f of fields) {
    if (f.type === 'info') continue;
    if (f.type === 'multi') { v[f.k] = $$(`[data-multi="${f.k}"]`, form).filter((x) => x.checked).map((x) => x.value); continue; }
    if (f.type === 'chips') { const c = form.querySelector(`input[name="${f.k}"]:checked`); v[f.k] = c ? c.value : null; continue; }
    const el = form.querySelector(`[name="${f.k}"]`);
    if (!el) continue;
    if (f.type === 'check') v[f.k] = el.checked;
    else if (f.type === 'money') { const raw = el.value.trim(); v[f.k] = raw === '' ? null : U.toCents(raw); if (raw !== '' && v[f.k] === null) v[f.k] = NaN; }
    else if (f.type === 'number') v[f.k] = el.value === '' ? null : Number(el.value);
    else v[f.k] = el.value === '' ? null : el.value;
  }
  return v;
}
function openForm({ title, fields, values = {}, submitLabel = 'Salvar', onSubmit, validate, extraButtons = [], wide = false, intro = '' }) {
  const vals = { ...values };
  const html = `<form class="form" novalidate>${intro ? `<div class="intro">${intro}</div>` : ''}<div class="grid-f">${fields.map((f) => fieldHTML(f, vals[f.k], vals)).join('')}</div><div class="form-err" hidden></div><div class="actions">${extraButtons.map((b) => `<button type="button" class="btn ${b.cls || 'ghost'}" data-xb="${b.id}">${b.label}</button>`).join('')}<span class="spacer"></span><button type="button" class="btn ghost" data-act="closeModal">Cancelar</button><button type="submit" class="btn primary">${h(submitLabel)}</button></div></form>`;
  const wrap = openModal(html, { title, wide });
  const form = wrap.querySelector('form');
  const refresh = () => {
    const cur = { ...vals, ...readForm(form, fields) };
    for (const f of fields) {
      const el = form.querySelector(`[data-k="${f.k}"]`);
      if (!el) continue;
      if (f.when) el.hidden = !f.when(cur);
      if (f.type === 'info' && f.info) el.innerHTML = f.info(cur);
      if (f.dynamic && f.type === 'select') {
        const sel = el.querySelector('select'); const keep = sel.value;
        const opts = f.options(cur);
        sel.innerHTML = opts.map(([o, l]) => `<option value="${h(o)}">${h(l)}</option>`).join('');
        sel.value = opts.some(([o]) => String(o) === keep) ? keep : (opts[0] ? opts[0][0] : '');
      }
    }
  };
  refresh();
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  for (const b of extraButtons) form.querySelector(`[data-xb="${b.id}"]`).addEventListener('click', () => b.onClick({ ...vals, ...readForm(form, fields) }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cur = { ...vals, ...readForm(form, fields) };
    const errs = {};
    for (const f of fields) {
      const el = form.querySelector(`[data-k="${f.k}"]`);
      if (el && el.hidden) continue;
      const x = cur[f.k];
      if (f.type === 'money' && Number.isNaN(x)) errs[f.k] = 'Valor inválido. Use números, por exemplo 1.250,90.';
      else if (f.req && (x === null || x === undefined || x === '' || (Array.isArray(x) && !x.length))) errs[f.k] = 'Campo obrigatório.';
      else if (f.type === 'number' && x !== null && ((f.min != null && x < f.min) || (f.max != null && x > f.max))) errs[f.k] = `Use um número entre ${f.min ?? '...'} e ${f.max ?? '...'}.`;
      else if (f.type === 'money' && x !== null && f.min != null && x < f.min) errs[f.k] = f.min > 0 ? 'Informe um valor maior que zero.' : 'O valor não pode ser negativo.';
    }
    if (validate && !Object.keys(errs).length) Object.assign(errs, validate(cur) || {});
    $$('.err', form).forEach((x) => { x.hidden = true; });
    const fe = form.querySelector('.form-err'); fe.hidden = true;
    if (Object.keys(errs).length) {
      for (const [k, m] of Object.entries(errs)) {
        const el = form.querySelector(`[data-k="${k}"] .err`);
        if (el) { el.textContent = m; el.hidden = false; } else { fe.textContent = m; fe.hidden = false; }
      }
      const firstErr = form.querySelector('.err:not([hidden])'); if (firstErr) firstErr.scrollIntoView({ block: 'center' });
      return;
    }
    for (const f of fields) { const el = form.querySelector(`[data-k="${f.k}"]`); if (el && el.hidden && f.type !== 'info') cur[f.k] = f.type === 'check' ? false : null; }
    onSubmit(cur);
  });
  return wrap;
}

/* ---------- Componentes ---------- */
function emptyState(text, btn) {
  return `<div class="empty">${icon('info')}<p>${text}</p>${btn || ''}</div>`;
}
function kpi(label, value, sub = '', cls = '') {
  return `<div class="kpi ${cls}"><span class="kpi-l">${label}</span><strong class="kpi-v">${value}</strong>${sub ? `<span class="kpi-s">${sub}</span>` : ''}</div>`;
}
function progressBar(p, label = '') {
  const v = p == null ? 0 : Math.max(0, Math.min(1, p));
  return `<div class="progress" role="progressbar" aria-valuenow="${Math.round(v * 100)}" aria-valuemin="0" aria-valuemax="100" aria-label="${h(label)}"><span style="width:${(v * 100).toFixed(1)}%"></span></div>`;
}
function partialBanner(reasons) {
  if (!reasons || !reasons.length) return '';
  return `<div class="banner partial">${icon('info')}<div><strong>Projeção parcial.</strong> ${h(reasons.join('; '))}. Os valores mostram só o que já foi cadastrado.</div></div>`;
}
function explain(k, summary, body) {
  const open = !!UI.expanded[k];
  return `<div class="explain"><button class="link exp-btn" data-act="toggle" data-k="${k}" aria-expanded="${open}">${icon(open ? 'up' : 'info')} ${summary}</button>${open ? `<div class="exp-body">${body}</div>` : ''}</div>`;
}

/* ---------- Gráficos (SVG) ---------- */
function lineChart(days, { height = 180, start } = {}) {
  if (!days || days.length < 2) return '<p class="muted">Sem dados suficientes para o gráfico.</p>';
  const W = 640, H = height, pl = 56, pr = 12, pt = 12, pb = 26;
  const ys = days.map((d) => d.bal);
  let min = Math.min(0, ...ys), max = Math.max(0, ...ys);
  if (max === min) max = min + 100;
  const pad = (max - min) * 0.08; min -= pad; max += pad;
  const x = (i) => pl + (i / (days.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const pts = days.map((d, i) => `${x(i).toFixed(1)},${y(d.bal).toFixed(1)}`).join(' ');
  const area = `${pl},${y(Math.max(min, 0)).toFixed(1)} ${pts} ${x(days.length - 1).toFixed(1)},${y(Math.max(min, 0)).toFixed(1)}`;
  const ticks = [min + pad, (min + max) / 2, max - pad].map((v) => `<g><line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${U.moneyShort(v)}</text></g>`).join('');
  const zero = min < 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" class="zero"/>` : '';
  const step = Math.max(1, Math.round(days.length / 5));
  const xl = days.map((d, i) => (i % step === 0 || i === days.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}" class="axis">${U.fmtDay(d.date)}</text>` : '').join('');
  const minI = ys.indexOf(Math.min(...ys));
  const neg = days.findIndex((d) => d.bal < 0);
  const negMark = neg >= 0 ? `<circle cx="${x(neg)}" cy="${y(days[neg].bal)}" r="4.5" class="dot-neg"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo projetado de ${U.fmtDate(days[0].date)} a ${U.fmtDate(days[days.length - 1].date)}. Menor saldo ${U.money(ys[minI])} em ${U.fmtDate(days[minI].date)}.">${ticks}${zero}<polygon points="${area}" class="area"/><polyline points="${pts}" class="line"/><circle cx="${x(minI)}" cy="${y(ys[minI])}" r="4" class="dot-min"/>${negMark}<circle cx="${x(days.length - 1)}" cy="${y(ys[ys.length - 1])}" r="4" class="dot-end"/>${xl}</svg>`;
}
function barsChart(rows, { height = 170 } = {}) {
  // rows: [{label, in, out}]
  if (!rows.length) return '<p class="muted">Sem dados no período.</p>';
  const W = 640, H = height, pl = 56, pr = 8, pt = 10, pb = 24;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.in, r.out)));
  const bw = (W - pl - pr) / rows.length;
  const y = (v) => pt + (1 - v / max) * (H - pt - pb);
  const bars = rows.map((r, i) => {
    const x0 = pl + i * bw + bw * 0.15, w = bw * 0.33;
    return `<rect x="${x0}" y="${y(r.in)}" width="${w}" height="${H - pb - y(r.in)}" class="bar-in" rx="3"><title>${r.label}: entradas ${U.money(r.in)}</title></rect><rect x="${x0 + w + bw * 0.04}" y="${y(r.out)}" width="${w}" height="${H - pb - y(r.out)}" class="bar-out" rx="3"><title>${r.label}: saídas ${U.money(r.out)}</title></rect><text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle" class="axis">${r.label}</text>`;
  }).join('');
  const ticks = [0, max / 2, max].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end" class="axis">${U.moneyShort(v)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas por mês">${ticks}${bars}</svg><div class="legend"><span><i class="sw sw-in"></i>Entradas</span><span><i class="sw sw-out"></i>Saídas</span></div>`;
}
function hbars(list, total) {
  if (!list.length) return '<p class="muted">Nenhum gasto no período.</p>';
  const max = Math.max(...list.map((x) => Math.max(x.value, x.limit || 0)), 1);
  return `<ul class="hbars">${list.map((x) => {
    const over = x.limit && x.value > x.limit;
    return `<li><div class="hb-top"><span>${h(x.label)}</span><strong>${money(x.value)}${total ? ` <small class="muted">${U.pct(x.value / total)}</small>` : ''}</strong></div><div class="hb-track"><span class="${over ? 'over' : ''}" style="width:${(x.value / max * 100).toFixed(1)}%"></span>${x.limit ? `<i class="hb-limit" style="left:${(x.limit / max * 100).toFixed(1)}%" title="Limite ${money(x.limit)}"></i>` : ''}</div>${x.limit ? `<small class="${over ? 'txt-bad' : 'muted'}">${over ? icon('warn') + ' ' : ''}Limite ${money(x.limit)}${over ? `, ${money(x.value - x.limit)} acima` : `, restam ${money(x.limit - x.value)}`}</small>` : ''}</li>`;
  }).join('')}</ul>`;
}

/* ---------- Eventos globais ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-chg]');
  if (!el) return;
  const fn = CHG[el.dataset.chg];
  if (fn) fn(el.value, el, e);
});
