'use strict';
// Tela "ESF por STS": usa $, $$ e esc do app.js
(() => {
  const NORTE = [
    ['Santana/Jaçanã', '#bd6024'],
    ['Casa Verde/Cachoeirinha', '#7a4fb3'],
    ['Vila Maria/Vila Guilherme', '#c0407a'],
    ['Freguesia/Brasilândia', '#007e70'],
    ['Pirituba', '#2f6fb0'],
    ['Perus', '#8a8f2a'],
  ];
  const COR = Object.fromEntries(NORTE);
  const MUN = 'Município';
  const RHO_CRITICO = 0.39; // Spearman, 26 STS, bicaudal a 5%
  const n0 = x => Number(x).toLocaleString('pt-BR');
  const n1 = x => Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const n2 = x => Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const pct = x => n1(x) + '%';
  const sinal = x => (x > 0 ? '+' : x < 0 ? '−' : '') + n2(Math.abs(x));
  const MODELO = {ESF: 'pill', Mista: 'pill mista', Tradicional: 'pill trad'};
  const ORDEM_MODELO = {ESF: 0, Mista: 1, Tradicional: 2};
  const COLUNAS = [
    ['sts', 'STS', null], ['crs', 'CRS', null],
    ['taxa_sc_2014_16', 'Taxa 2014–16', n1], ['taxa_sc_2022_24', 'Taxa 2022–24', n1],
    ['cobertura_esf_2014', 'Cobertura 2014', pct], ['cobertura_esf_2024', 'Cobertura 2024', pct],
    ['ubs_esf', 'UBS só ESF', n0], ['ubs_mista', 'UBS mistas', n0], ['ubs_tradicional', 'UBS tradicionais', n0],
    ['pop_2022', 'População 2022', n0],
  ];
  let D = null, ordem = {campo: 'taxa_sc_2022_24', desc: true};

  function postos(v) {
    const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = [];
    for (let i = 0; i < o.length;) {
      let j = i;
      while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++;
      for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  function spearman(x, y) {
    const a = postos(x), b = postos(y), n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let c = 0, va = 0, vb = 0;
    for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
    return c / Math.sqrt(va * vb);
  }

  function resumo() {
    const mun = (rows, k, v) => rows.find(r => r.sts === MUN && String(r[k]) === v) || {};
    const sc24 = mun(D.sc_ano, 'ano', '2024'), sc14 = mun(D.sc_ano, 'ano', '2014');
    const c26 = mun(D.cobertura_ano, 'competencia', '2026-09'), c14 = mun(D.cobertura_ano, 'competencia', '2014-12');
    const conta = m => D.ubs.filter(u => u.modelo === m).length;
    const r = spearman(D.sts.map(s => s.cobertura_esf_2024), D.sts.map(s => s.taxa_sc_2022_24));
    const rv = spearman(D.sts.map(s => s.cobertura_esf_2024 - s.cobertura_esf_2014), D.sts.map(s => s.taxa_sc_2022_24 - s.taxa_sc_2014_16));
    $('#esf-metrics').innerHTML = `<article><span>Sífilis congênita · município, 2024</span><strong>${n1(sc24.taxa_sc)}</strong><small>por 1.000 nascidos vivos · 2014: ${n1(sc14.taxa_sc)}</small></article>`
      + `<article><span>Cobertura estimada de ESF · set/2026</span><strong>${pct(c26.cobertura_esf_pct)}</strong><small>dez/2014: ${pct(c14.cobertura_esf_pct)}</small></article>`
      + `<article><span>UBS da SMS · set/2026</span><strong>${n0(D.ubs.length)}</strong><small>${n0(conta('ESF'))} só ESF · ${n0(conta('Mista'))} mistas · ${n0(conta('Tradicional'))} tradicionais</small></article>`
      + `<article><span>Correlação entre as STS</span><strong>ρ ${sinal(r)}</strong><small>cobertura 2024 × taxa 2022–24</small></article>`;
    const forte = Math.abs(r) >= RHO_CRITICO;
    $('#esf-achado').innerHTML = `<strong>Achado</strong><p>Nas ${n0(D.sts.length)} STS, cobertura de ESF e taxa de sífilis congênita ${forte ? 'andam juntas' : 'não andam juntas'}: ρ de Spearman = ${sinal(r)}; para a mudança de 2014 a 2024, ${sinal(rv)}. Com ${n0(D.sts.length)} STS, a correlação só é significativa acima de ${n2(RHO_CRITICO)} em módulo. É uma comparação entre territórios: não mede o efeito da ESF sobre cada gestante.</p>`;
  }

  function eixoY(svg0, top, passo, y, L, W, R) {
    let svg = svg0;
    for (let v = 0; v <= top; v += passo) svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e6edf1"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${esc(passo >= 20 ? v + '%' : n0(v))}</text>`;
    return svg;
  }

  function dispersao() {
    const W = 760, H = 390, L = 54, R = 24, T = 16, B = 52;
    const top = Math.ceil(Math.max(...D.sts.map(s => s.taxa_sc_2022_24)) / 2) * 2;
    const x = v => L + (W - L - R) * v / 100, y = v => T + (H - T - B) * (1 - v / top);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="esf-d-t esf-d-d"><title id="esf-d-t">Cobertura de ESF e taxa de sífilis congênita por STS</title><desc id="esf-d-d">Um ponto por STS. Horizontal: cobertura estimada de ESF em dezembro de 2024. Vertical: taxa de sífilis congênita por 1.000 nascidos vivos em 2022–24. A Zona Norte está colorida.</desc>`;
    for (let v = 0; v <= top; v += 2) svg += `<line x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}" stroke="#e6edf1"/><text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`;
    for (let v = 0; v <= 100; v += 20) svg += `<text x="${x(v)}" y="${H - B + 22}" text-anchor="middle">${v}%</text>`;
    svg += `<text class="axis-label" x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Cobertura estimada de ESF, dez/2024</text>`;
    svg += `<text class="axis-label" transform="translate(13 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">Taxa por 1.000 NV, 2022–24</text>`;
    const pontos = [...D.sts].sort((a, b) => Boolean(COR[a.sts]) - Boolean(COR[b.sts]));
    for (const s of pontos) {
      svg += `<circle cx="${x(s.cobertura_esf_2024)}" cy="${y(s.taxa_sc_2022_24)}" r="${COR[s.sts] ? 7 : 6}" fill="${COR[s.sts] || '#c3cfd9'}" stroke="#fff" stroke-width="1.5"><title>${esc(s.sts)} (${esc(s.crs)}): cobertura ${esc(pct(s.cobertura_esf_2024))}, taxa ${esc(n1(s.taxa_sc_2022_24))}</title></circle>`;
    }
    $('#esf-dispersao').innerHTML = svg + '</svg>';
  }

  function linhas(alvo, rows, campo, xDe, quando, titulo, yTop) {
    const W = 560, H = 300, L = 48, R = 16, T = 14, B = 34;
    const series = [...NORTE.map(([n, c]) => ({n, c})), {n: MUN, c: '#10253e', mun: true}]
      .map(s => ({...s, pts: rows.filter(r => r.sts === s.n).map(r => ({x: xDe(r), y: r[campo], r})).sort((a, b) => a.x - b.x)}));
    const xs = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].sort((a, b) => a - b);
    const x0 = xs[0], x1 = xs[xs.length - 1];
    const passo = yTop ? 20 : 5;
    const top = yTop || Math.ceil(Math.max(...series.flatMap(s => s.pts.map(p => p.y))) / passo) * passo;
    const x = v => L + (W - L - R) * (v - x0) / (x1 - x0), y = v => T + (H - T - B) * (1 - v / top);
    let svg = eixoY(`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}">`, top, passo, y, L, W, R);
    for (let ano = Math.ceil(x0 / 2) * 2; ano <= x1; ano += 2) svg += `<text x="${x(ano)}" y="${H - B + 22}" text-anchor="middle">${ano}</text>`;
    for (const s of series) {
      if (!s.pts.length) continue;
      const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
      svg += `<path d="${d}" fill="none" stroke="${s.c}" stroke-width="${s.mun ? 1.75 : 2.25}"${s.mun ? ' stroke-dasharray="5 4"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    // Faixas invisíveis: o título de cada uma lista os valores daquele momento
    xs.forEach((v, i) => {
      const a = i ? (x(xs[i - 1]) + x(v)) / 2 : L, b = i < xs.length - 1 ? (x(v) + x(xs[i + 1])) / 2 : W - R;
      const linhasTitulo = series.map(s => [s, s.pts.find(p => p.x === v)]).filter(([, p]) => p).sort((m, n) => n[1].y - m[1].y)
        .map(([s, p]) => `${s.n}: ${campo === 'cobertura_esf_pct' ? pct(p.y) : n1(p.y)}`);
      const ref = series.flatMap(s => s.pts).find(p => p.x === v);
      svg += `<rect x="${a}" y="${T}" width="${Math.max(1, b - a)}" height="${H - T - B}" fill="transparent"><title>${esc(quando(ref.r) + '\n' + linhasTitulo.join('\n'))}</title></rect>`;
    });
    $(alvo).innerHTML = svg + '</svg>';
  }

  function norte() {
    linhas('#esf-norte-sc', D.sc_ano, 'taxa_sc', r => r.ano, r => String(r.ano), 'Taxa de sífilis congênita na Zona Norte, 2014 a 2024');
    const MES = {'09': 'set', '12': 'dez'};
    linhas('#esf-norte-cob', D.cobertura_ano, 'cobertura_esf_pct', r => Number(r.competencia.slice(0, 4)) + (Number(r.competencia.slice(5, 7)) - 1) / 12,
      r => `${MES[r.competencia.slice(5, 7)] || r.competencia.slice(5, 7)}/${r.competencia.slice(0, 4)}`, 'Cobertura estimada de ESF na Zona Norte, 2014 a 2026', 100);
  }

  function tabelaSts() {
    const texto = ordem.campo === 'sts' || ordem.campo === 'crs';
    const rows = [...D.sts].sort((a, b) => {
      const c = texto ? String(a[ordem.campo]).localeCompare(String(b[ordem.campo]), 'pt-BR') : a[ordem.campo] - b[ordem.campo];
      return ordem.desc ? -c : c;
    });
    $('#esf-tabela').innerHTML = `<table><thead><tr>${COLUNAS.map(([k, t, f]) => `<th scope="col"${f ? ' class="num"' : ''} aria-sort="${ordem.campo === k ? (ordem.desc ? 'descending' : 'ascending') : 'none'}"><button type="button" data-ordem="${k}">${t}</button></th>`).join('')}</tr></thead>`
      + `<tbody>${rows.map(r => `<tr${COR[r.sts] ? ' class="norte"' : ''}>${COLUNAS.map(([k, , f]) => `<td${f ? ' class="value"' : ''}>${esc(f ? f(r[k]) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $$('#esf-tabela th button').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.ordem;
      ordem = {campo: k, desc: ordem.campo === k ? !ordem.desc : !(k === 'sts' || k === 'crs')};
      tabelaSts();
      $(`#esf-tabela th button[data-ordem="${k}"]`).focus();
    }));
  }

  function ubsPorSts() {
    const sel = $('#esf-sts');
    if (!sel.options.length) {
      sel.innerHTML = D.sts.map(s => s.sts).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
      sel.value = 'Santana/Jaçanã';
      sel.addEventListener('change', ubsPorSts);
    }
    const s = D.sts.find(r => r.sts === sel.value);
    const lista = D.ubs.filter(u => u.sts === sel.value).sort((a, b) => (ORDEM_MODELO[a.modelo] - ORDEM_MODELO[b.modelo]) || a.ubs.localeCompare(b.ubs, 'pt-BR'));
    $('#esf-ubs-resumo').innerHTML = `<strong>${esc(s.sts)}</strong> · ${n0(s.ubs_2026)} UBS: ${n0(s.ubs_esf)} só ESF, ${n0(s.ubs_mista)} mistas, ${n0(s.ubs_tradicional)} tradicionais · cobertura de ESF ${esc(pct(s.cobertura_esf_2024))} em dez/2024 · taxa de ${esc(n1(s.taxa_sc_2022_24))} por 1.000 NV em 2022–24`;
    $('#esf-ubs').innerHTML = `<table><thead><tr><th scope="col">UBS</th><th scope="col">CNES</th><th scope="col">Modelo</th><th scope="col" class="num">Equipes eSF</th><th scope="col" class="num">Equipes eAP</th><th scope="col">Endereço</th></tr></thead>`
      + `<tbody>${lista.map(u => `<tr><td>${esc(u.ubs)}</td><td>${esc(u.cnes)}</td><td><span class="${MODELO[u.modelo] || 'pill trad'}">${esc(u.modelo)}</span></td><td class="value">${n0(u.equipes_esf)}</td><td class="value">${n0(u.equipes_eap)}</td><td>${esc(u.endereco)}</td></tr>`).join('')}</tbody></table>`;
  }

  fetch('esf-sts.json', {cache: 'no-store'}).then(r => { if (!r.ok) throw new Error('Dados indisponíveis'); return r.json(); }).then(d => {
    D = d;
    resumo(); dispersao(); norte(); tabelaSts(); ubsPorSts();
  }).catch(() => {
    $('#esf-achado').innerHTML = '<strong>Falha</strong><p>Não foi possível carregar os dados desta tela. Recarregue a página.</p>';
  });
})();
