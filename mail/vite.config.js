import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({root:fileURLToPath(new URL('.',import.meta.url)),base:'./',publicDir:false,server:{host:'127.0.0.1',port:5174,fs:{deny:['**/.env*','**/account and keywords.txt','**/.git/**']}},build:{outDir:'../dist/mail',emptyOutDir:true,target:'es2022'}});
