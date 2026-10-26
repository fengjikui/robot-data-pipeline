"""Code-drawn technical figures; no generated robot imagery."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/figures';OUT.mkdir(parents=True,exist_ok=True)
FONT='/System/Library/Fonts/STHeiti Light.ttc'
def f(s):return ImageFont.truetype(FONT,s)
def canvas(title,sub):
    im=Image.new('RGB',(1600,1000),'#f7f8fb');d=ImageDraw.Draw(im);d.text((70,46),title,font=f(45),fill='#182b45');d.text((70,112),sub,font=f(23),fill='#50637b');return im,d
def box(d,xy,title,lines,color='#ffffff'):
    d.rounded_rectangle(xy,radius=14,fill=color,outline='#b6c5d8',width=2);x,y,_,_=xy;d.text((x+22,y+20),title,font=f(29),fill='#183c63')
    for i,line in enumerate(lines):d.text((x+22,y+68+i*36),line,font=f(22),fill='#30465f')
def arrow(d,points,text,pos,color='#236b91'):
    d.line(points,fill=color,width=4);x,y=points[-1];px,py=points[-2];import math;a=math.atan2(y-py,x-px)
    d.polygon([(x,y),(x-16*math.cos(a-.5),y-16*math.sin(a-.5)),(x-16*math.cos(a+.5),y-16*math.sin(a+.5))],fill=color);d.text(pos,text,font=f(21),fill=color)
im,d=canvas('G1 EDU 真机采集的四条数据通路','默认 Host 部署示意  应用接口来自固定版本官方源码  内部电气布线未实测')
box(d,(70,225,430,425),'Apple Vision Pro',['Safari XR 页面','头手追踪与机器人视角'])
box(d,(615,205,1015,540),'Host 计算主机',['televuer 接收 XR 事件','IK 与手部重定向','SDK / DDS 状态与命令','EpisodeWriter 保存 JSON JPG'])
box(d,(1170,205,1530,425),'机器人底层系统',['运动控制与关节执行','状态发布  rt/lowstate'])
box(d,(1170,625,1530,805),'PC2 开发计算单元',['相机 → teleimager','头部与腕部图像服务'])
box(d,(615,710,1015,890),'原始 episode',['实测 state  目标 action','多路图像  任务文本'])
arrow(d,[(430,285),(615,285)],'XR 事件',(447,245));arrow(d,[(1015,275),(1170,275)],'控制目标',(1027,231))
arrow(d,[(1170,370),(1015,370)],'DDS 反馈',(1027,390),'#ba6b28')
arrow(d,[(1170,700),(1080,700),(1080,490),(1015,490)],'图像至 Host',(1086,555),'#24816b')
arrow(d,[(1350,805),(1350,914),(505,914),(505,382),(430,382)],'WebRTC 显示可直接到头显',(80,790),'#24816b')
arrow(d,[(800,540),(800,710)],'采样组合后落盘',(830,606))
d.text((70,934),'注意  PC2 图像服务不是 Host 订阅关节反馈必须经过的应用层转发器',font=f(24),fill='#8a4d23');im.save(OUT/'01_devices_and_dataflow.png')
im,d=canvas('从原始记录到模型输入','转换格式  质量审查  动作语义和部署控制是不同的工程责任')
steps=[('数据来源',['真机遥操作','仿真示范或公开数据']),('质量审查',['结构 图像 数值','时间同步与任务成功']),('转换与契约',['关节顺序与单位','Parquet 视频 元数据']),('训练与评估',['ACT Diffusion 或 BC','按回合隔离测试'])]
for i,(title,lines) in enumerate(steps):
    x=55+i*390;box(d,(x,245,x+330,465),title,lines)
    if i<3:arrow(d,[(x+330,350),(x+386,350)],'',(0,0))
box(d,(95,590,745,830),'普通 G1 Dex3 操作数据',['双臂 14 + 双手 14 = 28 维','默认不提取腿 腰或移动指令','此处维度不是硬件总关节数'],color='#edf4fb')
box(d,(845,590,1495,830),'未来的搬箱移动操作契约',['移动命令与操作动作的定义需先确定','全身状态  接触  时间与成功标注','控制器适配后才能训练和部署'],color='#edf7f2')
d.text((95,906),'LeRobot 是存储与读取约定  不能自动产生缺失的行走标签  也不能自动完成跨机器人迁移',font=f(25),fill='#8a4d23');im.save(OUT/'02_pipeline_and_action_contract.png')
im,d=canvas('小规模真实数据训练的结果','单位 rad  测试以完整 episode 划分  越低越好  这是关节目标预测误差')
vals=[('轻量行为克隆模型',.066418,'#3978ad'),('保持当前关节位置',.047450,'#32866b'),('固定训练集均值',.380776,'#a6b3c4')]
for i,(label,val,color) in enumerate(vals):
    y=245+i*155;d.text((90,y),label,font=f(29),fill='#263c55');d.rectangle((90,y+55,90+val/.4*1350,y+105),fill=color);d.text((110+val/.4*1350,y+61),f'{val:.4f}',font=f(25),fill='#263c55')
box(d,(90,750,1500,925),'结论',['模型能学习数据  但测试表现仍弱于保持当前状态的基线','离线误差不等于任务成功率  下一步需要视觉 时序与任务匹配的闭环评估'],color='#fff5e9');im.save(OUT/'03_training_results.png')
