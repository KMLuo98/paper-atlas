import {journalShort, normalize} from './core.js';

const stopWords = new Set('a an and are as at be by for from has in into is it of on or that the their these this to was were with using results study paper approach method model based show shows'.split(' '));
const neighborLimit = 4;

function terms(text) {
  const words = normalize(text).match(/[\p{Script=Han}]+|[\p{Script=Latin}\p{N}]+/gu) || [];
  return new Set(words.flatMap(word => {
    if (/\p{Script=Han}/u.test(word)) {
      const chars = [...word];
      return chars.slice(1).map((char, i) => chars[i] + char);
    }
    return word.length > 2 && !stopWords.has(word) ? [word] : [];
  }));
}

function features(paper) {
  const vector = new Map();
  const add = (term, weight) => vector.set(term, Math.max(weight, vector.get(term) || 0));
  const keywords = [...(paper.keywords || []), ...(paper.keyword_pairs || []).flatMap(pair => [pair?.zh, pair?.en])];
  for (const keyword of keywords) {
    const phrase = normalize(keyword || '');
    if (!phrase) continue;
    add('phrase:' + phrase, 4);
    for (const term of terms(phrase)) add(term, 2);
  }
  for (const term of terms(paper.title || '')) add(term, 1.7);
  for (const term of terms(String(paper.summary || '').slice(0, 2500))) add(term, .6);
  return vector;
}

export function researchNetwork(papers) {
  const nodes = papers.map(paper => ({id: paper.id, label: paper.title, short_label: journalShort(paper)}));
  const index = new Map(), vectors = papers.map(features), lengths = new Float64Array(nodes.length);
  vectors.forEach((vector, id) => {
    for (const [term, weight] of vector) {
      if (!index.has(term)) index.set(term, []);
      index.get(term).push([id, weight]);
    }
  });
  for (const entries of index.values()) {
    const idf = Math.log1p(nodes.length / entries.length);
    for (const entry of entries) {
      entry[1] *= idf;
      lengths[entry[0]] += entry[1] ** 2;
    }
  }
  const edges = new Map();
  vectors.forEach((vector, source) => {
    const overlaps = new Map();
    for (const term of vector.keys()) {
      const entries = index.get(term);
      if (!term.startsWith('phrase:') && nodes.length > 30 && entries.length > nodes.length * .7) continue;
      const weight = entries.find(([id]) => id === source)[1];
      for (const [target, otherWeight] of entries) {
        if (source !== target) overlaps.set(target, (overlaps.get(target) || 0) + weight * otherWeight);
      }
    }
    const neighbors = [...overlaps].map(([target, overlap]) => [target, overlap / Math.sqrt(lengths[source] * lengths[target])])
      .filter(([, score]) => score >= .16)
      .sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, neighborLimit);
    for (const [target, score] of neighbors) {
      const [first, second] = source < target ? [source, target] : [target, source];
      edges.set(first + ':' + second, {source: nodes[first].id, target: nodes[second].id, weight: Math.min(1, score)});
    }
  });
  return {nodes, edges: [...edges.values()], similarity: true};
}
