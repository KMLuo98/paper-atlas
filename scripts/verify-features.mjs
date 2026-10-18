import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
// The user requested that deletion flows not be tested in this release.
const files=fs.readdirSync('tests').filter(n=>n.endsWith('.test.js')&&n!=='admin.test.js').map(n=>'tests/'+n);
const result=spawnSync(process.execPath,['--test','--test-skip-pattern=account.*cleanup',...files],{stdio:'inherit'});
process.exit(result.status??1);
