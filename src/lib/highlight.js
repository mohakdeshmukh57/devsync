// Tiny dependency-free syntax highlighter. Returns HTML-escaped markup with <span class="tk-*"> tokens.
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wrap = (cls, s) => `<span class="tk-${cls}">${esc(s)}</span>`;

const KW_JS = 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|this|super|yield|static|delete|void|interface|type|enum|implements|public|private|protected|readonly|as';
const KW_PY = 'def|class|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|try|except|finally|raise|with|lambda|pass|break|continue|yield|global|nonlocal|assert|del|async|await';
const BUILTIN_PY = 'print|len|range|int|str|float|list|dict|set|tuple|bool|input|open|enumerate|zip|map|filter|sum|min|max|abs|sorted|reversed|isinstance|type|super|self';
const KW_GENERIC = 'if|else|for|while|do|switch|case|break|continue|return|class|struct|enum|public|private|protected|static|void|int|long|float|double|char|bool|boolean|string|new|try|catch|finally|throw|import|using|package|namespace|func|fn|let|mut|const|var|def|end|then|select|from|where|insert|update|delete|create|table|into|values|join|group|order|by|limit';

function build(rules, flags = 'gm') {
  const re = new RegExp(rules.map(r => `(${r[0]})`).join('|'), flags);
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


// Per-language rule sets built from keyword lists (comments, strings, numbers, keywords, types, functions).
const lang = (kw, { hash = false, types = '', ci = false, lits = 'true|false|null|nil|None|undefined' } = {}) => build([
  [hash ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)|--[^\\n]*', 'c'],
  [STR + '|`(?:\\\\[\\s\\S]|[^`\\\\])*`?', 's'],
  ['\\b(?:0x[\\da-fA-F]+|\\d+\\.?\\d*(?:e[+-]?\\d+)?)\\b', 'n'],
  [`\\b(?:${kw})\\b`.replace('\\b(?:', ci ? '\\b(?:' : '\\b(?:'), 'k'],
  [`\\b(?:${lits})\\b`, 'l'],
  types ? [`\\b(?:${types})\\b`, 'ty'] : ['(?!)', 'ty'],
  ['\\b[A-Z][A-Za-z0-9_]*\\b', 'ty'],
  ['\\b[A-Za-z_]\\w*(?=\\s*\\()', 'f'],
]);
const C_TYPES = 'int|long|short|float|double|char|bool|boolean|void|string|String|size_t|byte|auto|unsigned|signed|i8|i16|i32|i64|u8|u16|u32|u64|f32|f64|usize|str|Int|Double|Float|Bool|List|Map|Vec|Option|Result';
const KW_C = 'if|else|for|while|do|switch|case|break|continue|return|class|struct|enum|union|typedef|public|private|protected|static|final|abstract|interface|extends|implements|new|try|catch|finally|throw|throws|import|package|using|namespace|template|const|virtual|override|inline|extern|this|sizeof|include|define|goto|default|volatile|synchronized|instanceof|var|let|mut|fn|func|impl|trait|pub|use|mod|match|loop|where|move|ref|as|in|go|chan|defer|select|range|type|map|fun|val|object|when|is|guard|init|protocol|extension|async|await|yield|get|set|lateinit|open';
const sql = build([
  ['--[^\\n]*|\\/\\*[\\s\\S]*?(?:\\*\\/|$)', 'c'],
  ["'(?:''|[^'])*'?", 's'],
  ['\\b\\d+\\.?\\d*\\b', 'n'],
  ['\\b(?:(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|ON|AS|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|UNION|ALL|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|CHECK|EXISTS|ASC|DESC|BEGIN|COMMIT|ROLLBACK|WITH)\\b)', 'k'],
  ['\\b(?:INT|INTEGER|TEXT|VARCHAR|CHAR|BOOLEAN|DATE|TIMESTAMP|FLOAT|DOUBLE|DECIMAL|SERIAL|UUID|JSON)\\b', 'ty'],
  ['\\b[A-Za-z_]\\w*(?=\\s*\\()', 'f'],
], 'gmi');
const shell = build([
  ['#[^\\n]*', 'c'],
  [STR, 's'],
  ['\\$\\{?[\\w@#?*]+\\}?', 'a'],
  ['(?<=\\s|^)--?[A-Za-z][\\w-]*', 'p'],
  ['\\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|in|return|exit|export|local|source|echo|cd|ls|cat|grep|sed|awk|sudo|git|npm|node|python|pip|mkdir|rm|cp|mv|chmod|curl|wget)\\b', 'k'],
  ['\\b\\d+\\b', 'n'],
]);
const md = build([
  ['^#{1,6}[^\\n]*', 'k'],
  ['```[\\s\\S]*?(?:```|$)|`[^`\\n]+`', 's'],
  ['\\*\\*[^*\\n]+\\*\\*|__[^_\\n]+__', 'f'],
  ['\\[[^\\]\\n]*\\]\\([^)\\n]*\\)', 'a'],
  ['^\\s*(?:[-*+]|\\d+\\.)\\s', 'n'],
  ['^>[^\\n]*', 'c'],
]);
const ruby = lang('def|end|class|module|if|elsif|else|unless|while|until|for|in|do|begin|rescue|ensure|raise|return|yield|self|super|require|include|attr_accessor|puts|then|case|when|lambda|proc', { hash: true, lits: 'true|false|nil' });
const lua = lang('function|end|if|then|else|elseif|for|while|do|repeat|until|return|local|break|in|and|or|not', { lits: 'true|false|nil' });
const perl = lang('my|our|sub|if|elsif|else|unless|while|for|foreach|return|use|package|print|die|last|next', { hash: true });
const cStyle = lang(KW_C, { types: C_TYPES });
const php = lang(KW_C + '|function|echo|foreach|elseif|endif|endforeach|isset|empty|array|require|include|namespace|use|global', { types: C_TYPES });
const lisp = build([[';[^\\n]*', 'c'], [STR, 's'], ['\\b\\d+\\.?\\d*\\b', 'n'], ['\\((?:def\\w*|let|fn|if|cond|do|loop|ns)\\b', 'k']]);

const TABLE = {
  javascript: js, typescript: js, python: py, css, json, html, yaml, markdown: md, shell, sql,
  java: cStyle, c: cStyle, cpp: cStyle, csharp: cStyle, go: cStyle, rust: cStyle, swift: cStyle, kotlin: cStyle, dart: cStyle, scala: cStyle, zig: cStyle, groovy: cStyle, objc: cStyle,
  php, ruby, lua, perl, r: py, julia: py, nim: py, elixir: ruby, clojure: lisp, haskell: lang('module|import|where|let|in|if|then|else|case|of|do|data|type|class|instance|deriving|newtype', { lits: 'True|False|Nothing' }),
  erlang: lisp, ocaml: lang('let|in|if|then|else|match|with|fun|function|type|module|open|rec|begin|end|of|and|or', {}), fsharp: lang('let|in|if|then|else|match|with|fun|function|type|module|open|rec|begin|end|of|and|or', {}),
};

/** Highlights `code` for `language`. Always safe: falls back to escaped plain text. */
export function highlight(language, code) {
  const fn = TABLE[language];
  if (!fn || code.length > 200000) return esc(code);
  try { return fn(code); } catch { return esc(code); }
}
