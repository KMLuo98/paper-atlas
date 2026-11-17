import {normalizeORCID} from './author-identity.js';
import {photoIdentityEvidence,scholarlyNameMatch} from './author-photos.js';
import {normalizeDOI} from './publication.js';

const titleKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const validOrcid = id => /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id);
const hasName = (identity, ...names) => names.some(name => [identity.name, ...identity.aliases].some(alias => scholarlyNameMatch(alias, name)));
const hasAffiliation = (identity, name, affiliations) => affiliations.some(text => photoIdentityEvidence(identity, {headings:[name], text}));

function selectAuthor(rows, identity, titles, anchors = new Map()) {
  const orcid = normalizeORCID(identity.orcid);
  const eligible = rows.filter(row => !orcid || !row.orcid || normalizeORCID(row.orcid) === orcid);
  const exact = eligible.filter(row => orcid && normalizeORCID(row.orcid) === orcid);
  if (exact.length) return exact.sort((a,b) => (b.metrics.publications ?? -1) - (a.metrics.publications ?? -1))[0];

  const named = eligible.filter(row => hasName(identity, row.name, ...(row.alternatives || [])));
  const anchored = named.filter(row => anchors.has(row.url)).sort((a,b) => anchors.get(b.url) - anchors.get(a.url));
  if (anchored.length) return anchors.get(anchored[0].url) > (anchors.get(anchored[1]?.url) || 0) ? anchored[0] : null;
  const published = named.filter(row => row.titles?.some(title => titles.has(titleKey(title))));
  if (published.length) return published.length === 1 ? published[0] : null;
  const affiliated = named.filter(row => [row.name, ...(row.alternatives || [])].some(name => hasAffiliation(identity,name,row.affiliations)));
  return affiliated.length === 1 ? affiliated[0] : null;
}

async function verifiedRegistryOrcid(rows, identity, dois, titles, get) {
  const ids = [...new Set(rows.filter(row => hasName(identity,row.name,...row.alternatives) &&
    row.affiliations.length && [row.name,...row.alternatives].some(name => hasAffiliation(identity,name,row.affiliations)))
    .map(row => normalizeORCID(row.orcid)).filter(validOrcid))];
  if (!ids.length || ids.length > 3) return '';
  const checks = await Promise.allSettled(ids.map(async id => {
    const record = await get('https://pub.orcid.org/v3.0/' + id + '/record');
    const name = record.person?.name;
    const full = [name?.['given-names']?.value,name?.['family-name']?.value].filter(Boolean).join(' ');
    const credit = name?.['credit-name']?.value;
    if (!hasName(identity,full,credit)) return '';
    const activities = record['activities-summary'];
    const employment = (activities?.employments?.['affiliation-group'] || []).flatMap(group => group.summaries || []).map(row => row['employment-summary']?.organization?.name).filter(Boolean);
    if ([full,credit].filter(Boolean).some(name => hasAffiliation(identity,name,employment))) return id;
    const entries = (activities?.works?.group || []).flatMap(group => group['work-summary'] || []);
    const registryDois = [...new Set(entries.flatMap(work => work['external-ids']?.['external-id'] || []).filter(ext =>
      ext['external-id-type'] === 'doi' && ext['external-id-relationship'] === 'self').map(ext => normalizeDOI(ext['external-id-value'])).filter(doi => /^10\.\d{4,9}\/\S+$/.test(doi)))];
    if (entries.some(work => titles.has(titleKey(work.title?.title?.value))) || registryDois.some(doi => dois.includes(doi))) return id;
    const evidence = await Promise.allSettled(registryDois.slice(0,3).map(async doi => {
      const {message} = await get('https://api.crossref.org/works/' + encodeURIComponent(doi));
      if(normalizeDOI(message?.DOI)!==doi)return false;
      return (message.author || []).some(author => {
        const byline=[author.given,author.family].filter(Boolean).join(' ');
        return normalizeORCID(author.ORCID)===id && hasAffiliation(identity,byline,(author.affiliation||[]).map(org=>org.name));
      });
    }));
    if (evidence.some(check=>check.value===true)) return id;
    return '';
  }));
  const matches = checks.map(check => check.value).filter(Boolean);
  return matches.length === 1 && checks.every(check => check.status === 'fulfilled') ? matches[0] : '';
}

async function openAlexAuthors(person, identity, titles, get) {
  const orcid = normalizeORCID(identity.orcid);
  const key = globalThis.Deno?.env.get('OPENALEX_API_KEY');
  const query = (resource, params) => get('https://api.openalex.org/' + resource + '?' + new URLSearchParams(key ? {...params,api_key:key} : params));
  const select = 'id,orcid,display_name,display_name_alternatives,affiliations,works_count,cited_by_count,summary_stats';
  const authors = params => query('authors', {select, per_page:'20', ...params});
  const isAuthorID = id => /^https:\/\/openalex\.org\/A\d+$/.test(id);
  const dois = [...new Set((person.papers || []).map(p => normalizeDOI(p.doi)).filter(doi => /^10\.\d{4,9}\/[\w.()/;+\-]+$/i.test(doi)))].slice(0, 8);
  const [byIdentity, byDOI] = await Promise.allSettled([
    authors(validOrcid(orcid) ? {filter:'orcid:' + orcid} : {search:identity.name}),
    dois.length ? query('works', {filter:'doi:' + dois.map(doi => 'https://doi.org/' + doi).join('|'), select:'doi,authorships', per_page:String(dois.length)}) : null
  ]);
  const records = new Map((byIdentity.value?.results || []).filter(row => isAuthorID(row.id)).map(row => [row.id,row]));
  if (validOrcid(orcid) && ![...records.values()].some(row => normalizeORCID(row.orcid) === orcid)) {
    try {
      const row = await query('authors/orcid:' + orcid,{select});
      if (isAuthorID(row.id) && normalizeORCID(row.orcid) === orcid) records.set(row.id,row);
    } catch { /* The public ORCID endpoint can fail independently of DOI evidence. */ }
  }
  const evidence = new Map();
  for (const work of byDOI.value?.results || []) {
    const doi = normalizeDOI(work.doi);
    if (!dois.includes(doi)) continue;
    const matches = (work.authorships || []).filter(({author,raw_author_name}) => isAuthorID(author?.id) && hasName(identity,author.display_name,raw_author_name));
    if (matches.length !== 1) continue;
    const {author,institutions,raw_author_name,raw_affiliation_strings} = matches[0];
    const match = evidence.get(author.id) || {dois:new Set(), affiliated:false};
    match.dois.add(doi);
    const affiliations=[...(institutions || []).map(org=>org.display_name),...(raw_affiliation_strings || [])];
    match.affiliated ||= [author.display_name,raw_author_name].filter(Boolean).some(name=>hasAffiliation(identity,name,affiliations));
    evidence.set(author.id,match);
  }
  const anchors = new Map([...evidence].filter(([,match]) => match.affiliated || match.dois.size >= 2).map(([id,match]) => [id,match.dois.size]));
  const unseen = [...anchors.keys()].filter(id => !records.has(id));
  if (unseen.length) {
    try {
      const data = await authors({filter:'openalex:' + unseen.map(id => id.split('/').at(-1)).join('|')});
      for (const row of data.results || []) if (anchors.has(row.id)) records.set(row.id,row);
    } catch { /* Name and ORCID results remain available. */ }
  }
  if (!records.size && orcid) {
    const data = await authors({search:identity.name});
    for (const row of data.results || []) if (isAuthorID(row.id)) records.set(row.id,row);
  }
  const rows = [...records.values()].map(row => ({
    url:row.id, name:row.display_name, alternatives:row.display_name_alternatives || [], orcid:row.orcid,
    affiliations:(row.affiliations || []).map(item => item.institution?.display_name).filter(Boolean),
    metrics:{publications:row.works_count, citations:row.cited_by_count, h_index:row.summary_stats?.h_index, i10_index:row.summary_stats?.i10_index}
  }));
  const verifiedOrcid = !orcid && await verifiedRegistryOrcid(rows,identity,dois,titles,get);
  const matched = selectAuthor(rows,verifiedOrcid ? {...identity,orcid:verifiedOrcid} : identity,new Set(),anchors);
  return matched && {...matched,verifiedOrcid};
}

export async function discoverAuthorMetricIndexes(person, identity, read, stamp) {
  const titles = new Set((person.papers || []).map(p => titleKey(p.title)).filter(title => title.length >= 12));
  const get = async url => JSON.parse(await read(url, 'application/json'));
  const indexes = await Promise.allSettled([
    openAlexAuthors(person,identity,titles,get).then(row => ({provider:'OpenAlex',row})),
    (async () => {
      const url = new URL('https://api.semanticscholar.org/graph/v1/author/search');
      url.search = new URLSearchParams({query:identity.name, limit:'20', fields:'name,aliases,affiliations,externalIds,paperCount,citationCount,hIndex,papers.title'});
      const data = await get(url.href);
      const rows = (data.data || []).filter(row => /^\d+$/.test(row.authorId)).map(row => ({
        url:'https://www.semanticscholar.org/author/' + row.authorId, name:row.name, orcid:row.externalIds?.ORCID,
        alternatives:row.aliases || [], affiliations:row.affiliations || [], titles:(row.papers || []).map(paper => paper.title),
        metrics:{publications:row.paperCount, citations:row.citationCount, h_index:row.hIndex}
      }));
      return {provider:'Semantic Scholar', row:selectAuthor(rows, identity, titles)};
    })()
  ]);

  return indexes.flatMap(result => {
    if (result.status !== 'fulfilled' || !result.value.row) return [];
    const {provider, row} = result.value;
    const metrics = Object.fromEntries(Object.entries(row.metrics).filter(([,value]) => Number.isSafeInteger(value) && value >= 0));
    if (!Object.keys(metrics).length) return [];
    return [{url:row.url, title:row.name, text:provider + ' · ' + row.name, ...(row.verifiedOrcid?{identity_fields:{orcid:row.verifiedOrcid}}:{}), academic:{provider, url:row.url, metrics, checked_at:stamp}}];
  });
}
