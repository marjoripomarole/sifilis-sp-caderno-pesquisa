'use strict';
// Tela "03 Mapa interativo" (#mapa) e tabelas dinâmicas de "04 Síntese executiva" (#sintese)
(() => {
  const ZN_TRAD = new Set([
    'Santana/Jaçanã',
    'Casa Verde/Cachoeirinha',
    'Vila Maria/Vila Guilherme',
    'Freguesia/Brasilândia',
    'Pirituba',
    'Perus',
  ]);
  const COR_ZN = {
    'Santana/Jaçanã': '#bd6024',
    'Casa Verde/Cachoeirinha': '#7a4fb3',
    'Vila Maria/Vila Guilherme': '#c0407a',
    'Freguesia/Brasilândia': '#007e70',
    'Pirituba': '#2f6fb0',
    'Perus': '#8a8f2a',
    'Sé/Santa Cecília': '#b84a39',
  };
  const COR_MODELO = {
    ESF: '#007e70',
    Mista: '#7a4fb3',
    Tradicional: '#bd6024',
    'Especial/Indígena': '#526578',
  };
  const PILL_MODELO = {
    ESF: 'pill',
    Mista: 'pill mista',
    Tradicional: 'pill trad',
    'Especial/Indígena': 'pill trad',
  };

  const INDICADORES = {
    taxa_sc: {
      rotulo: 'Taxa de sífilis congênita',
      curto: 'Taxa SC',
      unidade: 'por 1.000 NV',
      minAno: 2014,
      dominio: [2, 4, 6, 8, 10, 13],
      cores: ['#f1f7f6', '#d1ebe6', '#9dd5ca', '#58b4a6', '#218b7d', '#0f6359', '#083b36'],
      inverso: true, // maior é pior, mas usamos paleta sequencial escura para mais intensidade
      fmt: x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}),
    },
    deteccao_gestante: {
      rotulo: 'Detecção de sífilis em gestante',
      curto: 'Detecção gestante',
      unidade: 'por 1.000 NV',
      minAno: 2015,
      dominio: [15, 30, 45, 60, 80, 100],
      cores: ['#f3f6fb', '#d5e3f4', '#a6c5e8', '#6d9fd6', '#3b78bc', '#1f5494', '#103362'],
      fmt: x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}),
    },
    sc_por_100_gestantes: {
      rotulo: 'Casos congênitos por 100 gestantes com sífilis',
      curto: 'SC / 100 gestantes',
      unidade: '%',
      minAno: 2015,
      dominio: [6, 10, 15, 22, 32, 45],
      cores: ['#fdf6ef', '#f9e2cc', '#f2c299', '#e5985b', '#c96f28', '#9c4d14', '#662f08'],
      fmt: x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
    },
    cobertura_esf: {
      rotulo: 'Cobertura estimada de ESF (dezembro)',
      curto: 'Cobertura ESF',
      unidade: '%',
      minAno: 2014,
      dominio: [15, 30, 45, 60, 75, 90],
      cores: ['#f2f8f5', '#d5ede2', '#a5d9c3', '#6bc09f', '#349e79', '#147756', '#084d36'],
      fmt: x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + '%',
    },
  };

  const n0 = x => x == null ? '—' : Number(x).toLocaleString('pt-BR');
  const n1 = x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
  const n2 = x => x == null ? '—' : Number(x).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const sinal = x => x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + n2(Math.abs(x));

  let M = null;
  let estado = {
    ano: 2025,
    indicador: 'taxa_sc',
    regiao: 'todas', // todas | zn_crs | zn_trad | Norte | Sul | Leste | Sudeste | Oeste
    mostrarUbs: true,
    mostrarAaubs: false,
    colorirAaubs: false,
    mostrarRotulos: true,
    modeloUbs: 'todos', // todos | ESF | Mista | Tradicional
    buscaUbs: '',
    stsSelecionada: null,
    ubsSelecionada: null,
    timer: null,
    viewBox: {x: 0, y: 0, w: 780, h: 960},
  };

  const W_BASE = 780, H_BASE = 960, PAD = 26;
  let proj = null;

  function criaProjecao(bbox) {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const cosLat = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const dLon = (maxLon - minLon) * cosLat;
    const dLat = maxLat - minLat;
    const scale = Math.min((W_BASE - 2 * PAD) / dLon, (H_BASE - 2 * PAD) / dLat);
    const wMapa = dLon * scale;
    const hMapa = dLat * scale;
    const offX = (W_BASE - wMapa) / 2;
    const offY = (H_BASE - hMapa) / 2;
    return {
      x: lon => offX + (lon - minLon) * cosLat * scale,
      y: lat => offY + (maxLat - lat) * scale,
    };
  }

  function ringsToPath(rings) {
    let d = '';
    for (const ring of rings) {
      if (!ring || ring.length < 3) continue;
      for (let i = 0; i < ring.length; i++) {
        const px = proj.x(ring[i][0]).toFixed(1);
        const py = proj.y(ring[i][1]).toFixed(1);
        d += (i === 0 ? 'M' : 'L') + px + ' ' + py;
      }
      d += 'Z';
    }
    return d;
  }

  function corIndicador(indKey, val) {
    if (val == null || !Number.isFinite(Number(val))) return '#e6edf1';
    const cfg = INDICADORES[indKey];
    const v = Number(val);
    for (let i = 0; i < cfg.dominio.length; i++) {
      if (v < cfg.dominio[i]) return cfg.cores[i];
    }
    return cfg.cores[cfg.cores.length - 1];
  }

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
    const pares = x.map(( vx, i ) => [vx, y[i]]).filter(([a, b]) => a != null && b != null && Number.isFinite(a) && Number.isFinite(b));
    if (pares.length < 5) return null;
    const a = postos(pares.map(p => p[0])), b = postos(pares.map(p => p[1])), n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let c = 0, va = 0, vb = 0;
    for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
    return (va && vb) ? c / Math.sqrt(va * vb) : 0;
  }

  function stsEmFoco(s) {
    if (estado.regiao === 'todas') return true;
    if (estado.regiao === 'zn_trad') return s.zona_norte_tradicional;
    if (estado.regiao === 'zn_crs') return s.crs_norte_2026;
    return s.crs_2026 === estado.regiao || s.crs === estado.regiao;
  }

  function focarBbox(ringsList) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const rings of ringsList) {
      for (const r of rings) {
        for (const [lon, lat] of r) {
          const px = proj.x(lon), py = proj.y(lat);
          if (px < minX) minX = px;
          if (py < minY) minY = py;
          if (px > maxX) maxX = px;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (!Number.isFinite(minX)) {
      estado.viewBox = {x: 0, y: 0, w: W_BASE, h: H_BASE};
      aplicarViewBox();
      return;
    }
    const pad = 38;
    let w = Math.max(120, (maxX - minX) + pad * 2);
    let h = Math.max(140, (maxY - minY) + pad * 2);
    const ratio = W_BASE / H_BASE;
    if (w / h > ratio) {
      h = w / ratio;
    } else {
      w = h * ratio;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    estado.viewBox = {
      x: Math.max(0, Math.min(W_BASE - w, cx - w / 2)),
      y: Math.max(0, Math.min(H_BASE - h, cy - h / 2)),
      w: Math.min(W_BASE, w),
      h: Math.min(H_BASE, h),
    };
    aplicarViewBox();
  }

  function aplicarViewBox() {
    const svg = $('#mapa-svg');
    if (!svg) return;
    const {x, y, w, h} = estado.viewBox;
    svg.setAttribute('viewBox', `${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`);
  }

  function atualizarMetricasTopo() {
    const anoStr = String(estado.ano);
    const mun = M.municipio.series[anoStr] || {};
    const cobs = M.sts.map(s => (s.series[anoStr] || {}).cobertura_esf);
    const vals = M.sts.map(s => (s.series[anoStr] || {})[estado.indicador]);
    const rho = estado.indicador === 'cobertura_esf'
      ? spearman(cobs, M.sts.map(s => (s.series[anoStr] || {}).taxa_sc))
      : spearman(cobs, vals);
    const rotCorr = estado.indicador === 'cobertura_esf'
      ? `cobertura × taxa SC em ${estado.ano}`
      : `cobertura × ${INDICADORES[estado.indicador].curto.toLowerCase()} em ${estado.ano}`;

    $('#mapa-metrics').innerHTML =
      `<article><span>Sífilis congênita · ${estado.ano}</span><strong>${n1(mun.taxa_sc)}</strong><small>por 1.000 NV · ${n0(mun.casos_sc)} casos no município</small></article>` +
      `<article><span>Detecção em gestante · ${estado.ano}</span><strong>${mun.deteccao_gestante != null ? n1(mun.deteccao_gestante) : '—'}</strong><small>${mun.casos_gestante != null ? `por 1.000 NV · ${n0(mun.casos_gestante)} casos` : 'Série por STS inicia em 2015'}</small></article>` +
      `<article><span>Cobertura de ESF · dez/${estado.ano}</span><strong>${n1(mun.cobertura_esf)}%</strong><small>${n0(mun.equipes_esf)} equipes eSF · set/2026: ${n1(M.municipio.cobertura_esf_2026_09)}%</small></article>` +
      `<article><span>Correlação entre as 26 STS · ${estado.ano}</span><strong>${rho != null ? 'ρ ' + sinal(rho) : '—'}</strong><small>${esc(rotCorr)} (|ρ| ≥ 0,39 é signif.)</small></article>`;
  }

  function renderLegenda() {
    const cfg = INDICADORES[estado.indicador];
    const faixas = [];
    for (let i = 0; i <= cfg.dominio.length; i++) {
      const cor = cfg.cores[i];
      const rot = i === 0
        ? `< ${cfg.dominio[0]}`
        : i === cfg.dominio.length
          ? `≥ ${cfg.dominio[i - 1]}`
          : `${cfg.dominio[i - 1]}–${cfg.dominio[i]}`;
      faixas.push(`<span class="mapa-leg-item"><i style="background:${cor}"></i>${esc(rot)}</span>`);
    }
    $('#mapa-legenda').innerHTML =
      `<div class="mapa-leg-row"><strong>${esc(cfg.rotulo)} (${esc(cfg.unidade)}) · ${estado.ano}:</strong> ${faixas.join('')}</div>` +
      `<div class="mapa-leg-row"><strong>482 UBS (set/2026):</strong> ` +
      `<span class="mapa-leg-item"><i class="dot" style="background:${COR_MODELO.ESF}"></i>Só ESF (225)</span>` +
      `<span class="mapa-leg-item"><i class="dot" style="background:${COR_MODELO.Mista}"></i>Mista (81)</span>` +
      `<span class="mapa-leg-item"><i class="dot" style="background:${COR_MODELO.Tradicional}"></i>Tradicional (176)</span>` +
      `<span class="mapa-leg-item"><i class="line-aaubs"></i>Divisa de abrangência da UBS (AAUBS)</span>` +
      `</div>`;
  }

  function renderMapaSvg() {
    const anoStr = String(estado.ano);
    const cfg = INDICADORES[estado.indicador];

    // Se ano === 2014 e indicador só começa em 2015, avisa no banner
    const aviso2014 = $('#mapa-aviso-ano');
    if (aviso2014) {
      if (estado.ano < cfg.minAno) {
        aviso2014.hidden = false;
        aviso2014.textContent = `A série por STS de "${cfg.rotulo}" no Boletim de 2026 começa em 2015. Selecione 2015–2025 no controle de tempo ou troque para Taxa de sífilis congênita / Cobertura de ESF para ver 2014.`;
      } else {
        aviso2014.hidden = true;
      }
    }

    // 1. Camada STS
    let gSts = '';
    for (const s of M.sts) {
      const ser = s.series[anoStr] || {};
      const val = ser[estado.indicador];
      const emFoco = stsEmFoco(s);
      const isSel = estado.stsSelecionada === s.sts;
      const fill = estado.colorirAaubs ? '#f8fafb' : corIndicador(estado.indicador, val);
      const op = emFoco ? 1 : 0.25;
      const stroke = isSel ? '#10253e' : (s.zona_norte_tradicional ? '#1a3a5c' : '#5c7285');
      const sw = isSel ? 2.6 : (s.zona_norte_tradicional ? 1.35 : 0.85);
      gSts += `<path class="sts-poly${isSel ? ' selected' : ''}" data-sts="${esc(s.sts)}" d="${s._path}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width="${sw}">` +
        `<title>${esc(s.sts)} (CRS ${esc(s.crs_2026)}) · ${estado.ano}\n${esc(cfg.curto)}: ${esc(cfg.fmt(val))}\nTaxa SC: ${n1(ser.taxa_sc)}/1.000 NV (${n0(ser.casos_sc)} casos)\nDetecção gestante: ${n1(ser.deteccao_gestante)}/1.000 NV\nSC/100 gestantes: ${n1(ser.sc_por_100_gestantes)}%\nCobertura ESF: ${n1(ser.cobertura_esf)}% (${n0(ser.equipes_esf)} eSF)\nUBS (set/2026): ${s.resumo.ubs_2026} (${s.resumo.ubs_esf} ESF, ${s.resumo.ubs_mista} mistas, ${s.resumo.ubs_tradicional} trad.)</title></path>`;
    }

    // 2. Camada AAUBS (territórios de cada UBS)
    let gAaubs = '';
    if (estado.mostrarAaubs || estado.colorirAaubs || estado.stsSelecionada || estado.ubsSelecionada) {
      for (const a of M.aaubs) {
        const naStsSel = estado.stsSelecionada && a.sts === estado.stsSelecionada;
        const isUbsSel = estado.ubsSelecionada && a.cnes === estado.ubsSelecionada;
        if (!estado.mostrarAaubs && !estado.colorirAaubs && !naStsSel && !isUbsSel) continue;
        if (estado.modeloUbs !== 'todos' && a.modelo !== estado.modeloUbs && !isUbsSel) continue;
        const fill = isUbsSel
          ? '#ffcf40'
          : estado.colorirAaubs
            ? (COR_MODELO[a.modelo] || '#c3cfd9')
            : (naStsSel ? '#007e70' : 'none');
        const fillOp = isUbsSel ? 0.55 : estado.colorirAaubs ? 0.42 : (naStsSel ? 0.08 : 0);
        const stroke = isUbsSel ? '#10253e' : (naStsSel ? '#00685b' : '#355066');
        const sw = isUbsSel ? 2.2 : (naStsSel ? 0.95 : 0.45);
        const strokeOp = isUbsSel ? 1 : (naStsSel ? 0.75 : 0.42);
        gAaubs += `<path class="aaubs-poly" data-cnes="${esc(a.cnes)}" data-sts="${esc(a.sts)}" d="${a._path}" fill="${fill}" fill-opacity="${fillOp}" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${strokeOp}">` +
          `<title>Território da ${esc(a.ubs)} (CNES ${esc(a.cnes)})\nSTS: ${esc(a.sts)} · Modelo: ${esc(a.modelo)}\nÁrea de abrangência: ${a.area_km2 != null ? n2(a.area_km2) + ' km²' : '—'}</title></path>`;
      }
    }

    // 3. Re-contorno da STS selecionada por cima das AAUBS
    let gStsSelOutline = '';
    if (estado.stsSelecionada) {
      const sSel = M.sts.find(s => s.sts === estado.stsSelecionada);
      if (sSel) {
        gStsSelOutline = `<path d="${sSel._path}" fill="none" stroke="#10253e" stroke-width="2.6" pointer-events="none"/>`;
      }
    }

    // 4. Camada Pontos das 482 UBS
    let gUbs = '';
    if (estado.mostrarUbs) {
      const q = fold(estado.buscaUbs);
      const zoomFactor = Math.max(1, Math.min(3.2, W_BASE / estado.viewBox.w));
      const rBase = (estado.stsSelecionada ? 4.4 : 3.4) / Math.sqrt(zoomFactor);
      for (const u of M.ubs) {
        if (estado.modeloUbs !== 'todos' && u.modelo !== estado.modeloUbs) continue;
        if (q && !fold(u.ubs + ' ' + u.sts + ' ' + u.endereco + ' ' + u.cnes).includes(q)) continue;
        const sObj = M.stsMap.get(u.sts);
        const emFoco = (!estado.stsSelecionada || u.sts === estado.stsSelecionada) && (!sObj || stsEmFoco(sObj));
        const isSel = estado.ubsSelecionada === u.cnes;
        const cor = COR_MODELO[u.modelo] || '#536575';
        const r = isSel ? rBase * 2.1 : (u.sts === estado.stsSelecionada ? rBase * 1.35 : rBase);
        const op = isSel ? 1 : (emFoco ? 0.92 : 0.22);
        const sw = isSel ? 2.2 / Math.sqrt(zoomFactor) : 0.9 / Math.sqrt(zoomFactor);
        gUbs += `<circle class="ubs-dot${isSel ? ' selected' : ''}" data-cnes="${esc(u.cnes)}" data-sts="${esc(u.sts)}" cx="${u._px}" cy="${u._py}" r="${r.toFixed(2)}" fill="${cor}" fill-opacity="${op}" stroke="${isSel ? '#10253e' : '#ffffff'}" stroke-width="${sw.toFixed(2)}">` +
          `<title>${esc(u.ubs)} (CNES ${esc(u.cnes)})\nSTS: ${esc(u.sts)} · Modelo: ${esc(u.modelo)}\nEquipes: ${u.equipes_esf} eSF · ${u.equipes_eap} eAP · ${u.equipes_esb || 0} eSB\nEndereço: ${esc(u.endereco)}</title></circle>`;
      }
    }

    // 5. Rótulos das STS
    let gLabels = '';
    if (estado.mostrarRotulos) {
      const zoomFactor = Math.max(1, Math.min(3, W_BASE / estado.viewBox.w));
      const fs = (10.2 / Math.pow(zoomFactor, 0.45)).toFixed(1);
      for (const s of M.sts) {
        if (!stsEmFoco(s) && estado.stsSelecionada !== s.sts) continue;
        const ser = s.series[anoStr] || {};
        const val = ser[estado.indicador];
        const [cx, cy] = s._cpx;
        const curto = s.sts.replace('Santo Amaro/Cidade Ademar', 'Sto. Amaro/C. Ademar')
          .replace('Vila Maria/Vila Guilherme', 'V. Maria/V. Guilherme')
          .replace('Vila Mariana/Jabaquara', 'V. Mariana/Jabaquara')
          .replace('Vila Prudente/Sapopemba', 'V. Prudente/Sapopemba')
          .replace('Casa Verde/Cachoeirinha', 'Casa Verde/Cach.')
          .replace('Freguesia/Brasilândia', 'Freguesia/Brasil.');
        gLabels += `<g class="sts-label" pointer-events="none" transform="translate(${cx.toFixed(1)},${cy.toFixed(1)})">` +
          `<text y="-2" text-anchor="middle" style="font-size:${fs}px">${esc(curto)}</text>` +
          `<text y="${(Number(fs) + 1).toFixed(1)}" text-anchor="middle" class="sts-label-val" style="font-size:${(Number(fs) * 0.92).toFixed(1)}px">${esc(cfg.fmt(val))}</text>` +
          `</g>`;
      }
    }

    $('#mapa-camada-sts').innerHTML = gSts;
    $('#mapa-camada-aaubs').innerHTML = gAaubs;
    $('#mapa-camada-outline').innerHTML = gStsSelOutline;
    $('#mapa-camada-ubs').innerHTML = gUbs;
    $('#mapa-camada-rotulos').innerHTML = gLabels;
  }

  function miniGraficoTrajetoria(stsObj) {
    const W = 420, H = 175, L = 38, R = 14, T = 16, B = 28;
    const cfg = INDICADORES[estado.indicador];
    const anos = M.anos.filter(a => a >= cfg.minAno);
    const ptsSts = anos.map(a => ({a, v: (stsObj.series[String(a)] || {})[estado.indicador]})).filter(p => p.v != null);
    const ptsMun = anos.map(a => ({a, v: (M.municipio.series[String(a)] || {})[estado.indicador]})).filter(p => p.v != null);
    if (!ptsSts.length) return '';
    const maxV = Math.max(...ptsSts.map(p => p.v), ...ptsMun.map(p => p.v), 1) * 1.15;
    const x = a => L + (W - L - R) * (a - anos[0]) / Math.max(1, anos[anos.length - 1] - anos[0]);
    const y = v => T + (H - T - B) * (1 - v / maxV);

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="mapa-spark" role="img" aria-label="Trajetória de ${esc(stsObj.sts)} e do Município">`;
    for (let i = 0; i <= 3; i++) {
      const v = maxV * i / 3;
      svg += `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${W - R}" y2="${y(v).toFixed(1)}" stroke="#e6edf1"/>` +
        `<text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(n0(v))}</text>`;
    }
    for (const a of anos.filter(a => a % 2 === 1 || a === anos[0])) {
      svg += `<text x="${x(a).toFixed(1)}" y="${H - 6}" text-anchor="middle">${a}</text>`;
    }
    // Linha vertical do ano selecionado no slider
    if (estado.ano >= cfg.minAno) {
      svg += `<line x1="${x(estado.ano).toFixed(1)}" y1="${T}" x2="${x(estado.ano).toFixed(1)}" y2="${H - B}" stroke="#bd6024" stroke-width="1.5" stroke-dasharray="3 3"/>`;
    }
    const dMun = ptsMun.map((p, i) => `${i ? 'L' : 'M'}${x(p.a).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const dSts = ptsSts.map((p, i) => `${i ? 'L' : 'M'}${x(p.a).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const corLinha = COR_ZN[stsObj.sts] || '#007e70';
    svg += `<path d="${dMun}" fill="none" stroke="#10253e" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    svg += `<path d="${dSts}" fill="none" stroke="${corLinha}" stroke-width="2.5"/>`;
    for (const p of ptsSts) {
      svg += `<circle cx="${x(p.a).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.a === estado.ano ? 4.8 : 2.8}" fill="${p.a === estado.ano ? '#bd6024' : corLinha}" stroke="#fff" stroke-width="1.2"><title>${p.a}: ${esc(cfg.fmt(p.v))}</title></circle>`;
    }
    svg += `</svg><div class="series-notes esf-legenda" style="margin-top:4px"><span><i style="background:${corLinha}"></i>${esc(stsObj.sts)}</span><span><i class="tracejado"></i>Município</span><span><i style="background:#bd6024"></i>Ano no slider (${estado.ano})</span></div>`;
    return svg;
  }

  function renderInspetor() {
    const box = $('#mapa-inspetor');
    const anoStr = String(estado.ano);
    const cfg = INDICADORES[estado.indicador];
    const mun = M.municipio.series[anoStr] || {};

    if (!estado.stsSelecionada) {
      // Exibe ranking das 26 STS no ano selecionado
      const ord = [...M.sts]
        .filter(s => stsEmFoco(s))
        .sort((a, b) => ((b.series[anoStr] || {})[estado.indicador] ?? -1) - ((a.series[anoStr] || {})[estado.indicador] ?? -1));
      const maxVal = Math.max(...ord.map(s => (s.series[anoStr] || {})[estado.indicador] || 0), 1);

      box.innerHTML =
        `<div class="inspetor-head"><div><p class="eyebrow">VISÃO MUNICIPAL · ${estado.ano}</p><h3>Ranking das STS (${ord.length})</h3></div>` +
        `<span class="pill">${esc(cfg.curto)}</span></div>` +
        `<p class="esf-sub">Clique em uma STS no mapa ou na lista abaixo para inspecionar suas UBS, áreas de abrangência (AAUBS) e série histórica 2014–2025.</p>` +
        `<div class="mapa-ranking">${ord.map((s, idx) => {
          const v = (s.series[anoStr] || {})[estado.indicador];
          const w = v != null ? Math.max(4, Math.round((v / maxVal) * 100)) : 0;
          const corBarra = COR_ZN[s.sts] || '#007e70';
          return `<button type="button" class="mapa-rank-row" data-sts="${esc(s.sts)}">` +
            `<span class="rank-pos">${idx + 1}º</span>` +
            `<span class="rank-name">${esc(s.sts)}${s.zona_norte_tradicional ? ' <small class="tag-zn">ZN</small>' : ''}</span>` +
            `<span class="rank-bar-wrap"><span class="rank-bar" style="width:${w}%;background:${corBarra}"></span></span>` +
            `<strong class="rank-val">${esc(cfg.fmt(v))}</strong>` +
            `</button>`;
        }).join('')}</div>`;

      $$('#mapa-inspetor .mapa-rank-row').forEach(btn => {
        btn.addEventListener('click', () => selecionarSts(btn.dataset.sts, true));
      });
      return;
    }

    const s = M.stsMap.get(estado.stsSelecionada);
    const ser = s.series[anoStr] || {};
    const ubsSts = M.ubs
      .filter(u => u.sts === s.sts && (estado.modeloUbs === 'todos' || u.modelo === estado.modeloUbs))
      .sort((a, b) => a.ubs.localeCompare(b.ubs, 'pt-BR'));
    const uSel = estado.ubsSelecionada ? M.ubs.find(u => u.cnes === estado.ubsSelecionada) : null;
    const aaSel = estado.ubsSelecionada ? M.aaubs.find(a => a.cnes === estado.ubsSelecionada) : null;

    box.innerHTML =
      `<div class="inspetor-head"><div><p class="eyebrow">CRS ${esc(s.crs_2026.toUpperCase())}${s.zona_norte_tradicional ? ' · ZONA NORTE' : ''}</p><h3>${esc(s.sts)}</h3></div>` +
      `<button type="button" class="button secondary btn-sm" id="mapa-voltar-mun">← Todas as STS</button></div>` +
      `<div class="inspetor-kpis">` +
      `<div><span>Taxa SC (${estado.ano})</span><strong>${n1(ser.taxa_sc)}</strong><small>${n0(ser.casos_sc)} casos · Mun.: ${n1(mun.taxa_sc)}</small></div>` +
      `<div><span>Detecção gest. (${estado.ano})</span><strong>${n1(ser.deteccao_gestante)}</strong><small>${n0(ser.casos_gestante)} casos · Mun.: ${n1(mun.deteccao_gestante)}</small></div>` +
      `<div><span>SC / 100 gest. (${estado.ano})</span><strong>${ser.sc_por_100_gestantes != null ? n1(ser.sc_por_100_gestantes) + '%' : '—'}</strong><small>Mun.: ${mun.sc_por_100_gestantes != null ? n1(mun.sc_por_100_gestantes) + '%' : '—'}</small></div>` +
      `<div><span>Cobertura ESF (dez/${estado.ano})</span><strong>${n1(ser.cobertura_esf)}%</strong><small>${n0(ser.equipes_esf)} eSF · set/26: ${n1(s.resumo.cobertura_esf_2026_09)}%</small></div>` +
      `</div>` +
      `<div class="inspetor-chart-box"><p class="eyebrow" style="margin-bottom:4px">TRAJETÓRIA NA STS · ${esc(cfg.rotulo.toUpperCase())}</p>${miniGraficoTrajetoria(s)}</div>` +
      (uSel ? (
        `<div class="inspetor-ubs-card">` +
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><strong>${esc(uSel.ubs)}</strong><span class="${PILL_MODELO[uSel.modelo] || 'pill'}">${esc(uSel.modelo)}</span></div>` +
        `<p>CNES <strong>${esc(uSel.cnes)}</strong> · ${esc(uSel.endereco)}</p>` +
        `<p>Equipes em set/2026: <strong>${uSel.equipes_esf} eSF</strong> · <strong>${uSel.equipes_eap} eAP</strong> · <strong>${uSel.equipes_esb || 0} eSB</strong>` +
        (aaSel && aaSel.area_km2 ? ` · Território AAUBS: <strong>${n2(aaSel.area_km2)} km²</strong>` : ' · <em>Unidade inaugurada após abr/2026 (sem polígono AAUBS separado)</em>') +
        `</p></div>`
      ) : '') +
      `<div class="inspetor-ubs-head"><strong>UBS da STS (${ubsSts.length} de ${s.resumo.ubs_2026})</strong>` +
      `<small>${s.resumo.ubs_esf} só ESF · ${s.resumo.ubs_mista} mistas · ${s.resumo.ubs_tradicional} trad.</small></div>` +
      `<p class="esf-sub" style="margin-bottom:8px">Clique em uma UBS para destacar seu ponto e seu território de abrangência (AAUBS) no mapa:</p>` +
      `<div class="inspetor-ubs-lista">${ubsSts.map(u =>
        `<button type="button" class="inspetor-ubs-item${estado.ubsSelecionada === u.cnes ? ' active' : ''}" data-cnes="${esc(u.cnes)}">` +
        `<div><strong>${esc(u.ubs)}</strong><small>${esc(u.endereco)} · CNES ${esc(u.cnes)}</small></div>` +
        `<div class="inspetor-ubs-right"><span class="${PILL_MODELO[u.modelo] || 'pill'}">${esc(u.modelo)}</span><small>${u.equipes_esf} eSF / ${u.equipes_eap} eAP</small></div>` +
        `</button>`
      ).join('')}</div>`;

    $('#mapa-voltar-mun')?.addEventListener('click', () => {
      estado.stsSelecionada = null;
      estado.ubsSelecionada = null;
      $('#mapa-sel-sts').value = '';
      focarRegiaoAtual();
      atualizarTudo();
    });

    $$('#mapa-inspetor .inspetor-ubs-item').forEach(btn => {
      btn.addEventListener('click', () => selecionarUbs(btn.dataset.cnes, true));
    });
  }

  function focarRegiaoAtual() {
    if (estado.stsSelecionada) {
      const s = M.stsMap.get(estado.stsSelecionada);
      if (s) { focarBbox([s.rings]); return; }
    }
    if (estado.regiao === 'todas') {
      estado.viewBox = {x: 0, y: 0, w: W_BASE, h: H_BASE};
      aplicarViewBox();
      return;
    }
    const rings = M.sts.filter(stsEmFoco).map(s => s.rings);
    focarBbox(rings);
  }

  function selecionarSts(stsName, zoom = false) {
    estado.stsSelecionada = stsName || null;
    estado.ubsSelecionada = null;
    const sel = $('#mapa-sel-sts');
    if (sel) sel.value = stsName || '';
    if (zoom) focarRegiaoAtual();
    atualizarTudo();
  }

  function selecionarUbs(cnes, zoom = false) {
    const u = M.ubs.find(x => x.cnes === cnes);
    if (!u) return;
    estado.stsSelecionada = u.sts;
    estado.ubsSelecionada = u.cnes;
    const sel = $('#mapa-sel-sts');
    if (sel) sel.value = u.sts;
    if (zoom) {
      const aa = M.aaubs.find(a => a.cnes === cnes);
      if (aa && aa.rings.length) {
        focarBbox([aa.rings]);
      } else {
        const s = M.stsMap.get(u.sts);
        if (s) focarBbox([s.rings]);
      }
    }
    atualizarTudo();
  }

  function atualizarBotoesAno() {
    $('#mapa-ano-slider').value = String(estado.ano);
    $('#mapa-ano-label').textContent = String(estado.ano);
    $$('.mapa-ano-pill').forEach(b => {
      b.classList.toggle('active', Number(b.dataset.ano) === estado.ano);
    });
  }

  function atualizarTudo() {
    atualizarBotoesAno();
    atualizarMetricasTopo();
    renderLegenda();
    renderMapaSvg();
    renderInspetor();
  }

  function togglePlay() {
    const btn = $('#mapa-play');
    if (estado.timer) {
      clearInterval(estado.timer);
      estado.timer = null;
      btn.textContent = '▶ Animar série';
      btn.setAttribute('aria-pressed', 'false');
      return;
    }
    const minA = INDICADORES[estado.indicador].minAno;
    if (estado.ano >= 2025 || estado.ano < minA) estado.ano = minA;
    atualizarTudo();
    btn.textContent = '⏸ Pausar';
    btn.setAttribute('aria-pressed', 'true');
    estado.timer = setInterval(() => {
      if (estado.ano < 2025) {
        estado.ano++;
        atualizarTudo();
      } else {
        clearInterval(estado.timer);
        estado.timer = null;
        btn.textContent = '▶ Animar série';
        btn.setAttribute('aria-pressed', 'false');
      }
    }, 1150);
  }

  function configurarZoomPan() {
    const svg = $('#mapa-svg');
    if (!svg) return;
    let dragging = false, moved = false, startX = 0, startY = 0, startVB = null;

    svg.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      startVB = {...estado.viewBox};
    });

    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      if (!moved) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = startVB.w / rect.width;
      const scaleY = startVB.h / rect.height;
      estado.viewBox.x = Math.max(-100, Math.min(W_BASE - startVB.w + 100, startVB.x - dx * scaleX));
      estado.viewBox.y = Math.max(-100, Math.min(H_BASE - startVB.h + 100, startVB.y - dy * scaleY));
      aplicarViewBox();
    });

    window.addEventListener('pointerup', () => { dragging = false; });

    svg.addEventListener('click', e => {
      if (moved) return;
      const dot = e.target.closest('.ubs-dot');
      if (dot) {
        selecionarUbs(dot.dataset.cnes, false);
        return;
      }
      const aa = e.target.closest('.aaubs-poly');
      if (aa && (estado.mostrarAaubs || estado.colorirAaubs)) {
        selecionarUbs(aa.dataset.cnes, false);
        return;
      }
      const poly = e.target.closest('.sts-poly');
      if (poly) {
        const sts = poly.dataset.sts;
        if (estado.stsSelecionada === sts && !estado.ubsSelecionada) {
          selecionarSts(null, false);
        } else {
          selecionarSts(sts, false);
        }
      }
    });

    const zoomBy = factor => {
      const {x, y, w, h} = estado.viewBox;
      const nw = Math.max(95, Math.min(W_BASE, w * factor));
      const nh = Math.max(115, Math.min(H_BASE, h * factor));
      const cx = x + w / 2, cy = y + h / 2;
      estado.viewBox = {
        x: Math.max(0, Math.min(W_BASE - nw, cx - nw / 2)),
        y: Math.max(0, Math.min(H_BASE - nh, cy - nh / 2)),
        w: nw,
        h: nh,
      };
      aplicarViewBox();
      renderMapaSvg();
    };

    $('#mapa-zoom-in')?.addEventListener('click', () => zoomBy(0.72));
    $('#mapa-zoom-out')?.addEventListener('click', () => zoomBy(1.38));
    $('#mapa-zoom-reset')?.addEventListener('click', () => {
      estado.stsSelecionada = null;
      estado.ubsSelecionada = null;
      estado.regiao = 'todas';
      $('#mapa-regiao').value = 'todas';
      $('#mapa-sel-sts').value = '';
      estado.viewBox = {x: 0, y: 0, w: W_BASE, h: H_BASE};
      aplicarViewBox();
      atualizarTudo();
    });
    $('#mapa-zoom-zn')?.addEventListener('click', () => {
      estado.regiao = 'zn_trad';
      $('#mapa-regiao').value = 'zn_trad';
      focarRegiaoAtual();
      atualizarTudo();
    });
  }

  function popularTabelasSintese(esfData) {
    const aprof = esfData?.analise_aprofundada;
    if (!aprof) return;

    // 1. Tabela da Zona Norte (2015–2025)
    const znTbody = $('#sintese-zn-tbody');
    if (znTbody && Array.isArray(aprof.zona_norte_tabela)) {
      znTbody.innerHTML = aprof.zona_norte_tabela.map(r => {
        const isTotal = r.sts.includes('TOTAL') || r.sts === 'MUNICÍPIO';
        return `<tr${isTotal ? ' style="font-weight:650;background:#f4faf8"' : ''}>` +
          `<td>${esc(r.sts)}</td>` +
          `<td class="value">${esc(n1(r.tisc_2015_2017))}</td>` +
          `<td class="value">${esc(n1(r.tisc_2018_2020))}</td>` +
          `<td class="value">${esc(n1(r.tisc_2021_2022))}</td>` +
          `<td class="value">${esc(n1(r.tisc_2023_2025))}</td>` +
          `<td class="value">${esc(sinal(Number(r.delta_tisc_2325_vs_1517)))}</td>` +
          `<td class="value">${esc(n1(r.tdsg_2015_2017))} → ${esc(n1(r.tdsg_2023_2025))}</td>` +
          `<td class="value">${esc(n1(r.tv_2023_2025))}%</td>` +
          `<td class="value">${esc(n1(r.cobertura_esf_2015))}% → ${esc(n1(r.cobertura_esf_2025))}% (${esc(sinal(Number(r.delta_cob_2015_2025)))} pp)</td>` +
          `<td class="value">${esc(r.ubs_2026_total)} (${esc(r.ubs_2026_esf)}/${esc(r.ubs_2026_mista)}/${esc(r.ubs_2026_trad)})</td>` +
          `</tr>`;
      }).join('');
    }

    // 2. Tabela de Correlações Estratificadas e Parciais
    const corrTbody = $('#sintese-corr-tbody');
    const twfeTbody = $('#sintese-twfe-tbody');
    if (Array.isArray(aprof.analise_estratificada)) {
      const corrs = aprof.analise_estratificada.filter(r => r.bloco !== 'Painel Efeitos Fixos');
      const twfes = aprof.analise_estratificada.filter(r => r.bloco === 'Painel Efeitos Fixos');
      if (corrTbody) {
        corrTbody.innerHTML = corrs.map(r => {
          const est = Number(r.estimativa);
          const p = Number(r.p_valor);
          const sig = p < 0.05;
          return `<tr>` +
            `<td>${esc(r.bloco)}</td>` +
            `<td>${esc(r.recorte)} (${esc(r.n)} STS)</td>` +
            `<td>${esc(r.especificacao)}</td>` +
            `<td class="value"><strong>ρ = ${esc(sinal(est))}</strong></td>` +
            `<td class="value">${esc(n2(r.ic95_inf))} a ${esc(n2(r.ic95_sup))}</td>` +
            `<td class="value">${p < 0.001 ? '< 0,001' : esc( p.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3}) )}</td>` +
            `<td><span class="pill${sig ? '' : ' trad'}">${sig ? 'Significativo (5%)' : 'Não significativo'}</span></td>` +
            `</tr>`;
        }).join('');
      }
      if (twfeTbody) {
        twfeTbody.innerHTML = twfes.map(r => {
          const est = Number(r.estimativa);
          const p = Number(r.p_valor);
          const sig = p < 0.05;
          return `<tr>` +
            `<td>${esc(r.recorte)}</td>` +
            `<td>${esc(r.especificacao)}</td>` +
            `<td class="value"><strong>${esc(sinal(est))}</strong></td>` +
            `<td class="value">${esc(sinal(Number(r.ic95_inf)))} a ${esc(sinal(Number(r.ic95_sup)))}</td>` +
            `<td class="value">${p < 0.001 ? '< 0,001' : esc( p.toLocaleString('pt-BR', {minimumFractionDigits: 3, maximumFractionDigits: 3}) )}</td>` +
            `<td><span class="pill${sig ? '' : ' trad'}">${sig ? 'Associação positiva' : 'Sem efeito estatístico'}</span></td>` +
            `</tr>`;
        }).join('');
      }
    }
  }

  function iniciarMapa() {
    if (!$('#mapa-svg')) return;
    proj = criaProjecao(M.bbox);
    M.stsMap = new Map();
    for (const s of M.sts) {
      s._path = ringsToPath(s.rings);
      s._cpx = [proj.x(s.centroide[0]), proj.y(s.centroide[1])];
      M.stsMap.set(s.sts, s);
    }
    for (const a of M.aaubs) {
      a._path = ringsToPath(a.rings);
    }
    for (const u of M.ubs) {
      u._px = proj.x(u.lon).toFixed(1);
      u._py = proj.y(u.lat).toFixed(1);
    }

    // Popular seletor de STS
    const selSts = $('#mapa-sel-sts');
    if (selSts) {
      selSts.innerHTML = '<option value="">Todas as 26 STS (visão municipal)</option>' +
        [...M.sts].sort((a, b) => a.sts.localeCompare(b.sts, 'pt-BR'))
          .map(s => `<option value="${esc(s.sts)}">${esc(s.sts)} (${esc(s.crs_2026)})</option>`).join('');
      selSts.addEventListener('change', () => selecionarSts(selSts.value || null, true));
    }

    // Botões de ano rápido
    const pillsWrap = $('#mapa-anos-pills');
    if (pillsWrap) {
      pillsWrap.innerHTML = M.anos.map(a =>
        `<button type="button" class="mapa-ano-pill${a === estado.ano ? ' active' : ''}" data-ano="${a}">${a}</button>`
      ).join('');
      $$('.mapa-ano-pill').forEach(b => b.addEventListener('click', () => {
        estado.ano = Number(b.dataset.ano);
        atualizarTudo();
      }));
    }

    $('#mapa-ano-slider')?.addEventListener('input', e => {
      estado.ano = Number(e.target.value);
      atualizarTudo();
    });
    $('#mapa-play')?.addEventListener('click', togglePlay);
    $('#mapa-indicador')?.addEventListener('change', e => {
      estado.indicador = e.target.value;
      if (estado.ano < INDICADORES[estado.indicador].minAno) {
        estado.ano = INDICADORES[estado.indicador].minAno;
      }
      atualizarTudo();
    });
    $('#mapa-regiao')?.addEventListener('change', e => {
      estado.regiao = e.target.value;
      estado.stsSelecionada = null;
      estado.ubsSelecionada = null;
      if (selSts) selSts.value = '';
      focarRegiaoAtual();
      atualizarTudo();
    });
    $('#mapa-modelo-ubs')?.addEventListener('change', e => {
      estado.modeloUbs = e.target.value;
      atualizarTudo();
    });
    $('#mapa-busca-ubs')?.addEventListener('input', e => {
      estado.buscaUbs = e.target.value;
      renderMapaSvg();
    });
    $('#mapa-chk-ubs')?.addEventListener('change', e => {
      estado.mostrarUbs = e.target.checked;
      renderMapaSvg();
    });
    $('#mapa-chk-aaubs')?.addEventListener('change', e => {
      estado.mostrarAaubs = e.target.checked;
      renderMapaSvg();
    });
    $('#mapa-chk-cor-aaubs')?.addEventListener('change', e => {
      estado.colorirAaubs = e.target.checked;
      if (estado.colorirAaubs) {
        estado.mostrarAaubs = true;
        const chk = $('#mapa-chk-aaubs');
        if (chk) chk.checked = true;
      }
      renderMapaSvg();
    });
    $('#mapa-chk-rotulos')?.addEventListener('change', e => {
      estado.mostrarRotulos = e.target.checked;
      renderMapaSvg();
    });

    configurarZoomPan();
    atualizarTudo();
  }

  Promise.all([
    fetch('mapa-dados.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null),
    fetch('esf-sts.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null),
  ]).then(([mapaData, esfData]) => {
    if (esfData) popularTabelasSintese(esfData);
    if (mapaData) {
      M = mapaData;
      iniciarMapa();
    }
  }).catch(() => {});
})();
