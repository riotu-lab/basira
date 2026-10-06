// Shared generated-output directories; run utility commands from the repository root.
import {mkdirSync} from 'node:fs';
for(const dir of ['artifacts/screenshots','artifacts/reports','artifacts/brand'])mkdirSync(dir,{recursive:true});
