import {authorNetwork, normalize} from './core.js';
import {sameAuthor, normalizeORCID} from './author-identity.js';
const unique = values => [...new Set(values.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
export function publishedPaper(p) {
  if (p.publication_status === 'unpublished' || /^arxiv$/i.test(p.journal || '')) return false;
  return p.publication_status === 'published' || !!(p.journal && p.published_at);
}
export function englishName(names) {
  return unique(names).filter(n => /\p{Script=Latin}/u.test(n) && !/\p{Script=Han}/u.test(n))
    .sort((a, b) => b.replace(/[^\p{L}]/gu, '').length - a.replace(/[^\p{L}]/gu, '').length)[0] || '';
}
export function splitAuthorName(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (name.includes(',')) {const [last, ...first] = name.split(','); return {first_name: first.join(' ').trim(), last_name: last.trim()};}
  const parts = name.split(' '); return {first_name: parts.length > 1 ? parts.slice(0, -1).join(' ') : '', last_name: parts.at(-1) || ''};
}
export function formattedAuthorName(author, format = 'given_family') {
  const first = author.first_name || '', last = author.last_name || '';
  if (!first && !last) return author.english_name || '';
  format = author.name_format && author.name_format !== 'default' ? author.name_format : format;
  if (format === 'family_given') return [last, first].filter(Boolean).join(', ');
  if (format === 'initial_family') return [first.split(/\s+/).filter(Boolean).map(part => part.split('-').map(n => [...n][0]?.toUpperCase() + '.').join('-')).join(' '), last].filter(Boolean).join(' ');
  return [first, last].filter(Boolean).join(' ');
}
export function buildAuthorDirectory(papers, profiles = []) {
  papers = [...new Map(papers.filter(p => !p.deleted_at).map(p => [p.id, p])).values()];
  const raw = authorNetwork(papers), paperMap = new Map(papers.map(p => [p.id, p])), grouped = new Map();
  for (const person of raw.nodes) {
    const candidates = profiles.filter(p => {
      if (person.orcid && p.orcid && normalizeORCID(person.orcid) !== normalizeORCID(p.orcid)) return false;
      return p.identity_keys?.includes(person.id) || sameAuthor(person, {name: [p.first_name, p.last_name].filter(Boolean).join(' '), orcid: p.orcid, aliases: p.aliases || []});
    });
    const explicit = candidates.filter(p => p.identity_keys?.includes(person.id));
    let eligible = candidates;
    const known = new Set(eligible.map(p => normalizeORCID(p.orcid)).filter(Boolean));
    if (known.size > 1) eligible = explicit.length === 1 ? explicit : [];
    const profile = [...eligible].sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || a.id.localeCompare(b.id))[0];
    const key = profile ? 'profile:' + profile.id : person.id;
    if (!grouped.has(key)) grouped.set(key, {key, profile: profile || null, records: []});
    grouped.get(key).records.push(person);
  }
  return [...grouped.values()].map(({key, profile, records}) => {
    const names = unique(records.flatMap(r => [r.name, ...(r.aliases || [])]));
    const inferred = splitAuthorName(englishName(names)), first_name = profile ? profile.first_name : inferred.first_name, last_name = profile ? profile.last_name : inferred.last_name;
    const aliases = unique([...names, ...(profile?.aliases || []), [first_name, last_name].filter(Boolean).join(' ')]);
    const ownPapers = unique(records.flatMap(r => r.papers || [])).map(id => paperMap.get(id)).filter(Boolean).sort((a, b) => String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || '')));
    const institutions = unique([...records.map(r => r.institution), ...ownPapers.flatMap(p => (p.authors || []).filter(a => records.some(r => sameAuthor(a, r))).map(a => a.institution))]);
    return {key, profile, identity_keys: records.map(r => r.id), first_name, last_name, english_name: [first_name, last_name].filter(Boolean).join(' '),
      name_format: profile?.name_format || 'default', aliases, original_names: names, institution: profile?.institution ?? institutions[0] ?? '', institutions,
      email: profile?.email ?? records.find(r => r.email)?.email ?? '', orcid: profile?.orcid || records.find(r => r.orcid)?.orcid || '', profile_url: profile?.profile_url || '',
      papers: ownPapers, paper_count: ownPapers.length, published_count: ownPapers.filter(publishedPaper).length,
      photo_path: profile?.photo_path || '', photo_source: profile?.photo_source || '', photo_source_url: profile?.photo_source_url || '',
      keywords: profile?.keywords || [], research_summary: profile?.research_summary || '', keywords_paper_ids: profile?.keywords_paper_ids || [], keywords_generated_at: profile?.keywords_generated_at || null};
  });
}
export function filterAuthors(authors, query = '', sort = 'name', format = 'given_family') {
  const words = normalize(query).split(' ').filter(Boolean);
  return authors.filter(a => {const text = normalize([a.english_name, ...a.aliases, a.institution, ...a.institutions, a.email, a.orcid].join(' '));return words.every(w => text.includes(w));})
    .sort((a, b) => (sort === 'papers' ? b.published_count - a.published_count : 0) || formattedAuthorName(a, format).localeCompare(formattedAuthorName(b, format), 'en', {sensitivity: 'base'}) || a.key.localeCompare(b.key));
}
