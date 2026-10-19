import {communityAnchors} from './network-clusters.js';
import {forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY} from 'd3-force';
const idOf = node => typeof node === 'object' ? node.id : node;
export function networkMetrics(data) {
  const degree = new Map(data.nodes.map(n => [n.id, 0])), strength = new Map(degree);
  for (const edge of data.edges) for (const id of [idOf(edge.source), idOf(edge.target)]) {
    degree.set(id, (degree.get(id) || 0) + 1);
    strength.set(id, (strength.get(id) || 0) + Math.max(1, Number(edge.weight) || 1));
  }
  const maximum = Math.max(1, ...strength.values());
  const radii = new Map(data.nodes.map(n => [n.id, Math.sqrt(196 + 1248 * Math.pow((strength.get(n.id) || 0) / maximum, .8))]));
  return {degree, radii};
}
export function networkPhysics(data, width, height) {
  const {degree, radii} = networkMetrics(data), clustering = communityAnchors(data.nodes, data.edges, width, height), memberIndex = new Map();
  const nodes = data.nodes.map(n => {
    const community = clustering.groups.get(n.id), center = clustering.centers.get(community), index = memberIndex.get(community) || 0;
    memberIndex.set(community, index + 1); const angle = index * 2.399963, r = Math.sqrt(index + 1) * 62;
    return {id: n.id, community, x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r};
  }), links = data.edges.map(edge => ({...edge}));
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(n => n.id).distance(link => (clustering.groups.get(idOf(link.source)) === clustering.groups.get(idOf(link.target)) ? 105 : 270) / (1 + Math.log1p(link.weight || 1) * .08)).strength(link => Math.min(.16, (.12 + Math.log1p(link.weight || 1) * .015) / Math.sqrt(Math.max(1, Math.min(degree.get(idOf(link.source)) || 1, degree.get(idOf(link.target)) || 1))))))
    .force('charge', forceManyBody().strength(-390).distanceMax(750))
    .force('center', forceCenter(width / 2, height / 2).strength(.025))
    .force('x', forceX(n => clustering.centers.get(n.community).x).strength(.06)).force('y', forceY(n => clustering.centers.get(n.community).y).strength(.06))
    .force('collision', forceCollide(n => radii.get(n.id) + 29).strength(1).iterations(4)).stop();
  return {nodes, simulation, ticks: Math.min(260, 120 + Math.floor(nodes.length / 3))};
}
export function computeNetworkLayout(data, width, height) {
  const {nodes, simulation, ticks} = networkPhysics(data, width, height);
  simulation.tick(ticks); simulation.stop();
  return nodes.map(({id, x, y, community}) => ({id, x, y, community}));
}
