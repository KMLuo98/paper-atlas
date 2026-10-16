// Emits one explicitly named source file for the authenticated GitHub publishing tool.
import fs from 'node:fs';
import path from 'node:path';
const filename=process.argv[2];
const allowed=['.env.example','.gitignore','README.md','index.html','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','vite.config.js'];
if(!filename||filename.includes('..')||path.isAbsolute(filename)||!(allowed.includes(filename)||/^(src|supabase|tests|public|\.github\/workflows|scripts)\//.test(filename)))throw new Error('Not a publishable source path');
if(/(?:^|\/)\.env(?:\.|$)/.test(filename)&&filename!=='.env.example')throw new Error('Environment secrets must never be published');
console.log(JSON.stringify({path:filename,content:fs.readFileSync(filename,'utf8')}));
