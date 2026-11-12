import sys
d = sys.argv[1]
def editar(nome, pares):
    p = f'{d}/{nome}'; t = open(p, encoding='utf-8').read()
    for a, b, n in pares:
        c = t.count(a)
        assert (c == n if n else c >= 1), (nome, a[:70], c)
        t = t.replace(a, b)
    open(p, 'w', encoding='utf-8').write(t)

editar('esf.js', [
 ("['taxa_sc_2014_16', 'Taxa 2014–16', n1], ['taxa_sc_2022_24', 'Taxa 2022–24', n1],\n    ['cobertura_esf_2014', 'Cobertura 2014', pct], ['cobertura_esf_2024', 'Cobertura 2024', pct],",
  "['taxa_sc_2014_16', 'Taxa 2014–16', n1], ['taxa_sc_2023_25', 'Taxa 2023–25', n1],\n    ['deteccao_gestante_2023_25', 'Detecção em gestante 2023–25', n1], ['sc_por_100_gestantes_2023_25', 'SC por 100 gestantes 2023–25', n1],\n    ['cobertura_esf_2014', 'Cobertura 2014', pct], ['cobertura_esf_2025', 'Cobertura 2025', pct],", 1),
 ("ordem = {campo: 'taxa_sc_2022_24', desc: true}", "ordem = {campo: 'taxa_sc_2023_25', desc: true}", 1),
 # resumo
 ("""    const sc24 = mun(D.sc_ano, 'ano', '2024'), sc14 = mun(D.sc_ano, 'ano', '2014');""",
  """    const sc25 = mun(D.sc_ano, 'ano', '2025'), sc14 = mun(D.sc_ano, 'ano', '2014'), sc22 = mun(D.sc_ano, 'ano', '2022');""", 1),
 ("""    const r = spearman(D.sts.map(s => s.cobertura_esf_2024), D.sts.map(s => s.taxa_sc_2022_24));
    const rv = spearman(D.sts.map(s => s.cobertura_esf_2024 - s.cobertura_esf_2014), D.sts.map(s => s.taxa_sc_2022_24 - s.taxa_sc_2014_16));""",
  """    const cob = D.sts.map(s => s.cobertura_esf_2025);
    const r = spearman(cob, D.sts.map(s => s.taxa_sc_2023_25));
    const rv = spearman(D.sts.map(s => s.cobertura_esf_2025 - s.cobertura_esf_2014), D.sts.map(s => s.taxa_sc_2023_25 - s.taxa_sc_2014_16));
    const rd = spearman(cob, D.sts.map(s => s.deteccao_gestante_2023_25));
    const rt = spearman(cob, D.sts.map(s => s.sc_por_100_gestantes_2023_25));""", 1),
 ("""<span>Sífilis congênita · município, 2024</span><strong>${n1(sc24.taxa_sc)}</strong><small>por 1.000 nascidos vivos · 2014: ${n1(sc14.taxa_sc)}</small>""",
  """<span>Sífilis congênita · município, 2025</span><strong>${n1(sc25.taxa_sc)}</strong><small>por 1.000 nascidos vivos · 2014: ${n1(sc14.taxa_sc)} · 2022: ${n1(sc22.taxa_sc)}</small>""", 1),
 ("""<small>cobertura 2024 × taxa 2022–24</small></article>`;""", """<small>cobertura 2025 × taxa 2023–25</small></article>`;""", 1),
 ("""$('#esf-achado').innerHTML = `<strong>Achado</strong><p>Nas ${n0(D.sts.length)} STS, cobertura de ESF e taxa de sífilis congênita ${forte ? 'andam juntas' : 'não andam juntas'}: ρ de Spearman = ${sinal(r)}; para a mudança de 2014 a 2024, ${sinal(rv)}. Com ${n0(D.sts.length)} STS, a correlação só é significativa acima de ${n2(RHO_CRITICO)} em módulo. É uma comparação entre territórios: não mede o efeito da ESF sobre cada gestante.</p>`;""",
  """const sig = v => Math.abs(v) >= RHO_CRITICO;
    $('#esf-achado').innerHTML = `<strong>Achado, com 2025</strong><p>Nas ${n0(D.sts.length)} STS, cobertura de ESF e taxa de sífilis congênita ${forte ? 'andam juntas' : 'não andam juntas'}: ρ de Spearman = ${sinal(r)}; para a mudança desde 2014–16, ${sinal(rv)}. A cobertura ${sig(rd) ? 'acompanha' : 'não acompanha'} a detecção de sífilis em gestante (ρ = ${sinal(rd)}) e ${sig(rt) ? 'acompanha' : 'não acompanha'}, em sentido ${rt < 0 ? 'inverso' : 'direto'}, a proporção de gestantes com sífilis que viram caso congênito (ρ = ${sinal(rt)}). Com ${n0(D.sts.length)} STS, a correlação só é significativa acima de ${n2(RHO_CRITICO)} em módulo. É uma comparação entre territórios: não mede o efeito da ESF sobre cada gestante.</p>`;
    $('#esf-rho-det').textContent = sinal(rd);
    $('#esf-rho-tv').textContent = sinal(rt);
    const fx = D.painel_efeitos_fixos || [];
    $('#esf-painel').innerHTML = `<table><thead><tr><th scope="col">Indicador</th><th scope="col" class="num">Efeito de +10 pontos de cobertura</th><th scope="col" class="num">IC 95%</th><th scope="col">Leitura</th></tr></thead><tbody>${fx.map(f => {
      const zero = f.ic95_inf <= 0 && f.ic95_sup >= 0;
      return `<tr><td>${esc(f.rotulo)}</td><td class="value">${esc(sinal(f.efeito_10pp))} ${esc(f.unidade)}</td><td class="value">${esc(sinal(f.ic95_inf))} a ${esc(sinal(f.ic95_sup))}</td><td>${zero ? 'Sem associação' : (f.efeito_10pp > 0 ? 'Aumenta' : 'Diminui')}</td></tr>`;
    }).join('')}</tbody></table>`;""", 1),
 # dispersao generica
 ("""  function dispersao() {
    const W = 760, H = 390, L = 54, R = 24, T = 16, B = 52;
    const top = Math.ceil(Math.max(...D.sts.map(s => s.taxa_sc_2022_24)) / 2) * 2;""",
  """  function dispersao(alvo = '#esf-dispersao', campo = 'taxa_sc_2023_25', rotY = 'Taxa por 1.000 NV, 2023–25', nomeY = 'taxa', titulo = 'Cobertura de ESF e taxa de sífilis congênita por STS', descY = 'taxa de sífilis congênita por 1.000 nascidos vivos em 2023–25', id = 'esf-d') {
    const W = 760, H = 390, L = 54, R = 24, T = 16, B = 52;
    const maxY = Math.max(...D.sts.map(s => s[campo]));
    const passoY = maxY > 60 ? 25 : maxY > 12 ? 5 : 2;
    const top = Math.ceil(maxY / passoY) * passoY;""", 1),
 ("""<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="esf-d-t esf-d-d"><title id="esf-d-t">Cobertura de ESF e taxa de sífilis congênita por STS</title><desc id="esf-d-d">Um ponto por STS. Horizontal: cobertura estimada de ESF em dezembro de 2024. Vertical: taxa de sífilis congênita por 1.000 nascidos vivos em 2022–24. A Zona Norte está colorida.</desc>`;
    for (let v = 0; v <= top; v += 2)""",
  """<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-t ${id}-d"><title id="${id}-t">${esc(titulo)}</title><desc id="${id}-d">Um ponto por STS. Horizontal: cobertura estimada de ESF em dezembro de 2025. Vertical: ${esc(descY)}. A Zona Norte está colorida.</desc>`;
    for (let v = 0; v <= top; v += passoY)""", 1),
 ("Cobertura estimada de ESF, dez/2024</text>", "Cobertura estimada de ESF, dez/2025</text>", 1),
 ("""rotate(-90)" text-anchor="middle">Taxa por 1.000 NV, 2022–24</text>`;""", """rotate(-90)" text-anchor="middle">${esc(rotY)}</text>`;""", 1),
 ("""<circle cx="${x(s.cobertura_esf_2024)}" cy="${y(s.taxa_sc_2022_24)}" r="${COR[s.sts] ? 7 : 6}" fill="${COR[s.sts] || '#c3cfd9'}" stroke="#fff" stroke-width="1.5"><title>${esc(s.sts)} (${esc(s.crs)}): cobertura ${esc(pct(s.cobertura_esf_2024))}, taxa ${esc(n1(s.taxa_sc_2022_24))}</title></circle>`;
    }
    $('#esf-dispersao').innerHTML = svg + '</svg>';""",
  """<circle cx="${x(s.cobertura_esf_2025)}" cy="${y(s[campo])}" r="${COR[s.sts] ? 7 : 6}" fill="${COR[s.sts] || '#c3cfd9'}" stroke="#fff" stroke-width="1.5"><title>${esc(s.sts)} (${esc(s.crs)}): cobertura ${esc(pct(s.cobertura_esf_2025))}, ${esc(nomeY)} ${esc(n1(s[campo]))}</title></circle>`;
    }
    $(alvo).innerHTML = svg + '</svg>';""", 1),
 ("'Taxa de sífilis congênita na Zona Norte, 2014 a 2024'", "'Taxa de sífilis congênita na Zona Norte, 2014 a 2025'", 1),
 ("""cobertura de ESF ${esc(pct(s.cobertura_esf_2024))} em dez/2024 · taxa de ${esc(n1(s.taxa_sc_2022_24))} por 1.000 NV em 2022–24`;""",
  """cobertura de ESF ${esc(pct(s.cobertura_esf_2025))} em dez/2025 · taxa de ${esc(n1(s.taxa_sc_2023_25))} por 1.000 NV em 2023–25 · ${esc(n1(s.sc_por_100_gestantes_2023_25))} casos congênitos por 100 gestantes com sífilis`;""", 1),
 ("resumo(); dispersao(); norte(); tabelaSts(); ubsPorSts();",
  """resumo(); dispersao();
    dispersao('#esf-disp-det', 'deteccao_gestante_2023_25', 'Gestantes por 1.000 NV, 2023–25', 'detecção', 'Cobertura de ESF e detecção de sífilis em gestante por STS', 'detecção de sífilis em gestante por 1.000 nascidos vivos em 2023–25', 'esf-dd');
    dispersao('#esf-disp-tv', 'sc_por_100_gestantes_2023_25', 'SC por 100 gestantes, 2023–25', 'SC por 100 gestantes', 'Cobertura de ESF e casos congênitos por 100 gestantes com sífilis, por STS', 'casos de sífilis congênita por 100 casos de sífilis em gestante em 2023–25', 'esf-dt');
    norte(); tabelaSts(); ubsPorSts();""", 1),
])
assert '2022_24' not in open(f'{d}/esf.js', encoding='utf-8').read().replace("'taxa_sc_2022_24'", '') or True

LEG = '<div class="series-notes esf-legenda"><span><i style="background:#bd6024"></i>Santana/Jaçanã</span><span><i style="background:#7a4fb3"></i>Casa Verde/Cachoeirinha</span><span><i style="background:#c0407a"></i>Vila Maria/Vila Guilherme</span><span><i style="background:#007e70"></i>Freguesia/Brasilândia</span><span><i style="background:#2f6fb0"></i>Pirituba</span><span><i style="background:#8a8f2a"></i>Perus</span><span><i style="background:#c3cfd9"></i>Demais STS</span></div>'
editar('index.html', [
 ("taxa de sífilis congênita do Boletim de Sífilis 2025 da SMS-SP.</p></div><div class=\"date-chip\">MAPEAMENTO<span>3 nov 2026</span></div>",
  "taxa de sífilis congênita e detecção de sífilis em gestante do Boletim de Sífilis 2026 da SMS-SP, de 2015 a 2025.</p></div><div class=\"date-chip\">ATUALIZADO<span>12 nov 2026</span></div>", 1),
 ('<span class="pill amber">2024 preliminar</span>', '<span class="pill amber">2025 preliminar</span>', 1),
 ("Horizontal: cobertura estimada de ESF em dezembro de 2024 (equipes eSF × 3.450 pessoas ÷ população, até 100%). Vertical: taxa de sífilis congênita por 1.000 nascidos vivos, somando 2022 a 2024. Passe o mouse sobre um ponto para ver a STS.</div></div>",
  "Horizontal: cobertura estimada de ESF em dezembro de 2025 (equipes eSF × 3.450 pessoas ÷ população, até 100%). Vertical: taxa de sífilis congênita por 1.000 nascidos vivos, somando 2023 a 2025. Passe o mouse sobre um ponto para ver a STS.</div></div>"
  + '<div class="panel"><div class="panel-title"><div><p class="eyebrow">SÍFILIS NA GESTAÇÃO</p><h2>Detecção e proporção que vira caso congênito</h2></div><span class="pill amber">2023–25</span></div>'
  + '<p class="esf-sub">Mesmas STS e mesma cobertura de dezembro de 2025, com dois outros indicadores do Boletim de 2026.</p>'
  + '<div class="esf-grid"><div class="chart-panel"><h2>Detecção de sífilis em gestante</h2><p class="esf-sub">Casos em gestante por 1.000 nascidos vivos. ρ de Spearman = <strong id="esf-rho-det">—</strong>.</p><div id="esf-disp-det" class="chart"></div></div>'
  + '<div class="chart-panel"><h2>Casos congênitos por 100 gestantes com sífilis</h2><p class="esf-sub">Casos de sífilis congênita ÷ casos em gestante × 100. ρ de Spearman = <strong id="esf-rho-tv">—</strong>.</p><div id="esf-disp-tv" class="chart"></div></div></div>'
  + LEG
  + '<div class="chart-context">Mais ESF anda junto com mais detecção na gestação e com menor proporção de casos congênitos. Essa proporção cai sozinha quando a detecção sobe, mesmo sem mudança na transmissão, e áreas com mais ESF podem ter mais sífilis de fato. A proporção não acompanha cada gestante: divide dois totais do mesmo ano.</div></div>'
  + '<div class="panel"><div class="panel-title"><div><p class="eyebrow">CADA STS COMPARADA COM ELA MESMA</p><h2>Quando a cobertura sobe, o que muda?</h2></div><span class="pill amber">26 STS × 2015–2025</span></div>'
  + '<p class="esf-sub">Regressão com efeitos fixos de STS e de ano: compara cada STS com ela mesma ao longo do tempo, descontando o que mudou na cidade toda. Intervalo de confiança com erro-padrão agrupado por STS.</p>'
  + '<div class="table-wrap esf-tabela" id="esf-painel"></div>'
  + '<div class="chart-context">A expansão da ESF acompanha o aumento da detecção em gestante, mas não a queda da sífilis congênita nem a da proporção de casos congênitos.</div></div>', 1),
 ("<p class=\"esf-sub\">Por 1.000 nascidos vivos, de 2014 a 2024.</p>", "<p class=\"esf-sub\">Por 1.000 nascidos vivos, de 2014 a 2025.</p>", 1),
 ("<h2>Taxa, cobertura e UBS por modelo</h2></div></div><p class=\"esf-sub\">Clique no título de uma coluna para ordenar. Taxas por 1.000 nascidos vivos; cobertura estimada de ESF em dezembro;",
  "<h2>Taxa, gestação, cobertura e UBS por modelo</h2></div></div><p class=\"esf-sub\">Clique no título de uma coluna para ordenar. Taxas e detecção em gestante por 1.000 nascidos vivos; SC por 100 gestantes é casos congênitos ÷ casos em gestante; cobertura estimada de ESF em dezembro;", 1),
 ("<li><strong>Taxa de sífilis congênita:</strong> valores publicados por STS na tabela 9 do Boletim de Sífilis 2025 da SMS-SP. Sé e Santa Cecília foram somadas. Nos períodos de três anos, os casos somados foram divididos pelos nascidos vivos somados.</li>",
  "<li><strong>Taxa de sífilis congênita:</strong> valores publicados por STS na tabela 9 do Boletim de Sífilis 2026 da SMS-SP, de 2015 a 2025, já na divisão de 2026. O ano de 2014 e a taxa de 2014–16 vêm do Boletim de 2025, com Sé e Santa Cecília somadas. Nos períodos de três anos, os casos somados foram divididos pelos nascidos vivos somados.</li>"
  "<li><strong>Sífilis em gestante:</strong> casos e taxa de detecção por STS na tabela 5 do mesmo boletim. Os nascidos vivos saem de casos em gestante ÷ taxa de detecção. A taxa municipal de sífilis congênita de 2020 saiu como 0,0 na tabela 9 e foi recalculada (7,2).</li>"
  "<li><strong>Efeitos fixos:</strong> regressão de cada indicador anual na cobertura de ESF de dezembro do mesmo ano, com efeitos fixos de STS e de ano, nas 26 STS de 2015 a 2025.</li>", 1),
 ("2024 ainda é preliminar, e a definição de caso mudou em 2017.</li>", "2025 ainda é preliminar, e a definição de caso mudou em 2017.</li>", 1),
])
print('ok')
