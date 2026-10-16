import './copy-pdf-assets.mjs';
import {createServer} from 'vite';
const server = await createServer({server:{host:'127.0.0.1'}});
await server.listen(); server.printUrls();
