import {journalRecord} from './journals.js';
const clean = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const levels = {domain: 0, topic: 1, problem: 1, method: 2, phenomenon: 3, conclusion: 3};
export function normalizeKeywordPairs(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const zh = clean(item.zh, 100), en = clean(item.en, 150);
    if (!/[\p{Script=Han}]/u.test(zh) || !en || seen.has(zh)) return [];
    seen.add(zh);
    const kind = Object.hasOwn(levels, item.kind) ? item.kind : 'topic';
    const importance = Math.max(1, Math.min(100, Number(item.importance) || 100 - index));
    return [{zh, en, kind, importance}];
  }).sort((a, b) => levels[a.kind] - levels[b.kind] || b.importance - a.importance).slice(0, 10);
}
export function validKeywordHierarchy(pairs) {
  return pairs.length >= 8 && pairs.length <= 10 && pairs.some(k => k.kind === 'domain') && pairs.some(k => k.kind === 'topic' || k.kind === 'problem') && pairs.some(k => k.kind === 'method') && pairs.some(k => k.kind === 'phenomenon' || k.kind === 'conclusion');
}
export function keywordFields(pairs, extraTerms = []) {
  const keyword_pairs = normalizeKeywordPairs(pairs);
  return {keyword_pairs, keywords: keyword_pairs.map(k => k.zh), search_terms: [...new Set([...keyword_pairs.flatMap(k => [k.zh, k.en]), ...extraTerms.filter(t => typeof t === 'string').map(t => clean(t, 150))])].slice(0, 120)};
}
const journals = new Map([
  ['naturecommunications', 'NC'], ['natcommun', 'NC'], ['physicalreviewe', 'PRE'], ['physreve', 'PRE'], ['physicalreviewletters', 'PRL'], ['physrevlett', 'PRL'],
  ['naturehumanbehaviour', 'NHB'], ['naturehumanbehavior', 'NHB'], ['nathumbehav', 'NHB'],
  ['physicalreviewresearch', 'PRR'], ['physicalreviewx', 'PRX'], ['scienceadvances', 'Sci Adv'],
  ['natureneuroscience', 'Nat Neurosci'], ['naturephysics', 'Nat Phys'], ['nature', 'Nature'], ['science', 'Science']
]);
export function journalShort(p) {
  if (p.publication_status === 'unpublished') return p.arxiv_id||/^arxiv$/i.test(p.journal||'')?'arXiv':'未发表';
  const canonical=journalRecord(p);if(canonical)return canonical.abbr;
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const known = journals.get(normalize(p.journal)) || journals.get(normalize(p.journal_abbr));
  if (known) return known;
  const abbreviation = String(p.journal_abbr || '').trim();
  if (/^[A-Z][A-Z0-9 -]{0,11}$/.test(abbreviation)) return abbreviation.replace(/[.\s]/g, '');
  if (abbreviation && abbreviation.length <= 12) return abbreviation.replace(/\./g, '').trim();
  const full = String(p.journal || '').trim();
  if (/[\p{Script=Han}]/u.test(full)) return full.slice(0, 6);
  return full ? full.split(/\s+/).filter(w => !/^(of|the|and|in|on)$/i.test(w)).map(w => w[0]).join('').toUpperCase().slice(0, 8) : '待识别';
}
