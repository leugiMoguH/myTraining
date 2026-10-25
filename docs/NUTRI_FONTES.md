# Nutrição V2 — fontes e limites

Estimativas para adultos saudáveis dos 18 aos 65 anos. Não são requisitos individuais. Não há ajustes por objetivo.

- Mifflin–St Jeor (1990): REE = 10 × kg + 6,25 × cm − 5 × anos + 5 (masculino) ou −161 (feminino). [Artigo, DOI](https://doi.org/10.1093/ajcn/51.2.241). A manutenção multiplica o repouso pelos fatores convencionais sed=1,2; leve=1,375; mod=1,55; alto=1,725. Estes fatores não pertencem à fórmula de Mifflin. A atividade introduz incerteza.
- [Morton et al. (2018)](https://doi.org/10.1136/bjsports-2017-097608): orientação prática de proteína 1,6–2,2 g/kg/dia para adultos saudáveis que treinam força; não é requisito individual. Compatibilidade calcTargets: 1,8 g/kg, não usado como prescrição na UI.
- EFSA (2010): [gordura](https://doi.org/10.2903/j.efsa.2010.1461) 20–35 %E; [hidratos e fibra](https://doi.org/10.2903/j.efsa.2010.1462) 45–60 %E e ingestão adequada de fibra 25 g/dia; [água](https://doi.org/10.2903/j.efsa.2010.1459) ingestão adequada total, incluindo alimentos: 2 L feminino, 2,5 L masculino. Gramas de gordura/hidratos calculadas sobre manutenção (/9 e /4); os intervalos não são combinações que somam a mesma energia.
- OMS (2012): sal <5 g/dia, equivalente a sódio <2 g/dia. OMS (2015): açúcares livres <10 %E, apenas informação educativa; o diário regista açúcares totais, sem comparação.

Alimentos: USDA FoodData Central SR Legacy (domínio público), versão publishedDate, identificadores fixados pelo gerador build-foods.mjs. Os hidratos «by difference» incluem fibra. Energia: nutriente 1008 (kcal). Sódio em mg convertido para g (/1000), depois para sal (×2,5). O JSON é carregado apenas ao abrir Nutrição; falta/erro deixa lista vazia e entrada manual disponível.

Open Food Facts: API v0 mantida nesta entrega; base ODbL, conteúdo DbCL e imagens CC BY-SA (não usadas). Apenas campos *_100g; fonte, código e last_modified_t preservados. Unidade ml quando indicada pelo produto, sem conversão de densidade. Sal derivado do sódio é assinalado. Valores manuais referem-se a 100 g. Quantidades escalam linearmente; null permanece desconhecido, zero conhecido permanece zero. Totais parciais indicam quantos registos não têm dado; CSV deixa células desconhecidas vazias e mantém itens legados.

Dados de produtos podem estar incompletos; confirma alergénios no rótulo.

PortFIR (INSA): não incorporado — condições de reutilização por confirmar (site inacessível ao ambiente de desenvolvimento). Só entra após licença confirmada.

Base USDA gerada em 2026-10-25 com scripts/build-foods.mjs (valores conferidos com o USDA). Referências EFSA/OMS/Morton documentadas a partir das fontes citadas; o limite superior de 2,2 g/kg da Morton 2018 foi confirmado apenas em fontes secundárias.
