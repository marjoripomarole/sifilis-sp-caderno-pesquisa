"""Atualiza data.json e esf-sts.json do site com o Boletim de Sífilis 2026 e a planilha aberta da COVISA.
Uso: build_site.py <dist> <b26_full.json> <painel-dados> <painel_sts_2015_2025.csv> <boletim.pdf> <ist.xlsx> <sts_cobertura_esf_por_ano.csv>
"""
import sys, json, csv, hashlib, math, zipfile, re, os
from xml.etree import ElementTree as ET
dist, f_tab, d_painel, f_painel, f_pdf, f_xlsx, f_cob = sys.argv[1:8]
AGORA = '2026-11-12T15:30:00+00:00'
URL_B26 = 'https://prefeitura.sp.gov.br/documents/d/saude/boletim-sifilis_outubro2026-pdf'
URL_XLSX = 'https://prefeitura.sp.gov.br/documents/d/saude/infeccoes-sexualmente-transmissiveis-xlsx-15'
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()

# ---------- data.json ----------
D = json.load(open(f'{dist}/data.json', encoding='utf-8'))
D['series'] = [r for r in D['series'] if not r['fonte_id'].startswith('SP04B26') and not (r['fonte_id'] in ('SP05', 'SP06') and r['data_corte'] == '01/10/2026')]
D['sources'] = [s for s in D['sources'] if not str(s['fonte_id']).startswith('SP04B26') and not (s['fonte_id'] in ('SP05_COVISA_XLSX', 'SP06_COVISA_XLSX'))]
D['catalog'] = [c for c in D['catalog'] if c['id'] != 'SP04B26']
T = json.load(open(f_tab, encoding='utf-8'))
nota9 = 'Boletim municipal 2026, tabela 9; valores publicados, não recalculados. Notificações até 30/06/2026, dados preliminares até 03/07/2026. Já na divisão do Decreto 64.999/2026: a antiga CRS Centro virou a STS Sé/Santa Cecília, dentro da CRS Norte. A taxa municipal de 2020 saiu como 0,0 na tabela (erro de digitação); o boletim de 2025 trazia 7,2.'
nota5 = 'Boletim municipal 2026, tabela 5; valores publicados, não recalculados. Notificações até 30/06/2026, dados preliminares até 03/07/2026. Já na divisão do Decreto 64.999/2026.'
novas = 0
for chave, agravo, fid, ind, unid, nota in (('sc', 'congenita', 'SP04B26_T9', 'incidencia', 'por 1.000 nascidos vivos', nota9),
                                           ('sg', 'gestante', 'SP04B26_T5', 'taxa_deteccao', 'por 1.000 nascidos vivos', nota5)):
    for k, v in T[chave].items():
        nivel, nome = k.split('|')
        for i, ano in enumerate(range(2015, 2026)):
            for indicador, valor, u in (('casos', int(v[2 * i]), 'casos'), (ind, v[2 * i + 1], unid)):
                if nivel == 'municipio' and indicador == ind and ano == 2020 and valor == 0:
                    valor = None
                D['series'].append(dict(territorio=nome, territorio_codigo='3550308' if nivel == 'municipio' else '', nivel=nivel if nivel != 'ignorado' else 'sts',
                    agravo=agravo, indicador=indicador, ano=ano, valor=valor, unidade=u, fonte_id=fid, fonte_url=URL_B26, data_extracao=AGORA,
                    data_corte='03/07/2026', status='provisorio', criterio_residencia='Território de residência conforme descrição do boletim', nota=nota))
                novas += 1
for fid, tab in (('SP04B26_T9', 'tabela 9 · sífilis congênita'), ('SP04B26_T5', 'tabela 5 · sífilis em gestante')):
    D['sources'].append(dict(fonte_id=fid, nome_curto=f'SMS-SP · Boletim 2026 · {tab.split(" · ")[0]}', url=URL_B26, data_extracao=AGORA, corte='03/07/2026',
        granularidade='CRS/STS/município × ano de diagnóstico, 2015–2025', unidade='casos e por 1.000 nascidos vivos', registros=33 * 11 * 2,
        sha256=sha(f_pdf), status='extraido validado', limitacoes='2025 preliminar. Nova divisão territorial de 2026 (26 STS; Sé/Santa Cecília na CRS Norte). Taxa municipal de 2020 em branco na tabela 9 (publicada como 0,0).',
        url_final=URL_B26, bytes=os.path.getsize(f_pdf), verificacao='Em todos os anos, a soma das STS mais "não identificada" e a soma das CRS mais "não identificada" batem com o total geral.', catalogo_id='SP04B26'))
cat04 = next(c for c in D['catalog'] if c['id'] == 'SP04')
D['catalog'].insert(D['catalog'].index(cat04) + 1, {**cat04, 'id': 'SP04B26', 'fonte': 'SMS-SP — Boletim Epidemiológico Sífilis 2026',
    'geografia': 'São Paulo capital; 5 CRS e 26 STS da divisão de 2026', 'periodo': 'Edição de outubro de 2026; séries de 2015 a 2025, com 2025 preliminar',
    'urls': [URL_B26], 'verificacao': 'Em 12/11/2026, tabelas 5 e 9 extraídas integralmente do PDF oficial e conferidas pelas somas.',
    'utilidade': 'Série por STS até 2025 para o cruzamento com a ESF; detecção em gestante e sífilis congênita na mesma divisão territorial.'})

# planilha aberta da COVISA: série municipal até 2026 (corte 01/10/2026)
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z = zipfile.ZipFile(f_xlsx)
ss = [''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', ns)]
nomes = [s.get('name') for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', ns)]
def aba(n):
    f = f'xl/worksheets/sheet{nomes.index(n) + 1}.xml'
    for r in ET.fromstring(z.read(f)).find('m:sheetData', ns).findall('m:row', ns):
        yield [ss[int(c.find('m:v', ns).text)] if c.get('t') == 's' else c.find('m:v', ns).text for c in r.findall('m:c', ns) if c.find('m:v', ns) is not None]
for aba_n, fid_old, agravo, ind, url_pag in (('Sífilis congênita', 'SP05', 'congenita', 'incidencia', 'sifilis_congenita'), ('Sífilis gestante', 'SP06', 'gestante', 'taxa_deteccao', 'sifilis_em_gestante')):
    n = 0
    for r in aba(aba_n):
        if len(r) >= 3 and re.fullmatch(r'20\d\d', r[0]):
            ano = int(r[0])
            for indicador, valor, u in (('casos', int(r[1]), 'casos'), (ind, round(float(r[2]), 1), 'por 1.000 nascidos vivos')):
                D['series'].append(dict(territorio='São Paulo', territorio_codigo='3550308', nivel='municipio', agravo=agravo, indicador=indicador, ano=ano, valor=valor,
                    unidade=u, fonte_id=fid_old, fonte_url=URL_XLSX, data_extracao=AGORA, data_corte='01/10/2026', status='parcial' if ano == 2026 else 'provisorio',
                    criterio_residencia='Não explicitado na planilha; confirmar com NVIST antes de comparações de residência',
                    nota='Planilha de dados abertos da COVISA (aba "%s"), dados provisórios até 01/10/2026. Taxa arredondada a uma casa a partir do valor da planilha. Ano 2026 parcial.' % aba_n))
                n += 1; novas += 1
    D['sources'].append(dict(fonte_id=f'{fid_old}_COVISA_XLSX', url=URL_XLSX, data_extracao=AGORA, corte='01/10/2026', granularidade='município × ano de diagnóstico',
        unidade='casos e por 1.000 nascidos vivos', registros=n, sha256=sha(f_xlsx), status='extraido validado', limitacoes='Dados provisórios; 2026 parcial. Mesma série das páginas HTML da SMS, em outro corte.',
        url_final=URL_XLSX, bytes=os.path.getsize(f_xlsx), verificacao='Valores lidos diretamente das células da planilha oficial.', catalogo_id=fid_old))
D['updatedAt'] = AGORA
nota_nova = 'Boletim municipal de sífilis 2026 (out/2026): séries por CRS e STS de 2015 a 2025 já na divisão de 2026, com Sé/Santa Cecília dentro da CRS Norte. Não somar com as tabelas do boletim de 2025, que usam a divisão antiga.'
D['notes'] = [x for x in D['notes'] if not x.startswith('Boletim municipal de sífilis 2026')] + [nota_nova]
json.dump(D, open(f'{dist}/data.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('data.json: +', novas, 'linhas; total', len(D['series']))

# ---------- esf-sts.json ----------
E = json.load(open(f'{dist}/esf-sts.json', encoding='utf-8'))
def num(v):
    if v == '' or v is None: return None
    f = float(v); return int(f) if f.is_integer() and '.' not in str(v) else f
ler = lambda p: [{k: (num(v) if k not in ('sts', 'crs', 'competencia', 'cnes', 'ubs', 'modelo', 'endereco') else v) for k, v in r.items()} for r in csv.DictReader(open(p, encoding='utf-8-sig'))]
E['sts'] = ler(f'{d_painel}/sts.csv'); E['sc_ano'] = ler(f'{d_painel}/sc_ano.csv')
E['cobertura_ano'] = ler(f'{d_painel}/cobertura_ano.csv'); E['ubs'] = ler(f'{d_painel}/ubs.csv')
E['gerado_em'] = '2026-11-12'
E['fontes'] = [f for f in E['fontes'] if 'Boletim' not in (f if isinstance(f, str) else json.dumps(f, ensure_ascii=False))]
E['fontes'].append('Boletim Epidemiológico de Sífilis 2026 da SMS-SP, tabelas 5 e 9 (2015–2025, divisão de 2026)')
E['fontes'].append('Boletim Epidemiológico de Sífilis 2025 da SMS-SP, tabela 9 (só 2014 e a taxa de 2014–16)')
# painel com efeitos fixos de STS e ano (26 STS × 2015–2025)
P = [r for r in csv.DictReader(open(f_painel, encoding='utf-8-sig')) if r['sts'] != 'MUNICÍPIO']
for r in P:
    for k in ('tisc_por_1000nv', 'tdsg_por_1000nv', 'transmissao_vertical_pct', 'cobertura_esf_pct'): r[k] = float(r[k])
def twfe(v):
    Ss = sorted({r['sts'] for r in P}); Ys = sorted({r['ano'] for r in P})
    def dm(k):
        g = sum(r[k] for r in P) / len(P)
        ms = {s: sum(r[k] for r in P if r['sts'] == s) / len(Ys) for s in Ss}; my = {y: sum(r[k] for r in P if r['ano'] == y) / len(Ss) for y in Ys}
        return [r[k] - ms[r['sts']] - my[r['ano']] + g for r in P]
    x, y = dm('cobertura_esf_pct'), dm(v)
    sxx = sum(a * a for a in x); b = sum(a * c for a, c in zip(x, y)) / sxx
    res = [c - b * a for a, c in zip(x, y)]
    nume = sum(sum(x[i] * res[i] for i in range(len(P)) if P[i]['sts'] == s) ** 2 for s in Ss)
    se = math.sqrt(nume) / sxx * math.sqrt(len(Ss) / (len(Ss) - 1))
    return dict(efeito_10pp=round(10 * b, 2), ic95_inf=round(10 * (b - 2.06 * se), 2), ic95_sup=round(10 * (b + 2.06 * se), 2))
E['painel_efeitos_fixos'] = [dict(indicador='taxa_sc', rotulo='Taxa de sífilis congênita', unidade='por 1.000 NV', **twfe('tisc_por_1000nv')),
                             dict(indicador='deteccao_gestante', rotulo='Detecção de sífilis em gestante', unidade='por 1.000 NV', **twfe('tdsg_por_1000nv')),
                             dict(indicador='sc_por_100_gestantes', rotulo='Casos congênitos por 100 gestantes', unidade='pontos', **twfe('transmissao_vertical_pct'))]
json.dump(E, open(f'{dist}/esf-sts.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('esf-sts.json:', {k: len(v) for k, v in E.items() if isinstance(v, list)}); print(E['painel_efeitos_fixos']); print(E['sts'][0])
