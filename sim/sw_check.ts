// Pre-commit guard: if a file precached by sw.js is staged, sw.js VERSION must be bumped too,
// and every ASSETS entry must exist on disk. Run: deno task sw-check
const sw = Deno.readTextFileSync('sw.js');
const version = sw.match(/const VERSION = '([^']+)'/)?.[1];
const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]).filter((a) => a !== '');
const missing = assets.filter((a) => a.endsWith('/') ? false : !safeExists(a));
if (missing.length) fail(`sw.js ASSETS missing on disk: ${missing.join(', ')}`);

const staged = run('git', 'diff', '--cached', '--name-only').split('\n').filter(Boolean);
const cachedChanged = staged.filter((f) => assets.includes(f) && f !== 'sw.js');
if (cachedChanged.length) {
  const old = run('git', 'show', 'HEAD:sw.js').match(/const VERSION = '([^']+)'/)?.[1];
  if (old === version) fail(`${cachedChanged.join(', ')} staged but sw.js VERSION still '${version}' — bump it so clients drop the stale cache`);
}
console.log(`sw-check ok (${version}, ${assets.length} assets)`);

function run(...cmd: string[]) {
  const o = new Deno.Command(cmd[0], { args: cmd.slice(1), stdout: 'piped' }).outputSync();
  return new TextDecoder().decode(o.stdout);
}
function safeExists(p: string) {
  try {
    Deno.statSync(p);
    return true;
  } catch {
    return false;
  }
}
function fail(msg: string): never {
  console.error(`sw-check: ${msg}`);
  Deno.exit(1);
}
