"""Gera dist/mapa-dados.json e enriquece dist/esf-sts.json com coordenadas validadas das 482 UBS,
malhas oficiais da SMS-SP/CEInfo (26 STS, 5 CRS e 485 Áreas de Abrangência de UBS — AAUBS, abr/2026)
e resultados da análise aprofundada da Zona Norte e de sensibilidade/estratificação (2015–2025).
"""
import csv
import json
import math
import os
import re
import zipfile
from xml.etree import ElementTree as ET

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DIST = os.path.join(ROOT, 'Site caderno de pesquisa', 'dist')
MALHAS_DIR = os.path.join(ROOT, 'Mapeamento UBS ESF por STS — 03 nov 2026', 'fontes', 'malhas_sms_2026')
UBS_CSV = os.path.join(ROOT, 'Mapeamento UBS ESF por STS — 03 nov 2026', 'ubs_modelo_por_sts_set2026.csv')
PAINEL_CSV = os.path.join(ROOT, 'Boletim Sífilis 2026 — STS até 2025 — 12 nov 2026', 'painel_sts_2015_2025.csv')
ZN_CSV = os.path.join(ROOT, 'Boletim Sífilis 2026 — STS até 2025 — 12 nov 2026', 'zona_norte_sts_2015_2025.csv')
SENS_CSV = os.path.join(ROOT, 'Boletim Sífilis 2026 — STS até 2025 — 12 nov 2026', 'analise_estratificada_sensibilidade_2015_2025.csv')

STS_KML_MAP = {
    'Moóca/Aricanduva': 'Mooca/Aricanduva',
    'M´Boi Mirim': "M'Boi Mirim",
    'Sé / Santa Cecília': 'Sé/Santa Cecília',
}

ZN_TRAD = {
    'Santana/Jaçanã',
    'Casa Verde/Cachoeirinha',
    'Vila Maria/Vila Guilherme',
    'Freguesia/Brasilândia',
    'Pirituba',
    'Perus',
}


def rdp(pts, eps):
    """Simplificação Douglas-Peucker iterativa para um anel [lon, lat]."""
    if len(pts) <= 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j - i <= 1:
            continue
        x1, y1 = pts[i]
        x2, y2 = pts[j]
        dx, dy = x2 - x1, y2 - y1
        denom = math.hypot(dx, dy)
        max_d = -1.0
        max_k = -1
        for k in range(i + 1, j):
            px, py = pts[k]
            if denom == 0:
                d = math.hypot(px - x1, py - y1)
            else:
                d = abs(dy * px - dx * py + x2 * y1 - y2 * x1) / denom
            if d > max_d:
                max_d = d
                max_k = k
        if max_d > eps and max_k != -1:
            keep[max_k] = True
            stack.append((i, max_k))
            stack.append((max_k, j))
    out = [ [round(pts[k][0], 4), round(pts[k][1], 4)] for k in range(len(pts)) if keep[k] ]
    # Remove duplicatas consecutivas após arredondamento
    dedup = [out[0]]
    for p in out[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    if len(dedup) >= 3 and dedup[0] != dedup[-1]:
        dedup.append(dedup[0])
    return dedup if len(dedup) >= 4 else [ [round(p[0], 4), round(p[1], 4)] for p in pts ]


def parse_kml_placemarks(zip_path, eps=0.00022):
    z = zipfile.ZipFile(zip_path)
    raw = z.read('doc.kml').decode('utf-8', errors='replace')
    raw = re.sub(r'\s+xsi:schemaLocation="[^"]*"', '', raw)
    root = ET.fromstring(raw)
    items = []
    for pm in [el for el in root.iter() if el.tag.endswith('Placemark')]:
        name = next((c.text.strip() for c in pm if c.tag.endswith('name') and c.text), '')
        desc = next((c.text for c in pm if c.tag.endswith('description') and c.text), '')
        kv = {k.strip(): v.strip() for k, v in re.findall(r'<td>([^<]*)</td>\s*<td>([^<]*)</td>', desc)}
        rings = []
        pts_point = None
        for el in pm.iter():
            tag = el.tag.split('}')[-1]
            if tag == 'Point':
                c_el = next((c.text for c in el.iter() if c.tag.endswith('coordinates') and c.text), '')
                if c_el:
                    lon, lat = map(float, c_el.strip().split(',')[:2])
                    pts_point = (round(lat, 6), round(lon, 6))
            elif tag == 'Polygon':
                # Extrai apenas outerBoundaryIs para manter o JSON enxuto e fiel
                outer = next((c for c in el if c.tag.endswith('outerBoundaryIs')), el)
                for c_el in [c.text for c in outer.iter() if c.tag.endswith('coordinates') and c.text]:
                    pts = []
                    for tok in c_el.strip().split():
                        parts = tok.split(',')
                        if len(parts) >= 2:
                            pts.append((float(parts[0]), float(parts[1])))
                    if len(pts) >= 3:
                        rings.append(rdp(pts, eps))
        items.append({'name': name, 'kv': kv, 'rings': rings, 'point': pts_point})
    return items


def ring_area_centroid(ring):
    """Retorna (área absoluta, cx, cy) de um anel [lon, lat]."""
    n = len(ring)
    if n < 3:
        return 0.0, ring[0][0], ring[0][1]
    a = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n - 1):
        x0, y0 = ring[i]
        x1, y1 = ring[i + 1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a *= 0.5
    if abs(a) < 1e-12:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    cx /= (6.0 * a)
    cy /= (6.0 * a)
    return abs(a), round(cx, 4), round(cy, 4)


def multi_centroid(rings):
    best_a = -1.0
    best_c = [0.0, 0.0]
    for r in rings:
        a, cx, cy = ring_area_centroid(r)
        if a > best_a:
            best_a = a
            best_c = [cx, cy]
    return best_c


def main():
    esf_path = os.path.join(DIST, 'esf-sts.json')
    E = json.load(open(esf_path, encoding='utf-8'))

    # 1. Coordenadas oficiais das UBS (CEInfo abr/2026 + fallback CNES set/2026)
    pts_kml = parse_kml_placemarks(os.path.join(MALHAS_DIR, 'estabelecimentos_de_saude_referencia_das_aaubs2026.zip'))
    kml_coords = {}
    for it in pts_kml:
        cnes = it['kv'].get('CNES', '').zfill(7)
        if cnes and it['point']:
            kml_coords[cnes] = (it['point'][0], it['point'][1])

    csv_coords = {}
    for r in csv.DictReader(open(UBS_CSV, encoding='utf-8-sig')):
        cnes = r['cnes'].strip().zfill(7)
        lat = float(r['lat']) if r.get('lat') else None
        lon = float(r['lon']) if r.get('lon') else None
        csv_coords[cnes] = (lat, lon, r.get('eSB', '0'), r.get('cep', ''))

    # Carrega AAUBS para verificar quais UBS têm polígono de abrangência
    aaubs_raw = parse_kml_placemarks(os.path.join(MALHAS_DIR, 'areas_de_abrangencia_de_ubs_no_msp_2026.zip'), eps=0.00022)
    aaubs_by_cnes = {}
    for it in aaubs_raw:
        cnes = it['kv'].get('CNES_UBS', '').zfill(7)
        if cnes:
            aaubs_by_cnes[cnes] = it

    sts_crs_map = {s['sts']: ('Norte' if s['sts'] == 'Sé/Santa Cecília' else s['crs']) for s in E['sts']}
    ubs_by_cnes = {}
    for u in E['ubs']:
        cnes = str(u['cnes']).zfill(7)
        u['cnes'] = cnes
        u['crs'] = sts_crs_map.get(u['sts'], '')
        lat_csv, lon_csv, esb, cep = csv_coords.get(cnes, (None, None, '0', ''))
        nota_coord = None
        if cnes in kml_coords:
            lat, lon = kml_coords[cnes]
        elif cnes == '8538719':
            # Erro de digitação de 1 dígito na latitude do CNES (-24.435377 -> -23.435377, Jardim Rosinha / Perus)
            lat, lon = -23.435377, round(lon_csv, 6)
            nota_coord = 'Latitude corrigida de -24,4354 para -23,4354 (erro de 1 dígito no CNES; Jardim Rosinha, Perus)'
        else:
            lat, lon = round(lat_csv, 6), round(lon_csv, 6)
        u['lat'] = lat
        u['lon'] = lon
        u['equipes_esb'] = int(float(esb or 0))
        u['cep'] = cep
        u['tem_aaubs'] = cnes in aaubs_by_cnes
        if nota_coord:
            u['nota_coord'] = nota_coord
        ubs_by_cnes[cnes] = u

    # 2. Malha das 26 STS e séries históricas 2014–2025
    sts_kml = parse_kml_placemarks(os.path.join(MALHAS_DIR, 'supervisoes_tecnicas_de_saude_abr2026.zip'), eps=0.00020)
    sts_rings_map = {}
    for it in sts_kml:
        nm = STS_KML_MAP.get(it['name'], it['name'])
        sts_rings_map[nm] = it['rings']

    # Séries anuais por STS (sc_ano + cobertura_ano)
    sc_idx = {}
    for r in E['sc_ano']:
        sc_idx[(r['sts'], int(r['ano']))] = r
    cob_idx = {}
    for r in E['cobertura_ano']:
        cob_idx[(r['sts'], r['competencia'])] = r

    # Também lê painel_sts_2015_2025.csv para natalidade e eAP
    import unicodedata
    def norm(s):
        return ''.join(c for c in unicodedata.normalize('NFD', str(s)) if unicodedata.category(c) != 'Mn').upper().replace(' ', '').replace("'", '').replace('´', '')
    sts_norm_map = {norm(s['sts']): s['sts'] for s in E['sts']}
    sts_norm_map[norm('Município')] = 'Município'
    painel_idx = {}
    for r in csv.DictReader(open(PAINEL_CSV, encoding='utf-8-sig')):
        nm = sts_norm_map.get(norm(r['sts']), r['sts'])
        painel_idx[(nm, int(r['ano']))] = r

    def build_series_for(sts_name):
        ser = {}
        for ano in range(2014, 2026):
            sc = sc_idx.get((sts_name, ano), {})
            cob = cob_idx.get((sts_name, f'{ano}-12'), {})
            p = painel_idx.get((sts_name, ano), {})
            nv = sc.get('nascidos_vivos')
            pop = cob.get('populacao')
            nat = round(nv / pop * 1000.0, 2) if (nv and pop) else None
            ser[str(ano)] = {
                'taxa_sc': sc.get('taxa_sc'),
                'casos_sc': sc.get('casos'),
                'deteccao_gestante': sc.get('deteccao_gestante'),
                'casos_gestante': sc.get('casos_gestante'),
                'sc_por_100_gestantes': sc.get('sc_por_100_gestantes'),
                'nascidos_vivos': nv,
                'cobertura_esf': cob.get('cobertura_esf_pct'),
                'equipes_esf': cob.get('equipes_esf'),
                'populacao': pop,
                'natalidade_1000hab': nat,
            }
        return ser

    sts_out = []
    all_lons = []
    all_lats = []
    for s in E['sts']:
        nm = s['sts']
        rings = sts_rings_map.get(nm, [])
        for r in rings:
            for lon, lat in r:
                all_lons.append(lon)
                all_lats.append(lat)
        cob26 = cob_idx.get((nm, '2026-09'), {})
        crs_2026 = 'Norte' if nm == 'Sé/Santa Cecília' else s['crs']
        sts_out.append({
            'sts': nm,
            'crs': s['crs'],
            'crs_2026': crs_2026,
            'zona_norte_tradicional': nm in ZN_TRAD,
            'crs_norte_2026': crs_2026 == 'Norte',
            'centroide': multi_centroid(rings),
            'resumo': {
                **s,
                'cobertura_esf_2026_09': cob26.get('cobertura_esf_pct'),
                'equipes_esf_2026_09': cob26.get('equipes_esf'),
            },
            'series': build_series_for(nm),
            'rings': rings,
        })

    # 3. Malha das 5 CRS (abr/2026)
    crs_kml = parse_kml_placemarks(os.path.join(MALHAS_DIR, 'coordenadorias_regionais_de_saude_abr2026.zip'), eps=0.00028)
    crs_out = [{
        'crs': it['name'],
        'centroide': multi_centroid(it['rings']),
        'rings': it['rings'],
    } for it in crs_kml]

    # 4. Malha das 485 AAUBS (abr/2026)
    aaubs_sts_fallback = {
        'FREGUESIA / BRASILANDIA': 'Freguesia/Brasilândia',
        'BUTANTA': 'Butantã',
        'SE / SANTA CECILIA': 'Sé/Santa Cecília',
        'LAPA / PINHEIROS': 'Lapa/Pinheiros',
        'PIRITUBA': 'Pirituba',
        'PARELHEIROS': 'Parelheiros',
    }
    aaubs_out = []
    for it in aaubs_raw:
        cnes = it['kv'].get('CNES_UBS', '').zfill(7)
        u_match = ubs_by_cnes.get(cnes)
        area_str = it['kv'].get('AREAKM2', '0').replace(',', '.')
        try:
            area_km2 = round(float(area_str), 2)
        except ValueError:
            area_km2 = None
        sts_std = u_match['sts'] if u_match else aaubs_sts_fallback.get(it['kv'].get('STS_UBS', ''), it['kv'].get('STS_UBS', ''))
        aaubs_out.append({
            'cnes': cnes,
            'ubs': u_match['ubs'] if u_match else it['kv'].get('NOME_UBS', it['name']),
            'sts': sts_std,
            'crs': u_match['crs'] if u_match else sts_crs_map.get(sts_std, it['kv'].get('CRS_UBS', '')),
            'modelo': u_match['modelo'] if u_match else 'Especial/Indígena',
            'area_km2': area_km2,
            'rings': it['rings'],
        })

    # 5. Dados da Síntese Executiva e Análise Aprofundada (Zona Norte + Sensibilidade + SINAN)
    zn_rows = list(csv.DictReader(open(ZN_CSV, encoding='utf-8-sig')))
    sens_rows = list(csv.DictReader(open(SENS_CSV, encoding='utf-8-sig')))

    sintese_executiva = {
        'atualizado_em': '2026-11-12',
        'zona_norte_tabela': zn_rows,
        'analise_estratificada': sens_rows,
        'sinan_resumo': {
            'periodo_completo': '2015–2024',
            'gestantes_2015_2024': 56192,
            'congenita_2015_2024': 10311,
            'adquirida_2015_2024': 161257,
            'total_historica_estado': 761664,
            'total_historica_capital': 325547,
            'cascata_sc': {
                'fez_prenatal_pct': 83.2,
                'sem_prenatal_pct': 13.7,
                'diag_materno_prenatal_pct': 58.6,
                'diag_parto_curetagem_pct': 31.1,
                'diag_pos_parto_pct': 6.0,
                'trat_materno_adequado_pct': 9.8,
                'trat_materno_inadequado_pct': 55.6,
                'trat_materno_nao_realizado_pct': 23.0,
                'parceiro_tratado_pct': 19.3,
                'parceiro_nao_tratado_pct': 56.0,
                'parceiro_ignorado_pct': 24.7,
            },
            'desfechos_sc_2015_2024': {
                'vivos_pct': 80.5,
                'vivos_n': 8299,
                'abortos_pct': 9.7,
                'abortos_n': 998,
                'natimortos_pct': 5.3,
                'natimortos_n': 549,
                'obitos_sc_pct': 2.1,
                'obitos_sc_n': 221,
                'desfechos_graves_total_pct': 17.1,
                'desfechos_graves_2015_pct': 15.8,
                'desfechos_graves_2024_pct': 18.2,
            },
            'raca_cor_2024': {
                'gestante_pretas_pardas_pct': 62.5,
                'sc_pretas_pardas_pct': 63.4,
            },
        },
    }

    # Salva esf-sts.json enriquecido
    E['analise_aprofundada'] = sintese_executiva
    with open(esf_path, 'w', encoding='utf-8') as f:
        json.dump(E, f, ensure_ascii=False, separators=(',', ':'))

    # Salva mapa-dados.json
    mapa_payload = {
        'gerado_em': '2026-11-12',
        'fonte_malhas': 'SMS-SP / CEInfo — Geoprocessamento e Informações Socioambientais (abril de 2026, Decreto 64.999/2026, SIRGAS 2000)',
        'bbox': [round(min(all_lons), 4), round(min(all_lats), 4), round(max(all_lons), 4), round(max(all_lats), 4)],
        'anos': list(range(2014, 2026)),
        'municipio': {
            'cobertura_esf_2026_09': cob_idx.get(('Município', '2026-09'), {}).get('cobertura_esf_pct'),
            'equipes_esf_2026_09': cob_idx.get(('Município', '2026-09'), {}).get('equipes_esf'),
            'series': build_series_for('Município'),
        },
        'crs': crs_out,
        'sts': sts_out,
        'ubs': E['ubs'],
        'aaubs': aaubs_out,
    }
    mapa_path = os.path.join(DIST, 'mapa-dados.json')
    with open(mapa_path, 'w', encoding='utf-8') as f:
        json.dump(mapa_payload, f, ensure_ascii=False, separators=(',', ':'))

    print(f"esf-sts.json atualizado: {os.path.getsize(esf_path)/1024:.1f} KB")
    print(f"mapa-dados.json gerado: {os.path.getsize(mapa_path)/1024:.1f} KB")
    print(f"STS: {len(sts_out)}, CRS: {len(crs_out)}, UBS: {len(E['ubs'])} (com AAUBS: {sum(1 for u in E['ubs'] if u['tem_aaubs'])}), Polígonos AAUBS: {len(aaubs_out)}")


if __name__ == '__main__':
    main()
