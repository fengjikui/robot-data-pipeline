"""Trusted executor-side capture profiles, separate from browser command payloads."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import sys
from robot_pipeline.workbench.paths import file_hash, native_input

XR_REVISION = '817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b'
XR_FILES = {
    'teleop/teleop_hand_and_arm.py':'41e50227bb6973a7e12d3b5a1f118c2bf5391c06f3bb62b33d710c7cee9c1261',
    'teleop/utils/episode_writer.py':'664937c5192fcb19cfdd1656af8c88310fc1f8860aee8db806760d8d7a815888',
}
LOOPBACK_DDS = '<CycloneDDS><Domain><General><Interfaces><NetworkInterface name="lo"/></Interfaces></General></Domain></CycloneDDS>'

def load_profile(directory):
    root = native_input(str(directory))
    p = root/'capture-profile.json'
    if not p.is_file() or p.is_symlink() or p.stat().st_size > 128*1024:
        raise ValueError('配置目录必须包含 capture-profile.json（小于 128 KiB 的普通文件）')
    profile = json.loads(p.read_text(encoding='utf-8-sig'))
    if profile.get('format') != 'robot_pipeline.capture.profile.v1': raise ValueError('采集配置版本不支持')
    if profile.get('mode') not in ('real','simulation'): raise ValueError('采集模式必须为 real 或 simulation')
    if profile.get('backend') not in ('unitree','synthetic'): raise ValueError('采集后端不支持')
    output = native_input(profile.get('output_root',''))
    if not output.is_dir(): raise ValueError('采集输出目录不存在')
    profile['output_root'] = str(output)
    profile['profile_directory'] = str(root)
    profile.setdefault('services', [])
    if not isinstance(profile['services'], list) or len(profile['services']) > 8: raise ValueError('服务清单无效')
    ids = set()
    for service in profile['services']:
        ident = service.get('id','')
        if not re.fullmatch('[a-z][a-z0-9_-]{0,40}',ident) or ident in ids: raise ValueError('服务 ID 无效或重复')
        ids.add(ident)
        if service.get('manage') not in ('launch','reuse'): raise ValueError('服务必须明确为 launch 或 reuse')
        if service['manage']=='launch':
            argv=service.get('argv')
            if not isinstance(argv,list) or not argv or len(argv)>80 or any(not isinstance(x,str) or '\x00' in x for x in argv):
                raise ValueError('服务 argv 必须为执行机配置中的参数数组')
            if service.get('transport','local') not in ('local','ssh'): raise ValueError('服务 transport 无效')
        probe=service.get('probe')
        if not isinstance(probe,dict) or not isinstance(probe.get('host'),str) or not isinstance(probe.get('port'),int) or not 1<=probe['port']<=65535:
            raise ValueError('每项依赖服务必须配置 TCP 探测 host / port')
    if profile['backend']=='unitree':
        if profile.get('arm')!='G1_29' or profile.get('ee')!='dex3':
            raise ValueError('本轮已接线范围为 G1_29 + Dex3；其他本体配置需单独适配验收')
        repo=native_input(profile.get('xr_repo',''))
        for relative, digest in XR_FILES.items():
            path=repo/relative
            if not path.is_file() or path.is_symlink() or file_hash(path)!=digest:
                raise ValueError('Unitree 文件版本不匹配：'+relative+'；请使用固定 revision '+XR_REVISION)
        python=Path(profile.get('python',''))
        # Virtualenv executables commonly are symlinks. Preserve the venv path rather than resolving it.
        if not python.is_absolute() or not python.is_file(): raise ValueError('采集 Python 不存在或不是绝对路径')
        if sys.platform!='linux': raise ValueError('当前 Unitree 采集适配器运行于 Linux Host；工作台可通过 SSH 接入')
        interface=profile.get('network_interface')
        if not isinstance(interface,str) or not re.fullmatch('[A-Za-z0-9_.:-]{1,60}',interface): raise ValueError('必须明确 DDS 网卡')
        if not isinstance(profile.get('image_server_ip'),str) or not profile['image_server_ip']: raise ValueError('需要图像服务地址')
        if profile['mode']=='simulation':
            if interface!='lo' or profile['image_server_ip'] not in ('127.0.0.1','localhost'):
                raise ValueError('首期仿真必须在采集 Host 本机运行，并使用 lo / 127.0.0.1 隔离真机 DDS')
            if not any(s['id']=='simulation' for s in profile['services']): raise ValueError('仿真模式缺少 simulation 服务')
        elif interface=='lo': raise ValueError('真机模式需要实际机器人网络接口，不能使用仿真 lo 配置')
        profile['xr_repo']=str(repo);profile['python']=str(python)
    return profile

def synthetic_profile(directory, mode):
    root=Path(directory).resolve();root.mkdir(parents=True,exist_ok=True)
    output=root/'recordings';output.mkdir(exist_ok=True)
    profile={'format':'robot_pipeline.capture.profile.v1','backend':'synthetic','mode':mode,
             'label':'本地合成采集试运行','output_root':str(output),'services':[]}
    (root/'capture-profile.json').write_text(json.dumps(profile,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return root
