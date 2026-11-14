// 把 assets/glsl/*.glsl 打包成 src/glsl.js（浏览器直接 import，不用 fetch）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'assets/glsl';
const files = readdirSync(dir).filter(f => f.endsWith('.glsl'));
const dsl = readFileSync(join(dir, '_dsl.glsl'), 'utf8');

let out = '// 自动生成：不要手改，改 assets/glsl/*.glsl 后重跑 tools/build-glsl.mjs\n';
out += 'export const DSL = ' + JSON.stringify(dsl) + ';\n\n';
out += 'export const SURFS = {\n';
for (const f of files) {
  if (f.startsWith('_')) continue;
  const name = f.replace(/\.glsl$/, '');
  const body = readFileSync(join(dir, f), 'utf8');
  out += '  ' + JSON.stringify(name) + ': ' + JSON.stringify(body) + ',\n';
}
out += '};\n';
writeFileSync('src/materials/glsl.js', out);
console.log('src/materials/glsl.js:', files.filter(f => !f.startsWith('_')).length, 'files,', (out.length / 1024).toFixed(1), 'KB');
