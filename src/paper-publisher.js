import {normalizeDOI} from '../supabase/functions/_shared/publication.js';
import {journalFull} from '../supabase/functions/_shared/journals.js';

const doiPrefixes={
 '10.1038':'nature','10.1126':'science','10.1073':'pnas','10.1103':'aps','10.1002':'wiley',
 '10.1016':'elsevier','10.1063':'aip','10.1109':'ieee','10.1088':'iop','10.1007':'springer',
 '10.1080':'taylor','10.1137':'siam','10.1090':'ams','10.1093':'oup','10.1371':'plos',
 '10.7498':'cps','10.48550':'arxiv','10.1142':'worldscientific'
};
const journalPatterns=[
 ['nature',/^(?:nature(?:\s|$)|scientific reports$|communications (?:physics|biology|chemistry|materials|earth & environment)$|npj )/i],
 ['cell',/^(?:cell(?:$| reports\b| stem cell$| systems$| metabolism$| host & microbe$)|neuron$|molecular cell$|current biology$|iscience$)/i],
 ['science',/^science(?:$| advances$| robotics$| signaling$| immunology$| translational medicine$)/i],
 ['pnas',/^(?:pnas$|proceedings of the national academy of sciences)/i],
 ['aps',/^(?:physical review\b|reviews of modern physics$|PR[AEBCDLX]$)/i],
 ['aip',/^(?:chaos(?:: an interdisciplinary journal of nonlinear science)?$|(?:applied physics|chemical physics) letters$|journal of (?:applied|chemical|mathematical) physics$|physics of (?:fluids|plasmas)$)/i],
 ['ieee',/^ieee\b/i],['iop',/^(?:journal of physics[: ]|new journal of physics$|reports on progress in physics$|epl$)/i],
 ['elsevier',/^(?:chaos,? solitons|linear algebra and its applications$|physica [a-e]\b|physics reports$|applied mathematics and computation$|applied mathematical modelling$)/i],
 ['springer',/^nonlinear dynamics$/i],['siam',/^siam\b/i],['plos',/^plos\b/i],
 ['worldscientific',/^international journal of bifurcation and chaos$/i],
 ['taylor',/^linear and multilinear algebra$/i],['cps',/^(?:物理学报|acta physica sinica)$/i],['arxiv',/^arxiv$/i]
];

export function publisherKey(paper){
 const journal=journalFull(paper),doi=normalizeDOI(paper.doi).toLowerCase();
 if(paper.publication_status==='unpublished'||/^arxiv$/i.test(journal))return paper.arxiv_id||/^arxiv$/i.test(journal)||doi.startsWith('10.48550/arxiv.')?'arxiv':'';
 const prefix=doi.split('/')[0];
 const named=journalPatterns.find(([,pattern])=>pattern.test(journal))?.[0];
 if(named==='cell'&&(prefix==='10.1016'||!prefix))return named;
 return doiPrefixes[prefix]||named||'';
}
