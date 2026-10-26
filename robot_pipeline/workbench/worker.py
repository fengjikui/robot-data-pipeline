"""Managed stage subprocess. Only invoked with a workspace-owned job descriptor."""
from __future__ import annotations
import argparse
import os
import sys
from pathlib import Path
from .paths import within, read_json, write_json, file_hash, is_link, safe_relative
from .data import check,export


def execute(workspace: Path, job_id: str):
    descriptor=within(workspace,f'jobs/{job_id}/input.json',exists=True)
    payload=read_json(descriptor);asset=payload['asset'];stage=payload['stage']
    root=within(workspace,asset['path'])
    manifest=within(workspace,asset['manifest_path'],exists=True)
    if file_hash(manifest)!=asset['manifest_sha256']:raise ValueError('资产清单被修改，请重新导入数据')
    expected={entry['path'] for entry in read_json(manifest)['files']}
    actual=set()
    for current,dirs,files in os.walk(root,followlinks=False):
        for name in dirs+files:
            p=Path(current)/name
            if is_link(p):raise ValueError('快照中出现链接或重解析点')
            relative=safe_relative(p.relative_to(root).as_posix())
            if p.is_file():actual.add(relative)
            elif not p.is_dir():raise ValueError('快照中出现特殊文件')
    if actual!=expected:raise ValueError('原始快照文件清单发生变化，请重新导入')
    for entry in read_json(manifest)['files']:
        p=within(root,entry['path'],exists=True)
        if file_hash(p)!=entry['sha256']:raise ValueError('原始快照发生变化：'+entry['path'])
    output=workspace/'jobs'/job_id
    print('开始阶段：'+stage,flush=True)
    if stage in {'check','check_export'}:
        quality=check(root,asset)
        write_json(output/'quality.json',quality)
        print(f"检查 {quality['frames']} 帧，发现 {len(quality['errors'])} 项错误",flush=True)
    else:quality=asset.get('quality')
    if not quality or not quality.get('valid'):
        result={'quality':quality,'artifacts':['quality.json'] if quality else [],'training_ready':False}
        write_json(output/'result.json',result)
        return 2
    result={'quality':quality,'artifacts':['quality.json'] if stage!='export' else [],'training_ready':False}
    if stage in {'export','check_export'}:
        result.update(export(root,output/'export',asset,quality))
        result['artifacts']=(['quality.json'] if stage=='check_export' else [])+['export/records.jsonl','export/contract.json']
        print('导出项目 JSONL 契约；不是 LeRobot，未启动模型训练',flush=True)
    write_json(output/'result.json',result)
    return 0


def main():
    p=argparse.ArgumentParser();p.add_argument('--workspace',required=True);p.add_argument('--job-id',required=True);args=p.parse_args()
    try:return execute(Path(args.workspace).resolve(),args.job_id)
    except (ValueError,OSError,TypeError,KeyError) as exc:
        print(str(exc),file=sys.stderr,flush=True)
        return 2
if __name__=='__main__':sys.exit(main())
