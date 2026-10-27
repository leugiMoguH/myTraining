import {pgliteHarness,scenarios} from './sync-matrix.mjs';
const h=await pgliteHarness();
try {await scenarios(h);console.log('PASS: sync scenarios 1–6 + account/schema/await/retention/legacy/B (PGlite)');} finally {await h.close();}
