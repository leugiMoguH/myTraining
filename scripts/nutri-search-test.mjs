import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { norm, searchFoods } from '../js/food-search.js';
const {foods}=JSON.parse(readFileSync(new URL('../data/foods-pt.json',import.meta.url),'utf8'));
assert.equal(norm('  MaçÃ, PÃO! '),'maca pao');
const queries={banana:'Banana','maçã':'Maçã','pão':'Pão','arroz cozido':'Arroz',leite:'Leite',ovo:'Ovo',iogurte:'Iogurte',frango:'frango','salmão':'Salmão','feijão':'Feijão','amêndoa':'Amêndoas',bacalhau:'Bacalhau',macarrao:'Massa'};
for(const [q,expected] of Object.entries(queries)) {
 const found=searchFoods(foods,q);assert(found.length,q);
 assert(norm(found[0].name).includes(norm(expected)),q+': primeiro inesperado '+found[0].name);
 if(q==='pão') assert(found.slice(0,3).every(f=>f.name.startsWith('Pão')));
 if(q==='banana') assert.equal(found[0].state,'crua');
 if(q==='arroz cozido') {assert.equal(found.length,2);assert(found.every(f=>f.state.includes('cozido')&&!f.state.includes('cru')));assert(found.some(f=>f.name==='Arroz branco'));assert(found.some(f=>f.name==='Arroz integral'));}
 if(q==='bacalhau') assert(found.every(f=>f.aprox));
 console.log('OK pesquisa',q,'→',found.slice(0,3).map(f=>[f.name,f.state].join(' · ')).join('; '));
}
for(const q of ['arroz cru','arroz integral','pão integral','pão branco']) {
 const found=searchFoods(foods,q);assert(found.length,q);
 assert(found.every(f=>q.split(' ').every(t=>norm([f.name,f.state,f.cat,...f.syn].join(' ')).includes(norm(t)))));
 if(q==='arroz cru')assert(found.every(f=>!f.state.includes('cozido')));
 if(q==='pão integral')assert(found.every(f=>!f.name.includes('branco')));
 if(q==='pão branco')assert(found.every(f=>!f.name.includes('integral')));
}
assert.deepEqual(searchFoods(foods,'inexistente xyz'),[]);
assert.deepEqual(searchFoods(foods,''),[]);
assert.deepEqual(searchFoods(foods,'',{recentIds:['missing',foods[3].id,foods[1].id],limit:1}),[foods[3]]);
assert.deepEqual(searchFoods(foods,'maca'),searchFoods(foods,'maçã'));
assert.equal(searchFoods(foods,'leite',{limit:2}).length,2);
console.log('OK estados, integral/branco, acentos, recentes, limite e sem resultados');
