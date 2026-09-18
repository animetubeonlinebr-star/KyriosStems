/**
 * KyriosStems - verificacao de integridade do projeto.
 *
 * Roda no CI e localmente. Nao depende de servicos externos: confere que os
 * modulos resolvem, que os simbolos importados existem, que toda classe usada
 * pelo JavaScript tem estilo e que as paginas carregam os arquivos certos.
 *
 * Executar:
 *   node tests/check-project.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = ['index.html', 'song.html', 'login.html', 'admin.html'];

let problems = 0;
let checks = 0;

function fail(message) {
  console.log(`  FALHA ${message}`);
  problems += 1;
}

function ok(message) {
  checks += 1;
  console.log(`  ok    ${message}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
  );
}

const jsFiles = walk(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'));

/** Nomes declarados com export em um modulo. */
function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/g)) {
    names.add(m[1]);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
}

function stripInterpolations(text) {
  let out = text;
  let previous;
  do {
    previous = out;
    out = out.replace(/\$\{[^{}]*\}/g, ' ');
  } while (out !== previous);
  return out;
}

// ---------------------------------------------------------------------------
// 1. Imports resolvem e os simbolos existem
// ---------------------------------------------------------------------------
console.log('\nModulos');

for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file);

  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = match[2];
    if (!spec.startsWith('.')) continue;

    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) {
      fail(`${relative} importa modulo inexistente: ${spec}`);
      continue;
    }

    const available = exportedNames(fs.readFileSync(target, 'utf8'));
    for (const raw of match[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name && !available.has(name)) {
        fail(`${relative} importa "${name}" que nao existe em ${spec}`);
      }
    }
  }
}
if (problems === 0) ok(`${jsFiles.length} modulos com imports validos`);

// ---------------------------------------------------------------------------
// 2. Declaracoes duplicadas de topo (erro que o --check nao detecta)
// ---------------------------------------------------------------------------
console.log('\nDeclaracoes');

const beforeDuplicates = problems;
for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file);
  const seen = new Map();

  for (const match of source.matchAll(
    /^(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm,
  )) {
    const name = match[1];
    if (seen.has(name)) {
      fail(`${relative} declara "${name}" mais de uma vez`);
    }
    seen.set(name, true);
  }
}
if (problems === beforeDuplicates) ok('nenhuma declaracao duplicada');

// ---------------------------------------------------------------------------
// 3. Toda classe usada pelo JavaScript tem estilo
// ---------------------------------------------------------------------------
console.log('\nEstilos');

const cssText = fs
  .readdirSync(path.join(ROOT, 'css'))
  .filter((f) => f.endsWith('.css'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'css', f), 'utf8'))
  .join('\n');

const runtimeOnly = new Set([
  'is-active',
  'is-current',
  'is-dragover',
  'has-value',
  'is-uploaded',
  'is-error',
  'is-done',
]);

const usedClasses = new Set();
for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/class:\s*(['"`])([\s\S]*?)\1/g)) {
    for (const cls of stripInterpolations(match[2]).split(/\s+/)) {
      const clean = cls.trim();
      if (clean && /^[a-z][a-z0-9_-]*$/i.test(clean)) usedClasses.add(clean);
    }
  }
}

const beforeStyles = problems;
for (const cls of usedClasses) {
  if (runtimeOnly.has(cls)) continue;
  if (!cssText.includes(`.${cls}`)) fail(`classe sem estilo no CSS: ${cls}`);
}
if (problems === beforeStyles) ok(`${usedClasses.size} classes usadas tem estilo`);

// Cores fixas fora dos tokens fragmentam o tema: uma troca de paleta deixa
// residuos para tras. Todo valor de cor deve sair de variables.css.
const themedFiles = ['global.css', 'components.css', 'catalog.css', 'song.css', 'admin.css'];
const beforeColors = problems;
for (const file of themedFiles) {
  const source = fs.readFileSync(path.join(ROOT, 'css', file), 'utf8');
  for (const line of source.split('\n')) {
    if (line.includes('data:image')) continue;
    if (/#[0-9A-Fa-f]{3,8}\b/.test(line)) {
      fail(`cor fixa em ${file}: ${line.trim()}`);
    }
  }
}
if (problems === beforeColors) ok('nenhuma cor fixa fora dos tokens');

// ---------------------------------------------------------------------------
// 4. Paginas existem e seus assets resolvem
// ---------------------------------------------------------------------------
console.log('\nPaginas');

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  if (!fs.existsSync(file)) {
    fail(`pagina ausente: ${page}`);
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  const assets = [
    ...html.matchAll(/(?:href|src)="([^"]+)"/g),
  ]
    .map((m) => m[1])
    .filter((href) => !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('data:'));

  for (const asset of assets) {
    if (!fs.existsSync(path.join(ROOT, asset))) {
      fail(`${page} referencia arquivo inexistente: ${asset}`);
    }
  }

  if (!/<script[^>]+type="module"/.test(html)) {
    fail(`${page} nao carrega um modulo`);
  }
}

if (problems === 0) ok(`${PAGES.length} paginas com assets resolvidos`);

// ---------------------------------------------------------------------------
// 5. Nenhum arquivo de midia versionado
// ---------------------------------------------------------------------------
console.log('\nPrivacidade');

const mediaExtensions = ['.wav', '.aif', '.aiff', '.flac', '.mp3', '.zip', '.rar', '.7z',
  '.rpp', '.als', '.cpr', '.ptx', '.flp', '.bwproject'];
const tracked = walk(ROOT)
  .filter((f) => !f.includes(`${path.sep}.git${path.sep}`))
  .filter((f) => !f.includes(`${path.sep}node_modules${path.sep}`))
  .filter((f) => mediaExtensions.includes(path.extname(f).toLowerCase()));

const beforeMedia = problems;
for (const file of tracked) {
  fail(`arquivo de midia no repositorio: ${path.relative(ROOT, file)}`);
}
if (problems === beforeMedia) ok('nenhum arquivo de midia versionado');

// ---------------------------------------------------------------------------

console.log(
  problems === 0
    ? `\nVERIFICACAO OK — ${checks} grupo(s) de checagem, 0 problema(s)`
    : `\n${problems} problema(s) encontrado(s)`,
);

process.exit(problems === 0 ? 0 : 1);