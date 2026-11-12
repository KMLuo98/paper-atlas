import {clusterNetwork,communityAnchors} from './network-clusters.js';
import {forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY} from 'd3-force';
const idOf = node => typeof node === 'object' ? node.id : node;
export function networkMetrics(data) {
  const degree = new Map(data.nodes.map(n => [n.id, 0])), strength = new Map(degree);
  for (const edge of data.layoutEdges || data.edges) for (const id of [idOf(edge.source), idOf(edge.target)]) {
    degree.set(id, (degree.get(id) || 0) + 1);
    strength.set(id, (strength.get(id) || 0) + (data.similarity ? edge.weight : Math.max(1, Number(edge.weight) || 1)));
  }
  const maximum = Math.max(1, ...strength.values());
  const radii = new Map(data.nodes.map(n => [n.id, Math.sqrt(196 + (data.similarity ? 260 : 1248) * Math.pow((strength.get(n.id) || 0) / maximum, .8))]));
  return {degree, radii};
}
function researchAnchors(clustering, regions, width, height) {
  const top=regions.filter(region=>region.parent===null);
  const grouped=new Set(top.flatMap(region=>region.members));
  const ungrouped=new Map();
  for(const [id,group] of clustering.groups)if(!grouped.has(id))ungrouped.set(group,(ungrouped.get(group)||0)+1);
  const blocks=[...top.map(region=>({id:region.id,count:region.members.length,region})),
    ...[...ungrouped].map(([id,count])=>({id,count}))];
  const pack=forceSimulation(blocks)
    .force('collision',forceCollide(block=>28*Math.sqrt(block.count)+12).iterations(4))
    .force('x',forceX(width/2).strength(.10))
    .force('y',forceY(height/2).strength(.13)).stop();
  pack.tick(145);
  const memberships=new Map();
  function assign(region,center,branch) {
    clustering.centers.set(region.id,center);
    for(const id of region.members){
      if(!memberships.has(id))memberships.set(id,new Map());
      const membership=memberships.get(id),prior=membership.get(branch);
      if(!prior||prior.depth<region.depth)membership.set(branch,{id:region.id,depth:region.depth,center});
    }
    const children=regions.filter(child=>child.parent===region.id);
    const offset=children.length>1?17*Math.sqrt(region.members.length):0;
    children.forEach((child,index)=>{
      const angle=index*2*Math.PI/children.length;
      assign(child,{x:center.x+Math.cos(angle)*offset,y:center.y+Math.sin(angle)*offset},branch);
    });
  }
  for(const block of blocks){
    if(block.region)assign(block.region,block,block.id);
    else clustering.centers.set(block.id,block);
  }
  for(const [id,membership] of memberships){
    const entries=[...membership.values()];
    if(entries.length===1){clustering.groups.set(id,entries[0].id);continue;}
    const key=entries.map(entry=>entry.id).sort().join('|');
    clustering.centers.set(key,{
      x:entries.reduce((sum,entry)=>sum+entry.center.x,0)/entries.length,
      y:entries.reduce((sum,entry)=>sum+entry.center.y,0)/entries.length
    });
    clustering.groups.set(id,key);
  }
}
export function networkPhysics(data, width, height) {
  const {degree, radii} = networkMetrics(data);
  const clustering = data.similarity
    ? {groups:clusterNetwork(data.nodes,data.layoutEdges || data.edges).groups,centers:new Map()}
    : communityAnchors(data.nodes,data.edges,width,height);
  const memberIndex = new Map();
  if(data.similarity)researchAnchors(clustering,data.regions||[],width,height);
  const nodes = data.nodes.map(n => {
    const community = clustering.groups.get(n.id), center = clustering.centers.get(community), index = memberIndex.get(community) || 0;
    memberIndex.set(community, index + 1); const angle = index * 2.399963, r = Math.sqrt(index + 1) * (data.similarity ? 36 : 62);
    return {id: n.id, community, x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r};
  }), links = (data.layoutEdges || data.edges).map(edge => ({...edge}));
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(n => n.id).distance(link => data.similarity ? 65 + 105 * (1 - link.weight) : (clustering.groups.get(idOf(link.source)) === clustering.groups.get(idOf(link.target)) ? 105 : 270) / (1 + Math.log1p(link.weight || 1) * .08)).strength(link => data.similarity ? (link.source.community===link.target.community ? .18 + .38 * link.weight : .035) : Math.min(.16, (.12 + Math.log1p(link.weight || 1) * .015) / Math.sqrt(Math.max(1, Math.min(degree.get(idOf(link.source)) || 1, degree.get(idOf(link.target)) || 1))))))
    .force('charge', forceManyBody().strength(data.similarity ? -95 : -390).distanceMax(750))
    .force('center', forceCenter(width / 2, height / 2).strength(.025))
    .force('x', forceX(n => clustering.centers.get(n.community).x).strength(data.similarity ? .21 : .06)).force('y', forceY(n => clustering.centers.get(n.community).y).strength(data.similarity ? .21 : .06))
    .force('collision', forceCollide(n => radii.get(n.id) + (data.similarity ? 4 : 29)).strength(1).iterations(4)).stop();
  return {nodes, simulation, ticks: Math.min(260, 120 + Math.floor(nodes.length / 3))};
}
export function computeNetworkLayout(data, width, height) {
  const {nodes, simulation, ticks} = networkPhysics(data, width, height);
  simulation.tick(ticks); simulation.stop();
  return nodes.map(({id, x, y, community}) => ({id, x, y, community}));
}
