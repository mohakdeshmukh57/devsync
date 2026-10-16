// Tiny dependency-free syntax highlighter. Returns HTML-escaped markup with <span class="tk-*"> tokens.
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wrap = (cls, s) => `<span class="tk-${cls}">${esc(s)}</span>`;

const KW_JS = 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|yield|static|delete|void|interface|type|enum|implements|public|private|protected|readonly|as';
const KW_PY = 'def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|try|except|finally|raise|with|lambda|pass|break|continue|yield|global|nonlocal|assert|del|async|await';
const BUILTIN_PY = 'print|len|range|int|str|float|list|dict|set|tuple|bool|input|open|enumerate|zip|map|filter|sum|min|max|abs|sorted|reversed|isinstance|type|super|self';
const KW_GENERIC = 'if|else|for|while|do|switch|case|break|continue|return|class|struct|enum|public|private|protected|static|void|int|long|float|double|char|bool|boolean|string|new|try|catch|finally|throw|import|using|package|namespace|func|fn|let|mut|const|var|def|end|then|select|from|where|insert|update|delete|create|table|into|values|join|group|order|by|limit';

function build(rules) {
  const re = new RegExp(rules.map(r => `(${r[0]})`).join('|'), 'g');
  return code => {
    let out = '';
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      if (m[0] === '') { re.lastIndex += 1; continue; }
      if (m.index > last) out += esc(code.slice(last, m.index));
      let i = 1;
      while (m[i] === undefined) i += 1;
      out += wrap(rules[i - 1][1], m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(code.slice(last));
  };
}

const STR = `"(?:\\\\.|[^"\\\\\\n])*"?|'(?:\\\\.|[^'\\\\\\n])*'?`;

const js = build([
  ['\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)', 'c'],
  [STR + '|`(?:\\\\[\\s\\S]|[^`\\\\])*`?', 's'],
  ['\\b(?:0x[\\da-fA-F]+|\\d+\\.?\\d*(?:e[+-]?\\d+)?)\\b', 'n'],
  [`\\b(?:${KW_JS})\\b`, 'k'],
  ['\\b(?:true|false|null|undefined|NaN|Infinity)\\b', 'l'],
  ['\\b[A-Za-z_$][\\w$]*(?=\\s*\\()', 'f'],
]);

const py = build([
  ['#[^\\n]*', 'c'],
  ['[rbfRBF]{0,2}(?:"""[\\s\\S]*?(?:"""|$)|\'\'\'[\\s\\S]*?(?:\'\'\'|$))', 's'],
  ['[rbfRBF]{0,2}(?:' + STR + ')', 's'],
  ['\\b\\d+\\.?\\d*(?:e[+-]?\\d+)?\\b', 'n'],
  [`\\b(?:${KW_PY})\\b`, 'k'],
  ['\\b(?:True|False|None)\\b', 'l'],
  [`\\b(?:${BUILTIN_PY})\\b`, 'f'],
  ['\\b[A-Za-z_]\\w*(?=\\s*\\()', 'f'],
]);

const css = build([
  ['\\/\\*[\\s\\S]*?(?:\\*\\/|$)', 'c'],
  [STR, 's'],
  ['@[\\w-]+', 'k'],
  ['#(?:[\\da-fA-F]{8}|[\\da-fA-F]{6}|[\\da-fA-F]{3,4})\\b', 'n'],
  ['[.#][A-Za-z_-][\\w-]*', 'a'],
  ['[\\w-]+(?=\\s*:(?!:))', 'p'],
  ['-?\\d*\\.?\\d+(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch)?\\b', 'n'],
  ['[\\w-]+(?=\\()', 'f'],
]);

const json = build([
  ['"(?:\\\\.|[^"\\\\\\n])*"(?=\\s*:)', 'p'],
  ['"(?:\\\\.|[^"\\\\\\n])*"?', 's'],
  ['-?\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b', 'n'],
  ['\\b(?:true|false|null)\\b', 'l'],
]);

const generic = build([
  ['\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)|--[^\\n]*|#[^\\n]*', 'c'],
  [STR, 's'],
  ['\\b\\d+\\.?\\d*\\b', 'n'],
  [`\\b(?:${KW_GENERIC})\\b`, 'k'],
  ['\\b[A-Za-z_]\\w*(?=\\s*\\()', 'f'],
]);

const yaml = build([
  ['#[^\\n]*', 'c'],
  [STR, 's'],
  ['^[ \\t-]*[\\w.-]+(?=\\s*:)', 'p'],
  ['\\b(?:true|false|null|yes|no)\\b', 'l'],
  ['\\b\\d+\\.?\\d*\\b', 'n'],
]);

const tagInner = tag => {
  // tag is e.g. <a href="x" class='y'> — colour the name, attributes, strings and brackets
  const m = /^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>?)$/.exec(tag);
  if (!m) return esc(tag);
  const re = /([\w:@.-]+)(\s*=\s*)?("[^"]*"?|'[^']*'?|[^\s"'>]+)?/g;
  let attrs = '';
  let last = 0;
  let a;
  while ((a = re.exec(m[3]))) {
    if (a[0] === '') { re.lastIndex += 1; continue; }
    attrs += esc(m[3].slice(last, a.index)) + wrap('a', a[1]) + (a[2] ? esc(a[2]) : '') + (a[3] ? wrap('s', a[3]) : '');
    last = a.index + a[0].length;
  }
  attrs += esc(m[3].slice(last));
  return `${wrap('p2', m[1])}${wrap('t', m[2])}${attrs}${wrap('p2', m[4])}`;
};

function html(code) {
  const re = /<!--[\s\S]*?(?:-->|$)|<!DOCTYPE[^>]*>?|<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<\/?[A-Za-z][^>]*>?/gi;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    if (m.index > last) out += esc(code.slice(last, m.index));
    const s = m[0];
    if (s.startsWith('<!--')) out += wrap('c', s);
    else if (/^<!DOCTYPE/i.test(s)) out += wrap('k', s);
    else if (m[1]) {
      const open = /^<[^>]*>/.exec(s)[0];
      const close = /<\/(?:script|style)\s*>$/i.exec(s);
      const inner = s.slice(open.length, close ? s.length - close[0].length : s.length);
      out += tagInner(open) + (m[1].toLowerCase() === 'script' ? js(inner) : css(inner)) + (close ? tagInner(close[0]) : '');
    } else out += tagInner(s);
    last = m.index + s.length;
    if (s.length === 0) re.lastIndex += 1;
  }
  return out + esc(code.slice(last));
}

const TABLE = { javascript: js, typescript: js, python: py, css, json, html, yaml, shell: generic, sql: generic, java: generic, c: generic, cpp: generic, csharp: generic, go: generic, rust: generic, php: generic, ruby: generic, swift: generic, kotlin: generic, dart: generic };

/** Highlights `code` for `language`. Always safe: falls back to escaped plain text. */
export function highlight(language, code) {
  const fn = TABLE[language];
  if (!fn || code.length > 200000) return esc(code);
  try { return fn(code); } catch { return esc(code); }
}
