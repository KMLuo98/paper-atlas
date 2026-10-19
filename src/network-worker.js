import {computeNetworkLayout} from './network-physics.js';
self.onmessage = ({data}) => {
  try {self.postMessage({positions: computeNetworkLayout(data.graph, data.width, data.height)});}
  catch {self.postMessage({error: true});}
};
