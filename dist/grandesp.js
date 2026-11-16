'use strict';
// Tela "Capital × Grande SP": usa $, $$ e esc do app.js
(() => {
  const CAP = 'Capital', VIZ = 'Vizinhos da Grande SP', INT = 'Interior e litoral';
  const GRUPOS = [[CAP, '#10253e', 'Capital'], [VIZ, '#bd6024', 'Vizinhos'], [INT, '#8ea3b3', 'Interior']];
  const COD_CAPITAL = '355030';
  const DESTAQUE = {'355030': '#10253e', '351060': '#bd6024', '353440': '#bd6024'}; // capital, Carapicuíba, Osasco
  const ROTULOS = {gsp: ['355030', '351060', '353440', '350570', '351640', '352940', '351880', '352310'], sp: ['355030', '351060', '353440']};
  const n0 = x => Number(x).toLocaleString('pt-BR');
  const n1 = x => x === null || x === undefined ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const n2 = x => Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const pct = x => n1(x) + '%';
  const sinal = x => (x > 0 ? '+' : x < 0 ? '−' : '') + n2(Math.abs(x));
  const MES = {'09': 'set', '12': 'dez'};
  const quando = c => `${MES[c.slice(5, 7)] || c.slice(5, 7)}/${c.slice(0, 4)}`;
  const xComp = c => Number(c.slice(0, 4)) + (Number(c.slice(5, 7)) - 1) / 12;
  const INDICADOR = {
    sc: {campo: 'incidencia_sc_2021_23', rho: 'rho_sc', eixo: 'Sífilis congênita por 1.000 NV, 2021–23', nome: 'taxa de sífilis congênita'},
    det: {campo: 'deteccao_2021_23', rho: 'rho_deteccao', eixo: 'Gestantes com sífilis por 1.000 NV, 2021–23', nome: 'detecção em gestante'},
    raz: {campo: 'sc_por_100_gestantes_2021_23', rho: 'rho_sc_por_gestante', eixo: 'Casos congênitos por 100 gestantes, 2021–23', nome: 'casos congênitos por 100 gestantes'},
  };
  const CONJUNTO = {
    gsp: {recorte: 'Municípios da Grande SP', filtro: m => m.grande_sp && m.mil_nv, nome: 'municípios da Grande SP com pelo menos 1.000 nascidos vivos por ano'},
    sp: {recorte: 'Municípios paulistas', filtro: m => m.mil_nv, nome: 'municípios paulistas com pelo menos 1.000 nascidos vivos por ano'},
  };
  const COLUNAS = [
    ['nome', 'Município', null], ['nv_ano', 'Nascidos vivos por ano', n0],
    ['equipes_esf_2015', 'Equipes eSF dez/2015', n0], ['equipes_esf_2024', 'Equipes eSF dez/2024', n0],
    ['cobertura_2015_17', 'Cobertura 2015–17', pct], ['cobertura_2021_23', 'Cobertura 2021–23', pct],
    ['deteccao_2021_23', 'Detecção em gestante 2021–23', n1],
    ['incidencia_sc_2015_17', 'Taxa de SC 2015–17', n1], ['incidencia_sc_2021_23', 'Taxa de SC 2021–23', n1],
    ['incidencia_sc_2024', 'Taxa de SC 2024', n1], ['casos_sc_2024', 'Casos de SC 2024', n0], ['sc_por_100_gestantes_2021_23', 'SC por 100 gestantes 2021–23', n1],
  ];
  let D = null, ordem = {campo: 'incidencia_sc_2024', desc: true}, estado = {conjunto: 'gsp', indicador: 'sc'};

  const grupo = (g, ano) => D.grupos.find(r => r.grupo === g && r.ano === ano) || {};
  const cobGrupo = (g, comp) => (D.cobertura_grupos.find(r => r.grupo === g && r.competencia === comp) || {}).cobertura;

  // Linhas com rótulo no fim de cada série e faixas invisíveis com os valores de cada momento
  function linhas(alvo, series, o) {
    const W = 560, H = 310, L = 46, R = o.rotulo === false ? 44 : (o.R || 112), T = 16, B = 34;
    const xs = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].sort((a, b) => a - b);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const max = Math.max(...series.flatMap(s => s.pts.map(p => p.y ?? 0)));
    const passo = o.passo || (max > 60 ? 20 : max > 24 ? 10 : max > 12 ? 5 : 2);
    const top = o.top || Math.max(passo, Math.ceil(max / passo) * passo);
    const x = v => L + (W - L - R) * (v - x0) / (x1 - x0), y = v => T + (H - T - B) * (1 - v / top);
    const fmt = o.fmt || n1;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.titulo)}">`;
    if (o.faixa) svg += `<rect x="${x(o.faixa[0])}" y="${T}" width="${x(o.faixa[1]) - x(o.faixa[0])}" height="${H - T - B}" fill="#fff2e2"/><text x="${(x(o.faixa[0]) + x(o.faixa[1])) / 2}" y="${T + 12}" text-anchor="middle" style="fill:#914711;font-size:11px">${esc(o.faixa[2])}</text>`;
    for (let v = 0; v <= top; v += passo) svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e6edf1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(o.sufixo ? v + o.sufixo : n0(v))}</text>`;
    for (let ano = Math.ceil(x0 / 2) * 2; ano <= x1; ano += 2) svg += `<text x="${x(ano)}" y="${H - B + 22}" text-anchor="middle">${ano}</text>`;
    const fins = [];
    for (const s of series) {
      const pts = s.pts.filter(p => p.y !== null && p.y !== undefined);
      if (!pts.length) continue;
      svg += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.fina ? 1.75 : 2.5}"${s.tracejado ? ' stroke-dasharray="5 4"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      const u = pts[pts.length - 1];
      svg += `<circle cx="${x(u.x)}" cy="${y(u.y)}" r="3.5" fill="${s.c}"/>`;
      fins.push({s, y: y(u.y), texto: (s.rot ? s.rot + ' ' : '') + fmt(u.y)});
    }
    if (o.rotulo !== false) {
      fins.sort((a, b) => a.y - b.y);
      for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 15) fins[i].y = fins[i - 1].y + 15;
      const sobra = fins.length ? fins[fins.length - 1].y - (H - B) : 0;
      if (sobra > 0) fins.forEach(f => { f.y -= sobra; });
      for (const f of fins) svg += `<text x="${W - R + 9}" y="${f.y + 4}" style="fill:${f.s.c};font-weight:650">${esc(f.texto)}</text>`;
    }
    xs.forEach((v, i) => {
      const a = i ? (x(xs[i - 1]) + x(v)) / 2 : L, b = i < xs.length - 1 ? (x(v) + x(xs[i + 1])) / 2 : W - R;
      const lista = series.map(s => [s, s.pts.find(p => p.x === v)]).filter(([, p]) => p && p.y !== null && p.y !== undefined)
        .sort((m, n) => n[1].y - m[1].y).map(([s, p]) => `${s.n}: ${fmt(p.y)}${p.extra ? ' (' + p.extra + ')' : ''}`);
      const ref = series.flatMap(s => s.pts).find(p => p.x === v);
      svg += `<rect x="${a}" y="${T}" width="${Math.max(1, b - a)}" height="${H - T - B}" fill="transparent"><title>${esc(ref.quando + '\n' + lista.join('\n'))}</title></rect>`;
    });
    $(alvo).innerHTML = svg + '</svg>';
  }

  function resumo() {
    const c15 = grupo(CAP, 2015), v15 = grupo(VIZ, 2015), c23 = grupo(CAP, 2024), v23 = grupo(VIZ, 2024);
    const cc = a => cobGrupo(CAP, a + '-12'), cv = a => cobGrupo(VIZ, a + '-12');
    $('#gsp-metrics').innerHTML = `<article><span>Sífilis congênita · 2024</span><strong>${n1(c23.incidencia_sc)} × ${n1(v23.incidencia_sc)}</strong><small>capital × vizinhos, por 1.000 nascidos vivos · 2015: ${n1(c15.incidencia_sc)} × ${n1(v15.incidencia_sc)}</small></article>`
      + `<article><span>Cobertura estimada de ESF · dez/2024</span><strong>${n0(Math.round(cc(2024)))}% × ${n0(Math.round(cv(2024)))}%</strong><small>dez/2015: ${pct(cc(2015))} × ${pct(cv(2015))} · dez/2019: ${pct(cc(2019))} × ${pct(cv(2019))}</small></article>`
      + `<article><span>Detecção em gestante · 2024</span><strong>${n1(c23.deteccao)} × ${n1(v23.deteccao)}</strong><small>por 1.000 nascidos vivos · 2015: ${n1(c15.deteccao)} × ${n1(v15.deteccao)}</small></article>`
      + `<article><span>Casos congênitos por 100 gestantes · 2024</span><strong>${n1(c23.sc_por_100_gestantes)} × ${n1(v23.sc_por_100_gestantes)}</strong><small>2015: ${n1(c15.sc_por_100_gestantes)} × ${n1(v15.sc_por_100_gestantes)}</small></article>`;
    const Q = 'Vizinhos com queda no CNES', O = 'Outros vizinhos';
    const sub = (g, ano) => D.subgrupos.find(r => r.grupo === g && r.ano === ano) || {};
    const cs = (g, comp) => (D.cobertura_subgrupos.find(r => r.grupo === g && r.competencia === comp) || {}).cobertura;
    const nq = D.queda_cnes.length, no = 38 - nq;
    $('#gsp-achado').innerHTML = `<strong>Leitura</strong><p>Em 2015, a capital e os 38 municípios vizinhos tinham a mesma cobertura de ESF (${pct(cc(2015))} e ${pct(cv(2015))}) e a mesma taxa de sífilis congênita (${n1(c15.incidencia_sc)} e ${n1(v15.incidencia_sc)} por 1.000 nascidos vivos). Até 2019 a capital chega a ${pct(cc(2019))} de cobertura e os vizinhos caem para ${pct(cv(2019))}, mas a queda vem toda de ${n0(nq)} municípios em que as equipes somem do CNES. Nos outros ${n0(no)} a cobertura fica parada (${pct(cs(O, '2015-12'))} e ${pct(cs(O, '2019-12'))}) e a sífilis congênita sobe do mesmo jeito: de ${n1(sub(O, 2015).incidencia_sc)} para ${n1(sub(O, 2019).incidencia_sc)}, contra ${n1(c15.incidencia_sc)} para ${n1(grupo(CAP, 2019).incidencia_sc)} na capital. Em 2024 a distância aumenta: ${n1(c23.incidencia_sc)} na capital e ${n1(v23.incidencia_sc)} nos vizinhos, que somam ${n0(v23.casos_sc)} casos contra ${n0(c23.casos_sc)}. São séries agregadas: a comparação levanta a hipótese, não a testa. Município a município, a cobertura de ESF acompanha a detecção de sífilis em gestante e não a taxa de sífilis congênita.</p>`;
  }

  function subgrupos() {
    const Q = 'Vizinhos com queda no CNES', O = 'Outros vizinhos';
    const nq = D.queda_cnes.length, no = 38 - nq;
    const S = [[CAP, '#10253e', 'Capital', true], [Q, '#bd6024', nq + ' com queda', false], [O, '#007e70', no + ' outros', false]];
    const cobDe = g => (g === CAP ? D.cobertura_grupos : D.cobertura_subgrupos).filter(r => r.grupo === g);
    const scDe = g => (g === CAP ? D.grupos : D.subgrupos).filter(r => r.grupo === g);
    linhas('#gsp-sub-cob', S.map(([g, c, rot, fina]) => ({n: g, c, rot, fina, tracejado: fina,
      pts: cobDe(g).map(r => ({x: xComp(r.competencia), y: r.cobertura, quando: quando(r.competencia), extra: n0(r.equipes_esf) + ' equipes'}))})),
      {titulo: 'Cobertura estimada de ESF: capital, vizinhos com queda de equipes no CNES e outros vizinhos', top: 60, passo: 20, sufixo: '%', fmt: pct, R: 128});
    linhas('#gsp-sub-sc', S.map(([g, c, rot, fina]) => ({n: g, c, rot, fina, tracejado: fina,
      pts: scDe(g).map(r => ({x: r.ano, y: r.incidencia_sc, quando: String(r.ano), extra: n0(r.casos_sc) + ' casos'}))})),
      {titulo: 'Taxa de sífilis congênita: capital, vizinhos com queda de equipes no CNES e outros vizinhos', R: 128});
    const eq = comp => (D.cobertura_subgrupos.find(r => r.grupo === Q && r.competencia === comp) || {}).equipes_esf;
    const cs = (g, comp) => (D.cobertura_subgrupos.find(r => r.grupo === g && r.competencia === comp) || {}).cobertura;
    const sub = (g, ano) => D.subgrupos.find(r => r.grupo === g && r.ano === ano) || {};
    const nomes = D.queda_cnes.map(m => m.nome), lista = nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1];
    $('#gsp-sub-texto').textContent = `Em ${lista}, as equipes eSF ativas caem pela metade ou mais no CNES entre 2016 e 2019: somadas, vão de ${n0(eq('2015-12'))} em dezembro de 2015 para ${n0(eq('2018-12'))} em dezembro de 2018. Nos outros ${n0(no)} vizinhos a cobertura fica entre ${pct(cs(O, '2015-12'))} e ${pct(cs(O, '2019-12'))}.`;
    $('#gsp-sub-leitura').innerHTML = `<strong>Até 2019 a sífilis congênita sobe igual nos dois grupos de vizinhos</strong>, com ou sem queda de equipes no cadastro: ${n1(sub(Q, 2019).incidencia_sc)} e ${n1(sub(O, 2019).incidencia_sc)} por 1.000 nascidos vivos. A distância entre eles aparece depois de 2020: ${n1(sub(Q, 2022).incidencia_sc)} e ${n1(sub(O, 2022).incidencia_sc)} em 2022, ${n1(sub(Q, 2024).incidencia_sc)} e ${n1(sub(O, 2024).incidencia_sc)} em 2024. A subida da linha laranja de cobertura em 2020 depende do critério: na contagem do CNES usada aqui as equipes voltam naquele ano; no relatório do Ministério, ainda não (tabela abaixo).`;
    $('#gsp-sub-legenda').innerHTML = `<span><i class="tracejado"></i>Capital</span><span><i style="background:#bd6024"></i>${esc(lista)}</span><span><i style="background:#007e70"></i>Outros ${n0(no)} vizinhos</span>`;
  }

  function series() {
    const sg = campo => GRUPOS.map(([g, c, rot]) => ({n: g, c, rot, fina: g === INT,
      pts: D.grupos.filter(r => r.grupo === g).map(r => ({x: r.ano, y: r[campo], quando: String(r.ano)}))}));
    linhas('#gsp-sc', sg('incidencia_sc'), {titulo: 'Taxa de sífilis congênita de 2013 a 2024: capital, vizinhos da Grande SP e interior'});
    linhas('#gsp-det', sg('deteccao'), {titulo: 'Detecção de sífilis em gestante de 2013 a 2024: capital, vizinhos da Grande SP e interior'});
    linhas('#gsp-cob', GRUPOS.map(([g, c, rot]) => ({n: g, c, rot, fina: g === INT,
      pts: D.cobertura_grupos.filter(r => r.grupo === g).map(r => ({x: xComp(r.competencia), y: r.cobertura, quando: quando(r.competencia), extra: n0(r.equipes_esf) + ' equipes'}))})),
      {titulo: 'Cobertura estimada de ESF de dezembro de 2014 a setembro de 2026: capital, vizinhos da Grande SP e interior', top: 80, passo: 20, sufixo: '%', fmt: pct,
        faixa: [xComp('2019-12'), xComp('2020-12'), 'cadastro']});
    const e = D.equipes_estado;
    $('#gsp-salto').textContent = `Entre dezembro de 2019 e dezembro de 2020, as equipes eSF registradas no estado passam de ${n0(e['2019-12'].esf)} para ${n0(e['2020-12'].esf)} e as eAP de ${n0(e['2019-12'].eap)} para ${n0(e['2020-12'].eap)}.`;
  }

  function egestor() {
    const anos = [...new Set(D.egestor.map(r => r.competencia))].sort();
    const nomes = [...new Set(D.egestor.map(r => r.municipio))];
    const cel = (m, c) => { const r = D.egestor.find(x => x.municipio === m && x.competencia === c); return r ? `<td class="value${r.n_esf === 0 ? ' gsp-zero' : ''}"><strong>${n0(r.n_esf)}</strong> · ${n0(Math.round(r.cobertura_ab))}%</td>` : '<td class="value">—</td>'; };
    $('#gsp-egestor').innerHTML = `<table><thead><tr><th scope="col">Dezembro de</th>${anos.map(c => `<th scope="col" class="num">${esc(c.slice(0, 4))}</th>`).join('')}</tr></thead><tbody>${nomes.map(m => `<tr><td>${esc(m)}</td>${anos.map(c => cel(m, c)).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function cascata() {
    const L = [['deteccao', 'Gestantes com sífilis notificadas, por 1.000 nascidos vivos', n1],
      ['pct_gestante_1o_trimestre', 'Gestantes diagnosticadas no 1º trimestre', pct],
      ['pct_prenatal', 'Casos congênitos: mãe fez pré-natal', pct],
      ['pct_dx_prenatal', 'Casos congênitos: sífilis materna diagnosticada no pré-natal', pct],
      ['pct_sem_tratamento', 'Casos congênitos: mãe não tratada', pct],
      ['sc_por_100_gestantes', 'Casos congênitos por 100 gestantes notificadas', n1],
      ['incidencia_sc', 'Sífilis congênita por 1.000 nascidos vivos', n1]];
    $('#gsp-cascata').innerHTML = `<table><thead><tr><th scope="col">2024</th>${GRUPOS.map(([g]) => `<th scope="col" class="num">${esc(g)}</th>`).join('')}</tr></thead><tbody>${L.map(([k, t, f]) =>
      `<tr><td>${esc(t)}</td>${GRUPOS.map(([g]) => `<td class="value">${esc(f(grupo(g, 2024)[k]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function dispersao() {
    const cj = CONJUNTO[estado.conjunto], ind = INDICADOR[estado.indicador];
    const pontos = D.municipios.filter(cj.filtro).filter(m => m[ind.campo] !== null);
    const W = 760, H = 400, L = 54, R = 24, T = 16, B = 52;
    const max = Math.max(...pontos.map(m => m[ind.campo]));
    const passo = max > 60 ? 20 : max > 24 ? 10 : max > 12 ? 5 : 2;
    const top = Math.ceil(max / passo) * passo;
    const x = v => L + (W - L - R) * v / 100, y = v => T + (H - T - B) * (1 - v / top);
    const cor = m => DESTAQUE[m.cod] || (m.grande_sp ? '#5fb3a5' : '#c3cfd9');
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="gsp-d-t gsp-d-d"><title id="gsp-d-t">Cobertura de ESF e ${esc(ind.nome)} por município</title><desc id="gsp-d-d">Um ponto por município: ${esc(cj.nome)}. Horizontal: cobertura estimada de ESF em 2021–23. Vertical: ${esc(ind.eixo)}.</desc>`;
    for (let v = 0; v <= top; v += passo) svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e6edf1"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`;
    for (let v = 0; v <= 100; v += 20) svg += `<text x="${x(v)}" y="${H - B + 22}" text-anchor="middle">${v}%</text>`;
    svg += `<text class="axis-label" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Cobertura estimada de ESF, 2021–23</text>`;
    svg += `<text class="axis-label" transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${esc(ind.eixo)}</text>`;
    const peso = m => (DESTAQUE[m.cod] ? 2 : m.grande_sp ? 1 : 0);
    for (const m of [...pontos].sort((a, b) => peso(a) - peso(b))) {
      svg += `<circle cx="${x(m.cobertura_2021_23)}" cy="${y(m[ind.campo])}" r="${DESTAQUE[m.cod] ? 7.5 : 6}" fill="${cor(m)}" stroke="#fff" stroke-width="1.5"><title>${esc(m.nome)}: cobertura ${esc(pct(m.cobertura_2021_23))}, ${esc(ind.nome)} ${esc(n1(m[ind.campo]))} · ${esc(n0(m.nv_ano))} nascidos vivos por ano</title></circle>`;
    }
    for (const cod of ROTULOS[estado.conjunto]) {
      const m = pontos.find(p => p.cod === cod);
      if (!m) continue;
      const px = x(m.cobertura_2021_23), fim = px > W - R - 150;
      svg += `<text x="${px + (fim ? -11 : 11)}" y="${y(m[ind.campo]) + 4}" text-anchor="${fim ? 'end' : 'start'}" style="fill:${DESTAQUE[m.cod] || '#344e64'};font-weight:${DESTAQUE[m.cod] ? 650 : 500}">${esc(m.nome)}</text>`;
    }
    $('#gsp-dispersao').innerHTML = svg + '</svg>';
    const c = D.correlacoes.find(r => r.recorte === cj.recorte), rho = c[ind.rho], sig = Math.abs(rho) >= c.critico;
    $('#gsp-rho').innerHTML = `<strong>ρ de Spearman = ${esc(sinal(rho))}</strong> entre a cobertura de ESF e ${esc(ind.nome)}, em ${n0(c.n)} ${esc(cj.nome)}. ${sig ? 'Fora da faixa do acaso' : 'Dentro da faixa do acaso'}: com ${n0(c.n)} municípios, só é significativa acima de ${esc(n2(c.critico))} em módulo.`;
    $$('#gsp-controles button').forEach(b => b.setAttribute('aria-pressed', String(estado[b.dataset.tipo] === b.dataset.valor)));
  }

  function correlacoes() {
    const cel = (v, c) => `<td class="value${Math.abs(v) >= c ? ' gsp-sig' : ''}">${esc(sinal(v))}</td>`;
    $('#gsp-correl').innerHTML = `<table><thead><tr><th scope="col">Recorte</th><th scope="col" class="num">Unidades</th><th scope="col" class="num">ESF × taxa de sífilis congênita</th><th scope="col" class="num">ESF × detecção em gestante</th><th scope="col" class="num">ESF × casos congênitos por 100 gestantes</th><th scope="col" class="num">ESF × taxa, descontada a detecção</th></tr></thead><tbody>${D.correlacoes.map(c =>
      `<tr><td><strong>${esc(c.recorte)}</strong> · ${esc(c.periodo)}<br><small>${esc(c.nota || '')}</small></td><td class="value">${n0(c.n)}</td>${cel(c.rho_sc, c.critico)}${cel(c.rho_deteccao, c.critico)}${cel(c.rho_sc_por_gestante, c.critico)}<td class="value">${esc(sinal(c.parcial_sc))}</td></tr>`).join('')}</tbody></table>`;
  }

  function barras(alvo, eq, cor, titulo) {
    const W = 560, H = 310, L = 46, R = 14, T = 22, B = 34;
    const max = Math.max(...eq.map(e => e[1]), 1);
    const passo = max > 600 ? 500 : max > 160 ? 50 : max > 60 ? 20 : max > 24 ? 10 : 5;
    const top = Math.ceil(max / passo) * passo;
    const larg = (W - L - R) / eq.length, y = v => T + (H - T - B) * (1 - v / top);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">`;
    for (let v = 0; v <= top; v += passo) svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e6edf1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`;
    eq.forEach(([comp, esf, eap, cob], i) => {
      const cx = L + larg * (i + .5), h = (H - T - B) * esf / top;
      svg += `<rect x="${cx - larg * .36}" y="${y(esf)}" width="${larg * .72}" height="${Math.max(h, 0)}" fill="${cor}" rx="2"><title>${esc(quando(comp))}: ${n0(esf)} equipes eSF, ${n0(eap)} eAP · cobertura ${esc(pct(cob))}</title></rect>`;
      svg += `<text x="${cx}" y="${y(esf) - 6}" text-anchor="middle" class="bar-label"${esf === 0 ? ' style="fill:#b3261e"' : ''}>${n0(esf)}</text>`;
      svg += `<text x="${cx}" y="${H - B + 22}" text-anchor="middle">${comp.endsWith('-12') ? "'" + comp.slice(2, 4) : 'set/26'}</text>`;
    });
    $(alvo).innerHTML = svg + '</svg>';
  }

  function municipio() {
    const sel = $('#gsp-mun');
    const lista = D.municipios.filter(m => m.grande_sp);
    if (!sel.options.length) {
      sel.innerHTML = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(m => `<option value="${esc(m.cod)}">${esc(m.nome)}</option>`).join('');
      sel.value = '351060';
      sel.addEventListener('change', municipio);
      $$('#gsp-atalhos button').forEach(b => b.addEventListener('click', () => { sel.value = b.dataset.cod; municipio(); }));
    }
    const m = lista.find(r => r.cod === sel.value), s = D.series[m.cod], cap = D.series[COD_CAPITAL];
    const ehCap = m.cod === COD_CAPITAL, cor = ehCap ? '#10253e' : '#bd6024';
    $$('#gsp-atalhos button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cod === m.cod)));
    barras('#gsp-mun-eq', s.equipes, cor, `Equipes de Saúde da Família de ${m.nome} no CNES, de dezembro de 2014 a setembro de 2026`);
    const serie = (nome, c, d, extra) => ({n: nome, c, ...extra, pts: d.sc.map(([ano, taxa, casos]) => ({x: ano, y: taxa, quando: String(ano), extra: n0(casos) + ' casos'}))});
    linhas('#gsp-mun-sc', ehCap ? [serie(m.nome, cor, s)] : [serie(m.nome, cor, s), serie('São Paulo (capital)', '#10253e', cap, {tracejado: true, fina: true})],
      {titulo: `Taxa de sífilis congênita de ${m.nome} e da capital, de 2013 a 2024`, rotulo: false});
    $('#gsp-mun-legenda').innerHTML = `<span><i style="background:${cor}"></i>${esc(m.nome)}</span>${ehCap ? '' : '<span><i class="tracejado"></i>São Paulo (capital)</span>'}`;
    const zeros = s.equipes.filter(e => e[1] === 0 && e[0] > '2014-12').map(e => e[0].slice(0, 4));
    const min = s.equipes.filter(e => e[0] >= '2015-12' && e[0] <= '2019-12').reduce((a, e) => (e[1] < a[1] ? e : a));
    $('#gsp-mun-resumo').innerHTML = `<strong>${esc(m.nome)}</strong> · ${n0(m.nv_ano)} nascidos vivos por ano · equipes eSF no CNES: ${n0(m.equipes_esf_2015)} em dez/2015, ${n0(min[1])} em ${esc(quando(min[0]))}, ${n0(m.equipes_esf_2024)} em dez/2024 · taxa de sífilis congênita: ${esc(n1(m.incidencia_sc_2015_17))} em 2015–17, ${esc(n1(m.incidencia_sc_2021_23))} em 2021–23 e ${esc(n1(m.incidencia_sc_2024))} em 2024 (${n0(m.casos_sc_2024)} casos)${zeros.length ? ` · sem nenhuma equipe eSF registrada em ${esc(zeros.join(', '))}` : ''}${m.mil_nv ? '' : ' · menos de 1.000 nascidos vivos por ano: a taxa oscila muito de um ano para o outro'}`;
  }

  function tabela() {
    const texto = ordem.campo === 'nome';
    const rows = D.municipios.filter(m => m.grande_sp).sort((a, b) => {
      const c = texto ? a.nome.localeCompare(b.nome, 'pt-BR') : (a[ordem.campo] ?? -1) - (b[ordem.campo] ?? -1);
      return ordem.desc ? -c : c;
    });
    $('#gsp-tabela').innerHTML = `<table><thead><tr>${COLUNAS.map(([k, t, f]) => `<th scope="col"${f ? ' class="num"' : ''} aria-sort="${ordem.campo === k ? (ordem.desc ? 'descending' : 'ascending') : 'none'}"><button type="button" data-ordem="${k}">${t}</button></th>`).join('')}</tr></thead>`
      + `<tbody>${rows.map(r => `<tr class="${r.capital ? 'gsp-capital' : ''}${r.mil_nv ? '' : ' gsp-pequeno'}">${COLUNAS.map(([k, , f]) => `<td${f ? ' class="value"' : ''}>${esc(f ? f(r[k]) : r[k] + (r.capital ? ' (capital)' : ''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $$('#gsp-tabela th button').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.ordem;
      ordem = {campo: k, desc: ordem.campo === k ? !ordem.desc : k !== 'nome'};
      tabela();
      $(`#gsp-tabela th button[data-ordem="${k}"]`).focus();
    }));
  }

  fetch('grande-sp.json', {cache: 'no-store'}).then(r => { if (!r.ok) throw new Error('Dados indisponíveis'); return r.json(); }).then(d => {
    D = d;
    resumo(); series(); subgrupos(); egestor(); cascata(); dispersao(); correlacoes(); municipio(); tabela();
    $$('#gsp-controles button').forEach(b => b.addEventListener('click', () => { estado[b.dataset.tipo] = b.dataset.valor; dispersao(); }));
  }).catch(() => {
    $('#gsp-achado').innerHTML = '<strong>Falha</strong><p>Não foi possível carregar os dados desta tela. Recarregue a página.</p>';
  });
})();
