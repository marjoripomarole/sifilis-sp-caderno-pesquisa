"""Extrai as tabelas 5 e 9 do Boletim de Sífilis 2026 (texto de pdftotext -layout) com CRS, STS e município."""
import re, sys, json, unicodedata
txt = open(sys.argv[1], encoding='utf-8').read().split('\n')
norm = lambda s: ''.join(c for c in unicodedata.normalize('NFD', s.upper()) if c.isalpha())
NOMES = [('LESTE','crs','LESTE'),('NORTE','crs','NORTE'),('OESTE','crs','OESTE'),('SUDESTE','crs','SUDESTE'),('SUL','crs','SUL'),
 ('CIDADETIRADENTES','sts','CIDADE TIRADENTES'),('ERMELINOMATARAZZO','sts','ERMELINO MATARAZZO'),('GUAIANASES','sts','GUAIANASES'),
 ('ITAIMPAULISTA','sts','ITAIM PAULISTA'),('ITAQUERA','sts','ITAQUERA'),('SAOMATEUS','sts','SÃO MATEUS'),('SAOMIGUEL','sts','SÃO MIGUEL PAULISTA'),
 ('CASAVERDE','sts','CASA VERDE/CACHOEIRINHA'),('FREGUESIA','sts','FREGUESIA DO Ó/BRASILÂNDIA'),('PERUS','sts','PERUS'),('PIRITUBA','sts','PIRITUBA'),
 ('SANTANA','sts','SANTANA/JAÇANÃ'),('SESANTA','sts','SÉ/SANTA CECÍLIA'),('VILAMARIAVILA','sts','VILA MARIA/VILA GUILHERME'),('BUTANTA','sts','BUTANTÃ'),
 ('LAPA','sts','LAPA/PINHEIROS'),('IPIRANGA','sts','IPIRANGA'),('MOOCA','sts','MOOCA/ARICANDUVA'),('PENHA','sts','PENHA'),
 ('VILAMARIANA','sts','VILA MARIANA/JABAQUARA'),('VILAPRUDENTE','sts','VILA PRUDENTE/SAPOPEMBA'),('CAMPOLIMPO','sts','CAMPO LIMPO'),
 ('CAPELA','sts','CAPELA DO SOCORRO'),('MBOI','sts','M’BOI MIRIM'),('PARELHEIROS','sts','PARELHEIROS'),('AMAROCIDADE','sts','SANTO AMARO/CIDADE ADEMAR'),
 ('CRSSTSNAO','ignorado','CRS/STS não identificada'),('TOTALGERAL','municipio','São Paulo')]
num = re.compile(r'\d+(?:\.\d{3})*(?:,\d+)?')
def tabela(pat):
    i = next(k for k, l in enumerate(txt) if pat in l)
    out = {}
    for j in range(i, i + 400):
        l = txt[j]; toks = num.findall(l)
        if len(toks) < 22: continue
        name = norm(l[:num.search(l).start()])
        if not name:
            viz = lambda k, d: next(txt[m] for m in range(k + d, k + 4 * d, d) if txt[m].strip())
            a, b = viz(j, -1), viz(j, 1)
            name = norm((a if len(num.findall(a)) < 5 else '') + (b if len(num.findall(b)) < 5 else ''))
        hit = next(((nv, rot) for k, nv, rot in NOMES if name.startswith(k) or (len(k) > 6 and k in name)), None)
        assert hit, (j, l[:60])
        out[hit] = [float(t.replace('.', '').replace(',', '.')) for t in toks[:22]]
        if hit[0] == 'municipio': return out
sc = tabela('Tabela 9 - Número de casos e taxa de incidência'); sg = tabela('Tabela 5 - Número de casos e taxa de detecção')
assert len(sc) == len(sg) == 33, (len(sc), len(sg))
for t in (sc, sg):
    for y in range(11):
        tot = t[('municipio', 'São Paulo')][2 * y]
        assert sum(v[2 * y] for (nv, _), v in t.items() if nv in ('sts', 'ignorado')) == tot
        assert sum(v[2 * y] for (nv, _), v in t.items() if nv in ('crs', 'ignorado')) == tot
json.dump({'sc': {f'{k[0]}|{k[1]}': v for k, v in sc.items()}, 'sg': {f'{k[0]}|{k[1]}': v for k, v in sg.items()}}, open(sys.argv[2], 'w'), ensure_ascii=False)
print('ok: somas de STS e de CRS batem com o total em todos os anos')
