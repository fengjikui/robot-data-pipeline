import json, pathlib, urllib.request, datetime
root=pathlib.Path(__file__).resolve().parents[1]
ids=['unitreerobotics/G1_Dex3_ToastedBread_Dataset','unitreerobotics/G1_WBT_Brainco_Plastic_Box_Parts','unitreerobotics/G1_WBT_Inspire_Pick_Up_Multiple_Cushions']
for rid in ids:
    dest=root/'evidence'/'datasets'/rid.split('/')[-1]; dest.mkdir(parents=True,exist_ok=True)
    try:
        meta=json.load(urllib.request.urlopen('https://huggingface.co/api/datasets/'+rid,timeout=25))
        (dest/'hub_metadata.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False))
        rev=meta['sha']
        for path in ['README.md','meta/info.json']:
            data=urllib.request.urlopen(f'https://huggingface.co/datasets/{rid}/resolve/{rev}/{path}',timeout=25).read()
            (dest/path.replace('/','__')).write_bytes(data)
        info=json.loads((dest/'meta__info.json').read_text())
        print(json.dumps({'id':rid,'sha':rev,'license':meta.get('cardData',{}).get('license'),'info':info,'files':[f['rfilename'] for f in meta.get('siblings',[]) if 'parquet' in f['rfilename']][:8]},ensure_ascii=False))
    except Exception as exc: print(rid,type(exc).__name__,str(exc))
