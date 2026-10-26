import argparse,json,sys
from pathlib import Path
from .core import validate_raw,export_raw,conversion_plan,dump
p=argparse.ArgumentParser(description='具身智能数据管线原型 无真机控制功能')
s=p.add_subparsers(dest='command',required=True)
a=s.add_parser('check-raw');a.add_argument('path');a.add_argument('--report')
a=s.add_parser('export-numeric');a.add_argument('path');a.add_argument('--output',required=True)
a=s.add_parser('plan-convert');a.add_argument('raw_dir');a.add_argument('--repo-id',required=True)
a=s.add_parser('inspect-info');a.add_argument('path')
a=s.add_parser('train-bc');a.add_argument('path');a.add_argument('--output',required=True);a.add_argument('--max-episodes',type=int,default=16)
a=s.add_parser('render-g1');a.add_argument('--run',required=True);a.add_argument('--output',required=True);a.add_argument('--seconds',type=float,default=12)
args=p.parse_args()
try:
    if args.command=='check-raw':
        result=validate_raw(args.path)
        if args.report:dump(args.report,result)
        print(json.dumps(result,indent=2,ensure_ascii=False));sys.exit(0 if result['valid'] else 2)
    elif args.command=='export-numeric':result=export_raw(args.path,args.output)
    elif args.command=='plan-convert':result=conversion_plan(args.raw_dir,args.repo_id)
    elif args.command=='inspect-info':
        x=json.loads(Path(args.path).read_text(encoding='utf-8'));result={k:x.get(k) for k in ['codebase_version','robot_type','fps','total_episodes','total_frames','data_path','video_path']};result['features']={k:{'shape':v['shape'],'dtype':v['dtype'],'names':v.get('names')} for k,v in x['features'].items()};result['note']='metadata inspected; numeric quality, camera synchronization and task success unverified'
    elif args.command=='train-bc':
        from .learning import train
        result=train(args.path,args.output,args.max_episodes)
    else:
        from .render import render
        result=render(args.run,args.output,args.seconds)
    print(json.dumps(result,ensure_ascii=False,indent=2))
except (ValueError,OSError,KeyError) as exc:
    print(str(exc),file=sys.stderr);sys.exit(2)
