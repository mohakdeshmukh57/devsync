export const LANGS = {
  html: ['HTML', 'html'], css: ['CSS', 'css'], javascript: ['JavaScript', 'js'], typescript: ['TypeScript', 'ts'],
  python: ['Python', 'py'], java: ['Java', 'java'], c: ['C', 'c'], cpp: ['C++', 'cpp'], csharp: ['C#', 'cs'], go: ['Go', 'go'],
  rust: ['Rust', 'rs'], php: ['PHP', 'php'], ruby: ['Ruby', 'rb'], swift: ['Swift', 'swift'], kotlin: ['Kotlin', 'kt'], dart: ['Dart', 'dart'],
  sql: ['SQL', 'sql'], json: ['JSON', 'json'], yaml: ['YAML', 'yaml'], markdown: ['Markdown', 'md'], shell: ['Shell', 'sh'], plaintext: ['Plain Text', 'txt'],
  scala: ['Scala', 'scala'], perl: ['Perl', 'pl'], lua: ['Lua', 'lua'], r: ['R', 'r'], julia: ['Julia', 'jl'],
  elixir: ['Elixir', 'ex'], haskell: ['Haskell', 'hs'], clojure: ['Clojure', 'clj'], erlang: ['Erlang', 'erl'],
  zig: ['Zig', 'zig'], nim: ['Nim', 'nim'], ocaml: ['OCaml', 'ml'], fsharp: ['F#', 'fs'],
  groovy: ['Groovy', 'groovy'], assembly: ['Assembly', 'asm'], cobol: ['COBOL', 'cob'], fortran: ['Fortran', 'f90'],
  pascal: ['Pascal', 'pas'], vb: ['Visual Basic', 'vb'], objc: ['Objective-C', 'm'],
};

// extension -> language, used for uploads and renames
export const EXT_LANG = {
  ...Object.fromEntries(Object.entries(LANGS).map(([k, v]) => [v[1], k])),
  htm: 'html', scss: 'css', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', tsx: 'typescript',
  yml: 'yaml', bash: 'shell', h: 'c', hpp: 'cpp', cc: 'cpp', jsonc: 'json',
  csv: 'plaintext', xml: 'plaintext', svg: 'plaintext', toml: 'plaintext', ini: 'plaintext', env: 'plaintext',
  vue: 'plaintext', log: 'plaintext', gitignore: 'plaintext',
  exs: 'elixir', f: 'fortran', f95: 'fortran', for: 'fortran',
  ml: 'ocaml', mli: 'ocaml', pas: 'pascal', pp: 'pascal',
  asm: 'assembly', s: 'assembly', cob: 'cobol', cbl: 'cobol',
};

export const DEFAULT_SETTINGS = { fs: 13, tab: 2, pair: true };
export const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

export const extOf = name => {
  const dot = name.lastIndexOf('.');
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : '';
};
export const langFromName = (name, fallback = 'plaintext') => EXT_LANG[extOf(name)] || fallback;
export const isTextName = name => Boolean(EXT_LANG[extOf(name)]);

export const FEATURES = [
  ['Real-Time Collaboration', 'Edit the same file together — changes merge character by character with a CRDT, so nobody overwrites anybody.', '⚡'],
  ['Live Preview & Output', 'HTML, CSS and JavaScript render live in a sandboxed preview with a built-in console.', '◐'],
  ['30+ Languages', 'Run Python and JavaScript in the browser, plus C, C++, Rust, Go, Java, and 20+ more via a secure server runner.', '▶'],
  ['TV / Room Mode', 'Use a second screen for clean project output while you code.', '▣'],
  ['Invite Links', 'Share one secure meeting link with your collaborators.', '↗'],
  ['Team Chat', 'Discuss implementation without opening another app.', '✉'],
  ['Video & Audio Meetings', 'Camera, microphone and screen sharing between collaborators, built on WebRTC.', '●'],
  ['Shared Terminal', 'Run commands through a sandboxed runner when one is connected.', '>_'],
  ['Multiple Code Panels', 'Split the editor to edit two files at once.', '▦'],
  ['Command Palette', 'Jump to files and run any action with Ctrl/Cmd + K.', '⌘'],
];
