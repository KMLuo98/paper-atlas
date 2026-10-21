import './copy-pdf-assets.mjs';
import {build} from 'vite';
import {publishMail} from './mail-publication.mjs';
await build();
await build({configFile:'mail/vite.config.js'});
await publishMail();
