import {publicPhotoURL,safeFetch,bounded,text} from '../mail-api/photos.js';
import {engineResults,bingImageResults} from '../mail-api/people-search.js';
import {readImage,imageCandidateKey} from '../mail-api/photo-sources.js';

export function researchGateProfile(value){
 const url=publicPhotoURL(value);if(!url)return '';const u=new URL(url);
 if(!/^(?:www\.)?researchgate\.net$/.test(u.hostname)||!/^\/profile\/[^/]+\/?$/.test(u.pathname))return '';
 return 'https://www.researchgate.net'+u.pathname.replace(/\/$/,'');
}
export function researchGateAvatar(value){
 const url=publicPhotoURL(value);if(!url)return '';const u=new URL(url);
 return /^(?:[a-z0-9-]+\.)?rgstatic\.net$/.test(u.hostname)&&/\/profile\.image\//i.test(u.pathname)&&! /default|placeholder|anonymous|publication|figure/i.test(u.pathname)?url:'';
}
export function researchGatePage(html,source,person,parseHTML,verify){
 if(!researchGateProfile(source))return [];
 const {document}=parseHTML(html),headings=[...document.querySelectorAll('h1,title')].map(x=>x.textContent.trim());
 if(/access denied|just a moment|verify you are human|security check/i.test(headings.join(' ')))return [];
 const orcids=[...document.querySelectorAll('a[href*="orcid.org/"]')].map(x=>x.getAttribute('href'));
 const images=[];const walk=x=>{if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(walk);return;}if([x['@type']].flat().includes('Person')&&verify(person,{headings:[x.name],orcids,text:document.body?.textContent||''}))for(const image of [x.image].flat())images.push(typeof image==='string'?image:image?.url||image?.contentUrl);if(x['@graph'])walk(x['@graph']);if(x.mainEntity)walk(x.mainEntity);};
 for(const script of document.querySelectorAll('script[type="application/ld+json"]'))try{walk(JSON.parse(script.textContent));}catch{}
 for(const el of document.querySelectorAll('script,style,nav,footer'))el.remove();
 const evidence={headings,orcids,text:(document.body?.textContent||document.documentElement.textContent||'').slice(0,180000)},exact=verify(person,evidence);
 // Open Graph belongs to the profile owner; arbitrary images can belong to suggested researchers.
 if(exact)images.push(document.querySelector('meta[property="og:image"]')?.getAttribute('content'));
 return [...new Set(images.map(researchGateAvatar).filter(Boolean))].map(url=>({url,source,title:headings[0]||person.name,provider:'ResearchGate',exact}));
}
export async function discoverResearchGatePhotos(person,parseHTML,options,verify){
 options={...options,deadline:Math.min(options.deadline||Infinity,Date.now()+35000)};
 const query='site:researchgate.net/profile/ "'+person.name+'"',make=(base,params)=>base+'?'+new URLSearchParams(params),name={name:person.name.split(/[\s,]+/).filter(Boolean).at(-1)||person.name};
 const urls=[make('https://www.bing.com/search',{q:query,format:'rss'}),make('https://www.google.com/search',{q:query,num:'6'}),make('https://www.bing.com/images/async',{q:query,first:'0',count:'20',mmasync:'1'})];
 const results=await Promise.allSettled(urls.map(async(url,i)=>{const {response}=await safeFetch(url,'text/html,application/rss+xml',options),html=text(await bounded(response,1600000));return i===2?{images:bingImageResults(html,name,parseHTML),pages:[]}:{pages:engineResults(html,url,parseHTML,name),images:[]};}));
 const pages=new Map(),indexed=[];
 for(const r of results)if(r.status==='fulfilled'){for(const p of r.value.pages){const source=researchGateProfile(p.url);if(source)pages.set(source,p);}for(const image of r.value.images){const source=researchGateProfile(image.source),url=researchGateAvatar(image.url);if(source&&url)indexed.push({...image,url,source,provider:'ResearchGate · 公开索引'});}}
 const explicit=researchGateProfile(person.profile_url);if(explicit&&!pages.has(explicit))pages.set(explicit,{title:person.name,snippet:''});
 const pageResults=await Promise.allSettled([...pages.keys()].slice(0,3).map(async source=>{const {response,url}=await safeFetch(source,'text/html',options);if(!researchGateProfile(url))return [];return researchGatePage(text(await bounded(response,900000)),source,person,parseHTML,verify);}));
 const candidates=pageResults.flatMap(r=>r.status==='fulfilled'?r.value:[]);
 for(const item of indexed){const page=pages.get(item.source);candidates.push({...item,exact:!!page&&verify(person,{headings:[page.title],text:page.snippet,orcids:(page.snippet||'').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/gi)||[]})});}
 const excluded=new Set((options.exclude||[]).map(imageCandidateKey)),seen=new Set();
 const reads=await Promise.allSettled(candidates.sort((a,b)=>Number(b.exact)-Number(a.exact)).filter(item=>{const key=imageCandidateKey(item.url);if(seen.has(key)||excluded.has(key))return false;seen.add(key);return true;}).slice(0,4).map(async item=>({...item,...await readImage(item.url,options,parseHTML),key:imageCandidateKey(item.url)})));
 return {items:reads.filter(r=>r.status==='fulfilled'&&r.value.bytes).map(r=>r.value),unavailable:results.every(r=>r.status==='rejected')};
}
