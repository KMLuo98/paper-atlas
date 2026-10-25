import {mountNetworkGestures} from './network-gestures.js';
import {getLanguage} from './i18n.js';
import {networkMetrics, computeNetworkLayout, networkPhysics} from './network-physics.js';
import {networkLayouts} from './network-cache.js';

export function drawNetwork(svg, data, {authors = false, onClick = () => {}, onSelectionChange = () => {}} = {}) {
  const width = Math.max(280, svg.clientWidth || 840), height = Math.max(420, svg.clientHeight || 620), ns = 'http://www.w3.org/2000/svg';
  const doc = svg.ownerDocument, host = doc.defaultView, idOf = n => typeof n === 'object' ? n.id : n;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const make = (name, attrs = {}) => {const el = doc.createElementNS(ns, name); for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value)); return el;};
  const {radii} = networkMetrics(data), radius = id => radii.get(id) || 14;
  const layoutInput = {nodes: data.nodes.map(n => ({id: n.id})), edges: data.edges.map(e => ({source: idOf(e.source), target: idOf(e.target), weight: e.weight || 1}))};
  const layoutKey = JSON.stringify([authors, width, height, layoutInput]);
  const cached = networkLayouts.get(layoutKey), cachedPositions = new Map((cached || []).map(n => [n.id, n]));
  const nodes = data.nodes.map((n, i) => ({...n, x: width / 2 + Math.cos(i * 2.399963) * Math.sqrt(i + 1) * 62, y: height / 2 + Math.sin(i * 2.399963) * Math.sqrt(i + 1) * 62, ...cachedPositions.get(n.id)}));
  const nodesById = new Map(nodes.map(n => [n.id, n])), nodeIndices = new Map(nodes.map((n, i) => [n.id, i]));
  const links = layoutInput.edges.map(e => ({...e, source: nodesById.get(e.source), target: nodesById.get(e.target)})).filter(e => e.source && e.target);
  const neighbors = new Map(nodes.map(n => [n.id, new Set([n.id])])), incident = new Map(nodes.map(n => [n.id, new Set()]));
  links.forEach((edge, i) => {neighbors.get(edge.source.id).add(edge.target.id); neighbors.get(edge.target.id).add(edge.source.id); incident.get(edge.source.id).add(i); incident.get(edge.target.id).add(i);});
  const markerId = 'network-arrow-' + Math.random().toString(36).slice(2), defs = make('defs');
  for (const [suffix, color] of [['', '#8da880'], ['-incoming', '#2879b8'], ['-outgoing', '#d46b38']]) {
    const marker = make('marker', {id: markerId + suffix, viewBox: '0 -5 10 10', refX: 9, refY: 0, markerWidth: 7, markerHeight: 7, orient: 'auto'});
    marker.append(make('path', {d: 'M0,-4L9,0L0,4', fill: color})); defs.append(marker);
  }
  svg.append(defs);
  const viewport = make('g', {'data-network-viewport': ''}); svg.append(viewport);
  const edgeEls = links.map(link => {
    const el = make('line', {class: 'network-edge', stroke: '#aec29e', 'stroke-width': authors ? Math.min(4, 1 + Math.log1p(link.weight || 1)) : 1.3, 'stroke-opacity': links.length > nodes.length * 3 ? .18 : .42, ...(!authors ? {'marker-end': `url(#${markerId})`} : {})});
    viewport.append(el); return el;
  });
  let selected = null, labels = nodes.length <= 40, scale = 1, tx = 0, ty = 0, disposed = false, layoutReady = !!cached;
  const labelEls = [], rings = [], innerEls=[], photoEls=[];
  let photosVisible=false;
  const nodeEls = nodes.map((node, i) => {
    const r = radius(node.id), g = make('g', {class: 'node', tabindex: 0, role: 'button', 'aria-label': node.label, 'aria-pressed': 'false', 'data-node-id': node.id});
    const ring = make('circle', {class: 'selection-ring', r: r + 8, fill: 'none', stroke: '#d18b31', 'stroke-width': 4, opacity: 0}); rings.push(ring); g.append(ring);
    g.append(make('circle', {r, fill: ['#50764c', '#87a76b', '#b4bd87', '#729180', '#b49f6a'][i % 5], stroke: '#fffefa', 'stroke-width': 2}));
    const innerText = authors ? node.name.split(' ').map(part => part[0]).slice(0, 2).join('') : (node.short_label === '未发表' && getLanguage() === 'en' ? 'Unpub.' : node.short_label || 'PDF');
    const units = [...innerText].reduce((sum, char) => sum + (/[\p{Script=Han}]/u.test(char) ? 1 : .62), 0), innerSize = r * Math.min(12 / 14, 1.72 / Math.max(1, units)), labelSize = r * 12 / 14;
    const inner = make('text', {'text-anchor': 'middle', dy: innerSize * .35, class: 'node-inner-label', style: `fill:#fffef9;font-size:${innerSize}px;font-weight:600`}); inner.textContent = innerText; g.append(inner);innerEls.push(inner);
    const label = make('text', {y: r + labelSize * 1.5, 'text-anchor': 'middle', class: 'node-label', style: `font-size:${labelSize}px`});
    label.textContent = authors ? node.name : node.label.length > 27 ? node.label.slice(0, 25) + '…' : node.label; labelEls.push(label); g.append(label);
    const title = make('title'); title.textContent = node.label; g.append(title); viewport.append(g);
    g.onkeydown = event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); activate(node);}};
    // Hover affects only this node; never repaint every node and edge on mouse movement.
    g.onmouseenter = g.onfocus = () => g.classList.add('hovered');
    g.onmouseleave = g.onblur = () => g.classList.remove('hovered');
    return g;
  });
  function setPhotos(photos,visible=true){
    if(!authors||disposed)return;photosVisible=visible;
    nodes.forEach((node,i)=>{
      const url=photos.get(node.id);let image=photoEls[i];
      if(url&&/^https:\/\//i.test(url)&&!image){
        const r=radius(node.id)-1,clipId=markerId+'-photo-'+i,clip=make('clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});clip.append(make('circle',{r}));defs.append(clip);
        image=make('image',{class:'node-photo',x:-r,y:-r,width:r*2,height:r*2,preserveAspectRatio:'xMidYMid slice','clip-path':`url(#${clipId})`,'pointer-events':'none'});image.style.display='none';image.loaded=false;
        image.onload=()=>{if(disposed)return;image.loaded=true;image.style.display=photosVisible?'':'none';innerEls[i].style.display=photosVisible?'none':'';};
        image.onerror=()=>{image.loaded=false;image.style.display='none';innerEls[i].style.display='';};
        photoEls[i]=image;nodeEls[i].append(image);image.setAttribute('href',url);
      }
      if(image){image.style.display=photosVisible&&image.loaded?'':'none';innerEls[i].style.display=photosVisible&&image.loaded?'none':'';}
    });
  }
  const transform = () => viewport.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`);
  function paintEdge(i) {
    const edge = links[i], el = edgeEls[i], dx = edge.target.x - edge.source.x, dy = edge.target.y - edge.source.y, distance = Math.hypot(dx, dy) || 1, from = radius(edge.source.id) + 2, to = radius(edge.target.id) + 4;
    el.setAttribute('x1', edge.source.x + dx / distance * from); el.setAttribute('y1', edge.source.y + dy / distance * from);
    el.setAttribute('x2', edge.target.x - dx / distance * to); el.setAttribute('y2', edge.target.y - dy / distance * to);
  }
  function paint() {links.forEach((_, i) => paintEdge(i)); nodeEls.forEach((el, i) => {el.setAttribute('transform', `translate(${nodes[i].x},${nodes[i].y})`); el.setAttribute('data-community', nodes[i].community || '');});}
  function fit() {
    if (!nodes.length) {scale = 1; tx = 0; ty = 0; transform(); return;}
    const left = Math.min(...nodes.map(n => n.x - radius(n.id))) - 50, right = Math.max(...nodes.map(n => n.x + radius(n.id))) + 50, top = Math.min(...nodes.map(n => n.y - radius(n.id))) - 50, bottom = Math.max(...nodes.map(n => n.y + radius(n.id))) + 60;
    scale = Math.min(1, (width - 24) / (right - left), (height - 24) / (bottom - top)); tx = width / 2 - (left + right) / 2 * scale; ty = height / 2 - (top + bottom) / 2 * scale; transform();
  }
  function paintSelection() {
    const nearby = neighbors.get(selected);
    nodeEls.forEach((el, i) => {
      const id = nodes[i].id, active = id === selected;
      el.classList.toggle('selected', active); el.classList.toggle('network-muted', !!selected && !nearby?.has(id)); el.setAttribute('aria-pressed', String(active));
      rings[i].setAttribute('opacity', active ? '1' : '0'); labelEls[i].style.display = labels || active ? '' : 'none';
    });
    edgeEls.forEach((el, i) => {
      const edge = links[i], active = !!selected && incident.get(selected)?.has(i), incoming = !authors && active && edge.target.id === selected, outgoing = !authors && active && edge.source.id === selected;
      el.classList.toggle('selected-edge', !!active); el.classList.toggle('incoming-edge', !!incoming); el.classList.toggle('outgoing-edge', !!outgoing);
      el.setAttribute('stroke', incoming ? '#2879b8' : outgoing ? '#d46b38' : '#aec29e');
      if (!authors) el.setAttribute('marker-end', `url(#${markerId}${incoming ? '-incoming' : outgoing ? '-outgoing' : ''})`);
      el.classList.toggle('network-muted', !!selected && !active);
    });
  }
  function highlight(id, {focus = true} = {}) {
    const next = nodesById.has(id) ? id : null;
    if (next !== selected) {selected = next; paintSelection(); onSelectionChange(selected);}
    if (selected && focus) {const node = nodesById.get(selected); scale = Math.max(1, Math.min(1.3, scale)); tx = width / 2 - node.x * scale; ty = height / 2 - node.y * scale; transform();}
    else if (!selected && focus) fit();
    return selected;
  }
  function activate(node) {
    if (!authors && selected === node.id) {onClick(node); return;}
    highlight(node.id, {focus: false});
  }
  function remember() {if (layoutReady) networkLayouts.set(layoutKey, nodes.map(({id, x, y, community}) => ({id, x, y, community})));}
  const manuallyMoved = new Set();
  const dirty = new Set(); let frame = null;
  function paintMoved() {
    frame = null; if (disposed) return;
    const dirtyEdges = new Set();
    for (const id of dirty) {const node = nodesById.get(id), i = nodeIndices.get(id); nodeEls[i].setAttribute('transform', `translate(${node.x},${node.y})`); for (const edge of incident.get(id)) dirtyEdges.add(edge);}
    dirty.clear(); for (const edge of dirtyEdges) paintEdge(edge);
  }
  const gestures = mountNetworkGestures(svg, {width, height, getTransform: () => ({scale, tx, ty}), setTransform: next => {scale = next.scale; tx = next.tx; ty = next.ty; transform();}, nodeForTarget: target => nodesById.get(target?.closest?.('.node')?.getAttribute('data-node-id')),
    onNodeMove: (node, point) => {node.x = point.x; node.y = point.y; manuallyMoved.add(node.id); dirty.add(node.id); if (host.requestAnimationFrame) {if (frame === null) frame = host.requestAnimationFrame(paintMoved);} else paintMoved();},
    onNodeEnd: () => {if (dirty.size) paintMoved(); remember();}, onNodeClick: activate, onBlankClick: () => highlight(null, {focus: false})});
  let worker = null, cancelFallback = () => {}, finishReady;
  const ready = new Promise(resolve => {finishReady = resolve;});
  const loading = svg.closest('.graph-wrap')?.querySelector('.network-loading');
  function busy(value) {svg.setAttribute('aria-busy', String(value)); if (loading) loading.hidden = !value;}
  function applyPositions(positions) {
    if (disposed) return;
    for (const position of positions) {const node = nodesById.get(position.id); if (node) {node.community = position.community; if (!manuallyMoved.has(node.id)) {node.x = position.x; node.y = position.y;}}}
    layoutReady = true; paint(); fit(); remember(); busy(false); finishReady();
  }
  function fallback() {
    if (disposed) return;
    if (!host.requestAnimationFrame) {applyPositions(computeNetworkLayout(layoutInput, width, height)); return;}
    // Browsers that disallow workers still yield between physics batches.
    const {nodes: positions, simulation, ticks} = networkPhysics(layoutInput, width, height); let done = 0, timer;
    const step = () => {if (disposed) {simulation.stop(); return;} const count = Math.min(12, ticks - done); simulation.tick(count); done += count; if (done < ticks) timer = setTimeout(step, 0); else {simulation.stop(); applyPositions(positions);}};
    cancelFallback = () => {clearTimeout(timer); simulation.stop();}; timer = setTimeout(step, 0);
  }
  paint(); fit(); paintSelection();
  if (cached || !nodes.length) {layoutReady = true; busy(false); finishReady();}
  else {
    busy(true);
    if (typeof Worker === 'function') {
      try {
        worker = new Worker(new URL('./network-worker.js', import.meta.url), {type: 'module'});
        worker.onmessage = ({data: result}) => {worker?.terminate(); worker = null; if (disposed) return; if (result.error) fallback(); else applyPositions(result.positions);};
        worker.onerror = event => {event.preventDefault?.(); worker?.terminate(); worker = null; fallback();};
        worker.postMessage({graph: layoutInput, width, height});
      } catch {worker?.terminate(); worker = null; fallback();}
    } else fallback();
  }
  return {ready, setPhotos, destroy() {remember(); disposed = true; worker?.terminate(); cancelFallback(); if (frame !== null) host.cancelAnimationFrame?.(frame); gestures.destroy(); finishReady();}, reset() {gestures.cancel(); highlight(null, {focus: false}); fit();}, toggleLabels() {labels = !labels; paintSelection(); return labels;}, highlight};
}
