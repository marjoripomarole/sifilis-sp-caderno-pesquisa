"""Gera dist/grande-sp.json: capital × 38 vizinhos da Grande SP × restante do estado.

Lê os CSV de `Painel municipal DATHI — triagem de municípios — 16 nov 2026/` (painel do
Ministério da Saúde, corte 30/06/2024, e cobertura de ESF pelo CNES) e o esf-sts.json do site.

Uso: python3 -I build_grandesp.py <pasta_triagem> <dist/esf-sts.json> <dist/grande-sp.json>
"""
import collections
import csv
import json
import os
import statistics as st
import sys
import unicodedata

TRIAGEM, ESF_STS, SAIDA = sys.argv[1:4]
CAPITAL = '355030'
RMSP = """Arujá;Barueri;Biritiba-Mirim;Caieiras;Cajamar;Carapicuíba;Cotia;Diadema;Embu;Embu das Artes;Embu-Guaçu;Ferraz de Vasconcelos;Francisco Morato;Franco da Rocha;Guararema;Guarulhos;Itapecerica da Serra;Itapevi;Itaquaquecetuba;Jandira;Juquitiba;Mairiporã;Mauá;Mogi das Cruzes;Osasco;Pirapora do Bom Jesus;Poá;Ribeirão Pires;Rio Grande da Serra;Salesópolis;Santa Isabel;Santana de Parnaíba;Santo André;São Bernardo do Campo;São Caetano do Sul;São Lourenço da Serra;Suzano;Taboão da Serra;Vargem Grande Paulista""".split(';')
norm = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if c.isalnum())
RM = {norm(n) for n in RMSP}
TRI = {'2015_17': (2015, 2016, 2017), '2018_20': (2018, 2019, 2020), '2021_23': (2021, 2022, 2023)}
GRUPOS = ('Capital', 'Vizinhos da Grande SP', 'Interior e litoral')


def f(v):
    try:
        return float(v)
    except ValueError:
        return 0.0


def ler(nome):
    return csv.DictReader(open(os.path.join(TRIAGEM, nome), encoding='utf-8'))


CAMPOS = ('nv', 'sg', 'sc', 'sg_tri1', 'pn_sim', 'pn_nao', 'dx_pn', 'dx_parto', 'trat_adeq', 'trat_inad', 'trat_nao', 'trat_ign')
P = collections.defaultdict(dict)   # cod -> ano -> contagens
nome = {}
for r in ler('painel_municipios_2013_2023.csv'):
    if r['uf'] == 'SP':
        P[r['cod']][int(r['ano'])] = {k: f(r[k]) for k in CAMPOS}
        nome[r['cod']] = r['municipio']

C = collections.defaultdict(dict)   # cod -> competência -> equipes e população
for r in ler('cobertura_esf_municipios_sp_2014_2026.csv'):
    C[r['cod']][r['competencia']] = {'pop': f(r['populacao']), 'esf': f(r['equipes_esf']), 'eap': f(r['equipes_eap'])}
COMPS = sorted({c for d in C.values() for c in d})

vizinhos = sorted(c for c in P if norm(nome[c]) in RM)
assert len(vizinhos) == 38, len(vizinhos)
grupo = {'Capital': [CAPITAL], 'Vizinhos da Grande SP': vizinhos,
         'Interior e litoral': [c for c in P if c != CAPITAL and c not in set(vizinhos)]}
r1 = lambda v: round(v, 1)


def soma(cods, anos):
    s = collections.Counter()
    for c in cods:
        for a in anos:
            for k, v in P[c][a].items():
                s[k] += v
            for k, v in C[c][f'{a}-12'].items():
                s[k] += v
    return s


def ind(cods, anos):
    s = soma(cods, anos)
    return dict(nv=s['nv'] / len(anos), sc=s['sc'], sg=s['sg'],
                det=1000 * s['sg'] / s['nv'], inc=1000 * s['sc'] / s['nv'],
                raz=100 * s['sc'] / s['sg'] if s['sg'] else None,
                cob=min(100, 100 * s['esf'] * 3450 / s['pop']))


# Séries dos três grupos
serie_grupos = []
for g in GRUPOS:
    for a in range(2013, 2024):
        s = collections.Counter()
        for c in grupo[g]:
            for k, v in P[c][a].items():
                s[k] += v
        pn = s['pn_sim'] + s['pn_nao']
        dx = s['dx_pn'] + s['dx_parto']
        tr = s['trat_adeq'] + s['trat_inad'] + s['trat_nao'] + s['trat_ign']
        serie_grupos.append({
            'grupo': g, 'ano': a, 'nv': round(s['nv']), 'casos_gestante': round(s['sg']), 'casos_sc': round(s['sc']),
            'deteccao': r1(1000 * s['sg'] / s['nv']), 'incidencia_sc': r1(1000 * s['sc'] / s['nv']),
            'sc_por_100_gestantes': r1(100 * s['sc'] / s['sg']),
            'pct_prenatal': r1(100 * s['pn_sim'] / pn) if pn else None,
            'pct_gestante_1o_trimestre': r1(100 * s['sg_tri1'] / s['sg']) if s['sg'] else None,
            'pct_dx_prenatal': r1(100 * s['dx_pn'] / dx) if dx else None,
            'pct_sem_tratamento': r1(100 * s['trat_nao'] / tr) if tr else None,
        })

cob_grupos = []
for g in GRUPOS:
    for comp in COMPS:
        esf = sum(C[c][comp]['esf'] for c in grupo[g])
        eap = sum(C[c][comp]['eap'] for c in grupo[g])
        pop = sum(C[c][comp]['pop'] for c in grupo[g])
        cob_grupos.append({'grupo': g, 'competencia': comp, 'equipes_esf': round(esf), 'equipes_eap': round(eap),
                           'populacao': round(pop), 'cobertura': r1(min(100, 100 * esf * 3450 / pop))})

# Municípios: Grande SP inteira e paulistas com pelo menos 1.000 nascidos vivos por ano
municipios = []
BRUTO = {}   # indicadores sem arredondar, para as correlações
for c in P:
    t = BRUTO[c] = {k: ind([c], anos) for k, anos in TRI.items()}
    na_rm = c == CAPITAL or c in set(vizinhos)
    grande = t['2021_23']['nv'] >= 1000 and t['2015_17']['nv'] >= 1000
    if not (na_rm or grande):
        continue
    z = t['2021_23']
    municipios.append({
        'cod': c, 'nome': nome[c], 'capital': c == CAPITAL, 'grande_sp': na_rm, 'mil_nv': grande,
        'nv_ano': round(z['nv']), 'equipes_esf_2023': round(C[c]['2023-12']['esf']), 'equipes_esf_2015': round(C[c]['2015-12']['esf']),
        'casos_sc_2021_23': round(z['sc']), 'sc_por_100_gestantes_2021_23': r1(z['raz']) if z['raz'] is not None else None,
        **{f'cobertura_{k}': r1(t[k]['cob']) for k in TRI},
        **{f'deteccao_{k}': r1(t[k]['det']) for k in TRI},
        **{f'incidencia_sc_{k}': r1(t[k]['inc']) for k in TRI},
    })
municipios.sort(key=lambda m: -m['incidencia_sc_2021_23'])

# Série anual de cada município da Grande SP
series = {}
for c in [CAPITAL] + vizinhos:
    series[c] = {
        'sc': [[a, r1(1000 * P[c][a]['sc'] / P[c][a]['nv']) if P[c][a]['nv'] else None, round(P[c][a]['sc'])] for a in range(2013, 2024)],
        'deteccao': [[a, r1(1000 * P[c][a]['sg'] / P[c][a]['nv']) if P[c][a]['nv'] else None] for a in range(2013, 2024)],
        'equipes': [[comp, round(C[c][comp]['esf']), round(C[c][comp]['eap']),
                     r1(min(100, 100 * C[c][comp]['esf'] * 3450 / C[c][comp]['pop']))] for comp in COMPS],
    }


# Vizinhos em que as equipes eSF caem pela metade ou mais no CNES entre dez/2016 e dez/2019
queda = [c for c in vizinhos if C[c]['2015-12']['esf'] >= 5
         and min(C[c][f'{a}-12']['esf'] for a in range(2016, 2020)) <= C[c]['2015-12']['esf'] / 2]
SUB = {'Vizinhos com queda no CNES': queda, 'Outros vizinhos': [c for c in vizinhos if c not in set(queda)]}
serie_sub, cob_sub = [], []
for g, cods in SUB.items():
    for a in range(2013, 2024):
        nv = sum(P[c][a]['nv'] for c in cods); sc = sum(P[c][a]['sc'] for c in cods); sg = sum(P[c][a]['sg'] for c in cods)
        serie_sub.append({'grupo': g, 'ano': a, 'casos_sc': round(sc), 'incidencia_sc': r1(1000 * sc / nv), 'deteccao': r1(1000 * sg / nv)})
    for comp in COMPS:
        esf = sum(C[c][comp]['esf'] for c in cods); pop = sum(C[c][comp]['pop'] for c in cods)
        cob_sub.append({'grupo': g, 'competencia': comp, 'equipes_esf': round(esf), 'cobertura': r1(min(100, 100 * esf * 3450 / pop))})

# Correlações de Spearman
def postos(x):
    o = sorted(range(len(x)), key=lambda i: x[i])
    r = [0.0] * len(x)
    i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and x[o[j + 1]] == x[o[i]]:
            j += 1
        for k in range(i, j + 1):
            r[o[k]] = (i + j) / 2
        i = j + 1
    return r


def pearson(x, y):
    mx, my = st.mean(x), st.mean(y)
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / (sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y)) ** .5


sp = lambda x, y: pearson(postos(x), postos(y))


def parcial(x, y, z):
    rxy, rxz, ryz = sp(x, y), sp(x, z), sp(y, z)
    return (rxy - rxz * ryz) / ((1 - rxz ** 2) * (1 - ryz ** 2)) ** .5


def linha(recorte, periodo, cob, inc, det, raz):
    n = len(cob)
    return {'recorte': recorte, 'periodo': periodo, 'n': n, 'critico': round(1.96 / (n - 1) ** .5, 2),
            'rho_sc': round(sp(cob, inc), 2), 'rho_deteccao': round(sp(cob, det), 2),
            'rho_sc_por_gestante': round(sp(cob, raz), 2), 'parcial_sc': round(parcial(cob, inc, det), 2)}


# STS da capital: valores da análise de 12/11/2026 (26 STS, cobertura de dez/2025 × 2023–25), feita sem arredondar.
# O esf-sts.json guarda os indicadores com uma casa, e por isso a tela "ESF por STS" mostra +0,60 na detecção.
sts = json.load(open(ESF_STS, encoding='utf-8'))['sts']
assert len(sts) == 26
correl = [{'recorte': 'STS da capital', 'periodo': '2023–25', 'n': 26, 'critico': 0.39, 'rho_sc': -0.09, 'rho_deteccao': 0.61,
           'rho_sc_por_gestante': -0.57, 'parcial_sc': -0.22, 'nota': 'Boletim de Sífilis 2026 da SMS-SP; cobertura de dezembro de 2025'}]
for rot, filtro in (('Municípios da Grande SP', lambda m: m['grande_sp'] and m['mil_nv']),
                    ('Municípios paulistas', lambda m: m['mil_nv']),
                    ('Maiores municípios paulistas', lambda m: BRUTO[m['cod']]['2021_23']['nv'] >= 3000 and BRUTO[m['cod']]['2015_17']['nv'] >= 3000)):
    X = [BRUTO[m['cod']]['2021_23'] for m in municipios if filtro(m)]
    correl.append(linha(rot, '2021–23', [z['cob'] for z in X], [z['inc'] for z in X], [z['det'] for z in X], [z['raz'] for z in X]))
correl[1]['nota'] = 'com pelo menos 1.000 nascidos vivos por ano, capital incluída'
correl[2]['nota'] = 'com pelo menos 1.000 nascidos vivos por ano'
correl[3]['nota'] = 'com pelo menos 3.000 nascidos vivos por ano'

estado = {comp: {'esf': round(sum(d[comp]['esf'] for d in C.values())), 'eap': round(sum(d[comp]['eap'] for d in C.values()))}
          for comp in COMPS}

json.dump({
    'gerado_em': '2026-11-16',
    'fontes': {
        'sifilis': 'Painel de indicadores de sífilis do Ministério da Saúde (DATHI), planilha painelSifilis.xlsx, corte de 30/06/2024',
        'equipes': 'CNES/DATASUS, arquivos EPSP de dezembro de 2014 a setembro de 2026',
        'populacao': 'IBGE, Censos 2010 e 2022 (tabela 9605)',
    },
    'grupos': serie_grupos, 'cobertura_grupos': cob_grupos, 'municipios': municipios,
    'series': series, 'correlacoes': correl, 'equipes_estado': estado,
    'queda_cnes': [{'cod': c, 'nome': nome[c]} for c in sorted(queda, key=lambda c: nome[c])], 'subgrupos': serie_sub, 'cobertura_subgrupos': cob_sub,
}, open(SAIDA, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

print('municípios:', len(municipios), '| Grande SP:', sum(m['grande_sp'] for m in municipios), '| ≥1.000 NV:', sum(m['mil_nv'] for m in municipios))
for c in correl:
    print(c)
for g in GRUPOS:
    print(g, [(x['ano'], x['incidencia_sc'], x['deteccao']) for x in serie_grupos if x['grupo'] == g and x['ano'] in (2015, 2019, 2023)],
          [(x['competencia'], x['cobertura']) for x in cob_grupos if x['grupo'] == g and x['competencia'][:4] in ('2015', '2019', '2023', '2026')])
print('estado:', estado['2019-12'], estado['2020-12'])
print(os.path.getsize(SAIDA), 'bytes')
print('queda no CNES:', [nome[c] for c in queda])
print([(x['grupo'][:6], x['competencia'], x['equipes_esf'], x['cobertura']) for x in cob_sub if x['competencia'] in ('2015-12', '2019-12', '2023-12')])
print([(x['grupo'][:6], x['ano'], x['incidencia_sc']) for x in serie_sub if x['ano'] in (2015, 2019, 2022, 2023)])
