"""Extend the Artifact Tool PPTX with native PresentationML click timing.

Only slide2.xml is extended. Shapes remain native and preserve their IDs and
absolute coordinates inside two identity-transform groups. Static phase files
are render inputs, not evidence that slideshow timing works.
"""
from pathlib import Path
from copy import deepcopy
import json
import zipfile
from lxml import etree as E

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / '.build/full-report/v18'
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
P, A = NS['p'], NS['a']


def sub(parent, local_name, **attrs):
    return E.SubElement(parent, '{' + P + '}' + local_name, {k: str(v) for k, v in attrs.items()})


def identifier(el):
    found = el.find('.//p:cNvPr', NS)
    return found if found is not None else None


def group(ident, name, children):
    g = E.Element('{' + P + '}grpSp')
    nv = sub(g, 'nvGrpSpPr')
    sub(nv, 'cNvPr', id=ident, name=name)
    sub(nv, 'cNvGrpSpPr')
    sub(nv, 'nvPr')
    props = sub(g, 'grpSpPr')
    xf = E.SubElement(props, '{' + A + '}xfrm')
    for name, attrs in [('off', {'x': '0', 'y': '0'}), ('ext', {'cx': '12192000', 'cy': '6858000'}),
                        ('chOff', {'x': '0', 'y': '0'}), ('chExt', {'cx': '12192000', 'cy': '6858000'})]:
        E.SubElement(xf, '{' + A + '}' + name, attrs)
    for child in children:
        g.append(child)
    return g


def effect(parent, *, nodeid, shapeid, entrance, start):
    par = sub(parent, 'par')
    tn = sub(par, 'cTn', id=nodeid, presetID=1, presetClass='entr' if entrance else 'exit',
             presetSubtype=0, fill='hold', grpId=0, nodeType=start)
    cond = sub(tn, 'stCondLst')
    sub(cond, 'cond', delay=0)
    children = sub(tn, 'childTnLst')
    behavior = sub(children, 'set')
    common = sub(behavior, 'cBhvr')
    sub(common, 'cTn', id=nodeid + 1, dur=1, fill='hold')
    target = sub(common, 'tgtEl')
    sub(target, 'spTgt', spid=shapeid)
    names = sub(common, 'attrNameLst')
    sub(names, 'attrName').text = 'style.visibility'
    to = sub(behavior, 'to')
    sub(to, 'strVal', val='visible' if entrance else 'hidden')


with zipfile.ZipFile(BUILD / 'authored.pptx') as archive:
    parts = {i.filename: (i, archive.read(i.filename)) for i in archive.infolist()}
slide = E.fromstring(parts['ppt/slides/slide2.xml'][1])
tree = slide.find('./p:cSld/p:spTree', NS)
topology, data, topo_names, data_names = [], [], [], []
max_id = max(int(n.get('id')) for n in slide.findall('.//p:cNvPr', NS))
for el in list(tree):
    ident = identifier(el)
    if ident is None:
        continue
    name, descr = ident.get('name', ''), ident.get('descr', '')
    position = el.find('./p:spPr/a:xfrm/a:off', NS)
    # Artifact Tool's imported images omit alt text in cNvPr. Locate the AP by
    # its verified source geometry rather than an export-dependent object ID.
    is_router = el.tag == '{' + P + '}pic' and position is not None and (int(position.get('x')), int(position.get('y'))) == (391 * 9525, 188 * 9525)
    if is_router:
        ident.set('name', 'topology-ap-image')
        name = 'topology-ap-image'
    physical = name.startswith(('physical-', 'switch-')) or name in {'ap-name', 'ap-access', 'wire-caption', 'layer-topology-caption'} or is_router
    logical = name.startswith(('tracking', 'control-', 'image-', 'state-', 'webrtc-')) or name in {'action-caption', 'layer-data-caption'}
    if physical:
        if name.startswith(('physical-wire-', 'switch-')):
            for color in el.findall('./p:spPr/a:ln/a:solidFill/a:srgbClr', NS):
                color.set('val', '1A73E8')
        elif name.startswith('physical-wifi-'):
            for color in el.findall('./p:spPr/a:ln/a:solidFill/a:srgbClr', NS):
                color.set('val', '9AA0A6')
        topology.append(el)
        topo_names.append(name or descr)
        tree.remove(el)
    elif logical:
        data.append(el)
        data_names.append(name or descr)
        tree.remove(el)
assert len(topology) >= 17, topo_names
assert len(data) >= 19, data_names
topo_id, data_id = max_id + 1, max_id + 2
topo_group = group(topo_id, 'capture-topology-layer', topology)
data_group = group(data_id, 'capture-data-layer', data)
tree.append(topo_group)
tree.append(data_group)

timing = sub(slide, 'timing')
times = sub(timing, 'tnLst')
root = sub(sub(times, 'par'), 'cTn', id=1, dur='indefinite', restart='never', nodeType='tmRoot')
children = sub(root, 'childTnLst')
sequence = sub(children, 'seq', concurrent=1, nextAc='seek')
main = sub(sequence, 'cTn', id=2, dur='indefinite', nodeType='mainSeq')
main_children = sub(main, 'childTnLst')
click = sub(sub(main_children, 'par'), 'cTn', id=3, fill='hold')
sub(sub(click, 'stCondLst'), 'cond', delay='indefinite')
click_child = sub(sub(sub(click, 'childTnLst'), 'par'), 'cTn', id=4, fill='hold')
sub(sub(click_child, 'stCondLst'), 'cond', delay=0)
paired = sub(click_child, 'childTnLst')
effect(paired, nodeid=5, shapeid=data_id, entrance=True, start='clickEffect')
effect(paired, nodeid=7, shapeid=topo_id, entrance=False, start='withEffect')
for name, event in [('prevCondLst', 'onPrev'), ('nextCondLst', 'onNext')]:
    cond = sub(sub(sequence, name), 'cond', evt=event, delay=0)
    sub(sub(cond, 'tgtEl'), 'sldTgt')
builds = sub(timing, 'bldLst')
for ident in [data_id, topo_id]:
    sub(builds, 'bldP', spid=ident, grpId=0, build='allAtOnce')


def write_deck(name, state=None):
    rendered = deepcopy(slide)
    if state is not None:
        rendered.remove(rendered.find('./p:timing', NS))
        st = rendered.find('./p:cSld/p:spTree', NS)
        for g in list(st):
            ident = identifier(g)
            if ident is not None and ident.get('name') == ('capture-data-layer' if state == 'topology' else 'capture-topology-layer'):
                st.remove(g)
    xml = E.tostring(rendered, xml_declaration=True, encoding='UTF-8', standalone=True)
    with zipfile.ZipFile(BUILD / name, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for key, (info, value) in parts.items():
            z.writestr(info, xml if key == 'ppt/slides/slide2.xml' else value)


write_deck('candidate.pptx')
write_deck('phase-topology.pptx', 'topology')
write_deck('phase-data.pptx', 'data')
(BUILD / 'layer_manifest.json').write_text(json.dumps(dict(topology=dict(group_id=topo_id, names=topo_names), data=dict(group_id=data_id, names=data_names), on_click_groups=1, slide_count=5, native_timing=True), ensure_ascii=False, indent=2) + '\n')
print(json.dumps(dict(topology_objects=len(topology), data_objects=len(data), slides=5, candidate='candidate.pptx'), ensure_ascii=False))
