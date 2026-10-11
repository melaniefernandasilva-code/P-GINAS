/* LEORA — persistência.
 * 1) Nuvem: banco do Artifact (capacidade `db`), sincroniza entre aparelhos da mesma conta.
 * 2) Local: localStorage, quando o arquivo é aberto fora do Claude (fica só neste navegador).
 * 3) Memória: quando nada disso existe (avisa que nada será guardado).
 * 4) Demonstração: dados de exemplo só em memória, separados dos reais.
 */
(function (L) {
  'use strict';
  const CHAVE_LOCAL = 'leora-dados-v1';
  const COLS = L.COLECOES;

  const Store = {
    modo: 'carregando',
    D: L.vazio(),
    versao: 0,
    erroCarga: null,
    _db: null, _subs: [], _parts: [], _onChange: null, _real: null, _timer: null,
  };

  function particao(criadoEm) {
    const d = new Date(criadoEm || Date.now());
    const y = d.getUTCFullYear(); const q = Math.floor(d.getUTCMonth() / 3) + 1;
    return 'ops_' + y + '_' + q;
  }
  function avisar() {
    Store.versao++;
    clearTimeout(Store._timer);
    Store._timer = setTimeout(() => Store._onChange && Store._onChange(), 30);
  }
  function limpo(o) { return JSON.parse(JSON.stringify(o)); }
  async function comRetentativa(fn) {
    try { return await fn(); }
    catch (e) {
      const code = e && e.code;
      if (code === 'unavailable' || code === 'resource_exhausted') {
        await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
        return await fn();
      }
      throw e;
    }
  }
  function msgErro(e) {
    const code = e && e.code;
    if (code === 'quota_exceeded') return 'O espaço de armazenamento deste sistema está cheio. Exporte um backup e arquive registros antigos.';
    if (code === 'invalid_argument') return 'O registro não pôde ser salvo (formato recusado ou sem permissão de edição). ' + (e.message || '');
    if (code === 'revoked' || code === 'not_granted') return 'O acesso ao armazenamento foi retirado nesta visualização. Recarregue a página.';
    if (code === 'unavailable' || code === 'resource_exhausted') return 'Falha temporária de conexão com o armazenamento. Tente salvar de novo.';
    return 'Não foi possível salvar: ' + ((e && e.message) || String(e));
  }

  // ---------- inicialização ----------
  Store.iniciar = async function (onChange) {
    Store._onChange = onChange;
    let db = null;
    try { if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db'); } catch (e) { db = null; }
    if (db) {
      Store._db = db; Store.modo = 'nuvem';
      try { await carregarNuvem(); } catch (e) { Store.erroCarga = msgErro(e); }
      assinarNuvem();
      return;
    }
    try {
      const raw = window.localStorage.getItem(CHAVE_LOCAL);
      if (raw) { const obj = JSON.parse(raw); Store.D = Object.assign(L.vazio(), obj); normalizar(Store.D); }
      window.localStorage.setItem(CHAVE_LOCAL + '-teste', '1');
      window.localStorage.removeItem(CHAVE_LOCAL + '-teste');
      Store.modo = 'local';
    } catch (e) { Store.modo = 'memoria'; }
    avisar();
  };
  function normalizar(D) {
    D.cfg = Object.assign(L.configPadrao(), D.cfg || {});
    D.cal = Object.assign(L.calendarioPadrao(), D.cal || {});
    for (const c of COLS.concat(['ops'])) D[c] = D[c] || {};
  }
  async function carregarNuvem() {
    const db = Store._db; const D = L.vazio();
    const cfgSnap = await comRetentativa(() => db.collection('config').get());
    let parts = [];
    for (const d of cfgSnap.docs) {
      const x = limpo(d.data());
      if (d.id === 'geral') D.cfg = x; else if (d.id === 'calendario') D.cal = x; else if (d.id === 'logo') D.logo = x.dataUrl || null; else if (d.id === 'indice') parts = x.particoes || [];
    }
    for (const c of COLS) {
      const snap = await comRetentativa(() => db.collection(c).get());
      for (const d of snap.docs) D[c][d.id] = limpo(d.data());
    }
    for (const p of parts) {
      const snap = await comRetentativa(() => db.collection(p).get());
      for (const d of snap.docs) D.ops[d.id] = limpo(d.data());
    }
    Store._parts = parts.slice();
    normalizar(D);
    Store.D = D;
    avisar();
  }
  function assinarNuvem() {
    const db = Store._db;
    const onErr = e => { if (e && (e.code === 'revoked')) { Store.erroCarga = msgErro(e); avisar(); } };
    Store._subs.push(db.collection('config').onSnapshot(snap => {
      for (const d of snap.docs) {
        const x = limpo(d.data());
        if (d.id === 'geral') Store.D.cfg = Object.assign(L.configPadrao(), x);
        else if (d.id === 'calendario') Store.D.cal = Object.assign(L.calendarioPadrao(), x);
        else if (d.id === 'logo') Store.D.logo = x.dataUrl || null;
        else if (d.id === 'indice') for (const p of x.particoes || []) if (!Store._parts.includes(p)) { Store._parts.push(p); assinarParticao(p); }
      }
      avisar();
    }, onErr));
    for (const c of COLS) {
      Store._subs.push(db.collection(c).onSnapshot(snap => {
        const novo = {}; for (const d of snap.docs) novo[d.id] = limpo(d.data());
        if (Store.modo === 'nuvem') { Store.D[c] = novo; avisar(); }
      }, onErr));
    }
    for (const p of Store._parts) assinarParticao(p);
  }
  function assinarParticao(p) {
    Store._subs.push(Store._db.collection(p).onSnapshot(snap => {
      if (Store.modo !== 'nuvem') return;
      for (const ch of snap.docChanges()) {
        if (ch.type === 'removed') delete Store.D.ops[ch.doc.id];
        else Store.D.ops[ch.doc.id] = limpo(ch.doc.data());
      }
      avisar();
    }, () => {}));
  }

  // ---------- gravação ----------
  function gravarLocal() {
    if (Store.modo !== 'local') return;
    try { window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(L.montarBackup(Store.D).dados)); }
    catch (e) { throw new Error('O navegador recusou guardar os dados (espaço cheio ou bloqueado). Exporte um backup.'); }
  }
  /** Salva um registro. colecao: uma de L.COLECOES, 'ops' ou 'config'. */
  Store.salvar = async function (colecao, obj) {
    obj = limpo(obj);
    if (Store.modo === 'nuvem') {
      try {
        const db = Store._db;
        if (colecao === 'ops') {
          if (!obj.part) obj.part = particao(obj.criadoEm);
          if (!Store._parts.includes(obj.part)) {
            const parts = Store._parts.concat([obj.part]);
            await comRetentativa(() => db.doc('config/indice').set({ particoes: parts }));
            Store._parts = parts; assinarParticao(obj.part);
          }
          await comRetentativa(() => db.doc(obj.part + '/' + obj.id).set(obj));
        } else if (colecao === 'config') {
          await comRetentativa(() => db.doc('config/' + obj.id).set(obj.dados));
        } else {
          await comRetentativa(() => db.doc(colecao + '/' + obj.id).set(obj));
        }
      } catch (e) { throw new Error(msgErro(e)); }
    }
    // reflete na memória (a nuvem também confirma pelo snapshot)
    if (colecao === 'ops') Store.D.ops[obj.id] = obj;
    else if (colecao === 'config') {
      if (obj.id === 'geral') Store.D.cfg = obj.dados; else if (obj.id === 'calendario') Store.D.cal = obj.dados; else if (obj.id === 'logo') Store.D.logo = obj.dados.dataUrl || null;
    } else Store.D[colecao][obj.id] = obj;
    if (Store.modo === 'local') {
      try { gravarLocal(); } catch (e) { throw e; }
    }
    avisar();
    return obj;
  };
  Store.remover = async function (colecao, id) {
    if (Store.modo === 'nuvem') {
      try {
        if (colecao === 'ops') { const op = Store.D.ops[id]; await comRetentativa(() => Store._db.doc((op && op.part ? op.part : particao()) + '/' + id).delete()); }
        else await comRetentativa(() => Store._db.doc(colecao + '/' + id).delete());
      } catch (e) { throw new Error(msgErro(e)); }
    }
    if (colecao === 'ops') delete Store.D.ops[id]; else delete Store.D[colecao][id];
    if (Store.modo === 'local') gravarLocal();
    avisar();
  };
  Store.salvarConfig = function (cfg) { return Store.salvar('config', { id: 'geral', dados: cfg }); };
  Store.salvarCalendario = function (cal) { return Store.salvar('config', { id: 'calendario', dados: cal }); };
  Store.salvarLogo = function (dataUrl) { return Store.salvar('config', { id: 'logo', dados: { dataUrl: dataUrl || null } }); };

  /** Substitui todos os dados (restauração de backup). progresso(feitos, total). */
  Store.substituirTudo = async function (dados, progresso) {
    const novo = Object.assign(L.vazio(), limpo(dados)); normalizar(novo);
    if (Store.modo === 'nuvem') {
      const db = Store._db; const atual = Store.D;
      const apagar = []; const gravar = [];
      for (const c of COLS) for (const id of Object.keys(atual[c])) if (!novo[c][id]) apagar.push(() => db.doc(c + '/' + id).delete());
      for (const [id, op] of Object.entries(atual.ops)) if (!novo.ops[id]) apagar.push(() => db.doc((op.part || particao(op.criadoEm)) + '/' + id).delete());
      const parts = new Set(Store._parts);
      for (const op of Object.values(novo.ops)) { op.part = op.part || particao(op.criadoEm); parts.add(op.part); }
      gravar.push(() => db.doc('config/indice').set({ particoes: [...parts] }));
      gravar.push(() => db.doc('config/geral').set(novo.cfg));
      gravar.push(() => db.doc('config/calendario').set(novo.cal));
      gravar.push(() => db.doc('config/logo').set({ dataUrl: novo.logo || null }));
      for (const c of COLS) for (const x of Object.values(novo[c])) gravar.push(() => db.doc(c + '/' + x.id).set(x));
      for (const op of Object.values(novo.ops)) gravar.push(() => db.doc(op.part + '/' + op.id).set(op));
      const tarefas = apagar.concat(gravar); let feitos = 0;
      try {
        for (const t of tarefas) { await comRetentativa(t); feitos++; if (progresso && feitos % 10 === 0) progresso(feitos, tarefas.length); }
      } catch (e) { throw new Error(msgErro(e) + ` (${feitos} de ${tarefas.length} etapas concluídas; importe o mesmo arquivo de novo para completar).`); }
      for (const p of parts) if (!Store._parts.includes(p)) { Store._parts.push(p); assinarParticao(p); }
    }
    Store.D = novo;
    if (Store.modo === 'local') gravarLocal();
    avisar();
  };

  // ---------- demonstração ----------
  Store.entrarDemo = function (dados) {
    if (Store.modo === 'demo') return;
    Store._real = { modo: Store.modo, D: Store.D };
    Store.modo = 'demo'; Store.D = dados; avisar();
  };
  Store.sairDemo = function () {
    if (Store.modo !== 'demo' || !Store._real) return;
    Store.modo = Store._real.modo; Store.D = Store._real.D; Store._real = null; avisar();
  };
  // Na demonstração as gravações ficam só na memória.
  const salvarOrig = Store.salvar, removerOrig = Store.remover;
  Store.salvar = function (c, o) {
    if (Store.modo !== 'demo') return salvarOrig(c, o);
    o = limpo(o);
    if (c === 'ops') Store.D.ops[o.id] = o; else if (c === 'config') { if (o.id === 'geral') Store.D.cfg = o.dados; else if (o.id === 'calendario') Store.D.cal = o.dados; else Store.D.logo = o.dados.dataUrl; } else Store.D[c][o.id] = o;
    avisar(); return Promise.resolve(o);
  };
  Store.remover = function (c, id) {
    if (Store.modo !== 'demo') return removerOrig(c, id);
    if (c === 'ops') delete Store.D.ops[id]; else delete Store.D[c][id];
    avisar(); return Promise.resolve();
  };

  Store.particao = particao;
  L.Store = Store;
})(globalThis.L = globalThis.L || {});
