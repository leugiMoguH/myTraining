/* myTraining — módulo extraído de index.html (Fase 0). */

function chartSVG(vals){
  const W=280,H=92,P=10,n=vals.length;
  const min=Math.min(...vals),max=Math.max(...vals),span=(max-min)||1;
  const xAt=k=> n>1 ? P+k*(W-2*P)/(n-1) : W/2;
  const yAt=v=> H-P-(v-min)/span*(H-2*P);
  const pts=vals.map((v,k)=>[+xAt(k).toFixed(1),+yAt(v).toFixed(1)]);
  const line=pts.map((p,k)=>`${k?'L':'M'}${p[0]} ${p[1]}`).join(' ');
  const area=`M${pts[0][0]} ${H-P} `+pts.map(p=>`L${p[0]} ${p[1]}`).join(' ')+` L${pts[n-1][0]} ${H-P} Z`;
  const dots=pts.map((p,k)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${k===n-1?3.5:2.4}" fill="${k===n-1?'#f97316':'#ef4444'}"/>`).join('');
  return `<svg class="lc-svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="lcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity="0.35"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#lcg)"/><path d="${line}" fill="none" stroke="#ef4444" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

/* ═══════════════ MAPA MUSCULAR ══════════════════════ */
const MUSCLE_NAMES={peito:"Peito",ombro:"Ombros",posterior:"Deltóide post.",triceps:"Tríceps",biceps:"Bíceps",antebraco:"Antebraço",abdominal:"Abdominais",oblique:"Oblíquos",dorsais:"Dorsais",trapezio:"Trapézio",lombar:"Lombar",gluteos:"Glúteos",quadriceps:"Quadríceps",isquios:"Isquiotibiais",gemeos:"Gémeos"};
const MUSCLES={
  "Supino reto":{p:["peito"],s:["ombro","triceps"]},
  "Supino inclinado":{p:["peito"],s:["ombro","triceps"]},
  "Crucifixo":{p:["peito"],s:["ombro"]},
  "Paralelas":{p:["peito","triceps"],s:["ombro"]},
  "Tríceps corda":{p:["triceps"],s:[]},
  "Tríceps testa":{p:["triceps"],s:[]},
  "Puxada frente":{p:["dorsais"],s:["biceps","posterior"]},
  "Remada":{p:["dorsais","trapezio"],s:["biceps","posterior"]},
  "Remada unilateral":{p:["dorsais"],s:["biceps","trapezio"]},
  "Pulldown":{p:["dorsais"],s:["biceps"]},
  "Rosca direta":{p:["biceps"],s:["antebraco"]},
  "Rosca alternada":{p:["biceps"],s:["antebraco"]},
  "Agachamento":{p:["quadriceps","gluteos"],s:["isquios","lombar"]},
  "Leg press":{p:["quadriceps","gluteos"],s:["isquios"]},
  "Stiff":{p:["isquios","gluteos"],s:["lombar"]},
  "Mesa flexora":{p:["isquios"],s:[]},
  "Cadeira extensora":{p:["quadriceps"],s:[]},
  "Panturrilha":{p:["gemeos"],s:[]},
  "Desenvolvimento":{p:["ombro"],s:["triceps","trapezio"]},
  "Elevação lateral":{p:["ombro"],s:[]},
  "Posterior ombro":{p:["posterior"],s:["trapezio"]},
  "Face pull":{p:["posterior","trapezio"],s:["biceps"]},
  "Prancha":{p:["abdominal"],s:["oblique","lombar"]},
  "Abdominal":{p:["abdominal"],s:["oblique"]},
  "Levantamento terra":{p:["lombar","gluteos","isquios"],s:["dorsais","trapezio","quadriceps"]},
  "Supino":{p:["peito"],s:["ombro","triceps"]},
  "Puxada alta":{p:["dorsais"],s:["biceps","posterior"]},
  "Agachamento goblet":{p:["quadriceps","gluteos"],s:["isquios"]},
  "Braços":{p:["biceps","triceps"],s:["antebraco"]},
  "Core":{p:["abdominal"],s:["oblique"]}
};
function fillOf(id,P,S){ return P.indexOf(id)>=0?'#ef4444':(S.indexOf(id)>=0?'#f97316':'#2b2b3a'); }
function bodySVG(P,S){
  const f=id=>fillOf(id,P,S), O='#3a3a4a';
  return `<svg class="muscle-svg" viewBox="0 0 230 178" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <g>
      <circle cx="58" cy="14" r="10" fill="${O}"/>
      <rect x="53" y="22" width="10" height="7" rx="3" fill="${O}"/>
      <path d="M40 31 Q58 27 76 31 L73 86 Q58 92 43 86 Z" fill="${O}"/>
      <rect x="20" y="33" width="12" height="40" rx="6" fill="${O}"/><rect x="84" y="33" width="12" height="40" rx="6" fill="${O}"/>
      <rect x="19" y="68" width="11" height="34" rx="5" fill="${O}"/><rect x="86" y="68" width="11" height="34" rx="5" fill="${O}"/>
      <rect x="44" y="88" width="13" height="74" rx="6" fill="${O}"/><rect x="59" y="88" width="13" height="74" rx="6" fill="${O}"/>
      <ellipse cx="30" cy="38" rx="10" ry="8" fill="${f('ombro')}"/><ellipse cx="86" cy="38" rx="10" ry="8" fill="${f('ombro')}"/>
      <path d="M44 34 Q51 32 56 35 L56 49 Q50 51 45 48 Z" fill="${f('peito')}"/><path d="M72 34 Q65 32 60 35 L60 49 Q66 51 71 48 Z" fill="${f('peito')}"/>
      <ellipse cx="25" cy="52" rx="6" ry="12" fill="${f('biceps')}"/><ellipse cx="91" cy="52" rx="6" ry="12" fill="${f('biceps')}"/>
      <ellipse cx="24" cy="84" rx="5" ry="13" fill="${f('antebraco')}"/><ellipse cx="92" cy="84" rx="5" ry="13" fill="${f('antebraco')}"/>
      <rect x="49" y="52" width="18" height="30" rx="4" fill="${f('abdominal')}"/>
      <rect x="44" y="53" width="5" height="26" rx="2" fill="${f('oblique')}"/><rect x="67" y="53" width="5" height="26" rx="2" fill="${f('oblique')}"/>
      <ellipse cx="50" cy="116" rx="8" ry="24" fill="${f('quadriceps')}"/><ellipse cx="66" cy="116" rx="8" ry="24" fill="${f('quadriceps')}"/>
      <text x="58" y="174" text-anchor="middle" font-size="9" fill="#6b6b7d">Frente</text>
    </g>
    <g transform="translate(114,0)">
      <circle cx="58" cy="14" r="10" fill="${O}"/>
      <rect x="53" y="22" width="10" height="7" rx="3" fill="${O}"/>
      <path d="M40 31 Q58 27 76 31 L73 86 Q58 92 43 86 Z" fill="${O}"/>
      <rect x="20" y="33" width="12" height="40" rx="6" fill="${O}"/><rect x="84" y="33" width="12" height="40" rx="6" fill="${O}"/>
      <rect x="19" y="68" width="11" height="34" rx="5" fill="${O}"/><rect x="86" y="68" width="11" height="34" rx="5" fill="${O}"/>
      <rect x="44" y="88" width="13" height="74" rx="6" fill="${O}"/><rect x="59" y="88" width="13" height="74" rx="6" fill="${O}"/>
      <ellipse cx="30" cy="38" rx="10" ry="8" fill="${f('posterior')}"/><ellipse cx="86" cy="38" rx="10" ry="8" fill="${f('posterior')}"/>
      <path d="M46 32 L70 32 L64 50 L52 50 Z" fill="${f('trapezio')}"/>
      <path d="M44 50 L57 50 L55 78 Z" fill="${f('dorsais')}"/><path d="M72 50 L59 50 L61 78 Z" fill="${f('dorsais')}"/>
      <ellipse cx="25" cy="52" rx="6" ry="12" fill="${f('triceps')}"/><ellipse cx="91" cy="52" rx="6" ry="12" fill="${f('triceps')}"/>
      <ellipse cx="24" cy="84" rx="5" ry="13" fill="${f('antebraco')}"/><ellipse cx="92" cy="84" rx="5" ry="13" fill="${f('antebraco')}"/>
      <rect x="50" y="62" width="16" height="20" rx="3" fill="${f('lombar')}"/>
      <ellipse cx="51" cy="96" rx="8" ry="9" fill="${f('gluteos')}"/><ellipse cx="65" cy="96" rx="8" ry="9" fill="${f('gluteos')}"/>
      <ellipse cx="50" cy="124" rx="7" ry="22" fill="${f('isquios')}"/><ellipse cx="66" cy="124" rx="7" ry="22" fill="${f('isquios')}"/>
      <ellipse cx="50" cy="150" rx="6" ry="12" fill="${f('gemeos')}"/><ellipse cx="66" cy="150" rx="6" ry="12" fill="${f('gemeos')}"/>
      <text x="58" y="174" text-anchor="middle" font-size="9" fill="#6b6b7d">Costas</text>
    </g>
  </svg>`;
}
function muscleSlide(mm){
  const chips=mm.p.map(id=>`<span class="m-chip prim">${MUSCLE_NAMES[id]||id}</span>`).join('')
    + mm.s.map(id=>`<span class="m-chip sec">${MUSCLE_NAMES[id]||id}</span>`).join('');
  return `<div class="slide muscle-slide">${bodySVG(mm.p,mm.s)}<div class="m-legend">${chips}</div></div>`;
}
function noImgSlide(name){ return `<div class="slide"><div class="no-img"><span>💪</span><span>${name}</span></div></div>`; }

export { chartSVG, MUSCLE_NAMES, MUSCLES, fillOf, bodySVG, muscleSlide, noImgSlide };
