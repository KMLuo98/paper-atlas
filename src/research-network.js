import {journalShort, normalize} from './core.js';
import {titleIdentity} from './paper-duplicates.js';

const stopWords = new Set('a an and are as at be by for from has in into is it of on or that the their these this to was were with using results study paper approach method model based show shows abstract problem question conclusion methods findings'.split(' '));
const topics = [
  {labels:['量子光学','Quantum optics'], hue:271, pattern:/quantum optics|quantum (?:light|photonic|optical)|photon (?:antibunching|bunching)|cavity qed|量子光学|量子光子|腔量子电动力学/i, children:[
    {labels:['腔量子电动力学','Cavity QED'], pattern:/cavity qed|cavity quantum electrodynamics|腔量子电动力学/i},
    {labels:['单光子','Single photons'], pattern:/single[- ]photon|单光子/i}
  ]},
  {labels:['复杂网络','Complex networks'], hue:158, pattern:/complex networks?|network science|复杂网络|网络科学|同步|synchroni[sz]/i, children:[
    {labels:['同步','Synchronization'], pattern:/synchroni[sz]|同步/i, children:[
      {labels:['遥同步','Remote synchronization'], pattern:/remote synchroni[sz]|遥同步|远程同步/i},
      {labels:['簇同步','Cluster synchronization'], pattern:/cluster synchroni[sz]|簇同步/i},
      {labels:['相位同步','Phase synchronization'], pattern:/phase synchroni[sz]|相位同步/i}
    ]},
    {labels:['网络重构','Network reconstruction'], pattern:/network (?:reconstruction|inference)|网络重构|网络推断/i},
    {labels:['网络韧性','Network resilience'], pattern:/network resilience|cascade failure|网络韧性|级联失效/i}
  ]},
  {labels:['非线性动力学','Nonlinear dynamics'], pattern:/nonlinear dynamics|chaos|bifurcation|非线性动力学|混沌|分岔/i, children:[
    {labels:['混沌','Chaos'], pattern:/chaos|chaotic|混沌/i},
    {labels:['分岔','Bifurcations'], pattern:/bifurcat|分岔/i}
  ]},
  {labels:['机器学习','Machine learning'], pattern:/machine learning|neural networks?|机器学习|神经网络/i, children:[
    {labels:['物理信息神经网络','Physics-informed neural networks'], pattern:/physics[- ]informed|物理信息神经网络/i}
  ]}
];

function words(text) {
  const chunks = normalize(text).match(/[\p{Script=Han}]+|[\p{Script=Latin}\p{N}]+/gu) || [];
  return new Set(chunks.flatMap(word => {
    if (/\p{Script=Han}/u.test(word)) {
      const chars = [...word];
      return chars.slice(1).map((char, index) => chars[index] + char);
    }
    return word.length > 2 && !stopWords.has(word) ? [word] : [];
  }));
}

export function researchNetwork(papers) {
  const nodes = papers.map(paper => ({id: paper.id, label: paper.title, short_label: journalShort(paper)}));
  const titles = papers.map(paper => titleIdentity(paper.title));
  const abstracts = papers.map(paper => String(paper.abstract || paper.summary || '').slice(0, 5000));
  const titleTexts = papers.map(paper => String(paper.title || '').replace(/^\s*\[[^\]]+\]\s*/, ''));
  const scores = new Map();

  function addScores(texts, field) {
    const index = new Map(), lengths = new Float64Array(nodes.length), vectors = texts.map(words);
    vectors.forEach((vector, id) => {
      for (const term of vector) {
        if (!index.has(term)) index.set(term, []);
        index.get(term).push(id);
      }
    });
    for (const entries of index.values()) {
      const squared = Math.log1p(nodes.length / entries.length) ** 2;
      for (const id of entries) lengths[id] += squared;
      for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
        const key = entries[i] * nodes.length + entries[j];
        if (!scores.has(key)) scores.set(key, [0, 0]);
        scores.get(key)[field] += squared;
      }
    }
    for (const [key, score] of scores) {
      if (score[field]) score[field] /= Math.sqrt(lengths[Math.floor(key / nodes.length)] * lengths[key % nodes.length]);
    }
  }
  addScores(titleTexts, 0);
  addScores(abstracts, 1);
  const identicalTitles = new Map();
  titles.forEach((title, index) => {
    if (title.length < 8) return;
    const matches = identicalTitles.get(title) || [];
    for (const other of matches) scores.set(other * nodes.length + index, [1, 1]);
    matches.push(index); identicalTitles.set(title, matches);
  });

  const related = [];
  for (const [key, [title, abstract]] of scores) {
    const first = Math.floor(key / nodes.length), second = key % nodes.length;
    const bothAbstracts = !!abstracts[first].trim() && !!abstracts[second].trim();
    const weight = Math.min(1, bothAbstracts ? .7 * title + .3 * abstract : title);
    const edge = {source: nodes[first].id, target: nodes[second].id, weight};
    if (weight >= .16) related.push(edge);
  }

  const regions = [], assigned = new Set();
  const texts = titleTexts.map((title, index) => title + ' ' + abstracts[index]);
  function region(topic, members, parent = null, depth = 0) {
    const matching = members.filter(index => topic.pattern.test(texts[index]));
    if (matching.length < 2) return [];
    const id = 'topic-' + regions.length;
    regions.push({id, parent, depth, labels: topic.labels, hue:topic.hue, members: matching.map(index => nodes[index].id)});
    const claimed = new Set();
    for (const child of topic.children || []) {
      for (const index of region(child, matching.filter(i => !claimed.has(i)), id, depth + 1)) claimed.add(index);
    }
    return matching;
  }
  for (const topic of topics) {
    for (const index of region(topic, papers.map((_, i) => i).filter(i => !assigned.has(i)))) assigned.add(index);
  }
  // For directions outside the vocabulary, name a region using a distinctive shared title term.
  const titleTerms = titleTexts.map(words), candidates = new Map(), indices=new Map(nodes.map((node,i)=>[node.id,i]));
  titleTerms.forEach((terms, index) => {
    for (const term of terms) {
      if (!candidates.has(term)) candidates.set(term, []);
      candidates.get(term).push(index);
    }
  });
  for (const edge of related.sort((a,b) => b.weight-a.weight)) {
    if (edge.weight < .30) break;
    const first = indices.get(edge.source), second = indices.get(edge.target);
    if (assigned.has(first) || assigned.has(second)) continue;
    const shared = [...titleTerms[first]].filter(term => titleTerms[second].has(term))
      .sort((a,b) => b.length-a.length || candidates.get(a).length-candidates.get(b).length);
    if (!shared.length) continue;
    const label = shared[0], members = candidates.get(label).filter(index => !assigned.has(index));
    if (members.length < 2) continue;
    regions.push({id:'topic-'+regions.length, parent:null, depth:0, labels:[label,label], members:members.map(index=>nodes[index].id)});
    members.forEach(index=>assigned.add(index));
  }

  const affinity = new Map();
  for (const edge of related) {
    for (const id of [edge.source,edge.target]) {
      if (!affinity.has(id)) affinity.set(id, []);
      const neighbors = affinity.get(id);
      if (neighbors.length < 4) neighbors.push(edge);
    }
  }
  return {nodes, edges:[], regions, layoutEdges:[...new Set([...affinity.values()].flat())], similarity:true};
}
