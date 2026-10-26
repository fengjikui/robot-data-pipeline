from __future__ import annotations
import hashlib, json, math, sys, tempfile, uuid
from pathlib import Path, PurePosixPath, PureWindowsPath
import numpy as np

PARTS = ('left_arm','right_arm','left_ee','right_ee')
DIMS = (7,7,7,7)

def dump(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n', encoding='utf-8')

def sha256(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()

def contained_file(base, relative):
    if not isinstance(relative,str) or not relative: raise ValueError('empty image path')
    normalized=relative.replace('\\','/')
    if PureWindowsPath(relative).drive or PurePosixPath(normalized).is_absolute() or '..' in PurePosixPath(normalized).parts:
        raise ValueError('image path must be a portable contained relative path')
    p=(base/normalized).resolve()
    if not p.is_relative_to(base.resolve()): raise ValueError('image path leaves episode directory')
    if not p.is_file(): raise ValueError('missing image '+relative)
    return p

def flatten(frame,key):
    pieces=[]
    for part,n in zip(PARTS,DIMS):
        a=np.asarray(frame[key][part]['qpos'],dtype=np.float32)
        if a.shape!=(n,) or not np.isfinite(a).all():raise ValueError(f'{key}.{part}.qpos expected {n} finite values')
        pieces.append(a)
    return np.concatenate(pieces)

def validate_raw(path):
    from PIL import Image
    path=Path(path); errors=[]; warnings=[];arrays={'state':[],'action':[]}
    try:obj=json.loads(path.read_text(encoding='utf-8'))
    except (ValueError,OSError) as exc:return {'valid':False,'errors':[str(exc)],'warnings':[]}
    rows=obj.get('data',[])
    if not rows: errors.append('empty episode')
    cameras=None
    for i,row in enumerate(rows):
        try:
            if row.get('idx')!=i: raise ValueError('idx is not continuous from zero')
            for key,target in [('states','state'),('actions','action')]:arrays[target].append(flatten(row,key))
            cams=set(row.get('colors',{}))
            if cameras is None:cameras=cams
            if cams!={'color_0','color_1','color_2','color_3'} or cams!=cameras: raise ValueError('expected color_0 through color_3 at every frame')
            for relative in row['colors'].values():
                image=contained_file(path.parent,relative)
                with Image.open(image) as img:
                    size=img.size; img.verify()
                if size!=(640,480):raise ValueError(f'image size {size} does not match pinned converter 640x480')
        except (ValueError,KeyError,TypeError,OSError) as exc:errors.append(f'frame {i}: {exc}')
    timestamps=[r.get('timestamp') for r in rows]
    if any(t is None for t in timestamps):warnings.append('no per-sensor capture timestamps; physical synchronization is unverified')
    else:
        try:
            ts=np.asarray(timestamps,dtype=float)
            if not np.isfinite(ts).all() or np.any(np.diff(ts)<=0):errors.append('timestamps nonfinite or not strictly increasing')
        except (ValueError,TypeError):errors.append('invalid timestamps')
    fps=obj.get('info',{}).get('image',{}).get('fps')
    if fps!=30: warnings.append(f'raw nominal fps={fps}; pinned official converter writes 30 fps')
    if not obj.get('text',{}).get('goal'):warnings.append('task goal text missing')
    if any((r.get('states',{}).get('body') or {}).get('qpos') for r in rows):warnings.append('body data present but default Dex3 conversion ignores it')
    warnings.append('success label, calibration and frame freshness require external review')
    return {'valid':not errors,'format':'Unitree raw JSON / G1 Dex3 only','frames':len(rows),'cameras':sorted(cameras or []),'state_dim':28,'action_dim':28,'nominal_fps':fps,'errors':errors,'warnings':warnings,'input_sha256':sha256(path)}

def export_raw(path,output):
    path=Path(path);output=Path(output)
    if output.exists():raise FileExistsError(f'refusing overwrite: {output}')
    quality=validate_raw(path)
    if not quality['valid']:raise ValueError(json.dumps(quality,ensure_ascii=False))
    rows=json.loads(path.read_text(encoding='utf-8'))['data']
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('xb') as f:
        np.savez_compressed(f,state=np.stack([flatten(r,'states') for r in rows]),action=np.stack([flatten(r,'actions') for r in rows]),frame_index=np.arange(len(rows)),nominal_timestamp=np.arange(len(rows))/30)
    dump(output.with_suffix('.contract.json'),{'format':'robot_pipeline.numeric.v1','is_lerobot_dataset':False,'order':list(PARTS),'part_dims':list(DIMS),'action_semantics':'recorded joint position target; not measured next state','time_semantics':'nominal index/30; not hardware synchronized','source':str(path.resolve()),'source_sha256':sha256(path),'quality':quality})
    return quality

def load_numeric(path,max_episodes=16):
    import pyarrow.parquet as pq
    import pyarrow as pa
    import pyarrow.compute as pc
    table=pq.read_table(path,columns=['observation.state','action','episode_index','frame_index','timestamp'])
    eps=table['episode_index'].to_numpy();unique=np.unique(eps)[:max_episodes]
    table=table.filter(pc.is_in(table['episode_index'],value_set=pa.array(unique)))
    s=np.asarray(table['observation.state'].to_pylist(),np.float64);a=np.asarray(table['action'].to_pylist(),np.float64)
    e=table['episode_index'].to_numpy();f=table['frame_index'].to_numpy();t=table['timestamp'].to_numpy()
    if s.ndim!=2 or s.shape!=a.shape or s.shape[1]!=28: raise ValueError('this demo requires matching 28-dimensional state/action')
    if not np.isfinite(s).all() or not np.isfinite(a).all():raise ValueError('nonfinite state/action')
    for ep in unique:
        m=e==ep
        if np.any(np.diff(f[m])!=1) or np.any(np.diff(t[m])<=0):raise ValueError(f'nonmonotonic episode {ep}')
    return s,a,e,f,t

def conversion_plan(raw_dir, repo_id):
    if len(repo_id.split('/'))!=2 or any(x in repo_id for x in ['..','\\',' ',':']): raise ValueError('repo id must be owner/name')
    cache=Path(tempfile.gettempdir())/('robot-pipeline-'+uuid.uuid4().hex)/'lerobot'
    return {'executed':False,'upstream_revision':'41c2805742de879ddab2d8d6beaeaf215f876395','upstream_can_delete_existing_cache':True,'environment':{'HF_LEROBOT_HOME':str(cache)},'command_argv':[sys.executable,'unitree_lerobot/utils/convert_unitree_json_to_lerobot.py','--raw-dir',str(Path(raw_dir).resolve()),'--repo-id',repo_id,'--robot-type','Unitree_G1_Dex3','--dataset-config.image-writer-processes','1','--dataset-config.image-writer-threads','1'],'requirements':['select the Python executable in the pinned complete upstream environment before execution','raw-dir must contain task/episode/data.json','all four RGB cameras at 640x480','30 Hz assumption checked','use a NEW unique HF_LEROBOT_HOME; existing repo_id directory can be removed by upstream','run help in the pinned complete upstream environment before execution']}
