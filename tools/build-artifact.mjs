// Собирает сайт в один HTML-файл (dist/artifact.html) для просмотра на claude.ai:
// весь свой JS и CSS встраиваются в страницу, Three.js грузится с jsDelivr.
//   npx esbuild@0.24.0 --version   (нужен esbuild)
//   node tools/build-artifact.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const THREE_VER = '0.170.0';
const cdn = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}`;

const result = await build({
  entryPoints: [join(root, 'js/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2020',
  external: ['three', 'three/addons/*', 'three-mesh-bvh'],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(root, 'css/style.css'), 'utf8');

const importmap = {
  imports: {
    three: `${cdn}/build/three.module.min.js`,
    'three/addons/OrbitControls.js': `${cdn}/examples/jsm/controls/OrbitControls.js`,
    'three/addons/RoomEnvironment.js': `${cdn}/examples/jsm/environments/RoomEnvironment.js`,
    'three-mesh-bvh': 'https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.8.3/build/index.module.js',
  },
};

const html = `<title>AISUL Конструктор</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(readFileSync(join(root, "favicon.svg"), "utf8"))}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${css}
</style>
<script type="importmap">${JSON.stringify(importmap)}</script>
<div id="app"></div>
<script type="module">${js}</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), html);
console.log('dist/artifact.html', (html.length / 1024).toFixed(0) + ' KB');
