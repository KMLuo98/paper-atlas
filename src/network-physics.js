import {communityAnchors} from './network-clusters.js';
import {forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY} from 'd3-force';
const idOf = node => typeof node === 'object' ? node.id : node;
export function networkMetrics(data) {
  const degree = new Map(data.nodes.map(n => [n.id, 0])), strength = new Map(degree);
  for (const edge of data.edges) for (const id of [idOf(edge.source), idOf(edge.target)]) {
    degree.set(id, (degree.get(id) || 0) + 1);
    strength.set(id, (strength.get(id) || 0) + data.similarity ? edge.weight : Math.max(1, Number(edge.weight) || 1));
  }
  const maximum = Math.max(1, ...strength.values());
  const radii = new Map(data.nodes.map(n => [n.id, (data.similarity ? 1.12 : 1) * Math.sqrt(196 + 1248 * Math.pow((strength.get(n.id) || 0) / maximum, .8))]));
  return {degree, radii};
}
function researchAnchors(clustering, regions, width, height) {
  const top=regions.filter(region=>region.parent===null);
  if(!top.length)return;
  const columns=Math.ceil(Math.sqrt(top.length));
  const spacing=Math.max(450,...top.map(region=>155*Math.sqrt(region.members.length)));
  function assign(region,center){
    clustering.centers.set(region.id,center);
    for(const id of region.members)clustering.groups.set(id,region.id);
    const children=regions.filter(child=>child.parent===region.id);
    const offset=Math.max(95,52*Math.sqrt(region.members.length));
    children.forEach((child,index)=>{
      const angle=index*2*Math.PI/children.length;
      assign(child,{x:center.x+Math.cos(angle)*offset,y:center.y+Math.sin(angle)*offset});
    });
  }
  const grouped=new Set(top.flatMap(region=>region.members));
  const ungrouped=new Set([...clustering.groups].filter(([id])=>!grouped.has(id)).map(([,group])=>group));
  const right=width/2+(columns+1)/2*spacing;
  [...ungrouped].forEach((id,index)=>clustering.centers.set(id,{
    x:right+(index%3)*160,y:height/2+(Math.floor(index/3)-(Math.ceil(ungrouped.size/3)-1)/2)*155
  }));
  top.forEach((region,index)=>assign(region,{
    x:width/2+(index%columns-(columns-1)/2)*spacing,
    y:height/2+(Math.floor(index/columns)-(Math.ceil(top.length/columns)-1)/2)*spacing
  }));
}
export function networkPhysics(data, width, height) {
  const {degree, radii} = networkMetrics(data), clustering = communityAnchors(data.nodes, data.layoutEdges || data.edges, width, height), memberIndex = new Map();
  if(data.similarity)researchAnchors(clustering,data.regions||[],width,height);
  const nodes = data.nodes.map(n => {
    const community = clustering.groups.get(n.id), center = clustering.centers.get(community), index = memberIndex.get(community) || 0;
    memberIndex.set(community, index + 1); const angle = index * 2.399963, r = Math.sqrt(index + 1) * 62;
    return {id: n.id, community, x: center.x + Math.cos(angle) * r, y: center.y + Math.sin(angle) * r};
  }), links = data.edges.map(edge => ({...edge}));
  const simulation = forceSimulation(nodes)
    .force('link', forceLink(links).id(n => n.id).distance(link => data.similarity ? 92 + 230 * (1 - link.weight) : (clustering.groups.get(idOf(link.source)) === clustering.groups.get(idOf(link.target)) ? 105 : 270) / (1 + Math.log1p(link.weight || 1) * .08)).strength(link => data.similarity ? .18 + .38 * link.weight : Math.min(.16, (.12 + Math.log1p(link.weight || 1) * .015) / Math.sqrt(Math.max(1, Math.min(degree.get(idOf(link.source)) || 1, degree.get(idOf(link.target)) || 1))))))
    .force('charge', forceManyBody().strength(data.similarity ? -210 : -390).distanceMax(750))
    .force('center', forceCenter(width / 2, height / 2).strength(.025))
    .force('x', forceX(n => clustering.centers.get(n.community).x).strength(data.similarity ? .14 : .06)).force('y', forceY(n => clustering.centers.get(n.community).y).strength(data.similarity ? .14 : .06))
    .force('collision', forceCollide(n => radii.get(n.id) + (data.similarity ? 13 : 29)).strength(1).iterations(4)).stop();
  return {nodes, simulation, ticks: Math.min(260, 120 + Math.floor(nodes.length / 3))};
}
export function computeNetworkLayout(data, width, height) {
  const {nodes, simulation, ticks} = networkPhysics(data, width, height);
  simulation.tick(ticks); simulation.stop();
  return nodes.map(({id, x, y, community}) => ({id, x, y, community}));
}
