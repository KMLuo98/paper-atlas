import { defineConfig } from 'vite';
export default defineConfig({ base: './', server:{fs:{deny:['.env','.env.*','**/account and keywords.txt','**/.git/**']}}, build: { target: 'es2022' } });
