# Roadmap myTraining (decisão do dono, 2026-10-26)

Ambição: de aplicação pessoal a produto web + Android, com contas pessoais, sincronização segura e site público.
**Nada abaixo está implementado.** Não iniciar várias frentes em simultâneo; ordem sujeita a dependências técnicas verificadas.

## Estado do redesign UX V2
Blocos 1–5 concluídos (v50). Bloco 6 (Evolução e Perfil) em curso. Bloco 7 (validação e estabilização) a seguir. As fases A–E só começam depois do Bloco 7.

## Ordem recomendada (depois do Bloco 7)
1. Fase A — contas, backups e sincronização
2. Fase B — domínio e alojamento, com migração segura (decidir **em conjunto** com a autenticação)
3. Fase C — website público, Search Console, SEO
4. Fase D — Android
5. Fase E — integrações e funcionalidades futuras (não podem adiar indefinidamente uma versão estável)

## Fase A — Contas e persistência
- Login/registo; sincronização entre dispositivos; recuperação de dados; histórico de longo prazo (inclui resolver o limite de retenção de 300 treinos de `session.js`).
- Migração segura do armazenamento local; exportação e eliminação de dados; segurança de autenticação/autorização; offline com sincronização posterior.
- Supabase como primeira opção (comparar alternativas só com benefício relevante; ver `V2_ARQUITETURA_NEON_SUPABASE.md`).
- Testes exigidos: primeira migração, sincronização entre dois dispositivos, sessões offline, conflitos, repetição de operações, recuperação de conta, falha de rede, exportação/restauro, eliminação de conta.
- Regra: nunca eliminar ou substituir dados locais sem cópia verificada.

## Fase B — Domínio e infraestrutura
- Domínio e marca; alojamento; site público separado da área privada; HTTPS e DNS; migração sem perda de histórico.
- Avaliar GitHub Pages, Cloudflare Pages, Vercel, Astro (só para o site, se fizer sentido), Supabase como backend. Não reconstruir a PWA só por mudar de alojamento.
- **Risco:** mudar de domínio muda a origem do `localStorage`. Planear e validar a migração dos dados antes de qualquer mudança.
- Não comprar serviços nem registar domínios sem decisão do dono.

## Fase C — SEO e pesquisa por IA
- Site público indexável; Search Console; sitemap, robots.txt; títulos, descrições, canonical; desempenho e acessibilidade; dados estruturados só para conteúdo real; conteúdos úteis e fundamentados (treino, alimentação).
- GA4 só se justificado e conforme a privacidade aplicável.
- Separar conteúdo público de app privada; nunca indexar históricos, registos alimentares ou dados pessoais; nunca enviar dados de saúde/identificadores a analytics.
- Sem técnicas de SEO/AI-SEO sem evidência de benefício. Referência: https://developers.google.com/search/docs/appearance/ai-features

## Fase D — Android
- Comparar PWABuilder/TWA com Capacitor (já há `scripts/build-www.mjs`); Health Connect/smartwatch no futuro; persistência de dados entre web e Android; ícones, splash, permissões, assinatura, atualização; testes em dispositivos reais.
- Google Play: taxa única US$25; possíveis testes fechados (12 participantes, 14 dias); declaração de saúde e fitness; política de privacidade; proteção e eliminação de dados; verificar a associação Android/website.
- Não criar o pacote nem pagar a Play antes de decisão do dono.

## Fase E — Funcionalidades futuras
Strava (`STRAVA_VIABILIDADE.md`), Xiaomi Watch e wearables (`SMARTWATCH_VIABILIDADE.md`), Health Connect, notificações personalizadas, refeições habituais, receitas e planeamento nutricional, informação nutricional avançada, compras e integrações opcionais.
