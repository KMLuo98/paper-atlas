import {communityAnchors} from './network-clusters.js';
import {getLanguage} from './i18n.js';
import {forceSimulation,forceLink,forceManyBody,forceCenter,forceCollide,forceX,forceY} from 'd3-force';

export function drawNetwork(svg,data,{authors=false,onClick=()=>{},onSelectionChange=()=>{}}={}){
 const width=Math.max(280,svg.clientWidth||840),height=Math.max(420,svg.clientHeight||620),ns='http://www.w3.org/2000/svg';
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const make=(name,attrs={})=>{const el=document.createElementNS(ns,name);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
 const idOf=node=>typeof node==='object'?node.id:node;
 const degree=new Map(data.nodes.map(n=>[n.id,0]));for(const edge of data.edges){degree.set(idOf(edge.source),(degree.get(idOf(edge.source))||0)+1);degree.set(idOf(edge.target),(degree.get(idOf(edge.target))||0)+1);}
 const strength=new Map(data.nodes.map(n=>[n.id,0]));for(const edge of data.edges){const value=Math.max(1,Number(edge.weight)||1);for(const id of [idOf(edge.source),idOf(edge.target)])strength.set(id,(strength.get(id)||0)+value);}const maxStrength=Math.max(1,...strength.values());
 const clustering=communityAnchors(data.nodes,data.edges,width,height),memberIndex=new Map();
 const radius=id=>Math.sqrt(196+1248*Math.pow((strength.get(id)||0)/maxStrength,.8)),nodes=data.nodes.map((n,i)=>{const group=clustering.groups.get(n.id),center=clustering.centers.get(group),index=memberIndex.get(group)||0;memberIndex.set(group,index+1);const angle=index*2.399963,r=Math.sqrt(index+1)*62;return {...n,community:group,x:center.x+Math.cos(angle)*r,y:center.y+Math.sin(angle)*r};}),links=data.edges.map(edge=>({...edge}));
 const markerId='network-arrow-'+Math.random().toString(36).slice(2),defs=make('defs'),marker=make('marker',{id:markerId,viewBox:'0 -5 10 10',refX:9,refY:0,markerWidth:7,markerHeight:7,orient:'auto'});marker.append(make('path',{d:'M0,-4L9,0L0,4',fill:'#8da880'}));defs.append(marker);for(const [suffix,color] of [['incoming','#2879b8'],['outgoing','#d46b38']]){const colored=marker.cloneNode(true);colored.id=markerId+'-'+suffix;colored.querySelector('path').setAttribute('fill',color);defs.append(colored);}svg.append(defs);
 const viewport=make('g',{'data-network-viewport':''});svg.append(viewport);
 const edgeEls=links.map(link=>{const el=make('line',{class:'network-edge',stroke:'#aec29e','stroke-width':authors?Math.min(4,1+Math.log1p(link.weight||1)):1.3,'stroke-opacity':links.length>nodes.length*3?.18:.42,...(!authors?{'marker-end':`url(#${markerId})`}:{})});viewport.append(el);return el;});
 let selected=null,labels=data.nodes.length<=40,scale=1,tx=0,ty=0,pan=null,disposed=false;
 const nodeEls=nodes.map((node,i)=>{
  const r=radius(node.id),g=make('g',{class:'node',tabindex:0,role:'button','aria-label':node.label,'aria-pressed':'false','data-node-id':node.id,'data-community':node.community});
  g.append(make('circle',{class:'selection-ring',r:r+8,fill:'none',stroke:'#d18b31','stroke-width':4,opacity:0}));
  g.append(make('circle',{r:r,fill:['#50764c','#87a76b','#b4bd87','#729180','#b49f6a'][i%5],stroke:'#fffefa','stroke-width':2}));
  const innerText=authors?node.name.split(' ').map(part=>part[0]).slice(0,2).join(''):(node.short_label==='未发表'&&getLanguage()==='en'?'Unpub.':node.short_label||'PDF'),textUnits=[...innerText].reduce((sum,char)=>sum+(/[\p{Script=Han}]/u.test(char)?1:.62),0),innerSize=r*Math.min(12/14,1.72/Math.max(1,textUnits)),labelSize=r*12/14;
  const inner=make('text',{'text-anchor':'middle',dy:innerSize*.35,class:'node-inner-label',style:`fill:#fffef9;font-size:${innerSize}px;font-weight:600`});inner.textContent=innerText;g.append(inner);
  const label=make('text',{y:r+labelSize*1.5,'text-anchor':'middle',class:'node-label',style:`font-size:${labelSize}px`});label.textContent=authors?node.name:node.label.length>27?node.label.slice(0,25)+'…':node.label;g.append(label);const title=make('title');title.textContent=node.label;g.append(title);viewport.append(g);
  let start=null,moved=false;
  g.onpointerdown=event=>{event.stopPropagation();start=[event.clientX,event.clientY];moved=false;g.setPointerCapture(event.pointerId);simulation.alphaTarget(.08).restart();node.fx=node.x;node.fy=node.y;};
  g.onpointermove=event=>{if(!start)return;if(Math.abs(event.clientX-start[0])+Math.abs(event.clientY-start[1])>4)moved=true;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(viewport.getScreenCTM().inverse());node.fx=local.x;node.fy=local.y;};
  g.onpointerup=()=>{if(!start)return;start=null;node.fx=null;node.fy=null;simulation.alphaTarget(0);if(!moved)onClick(node);};g.onpointercancel=()=>{start=null;node.fx=null;node.fy=null;simulation.alphaTarget(0);};
  g.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onClick(node);}};
  g.onmouseenter=g.onfocus=()=>{g.classList.add('hovered');paintSelection();};g.onmouseleave=g.onblur=()=>{g.classList.remove('hovered');paintSelection();};
  return g;
 });
 // Avoid a fixed viewport clamp: it piles peripheral nodes against the same boundary.
 // Link strengths are normalized by degree, so dense coauthor groups can spread out.
 const simulation=forceSimulation(nodes)
  .force('link',forceLink(links).id(n=>n.id).distance(link=>(clustering.groups.get(idOf(link.source))===clustering.groups.get(idOf(link.target))?105:270)/(1+Math.log1p(link.weight||1)*.08)).strength(link=>Math.min(.16,(.12+Math.log1p(link.weight||1)*.015)/Math.sqrt(Math.max(1,Math.min(degree.get(idOf(link.source))||1,degree.get(idOf(link.target))||1))))))
  .force('charge',forceManyBody().strength(-390).distanceMax(750))
  .force('center',forceCenter(width/2,height/2).strength(.025))
  .force('x',forceX(n=>clustering.centers.get(n.community).x).strength(.06)).force('y',forceY(n=>clustering.centers.get(n.community).y).strength(.06))
  .force('collision',forceCollide(n=>radius(n.id)+29).strength(1).iterations(4)).stop();
 simulation.tick(Math.min(260,120+Math.floor(nodes.length/3)));
 const transform=()=>viewport.setAttribute('transform',`translate(${tx},${ty}) scale(${scale})`);
 function paint(){edgeEls.forEach((el,i)=>{const edge=links[i];const dx=edge.target.x-edge.source.x,dy=edge.target.y-edge.source.y,distance=Math.hypot(dx,dy)||1,from=radius(edge.source.id)+2,to=radius(edge.target.id)+4;el.setAttribute('x1',edge.source.x+dx/distance*from);el.setAttribute('y1',edge.source.y+dy/distance*from);el.setAttribute('x2',edge.target.x-dx/distance*to);el.setAttribute('y2',edge.target.y-dy/distance*to);});nodeEls.forEach((el,i)=>el.setAttribute('transform',`translate(${nodes[i].x},${nodes[i].y})`));}
 function fit(){if(!nodes.length){scale=1;tx=0;ty=0;transform();return;}const left=Math.min(...nodes.map(n=>n.x-radius(n.id)))-50,right=Math.max(...nodes.map(n=>n.x+radius(n.id)))+50,top=Math.min(...nodes.map(n=>n.y-radius(n.id)))-50,bottom=Math.max(...nodes.map(n=>n.y+radius(n.id)))+60;scale=Math.min(1,(width-24)/(right-left),(height-24)/(bottom-top));tx=width/2-(left+right)/2*scale;ty=height/2-(top+bottom)/2*scale;transform();}
 function paintSelection(){const neighbors=new Set(selected?[selected]:[]);if(selected)links.forEach(edge=>{if(idOf(edge.source)===selected)neighbors.add(idOf(edge.target));if(idOf(edge.target)===selected)neighbors.add(idOf(edge.source));});nodeEls.forEach((el,i)=>{const id=nodes[i].id,isSelected=id===selected;el.classList.toggle('selected',isSelected);el.classList.toggle('network-muted',!!selected&&!neighbors.has(id));el.setAttribute('aria-pressed',String(isSelected));el.querySelector('.selection-ring').setAttribute('opacity',isSelected?'1':'0');el.querySelector('.node-label').style.display=labels?'':'none';});edgeEls.forEach((el,i)=>{const edge=links[i],active=!!selected&&(idOf(edge.source)===selected||idOf(edge.target)===selected);const incoming=!authors&&active&&idOf(edge.target)===selected,outgoing=!authors&&active&&idOf(edge.source)===selected;el.classList.toggle('selected-edge',active);el.classList.toggle('incoming-edge',incoming);el.classList.toggle('outgoing-edge',outgoing);el.setAttribute('stroke',incoming?'#2879b8':outgoing?'#d46b38':'#aec29e');if(!authors)el.setAttribute('marker-end',`url(#${markerId}${incoming?'-incoming':outgoing?'-outgoing':''})`);el.classList.toggle('network-muted',!!selected&&!active);});}
 function highlight(id,{focus=true}={}){selected=id&&id!==selected&&nodes.some(n=>n.id===id)?id:null;paintSelection();if(selected&&focus){const node=nodes.find(n=>n.id===selected);scale=Math.max(1,Math.min(1.3,scale));tx=width/2-node.x*scale;ty=height/2-node.y*scale;transform();}else if(!selected&&focus)fit();onSelectionChange(selected);return selected;}
 paint();fit();paintSelection();simulation.on('tick',()=>{if(!disposed)paint();});
 svg.onwheel=event=>{event.preventDefault();const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(svg.getScreenCTM().inverse()),next=Math.max(.12,Math.min(4,scale*Math.exp(-event.deltaY*.001)));tx=local.x-(local.x-tx)/scale*next;ty=local.y-(local.y-ty)/scale*next;scale=next;transform();};
 svg.onpointerdown=event=>{pan={x:event.clientX,y:event.clientY,tx,ty,moved:false};svg.setPointerCapture(event.pointerId);};svg.onpointermove=event=>{if(!pan)return;const rect=svg.getBoundingClientRect();pan.moved ||=Math.abs(event.clientX-pan.x)+Math.abs(event.clientY-pan.y)>4;tx=pan.tx+(event.clientX-pan.x)*width/rect.width;ty=pan.ty+(event.clientY-pan.y)*height/rect.height;transform();};svg.onpointerup=()=>{if(pan&&!pan.moved)highlight(null,{focus:false});pan=null;};svg.onpointercancel=()=>pan=null;
 return {destroy(){disposed=true;simulation.stop();svg.onwheel=svg.onpointerdown=svg.onpointermove=svg.onpointerup=svg.onpointercancel=null;},reset(){highlight(null,{focus:false});fit();},toggleLabels(){labels=!labels;paintSelection();return labels;},highlight};
}
