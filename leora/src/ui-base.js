/* LEORA — base da interface: rotas, janelas de formulário, avisos, componentes. */
(function (L) {
  'use strict';
  const UI = L.UI = { rota: 'inicio', sub: {}, filtros: {}, modal: null, pilha: [], cache: { v: -1 } };
  const $ = s => document.querySelector(s);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  UI.esc = esc;

  // ---------- ícones (traço simples) ----------
  const IC = {
    inicio: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    produtos: '<circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="10" r="1"/><circle cx="14" cy="13.5" r="1"/><circle cx="10.5" cy="15" r=".8"/>',
    precos: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    compras: '<path d="M5 7h14l-1.5 12h-11z"/><path d="M9 7a3 3 0 016 0"/>',
    producao: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5h10v3"/><path d="M7 14h10"/>',
    vendas: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    financeiro: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="16" cy="15" r="1.3"/>',
    metas: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9"/>',
    relatorios: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    mais: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    venda: '<path d="M12 3v18M7 8h7.5a2.5 2.5 0 010 5H9a2.5 2.5 0 000 5h8"/>',
    fornada: '<rect x="3" y="5" width="18" height="15" rx="2"/><rect x="6" y="9" width="12" height="8" rx="1"/><path d="M7 7h1M10 7h1"/>',
    massa: '<path d="M4 15c0-4 3.5-7 8-7s8 3 8 7"/><path d="M3 15h18v3H3z"/>',
    compra: '<path d="M5 7h14l-1.5 12h-11z"/><path d="M12 11v5M9.5 13.5h5"/>',
    despesa: '<path d="M12 3v18"/><path d="M6 9l6-6 6 6"/>',
    perda: '<circle cx="12" cy="12" r="8"/><path d="M8 8l8 8M16 8l-8 8"/>',
  };
  UI.ic = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

  UI.SECOES = [
    { id: 'inicio', nome: 'Visão geral' },
    { id: 'vendas', nome: 'Vendas diárias' },
    { id: 'producao', nome: 'Produção e estoque' },
    { id: 'compras', nome: 'Compras e ingredientes' },
    { id: 'produtos', nome: 'Produtos e receitas' },
    { id: 'precos', nome: 'Precificação e promoções' },
    { id: 'financeiro', nome: 'Financeiro' },
    { id: 'metas', nome: 'Metas e calendário' },
    { id: 'relatorios', nome: 'Relatórios' },
    { id: 'config', nome: 'Configurações e backup' },
  ];
  UI.views = {};

  // ---------- dados derivados (recalcula só quando os dados mudam) ----------
  UI.D = () => L.Store.D;
  UI.S = () => {
    if (UI.cache.v !== L.Store.versao || UI.cache.D !== L.Store.D) {
      UI.cache = { v: L.Store.versao, D: L.Store.D, S: L.estado(L.Store.D) };
    }
    return UI.cache.S;
  };
  UI.hoje = () => L.hoje();

  // ---------- render ----------
  UI.render = function () {
    const app = $('#app');
    const st = L.Store;
    const D = st.D;
    const rota = UI.rota;
    const nav = UI.SECOES.map(s => `<a href="#${s.id}" data-nav="${s.id}" ${s.id === rota ? 'aria-current="page"' : ''}>${UI.ic(s.id)}<span>${s.nome}</span></a>`).join('');
    const marca = D.logo ? `<img src="${esc(D.logo)}" alt="Logo LEORA">` : '';
    const chip = UI.chipModo();
    let corpo = '';
    if (st.modo === 'carregando') corpo = `<div class="card vazio"><strong>Carregando seus registros…</strong><span>Conectando ao armazenamento do Claude.</span></div>`;
    else {
      UI.pgAtualizar = null;
      try { corpo = (UI.views[rota] || UI.views.inicio)(); }
      catch (e) { console.error(e); corpo = `<div class="nota erro">Algo deu errado ao montar esta tela: ${esc(e.message)}. Seus dados não foram alterados.</div>`; }
    }
    const tabs = [['inicio', 'Início'], ['vendas', 'Vender'], ['producao', 'Produzir'], ['financeiro', 'Financeiro'], ['mais', 'Mais']];
    const tabbar = tabs.map(([id, n]) => id === 'mais'
      ? `<button class="tab-b" data-a="menuMais" ${['compras', 'produtos', 'precos', 'metas', 'relatorios', 'config'].includes(rota) ? 'aria-current="page"' : ''}>${UI.ic('mais')}<span>${n}</span></button>`
      : `<a class="tab-b" href="#${id}" data-nav="${id}" ${id === rota ? 'aria-current="page"' : ''}>${UI.ic(id)}<span>${n}</span></a>`).join('');
    const demo = st.modo === 'demo' ? `<div class="faixa-demo">Modo demonstração — dados de exemplo, nada é salvo e seus registros reais não aparecem aqui.<button data-a="sairDemo">Sair</button></div>` : '';
    const scroll = window.scrollY;
    app.innerHTML = `${demo}<div class="app">
      <aside class="side"><div class="marca">${marca}<div><div class="wm">LEORA</div><div class="sub">Confeitaria Artesanal</div></div></div>
        <nav class="nav" aria-label="Seções">${nav}</nav>
        <div class="rodape">${chip}<span>${esc(L.fmtBR(L.hoje()))} · horário de Brasília</span></div></aside>
      <div class="main"><div class="bar-mob"><div class="marca">${marca}<div class="wm">LEORA</div></div>${chip}</div>
        <div class="wrap">${st.erroCarga ? `<div class="nota erro">${esc(st.erroCarga)}</div>` : ''}${corpo}</div></div>
      <nav class="tabbar" aria-label="Atalhos">${tabbar}</nav></div>`;
    window.scrollTo(0, scroll);
    if (UI.modal) UI.renderModal();
  };
  UI.chipModo = function () {
    const m = L.Store.modo;
    const t = { nuvem: 'Salvo na sua conta Claude', local: 'Salvo só neste navegador', memoria: 'Sem armazenamento: exporte backup', demo: 'Demonstração', carregando: 'Carregando…' }[m] || m;
    return `<span class="chip-modo ${m}" title="${esc(t)}"><span class="dot"></span>${esc(t)}</span>`;
  };
  UI.ir = function (rota, sub) {
    UI.rota = rota; if (sub) UI.sub[rota] = sub;
    try { history.replaceState(null, '', '#' + rota); } catch (e) { /* sem histórico */ }
    UI.render(); window.scrollTo(0, 0);
  };

  // ---------- componentes ----------
  UI.subtabs = function (rota, abas) {
    const atual = UI.sub[rota] || abas[0][0];
    return `<div class="subtabs" role="tablist">${abas.map(([id, n]) => `<button role="tab" aria-selected="${id === atual}" data-a="sub" data-r="${rota}" data-s="${id}">${n}</button>`).join('')}</div>`;
  };
  UI.subAtual = (rota, padrao) => UI.sub[rota] || padrao;
  UI.vazio = (titulo, texto, botao) => `<div class="vazio"><strong>${esc(titulo)}</strong>${texto ? `<span>${texto}</span>` : ''}${botao || ''}</div>`;
  UI.tabela = function (cab, linhas, opts) {
    opts = opts || {};
    if (!linhas.length) return opts.vazio || UI.vazio('Nada por aqui ainda.');
    const th = cab.map(c => `<th class="${c.n ? 'n' : ''}">${esc(c.t !== undefined ? c.t : c)}</th>`).join('');
    const tr = linhas.map(l => `<tr class="${l._cls || ''}">${(l.c || l).map((v, i) => `<td class="${cab[i] && cab[i].n ? 'n' : ''}">${v === null || v === undefined ? '' : v}</td>`).join('')}</tr>`).join('');
    return `<div class="tbl-w"><table>${opts.caption ? `<caption class="muted small">${esc(opts.caption)}</caption>` : ''}<thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${opts.rodape || ''}</table></div>`;
  };
  UI.pill = (t, cls) => `<span class="pill ${cls || ''}">${esc(t)}</span>`;
  UI.btn = (t, a, attrs, cls) => `<button class="btn ${cls || ''}" data-a="${a}" ${attrs || ''}>${t}</button>`;
  UI.kpi = (rot, v, d) => `<div class="card kpi"><div class="eyebrow">${rot}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
  UI.alertasHTML = function (lista) {
    if (!lista.length) return UI.vazio('Nenhum alerta agora.', 'Contas, estoque, validade, metas e margens estão em dia.');
    const ic = { alto: '!', medio: '•', ok: '✓' };
    return `<div class="stack">${lista.map(a => `<div class="alerta ${a.nivel}"><span class="ic">${ic[a.nivel]}</span><span>${esc(a.txt)}</span></div>`).join('')}</div>`;
  };
  UI.barra = (frac, ok) => `<div class="barra ${ok ? 'ok' : ''}"><span style="width:${Math.max(0, Math.min(100, (frac || 0) * 100)).toFixed(1)}%"></span></div>`;
  UI.dl = pares => `<dl class="kv">${pares.map(p => p ? `<dt class="${p[2] || ''}">${p[0]}</dt><dd class="${p[2] || ''}">${p[1]}</dd>` : '').join('')}</dl>`;

  // Opções de select
  UI.opts = function (lista, sel, vazio) {
    return (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : '') + lista.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(sel) ? 'selected' : ''}>${esc(o.t)}</option>`).join('');
  };
  UI.optsVariantes = (sel, vazio, incluirArq) => UI.opts(L.ativos(UI.D().variantes).concat(incluirArq ? Object.values(UI.D().variantes).filter(v => v.arquivado) : []).filter(v => incluirArq || !(UI.D().produtos[v.produtoId] || {}).arquivado).map(v => ({ v: v.id, t: L.nomeVariante(UI.D(), v.id) })).sort((a, b) => a.t.localeCompare(b.t)), sel, vazio);
  UI.optsInsumos = (sel, vazio, tipo) => UI.opts(L.ativos(UI.D().insumos).filter(i => !tipo || i.tipo === tipo).map(i => ({ v: i.id, t: i.nome + ' (' + i.unidade + ')' })).sort((a, b) => a.t.localeCompare(b.t)), sel, vazio);
  UI.optsKits = (sel, uso, vazio) => UI.opts(L.ativos(UI.D().kits).filter(k => !uso || k.uso === uso).map(k => ({ v: k.id, t: k.nome })), sel, vazio === undefined ? 'Nenhum' : vazio);
  UI.optsCanais = (sel, vazio) => UI.opts(L.ativos(UI.D().canais).map(c => ({ v: c.id, t: c.nome })), sel, vazio);
  UI.optsFormas = (sel, vazio) => UI.opts(L.ativos(UI.D().formas).map(c => ({ v: c.id, t: c.nome })), sel, vazio);
  UI.optsFornos = (sel, vazio) => UI.opts(L.ativos(UI.D().fornos).map(c => ({ v: c.id, t: c.nome + (c.tipo === 'gas' ? ' (gás)' : ' (elétrico)') })), sel, vazio);

  // ---------- campos ligados ao estado do formulário ----------
  function getPath(o, p) { return p.split('.').reduce((a, k) => (a === null || a === undefined ? undefined : a[k]), o); }
  function setPath(o, p, v) { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] === null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; }
  UI.getPath = getPath; UI.setPath = setPath;
  let fid = 0;
  /** Campo de texto/número/data. tipo: 'text' | 'num' | 'date' | 'month' | 'area'. */
  UI.campo = function (st, path, rotulo, opts) {
    opts = opts || {};
    const v = getPath(st, path);
    const id = 'f' + path.replace(/[^\w]/g, '_') + (opts.idx || '');
    fid++;
    const val = v === null || v === undefined ? '' : (typeof v === 'number' ? String(v).replace('.', ',') : v);
    let inp;
    if (opts.tipo === 'area') inp = `<textarea id="${id}" data-b="${path}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''}>${esc(val)}</textarea>`;
    else {
      const t = opts.tipo === 'date' ? 'date' : opts.tipo === 'month' ? 'month' : 'text';
      const im = opts.tipo === 'num' ? 'inputmode="decimal" autocomplete="off"' : opts.tipo === 'int' ? 'inputmode="numeric" autocomplete="off"' : '';
      inp = `<input type="${t}" id="${id}" data-b="${path}" value="${esc(val)}" ${im} ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.ro ? 'readonly' : ''} ${opts.re ? 'data-re="1"' : ''}>`;
    }
    return `<label class="f ${opts.cls || ''}" for="${id}"><span>${rotulo}</span>${inp}${opts.ajuda ? `<small>${opts.ajuda}</small>` : ''}</label>`;
  };
  UI.sel = function (st, path, rotulo, optsHtml, opts) {
    opts = opts || {};
    const id = 's' + path.replace(/[^\w]/g, '_');
    return `<label class="f ${opts.cls || ''}" for="${id}"><span>${rotulo}</span><select id="${id}" data-b="${path}" data-re="1">${optsHtml}</select>${opts.ajuda ? `<small>${opts.ajuda}</small>` : ''}</label>`;
  };
  UI.chk = function (st, path, rotulo, ajuda) {
    const id = 'c' + path.replace(/[^\w]/g, '_');
    return `<label class="chk" for="${id}"><input type="checkbox" id="${id}" data-b="${path}" data-re="1" ${getPath(st, path) ? 'checked' : ''}><span>${rotulo}${ajuda ? `<br><small class="muted">${ajuda}</small>` : ''}</span></label>`;
  };
  UI.segmento = function (st, path, opcoes) {
    const v = getPath(st, path);
    return `<div class="seg" role="group">${opcoes.map(([val, t]) => `<button type="button" data-fa="__set" data-p="${path}" data-v="${esc(val)}" aria-pressed="${String(v) === String(val)}">${t}</button>`).join('')}</div>`;
  };

  // ---------- janela de formulário ----------
  /** def: { titulo, largura, corpo(st) → html, previa(st) → html, acoes: {nome(st, ds)}, salvar(st) → Promise, rotuloSalvar, extraRodape(st) } */
  UI.abrir = function (def, st) {
    if (UI.modal) UI.pilha.push(UI.modal);
    UI.modal = { def, st: st || {}, erro: null, salvando: false };
    UI.renderModal(true);
  };
  UI.fechar = function () {
    UI.modal = UI.pilha.pop() || null;
    const m = $('#modal'); if (!UI.modal && m) m.innerHTML = '';
    if (UI.modal) UI.renderModal();
    else UI.render();
  };
  UI.renderModal = function (topo) {
    const m = UI.modal; const host = $('#modal');
    if (!m) { host.innerHTML = ''; return; }
    const corpoAnt = host.querySelector('.modal-b');
    const sc = corpoAnt && !topo ? corpoAnt.scrollTop : 0;
    const ativo = document.activeElement && document.activeElement.id;
    let corpo;
    try { corpo = m.def.corpo(m.st); } catch (e) { console.error(e); corpo = `<div class="nota erro">Erro ao montar o formulário: ${esc(e.message)}</div>`; }
    const previa = m.def.previa ? `<div data-previa>${safePrevia(m)}</div>` : '';
    host.innerHTML = `<div class="modal-fundo" data-fundo="1"><div class="modal ${m.def.largura || ''}" role="dialog" aria-modal="true" aria-label="${esc(m.def.titulo)}">
      <div class="modal-h"><h2>${esc(m.def.titulo)}</h2><button class="x" data-a="fecharModal" aria-label="Fechar">×</button></div>
      <form class="modal-b" autocomplete="off" onsubmit="return false">${corpo}${previa}</form>
      <div class="modal-f">${m.erro ? `<div class="erro-f" role="alert">${esc(m.erro)}</div>` : ''}${m.def.extraRodape ? m.def.extraRodape(m.st) : ''}
        <button class="btn" data-a="fecharModal">${m.def.salvar ? 'Cancelar' : 'Fechar'}</button>
        ${m.def.salvar ? `<button class="btn pri" data-a="salvarModal" ${m.salvando ? 'disabled' : ''}>${m.salvando ? 'Salvando…' : esc(m.def.rotuloSalvar || 'Salvar')}</button>` : ''}</div></div></div>`;
    const b = host.querySelector('.modal-b'); if (b) b.scrollTop = sc;
    if (ativo) { const el = document.getElementById(ativo); if (el && host.contains(el)) { try { el.focus({ preventScroll: true }); } catch (e) { /* ok */ } } }
  };
  function safePrevia(m) { try { return m.def.previa(m.st); } catch (e) { console.error(e); return `<div class="nota erro">${esc(e.message)}</div>`; } }
  UI.atualizarPrevia = function () {
    const m = UI.modal; if (!m || !m.def.previa) return;
    const el = document.querySelector('#modal [data-previa]'); if (el) el.innerHTML = safePrevia(m);
  };
  UI.salvarModal = async function () {
    const m = UI.modal; if (!m || m.salvando) return;
    m.salvando = true; m.erro = null; UI.renderModal();
    try {
      const r = await m.def.salvar(m.st);
      m.salvando = false;
      if (r === false) { UI.renderModal(); return; }
      UI.fechar();
      if (typeof r === 'string') UI.toast(r);
      if (m.def.depois) m.def.depois(m.st);
    } catch (e) {
      m.salvando = false; m.erro = e.message || String(e);
      if (UI.modal === m) UI.renderModal();
    }
  };
  UI.falha = function (msg) { const e = new Error(msg); throw e; };

  // confirmação dentro da página (o visualizador não exibe confirm())
  UI.confirmar = function (o) {
    return new Promise(res => {
      UI.abrir({
        titulo: o.titulo || 'Confirmar', largura: 'estreita',
        corpo: () => `<p>${o.texto}</p>${o.extra || ''}`,
        rotuloSalvar: o.botao || 'Confirmar',
        salvar: async () => { res(true); },
        aoFechar: () => res(false),
      }, {});
      UI.modal._res = res;
    });
  };

  let toastT;
  UI.toast = function (msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200);
  };

  // ---------- downloads (capacidade do Artifact; fora dele, link comum) ----------
  UI.baixar = async function (nome, conteudo) {
    let dl = null;
    try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: nome, data: conteudo }); UI.toast('Arquivo entregue para salvar: ' + nome); return true; }
      catch (e) {
        if (e && e.code === 'declined') { UI.toast('Download cancelado.'); return false; }
        if (e && e.code === 'rate_limited') { UI.toast('Já há um download aguardando confirmação.'); return false; }
        UI.toast('Não foi possível baixar aqui: ' + ((e && e.message) || e)); return false;
      }
    }
    try {
      const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      UI.toast('Download iniciado: ' + nome);
      return true;
    } catch (e) { UI.toast('Este ambiente não permite baixar arquivos.'); return false; }
  };

  // ---------- eventos ----------
  UI.acoes = {};
  function lerValor(el) {
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }
  document.addEventListener('input', ev => {
    const el = ev.target; if (!el.dataset || !el.dataset.b) return;
    const m = UI.modal;
    if (m && el.closest('#modal')) { setPath(m.st, el.dataset.b, lerValor(el)); if (!el.dataset.re || el.tagName === 'INPUT') UI.atualizarPrevia(); return; } // selects re-renderizam no 'change'
    if (el.closest('#app') && UI.paginaInput) UI.paginaInput(el);
  });
  document.addEventListener('change', ev => {
    const el = ev.target; if (!el.dataset) return;
    const m = UI.modal;
    if (el.dataset.b && m && el.closest('#modal')) {
      setPath(m.st, el.dataset.b, lerValor(el));
      if (el.dataset.re) { if (m.def.aoMudar) m.def.aoMudar(m.st, el.dataset.b); UI.renderModal(); } else UI.atualizarPrevia();
      return;
    }
    if (el.dataset.b && el.closest('#app') && UI.paginaChange) UI.paginaChange(el);
    if (el.dataset.arquivo && UI.acoes[el.dataset.arquivo]) UI.acoes[el.dataset.arquivo](el);
  });
  document.addEventListener('click', ev => {
    const nav = ev.target.closest('[data-nav]');
    if (nav) { ev.preventDefault(); UI.ir(nav.dataset.nav); return; }
    const fa = ev.target.closest('[data-fa]');
    if (fa && UI.modal) {
      ev.preventDefault();
      const m = UI.modal; const n = fa.dataset.fa;
      if (n === '__set') { setPath(m.st, fa.dataset.p, fa.dataset.v); if (m.def.aoMudar) m.def.aoMudar(m.st, fa.dataset.p); }
      else if (m.def.acoes && m.def.acoes[n]) m.def.acoes[n](m.st, fa.dataset, fa);
      UI.renderModal();
      return;
    }
    const a = ev.target.closest('[data-a]');
    if (a) {
      ev.preventDefault();
      const n = a.dataset.a;
      if (n === 'fecharModal') { const m = UI.modal; if (m && m.def.aoFechar) m.def.aoFechar(); UI.fechar(); return; }
      if (n === 'salvarModal') { UI.salvarModal(); return; }
      if (n === 'sub') { UI.sub[a.dataset.r] = a.dataset.s; UI.render(); return; }
      if (UI.acoes[n]) UI.acoes[n](a.dataset, a);
      return;
    }
    if (ev.target.dataset && ev.target.dataset.fundo && UI.modal && !UI.modal.def.salvar) UI.fechar();
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && UI.modal && !UI.modal.salvando) { const m = UI.modal; if (m.def.aoFechar) m.def.aoFechar(); UI.fechar(); }
  });

  UI.acoes.sairDemo = () => { L.Store.sairDemo(); UI.toast('Você voltou aos seus registros.'); };
  UI.acoes.menuMais = () => {
    UI.abrir({
      titulo: 'Mais seções', largura: 'estreita',
      corpo: () => `<div class="stack">${UI.SECOES.filter(s => !['inicio', 'vendas', 'producao', 'financeiro'].includes(s.id)).map(s => `<button class="btn" style="justify-content:flex-start" data-a="irMenu" data-r="${s.id}">${UI.ic(s.id)}${s.nome}</button>`).join('')}</div>`,
    }, {});
  };
  UI.acoes.irMenu = ds => { UI.modal = null; UI.pilha = []; document.getElementById('modal').innerHTML = ''; UI.ir(ds.r); };
  UI.acoes.ir = ds => UI.ir(ds.r, ds.s);

  /** Registra (ou substitui) uma operação de forma consistente, com histórico de versões. */
  UI.gravarOp = async function (id, op, motivoEdicao) {
    const D = UI.D();
    const antigo = D.ops[id];
    const agora = L.agoraISO();
    const novo = Object.assign({}, op, {
      id, criadoEm: antigo ? antigo.criadoEm : agora, part: antigo ? antigo.part : undefined,
      status: antigo ? antigo.status : 'ativo', alteradoEm: agora,
      historico: antigo ? (antigo.historico || []).concat([{ em: agora, acao: motivoEdicao || 'editado', antes: resumoOp(antigo) }]).slice(-12) : [{ em: agora, acao: 'registrado' }],
    });
    // valida o estoque com a operação nova no lugar da antiga
    const S = L.estado(D, { excluirId: id, incluir: novo });
    if (S.negativos.length) throw new Error('A alteração deixaria o estoque negativo: ' + descreverNegativos(D, S) + '. Corrija ou registre um ajuste documentado.');
    return L.Store.salvar('ops', novo);
  };
  function resumoOp(op) { const o = L.clone(op); delete o.historico; delete o.mov; return o; }
  function descreverNegativos(D, S) {
    return S.negativos.slice(0, 3).map(n => n.alvo === 'ins' ? (D.insumos[n.id] || {}).nome : (n.alvo === 'massa' ? 'massa ' : 'assado ') + L.nomeVariante(D, (S.lotes[n.id] || {}).varianteId)).join(', ');
  }
  UI.descreverNegativos = descreverNegativos;
  UI.cancelarOp = async function (id) {
    const D = UI.D(); const op = D.ops[id]; if (!op) return;
    const S = L.estado(D, { excluirId: id });
    if (S.negativos.length) {
      UI.abrir({ titulo: 'Não dá para cancelar', largura: 'estreita', corpo: () => `<p>Este registro já foi usado depois (por exemplo, a massa já foi assada ou o assado já foi vendido). Cancelá-lo deixaria negativo: <strong>${esc(descreverNegativos(D, S))}</strong>.</p><p class="muted small">Cancele primeiro os registros que dependem dele, do mais recente para o mais antigo, ou registre um ajuste documentado.</p>` }, {});
      return;
    }
    const ok = await UI.confirmar({ titulo: 'Cancelar registro', texto: 'O registro continua no histórico como cancelado e deixa de contar no estoque, no caixa e nos relatórios. Confirmar?', botao: 'Cancelar registro' });
    if (!ok) return;
    const agora = L.agoraISO();
    const novo = Object.assign({}, L.clone(op), { status: 'cancelado', canceladoEm: agora, historico: (op.historico || []).concat([{ em: agora, acao: 'cancelado' }]).slice(-12) });
    try { await L.Store.salvar('ops', novo); UI.toast('Registro cancelado.'); } catch (e) { UI.toast(e.message); }
  };
  UI.reativarOp = async function (id) {
    const D = UI.D(); const op = D.ops[id]; if (!op) return;
    const novo = Object.assign({}, L.clone(op), { status: 'ativo' });
    const S = L.estado(D, { excluirId: id, incluir: novo });
    if (S.negativos.length) { UI.toast('Não dá para reativar: o estoque ficaria negativo (' + descreverNegativos(D, S) + ').'); return; }
    novo.historico = (op.historico || []).concat([{ em: L.agoraISO(), acao: 'reativado' }]).slice(-12);
    try { await L.Store.salvar('ops', novo); UI.toast('Registro reativado.'); } catch (e) { UI.toast(e.message); }
  };
  UI.acoes.cancelarOp = ds => UI.cancelarOp(ds.id);
  UI.acoes.reativarOp = ds => UI.reativarOp(ds.id);

  /** Salva cadastro (insumo, produto etc.) */
  UI.salvarCad = async function (col, obj) {
    obj.alteradoEm = L.agoraISO(); if (!obj.criadoEm) obj.criadoEm = obj.alteradoEm;
    return L.Store.salvar(col, obj);
  };
  UI.acoes.arquivar = async ds => {
    const D = UI.D(); const o = D[ds.col][ds.id]; if (!o) return;
    const novo = Object.assign(L.clone(o), { arquivado: !o.arquivado });
    try { await UI.salvarCad(ds.col, novo); UI.toast(novo.arquivado ? 'Arquivado. Continua no histórico.' : 'Reativado.'); } catch (e) { UI.toast(e.message); }
  };
})(globalThis.L = globalThis.L || {});
