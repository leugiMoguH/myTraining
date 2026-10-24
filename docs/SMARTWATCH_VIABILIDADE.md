# Smartwatch — nota de viabilidade (2026-10-24)

Só viabilidade. **Nada implementado.** Fontes oficiais abaixo; o que não tem fonte oficial está marcado «não confirmado».

## O que está confirmado
| Facto | Fonte |
|---|---|
| Health Connect (Android) lê/escreve frequência cardíaca (`HeartRateRecord`) e sessões (`ExerciseSessionRecord`) com permissões por tipo (`READ_HEART_RATE`…) declaradas no manifesto e pedidas em execução. É uma **API de app Android**, não de browser. | [Get started with Health Connect](https://developer.android.com/health-and-fitness/health-connect/get-started) · [Workouts](https://developer.android.com/health-and-fitness/health-connect/experiences/workouts) |
| HealthKit (Apple) exige app nativa iOS, autorização por tipo de dado, e ficheiro `Info.plist` com textos de uso. Leitura e escrita autorizam-se em separado. | [WWDC20 · Getting started with HealthKit](https://developer.apple.com/videos/play/wwdc2020/10664/) · [WWDC25 · Track workouts](https://developer.apple.com/videos/play/wwdc2025/322/) |
| Web Bluetooth **não existe no Safari/iOS**; é experimental e só em contexto seguro (HTTPS) noutros browsers. | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) · [caniuse](https://caniuse.com/web-bluetooth) |
| Xiaomi: a app Mi Fitness gere o Watch S4 (ligação, sincronização em segundo plano). | [Xiaomi FAQ](https://www.mi.com/global/support/faq/details/KA-538654/) |

## O que NÃO está confirmado (depende do fabricante)
- Se o **Mi Fitness exporta para Health Connect** no Watch S4: só há referência indireta (página de uma app terceira, HeiaHeia, a descrever o passo). Sem documentação Xiaomi encontrada → **validar no telemóvel do dono** (Mi Fitness → definições → Health Connect).
- Apps de terceiros **no** Watch S4 e botões personalizáveis: sem suporte oficial encontrado → tratar como **indisponível**.
- Pacote Capacitor para Health Connect: existem plugins comunitários; qualidade e manutenção por avaliar (o projeto já gera APK com Capacitor).

## Limitações da PWA
Uma PWA **não pode** ler Health Connect nem HealthKit, nem falar com o relógio. Web Bluetooth só em Chrome/Android e só com dispositivos que exponham perfis GATT padrão (ex.: frequência cardíaca), o que relógios de pulso normalmente não fazem. Qualquer integração real exige **app Android nativa (Capacitor/Kotlin)** e/ou app iOS.

## Níveis: benefício · complexidade
| Nível | O que dá | Complexidade | Depende de |
|---|---|---|---|
| 1 Sincronização após o treino | FC média/máx, duração, calorias associadas à sessão | **Média** (APK + plugin + consentimento + deduplicação por janela de tempo e `id` da sessão) | Mi Fitness → Health Connect (por confirmar) |
| 2 Acompanhamento no relógio | Exercício/série/descanso no pulso | **Alta** (app própria no relógio) | Plataforma do relógio; **fora de alcance no Watch S4** |
| 3 Controlo e reconhecimento de movimento | Marcar série no relógio; contagem automática | **Muito alta / experimental** | Idem + sensores brutos |

## Proposta de primeira experiência (a validar, antes de qualquer código)
1. No telemóvel do dono, confirmar que o Mi Fitness escreve FC e treinos no Health Connect (30 min, sem código).
2. Se sim: protótipo **só Android**, no APK Capacitor, **só leitura** de FC e duração entre `startedAt` e `endedAt` da sessão da myTraining, mostrado como linha extra no histórico, com consentimento explícito e sem escrever nada de volta.
3. Critério de sucesso: 5 treinos reais com a FC associada à sessão certa, sem duplicados e sem afetar o histórico existente.
4. Só depois decidir sobre o nível 2/3 (provavelmente fora do Watch S4) e iOS/HealthKit.

## Riscos
Dados de saúde = categoria sensível (RGPD): consentimento, minimização, apagar tudo; políticas da Play Store para permissões de saúde. Não afirmar precisão clínica das calorias estimadas.
