"""Explicit synthetic recording backend for software trials, never hardware evidence."""
from __future__ import annotations
import base64
import json
from pathlib import Path
import struct
import threading
import time
import zlib
from .runtime import atomic_json

def png(index):
    def chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
    width,height=48,32
    rows=b''
    for y in range(height):
        rows+=b'\0'+b''.join(bytes(((x*4+index*5)%256,(y*6+index*3)%256,80)) for x in range(width))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')

def run(control,directory,metadata):
    state={'START':False,'STOP':False,'READY':True,'RECORD_RUNNING':False}
    pending=[];rows=[];episode=None;started=0
    def press(key):pending.append(key)
    control.bind(press,lambda:dict(state))
    print('SYNTHETIC 合成采集试运行：没有连接机器人或仿真器',flush=True)
    while not state['STOP']:
        if pending:
            key=pending.pop(0)
            if key=='r':state['START']=True
            elif key=='q':state['STOP']=True
            elif key=='s' and state['START']:
                if not state['RECORD_RUNNING']:
                    episode=directory/'raw'/('episode_'+str(time.time_ns()))
                    (episode/'colors').mkdir(parents=True);rows=[];started=time.monotonic()
                    control.created(episode);state['RECORD_RUNNING']=True;state['READY']=False
                else:
                    state['RECORD_RUNNING']=False;control.saving()
                    # This is a real file finalization event in the synthetic backend.
                    time.sleep(.15)
                    atomic_json(episode/'data.json',{'info':{'synthetic':True,'image':{'fps':20}},
                        'text':{'goal':metadata['task'],'desc':'SYNTHETIC 软件试运行，不是真机或GPU仿真示范'},'data':rows})
                    control.saved(episode);state['READY']=True
        if state['RECORD_RUNNING']:
            i=len(rows);image=f'colors/{i:06d}.png';(episode/image).write_bytes(png(i))
            parts=('left_arm','right_arm','left_ee','right_ee')
            rows.append({'idx':i,'timestamp':round(time.monotonic()-started,6),'colors':{'color_0':image},
                'states':{p:{'qpos':[round(.001*i+j*.01,6)]*7} for j,p in enumerate(parts)},
                'actions':{p:{'qpos':[round(.001*i+j*.01+.005,6)]*7} for j,p in enumerate(parts)}})
            if len(rows)>=600:pending.append('s')  # Bound a forgotten software trial to ~30 seconds.
        time.sleep(.05)
    return 0
