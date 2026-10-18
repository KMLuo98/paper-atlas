// Enumerate intersecting author paper sets. Repeated identities in a paper never add weight.
export function collaborationGroups(network,size=2,{limit=100,budget=150000}={}){
 size=Math.max(2,Math.floor(size));const nodes=network.nodes.filter(n=>n.papers?.length).sort((a,b)=>String(a.id).localeCompare(String(b.id))),results=[];let visits=0,truncated=false;
 const sets=new Map(nodes.map(n=>[n.id,new Set(n.papers)]));
 function walk(prefix,start,shared){for(let i=start;i<nodes.length;i++){if(++visits>budget){truncated=true;return;}if(nodes.length-i<size-prefix.length)break;const n=nodes[i],next=shared?shared.filter(id=>sets.get(n.id).has(id)):[...sets.get(n.id)];if(!next.length)continue;const members=[...prefix,n.id];if(members.length===size)results.push({members,source:members[0],target:members[1],weight:next.length,papers:next});else walk(members,i+1,next);if(truncated)return;}}
 walk([],0,null);results.sort((a,b)=>b.weight-a.weight||a.members.join('|').localeCompare(b.members.join('|')));return {groups:results.slice(0,limit),truncated};
}
