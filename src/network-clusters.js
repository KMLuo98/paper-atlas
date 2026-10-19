import {forceSimulation,forceLink,forceManyBody,forceCollide,forceX,forceY} from 'd3-force';
const idOf=n=>typeof n==='object'?n.id:n;
export function clusterNetwork(nodes,edges){
 const neighbors=new Map(nodes.map(n=>[n.id,new Map()])),degrees=new Map(nodes.map(n=>[n.id,0]));
 for(const e of edges){const a=idOf(e.source),b=idOf(e.target),w=Math.max(1,Number(e.weight)||1);if(a===b||!neighbors.has(a)||!neighbors.has(b))continue;neighbors.get(a).set(b,(neighbors.get(a).get(b)||0)+w);neighbors.get(b).set(a,(neighbors.get(b).get(a)||0)+w);degrees.set(a,degrees.get(a)+w);degrees.set(b,degrees.get(b)+w);}
 const groups=new Map(nodes.map(n=>[n.id,n.id])),totals=new Map(degrees),mass=[...degrees.values()].reduce((n,x)=>n+x,0);
 for(let pass=0;pass<30&&mass;pass++){let moved=0;for(const node of nodes){const id=node.id,own=groups.get(id),degree=degrees.get(id);if(!degree)continue;const weights=new Map();for(const [neighbor,w] of neighbors.get(id)){const group=groups.get(neighbor);weights.set(group,(weights.get(group)||0)+w);}totals.set(own,totals.get(own)-degree);let best=own,score=(weights.get(own)||0)-degree*(totals.get(own)||0)/mass;for(const [group,w] of weights){const gain=w-degree*(totals.get(group)||0)/mass;if(gain>score+1e-9){score=gain;best=group;}}groups.set(id,best);totals.set(best,(totals.get(best)||0)+degree);if(best!==own)moved++;}if(!moved)break;}
 const communities=new Map();for(const n of nodes){const id=groups.get(n.id);if(!communities.has(id))communities.set(id,{id,members:[]});communities.get(id).members.push(n.id);}
 return {groups,communities:[...communities.values()]};
}
export function communityAnchors(nodes,edges,width,height){
 const {groups,communities}=clusterNetwork(nodes,edges),centers=communities.map((c,i)=>({...c,x:width/2+Math.cos(i*2.399963)*Math.sqrt(i)*330,y:height/2+Math.sin(i*2.399963)*Math.sqrt(i)*330})),links=new Map();
 for(const edge of edges){const a=groups.get(idOf(edge.source)),b=groups.get(idOf(edge.target));if(a===b)continue;const [source,target]=[a,b].sort(),key=JSON.stringify([source,target]);if(!links.has(key))links.set(key,{source,target,weight:0});links.get(key).weight+=Number(edge.weight)||1;}
 const simulation=forceSimulation(centers).force('links',forceLink([...links.values()]).id(n=>n.id).distance(380).strength(.08)).force('charge',forceManyBody().strength(-1400)).force('collision',forceCollide(n=>80+Math.sqrt(n.members.length)*23).iterations(3)).force('x',forceX(width/2).strength(.018)).force('y',forceY(height/2).strength(.018)).stop();simulation.tick(180);simulation.stop();
 return {groups,centers:new Map(centers.map(c=>[c.id,c]))};
}
