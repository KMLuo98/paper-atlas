const entries = [
  ['Nature Communications','NC',['Nat Commun','Nat. Commun.','Nature Communication']],
  ['Nature Human Behaviour','NHB',['Nature Human Behavior','Nat Hum Behav']],
  ['Physical Review Letters','PRL',['Phys Rev Lett','Phys. Rev. Lett.']],
  ['Physical Review E','PRE',['Phys Rev E','Phys. Rev. E']],
  ['Physical Review Research','PRR',['Phys Rev Research','Phys. Rev. Research']],
  ['Physical Review X','PRX',['Phys Rev X']],
  ...['A','B','C','D'].map(letter=>['Physical Review '+letter,'PR'+letter,['Phys Rev '+letter]]),
  ['Chaos: An Interdisciplinary Journal of Nonlinear Science','Chaos',['Chaos','Chaos An Interdisciplinary Journal of Nonlinear Science']],
  ['Chaos, Solitons & Fractals','CSF',['Chaos Solitons and Fractals','Chaos, Solitons and Fractals','Chaos Solitons Fractals']],
  ['Science Advances','Sci Adv',['Sci. Adv.','SA']],
  ['Nature Neuroscience','Nat Neurosci',['Nat. Neurosci.']],
  ['Nature Physics','Nat Phys',['Nat. Phys.']],
  ['Nature','Nature',[]],['Science','Science',[]],
  ['物理学报','物理学报',['Acta Physica Sinica','Acta Phys. Sin.','Acta Phys Sin','物 理 学 报']],
  ['Nonlinear Dynamics','Nonlinear Dyn',['Nonlinear Dyn.']],
  ['Proceedings of the National Academy of Sciences','PNAS',['Proc Natl Acad Sci U S A','Proceedings of the National Academy of Sciences of the United States of America']]
];
const key=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');
const aliases = new Map(entries.flatMap(([title,abbr,other])=>[title,abbr,...other].map(alias=>[key(alias),{title,abbr}])));
export function journalRecord(p) {
  // A supplied full title takes precedence over an ambiguous acronym.
  return aliases.get(key(p.journal)) || (!p.journal ? aliases.get(key(p.journal_abbr)) : null);
}
export function journalFull(p) {
  if(p.publication_status==='unpublished')return '';
  return journalRecord(p)?.title || String(p.journal||p.journal_abbr||'').trim().replace(/\s+/g,' ');
}
export function normalizePaperJournal(p) {
  return {...p,journal:journalFull(p),journal_abbr:p.publication_status==='unpublished'?'':journalRecord(p)?.abbr||p.journal_abbr||''};
}
