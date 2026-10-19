// Keep all pointer state on the graph, so a second finger can take over a node drag.
export function mountNetworkGestures(svg,{width,height,getTransform,setTransform,nodeForTarget,onNodeStart=()=>{},onNodeMove=()=>{},onNodeEnd=()=>{},onNodeClick=()=>{},onBlankClick=()=>{}}){
 const pointers=new Map(),listeners=[],styleBefore={},minScale=Math.min(.12,getTransform().scale/4);let drag=null,pan=null,pinch=null;
 for(const property of ['touchAction','userSelect','webkitUserSelect','webkitTouchCallout']){styleBefore[property]=svg.style[property];svg.style[property]='none';}
 const prevent=event=>{if(event.cancelable!==false)event.preventDefault();};
 const local=point=>{const matrix=svg.getScreenCTM?.();if(matrix&&svg.createSVGPoint){const p=svg.createSVGPoint();p.x=point.clientX;p.y=point.clientY;return p.matrixTransform(matrix.inverse());}const rect=svg.getBoundingClientRect();return {x:(point.clientX-rect.left)*width/Math.max(1,rect.width),y:(point.clientY-rect.top)*height/Math.max(1,rect.height)};};
 function measure(){const [a,b]=[...pointers.values()].slice(0,2).map(local);return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
 function endDrag(){if(drag)onNodeEnd(drag.node);drag=null;}
 function beginPinch(){endDrag();pan=null;const point=measure(),t=getTransform();pinch={distance:point.distance,scale:t.scale,anchorX:(point.x-t.tx)/t.scale,anchorY:(point.y-t.ty)/t.scale};}
 function down(event){if(event.button>0)return;prevent(event);pointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});try{svg.setPointerCapture?.(event.pointerId);}catch{/* Legacy touch fallback has no pointer capture. */}
  if(pointers.size>=2){beginPinch();return;}const node=nodeForTarget(event.target),point=local(event),t=getTransform();
  if(node){drag={id:event.pointerId,node,startX:event.clientX,startY:event.clientY,moved:false};onNodeStart(node);}else pan={id:event.pointerId,x:point.x,y:point.y,tx:t.tx,ty:t.ty,moved:false};
 }
 function move(event){if(!pointers.has(event.pointerId))return;prevent(event);pointers.set(event.pointerId,{clientX:event.clientX,clientY:event.clientY});
  if(pointers.size>=2){if(!pinch)beginPinch();const point=measure(),scale=Math.max(minScale,Math.min(4,pinch.scale*point.distance/pinch.distance));setTransform({scale,tx:point.x-pinch.anchorX*scale,ty:point.y-pinch.anchorY*scale});return;}
  const point=local(event),t=getTransform();
  if(drag?.id===event.pointerId){drag.moved ||=Math.abs(event.clientX-drag.startX)+Math.abs(event.clientY-drag.startY)>4;onNodeMove(drag.node,{x:(point.x-t.tx)/t.scale,y:(point.y-t.ty)/t.scale});}
  else if(pan?.id===event.pointerId){pan.moved ||=Math.abs(point.x-pan.x)+Math.abs(point.y-pan.y)>4;setTransform({...t,tx:pan.tx+point.x-pan.x,ty:pan.ty+point.y-pan.y});}
 }
 function up(event){if(!pointers.has(event.pointerId))return;prevent(event);const wasPinching=!!pinch;pointers.delete(event.pointerId);
  if(wasPinching){endDrag();pinch=null;if(pointers.size>=2)beginPinch();else if(pointers.size===1){const [id,remaining]=[...pointers][0],point=local(remaining),t=getTransform();pan={id,x:point.x,y:point.y,tx:t.tx,ty:t.ty,moved:true};}else pan=null;}
  else if(drag?.id===event.pointerId){const clicked=event.type==='pointerup'&&!drag.moved,node=drag.node;endDrag();if(clicked)onNodeClick(node);}
  else if(pan?.id===event.pointerId){const clicked=event.type==='pointerup'&&!pan.moved;pan=null;if(clicked)onBlankClick();}
  try{if(svg.hasPointerCapture?.(event.pointerId))svg.releasePointerCapture(event.pointerId);}catch{/* Capture can already have been released by the browser. */}
 }
 function listen(type,handler,options={passive:false}){svg.addEventListener(type,handler,options);listeners.push(()=>svg.removeEventListener(type,handler,options));}
 listen('pointerdown',down);listen('pointermove',move);listen('pointerup',up);listen('pointercancel',up);listen('lostpointercapture',up);
 listen('wheel',event=>{prevent(event);const point=local(event),t=getTransform(),scale=Math.max(minScale,Math.min(4,t.scale*Math.exp(-event.deltaY*.001)));setTransform({scale,tx:point.x-(point.x-t.tx)/t.scale*scale,ty:point.y-(point.y-t.ty)/t.scale*scale});});
 const pointerSupport=!!svg.ownerDocument?.defaultView?.PointerEvent;
 for(const [type,phase] of [['touchstart','pointerdown'],['touchmove','pointermove'],['touchend','pointerup'],['touchcancel','pointercancel']])listen(type,event=>{
  if(pointerSupport){if(event.touches.length>1)prevent(event);return;}
  prevent(event);for(const touch of event.changedTouches){const synthetic={type:phase,pointerId:touch.identifier,clientX:touch.clientX,clientY:touch.clientY,target:touch.target||event.target,cancelable:false,preventDefault(){}};if(phase==='pointerdown')down(synthetic);else if(phase==='pointermove')move(synthetic);else up(synthetic);}
 });
 // Safari also emits native gesture events: prevent page zoom only inside this SVG.
 listen('gesturestart',prevent);listen('gesturechange',prevent);
 function cancel(){endDrag();const ids=[...pointers.keys()];pointers.clear();pinch=null;pan=null;for(const id of ids)try{if(svg.hasPointerCapture?.(id))svg.releasePointerCapture(id);}catch{}}
 return {cancel,destroy(){listeners.forEach(remove=>remove());cancel();for(const [property,value] of Object.entries(styleBefore))svg.style[property]=value||'';}};
}
