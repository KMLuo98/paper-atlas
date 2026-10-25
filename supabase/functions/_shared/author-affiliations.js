import {sameAuthor} from './author-identity.js';
const fold=value=>String(value||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const institutions=[
 ['Xidian University','CN','西安电子科技大学'],['Wuhan University of Technology','CN','武汉理工大学'],['Wuhan University','CN','武汉大学'],
 ['Huazhong University of Science and Technology','CN','华中科技大学'],['University of Science and Technology of China','CN','中国科学技术大学','USTC'],
 ['East China Normal University','CN','华东师范大学'],['Central China Normal University','CN','华中师范大学'],['South China Normal University','CN','华南师范大学'],
 ['Tongji University','CN','同济大学'],['Beijing Normal University','CN','北京师范大学'],['Peking University','CN','北京大学'],['Tsinghua University','CN','清华大学'],
 ['Shanghai Jiao Tong University','CN','上海交通大学','Shanghai Jiaotong University'],['Fudan University','CN','复旦大学'],['Zhejiang University','CN','浙江大学'],
 ['Nanjing University','CN','南京大学'],['Sun Yat-sen University','CN','中山大学'],['Xi’an Jiaotong University','CN','西安交通大学','Xian Jiaotong University'],
 ['University of Chinese Academy of Sciences','CN','中国科学院大学','University of the Chinese Academy of Sciences'],['Hong Kong Polytechnic University','CN','香港理工大学','The Hong Kong Polytechnic University'],
 ['Hong Kong University of Science and Technology','CN','香港科技大学'],['University of Hong Kong','CN','香港大学'],['City University of Hong Kong','CN','香港城市大学'],
 ['Harvard University','US','哈佛大学'],['Stanford University','US','斯坦福大学'],['Princeton University','US','普林斯顿大学'],
 ['Massachusetts Institute of Technology','US','MIT','麻省理工学院'],['California Institute of Technology','US','Caltech','加州理工学院'],
 ['University of Wisconsin-Madison','US','University of Wisconsin–Madison','威斯康星大学麦迪逊分校'],['University of Colorado Boulder','US','University of Colorado, Boulder','科罗拉多大学博尔德分校'],
 ['University of California, Berkeley','US','University of California at Berkeley','加州大学伯克利分校'],['University of California, Los Angeles','US','UCLA','加州大学洛杉矶分校'],
 ['University of California, San Diego','US','UCSD','加州大学圣迭戈分校'],['University of California, Santa Barbara','US','UCSB','加州大学圣巴巴拉分校'],
 ['Northeastern University','US','Northeastern University, Boston'],['Northeastern University','CN','东北大学'],['University of Notre Dame','US','圣母大学'],
 ['University of Oxford','GB','Oxford University','牛津大学'],['University of Cambridge','GB','Cambridge University','剑桥大学'],['University College London','GB','UCL','伦敦大学学院'],
 ['Imperial College London','GB','帝国理工学院'],['University of Warwick','GB','华威大学'],['University of Leicester','GB','莱斯特大学'],
 ['École Polytechnique Fédérale de Lausanne','CH','Ecole Polytechnique Federale de Lausanne','EPFL','洛桑联邦理工学院'],['ETH Zurich','CH','ETH Zürich','苏黎世联邦理工学院'],
 ['University of Potsdam','DE','Universität Potsdam','波茨坦大学'],['Humboldt University of Berlin','DE','Humboldt-Universität zu Berlin','柏林洪堡大学'],
 ['National University of Singapore','SG','新加坡国立大学','NUS'],['Nanyang Technological University','SG','南洋理工大学'],
 ['Universidad de Granada','ES','University of Granada','格拉纳达大学'],['University of Catania','IT','Università di Catania','卡塔尼亚大学'],
 ['University of Bologna','IT','Università di Bologna','博洛尼亚大学'],['Fondazione Bruno Kessler','IT','Bruno Kessler Foundation'],
 ['SASTRA Deemed University','IN','SASTRA University'],['National Institute of Technology Durgapur','IN','National Institute of Technology, Durgapur'],
 ['Google DeepMind','','DeepMind'],['Google','','Google Cloud AI Research','Google Research'],['Microsoft','','Microsoft Research'],['IBM','','IBM Research'],['OpenAI','','OpenAI Research']
].map(([school,country,...aliases],i)=>({id:'institution-'+i,school,country,aliases:[school,...aliases]}));
const countryAliases={CN:['China','PR China','P R China',"People’s Republic of China","People's Republic of China",'中国','中华人民共和国'],US:['USA','US','U.S.A.','United States','United States of America','美国'],GB:['UK','United Kingdom','Great Britain','英国'],DE:['Germany','Deutschland','德国'],CH:['Switzerland','Schweiz','Suisse','瑞士'],FR:['France','法国'],IT:['Italy','Italia','意大利'],ES:['Spain','España','西班牙'],SG:['Singapore','新加坡'],IN:['India','印度'],JP:['Japan','日本'],AU:['Australia','澳大利亚'],CA:['Canada','加拿大'],NL:['Netherlands','荷兰'],AT:['Austria','奥地利'],BE:['Belgium','比利时'],BR:['Brazil','巴西'],KR:['South Korea','Republic of Korea','韩国'],PT:['Portugal','葡萄牙'],SE:['Sweden','瑞典'],DK:['Denmark','丹麦'],FI:['Finland','芬兰'],IL:['Israel','以色列']};
const countryDisplays={en:new Intl.DisplayNames(['en'],{type:'region'}),zh:new Intl.DisplayNames(['zh-CN'],{type:'region'})};
const regionNames=new Map();for(const code of 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '))for(const name of [countryDisplays.en.of(code),countryDisplays.zh.of(code)])regionNames.set(fold(name),code);regionNames.set('turkey','TR');
export function affiliationCountry(raw){const parts=String(raw||'').split(/[,;，；\n]/).map(s=>fold(s.replace(/\b\d[\w-]*\b/g,''))).filter(Boolean);for(const [code,names]of Object.entries(countryAliases))if(names.some(name=>parts.includes(fold(name))))return code;for(const part of [...parts].reverse()){const code=regionNames.get(part);if(code&&!(code==='GE'&&!/Tbilisi|第比利斯/i.test(raw)))return code;}return '';}
export function countryName(code,language='zh'){try{return code?countryDisplays[language==='en'?'en':'zh'].of(code):'';}catch{return code||'';}}
const aliasRows=new Map();for(const row of institutions)for(const alias of row.aliases){const key=fold(alias);if(!aliasRows.has(key))aliasRows.set(key,[]);if(!aliasRows.get(key).includes(row))aliasRows.get(key).push(row);}
const known=institutions.flatMap(row=>row.aliases.map(alias=>({row,alias,key:fold(alias)}))).sort((a,b)=>b.key.length-a.key.length);
function cleanSegment(value){return String(value).replace(/^[\s\d*†‡()\[\]]+/g,'').replace(/\s+/g,' ').trim();}
const parsedCache=new Map();
export function parseAffiliations(value){const key=String(value||'');if(parsedCache.has(key))return parsedCache.get(key);const rows=parseAffiliationsUncached(key);parsedCache.set(key,rows);if(parsedCache.size>1500)parsedCache.delete(parsedCache.keys().next().value);return rows;}
function parseAffiliationsUncached(value){
 const result=[];
 for(const raw of String(value||'').split(/[;；\n]+/).map(s=>s.trim()).filter(Boolean)){
  const code=affiliationCountry(raw),compact=fold(raw),ranges=[],matches=[];
  for(const {row,alias,key}of known){const index=compact.indexOf(key);if(index<0||ranges.some(([start,end])=>index>=start&&index+key.length<=end))continue;
   if(key.length<=5&&!new RegExp('(?:^|[^A-Za-z])'+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:$|[^A-Za-z])','i').test(raw))continue;
   const same=aliasRows.get(key),preferred=code?same.find(r=>r.country===code):null;
   if(same.length>1&&!preferred&&!code){matches.push({key:'school:'+fold(row.school),school:row.school,country:'',aliases:[...new Set(same.flatMap(r=>r.aliases))],raw});}
   else{const selected=preferred||row;matches.push({key:'school:'+fold(selected.school)+':'+(selected.country||code),school:selected.school,country:code||selected.country,aliases:selected.aliases,raw});}
   ranges.push([index,index+key.length]);
  }
  // A university takes precedence over its internal departments and laboratories.
  if(matches.length){const universities=matches.filter(m=>/university|universit|école|polytechnique|college|大学|理工学院/i.test(m.school));result.push(...(universities.length?universities:matches));continue;}
  const segments=raw.split(/[,，]/).map(cleanSegment).filter(Boolean),university=segments.find(s=>/大学|\buniversit[\p{L}]*\b|\b(?:polytechnic|college)\b/iu.test(s));
  let school=university||segments.find(s=>!/^(?:department|school|faculty|laboratory|lab|center|centre)\b/i.test(s)&&/\binstitute\b|\bacademy\b|fondazione|foundation|研究院|研究所|科学院|医院|公司/i.test(s));
  if(school){const han=school.match(/[\p{Script=Han}·]{2,45}大学/u);if(han)school=han[0];else if(/^(?:department|school|faculty)\b/i.test(school)){school=school.match(/\bat\s+(.+)$/i)?.[1]||school.match(/\bUniversity\s+of\s+.+/i)?.[0]||'';}
   school=school.replace(/\s+\d{4,}.*$/,'').trim();
  }
  if(school)result.push({key:'school:'+fold(school),school,country:code,aliases:[school],raw});
 }
 return [...new Map(result.map(row=>[row.key,row])).values()];
}
function paperDate(p){for(const [date,kind]of [[p.published_at,'publication'],[p.arxiv_date,'preprint']]){if(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date)return {date,kind};}return {date:null,kind:'unknown'};}
export function authorAffiliations(person){
 const rows=new Map(),identity={name:person.english_name,aliases:person.aliases||person.original_names||[],orcid:person.orcid};
 let latestDate=null;
 for(const paper of person.papers||[]){const date=paperDate(paper);const values=(paper.authors||[]).filter(a=>sameAuthor(a,identity)).flatMap(a=>parseAffiliations(a.institution));
  if(values.length&&date.date&&(!latestDate||date.date>latestDate))latestDate=date.date;
  for(const affiliation of values){let entry=rows.get(affiliation.key);if(!entry){entry={...affiliation,first_seen:null,last_seen:null,records:[],manual:false};rows.set(affiliation.key,entry);}
   if(date.date&&(!entry.first_seen||date.date<entry.first_seen))entry.first_seen=date.date;
   if(date.date&&(!entry.last_seen||date.date>entry.last_seen)){entry.last_seen=date.date;entry.country=affiliation.country;}
   if(!entry.records.some(r=>r.paper_id===paper.id&&r.raw===affiliation.raw))entry.records.push({paper_id:paper.id,title:paper.title,date:date.date,date_kind:date.kind,raw:affiliation.raw});
  }
 }
 // Manual additions have no inferred publication/employment dates.
 for(const affiliation of parseAffiliations(person.institution||''))if(!rows.has(affiliation.key))rows.set(affiliation.key,{...affiliation,first_seen:null,last_seen:null,records:[],manual:true});
 return [...rows.values()].map(row=>({...row,historical:!!(latestDate&&row.last_seen&&row.last_seen<latestDate),records:row.records.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))})).sort((a,b)=>String(b.last_seen||'').localeCompare(String(a.last_seen||''))||a.school.localeCompare(b.school));
}
export function recentAuthorAffiliations(person,limit=3){return authorAffiliations(person).slice(0,limit);}
