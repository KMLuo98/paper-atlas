import {authorAffiliations,recentAuthorAffiliations,countryName} from '../supabase/functions/_shared/author-affiliations.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {parseHTML} from 'linkedom';
import {escapeHTML} from '../src/core.js';
import {buildAuthorDirectory,filterAuthors,formattedAuthorName,publishedPaper,authorInstitutions,authorIndexValue,authorEnrichmentTasks,researchPapers,authorEnrichmentKey,searchAuthorPapers} from '../supabase/functions/_shared/author-directory.js';
const uid='12345678-1234-1234-1234-123456789012',orcid='0000-0002-1825-0097';
const papers=[{id:'a',status:'ready',title:'Research A',journal:'Physical Review E',publication_status:'published',published_at:'2024-01-01',authors:[{name:'Jun-an Lu',orcid,institution:'School of Physics, Wuhan University, Wuhan, China',email:'lu@example.edu',aliases:['陆君安']},{name:'Alice Smith',institution:'Example Institute'}]},{id:'b',status:'ready',title:'Research B',publication_status:'published',authors:[{name:'Junan Lu',orcid,institution:'Department of Mathematics, Second University, USA'}]}];
function fixture(){
 const {document,window}=parseHTML('<html><body><main id="app"></main></body></html>');Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const option=this.querySelector('option[selected]')||this.querySelector('option');return option?.getAttribute('value')??option?.textContent??'';},set(value){for(const option of this.querySelectorAll('option'))option.toggleAttribute('selected',option.getAttribute('value')===value);}});const storage=new Map(),rows=[],calls=[],routes=[];
 const db={from:table=>{assert.equal(table,'author_profiles');return {select(){return this;},eq(key,value){assert.equal(key,'user_id');assert.equal(value,uid);return this;},order(){return this;},range:async()=>({data:rows})};},storage:{from:()=>({createSignedUrls:async()=>({data:[]})})}};
 const context={document,db,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},getLanguage:()=> 'zh',e:escapeHTML,buildAuthorDirectory,filterAuthors,formattedAuthorName,publishedPaper,authorInstitutions,authorIndexValue,authorEnrichmentTasks,researchPapers,authorEnrichmentKey,searchAuthorPapers,authorAffiliations,recentAuthorAffiliations,countryName,journalFull:p=>p.journal||'',safeURL:x=>/^https:\/\//.test(x)?x:'',openPhotoInput(){},Date,Map,Set,URL,crypto,console,setTimeout,clearTimeout,location:{hash:'#/author-directory'},FormData:class{constructor(form){this.entries=[...form.querySelectorAll('input,textarea,select')].map(n=>[n.name,n.value]);}*[Symbol.iterator](){yield* this.entries;}},api:async(action,body)=>{calls.push({action,body});if(action==='author_photo_candidates')return {candidates:[{key:'image',image:'data:image/png;base64,aA==',title:'Jun-an Lu',source:'https://example.edu/faculty/lu',exact:true}]};const author=buildAuthorDirectory(papers,rows).find(p=>p.key===body.author_key||p.identity_keys.includes(body.author_key)),profile={...author.profile,id:author.profile?.id||(author.orcid?'saved':'alice-profile'),user_id:uid,identity_keys:author.identity_keys,first_name:author.first_name,last_name:author.last_name,aliases:author.aliases,institution:author.institution,email:author.email,orcid:author.orcid,keywords:[],...(body.profile||{})};if(action==='author_keywords'){profile.keywords=Array.from({length:10},(_,i)=>({zh:'研究词'+i,en:'topic '+i}));profile.research_summary='网络科学研究';profile.keywords_paper_ids=['a','b'];profile.keywords_generated_at=new Date().toISOString();profile.keywords_lookup_key=authorEnrichmentKey(author,'keywords');profile.keywords_lookup_status='ready';}if(action==='author_match_photo'){profile.photo_lookup_key=authorEnrichmentKey(author,'photo');profile.photo_lookup_status='not_found';}const existing=rows.findIndex(r=>r.id===profile.id);if(existing<0)rows.push(profile);else rows[existing]=profile;return {profile};}};
 const source=fs.readFileSync(new URL('../src/author-directory.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');vm.createContext(context);vm.runInContext(source,context);
 const state={user:{id:uid},papers:structuredClone(papers)},app=document.querySelector('#app');
 const ui=context.createAuthorDirectory({state,shell:(_,html)=>{app.innerHTML=html;},icon:()=>'',modal:(title,html)=>{const el=document.createElement('div');el.innerHTML='<h2>'+title+'</h2>'+html;document.body.append(el);return {el,close:()=>el.remove()};},busy:async(_,fn)=>fn(),toast(){},go:r=>routes.push(r),uiIcons(){}});
 return {ui,document,state,context,calls,routes,rows};
}
test('author cards/list show one English name, institution and published count with both sorts and three formats',async()=>{
 const f=fixture();await f.ui.renderList();const d=f.document;assert.equal(d.querySelectorAll('.author-entry').length,2);assert.equal(d.querySelector('.author-entry h2').textContent,'Alice Smith');assert(!d.querySelector('#authors-results').textContent.includes('陆君安'));
 d.querySelector('#authors-list').onclick();assert(d.querySelector('.author-entries.is-list'));const sort=d.querySelector('#authors-sort');sort.value='papers';sort.onchange({target:sort});assert.match(d.querySelector('.author-entry h2').textContent,/Lu/);assert.equal(d.querySelector('.author-entry .author-paper-count strong').textContent,'2');
 const format=d.querySelector('#authors-format');format.value='family_given';format.onchange({target:format});assert.match(d.querySelector('.author-entry h2').textContent,/^Lu, /);format.value='initial_family';format.onchange({target:format});assert.match(d.querySelector('.author-entry h2').textContent,/^J/);
 const search=d.querySelector('#authors-search');search.value='陆君安';search.oninput({target:search});assert.equal(d.querySelectorAll('.author-entry').length,1);
});
test('author details link all papers, allow editable names and email, and request research keywords for the selected author',async()=>{
 const f=fixture(),key='orcid:'+orcid,snapshot=structuredClone(f.state.papers);await f.ui.renderDetail(key);const d=f.document;
 assert.equal(d.querySelectorAll('.author-paper').length,2);assert.equal(d.querySelector('.author-paper-authors').textContent,'Jun-an Lu; Alice Smith');assert.equal(d.querySelectorAll('.author-paper-authors').length,2);assert(d.querySelector('.author-detail-grid>.author-papers'));assert(d.querySelector('.author-information'));assert(d.querySelector('#author-photo-auto'));assert(d.querySelector('#author-photo-manual'));const photoMenu=d.querySelector('.author-photo-menu');assert(photoMenu);assert(!photoMenu.hasAttribute('open'));assert.equal(photoMenu.querySelector('summary').textContent,'照片设置');assert.equal(photoMenu.querySelectorAll('button').length,3);
 await d.querySelector('#author-keywords').onclick({currentTarget:d.querySelector('#author-keywords')});assert.equal(f.calls[0].action,'author_keywords');assert.equal(f.calls[0].body.author_key,key);assert.match(f.routes.at(-1),/^author\/profile/);
 await f.ui.renderDetail('profile:saved');assert.equal(d.querySelectorAll('.author-keywords .badge').length,10);
 d.querySelector('#author-edit').onclick();const form=d.querySelector('#author-edit-form');form.querySelector('[name=email]').value='new@example.edu';form.querySelector('[name=last_name]').value='Lu';form.querySelector('[name=aliases]').value='Jun-an Lu\n陆君安\nLu Jun-An';
 await form.onsubmit({preventDefault(){},currentTarget:form});assert.equal(f.calls.at(-1).action,'author_save');assert.equal(f.calls.at(-1).body.profile.email,'new@example.edu');assert(f.calls.at(-1).body.profile.aliases.includes('Lu Jun-An'));assert.deepEqual(f.state.papers,snapshot);
});
test('automatic photo lookup previews candidates with source links and does not select a photo automatically',async()=>{
 const f=fixture();await f.ui.renderDetail('orcid:'+orcid);f.document.querySelector('#author-photo-auto').onclick();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].action,'author_photo_candidates');assert.equal(f.document.querySelectorAll('.author-photo-candidates img').length,1);assert(f.document.querySelector('[data-author-photo-pick]'));assert.equal(f.document.querySelector('.author-photo-candidates a').getAttribute('href'),'https://example.edu/faculty/lu');
});

test('right-side indices follow both sorts, counts have no suffix, and affiliations occupy separate lines',async()=>{
 const f=fixture();await f.ui.renderList();const d=f.document;
 assert.deepEqual([...d.querySelectorAll('[data-author-index]')].map(n=>n.textContent),['A','J']);
 const sort=d.querySelector('#authors-sort');sort.value='papers';sort.onchange({target:sort});assert.deepEqual([...d.querySelectorAll('[data-author-index]')].map(n=>n.textContent),['2','1']);
 assert.equal(d.querySelector('.author-paper-count').textContent,'2');assert.equal(d.querySelectorAll('.author-card-wrapper:first-of-type .author-institution-line').length,2);
 const button=d.querySelector('[data-author-index]'),anchor=d.getElementById(button.dataset.authorIndex);let jumped=false;anchor.scrollIntoView=()=>jumped=true;button.onclick();assert(jumped);
});
test('bulk photo matching starts one-click jobs without selecting ambiguous candidates',async()=>{
 const f=fixture();await f.ui.renderList();await f.document.querySelector('#authors-match-all').onclick();
 assert.equal(f.calls.filter(c=>c.action==='author_match_photo').length,2);assert(!f.calls.some(c=>c.action==='author_photo_candidates'));f.ui.stop();
});
test('automatic enrichment resumes from saved results and only reschedules authors affected by a new paper',async()=>{
 const f=fixture();await f.ui.renderList();f.ui.scheduleAutomatic();await new Promise(r=>setTimeout(r,1550));
 assert.equal(f.calls.filter(c=>c.action==='author_match_photo').length,2);assert.equal(f.calls.filter(c=>c.action==='author_keywords').length,2);
 const initial=f.calls.length;f.ui.scheduleAutomatic();await new Promise(r=>setTimeout(r,1550));assert.equal(f.calls.length,initial);
 f.state.papers.push({id:'new',title:'New arXiv study',journal:'arXiv',status:'ready',authors:[{name:'Jun-an Lu',orcid}]});f.ui.scheduleAutomatic();await new Promise(r=>setTimeout(r,1550));
 assert.equal(f.calls.filter(c=>c.action==='author_match_photo').length,3);assert.equal(f.calls.filter(c=>c.action==='author_keywords').length,3);f.ui.stop();
});

test('cards expose an independent edit button and scoped paper search combines typo tolerance with journal filtering',async()=>{
 const f=fixture();await f.ui.renderList();const d=f.document,button=d.querySelector('[data-author-card-edit]');assert(button);assert(!button.closest('a'));
 button.onclick({preventDefault(){},stopPropagation(){}});assert(d.querySelector('#author-edit-form'));
 await f.ui.renderDetail('orcid:'+orcid);const input=d.querySelector('#author-paper-search');input.value='Reserach A';input.oninput();assert.equal(d.querySelectorAll('.author-paper').length,1);
 const journals=d.querySelector('#author-paper-journal');assert(journals);input.value='';input.oninput();journals.value='Physical Review E';journals.onchange();assert.equal(d.querySelectorAll('.author-paper').length,1);assert.match(d.querySelector('.author-paper h3').textContent,/Research A/);
});
