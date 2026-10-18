// Leitor de literais JavaScript (objetos, listas, textos, números, true/false/null).
// Serve para ler os arquivos de dados do LF2 no formato F.LF sem executá-los.

export function parseLiteral(text, start = 0) {
  let i = start;

  function fail(msg) {
    const line = text.slice(0, i).split('\n').length;
    throw new Error(`${msg} (linha ${line})`);
  }

  function skip() {
    for (;;) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
      else if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; }
      else if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i + 2); if (i < 0) fail('comentário sem fim'); i += 2; }
      else return;
    }
  }

  function string() {
    const q = text[i++];
    let s = '';
    while (text[i] !== q) {
      if (i >= text.length) fail('texto sem fim');
      if (text[i] === '\\') {
        const e = text[i + 1];
        s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
        i += 2;
      } else s += text[i++];
    }
    i++;
    return s;
  }

  function word() {
    const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(i, i + 64));
    if (!m) fail('nome esperado');
    i += m[0].length;
    return m[0];
  }

  function value() {
    skip();
    const c = text[i];
    if (c === '{') {
      i++;
      const o = {};
      for (;;) {
        skip();
        if (text[i] === '}') { i++; return o; }
        let key;
        if (text[i] === '"' || text[i] === "'") key = string();
        else if (/[0-9-]/.test(text[i])) key = String(number());
        else key = word();
        skip();
        if (text[i++] !== ':') fail('":" esperado');
        o[key] = value();
        skip();
        if (text[i] === ',') i++;
        else if (text[i] !== '}') fail('"," ou "}" esperado');
      }
    }
    if (c === '[') {
      i++;
      const a = [];
      for (;;) {
        skip();
        if (text[i] === ']') { i++; return a; }
        a.push(value());
        skip();
        if (text[i] === ',') i++;
        else if (text[i] !== ']') fail('"," ou "]" esperado');
      }
    }
    if (c === '"' || c === "'") return string();
    if (/[0-9.+-]/.test(c)) return number();
    const w = word();
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'null') return null;
    if (w === 'undefined') return undefined;
    fail(`valor inesperado "${w}"`);
  }

  function number() {
    const m = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(text.slice(i, i + 40));
    if (!m) fail('número esperado');
    i += m[0].length;
    return Number(m[0]);
  }

  const v = value();
  return { value: v, end: i };
}

// Lê o objeto passado para define({...}) num módulo AMD.
export function parseDefine(text) {
  const at = text.search(/define\s*\(\s*\{/);
  if (at < 0) throw new Error('define({...}) não encontrado');
  return parseLiteral(text, text.indexOf('{', at)).value;
}
