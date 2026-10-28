import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {academicProfileURL,indexedScholarMetrics,parseAcademicMetrics,orcidPublicationCount,bestAcademicMetrics,academicInformationPatch,discoverAcademicProfiles,wikidataAcademicLinks} from '../supabase/functions/_shared/academic-profiles.js';
test('German Scholar domains and ORCID-linked Wikidata identities resolve without accepting a namesake',()=>{
 assert.equal(academicProfileURL('https://scholar.google.de/citations?user=iwzqdyQAAAAJ').url,'https://scholar.google.com/citations?user=iwzqdyQAAAAJ');
 const value=v=>[{mainsnak:{datavalue:{value:v}}}],entity={labels:{en:{value:'Jürgen Kurths'}},claims:{P496:value('0000-0002-5926-4276'),P1960:value('iwzqdyQAAAAJ')}},person={english_name:'Jürgen Kurths',orcid:'0000-0002-5926-4276'};
 assert.equal(wikidataAcademicLinks(entity,person)[0].provider,'scholar');assert.equal(wikidataAcademicLinks(entity,{...person,orcid:'0000-0001-1111-1111'}).length,0);assert.equal(wikidataAcademicLinks(entity,{...person,orcid:''}).length,0);
});
test('verified author homepage supplies academic links while already complete providers are not fetched',async()=>{
 const scholar='https://scholar.google.com/citations?user=Alice123',rg='https://www.researchgate.net/profile/Alice-Smith',calls=[];
 const person={english_name:'Alice Smith',aliases:['Alice Smith'],original_names:['Alice Smith'],institution:'Example University',papers:[],profile_url:'https://example.edu/alice',researchgate_url:rg,academic_metrics:{best:{publications:{value:25},citations:{value:0},h_index:{value:12}}}};
 const rows=await discoverAcademicProfiles(person,parseHTML,{missingOnly:true,resolve:async()=>['8.8.8.8'],fetcher:async value=>{const url=new URL(value);calls.push(url.href);if(url.href===person.profile_url)return new Response('<h1>Alice Smith</h1><a href="'+scholar+'">Scholar</a><a href="'+rg+'">RG</a>');if(url.hostname==='scholar.google.com'&&url.pathname==='/citations')return new Response('<h1>Alice Smith</h1><table id="gsc_rsb_st"><tr><td>i10-index</td><td>18</td></tr></table>');return new Response('<rss></rss>');}});
 assert(!calls.includes(rg));const patch=academicInformationPatch(person,rows,{missingOnly:true});assert.equal(patch.scholar_url,scholar);assert.equal(patch.academic_metrics.best.i10_index.value,18);assert.equal(patch.academic_metrics.best.citations.value,0);assert.equal(patch.researchgate_url,undefined);
});
test('academic URLs identify actual author profiles and discard tracking, publications and spoofed hosts',()=>{
 assert.deepEqual(academicProfileURL('https://scholar.google.com/citations?hl=en&user=abcdEFG'),{provider:'scholar',url:'https://scholar.google.com/citations?user=abcdEFG'});
 assert.equal(academicProfileURL('https://www.researchgate.net/profile/Alice-Smith/').provider,'researchgate');
 for(const url of ['https://scholar.google.com.evil.org/citations?user=abcdEFG','https://www.researchgate.net/publication/123','https://scholar.google.com/citations?view_op=search_authors','http://scholar.google.com/citations?user=abcdEFG'])assert.equal(academicProfileURL(url),null);
});
test('Scholar reads lifetime metrics, not recent years, and refuses a partial publication total',()=>{
 const html='<table id="gsc_rsb_st"><tr><td>Citations</td><td>12,345</td><td>4,321</td></tr><tr><td>h-index</td><td>42</td><td>30</td></tr><tr><td>i10-index</td><td>60</td><td>33</td></tr></table><tr class="gsc_a_tr"></tr>';
 assert.deepEqual(parseAcademicMetrics(html,'scholar',parseHTML),{citations:12345,h_index:42,i10_index:60});
 assert.equal(parseAcademicMetrics(html+'<button id="gsc_bpf_more" disabled></button>','scholar',parseHTML).publications,1);
});
test('RG metrics exclude reads, recommendations and estimated abbreviated numbers',()=>{
 assert.deepEqual(parseAcademicMetrics('<html><body><main>Publications (245) Citations 12,345 h-index 43 Reads 999999</main></body></html>','researchgate',parseHTML),{publications:245,citations:12345,h_index:43});
 assert.deepEqual(parseAcademicMetrics('<main>Reads 9999 Citations 1.2k</main>','researchgate',parseHTML),{});
 assert.equal(orcidPublicationCount({group:[{'work-summary':[{type:'journal-article'},{type:'journal-article'}]},{'work-summary':[{type:'preprint'}]},{'work-summary':[{type:'data-set'}]}]}),2);
});
test('metrics select the maximum per field across verified providers and retain evidence on source outages',()=>{
 const s={provider:'scholar',url:'https://scholar.google.com/citations?user=abcd',checked_at:'2026-10-26',metrics:{citations:100,h_index:10,i10_index:12}},r={provider:'researchgate',url:'https://www.researchgate.net/profile/Alice',checked_at:'2026-10-26',metrics:{publications:30,citations:120,h_index:9}};
 const best=bestAcademicMetrics([s,r]);assert.equal(best.citations.value,120);assert.equal(best.h_index.value,10);assert.equal(best.i10_index.provider,'scholar');assert.equal(best.publications.value,30);
 const patch=academicInformationPatch({scholar_url:'manual',academic_metrics:{sources:[s]}},[{academic:{...s,metrics:{}}},{academic:r}]);assert.equal(patch.scholar_url,undefined);assert.equal(patch.researchgate_url,r.url);assert.equal(patch.academic_metrics.best.h_index.value,10);
 const newer=academicInformationPatch({academic_metrics:{sources:[s]}},[{academic:{...s,metrics:{citations:80},checked_at:'2026-10-27'}}]);assert.equal(newer.academic_metrics.best.citations.value,80);assert.equal(newer.academic_metrics.best.h_index.value,10);
});

test('indexed Scholar citations remain explicit and RG stat cards are not confused with navigation or reads',()=>{
 assert.deepEqual(indexedScholarMetrics('Alice Smith — Cited by 12,345 — Example University'),{citations:12345});assert.deepEqual(indexedScholarMetrics('Cited by 1.2k'),{});
 const html='<main><div>Publications</div><section><span>9,876</span><span>Citations</span></section><section><span>200</span><span>Publications</span></section><section><span>h-index</span><span>36</span></section><div>999,999 Reads</div></main>';
 assert.deepEqual(parseAcademicMetrics(html,'researchgate',parseHTML),{publications:200,citations:9876,h_index:36});
});
