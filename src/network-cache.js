import {authorNetwork, normalize, journalShort} from './core.js';
import {collaborationGroups} from '../supabase/functions/_shared/collaboration.js';

function boundedCache(limit) {
  const entries = new Map();
  return {
    get(key) {const value = entries.get(key); if (value) {entries.delete(key); entries.set(key, value);} return value;},
    set(key, value) {entries.delete(key); entries.set(key, value); while (entries.size > limit) entries.delete(entries.keys().next().value);},
    clear() {entries.clear();}
  };
}
const networks = boundedCache(6);
export const networkLayouts = boundedCache(6);
let currentOwner;
const rankings = new WeakMap();

export function indexedCitationNetwork(papers) {
  const doi = value => String(value || '').toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').trim();
  const byDoi = new Map(), byTitle = new Map();
  const add = (map, key, index) => {if (!map.has(key)) map.set(key, []); map.get(key).push(index);};
  papers.forEach((p, i) => {if (p.doi) add(byDoi, doi(p.doi), i); add(byTitle, normalize(p.title), i);});
  const edges = [], seen = new Set();
  for (const paper of papers) for (const ref of paper.references || []) {
    const first = indices => indices?.find(index => papers[index].id !== paper.id);
    const candidates = [ref.doi ? first(byDoi.get(doi(ref.doi))) : undefined, ref.title ? first(byTitle.get(normalize(ref.title))) : undefined].filter(index => index !== undefined);
    if (!candidates.length) continue;
    const target = papers[Math.min(...candidates)], key = JSON.stringify([paper.id, target.id]);
    if (!seen.has(key)) {seen.add(key); edges.push({source: paper.id, target: target.id, weight: 1});}
  }
  return {nodes: papers.map(p => ({id: p.id, label: p.title, short_label: journalShort(p)})), edges};
}

export function cachedNetwork(kind, papers, owner = 'local') {
  if (currentOwner !== owner) {networks.clear(); networkLayouts.clear(); currentOwner = owner;}
  // Include only graph inputs, never PDFs, extracted text or research summaries.
  const records = papers.map(p => kind === 'authors'
    ? [p.id, p.authors]
    : [p.id, p.title, p.doi, p.journal, p.journal_abbr, p.publication_status, (p.references || []).map(r => [r.title, r.doi])]);
  const key = JSON.stringify([owner, kind, records]);
  let data = networks.get(key);
  if (!data) {data = kind === 'authors' ? authorNetwork(papers) : indexedCitationNetwork(papers); networks.set(key, data);}
  return data;
}

export function cachedCollaborationGroups(data, size) {
  let sizes = rankings.get(data);
  if (!sizes) {sizes = new Map(); rankings.set(data, sizes);}
  if (!sizes.has(size)) {
    if (size === 2) {
      // Author edges already contain the distinct shared papers; avoid enumerating all author pairs again.
      const groups = data.edges.map(edge => {
        const members = [edge.source, edge.target].sort();
        return {members, source: members[0], target: members[1], weight: edge.weight, papers: edge.papers};
      }).sort((a, b) => b.weight - a.weight || a.members.join('|').localeCompare(b.members.join('|')));
      sizes.set(size, {groups: groups.slice(0, 100), truncated: false});
    } else sizes.set(size, collaborationGroups(data, size));
  }
  return sizes.get(size);
}
