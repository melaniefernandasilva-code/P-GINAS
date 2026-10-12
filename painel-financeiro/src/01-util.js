/* Utilidades: dinheiro em centavos, datas ISO (AAAA-MM-DD) e texto. */
const U = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  // Converte texto em centavos. Aceita "1.234,56", "1234,56", "1234.56", "R$ 10".
  function toCents(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : null;
    let s = String(v).trim();
    if (!s) return null;
    s = s.replace(/R\$/gi, '').replace(/\s/g, '');
    let neg = false;
    if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }
    if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > ld) s = s.replace(/\./g, '').replace(',', '.');
    else if (ld > lc) {
      if (lc >= 0) s = s.replace(/,/g, '');
      else {
        const dots = (s.match(/\./g) || []).length;
        const after = s.length - ld - 1;
        if (dots > 1 || after === 3) s = s.replace(/\./g, '');
      }
    }
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null;
    const n = Math.round(parseFloat(s) * 100);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const num2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (c) => (c === null || c === undefined || isNaN(c)) ? 'não informado' : brl.format(Math.round(c) / 100);
  const moneyShort = (c) => {
    if (c === null || c === undefined) return '?';
    const a = Math.abs(c) / 100;
    const sign = c < 0 ? '-' : '';
    if (a >= 1e6) return sign + 'R$ ' + (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (a >= 1e4) return sign + 'R$ ' + (a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return sign + 'R$ ' + a.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  };
  const moneyInput = (c) => (c === null || c === undefined) ? '' : num2.format(c / 100);
  const pct = (x, digits = 0) => (x === null || x === undefined || !isFinite(x)) ? 'sem base' : (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits }) + '%';

  // Datas
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function iso(y, m, d) {
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    d = Math.max(1, Math.min(d, dim(y, m)));
    return `${y}-${pad(m)}-${pad(d)}`;
  }
  const validISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && (() => { const { y, m, d } = parse(s); return m >= 1 && m <= 12 && d >= 1 && d <= dim(y, m); })();
  const addDays = (s, n) => { const { y, m, d } = parse(s); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
  const addMonths = (s, n, anchor) => { const { y, m, d } = parse(s); return iso(y, m + n, anchor || d); };
  const monthKey = (s) => s.slice(0, 7);
  const addMonthKey = (k, n) => iso(+k.slice(0, 4), +k.slice(5, 7) + n, 1).slice(0, 7);
  const monthsDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const diffDays = (a, b) => { const A = parse(a), B = parse(b); return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 864e5); };
  const today = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const fmtDate = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
  const fmtDay = (s) => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const fmtMonth = (k) => k ? `${MONTHS[+k.slice(5, 7) - 1]}/${k.slice(0, 4)}` : '';
  const fmtMonthFull = (k) => k ? `${MONTHS_FULL[+k.slice(5, 7) - 1]} de ${k.slice(0, 4)}` : '';
  const weekday = (s) => { const { y, m, d } = parse(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
  const endOfMonth = (k) => iso(+k.slice(0, 4), +k.slice(5, 7), 31);
  const monthRange = (a, b) => { const out = []; let k = a; let g = 0; while (k <= b && g++ < 400) { out.push(k); k = addMonthKey(k, 1); } return out; };
  // "dd/mm/aaaa" ou "aaaa-mm-dd" para ISO
  function parseDateAny(s) {
    if (!s) return null;
    s = String(s).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) { const r = iso(+m[1], +m[2], +m[3]); return validISO(`${m[1]}-${pad(+m[2])}-${pad(+m[3])}`) ? r : null; }
    m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      const cand = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
      return validISO(cand) ? cand : null;
    }
    return null;
  }

  // Divide um total em n parcelas em centavos; a diferença de arredondamento fica na primeira.
  function split(total, n) {
    n = Math.max(1, Math.floor(n));
    const base = Math.floor(total / n);
    const r = total - base * n;
    return Array.from({ length: n }, (_, i) => base + (i === 0 ? r : 0));
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + (fn(x) || 0), 0);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
  const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);
  const groupBy = (arr, fn) => { const m = {}; for (const x of arr) { const k = fn(x); (m[k] = m[k] || []).push(x); } return m; };
  const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;

  // Hash simples para checar integridade dos blocos salvos
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

  return { pad, uid, toCents, money, moneyShort, moneyInput, pct, parse, dim, iso, validISO, addDays, addMonths, monthKey, addMonthKey, monthsDiff, diffDays, today, fmtDate, fmtDay, fmtMonth, fmtMonthFull, MONTHS, WEEK, weekday, endOfMonth, monthRange, parseDateAny, split, esc, norm, sum, clone, maxDate, minDate, groupBy, plural, hash };
})();
if (typeof module !== 'undefined') module.exports = { U };
