import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
export const mailAddress='https://kmluo98.github.io/mail/';
const assetBase='https://kmluo98.github.io/paper-atlas/mail/';
export function mailPublication(html){
 const asset=value=>{const url=new URL(value,assetBase);if(url.origin!==new URL(assetBase).origin||!url.pathname.startsWith('/paper-atlas/mail/assets/'))throw Error('Unexpected mail asset path');return url.href;};
 const script=html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/i)?.[1];
 const styles=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)].map(m=>asset(m[1]));
 const icon=html.match(/<link\b[^>]*\brel="icon"[^>]*\bhref="([^"]+)"[^>]*>/i)?.[1];
 if(!script||!styles.length||!icon)throw Error('Mail build is missing its entry assets');
 const manifest={script:asset(script),styles,icon:asset(icon)};
 const redirect=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="canonical" href="${mailAddress}"><title>Mail Atlas · 新地址</title></head><body><p>邮件工作台已迁移到 <a href="${mailAddress}">${mailAddress}</a></p><script>location.replace(${JSON.stringify(mailAddress)}+location.search+location.hash)</script></body></html>`;
 return {manifest,redirect};
}
export async function publishMail(directory=new URL('../dist/mail/',import.meta.url)){
 const {manifest,redirect}=mailPublication(await readFile(new URL('index.html',directory),'utf8'));
 await writeFile(new URL('entry.json',directory),JSON.stringify(manifest));
 await writeFile(new URL('index.html',directory),redirect);
}
if(process.argv[1]===fileURLToPath(import.meta.url))await publishMail();
