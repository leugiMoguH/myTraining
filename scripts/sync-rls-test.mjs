import {pgliteHarness,rlsMatrix} from './sync-matrix.mjs';
const h=await pgliteHarness();
try {await rlsMatrix(h);console.log('PASS: sync RLS matrix (PGlite, authenticated/anon)');} finally {await h.close();}
