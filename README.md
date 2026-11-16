# Sífilis em São Paulo · Caderno de pesquisa

Site da iniciação científica sobre sífilis congênita em São Paulo (FSL), feito por Marjori Pomarole. Reúne dados públicos de sífilis congênita, em gestantes e adquirida, e o cruzamento entre cobertura da Estratégia Saúde da Família e sífilis congênita por Supervisão Técnica de Saúde.

Publicado em https://sifilis-sp-caderno-pesquisa.vercel.app (projeto `sifilis-sp-caderno-pesquisa` na conta Vercel da Marjori). Site estático: `vercel.json` publica a pasta `dist/` sem build.

Código em https://github.com/marjoripomarole/sifilis-sp-caderno-pesquisa. Até 12/11/2026 ele só existia na Vercel. O repositório foi montado a partir dos arquivos da publicação de 03/11/2026 (conferidos pelo hash), que são o primeiro commit.

## Atualização de 12/11/2026

- `dist/data.json`: entram as tabelas 5 (sífilis em gestante) e 9 (sífilis congênita) do Boletim de Sífilis 2026 da SMS-SP, por CRS, STS e município, de 2015 a 2025 (fontes `SP04B26_T5` e `SP04B26_T9`), e a série municipal da planilha aberta da COVISA até 2026, corte 01/10/2026 (fontes `SP05` e `SP06`). O boletim de 2025 continua como estava.
- `dist/esf-sts.json`: mesmos dados do painel "Sífilis Congênita e ESF", agora até 2025, coordenadas validadas das 482 UBS, resultado da regressão com efeitos fixos (`painel_efeitos_fixos`) e bloco `analise_aprofundada` (evolução trienal da Zona Norte, correlações parciais/estratificadas, sensibilidade do painel e cascata do SINAN).
- `dist/mapa-dados.json` e `dist/mapa.js`: malhas oficiais da SMS-SP/CEInfo (abril de 2026, Decreto 64.999/2026) das **26 STS**, **5 CRS** e **485 Áreas de Abrangência de UBS (AAUBS)**, combinadas com as **482 UBS** por modelo de atenção (`ESF`, `Mista`, `Tradicional`) e a série anual **2014–2025** com controle deslizante de tempo (`slider` + animação).
- Novas abas no site (`dist/index.html`, `dist/styles.css`, `dist/app.js`, `dist/mapa.js`):
  - **03 Mapa interativo (`#mapa`):** mapa vetorial com zoom/pan, slider de tempo de 2014 a 2025, seletor de 4 indicadores, filtro por CRS/Zona Norte, pontos das 482 UBS por modelo, divisas dos 485 territórios de abrangência das UBS (AAUBS) e painel lateral de inspeção com série histórica da STS e lista clicável de UBS.
  - **04 Síntese executiva (`#sintese`):** resumo executivo para reunião do grupo, análise aprofundada da Zona Norte (2015–2025 e pares contrastantes), correlações de Spearman brutas e parciais (26 STS vs. 23 STS, controle por natalidade e por detecção materna), sensibilidade do painel (lag $t-1$ e pós-2017), cascata de cuidado nos microdados do SINAN (2015–2024) e pauta de deliberações.

## Atualização de 16/11/2026

- Nova aba **05 Capital × Grande SP (`#grandesp`)**, em `dist/grandesp.js` e `dist/grande-sp.json`: capital comparada com os 38 vizinhos da Região Metropolitana e com o restante do estado. Sífilis congênita e em gestante de 2013 a 2023 (painel do Ministério da Saúde, corte 30/06/2024) e cobertura estimada de ESF de dezembro de 2014 a setembro de 2026 (CNES e Censos), com dispersão por município, correlações de Spearman em quatro recortes e série de equipes eSF de cada município.
- `scripts/build_grandesp.py` gera o `grande-sp.json` a partir dos CSV de `../Painel municipal DATHI — triagem de municípios — 16 nov 2026/`: `python3 -I scripts/build_grandesp.py "<pasta da triagem>" dist/esf-sts.json dist/grande-sp.json`.
- “Fontes de dados” passou a ser a aba 06.

## Para publicar de novo

```
vercel deploy --prod
```

`scripts/` tem o que gerou esta versão: `tab_full.py` (lê as tabelas do PDF via `pdftotext -layout`), `build_site.py` (monta `data.json` e `esf-sts.json`), `build_mapa.py` (gera `dist/mapa-dados.json` e enriquece `dist/esf-sts.json` a partir dos KMZ oficiais da CEInfo/SMS-SP) e `edit_site.py` (aplicou as mudanças iniciais sobre a versão de 03/11).
