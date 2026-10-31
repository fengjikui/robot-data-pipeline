"""Run a verified Unitree entry point with observable control and writer completion."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import runpy
import sys
from .profile import load_profile
from .runtime import Control

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument('--profile-directory',required=True)
    parser.add_argument('--session-directory',required=True)
    args=parser.parse_args(argv)
    profile=load_profile(args.profile_directory)
    directory=Path(args.session_directory).resolve()
    metadata=json.loads((directory/'session.json').read_text(encoding='utf-8'))
    control=Control(directory,metadata)
    try:
        if profile['backend']=='synthetic':
            from .synthetic import run
            return run(control,directory,metadata)
        from .runtime import instrument_writer
        repo=Path(profile['xr_repo'])
        sys.path.insert(0,str(repo));sys.path.insert(0,str(repo/'teleop'))
        import teleop.utils.episode_writer as writer_module
        import teleop.utils.ipc as ipc_module
        writer_module.EpisodeWriter=instrument_writer(writer_module.EpisodeWriter,control)
        class IPCBridge:
            def __init__(self,on_press,get_state,**kwargs):control.bind(on_press,get_state)
            def start(self):pass
            def stop(self):pass
        ipc_module.IPC_Server=IPCBridge
        raw=directory/'raw';raw.mkdir(exist_ok=True)
        sys.argv=['teleop_hand_and_arm.py','--arm',profile['arm'],'--ee',profile['ee'],
            '--input-mode','hand','--img-server-ip',profile['image_server_ip'],
            '--network-interface',profile['network_interface'],'--frequency',str(profile.get('frequency',30)),
            '--record','--ipc','--task-dir',str(raw),'--task-name','episodes',
            '--task-goal',metadata['task'],'--task-desc',metadata['description']]
        if profile['mode']=='simulation':sys.argv.append('--sim')
        if profile.get('headless',True):sys.argv.append('--headless')
        os.chdir(repo/'teleop')
        runpy.run_path(str(repo/'teleop/teleop_hand_and_arm.py'),run_name='__main__')
        return 0
    finally:control.close()

if __name__=='__main__':raise SystemExit(main())
