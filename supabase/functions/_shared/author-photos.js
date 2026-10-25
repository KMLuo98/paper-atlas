import {authorAffiliations} from './author-affiliations.js';
import {englishName} from './author-directory.js';
import {discoverPhotoCandidates} from '../mail-api/photo-sources.js';
import {safeFetch,bounded,text,publicPhotoURL} from '../mail-api/photos.js';
const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function authorPhotoIdentity(person){const schools=authorAffiliations(person),school=schools[0];return {name:englishName([person.english_name,...person.aliases])||person.original_names[0]||'',organization:school?.school||person.institution||'',organization_aliases:school?.aliases||[],aliases:person.aliases||[],orcid:person.orcid||'',email:'',profile_url:person.profile_url||''};}
function nameParts(value){let name=String(value||'').replace(/,?\s*(?:Ph\.?D\.?|M\.?Sc\.?|M\.?D\.?)$/i,'').replace(/^(?:professor|prof\.?|dr\.?|mr\.?|mrs\.?)\s+/i,'').split(/\s+[–—-]\s+|\|/)[0].trim();if(name.includes(',')){const [last,...first]=name.split(',');name=first.join(' ').trim()+' '+last.trim();}const words=name.split(/\s+/).map(w=>fold(w)).filter(Boolean);return {name,words,last:words.at(-1)||'',given:words.slice(0,-1).join(''),initials:name.split(/\s+/).slice(0,-1).flatMap(w=>w.split(/[-.]+/)).map(w=>fold(w)[0]||'').join('')};}
export function scholarlyNameMatch(expected,candidate){
 if(!expected||!candidate)return false;
 if(/[\p{Script=Han}]/u.test(expected))return fold(candidate).includes(fold(expected));
 const a=nameParts(expected),b=nameParts(candidate);if(!a.words.length||!b.words.length)return false;
 if(fold(a.name)===fold(b.name))return true;
 if(a.words.length===b.words.length&&a.words.every(w=>b.words.includes(w)))return true;
 if(a.words.length<2||b.words.length<2||a.last!==b.last)return false;
 if(a.given===b.given)return true;
 const initialsOnly=value=>value.split(/\s+/).slice(0,-1).flatMap(w=>w.split(/[-.]+/)).filter(Boolean).every(w=>fold(w).length===1);
 return initialsOnly(a.name)&&a.given===b.initials||initialsOnly(b.name)&&b.given===a.initials;
}
function orgFold(value){return fold(String(value).replace(/\buniv\.?\b/gi,'university').replace(/universität|universite|université|universitat/gi,'university'));}
export function photoIdentityEvidence(person,evidence){
 const names=[person.name,...(person.aliases||[])],orcid=String(person.orcid||'').replace(/[^\dX]/gi,'').toUpperCase();
 const identifiers=(evidence.orcids||[]).map(v=>String(v).replace(/[^\dX]/gi,'').toUpperCase());
 if(orcid&&identifiers.length===1&&identifiers[0]!==orcid)return false;
 const mention=(name,heading)=>{const n=nameParts(name);return n.words.length>=2&&n.words.slice(0,-1).some(w=>w.length>1)&&fold(heading).includes(fold(n.name));};
 const nameMatch=(evidence.headings||[]).some(h=>names.some(n=>scholarlyNameMatch(n,h)||mention(n,h)));
 const body=orgFold(evidence.text||''),organizations=[person.organization,...(person.organization_aliases||[])].filter(v=>fold(v).length>5);
 const organizationMatch=organizations.some(n=>{if(body.includes(orgFold(n)))return true;const words=String(n).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/universit[\p{L}]*/gu,'university').split(/[^\p{L}\p{N}]+/u).filter(Boolean),distinctive=words.filter(w=>!['the','of','and','university','institute','college','school','national','research','for','science','technology','academy'].includes(w));return distinctive.length>=2&&distinctive.every(word=>body.includes(fold(word)))&&words.some(w=>['university','institute','college','academy'].includes(w)&&body.includes(w));});
 return nameMatch&&(organizationMatch||!!(orcid&&identifiers.includes(orcid)));
}
export async function discoverAuthorPhotos(person,parseHTML,options={}){
 const result=await discoverPhotoCandidates(person,parseHTML,options);
 const pages=[...new Set(result.items.filter(item=>!item.exact&&publicPhotoURL(item.source)).map(item=>item.source))].slice(0,4),evidence=new Map();
 await Promise.allSettled(pages.map(async source=>{const {response}=await safeFetch(source,'text/html',options);if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();return;}const {document}=parseHTML(text(await bounded(response,900000)));for(const el of document.querySelectorAll('script,style,nav,footer'))el.remove();const headings=[...document.querySelectorAll('h1,h2,title')].map(el=>el.textContent.trim()),orcids=[...document.querySelectorAll('a[href*="orcid.org/"]')].map(el=>el.getAttribute('href').match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i)?.[0]).filter(Boolean);evidence.set(source,photoIdentityEvidence(person,{headings,orcids:[...new Set(orcids)],text:(document.body?.textContent||document.documentElement.textContent||'').slice(0,180000)}));}));
 return {...result,items:result.items.map(item=>({...item,exact:item.exact||evidence.get(item.source)===true}))};
}
