/* Plano original — passa a ser só a SEMENTE da rotina.
   O que a app usa é ST.routine (ver js/routine.js), que o utilizador edita. */

/* ═══════════════════════ DATA ═══════════════════════ */
const DEFAULT_DAYS = {
  "Segunda": {
    label: "Peito & Tríceps",
    ex: [
      { name:"Supino reto",       s:4, r:"6-10",    tip:"Escápulas retraídas. Barra desce até ao peito. Pés firmes no chão.", alt:"Supino na máquina ou flexões com colete de peso", imgs:["images/segunda/img1.jpg","images/segunda/img2.jpg","images/segunda/img3.jpg","images/segunda/img4.jpg"] },
      { name:"Supino inclinado",  s:3, r:"8-12",    tip:"Banco a 30-45°. Cotovelos a ~75° do corpo.", alt:"Supino inclinado com halteres", imgs:["images/segunda/imgsi1.jpg","images/segunda/imgsi2.jpg","images/segunda/imgsi3.jpg"] },
      { name:"Crucifixo",        s:3, r:"10-12",   tip:"Abre como se abraçasses uma árvore. Ligeiro ângulo no cotovelo.", alt:"Cable fly ou pec deck na máquina", imgs:["images/segunda/imgcru1.jpg","images/segunda/imgcru2.jpg","images/segunda/imgcru3.jpg"] },
      { name:"Paralelas",        s:3, r:"8-12",    tip:"Inclina ligeiramente para frente para ativar o peito.", alt:"Flexões diamante ou mergulho na máquina assistida", imgs:["images/segunda/imgpar1.jpg","images/segunda/imgpar2.jpg"] },
      { name:"Tríceps corda",    s:3, r:"10-15",   tip:"Cotovelos fixos ao corpo. Abre a corda no final do movimento.", alt:"Tríceps francês com haltere (uma mão) ou barra", imgs:["images/segunda/imgtric1.jpg"] },
      { name:"Tríceps testa",    s:3, r:"10-12",   tip:"Barra desce até à testa. Cotovelos apontados ao teto.", alt:"Pushdown com barra reta ou extensão no cabo alto", imgs:["images/segunda/imgtrit1.jpg"] }
    ]
  },
  "Terça": {
    label: "Costas & Bíceps",
    ex: [
      { name:"Puxada frente",     s:4, r:"8-12",    tip:"Puxa até ao queixo. Peito ligeiramente inclinado.", alt:"Pull-up assistido ou remada na máquina", imgs:["images/terca/imgpux1.jpg"] },
      { name:"Remada",           s:3, r:"8-12",    tip:"Costas retas. Puxa para o umbigo. Contrai as escápulas.", alt:"Remada na máquina sentado ou remada T-bar", imgs:["images/terca/imgrem1.jpg"] },
      { name:"Remada unilateral", s:3, r:"10-12",   tip:"Costas paralelas ao chão. Puxa o cotovelo para trás.", alt:"Remada com cabo baixo ou TRX row", imgs:["images/terca/imgremu1.jpg"] },
      { name:"Pulldown",         s:3, r:"10-12",   tip:"Pegada ampla. Puxa com as costas, não com os braços.", alt:"Puxada pegada fechada ou pullover com haltere", imgs:["images/terca/imgpull1.jpg"] },
      { name:"Rosca direta",     s:3, r:"8-12",    tip:"Cotovelos fixos ao corpo. Contrai no topo. Desce controlado.", alt:"Rosca martelo ou rosca no cabo", imgs:["images/terca/imgrosc1.jpg"] },
      { name:"Rosca alternada",  s:3, r:"10-12",   tip:"Gira o pulso ao subir. Pausa de 1s no topo.", alt:"Rosca concentrada ou rosca preacher", imgs:["images/terca/imgrosca1.jpg"] }
    ]
  },
  "Quarta": {
    label: "Pernas",
    ex: [
      { name:"Agachamento",      s:4, r:"6-10",    tip:"Joelhos na direção dos pés. Desce até 90°. Costas eretas.", alt:"Agachamento hack na máquina ou Smith machine", imgs:["images/quarta/imgagac1.jpg","images/quarta/imgagac2.jpg"] },
      { name:"Leg press",        s:4, r:"10-12",   tip:"Pés à largura dos ombros. Não bloqueies os joelhos.", alt:"Agachamento búlgaro com halteres", imgs:["images/quarta/imglegp1.jpg"] },
      { name:"Stiff",            s:3, r:"8-12",    tip:"Costas retas. Desce até sentir os isquiotibiais a esticar.", alt:"Leg curl deitado ou good morning", imgs:["images/quarta/imgsti1.jpg"] },
      { name:"Mesa flexora",     s:3, r:"10-15",   tip:"Contrai os isquiotibiais no topo. Desce de forma controlada.", alt:"Leg curl em pé ou nordic curl", imgs:["images/quarta/imgmesa1.jpg"] },
      { name:"Cadeira extensora",s:3, r:"12-15",   tip:"Extensão completa. Pausa de 1s no topo.", alt:"Afundo (lunges) ou step-up com halteres", imgs:["images/quarta/imgcade1.jpg"] },
      { name:"Panturrilha",      s:4, r:"12-20",   tip:"Amplitude completa. Aguenta 2s no ponto máximo.", alt:"Panturrilha sentado ou leg press com ponta dos pés", imgs:["images/quarta/imgpantu1.jpg"] }
    ]
  },
  "Quinta": {
    label: "Ombros & Core",
    ex: [
      { name:"Desenvolvimento",  s:4, r:"8-12",    tip:"Empurra acima da cabeça. Não arqueia as costas.", alt:"Arnold press ou desenvolvimento na máquina", imgs:["images/quinta/imgdes1.jpg"] },
      { name:"Elevação lateral", s:4, r:"12-15",   tip:"Cotovelos ligeiramente fletidos. Polegares um pouco abaixo.", alt:"Elevação lateral no cabo (unilateral)", imgs:["images/quinta/imgelv1.jpg"] },
      { name:"Posterior ombro",  s:3, r:"12-15",   tip:"Inclinado para frente. Abre os braços como asas.", alt:"Pec deck invertido ou face pull com corda", imgs:["images/quinta/imgposto1.jpg"] },
      { name:"Face pull",        s:3, r:"12-15",   tip:"Puxa para a face. Cotovelos altos. Contrai os romboides.", alt:"Band pull-apart ou remada alta (upright row)", imgs:["images/quinta/imgface1.jpg"] },
      { name:"Prancha",          s:3, r:"30-60s",  tip:"Corpo em linha reta. Contrai o core e os glúteos.", alt:"Hollow body hold ou bird-dog", imgs:["images/quinta/imgpranc1.jpg"] },
      { name:"Abdominal",        s:3, r:"12-20",   tip:"Não puxes o pescoço. Exala ao subir.", alt:"Abdominal na máquina ou dead bug", imgs:["images/quinta/imgabd1.jpg"] }
    ]
  },
  "Sexta": {
    label: "Full Body",
    ex: [
      { name:"Levantamento terra",s:3, r:"5-8",    tip:"Barra sobre os metatarsos. Costas retas. Empurra o chão.", alt:"Levantamento terra romeno ou trap bar deadlift", imgs:["images/sexta/imglevt1.jpg"] },
      { name:"Supino",           s:3, r:"8-12",    tip:"Peito para fora, escápulas retraídas. Movimento completo.", alt:"Flexões lastradas ou supino com halteres", imgs:["images/sexta/imgsup1.jpg"] },
      { name:"Puxada alta",      s:3, r:"8-12",    tip:"Puxa com as costas. Cotovelos descem junto ao corpo.", alt:"Remada pegada estreita ou chin-up assistido", imgs:["images/sexta/imgpuxa1.jpg"] },
      { name:"Agachamento goblet",s:3,r:"10-12",   tip:"Haltere ao peito. Joelhos abertos. Postura ereta.", alt:"Agachamento búlgaro ou afundo com halteres", imgs:["images/sexta/imgagacg1.jpg"] },
      { name:"Elevação lateral", s:3, r:"12-15",   tip:"Movimento controlado. Sem usar momentum.", alt:"Elevação frontal ou elevação lateral no cabo", imgs:["images/sexta/imgelvel1.jpg"] },
      { name:"Braços",           s:3, r:"10-15",   tip:"Superset bíceps + tríceps. Sem descanso entre os grupos.", alt:"Rosca no cabo + pushdown; ou máquina de bíceps + tríceps", imgs:["images/sexta/imgbra1.jpg"] }
    ]
  },
  "Sábado": {
    label: "Cardio & Core",
    ex: [
      { name:"Cardio leve",      s:"-",r:"20-30 min",tip:"Zona 2: consegues falar mas está difícil. FC 60-70% max.", alt:"Bicicleta, elíptica, natação ou remo ergómetro", imgs:["images/sabado/imgcard1.jpg"] },
      { name:"Core",             s:3, r:"12-20",   tip:"Varia: prancha, hollow body, dead bug, russian twist.", alt:"Ab wheel ou L-sit (barras paralelas)", imgs:["images/sabado/imgcore1.jpg"] }
    ]
  },
  "Domingo": {
    label: "Descanso Ativo",
    ex: [
      { name:"Descanso ativo",   s:"-",r:"Mobilidade",tip:"Alongamentos, yoga suave ou caminhada leve. Recupera bem!", alt:"Banho frio, sauna ou sessão de massagem", imgs:["images/domingo/imgabd1.jpg"] }
    ]
  }
};

export { DEFAULT_DAYS };
