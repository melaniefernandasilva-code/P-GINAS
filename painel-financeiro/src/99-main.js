/* Inicialização. */
function buildShell() {
  const nav = NAV.map(([r, l, ic]) => `<button class="nav-item" data-act="go" data-route="${r}">${icon(ic)}<span>${l}</span>${r === 'diagnostico' ? '<b class="alert-count" hidden></b>' : ''}</button>`).join('');
  document.getElementById('app').innerHTML = `
  <header class="top"><div class="brand"><span class="logo" aria-hidden="true">M</span><span class="brand-t">Finanças da Mel</span></div><div id="save-status" class="save" role="status" aria-live="polite"></div></header>
  <div id="demo-banner" class="demo-banner" hidden>${icon('flask')}<span>Modo demonstração: dados fictícios, nada é salvo.</span><button class="link" data-act="demoOff">Sair</button></div>
  <div class="layout"><nav class="side" aria-label="Módulos">${nav}</nav><main id="main" tabindex="-1"><div class="loading">Carregando seus dados…</div></main></div>
  <nav class="bottom" aria-label="Atalhos"><button class="nav-item" data-act="go" data-route="inicio">${icon('home')}<span>Início</span></button><button class="nav-item" data-act="go" data-route="calendario">${icon('calendar')}<span>Calendário</span></button><button class="fab" data-act="quickAdd" aria-label="Lançar">${icon('plus')}</button><button class="nav-item" data-act="go" data-route="diagnostico">${icon('pulse')}<span>Alertas</span><b class="alert-count" hidden></b></button><button class="nav-item" data-act="drawer">${icon('menu')}<span>Menu</span></button></nav>
  <div id="drawer" class="drawer" hidden><div class="drawer-in"><div class="modal-head"><h2>Módulos</h2><button class="icon-btn" data-act="closeDrawer" aria-label="Fechar">${icon('x')}</button></div>${nav}</div></div>
  <div id="modals"></div><div id="toast" class="toast" role="status" aria-live="polite"></div>`;
  $('#drawer').addEventListener('mousedown', (e) => { if (e.target.id === 'drawer') closeDrawer(); });
}

async function boot() {
  buildShell();
  STORE.subscribe(() => renderStatus());
  try { const r = JSON.parse(localStorage.getItem('painel-fin-mel-route') || 'null'); if (r && VIEWS[r.route]) { UI.route = r.route; UI.tab = r.tab || {}; } } catch (e) {}
  const res = await STORE.init(async (meta) => {
    if (UI.demo) return;
    if (STORE.getStatus().state === 'salvando') return;
    try {
      const st = await STORE.reloadRemote();
      if (st && (st.meta?.rev || 0) > (S.meta.rev || 0)) { S = M.migrate(st); closeAllModals(); render(); toast('Dados atualizados com alterações feitas em outro aparelho.'); }
    } catch (e) { /* mantém o estado atual */ }
  });
  S = M.migrate(res.state || M.defaultState());
  if (res.needPush) STORE.save(S, true);
  UI.ready = true;
  render();
  if (res.notice) toast(res.notice, res.source === 'local' && STORE.getMode() !== 'nuvem' ? 'erro' : 'ok');
  let lastDay = E.today();
  setInterval(() => { const t = U.today(); if (t !== lastDay) { lastDay = t; render(); } }, 60000);
}
boot();
