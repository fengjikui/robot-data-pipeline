from __future__ import annotations
import json,re,time,xml.etree.ElementTree as ET
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from .core import dump
from .learning import predict
ROOT=Path(__file__).resolve().parents[1]
import os
FONT=os.environ.get('ROBOT_PIPELINE_FONT','/System/Library/Fonts/STHeiti Light.ttc')
def font(n):return ImageFont.truetype(FONT,n)
def name_to_mjcf(name):
    name=re.sub(r'([A-Z])',r'_\1',name[1:]).lower().lstrip('_')
    name=re.sub(r'(\D)(\d+)$',r'\1_\2',name)
    return name+'_joint'
def make_model():
    import mujoco
    path=ROOT/'assets/unitree_g1/g1_with_hands.xml'
    tree=ET.parse(path);tree.getroot().set('model','G1 fixed pelvis educational model')
    tree.find('compiler').set('meshdir',str(path.parent/'assets'))
    tree.find('worldbody/body').remove(tree.find('.//freejoint'))
    keys=tree.find('keyframe')
    if keys is not None:tree.getroot().remove(keys)
    visual=ET.SubElement(tree.getroot(),'visual');ET.SubElement(visual,'global',offwidth='640',offheight='480');ET.SubElement(visual,'headlight',ambient='0.45 0.45 0.45',diffuse='0.7 0.7 0.7')
    world=tree.find('worldbody');ET.SubElement(world,'light',pos='1 -1 3',dir='-1 1 -3',diffuse='0.8 0.8 0.8')
    ET.SubElement(world,'geom',name='floor',type='plane',size='4 4 0.05',rgba='0.17 0.20 0.24 1')
    m=mujoco.MjModel.from_xml_string(ET.tostring(tree.getroot(),encoding='unicode'))
    m.opt.timestep=1/300
    # Fixed pelvis is intentional; no walking or balance controller is present.
    return m

def render(run,output,seconds=12):
    import mujoco,imageio.v2 as imageio
    if not 0<seconds<=60:raise ValueError('seconds must be in (0,60]')
    run=Path(run);output=Path(output)
    if output.exists():raise FileExistsError(f'refusing overwrite: {output}')
    output.mkdir(parents=True)
    sample=np.load(run/'evaluation_sample.npz');s=sample['state'];a=sample['action'];pred=sample['prediction']
    names=json.loads((ROOT/'evidence/datasets/G1_Dex3_ToastedBread_Dataset/meta__info.json').read_text())['features']['observation.state']['names'][0]
    m=make_model();d=mujoco.MjData(m);reference=mujoco.MjData(m)
    joints=[mujoco.mj_name2id(m,mujoco.mjtObj.mjOBJ_JOINT,name_to_mjcf(n)) for n in names]
    if min(joints)<0 or len(set(joints))!=28:raise ValueError('joint names do not map uniquely to 28 MJCF joints')
    qidx=m.jnt_qposadr[joints];limits=m.jnt_range[joints]
    aids={int(m.actuator_trnid[i,0]):i for i in range(m.nu)};actids=np.asarray([aids[j] for j in joints])
    camera=mujoco.MjvCamera();camera.lookat[:]=[0.10,0,0.92];camera.distance=2.45;camera.azimuth=145;camera.elevation=-12
    renderer=mujoco.Renderer(m,height=480,width=640)
    step_count=min(int(seconds*30),len(s));clips=int(np.count_nonzero((s[:step_count]<limits[:,0])|(s[:step_count]>limits[:,1])))
    def rgb(data):
        mujoco.mj_forward(m,data);renderer.update_scene(data,camera=camera);return renderer.render().copy()
    def layout(left,right,title,line,foot):
        canvas=Image.new('RGB',(1280,720),'#f5f6f8');canvas.paste(Image.fromarray(left),(0,115));canvas.paste(Image.fromarray(right),(640,115));draw=ImageDraw.Draw(canvas)
        draw.text((34,20),title,font=font(30),fill='#15243b');draw.text((34,68),line,font=font(21),fill='#35475c')
        draw.text((34,616),foot,font=font(21),fill='#15243b');draw.text((34,664),'G1 43 关节模型 · 28 维双臂双手数据 · 机身固定 · 无真机控制',font=font(19),fill='#53657a')
        return np.asarray(canvas)
    writer=imageio.get_writer(output/'g1_offline_predictions.mp4',fps=30,codec='libx264',quality=7,macro_block_size=16,ffmpeg_params=['-threads','1'])
    try:
        for i in range(step_count):
            reference.qpos[qidx]=np.clip(s[i],limits[:,0],limits[:,1]);d.qpos[qidx]=np.clip(pred[i],limits[:,0],limits[:,1])
            frame=layout(rgb(reference),rgb(d),'真实开源数据进入 G1 模型后的离线预测可视化','左：测试回合的实测状态    右：模型基于同一实测状态预测的目标关节位置',f'{i/30:4.1f}s   此片为运动学投影 无物体交互 无自主任务成功结论')
            writer.append_data(frame)
            if i==step_count//2:Image.fromarray(frame).save(output/'g1_preview.jpg')
            if i%60==0:print(f'offline rendering {i}/{step_count}',flush=True)
    finally:writer.close()
    # Second experiment really advances MuJoCo dynamics using model predictions and simulated feedback.
    mujoco.mj_resetData(m,d);d.qpos[qidx]=np.clip(s[0],limits[:,0],limits[:,1]);mujoco.mj_forward(m,d)
    d.ctrl[:]=d.qpos[m.jnt_qposadr[m.actuator_trnid[:,0]]]
    rollout=[];targets=[];clipped=0;maxvel=0
    writer=imageio.get_writer(output/'g1_fixed_pelvis_closed_loop.mp4',fps=30,codec='libx264',quality=7,macro_block_size=16,ffmpeg_params=['-threads','1'])
    try:
        for i in range(step_count):
            state=d.qpos[qidx].copy();target=predict(run/'policy.npz',state)[0]
            clipped+=int(np.count_nonzero((target<limits[:,0])|(target>limits[:,1])))
            target=np.clip(target,limits[:,0],limits[:,1]);target=np.clip(target,state-0.06,state+0.06)
            d.ctrl[actids]=target
            for _ in range(10):mujoco.mj_step(m,d)
            if not np.isfinite(d.qpos).all() or not np.isfinite(d.qvel).all():raise ValueError('nonfinite simulation state')
            rollout.append(d.qpos[qidx].copy());targets.append(target);maxvel=max(maxvel,float(np.max(np.abs(d.qvel))))
            reference.qpos[qidx]=np.clip(s[i],limits[:,0],limits[:,1])
            frame=layout(rgb(reference),rgb(d),'固定机身下的 MuJoCo 闭环动作预测实验','左：开源记录状态的运动学回放    右：学习模型读取仿真反馈后驱动关节',f'{i/30:4.1f}s   物理积分中  累计 {clipped} 个目标分量超限并截断  当前模型不可部署')
            writer.append_data(frame)
            if i%60==0:print(f'closed-loop rendering {i}/{step_count}',flush=True)
    finally:writer.close();renderer.close()
    np.savez_compressed(output/'rollout.npz',state=np.asarray(rollout),action=np.asarray(targets))
    report={'rendered_frames_per_video':step_count,'fps':30,'seconds':step_count/30,'mujoco_version':mujoco.__version__,'model_joint_count':m.njnt,'controlled_dimensions':28,'fixed_pelvis':True,'offline_state_range_clip_count':clips,'closed_loop_target_range_clip_count':clipped,'closed_loop_target_range_clip_fraction':clipped/(step_count*28),'deployment_ready':False,'max_abs_joint_velocity':maxvel,'physics_timestep':m.opt.timestep,'policy_model':str((run/'policy.npz').resolve()),'task_success_evaluated':False,'files':['g1_offline_predictions.mp4','g1_fixed_pelvis_closed_loop.mp4','g1_preview.jpg','rollout.npz'],'limitations':['fixed pelvis removes balance and walking','no toaster, table task, box or contacts needed by the original demonstration','cross-model hand sign/calibration not validated on hardware','offline video uses measured test state at every frame','closed-loop video uses simulated feedback but is only a short numerical integration check']}
    dump(output/'render_report.json',report);return report
