/* Plano original — passa a ser só a SEMENTE da rotina.
   O que a app usa é ST.routine (ver js/routine.js), que o utilizador edita.
   4 dias de força (~1h cada, com cardio no fim), Quinta e Domingo de descanso,
   Sábado caminhada de 1h (fora da fila: `rest`, não fica pendente se falhar). */

const CARDIO = { name:"Cardio final", s:"-", r:"15 min",
  tip:"Passadeira: 5' a 4 km/h e 8% · 5' a 4,2 km/h e 11% · 5' a 4,5 km/h e 8% · depois 1-2' de descanso ativo.",
  alt:"Bicicleta ou elíptica, mesma duração" };

/* ═══════════════════════ DATA ═══════════════════════ */
const DEFAULT_DAYS = {
  "Segunda": {
    label: "Pernas & Ombros",
    ex: [
      { name:"Leg press",         s:4, r:"8-10",  tip:"Pés à largura dos ombros. Não bloqueies os joelhos.", alt:"Agachamento livre ou hack na máquina" },
      { name:"Cadeira extensora", s:3, r:"12",    tip:"Extensão completa. Pausa de 1s no topo.", alt:"Afundo ou step-up com halteres" },
      { name:"Mesa flexora",      s:3, r:"12",    tip:"Contrai os isquiotibiais no topo. Desce de forma controlada.", alt:"Leg curl em pé" },
      { name:"Arnold press",      s:3, r:"10-12", tip:"Roda as palmas ao subir, de frente para ti até à frente. Sem arquear as costas.", alt:"Desenvolvimento com halteres" },
      { name:"Elevação lateral",  s:3, r:"10-12", tip:"Cotovelos ligeiramente fletidos. Sem usar balanço.", alt:"Elevação lateral no cabo" },
      { name:"Panturrilha", s:2, r:"15", tip:"Amplitude completa. Aguenta 2s no ponto máximo.", alt:"Panturrilha sentado ou no leg press" },
      CARDIO
    ]
  },
  "Terça": {
    label: "Peito & Tríceps",
    ex: [
      { name:"Supino inclinado", s:4, r:"8-10", tip:"Banco a 30-45°. Cotovelos a ~75° do corpo.", alt:"Supino inclinado com halteres" },
      { name:"Supino reto",      s:3, r:"8-10", tip:"Escápulas retraídas. Barra desce até ao peito. Pés firmes no chão.", alt:"Supino na máquina ou com halteres" },
      { name:"Crucifixo",        s:3, r:"12",   tip:"Na máquina (peck deck): abre e fecha controlado, sem bater os pesos.", alt:"Cable fly ou crucifixo com halteres" },
      { name:"Tríceps corda",    s:3, r:"12",   tip:"Cotovelos fixos ao corpo. Abre a corda no final do movimento.", alt:"Pushdown com barra reta" },
      { name:"Tríceps francês",  s:3, r:"10",   tip:"Cotovelos apontados ao teto. Desce atrás da cabeça, controlado.", alt:"Tríceps testa com barra EZ" },
      CARDIO
    ]
  },
  "Quarta": {
    label: "Costas & Bíceps",
    ex: [
      { name:"Puxada frente",   s:4, r:"8-10", tip:"Pegada larga. Puxa até ao peito com as costas, não com os braços.", alt:"Pulldown ou pull-up assistido" },
      { name:"Remada",          s:4, r:"10",   tip:"Costas retas. Puxa para o umbigo. Contrai as escápulas.", alt:"Remada na máquina sentado" },
      { name:"Rosca alternada", s:3, r:"10",   tip:"Gira o pulso ao subir. Pausa de 1s no topo.", alt:"Rosca direta" },
      { name:"Rosca martelo",   s:3, r:"10",   tip:"Pegada neutra, cotovelos fixos ao corpo.", alt:"Rosca martelo na corda (cabo)" },
      { name:"Rosca polia",     s:2, r:"12",   tip:"Cotovelos fixos. Contrai no topo e desce devagar.", alt:"Rosca direta com barra EZ" },
      CARDIO
    ]
  },
  "Quinta": {
    label: "Descanso",
    ex: [
      { name:"Descanso", s:"-", r:"Recuperação", tip:"Dormir e comer bem é onde o músculo cresce.", alt:"Mobilidade ou alongamentos leves" }
    ]
  },
  "Sexta": {
    label: "Full Body",
    ex: [
      { name:"Agachamento",      s:3, r:"10", tip:"Joelhos na direção dos pés. Desce até 90°. Costas eretas.", alt:"Hack na máquina ou Smith machine" },
      { name:"Supino",           s:3, r:"10", tip:"Peito para fora, escápulas retraídas. Movimento completo.", alt:"Supino com halteres" },
      { name:"Puxada alta",      s:3, r:"10", tip:"Puxa com as costas. Cotovelos descem junto ao corpo.", alt:"Remada pegada estreita" },
      { name:"Elevação lateral", s:3, r:"12", tip:"Movimento controlado. Sem usar momentum.", alt:"Elevação lateral no cabo" },
      { name:"Braços",           s:2, r:"12", tip:"Superset bíceps + tríceps. Sem descanso entre os grupos.", alt:"Rosca no cabo + pushdown" },
      CARDIO
    ]
  },
  "Sábado": {
    label: "Caminhada",
    rest: true,
    ex: [
      { name:"Caminhada", s:"-", r:"60 min", tip:"Ritmo confortável, ao ar livre se possível.", alt:"Bicicleta leve" }
    ]
  },
  "Domingo": {
    label: "Descanso",
    ex: [
      { name:"Descanso", s:"-", r:"Recuperação", tip:"Dormir e comer bem é onde o músculo cresce.", alt:"Mobilidade ou alongamentos leves" }
    ]
  }
};

export { DEFAULT_DAYS };
