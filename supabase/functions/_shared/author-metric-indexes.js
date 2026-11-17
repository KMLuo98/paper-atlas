import {normalizeORCID} from './author-identity.js';
import {photoIdentityEvidence,scholarlyNameMatch} from './author-photos.js';
import {normalizeDOI} from './publication.js';

const titleKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function selectAuthor(rows, identity, titles, anchors = new Map()) {
  const orcid = normalizeORCID(identity.orcid);
  const eligible = rows.filter(row => !orcid || !row.orcid || normalizeORCID(row.orcid) === orcid);
  const exact = eligible.filter(row => orcid && normalizeORCID(row.orcid) === orcid);
  if (exact.length) return exact.sort((a,b) => (b.metrics.publications ?? -1) - (a.metrics.publications ?? -1))[0];

  const named = eligible.filter(row => [identity.name, ...identity.aliases].some(name => scholarlyNameMatch(name, row.name)));
  const anchored = named.filter(row => anchors.has(row.url)).sort((a,b) => anchors.get(b.url) - anchors.get(a.url));
  if (anchored.length) return anchors.get(anchored[0].url) > (anchors.get(anchored[1]?.url) || 0) ? anchored[0] : null;
  const published = named.filter(row => row.titles?.some(title => titles.has(titleKey(title))));
  if (published.length) return published.length === 1 ? published[0] : null;
  const affiliated = named.filter(row => row.affiliations.some(text => photoIdentityEvidence(identity, {headings:[row.name], text})));
  return affiliated.length === 1 ? affiliated[0] : null;
}

async function openAlexAuthors(person, identity, get) {
  const orcid = normalizeORCID(identity.orcid);
  const key = globalThis.Deno?.env.get('OPENALEX_API_KEY');
  const query = (resource, params) => get('https://api.openalex.org/' + resource + '?' + new URLSearchParams(key ? {...params,api_key:key} : params));
  const authors = params => query('authors', {select:'id,orcid,display_name,affiliations,works_count,cited_by_count,summary_stats', per_page:'20', ...params});
  const isAuthorID = id => /^https:\/\/openalex\.org\/A\d+$/.test(id);
  const dois = [...new Set((person.papers || []).map(p => normalizeDOI(p.doi)).filter(doi => /^10\.\d{4,9}\/[\w.()/;+\-]+$/i.test(doi)))].slice(0, 8);
  const [byIdentity, byDOI] = await Promise.allSettled([
    authors(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcid) ? {filter:'orcid:' + orcid} : {search:identity.name}),
    dois.length ? query('works', {filter:'doi:' + dois.map(doi => 'https://doi.org/' + doi).join('|'), select:'doi,authorships', per_page:String(dois.length)}) : null
  ]);
  const records = new Map((byIdentity.value?.results || []).filter(row => isAuthorID(row.id)).map(row => [row.id,row]));
  const evidence = new Map();
  for (const work of byDOI.value?.results || []) {
    const doi = normalizeDOI(work.doi);
    if (!dois.includes(doi)) continue;
    const matches = (work.authorships || []).filter(({author}) => isAuthorID(author?.id) && [identity.name,...identity.aliases].some(name => scholarlyNameMatch(name,author.display_name)));
    if (matches.length !== 1) continue;
    const {author,institutions} = matches[0];
    const match = evidence.get(author.id) || {dois:new Set(), affiliated:false};
    match.dois.add(doi);
    match.affiliated ||= (institutions || []).some(org => photoIdentityEvidence(identity,{headings:[author.display_name],text:org.display_name}));
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
    url:row.id, name:row.display_name, orcid:row.orcid,
    affiliations:(row.affiliations || []).map(item => item.institution?.display_name).filter(Boolean),
    metrics:{publications:row.works_count, citations:row.cited_by_count, h_index:row.summary_stats?.h_index, i10_index:row.summary_stats?.i10_index}
  }));
  return selectAuthor(rows,identity,new Set(),anchors);
}

export async function discoverAuthorMetricIndexes(person, identity, read, stamp) {
  const titles = new Set((person.papers || []).map(p => titleKey(p.title)).filter(title => title.length >= 12));
  const get = async url => JSON.parse(await read(url, 'application/json'));
  const indexes = await Promise.allSettled([
    openAlexAuthors(person,identity,get).then(row => ({provider:'OpenAlex',row})),
    (async () => {
      const url = new URL('https://api.semanticscholar.org/graph/v1/author/search');
      url.search = new URLSearchParams({query:identity.name, limit:'20', fields:'name,affiliations,externalIds,paperCount,citationCount,hIndex,papers.title'});
      const data = await get(url.href);
      const rows = (data.data || []).filter(row => /^\d+$/.test(row.authorId)).map(row => ({
        url:'https://www.semanticscholar.org/author/' + row.authorId, name:row.name, orcid:row.externalIds?.ORCID,
        affiliations:row.affiliations || [], titles:(row.papers || []).map(paper => paper.title),
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
    return [{url:row.url, title:row.name, text:provider + ' · ' + row.name, academic:{provider, url:row.url, metrics, checked_at:stamp}}];
  });
}
