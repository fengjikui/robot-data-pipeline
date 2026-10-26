"""Run with: python -m robot_pipeline.workbench --workspace ./workspace --port 8765."""
import argparse
from pathlib import Path
import sys
from .http import create_server

def main(argv=None):
    p=argparse.ArgumentParser(description='具身智能数据管线工作台，单人本地运行，不控制机器人')
    p.add_argument('--workspace',type=Path,default=Path.cwd()/'workspace',help='资产与作业存储目录，可移动到其他系统')
    p.add_argument('--port',type=int,default=8765)
    args=p.parse_args(argv)
    if not 0<=args.port<=65535:p.error('port 必须在 0 到 65535 之间')
    try:server=create_server(args.workspace,args.port)
    except (OSError,ValueError) as exc:p.exit(2,f'启动失败：{exc}\n')
    print(f'工作台：http://127.0.0.1:{server.server_port}',flush=True)
    print(f'工作目录：{args.workspace.resolve()}；Ctrl+C 关闭并停止本工作台作业',flush=True)
    try:server.serve_forever(poll_interval=.2)
    except KeyboardInterrupt:pass
    finally:server.server_close()
    return 0
if __name__=='__main__':sys.exit(main())
