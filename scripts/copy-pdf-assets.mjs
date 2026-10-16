import fs from 'node:fs';
for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
  fs.cpSync(`node_modules/pdfjs-dist/${folder}`, `public/pdf-assets/${folder}`, {recursive: true});
}
