/* myTraining — módulo extraído de index.html (Fase 0). */
import { ST, save } from './state.js';
import { promptDialog } from './dialog.js';
import { render } from './ui.js';

/* demonstrações (imagem/GIF/vídeo) por exercício, fornecidas pelo utilizador */
function mediaSlide(url,name,mi){
  const safe=String(url).replace(/"/g,'&quot;');
  const jn=String(name).replace(/'/g,"\\'");
  const isVid=/\.(mp4|webm|mov)(\?|$)/i.test(url);
  const inner=isVid
    ? `<video src="${safe}" autoplay loop muted playsinline></video>`
    : `<img src="${safe}" alt="${name}" loading="lazy" onerror="this.closest('.slide').innerHTML='<div class=\\'no-img\\'><span>🎬</span><span>Demo indisponível</span></div>'">`;
  return `<div class="slide media-slide">${inner}<button class="media-del" onclick="delMedia('${jn}',${mi})" aria-label="Remover demo">✕</button></div>`;
}
async function addMedia(name){
  const before=JSON.stringify([ST.day, ST.view, ST.media?.[name]]);
  const url=await promptDialog({title:'Adicionar demonstração', message:'Cola o link de uma imagem, GIF ou vídeo de demonstração do exercício.', label:'URL da demonstração', placeholder:'https://…', confirmLabel:'Guardar', validate:v=>/^https?:\/\//i.test(v.trim()) || /^images\//i.test(v.trim()) ? '' : 'Link inválido — usa http://, https:// ou images/.'});
  if(!url) return;
  if(before!==JSON.stringify([ST.day, ST.view, ST.media?.[name]])) return;
  const u=url.trim();
  const cur=(ST.media&&ST.media[name])||[];
  ST.media=Object.assign({},ST.media,{[name]:cur.concat([u])});
  save(); render(ST.day);
}
function delMedia(name,mi){
  const arr=((ST.media&&ST.media[name])||[]).slice(); arr.splice(mi,1);
  ST.media=Object.assign({},ST.media,{[name]:arr});
  save(); render(ST.day);
}

/* demonstrações reais (free-exercise-db, domínio público, via CDN jsDelivr)
   2 frames (início/fim) que alternam = mostra o movimento. SW cacheia p/ offline. */
const DEMO_BASE='https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';
const DEMOS={
  "Supino reto":"Barbell_Bench_Press_-_Medium_Grip",
  "Supino inclinado":"Barbell_Incline_Bench_Press_-_Medium_Grip",
  "Crucifixo":"Butterfly",
  "Paralelas":"Dips_-_Chest_Version",
  "Tríceps corda":"Triceps_Pushdown_-_Rope_Attachment",
  "Tríceps testa":"EZ-Bar_Skullcrusher",
  "Puxada frente":"Wide-Grip_Lat_Pulldown",
  "Remada":"Bent_Over_Barbell_Row",
  "Remada unilateral":"One-Arm_Dumbbell_Row",
  "Pulldown":"Close-Grip_Front_Lat_Pulldown",
  "Rosca direta":"Barbell_Curl",
  "Rosca alternada":"Alternate_Hammer_Curl",
  "Agachamento":"Barbell_Full_Squat",
  "Leg press":"Leg_Press",
  "Stiff":"Romanian_Deadlift",
  "Mesa flexora":"Lying_Leg_Curls",
  "Cadeira extensora":"Leg_Extensions",
  "Panturrilha":"Standing_Calf_Raises",
  "Desenvolvimento":"Dumbbell_Shoulder_Press",
  "Elevação lateral":"Side_Lateral_Raise",
  "Posterior ombro":"Reverse_Flyes",
  "Face pull":"Face_Pull",
  "Prancha":"Plank",
  "Abdominal":"Crunches",
  "Levantamento terra":"Barbell_Deadlift",
  "Supino":"Barbell_Bench_Press_-_Medium_Grip",
  "Puxada alta":"Wide-Grip_Lat_Pulldown",
  "Agachamento goblet":"Goblet_Squat",
  "Braços":"Barbell_Curl",
  "Core":"Plank",
  "Arnold press":"Arnold_Dumbbell_Press",
  "Tríceps francês":"Standing_Dumbbell_Triceps_Extension",
  "Rosca martelo":"Hammer_Curls",
  "Rosca polia":"Standing_Biceps_Cable_Curl",
  "Supino na máquina":"Machine_Bench_Press",
  "Supino com halteres":"Dumbbell_Bench_Press",
  "Flexões":"Pushups",
  "Flexões inclinadas":"Incline_Push-Up",
  "Agachamento corporal":"Bodyweight_Squat",
  "Passada":"Dumbbell_Lunges",
  "Ponte de glúteos":"Butt_Lift_Bridge",
  "Remada sentado":"Seated_Cable_Rows",
  "Remada invertida":"Inverted_Row",
  "Superman":"Superman",
  "Desenvolvimento na máquina":"Machine_Shoulder_Military_Press"
};
function demoUrl(dir,n){ return DEMO_BASE+dir+'/'+n+'.jpg'; }
function demoSlide(dir,name){
  return `<div class="slide demo-slide">
    <img class="demo-a" src="${demoUrl(dir,0)}" alt="${name} — demonstração" loading="lazy" onerror="this.closest('.demo-slide').classList.add('demo-broken')">
    <img class="demo-b" src="${demoUrl(dir,1)}" alt="" loading="lazy" onerror="this.style.display='none'">
  </div>`;
}

export { mediaSlide, addMedia, delMedia, DEMO_BASE, DEMOS, demoUrl, demoSlide };
