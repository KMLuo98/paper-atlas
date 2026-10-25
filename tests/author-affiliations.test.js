import test from 'node:test';import assert from 'node:assert/strict';
import {parseAffiliations,authorAffiliations,recentAuthorAffiliations,countryName} from '../supabase/functions/_shared/author-affiliations.js';
import {scholarlyNameMatch,photoIdentityEvidence,authorPhotoIdentity} from '../supabase/functions/_shared/author-photos.js';
const orcid='0000-0002-1825-0097';
const paper=(id,date,institution)=>({id,title:'Paper '+id,published_at:date,authors:[{name:'Alice Smith',orcid,institution}]});
const person={english_name:'Alice Smith',first_name:'Alice',last_name:'Smith',aliases:['Alice Smith'],original_names:['Alice Smith'],orcid,institution:'',papers:[
 paper('a','2020-02-01','武汉大学数学与统计学院'),paper('b','2022-05-01','School of Physics, Wuhan University, Wuhan 430072, China'),
 paper('c','2024-03-01','Department of Physics, Harvard University, Cambridge, MA, USA'),
 paper('d','2025-09-01','School of Mathematics, Xidian University, China; Institute of Physics, University of Potsdam, Germany'),
 {...paper('e',null,'Department of Physics, Example University, Canada'),created_at:'2026-10-25T00:00:00Z'}]};
test('affiliations keep only parent institution and country and merge same-university departments',()=>{
 const parsed=parseAffiliations('School of Mathematics, Wuhan University, China; School of Physics, Wuhan University, China');assert.equal(parsed.length,1);assert.equal(parsed[0].school,'Wuhan University');assert.equal(parsed[0].country,'CN');
 assert.equal(parseAffiliations('华东师范大学物理与电子科学学院')[0].school,'East China Normal University');assert.equal(countryName('CN','en'),'China');
 const campuses=parseAffiliations('University of California, Berkeley, USA; University of California, Los Angeles, USA');assert.equal(campuses.length,2);assert.notEqual(campuses[0].key,campuses[1].key);
 assert.equal(parseAffiliations('Department of Physics, China').length,0);
});
test('publication dates order institution history; older absent institutions fade and the home shows at most three',()=>{
 const history=authorAffiliations(person),wuhan=history.find(r=>r.school==='Wuhan University');assert.equal(history.length,5);assert.equal(wuhan.records.length,2);assert.equal(wuhan.first_seen,'2020-02-01');assert.equal(wuhan.last_seen,'2022-05-01');assert(wuhan.historical);
 assert(history.filter(r=>r.last_seen==='2025-09-01').every(r=>!r.historical));assert.equal(history.at(-1).school,'Example University');assert.equal(history.at(-1).last_seen,null,'Upload date must not be treated as publication date');
 const recent=recentAuthorAffiliations(person);assert.equal(recent.length,3);assert(recent.every(r=>!r.school.includes('School of')));assert(!recent.some(r=>r.school==='Wuhan University'));
});
test('institution history never borrows another coauthor affiliation and treats manual additions as undated',()=>{
 const own={...person,institution:'New Example University, Germany',papers:[{...paper('one','2024-01-01','Wuhan University, China'),authors:[{name:'Bob Jones',institution:'Harvard University, USA'},{name:'Alice Smith',orcid,institution:'Wuhan University, China'}]}]};
 const rows=authorAffiliations(own);assert.equal(rows.length,2);assert(!rows.some(r=>r.school==='Harvard University'));assert.equal(rows[1].manual,true);assert.equal(rows[1].last_seen,null);
});
test('arXiv dates are valid dated evidence but missing dates do not establish a departure',()=>{
 const p={...person,papers:[paper('old','2022-01-01','Wuhan University, China'),{...paper('new',null,'Xidian University, China'),arxiv_date:'2024-07-01',journal:'arXiv'}]};
 const rows=authorAffiliations(p);assert.equal(rows[0].school,'Xidian University');assert.equal(rows[0].records[0].date_kind,'preprint');assert(rows[1].historical);
});
test('scholarly photo names tolerate hyphens, order, accents and initials while rejecting another person',()=>{
 for(const [a,b]of [['Jun-an Lu','Junan Lu'],['Jun-an Lu','Lu, Jun-an'],['Jun-an Lu','J.-A. Lu'],['Albert-László Barabási','Albert Laszlo Barabasi'],['Alice Smith','Dr. Alice Smith, PhD']])assert(scholarlyNameMatch(a,b),a+' / '+b);
 assert(!scholarlyNameMatch('Jun-an Lu','Jing Lu'));
});
test('photo matching uses the parent school and compatible identity evidence rather than the full department string',()=>{
 const identity=authorPhotoIdentity({...person,aliases:['Alice Smith'],original_names:['Alice Smith']});assert.equal(identity.organization,'University of Potsdam');assert(!identity.organization.includes('Institute of Physics'));
 assert(photoIdentityEvidence({name:'Jun-an Lu',aliases:[],organization:'Wuhan University',organization_aliases:['武汉大学'],orcid:''},{headings:['An interview with Junan Lu'],text:'Professor at Wuhan University',orcids:[]}));
 assert(photoIdentityEvidence({name:'Alice Smith',organization:'Universitat Pompeu Fabra',aliases:[]},{headings:['Alice Smith'],text:'Professor at Pompeu Fabra University',orcids:[]}));
 assert(!photoIdentityEvidence({name:'Alice Smith',organization:'Wuhan University',aliases:[],orcid},{headings:['Alice Smith'],text:'Wuhan University',orcids:['0000-0001-5109-3700']}));
});
