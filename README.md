# Sífilis em São Paulo · Caderno de pesquisa

Site da iniciação científica sobre sífilis congênita em São Paulo (FSL), feito por Marjori Pomarole. Reúne dados públicos de sífilis congênita, em gestantes e adquirida, e o cruzamento entre cobertura da Estratégia Saúde da Família e sífilis congênita por Supervisão Técnica de Saúde.

Publicado em https://sifilis-sp-caderno-pesquisa.vercel.app (projeto `sifilis-sp-caderno-pesquisa` na conta Vercel da Marjori). Site estático: `vercel.json` publica a pasta `dist/` sem build.

Até 12/11/2026 o código só existia na Vercel. O repositório foi montado a partir dos arquivos da publicação de 03/11/2026 (conferidos pelo hash), que são o primeiro commit.

## Atualização de 12/11/2026

- `dist/data.json`: entram as tabelas 5 (sífilis em gestante) e 9 (sífilis congênita) do Boletim de Sífilis 2026 da SMS-SP, por CRS, STS e município, de 2015 a 2025 (fontes `SP04B26_T5` e `SP04B26_T9`), e a série municipal da planilha aberta da COVISA até 2026, corte 01/10/2026 (fontes `SP05` e `SP06`). O boletim de 2025 continua como estava.
- `dist/esf-sts.json`: mesmos dados do painel "Sífilis Congênita e ESF", agora até 2025, mais o resultado da regressão com efeitos fixos (`painel_efeitos_fixos`).
- Tela "ESF por STS" (`dist/index.html`, `dist/esf.js`): cobertura de dez/2025 × taxa de 2023–25; seção nova com detecção em gestante e casos congênitos por 100 gestantes; tabela de efeitos fixos; tabela das STS com as colunas novas.

## Para publicar de novo

```
vercel deploy --prod
```

`scripts/` tem o que gerou esta versão: `tab_full.py` (lê as tabelas do PDF via `pdftotext -layout`), `build_site.py` (monta os JSON) e `edit_site.py` (aplicou as mudanças de texto e código sobre a versão de 03/11; não rodar de novo sobre esta).
