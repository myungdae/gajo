"""Read the original EXKO RDF/XML and emit bounded, read-only adapter artifacts."""
from __future__ import annotations
import hashlib,json,xml.etree.ElementTree as ET
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]; SOURCE=ROOT/'semantic/exko/sight-copy.rdf'; OUT=ROOT/'src/exko-semantic/generated'; RDF='{http://www.w3.org/1999/02/22-rdf-syntax-ns#}'; OWL='{http://www.w3.org/2002/07/owl#}'; RDFS='{http://www.w3.org/2000/01/rdf-schema#}'; FACET='{http://topbraid.org/facet#}'
uri=lambda e:e.attrib.get(RDF+'about') or e.attrib.get(RDF+'resource')
local=lambda tag:tag.rsplit('}',1)[-1]
namespaces={};
for _,pair in ET.iterparse(SOURCE,events=('start-ns',)): namespaces[pair[0] or 'base']=pair[1]
tree=ET.parse(SOURCE);root=tree.getroot();labels={};types=defaultdict(set);edges=[];literals=[]
schema_tags={OWL+'Class',OWL+'ObjectProperty',OWL+'DatatypeProperty',OWL+'Ontology'}
def visit_subject(e):
    subject=uri(e)
    if subject and e.tag not in schema_tags: types[subject].add(e.tag[1:].split('}')[0] if e.tag.startswith('{') else e.tag);types[subject].add(local(e.tag))
    if subject:
        for child in e:
            predicate=child.tag[1:].replace('}', '') if child.tag.startswith('{') else child.tag
            target=child.attrib.get(RDF+'resource')
            if not target:
                for descendant in child.iter():
                    if descendant is not child and descendant.attrib.get(RDF+'about'):
                        target=descendant.attrib[RDF+'about'];break
            if target: edges.append({'subject':subject,'predicate':predicate,'object':target})
            elif (child.text or '').strip(): literals.append({'subject':subject,'predicate':predicate,'value':(child.text or '').strip()})
    for child in e:
        if child.attrib.get(RDF+'about'): visit_subject(child)
        else:
            for nested in child:
                if nested.attrib.get(RDF+'about'): visit_subject(nested)
visit_subject(root)
for row in literals:
    if row['predicate']==namespaces.get('rdfs','')+'label': labels[row['subject']]=row['value']
classes=[]
for e in root.iter(OWL+'Class'):
    if not uri(e):continue
    classes.append({'uri':uri(e),'label':next(((x.text or '').strip() for x in e.findall(RDFS+'label') if (x.text or '').strip()),None),'subClassOf':[x.attrib.get(RDF+'resource') for x in e.findall(RDFS+'subClassOf') if x.attrib.get(RDF+'resource')],'defaultFacets':[uri(x) for f in e.findall(FACET+'defaultFacets') for x in f.iter() if uri(x)]})
def properties(tag):
    rows=[]
    for e in root.iter(tag):
        if not uri(e):continue
        rows.append({'uri':uri(e),'label':next(((x.text or '').strip() for x in e.findall(RDFS+'label') if (x.text or '').strip()),None),'domain':[x.attrib.get(RDF+'resource') for x in e.findall(RDFS+'domain') if x.attrib.get(RDF+'resource')],'range':[x.attrib.get(RDF+'resource') for x in e.findall(RDFS+'range') if x.attrib.get(RDF+'resource')],'inverseOf':[x.attrib.get(RDF+'resource') for x in e.findall(OWL+'inverseOf') if x.attrib.get(RDF+'resource')]})
    return rows
objects=properties(OWL+'ObjectProperty');datatypes=properties(OWL+'DatatypeProperty')
seeds=['합천군','합천호','합천호_스마일펜션','카페_로우풀','해인사','팔만대장경','황매산','합천_영상테마파크','합천_가야산_소리길','합천댐'];seed_uris={namespaces['base']+x for x in seeds};adj=defaultdict(set)
for edge in edges:adj[edge['subject']].add(edge['object']);adj[edge['object']].add(edge['subject'])
selected=set(seed_uris)&set(types)
for seed in list(selected):selected.update(adj[seed])
subedges=[e for e in edges if e['subject'] in selected and e['object'] in selected]
entities=[{'uri':u,'label':labels.get(u,u.rsplit('/',1)[-1]),'types':sorted(types[u])} for u in sorted(selected)]
inventory={'source':{'filename':SOURCE.name,'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest().upper(),'bytes':SOURCE.stat().st_size,'encoding':'UTF-8 (XML default)'},'namespaces':namespaces,'counts':{'classes':len({x['uri'] for x in classes}),'objectProperties':len({x['uri'] for x in objects}),'datatypeProperties':len({x['uri'] for x in datatypes}),'classDeclarations':len(classes),'objectPropertyDeclarations':len(objects),'datatypePropertyDeclarations':len(datatypes),'entities':len(types),'edges':len(edges),'literals':len(literals)},'classes':classes,'objectProperties':objects,'datatypeProperties':datatypes,'majorTaxonomies':{term:sorted({c['uri'] for c in classes if term in ((c['label'] or '')+c['uri'])}) for term in ['관광명소','지역','숙박','맛집','카페','글램핑','캠핑','자연물','문화유산','역사적인물','역사적사건','테마여행','여행최적기','여행인프라']}}
OUT.mkdir(parents=True,exist_ok=True);(OUT/'inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8');(OUT/'hapcheon-subgraph.json').write_text(json.dumps({'seedUris':sorted(seed_uris),'entities':entities,'edges':subedges,'size':{'entities':len(entities),'edges':len(subedges)}},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'inventory':inventory['counts'],'hapcheon':{'entities':len(entities),'edges':len(subedges)},'checksum':inventory['source']['sha256']},ensure_ascii=False))
