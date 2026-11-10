import { defineConfig } from 'vite';

const interfaceTypeScale = {
  postcssPlugin: 'paper-atlas-interface-type-scale',
  Declaration(declaration) {
    if (!/[\\/]src[\\/]/.test(declaration.source?.input.file || '')) return;
    const value = declaration.value;
    if (declaration.prop === 'font') {
      declaration.value = value.replace(/(^|\s)(\d+(?:\.\d+)?px)(?=\s|\/)/, (_, gap, size) => gap + `calc(${size} + 1pt)`);
    } else if (declaration.prop === 'font-size' && (/^\d+(?:\.\d+)?px$/.test(value) || value.startsWith('clamp('))) {
      declaration.value = `calc(${value} + 1pt)`;
    }
  }
};

export default defineConfig({
  base: './',
  server: {fs: {deny: ['.env', '.env.*', '**/account and keywords.txt', '**/.git/**']}},
  css: {postcss: {plugins: [interfaceTypeScale]}},
  build: {target: 'es2022'}
});
