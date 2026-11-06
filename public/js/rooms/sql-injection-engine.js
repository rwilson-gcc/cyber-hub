/*
 * A deliberately tiny, in-browser SQL interpreter for the SQL injection room.
 *
 * It never touches a real database: the "tables" are plain JavaScript arrays, and only the handful
 * of SQL features the room needs are supported (SELECT, FROM, WHERE with AND/OR/NOT/=/LIKE, UNION,
 * ORDER BY <column number>, and -- / # comments). Error messages mimic MySQL's so learners see
 * the kind of verbose output real sites leak.
 *
 * Because it parses the query the page builds, any payload a learner types behaves the way it
 * would on a real, vulnerable site, including operator precedence (AND binds tighter than OR).
 */
(function (root) {
  'use strict';

  var DB_NAME = 'kelvin_cycles';

  function SqlError(message) { this.message = message; }

  function syntaxError(sql, pos) {
    return new SqlError("You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '" + sql.slice(pos) + "' at line 1");
  }

  /* ---------------- tokeniser ---------------- */
  function tokenise(sql) {
    var toks = [], i = 0, n = sql.length;
    while (i < n) {
      var ch = sql.charAt(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '#' || (ch === '-' && sql.charAt(i + 1) === '-')) break;          // comment to end of line
      if (ch === '/' && sql.charAt(i + 1) === '*') {
        var end = sql.indexOf('*/', i + 2);
        if (end < 0) throw syntaxError(sql, i);
        i = end + 2; continue;
      }
      if (ch === "'") {                                                           // string literal ('' = escaped quote)
        var start = i, val = ''; i++;
        for (;;) {
          if (i >= n) throw syntaxError(sql, start);                              // unterminated string
          if (sql.charAt(i) === "'") {
            if (sql.charAt(i + 1) === "'") { val += "'"; i += 2; continue; }
            i++; break;
          }
          val += sql.charAt(i++);
        }
        toks.push({ t: 'str', v: val, pos: start }); continue;
      }
      if (/[0-9]/.test(ch)) {
        var m = /^[0-9]+(\.[0-9]+)?/.exec(sql.slice(i));
        toks.push({ t: 'num', v: parseFloat(m[0]), pos: i }); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        var w = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i))[0];
        toks.push({ t: 'id', v: w, u: w.toUpperCase(), pos: i }); i += w.length; continue;
      }
      var two = sql.substr(i, 2);
      if (two === '<>' || two === '!=' || two === '<=' || two === '>=') { toks.push({ t: 'op', v: two, pos: i }); i += 2; continue; }
      if ('=<>(),;*'.indexOf(ch) >= 0) { toks.push({ t: 'op', v: ch, pos: i }); i++; continue; }
      throw syntaxError(sql, i);                                                  // anything else is not valid SQL here
    }
    toks.push({ t: 'eof', pos: n });
    return toks;
  }

  /* ---------------- parser ---------------- */
  var RESERVED = { SELECT: 1, FROM: 1, WHERE: 1, AND: 1, OR: 1, NOT: 1, UNION: 1, ALL: 1, ORDER: 1, BY: 1, LIKE: 1, NULL: 1 };

  function parse(sql) {
    var toks = tokenise(sql), p = 0;
    function peek() { return toks[p]; }
    function fail() { return syntaxError(sql, toks[p].pos); }
    function isKw(k) { var t = toks[p]; return t.t === 'id' && t.u === k; }
    function isOp(o) { var t = toks[p]; return t.t === 'op' && t.v === o; }
    function eatKw(k) { if (isKw(k)) { p++; return true; } return false; }
    function eatOp(o) { if (isOp(o)) { p++; return true; } return false; }
    function expectKw(k) { if (!eatKw(k)) throw fail(); }

    function value() {
      var t = peek();
      if (t.t === 'str') { p++; return { k: 'lit', v: t.v, isStr: true }; }
      if (t.t === 'num') { p++; return { k: 'lit', v: t.v }; }
      if (t.t === 'id' && t.u === 'NULL') { p++; return { k: 'lit', v: null }; }
      if (t.t === 'id' && !RESERVED[t.u]) { p++; return { k: 'col', name: t.v }; }
      throw fail();
    }
    function cmp() {
      if (eatOp('(')) { var inner = orExpr(); if (!eatOp(')')) throw fail(); return inner; }
      var left = value();
      var t = peek(), op = null;
      if (t.t === 'op' && ['=', '!=', '<>', '<', '>', '<=', '>='].indexOf(t.v) >= 0) { op = t.v; p++; }
      else if (isKw('LIKE')) { op = 'LIKE'; p++; }
      else if (isKw('NOT') && toks[p + 1].t === 'id' && toks[p + 1].u === 'LIKE') { op = 'NOT LIKE'; p += 2; }
      if (!op) return { k: 'truthy', e: left };
      return { k: 'cmp', op: op, l: left, r: value() };
    }
    function notExpr() { if (eatKw('NOT')) return { k: 'not', e: notExpr() }; return cmp(); }
    function andExpr() { var l = notExpr(); while (eatKw('AND')) l = { k: 'and', l: l, r: notExpr() }; return l; }
    function orExpr() { var l = andExpr(); while (eatKw('OR')) l = { k: 'or', l: l, r: andExpr() }; return l; }

    function selectStmt() {
      expectKw('SELECT');
      var items = [];
      do { items.push(eatOp('*') ? { k: 'star' } : value()); } while (eatOp(','));
      var s = { items: items, from: null, where: null };
      if (eatKw('FROM')) {
        var t = peek();
        if (t.t !== 'id' || RESERVED[t.u]) throw fail();
        p++; s.from = t.v;
        if (eatKw('WHERE')) s.where = orExpr();
      }
      return s;
    }

    var selects = [selectStmt()], all = [];
    while (eatKw('UNION')) { all.push(eatKw('ALL')); selects.push(selectStmt()); }
    var order = null;
    if (eatKw('ORDER')) {
      expectKw('BY');
      var t = peek();
      if (t.t === 'num') { p++; order = { num: t.v }; }
      else if (t.t === 'id' && !RESERVED[t.u]) { p++; order = { name: t.v }; }
      else throw fail();
    }
    eatOp(';');
    if (peek().t !== 'eof') throw fail();
    return { selects: selects, all: all, order: order };
  }

  /* ---------------- evaluation ---------------- */
  function numeric(v) { return typeof v === 'number' ? v : (typeof v === 'string' && /^\s*-?[0-9]+(\.[0-9]+)?\s*$/.test(v) ? parseFloat(v) : NaN); }
  function truthy(v) { if (v === null) return false; var n = typeof v === 'number' ? v : parseFloat(v); return !isNaN(n) && n !== 0; }
  function equal(a, b) {
    if (a === null || b === null) return false;
    var na = numeric(a), nb = numeric(b);
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function compare(a, b) {
    var na = numeric(a), nb = numeric(b);
    if (!isNaN(na) && !isNaN(nb)) return na < nb ? -1 : na > nb ? 1 : 0;
    var x = String(a).toLowerCase(), y = String(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0;
  }
  function like(a, pat) {
    if (a === null || pat === null) return false;
    var re = String(pat).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
    return new RegExp('^' + re + '$', 'i').test(String(a));
  }

  function resolve(node, table, row, where) {
    if (node.k === 'lit') return node.v;
    var idx = table ? table.cols.indexOf(node.name) : -1;
    if (idx < 0) throw new SqlError("Unknown column '" + node.name + "' in '" + where + "'");
    return row[idx];
  }
  function evalCond(c, table, row) {
    switch (c.k) {
      case 'or': return evalCond(c.l, table, row) || evalCond(c.r, table, row);
      case 'and': return evalCond(c.l, table, row) && evalCond(c.r, table, row);
      case 'not': return !evalCond(c.e, table, row);
      case 'truthy': return truthy(resolve(c.e, table, row, 'where clause'));
      case 'cmp':
        var a = resolve(c.l, table, row, 'where clause'), b = resolve(c.r, table, row, 'where clause');
        switch (c.op) {
          case '=': return equal(a, b);
          case '!=': case '<>': return a !== null && b !== null && !equal(a, b);
          case '<': return a !== null && b !== null && compare(a, b) < 0;
          case '>': return a !== null && b !== null && compare(a, b) > 0;
          case '<=': return a !== null && b !== null && compare(a, b) <= 0;
          case '>=': return a !== null && b !== null && compare(a, b) >= 0;
          case 'LIKE': return like(a, b);
          case 'NOT LIKE': return a !== null && b !== null && !like(a, b);
        }
    }
    return false;
  }

  function runSelect(s, db) {
    var table = null;
    if (s.from) {
      table = db[s.from.toLowerCase()];
      if (!table) throw new SqlError("Table '" + DB_NAME + '.' + s.from + "' doesn't exist");
    }
    var cols = [];
    s.items.forEach(function (it) {
      if (it.k === 'star') { if (!table) throw new SqlError("No tables used"); cols = cols.concat(table.cols); }
      else cols.push(it.k === 'col' ? it.name : (it.v === null ? 'NULL' : String(it.v)));
    });
    var sourceRows = table ? table.rows : [[]];
    var rows = [];
    sourceRows.forEach(function (row) {
      if (s.where && !evalCond(s.where, table, row)) return;
      var out = [];
      s.items.forEach(function (it) {
        if (it.k === 'star') out = out.concat(row);
        else out.push(resolve(it, table, row, 'field list'));
      });
      rows.push(out);
    });
    // Column references are validated even when no rows match, as a real database would.
    s.items.forEach(function (it) { if (it.k === 'col' && (!table || table.cols.indexOf(it.name) < 0)) throw new SqlError("Unknown column '" + it.name + "' in 'field list'"); });
    if (s.where && table) evalCond(s.where, table, table.rows[0] || table.cols.map(function () { return null; }));
    return { cols: cols, rows: rows };
  }

  function run(sql, db) {
    try {
      var q = parse(sql), results = q.selects.map(function (s) { return runSelect(s, db); });
      var width = results[0].cols.length;
      results.forEach(function (r) { if (r.cols.length !== width) throw new SqlError('The used SELECT statements have a different number of columns'); });
      var rows = results[0].rows.slice();
      for (var i = 1; i < results.length; i++) {
        results[i].rows.forEach(function (r) {
          if (q.all[i - 1] || !rows.some(function (x) { return x.length === r.length && x.every(function (v, j) { return v === r[j]; }); })) rows.push(r);
        });
      }
      if (q.order) {
        var col = q.order.num !== undefined ? q.order.num - 1 : results[0].cols.indexOf(q.order.name);
        if (col < 0 || col >= width || (q.order.num !== undefined && q.order.num % 1 !== 0)) throw new SqlError("Unknown column '" + (q.order.num !== undefined ? q.order.num : q.order.name) + "' in 'order clause'");
        rows.sort(function (a, b) { if (a[col] === null) return b[col] === null ? 0 : -1; if (b[col] === null) return 1; return compare(a[col], b[col]); });
      }
      return { ok: true, cols: results[0].cols, rows: rows };
    } catch (e) {
      if (e instanceof SqlError) return { ok: false, error: 'ERROR 1064 (42000): ' + e.message };
      throw e;
    }
  }

  /* ---------------- the two vulnerable queries the room uses ---------------- */
  var SEARCH_TEMPLATE = "SELECT name, price, category FROM products WHERE name LIKE '%{q}%'";
  var LOGIN_TEMPLATE = "SELECT username FROM staff WHERE username = '{u}' AND password = '{p}'";

  function buildSearch(q) { return SEARCH_TEMPLATE.replace('{q}', function () { return q; }); }
  function buildLogin(u, p) { return LOGIN_TEMPLATE.replace('{u}', function () { return u; }).replace('{p}', function () { return p; }); }

  var api = { run: run, buildSearch: buildSearch, buildLogin: buildLogin, SEARCH_TEMPLATE: SEARCH_TEMPLATE, LOGIN_TEMPLATE: LOGIN_TEMPLATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SqliEngine = api;
})(typeof window !== 'undefined' ? window : this);
