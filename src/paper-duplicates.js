import {normalizeDOI} from '../supabase/functions/_shared/publication.js';

export function titleIdentity(title) {
  return String(title || '').replace(/^\s*\[[^\]]{1,90}\]\s*/, '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function duplicatePaperGroups(papers) {
  const owners = new Map(), groups = new Map(), parents = papers.map((_, index) => index);
  function root(index) {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  }
  papers.forEach((paper, index) => {
    const doi = normalizeDOI(paper.doi).toLowerCase(), title = titleIdentity(paper.title);
    for (const key of [/^10\.\d{4,9}\/\S+$/.test(doi) && 'doi:' + doi, title.length >= 8 && 'title:' + title].filter(Boolean)) {
      if (owners.has(key)) parents[root(index)] = root(owners.get(key));
      else owners.set(key, index);
    }
  });
  papers.forEach((paper, index) => {
    const key = root(index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(paper);
  });
  const quality = paper => Number(!!paper.favorite) * 16 + Number(!!paper.supplementary_files?.length) * 8
    + Number(paper.status === 'ready') * 4 + Number(paper.publication_status === 'published') * 2 + Number(!!paper.summary);
  return [...groups.values()].filter(group => group.length > 1).map(group => group.sort((a,b) =>
    quality(b) - quality(a) || String(a.created_at || '').localeCompare(String(b.created_at || ''))));
}
