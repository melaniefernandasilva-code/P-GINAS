/* LEORA — utilidades puras: números, dinheiro, unidades e datas (fuso America/Sao_Paulo). */
(function (L) {
  'use strict';
  const TZ = 'America/Sao_Paulo';

  // ---------- números e dinheiro ----------
  // Dinheiro é guardado em reais com 2 casas; custos unitários mantêm 6 casas
  // e só são arredondados para 2 casas na hora de virar valor em reais.
  function r2(v) { return Math.round((Number(v) || 0) * 100 + Number.EPSILON * 100) / 100; }
  function r6(v) { return Math.round((Number(v) || 0) * 1e6) / 1e6; }
  function num(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/\s/g, '').replace(/^R\$/i, '');
    if (s === '') return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function numOr(v, d) { const n = num(v); return Number.isFinite(n) ? n : d; }
  const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function brl(v) { return fmtBRL.format(r2(v) || 0).replace(/ /g, ' '); }
  function brl4(v) { // custo unitário pequeno: mostra até 4 casas quando < R$ 1
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1 || n === 0) return brl(n);
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  function nf(v, casas) {
    const n = Number(v) || 0;
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas === undefined ? 2 : casas });
  }
  function pct(v, casas) { return nf((Number(v) || 0) * 100, casas === undefined ? 1 : casas) + '%'; }
  function sum(arr, f) { let s = 0; for (const x of arr || []) s += f ? (Number(f(x)) || 0) : (Number(x) || 0); return s; }

  // ---------- unidades ----------
  // Unidades base: g (massa), ml (volume), un (contagem).
  const UNIDADES = {
    g: { base: 'g', f: 1 }, kg: { base: 'g', f: 1000 },
    ml: { base: 'ml', f: 1 }, L: { base: 'ml', f: 1000 },
    un: { base: 'un', f: 1 },
  };
  /**
   * Converte `qtd` em `de` para a unidade base do insumo.
   * Volume↔peso só com gPorMl cadastrado; unidade↔peso só com gPorUn.
   * Retorna {ok, valor, erro}.
   */
  function converter(qtd, de, insumo) {
    const u = UNIDADES[de];
    if (!u) return { ok: false, erro: 'Unidade desconhecida: ' + de };
    const alvo = insumo.unidade;
    let v = qtd * u.f; // na base da unidade de origem
    if (u.base === alvo) return { ok: true, valor: v };
    const gPorMl = Number(insumo.gPorMl) || 0;
    const gPorUn = Number(insumo.gPorUn) || 0;
    // levar para gramas, se possível
    let g = null;
    if (u.base === 'g') g = v;
    else if (u.base === 'ml' && gPorMl > 0) g = v * gPorMl;
    else if (u.base === 'un' && gPorUn > 0) g = v * gPorUn;
    if (g !== null) {
      if (alvo === 'g') return { ok: true, valor: g };
      if (alvo === 'ml' && gPorMl > 0) return { ok: true, valor: g / gPorMl };
      if (alvo === 'un' && gPorUn > 0) return { ok: true, valor: g / gPorUn };
    }
    const nomes = { g: 'peso', ml: 'volume', un: 'unidades' };
    return {
      ok: false,
      erro: `"${insumo.nome}" é controlado em ${alvo}. Para usar ${de} cadastre a equivalência (${nomes[u.base]} → ${nomes[alvo]}) no ingrediente.`,
    };
  }
  function unidadesCompativeis(insumo) {
    const out = [];
    for (const k of Object.keys(UNIDADES)) if (converter(1, k, insumo).ok) out.push(k);
    return out;
  }

  // ---------- datas ----------
  function hoje(agora) {
    const d = agora || new Date();
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  function agoraISO() { return new Date().toISOString(); }
  function parseD(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  function fmtD(d) { return d.toISOString().slice(0, 10); }
  function addDias(s, n) { const d = parseD(s); d.setUTCDate(d.getUTCDate() + Number(n || 0)); return fmtD(d); }
  function addMeses(s, n) { // mantém o dia, ajustando para o último dia do mês quando necessário
    const [y, m, d] = String(s).split('-').map(Number);
    const alvo = new Date(Date.UTC(y, m - 1 + Number(n), 1));
    const ult = diasNoMes(fmtD(alvo).slice(0, 7));
    alvo.setUTCDate(Math.min(d, ult));
    return fmtD(alvo);
  }
  function diffDias(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); } // b - a
  function mesDe(s) { return String(s).slice(0, 7); }
  function diasNoMes(ym) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addMesYM(ym, n) { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return fmtD(d).slice(0, 7); }
  function diaSemana(s) { return parseD(s).getUTCDay(); }
  function fmtBR(s) { if (!s) return '—'; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function nomeMes(ym) { const [y, m] = ym.split('-').map(Number); return MESES[m - 1] + ' de ' + y; }
  function nomeMesCurto(ym) { const [y, m] = ym.split('-').map(Number); return MESES[m - 1].slice(0, 3) + '/' + String(y).slice(2); }
  const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  // ---------- ids ----------
  function uid(prefixo) {
    const r = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    return (prefixo || 'x') + '-' + r;
  }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  // ---------- CSV (UTF-8 com BOM, separador vírgula, decimal com ponto) ----------
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCSV(cabecalho, linhas) {
    return '﻿' + [cabecalho.map(csvCell).join(','), ...linhas.map(l => l.map(csvCell).join(','))].join('\r\n');
  }

  Object.assign(L, {
    TZ, r2, r6, num, numOr, brl, brl4, nf, pct, sum, UNIDADES, converter, unidadesCompativeis,
    hoje, agoraISO, parseD, fmtD, addDias, addMeses, diffDias, mesDe, diasNoMes, addMesYM, diaSemana,
    fmtBR, nomeMes, nomeMesCurto, MESES, DIAS_SEMANA, uid, clone, toCSV,
  });
})(globalThis.L = globalThis.L || {});
