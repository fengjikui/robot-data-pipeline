"""Synthetic schema fixture; never represent it as real robot capture."""
import json,pathlib
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]/'examples/raw/schema_fixture/episode_0000'
(root/'colors').mkdir(parents=True,exist_ok=True)
rows=[]
for i in range(6):
    colors={}
    for camera in range(4):
        relative=f'colors/{i:06}_color_{camera}.jpg'
        Image.new('RGB',(640,480),(35+camera*35,60+i*10,95)).save(root/relative)
        colors[f'color_{camera}']=relative
    rows.append({'idx':i,'colors':colors,'depths':{},'states':{k:{'qpos':[0.01*i]*7,'qvel':[],'torque':[]} for k in ['left_arm','right_arm','left_ee','right_ee']},'actions':{k:{'qpos':[0.01*(i+1)]*7,'qvel':[],'torque':[]} for k in ['left_arm','right_arm','left_ee','right_ee']},'tactiles':None,'audios':None,'sim_state':None})
(root/'data.json').write_text(json.dumps({'info':{'image':{'width':640,'height':480,'fps':30},'source':'SYNTHETIC SCHEMA FIXTURE ONLY'},'text':{'goal':'Synthetic schema example only; not a real demonstration.'},'data':rows},indent=2))
