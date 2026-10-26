"""Small, bounded raw episode adapter, distinct from the official converter."""
from __future__ import annotations
import json
import math
from pathlib import Path
from .paths import within, file_hash, read_json, write_json

PARTS=('left_arm','right_arm','left_ee','right_ee')
HISTORICAL=('left_arm','right_arm','left_hand','right_hand')
SCOPE='结构、关节数值、索引、图像文件存在性；未解码图像，未验证硬件同步、标定或任务成功。'

def finite_vector(value):
    return isinstance(value,list) and bool(value) and all(isinstance(x,(float,int)) and not isinstance(x,bool) and math.isfinite(x) for x in value)

def inspect_directory(root: Path):
    entries=sorted(root.rglob('data.json'))
    frames=0;recognized=False
    for p in entries:
        try:
            obj=read_json(p)
            if isinstance(obj,dict) and isinstance(obj.get('data'),list): frames+=len(obj['data']);recognized=True
        except (ValueError,OSError): pass
    return {'format':'unitree_raw' if recognized else 'unknown','format_verified':False,'detection_note':'文件布局初步识别；完整结构与动作语义尚未验收','frames':frames,'episodes':len(entries)}

def vectors(row):
    state=row.get('states');action=row.get('actions')
    if not isinstance(state,dict) or not isinstance(action,dict): raise ValueError('缺少 states/actions 对象')
    parts=PARTS if all(x in state for x in PARTS) else HISTORICAL
    result=[]
    for block in (state,action):
        flat=[]
        for part in parts:
            obj=block.get(part)
            if not isinstance(obj,dict) or not finite_vector(obj.get('qpos')): raise ValueError(f'{part}.qpos 必须为有限数值列表')
            if len(obj['qpos'])!=7: raise ValueError(f'{part}.qpos 不是本适配器约定的 7 维')
            flat.extend(obj['qpos'])
        result.append(flat)
    return result,parts

def check(root: Path, asset: dict):
    errors=[];warnings=[];episodes=[];frames=0
    paths=sorted(root.rglob('data.json'))
    if not paths: errors.append('未找到 data.json 回合；此来源只登记元数据，需要新增读取器')
    for p in paths:
        try:
            obj=read_json(p)
            if not isinstance(obj,dict) or not isinstance(obj.get('data'),list) or not obj['data']: raise ValueError('data 必须是非空回合列表')
            rows=obj['data'];last_time=None;missing_times=False;episode_parts=None
            task=obj.get('text',{})
            if not isinstance(task,dict) or not isinstance(task.get('goal'),str) or not task['goal'].strip():warnings.append(f'{p.relative_to(root).as_posix()}：任务说明缺失或无效，需补充人工标注')
            for i,row in enumerate(rows):
                try:
                    if not isinstance(row,dict) or row.get('idx')!=i: raise ValueError('idx 必须从零连续')
                    _,row_parts=vectors(row)
                    if episode_parts is not None and row_parts!=episode_parts:raise ValueError('回合内身体部位字段命名发生变化')
                    episode_parts=row_parts
                    colors=row.get('colors')
                    if not isinstance(colors,dict) or not colors: raise ValueError('缺少图像路径 colors')
                    for value in colors.values(): within(p.parent,value,exists=True)
                    t=row.get('timestamp')
                    if t is None:missing_times=True
                    if t is not None:
                        if not isinstance(t,(float,int)) or isinstance(t,bool) or not math.isfinite(t) or (last_time is not None and t<=last_time): raise ValueError('timestamp 无效或未严格递增')
                        last_time=t
                except (ValueError,TypeError,KeyError) as exc:
                    if len(errors)<100: errors.append(f'{p.relative_to(root).as_posix()} 第 {i} 帧：{exc}')
            if missing_times: warnings.append(f'{p.relative_to(root).as_posix()}：没有可核验的采样时间戳')
            frames+=len(rows);episodes.append({'path':p.relative_to(root).as_posix(),'frames':len(rows),'sha256':file_hash(p)})
        except (ValueError,OSError,TypeError) as exc: errors.append(f'{p.relative_to(root).as_posix()}：{exc}')
    if asset.get('license','unknown').strip().lower() in {'','unknown','未知'}: warnings.append('数据授权待确认')
    if asset.get('embodiment','unknown').strip().lower() in {'','unknown','未知'}: warnings.append('来源本体待确认')
    warnings.append('此检查不证明数据适合当前任务或任一策略；自己的 JSONL 导出也不是 LeRobot')
    return {'valid':not errors,'frames':frames,'episodes':episodes,'state_dim':28,'action_dim':28,'errors':errors,'warnings':warnings,'scope':SCOPE,'training_ready':False,'manifest_sha256':asset['manifest_sha256']}

def export(root: Path, output: Path, asset: dict, quality: dict):
    if not quality.get('valid') or quality.get('manifest_sha256')!=asset['manifest_sha256']: raise ValueError('导出需要当前数据快照通过结构质检')
    output.mkdir(parents=True,exist_ok=False)
    count=0
    with (output/'records.jsonl').open('x',encoding='utf-8',newline='\n') as f:
        for ep,entry in enumerate(quality['episodes']):
            p=within(root,entry['path'],exists=True)
            if file_hash(p)!=entry['sha256']: raise ValueError('质检后源数据发生变化，请重新检查')
            obj=read_json(p)
            for row in obj['data']:
                (state,action),parts=vectors(row)
                record={'episode_index':ep,'frame_index':row['idx'],'observation.state':state,'action':action,'images':{k:(p.parent/v).relative_to(root).as_posix() for k,v in row['colors'].items()},'task':(obj.get('text',{}).get('goal') if isinstance(obj.get('text'),dict) and isinstance(obj['text'].get('goal'),str) else '') or asset.get('task',''),'timestamp':row.get('timestamp'),'synthetic':bool(asset.get('synthetic',False))}
                f.write(json.dumps(record,ensure_ascii=False,allow_nan=False)+'\n');count+=1
    contract={'format':'robot_pipeline.records.v1','is_lerobot_dataset':False,'training_ready':False,'source_asset':asset['id'],'source_manifest_sha256':asset['manifest_sha256'],'frames':count,'state_dim':28,'action_dim':28,'parts':list(parts),'part_dims':[7]*4,'action_semantics':'adapter assumption: recorded qpos target, not measured next state; not verified against this source robot','action_semantics_verified':False,'provenance':{k:asset.get(k) for k in ('source_kind','source_reference','license','embodiment','task','synthetic','name','created_at')},'image_path_base':'asset raw directory; images are not embedded in this export','timestamp_semantics':'preserved when recorded; null means unknown, no synthesized synchronization','scope':SCOPE,'next_steps':['确认关节顺序、单位、相机、时序和任务适用性','实现并验收目标策略的数据读取或官方转换适配器','训练前确认授权、本体和划分策略']}
    write_json(output/'contract.json',contract)
    return {'contract':contract,'artifacts':['export/records.jsonl','export/contract.json']}
