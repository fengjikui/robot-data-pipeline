"""Download one pinned public numeric shard and the referenced G1 MJCF meshes."""
import hashlib,json,pathlib,urllib.request,xml.etree.ElementTree as ET,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
MODEL_REV='f3b6013629c7b94f8ee93fd977b161fa8350f9bc'
RID='unitreerobotics/G1_Dex3_ToastedBread_Dataset'
REV='02cb29161f5adb2981a072aa35b408d82a556d07'
manifest=[]
def fetch(url,dest):
    dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():
        tmp=dest.with_suffix(dest.suffix+'.part')
        for trial in range(3):
            try:
                with urllib.request.urlopen(url,timeout=60) as src,tmp.open('wb') as out:
                    while block:=src.read(1024*1024): out.write(block)
                tmp.replace(dest);break
            except Exception:
                if trial==2: raise
                time.sleep(1)
    manifest.append({'url':url,'path':str(dest.relative_to(ROOT)),'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
    print(str(dest.relative_to(ROOT)),dest.stat().st_size,flush=True)
model=ROOT/'assets/unitree_g1'
xml=ET.parse(model/'g1_with_hands.xml')
for elem in xml.findall('.//asset/mesh'):
    name=elem.attrib['file']
    fetch(f'https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/{MODEL_REV}/unitree_g1/assets/{name}',model/'assets'/name)
for name in ['LICENSE','README.md','g1_with_hands.xml','scene_with_hands.xml']:
    fetch(f'https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/{MODEL_REV}/unitree_g1/{name}',model/name)
fetch(f'https://huggingface.co/datasets/{RID}/resolve/{REV}/data/chunk-000/file-000.parquet',ROOT/'data/downloads/toast_numeric_000.parquet')
(ROOT/'evidence/download_manifest.json').write_text(json.dumps({'model_revision':MODEL_REV,'dataset_id':RID,'dataset_revision':REV,'files':manifest},ensure_ascii=False,indent=2))
