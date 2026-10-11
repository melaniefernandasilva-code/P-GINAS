/* LEORA — inicialização. */
(function (L) {
  'use strict';
  const UI = L.UI;
  const h = (location.hash || '').replace('#', '');
  if (UI.SECOES.some(s => s.id === h)) UI.rota = h;
  window.addEventListener('hashchange', () => { const r = location.hash.replace('#', ''); if (UI.SECOES.some(s => s.id === r) && r !== UI.rota) UI.ir(r); });
  UI.render();
  L.Store.iniciar(() => UI.render());
})(globalThis.L = globalThis.L || {});
