// Assemble dist/ en une seule page HTML autonome (pratique pour partager une version de test).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const assets = readdirSync('dist/assets');
const js = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.js')), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('dist/assets/' + assets.find((f) => f.endsWith('.css')), 'utf8');
const body = readFileSync('index.html', 'utf8').match(/<div id="app">[\s\S]*?<\/div>\s*(?=<script)/)[0];
const out = `<title>Le Grainier</title>
<style>html,body{height:100%}${css}:root{--safe-b:0px;--safe-t:0px}</style>
${body}
<script type="module">${js}</script>
`;
writeFileSync('dist/le-grainier.html', out);
console.log('dist/le-grainier.html', Math.round(out.length / 1024) + ' Ko');
