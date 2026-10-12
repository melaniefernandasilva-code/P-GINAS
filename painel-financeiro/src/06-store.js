/* Persistência.
   1) Armazenamento do Artifact (capacidade db), na área privada do usuário:
      data/users/<id>/fin_meta e fin_c0..fin_cN (o estado em blocos de texto).
      Acompanha a conta Claude, então funciona no computador e no celular.
   2) Cópia local no navegador (localStorage) como reserva e para não perder
      alterações se a gravação falhar. */
const STORE = (() => {
  const LS_KEY = 'painel-fin-mel-v1';
  const CHUNK = 80000;
  let db = null, uid = null, mode = 'carregando'; // 'nuvem' | 'local' | 'carregando'
  let status = { state: 'idle', msg: '' };
  let listeners = [];
  let timer = null, saving = false, pendingAgain = false;
  let lastChunks = [];
  let serverRev = 0;
  let unsub = null;
  let onRemote = null;

  const setStatus = (state, msg) => { status = { state, msg }; listeners.forEach((f) => f(status, mode)); };
  const subscribe = (f) => { listeners.push(f); };

  function readLocal() {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeLocal(st, dirty) {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ dirty, savedAt: Date.now(), state: st })); return true; } catch (e) { return false; }
  }

  async function readCloud() {
    const meta = await db.doc(`data/users/${uid}/fin_meta`).get();
    if (!meta.exists) return null;
    const m = meta.data();
    const parts = [];
    for (let i = 0; i < m.n; i++) {
      const d = await db.doc(`data/users/${uid}/fin_c${i}`).get();
      if (!d.exists) throw new Error('bloco ausente');
      parts.push(d.data().s);
    }
    const json = parts.join('');
    if (U.hash(json) !== m.hash) throw new Error('blocos inconsistentes');
    lastChunks = parts;
    serverRev = m.rev || 0;
    return { state: JSON.parse(json), rev: m.rev, savedAt: m.savedAt };
  }

  async function writeCloud(st) {
    const json = JSON.stringify(st);
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
    if (!parts.length) parts.push('');
    for (let i = 0; i < parts.length; i++) {
      if (lastChunks[i] === parts[i]) continue;
      await db.doc(`data/users/${uid}/fin_c${i}`).set({ s: parts[i] });
    }
    await db.doc(`data/users/${uid}/fin_meta`).set({ n: parts.length, hash: U.hash(json), rev: st.meta.rev, savedAt: new Date().toISOString(), len: json.length });
    lastChunks = parts;
    serverRev = st.meta.rev;
  }

  // Carrega o estado. Retorna {state, source, notice}
  async function init(remoteHandler) {
    onRemote = remoteHandler;
    const local = readLocal();
    for (let i = 0; i < 20 && !(typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function'); i++) await new Promise((r) => setTimeout(r, 100));
    let claudeOk = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function';
    if (claudeOk) {
      try {
        const [d, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        db = d;
        uid = user ? await user.id() : null;
      } catch (e) { db = null; }
    }
    if (!db || !uid) {
      mode = 'local';
      setStatus(local ? 'ok' : 'idle', 'Salvo só neste navegador');
      return { state: local ? local.state : null, source: 'local', notice: 'O armazenamento do Claude não está disponível nesta visualização. Os dados ficam só neste navegador: exporte o backup com frequência.' };
    }
    mode = 'nuvem';
    try {
      const cloud = await readCloud();
      let state = null, notice = null, needPush = false;
      if (cloud && local && local.dirty && (local.state?.meta?.rev || 0) > (cloud.rev || 0)) {
        state = local.state; needPush = true; notice = 'Havia alterações salvas só neste navegador. Elas foram enviadas ao armazenamento do Claude.';
      } else if (cloud) state = cloud.state;
      else if (local && local.state) { state = local.state; needPush = true; notice = 'Seus dados locais foram copiados para o armazenamento do Claude.'; }
      if (state) writeLocal(state, needPush);
      setStatus('ok', 'Salvo no Claude');
      watch();
      return { state, source: cloud ? 'nuvem' : 'local', notice, needPush };
    } catch (e) {
      setStatus('erro', 'Não consegui ler os dados do Claude');
      return { state: local ? local.state : null, source: 'local', notice: 'Não consegui ler os dados salvos no Claude agora. Mostrando a cópia deste navegador; as alterações serão enviadas quando a conexão voltar.' };
    }
  }

  function watch() {
    if (!db || unsub) return;
    try {
      unsub = db.doc(`data/users/${uid}/fin_meta`).onSnapshot((snap) => {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        const m = snap.data();
        if ((m.rev || 0) > serverRev && !saving && onRemote) onRemote(m);
      }, () => { unsub = null; });
    } catch (e) { /* sem acompanhamento ao vivo */ }
  }
  async function reloadRemote() {
    const cloud = await readCloud();
    if (cloud) writeLocal(cloud.state, false);
    return cloud ? cloud.state : null;
  }

  function save(st, immediate = false) {
    const okLocal = writeLocal(st, true);
    if (mode !== 'nuvem') { setStatus(okLocal ? 'ok' : 'erro', okLocal ? 'Salvo só neste navegador' : 'Não consegui salvar neste navegador. Exporte o backup.'); return; }
    setStatus('salvando', 'Salvando…');
    clearTimeout(timer);
    timer = setTimeout(() => flush(st), immediate ? 0 : 700);
  }
  async function flush(st) {
    if (saving) { pendingAgain = true; return; }
    saving = true;
    try {
      await writeCloud(st);
      writeLocal(st, false);
      setStatus('ok', 'Salvo no Claude');
    } catch (e) {
      const code = e && e.code;
      let msg = 'Falha ao salvar no Claude. As alterações estão guardadas neste navegador.';
      if (code === 'quota_exceeded') msg = 'O espaço de armazenamento acabou. Exporte o backup e arquive registros antigos.';
      if (code === 'invalid_argument') msg = 'Sem permissão para salvar aqui. As alterações estão guardadas neste navegador.';
      setStatus('erro', msg);
    }
    saving = false;
    if (pendingAgain) { pendingAgain = false; flush(st); }
  }
  const retry = (st) => flush(st);
  const getMode = () => mode;
  const getStatus = () => status;

  return { init, save, retry, subscribe, getMode, getStatus, reloadRemote, readLocal };
})();
