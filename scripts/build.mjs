import './copy-pdf-assets.mjs';
import {build} from 'vite';
await build();
await build({configFile:'mail/vite.config.js'});
