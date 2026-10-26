import {T,L,B,D,IMG,C,FONT,ROOT,title,rail,table,rowList,shrink} from './report_common.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function page01(s){
  title(s,'具身智能数据管线','以 G1 搬箱任务为例：从桌 A 搬到桌 B');
  const steps=[
    {x:64,label:'桌 A 取箱',detail:'识别位置，双手抓取',icon:'package-open'},
    {x:479,label:'抱持移动',detail:'携箱行走，维持稳定',icon:'footprints'},
    {x:894,label:'桌 B 放箱',detail:'对准位置，放稳松手',icon:'package-check'},
  ];
  for(const [i,step]of steps.entries()){
    const source=await fs.readFile(path.join(ROOT,'assets/report_icons/lucide-0.468.0',step.icon+'.svg'),'utf8');
    const svg=source.replaceAll('currentColor','#3C4043').replace('stroke-width="2"','stroke-width="1.7"').replace('width="24"','width="256"').replace('height="24"','height="256"');
    s.images.add({svg,alt:step.label+'：简洁线性示意图标',position:{left:step.x,top:186,width:42,height:42}});
    T(s,'task-label-'+i,step.label,step.x+61,184,252,46,27,{bold:true});
    T(s,'task-detail-'+i,step.detail,step.x,247,322,34,21,{color:C.muted});
  }
  L(s,'task-arrow-1',380,207,438,207,C.line,2,false,true);
  L(s,'task-arrow-2',795,207,853,207,C.line,2,false,true);
  T(s,'pipeline-heading','数据流程',64,337,1152,37,25,{bold:true});
  T(s,'self-capture','自己采集',64,408,184,33,23,{bold:true});
  T(s,'self-detail','真机或仿真遥操作',64,445,194,27,18,{color:C.muted});
  T(s,'external-data','外部数据',64,496,184,33,23,{bold:true});
  T(s,'external-detail','开源数据集或采购',64,533,194,27,18,{color:C.muted});
  L(s,'source-upper',251,424,283,424,C.line,1.7);
  L(s,'source-lower',251,512,283,512,C.line,1.7);
  L(s,'source-merge',283,424,283,512,C.line,1.7);
  L(s,'source-to-process',283,468,316,468,C.blue,2,false,true);
  const labels=['质量检查','数据增强','数据转换','模型训练','仿真评估','真机部署'];
  const centers=[336,500,664,828,992,1156];
  L(s,'process-axis',336,468,1156,468,C.line,2.5);
  labels.forEach((label,i)=>{
    D(s,'process-node-'+i,centers[i],468,20,i===1?C.white:C.pale,C.blue,i===1);
    T(s,'process-number-'+i,String(i+1),centers[i]-16,453,32,30,19,{alignment:'center',color:C.blue});
    T(s,'process-label-'+i,label,centers[i]-74,510,148,36,23,{bold:true,alignment:'center'});
  });
  T(s,'optional-augmentation','按需',440,550,120,26,17,{alignment:'center',color:C.muted});
  T(s,'task-scope','搬箱为贯穿示例，移动与操作能力需分别验证。',64,578,1152,27,18,{color:C.muted});
}

export function toc(s,includeStartup=false,chapters=null){
  title(s,'报告内容','从一次搬箱示范，到可重复使用的数据管线');
  const rows=chapters??[['01','任务与真机采集',includeStartup?'G1 设备、数据流、程序启动与回合记录':'G1 设备、数据流与回合记录',includeStartup?'正文 1–4 / 备查':'正文 1–4'],['02','外部数据与采购','数据类型、需求与样本验证','正文 5–7'],['03','数据处理、训练与部署','质量、适配、学习与闭环评价','正文 8–14'],['04','工作台方案与实施','用户流程、资产库、接口与验收','正文 15–21']];
  rows.forEach((r,i)=>{const y=178+i*96;T(s,'chapter-n-'+i,r[0],64,y,70,44,29,{color:C.blue});T(s,'chapter-'+i,r[1],163,y,530,40,29,{bold:true});T(s,'chapter-d-'+i,r[2],163,y+43,720,31,21,{color:C.muted});T(s,'chapter-p-'+i,r[3],1010,y+10,200,30,19,{color:C.muted,alignment:'right'});if(i<3)L(s,'chapter-sep-'+i,163,y+85,1210,y+85,C.line,1);});
}

export async function page03(s,d){
  const diagram=path.join(ROOT,'assets/report_slide02/official_teleop_diagram.png');
  await IMG(s,'assets/report_slide02/official_teleop_diagram.png',64,189,143,80,'Vision Pro，官方参考图',{left:1750/3415,top:65/2465,right:1-1975/3415,bottom:1-190/2465});
  T(s,'avp','Vision Pro',64,285,260,35,25,{bold:true});T(s,'avp-role','提供头手追踪',64,325,270,28,20,{color:C.muted});
  const svg=(await fs.readFile(path.join(ROOT,'assets/report_icons/lucide-0.468.0/laptop.svg'),'utf8')).replaceAll('currentColor','#3C4043').replace('width="24"','width="256"').replace('height="24"','height="256"');
  s.images.add({svg,alt:'Host',position:{left:80,top:409,width:110,height:110}});
  T(s,'host','Host',64,532,280,35,25,{bold:true});T(s,'host-role','动作处理、组合记录与落盘',64,573,330,28,20,{color:C.muted});
  await IMG(s,'assets/report_slide02/g1_illustration_v1.png',580,148,330,495,'同一G1设备位置的逻辑数据流示意');
  for(const [label,y,col]of [['PC2',259,C.blue],['运控 PC1',306,C.muted]]){B(s,label,713,y,78,label==='PC2'?40:28,C.pale,col,4);T(s,label+'-text',label,713,y,78,label==='PC2'?40:28,label==='PC2'?22:16,{color:col,alignment:'center',bold:true});}
  const red=C.red,blue=C.blue,state='#71767C';
  L(s,'head-to-host',208,351,208,394,red,2.5,false,true);T(s,'head-input','头手姿态',231,360,160,28,19,{color:red});
  for(const [name,points,col]of [['control',[[210,483],[583,483],[583,320],[713,320]],red],['images',[[713,278],[550,278],[550,431],[210,431]],blue],['state',[[713,337],[611,337],[611,455],[210,455]],state]]){
    for(let i=0;i<points.length-1;i++)L(s,name+'-'+i,...points[i],...points[i+1],col,2.3,false,i===points.length-2);
  }
  L(s,'webrtc-1',713,264,530,264,blue,1.7,true);L(s,'webrtc-2',530,264,530,215,blue,1.7,true);L(s,'webrtc-3',530,215,218,215,blue,1.7,true,true);
  T(s,'webrtc-label','WebRTC 显示路径（按配置）',287,174,285,33,17,{color:blue});
  T(s,'command-label','目标动作',314,492,190,28,19,{color:red});
  const rows=[['01','控制','姿态经过 IK / 重定向，变为目标',red],['02','图像','PC2 提供显示与记录画面',blue],['03','实际状态','Host 直接订阅关节反馈',state],['04','记录','在 Host 组合并按回合保存',C.ink]];
  rows.forEach((r,i)=>{const y=172+i*111;T(s,'flow-number-'+i,r[0],929,y,45,30,18,{color:r[3]});T(s,'flow-label-'+i,r[1],982,y-2,230,36,25,{bold:true,color:r[3]});T(s,'flow-detail-'+i,r[2],929,y+43,286,58,20,{color:C.muted});});
  shrink(s);title(s,d.title,d.subtitle);
  T(s,'logical-note','逻辑通路共用网络。结束录制后，还需等待保存完成。',64,568,1152,30,18,{color:C.muted});
}

export async function page04(s,d){
  title(s,d.title,d.subtitle);
  T(s,'raw-heading','官方原始回放测试样本',64,171,620,37,26,{bold:true});
  B(s,'episode-files',64,225,600,116,C.soft);
  T(s,'file-tree','episode_0006/\n  data.json\n  colors/*.jpg',88,234,390,98,22,{raw:true,color:C.muted});
  if(d.visual.rawImage)await IMG(s,d.visual.rawImage,504,227,150,112,'官方原始测试样本 episode_0006，idx 0，color_0 原图');
  const rows=[['图像','data[t].colors','对应图像的路径'],['state','data[t].states.*.qpos','实际关节位置'],['action','data[t].actions.*.qpos','目标关节位置'],['任务','text.goal','记录的任务目标']];
  rows.forEach((r,i)=>{const y=361+i*38;T(s,'field-name-'+i,r[0],64,y,76,30,20,{bold:true});T(s,'field-path-'+i,r[1],150,y,300,30,18.5,{color:C.muted,raw:true});T(s,'field-meaning-'+i,r[2],460,y,210,30,19,{color:C.muted});});
  const link=(name,label,url,x,y,w=486)=>{const t=T(s,name,label,x,y,w,30,19,{color:C.blue,raw:true});t.text.get(label).link={uri:url,isExternal:true};};
  link('raw-official-link','查看官方原始目录说明 ↗',d.visual.links.raw,64,518,600);
  T(s,'actual-heading','原始 data.json 的同一帧',730,171,486,37,26,{bold:true});
  T(s,'actual-origin','rerun_testdata / episode_0006 / idx 0',730,216,486,29,18,{color:C.muted});
  T(s,'joint-example','同一关节：左肩俯仰',730,259,486,29,21,{bold:true});
  T(s,'state-value','−0.333695',730,303,236,47,33,{color:C.ink});
  T(s,'action-value','−0.312242',988,303,228,47,33,{color:C.blue});
  T(s,'state-caption','state：实际反馈',730,353,238,30,20,{color:C.muted});
  T(s,'action-caption','action：控制目标',988,353,228,30,20,{color:C.muted});
  link('raw-viewer-link','浏览原始 JSON 与图像 ↗',d.visual.links.viewer,730,412);
  link('raw-json-link','打开原始 data.json ↗',d.visual.links.json,730,450);
  link('raw-download-link','下载官方原始样例包 ↗',d.visual.links.download,730,488);
  T(s,'state-action','state 记录实际反馈，action 记录交给控制器的目标。',64,551,1152,33,24,{bold:true,color:C.blue});
  T(s,'dim-note','官方历史测试样例，仅用于原始格式说明；手部字段与当前版本不同，任务文本需核验。',64,585,1152,24,17,{color:C.muted});
}

export function page05(s,d){
  title(s,d.title,d.subtitle);
  T(s,'storage-heading','文件与容器',64,170,620,36,26,{bold:true});
  table(s,[['示例','保存什么'],...d.visual.fileExamples],64,217,620,195,[220,400],20);
  T(s,'organization-heading','轨迹组织与读取约定',734,170,482,36,26,{bold:true});
  table(s,[['示例','组织什么'],...d.visual.organizationExamples],734,217,482,195,[150,332],20);
  rail(s,['原始记录','整理与标注','指定配方输入'],182,459,850,{size:23});
  T(s,'asset-labels','分类入口：任务、来源本体、模态、动作表达、处理阶段、来源与版本。',64,574,1152,28,18,{color:C.muted});
}

export function page06(s,d){
  title(s,d.title,d.subtitle);
  const rows=d.visual.rows.map(r=>[r[0],r[1]]);
  table(s,[['需求项','甲方写清什么'],...rows],64,173,1152,302,[230,922],21);
  for(const [i,r]of d.visual.routes.entries()){
    const x=64+i*600;T(s,'route-title-'+i,r[0],x,505,540,35,25,{bold:true,color:i?C.ink:C.blue});T(s,'route-detail-'+i,r[1],x,550,540,36,21,{color:C.muted});
  }
}

export function page07(s,d){
  title(s,d.title,d.subtitle);
  rail(s,['拿说明','选样本','检查','必要转换','读取/试训','任务评价'],112,217,1048,{size:21});
  table(s,[['验证结论','判定依据与处理'],...d.visual.verdicts],64,355,1152,195,[340,812],20);
  T(s,'levels','分别保留读取、训练运行和任务效果证据，样本范围与整库范围分别记录。',64,572,1152,29,19,{color:C.muted});
}

export function page08(s,d){
  title(s,d.title,d.subtitle);
  table(s,[d.visual.headers,...d.visual.rows],64,179,1152,328,[180,500,472],21);
  const ys=552;for(const [i,label]of d.visual.decisions.entries()){
    const x=64+i*400;D(s,'decision-dot-'+i,x+10,ys+15,5,[C.blue,C.amber,C.red][i]);T(s,'decision-'+i,label,x+29,ys,340,35,24,{bold:true,color:[C.blue,C.amber,C.red][i]});
  }
}

export async function page09(s,d){
  title(s,d.title,d.subtitle);
  await IMG(s,'assets/report_generated/augmentation_triptych_v1.png',64,171,890,297,'生成式视觉增强说明：中性、暖暗、冷亮，非采集样本');
  ['中性光照','偏暖 / 偏暗','偏冷 / 偏亮'].forEach((v,i)=>T(s,'variant-'+i,v,64+i*297,482,297,33,22,{alignment:'center',color:C.muted}));
  T(s,'visual-kind','视觉变化',1000,180,214,35,25,{bold:true,color:C.blue});
  T(s,'visual-detail','亮度、色彩等变化\n需保持标签有效',1000,225,214,84,21,{color:C.muted});
  T(s,'physics-kind','场景与动力学',1000,347,214,35,25,{bold:true});
  T(s,'physics-detail','位置、重量、摩擦变化\n需重新验证轨迹',1000,393,214,98,21,{color:C.muted});
  T(s,'generated-label','视觉增强示意，非采集样本。三联图为生成式说明，不是实测增强结果。',64,534,1152,28,16,{color:C.muted});
  T(s,'split-rule',d.visual.splitRule,64,574,1152,28,21,{bold:true});
}

export function page10(s,d){
  title(s,d.title,d.subtitle);
  T(s,'raw-title','原始回合',64,169,480,37,27,{bold:true});
  B(s,'raw-files',64,216,468,99,C.soft);T(s,'raw-code','episode/  data.json\ncolors/*.jpg',88,224,426,80,22,{raw:true,color:C.muted});
  T(s,'target-title','LeRobot 训练数据',721,169,495,37,27,{bold:true,color:C.blue});
  B(s,'target-files',721,216,495,99,C.soft);T(s,'target-code','Parquet + 视频/图像 + meta',741,224,455,36,22,{color:C.muted});
  for(const [i,item]of (d.visual.publicLinks??[]).entries()){
    const t=T(s,'converted-example-link-'+i,item.label,741+i*154,273,147,27,17.5,{color:C.blue,raw:true});t.text.get(item.label).link={uri:item.url,isExternal:true};
  }
  T(s,'independent-output-example','独立官方示例，非前述原始回合的转换结果',721,312,495,26,17,{color:C.muted});
  L(s,'convert-arrow',567,266,678,266,C.blue,2.3,false,true);
  table(s,[['原始字段','训练样本字段'],['states.*.qpos','observation.state（28 维）'],['actions.*.qpos','action（28 维）'],['color_0…3 / text.goal','相机 key / task']],64,341,1152,196,[510,642],21);
  T(s,'main-args','主要参数：--raw-dir  /  --repo-id  /  --robot-type',64,551,1152,26,18,{raw:true,color:C.muted});
  T(s,'conversion-boundary','固定配置负责整理与打包；动作语义、同步与版本仍需核对。',64,581,1152,25,18,{color:C.muted});
}

export function page11(s,d){
  title(s,d.title,d.subtitle);
  const rows=[
    ['ACT（LeRobot）','字段与语义匹配时可复用导出','特征、chunk 与执行步数'],
    ['Diffusion（LeRobot）','字段与语义匹配时可复用导出','观察 / 预测 / 执行窗口'],
    ['π₀ / π₀.₅（openpi）','可复用存储，补 repack / 本体变换','动作约定、统计量与检查点'],
    ['原版 OpenVLA','RLDS / 自定读取；28 维另需适配','动作定义、统计与训练 / 推理'],
    ['在线 PPO','离线格式转换不足，需交互环境','奖励、rollout、重置与终止'],
  ];
  table(s,[['策略与所选实现','转换 / 适配时怎么做','训练时另配什么'],...rows],64,177,1152,330,[252,510,390],19.5);
  T(s,'reuse-title','先按本体整理，再按读取器与配方适配',64,533,1152,34,24,{bold:true,color:C.blue});
  T(s,'reuse-boundary','部分变换可在读取时完成；表中路线尚未在本项目逐一验收。',64,580,820,27,18,{color:C.muted});
  const label='逐策略执行清单 ↗',guide=T(s,'strategy-guide-link',label,914,580,302,27,18,{color:C.blue,raw:true});guide.text.get(label).link={uri:'notes/strategy_conversion_guide.html',isExternal:true};
}

export function page12(s,d){
  title(s,d.title,d.subtitle);
  const xs=[64,416,820];const widths=[270,270,396];
  for(const [i,label]of ['观察','待训练策略','预测动作 / 动作序列'].entries()){B(s,'learn-node-'+i,xs[i],202,widths[i],82,i===1?C.pale:C.soft);T(s,'learn-label-'+i,label,xs[i]+16,219,widths[i]-32,48,26,{bold:true,alignment:'center',color:i===1?C.blue:C.ink});}
  L(s,'observe-to-model',352,243,395,243,C.blue,2.2,false,true);L(s,'model-to-action',705,243,800,243,C.blue,2.2,false,true);
  T(s,'observe-modalities','图像、状态\n任务文本（按配方）',64,307,270,80,21,{color:C.muted,alignment:'center'});
  B(s,'target-action',820,376,396,67,C.soft);T(s,'target-label','示范中的目标动作',835,389,366,41,24,{alignment:'center'});
  B(s,'comparison-node',416,339,270,76,C.soft);T(s,'compare-text','比较预测与示范\n更新参数',428,348,246,58,22,{bold:true,color:C.blue,alignment:'center'});
  L(s,'prediction-compare-1',1018,284,1018,316,C.blue,2);L(s,'prediction-compare-2',1018,316,720,316,C.blue,2);L(s,'prediction-compare-3',720,316,720,358,C.blue,2);L(s,'prediction-compare-4',720,358,686,358,C.blue,2,false,true);
  L(s,'target-compare-1',820,409,720,409,C.blue,2);L(s,'target-compare-2',720,409,720,391,C.blue,2);L(s,'target-compare-3',720,391,686,391,C.blue,2,false,true);
  L(s,'update-up',553,339,553,284,C.blue,2.2,false,true);
  const cols=[['数据','视图、相机/字段\n按回合划分'],['策略','类型、时间窗口\nchunk、归一化'],['训练','batch / steps\n学习率、seed、设备'],['产物','checkpoint\n统计量、日志与指纹']];
  cols.forEach((r,i)=>{const x=64+i*297;T(s,'recipe-title-'+i,r[0],x,460,267,35,24,{bold:true});T(s,'recipe-detail-'+i,r[1],x,502,267,75,20,{color:C.muted});});
}

export function page13(s,d){
  title(s,d.title,d.subtitle);
  const nodes=[['匹配场景',90,185],['观察处理',480,185],['策略推理',870,185],['动作执行',480,310]];
  for(const [label,x,y]of nodes){B(s,label,x,y,290,68,label==='策略推理'?C.pale:C.soft);T(s,label+'-label',label,x+10,y+12,270,44,25,{bold:true,alignment:'center',color:label==='策略推理'?C.blue:C.ink});}
  L(s,'env-observe',397,219,463,219,C.blue,2.2,false,true);L(s,'observe-policy',787,219,853,219,C.blue,2.2,false,true);L(s,'policy-action',1015,253,1015,344,C.blue,2.2);L(s,'policy-action2',1015,344,790,344,C.blue,2.2,false,true);L(s,'action-env',462,344,235,344,C.blue,2.2);L(s,'action-env2',235,344,235,266,C.blue,2.2,false,true);
  T(s,'feedback-label','环境产生下一步反馈',84,368,700,29,18,{color:C.muted});
  table(s,[['方式','输入来自哪里','能够验证什么'],['记录回放','记录中的动作','记录与映射可播放'],['离线预测','离线记录的观察','预测误差与分布表现'],['闭环策略','环境当前反馈','定义场景中的执行效果']],64,421,1152,151,[215,370,567],19);
  T(s,'evaluation-note','事先定义初始条件与成功规则，保留失败、中止和接管。',64,579,1152,24,18,{color:C.muted});
}

export function page14(s,d){
  title(s,d.title,d.subtitle);
  rail(s,['相机/状态','预处理','策略推理','动作还原','机器人执行'],138,226,1000,{size:23});
  T(s,'package-title','部署包随模型一起交付',64,394,600,35,27,{bold:true});
  rowList(s,['checkpoint 与预处理统计量','本体、手型、相机与动作契约','运行频率、控制范围与退出配置'],64,449,680,48,22);
  T(s,'return-title','失败与接管回到数据端',819,394,397,35,26,{bold:true,color:C.blue});
  T(s,'return-detail','失败片段、场景缺口\n补采、检查与重新训练',819,447,397,91,22,{color:C.muted});
  T(s,'deployment-location','推理运行位置按部署配置确定，不固定为 PC2。',819,552,397,48,18,{color:C.muted});
}

export function page15(s,d){
  title(s,d.title,d.subtitle);
  const stages=d.visual.stages;
  rail(s,stages.map(x=>x.label),190,221,900,{size:26});
  stages.forEach((r,i)=>{const x=64+i*402;T(s,'handoff-actions-'+i,r.current.join('\n'),x,346,347,130,23,{color:C.muted});T(s,'handoff-caption-'+i,r.handoff,x,500,347,74,21,{bold:true});});
  T(s,'handoff-result','拟统一入口、状态、配置与产物关系',64,578,1152,28,21,{color:C.blue,bold:true});
}

export function page16(s,d){
  title(s,d.title,'首期：单人、单台 G1、少量已支持配方。以下为功能示意。');
  T(s,'workspace-context','任务：桌 A 到桌 B 搬箱       目标：固定 G1 配置       配方：首期选定',64,168,1152,41,22,{color:C.muted});
  // A native functional wireframe, explicitly a plan rather than a product screenshot.
  B(s,'workbench-frame',64,228,1152,308,C.white,C.line);
  B(s,'entry-sidebar',64,228,254,308,C.soft);
  T(s,'entry-title','数据入口',86,249,205,35,23,{bold:true});T(s,'entry-capture','遥操作采集',86,304,205,35,22,{color:C.blue,bold:true});T(s,'entry-assets','外部数据资产库',86,354,205,35,22);T(s,'entry-runs','处理与训练记录',86,404,205,35,22,{color:C.muted});
  T(s,'active-heading','采集阶段的信息示意',352,249,820,38,25,{bold:true});
  T(s,'active-status','当前状态：等待 XR 会话',352,307,820,35,24,{color:C.blue});
  T(s,'active-condition','待满足：在 Vision Pro 中进入会话，确认输入持续更新',352,354,820,57,21,{color:C.muted});
  for(const [i,label]of ['准备环境','启用遥操作','开始录制'].entries()){B(s,'action-'+i,352+i*254,432,221,52,i===0?C.pale:C.soft,C.line,5);T(s,'action-label-'+i,label,363+i*254,441,199,34,22,{alignment:'center',color:i===0?C.blue:C.ink});}
  T(s,'active-output','产出：已保存回合清单，以及对应日志和运行配置',352,494,820,26,18,{color:C.muted});
  T(s,'automation-note','阶段按钮为主，可选自动串联；需要人工处理或发生失败时停在当前阶段。',64,565,1152,35,20,{color:C.muted});
}

export function page17(s,d){
  title(s,d.title,'先固定任务、目标本体、训练用途与已支持配方，再选择数据');
  const groups=[['自己采集','准备设备\n遥操作与回合保存','操作者'],['公开数据','查找说明\n选版本与下载范围','数据整理者'],['采购数据','拿清单与样本\n试用或试采后确认交付','整理者 / 任务负责人']];
  groups.forEach((r,i)=>{const x=64+i*405;T(s,'source-heading-'+i,r[0],x,180,342,38,27,{bold:true,color:i===0?C.blue:C.ink});T(s,'source-steps-'+i,r[1],x,233,342,89,23,{color:C.muted});T(s,'source-owner-'+i,r[2],x,331,342,29,17,{color:C.muted});L(s,'source-join-'+i,x+152,375,x+152,402,C.line,1.7);});
  L(s,'source-merge',148,402,1026,402,C.line,1.7);L(s,'merge-down',148,402,148,437,C.blue,2,false,true);
  rail(s,['登记入库','检查与选数','必要适配','读取验收','训练与评价'],148,458,1000,{size:22});
  T(s,'roles-note','整理者与训练使用者可由同一人兼任。缺失阶段和失败场景回到来源选择与补采。',64,573,1152,30,19,{color:C.muted});
}

export function page18(s,d){
  title(s,d.title,'用任务缩小候选，再查看本体、配方与适用性证据');
  const vals=[['管理对象','保存什么'],['来源条目','发布方、版本、说明与使用条件'],['持有范围','样本 / 部分 / 所选完整范围，实际存储位置'],['训练视图','选定回合、划分与处理，引用原始文件'],['适用性记录','面向任务、本体与配方的检查和验证证据']];
  table(s,vals,64,175,724,307,[200,524],21);
  T(s,'query-title','一次搬箱任务选数',846,177,370,36,26,{bold:true,color:C.blue});
  T(s,'query-fields','任务：搬箱 / 负载移动\n目标：固定 G1 配置\n用途：目标任务训练\n配方：已支持组合',846,230,370,153,22,{color:C.muted});
  T(s,'candidate-evidence','G1 烤面包数值样本\n可复用做管线验证\n仍缺搬箱覆盖与图像文件',846,417,370,109,21,{color:C.muted});
  T(s,'reuse-note','首次导入确认少量分类与持有范围，重复使用从库内选视图；关键条件变化时复查。',64,548,1152,48,20,{color:C.muted});
}

export function page19(s,d){
  title(s,d.title,'复用上层采集操作，为新增设备逐项适配下层接口');
  rail(s,['准备环境','预览','启用遥操作','录制并保存'],164,215,952,{size:23});
  const labels=['操作者输入','动作映射 / IK','控制与反馈','相机视频','回合记录'];
  labels.forEach((label,i)=>{const x=64+i*235;B(s,'adapter-'+i,x,353,212,61,C.soft);T(s,'adapter-label-'+i,label,x+10,365,192,37,21,{alignment:'center',bold:true});});
  L(s,'adapter-bus',170,436,1109,436,C.line,1.7);
  const backends=[['宇树 G1','首期封装已有工具'],['机械臂','控制箱、夹爪与外部相机'],['智元 / 银河通用','按产品、版本与交付接口'],['自研本体','先具备状态、动作与标定']];
  backends.forEach((r,i)=>{const x=64+i*297;L(s,'backend-drop-'+i,x+118,436,x+118,460,C.line,1.7);T(s,'backend-title-'+i,r[0],x,476,267,35,23,{bold:true,color:i===0?C.blue:C.ink});T(s,'backend-detail-'+i,r[1],x,519,267,59,19,{color:C.muted});});
  T(s,'migration-note','新增设备采集与旧示范、旧策略的跨本体迁移分别验证。其他本体为扩展方向。',64,580,1152,24,18,{color:C.muted});
}

export function page20(s,d){
  title(s,d.title,'已有局部技术验证，下一步实现图形工作台并完成匹配任务验收');
  T(s,'done-title','已有基础',64,174,540,37,28,{bold:true,color:C.blue});
  T(s,'done','设备、来源与接口调研\n16 个公开回合的数值学习实验\n离线预测与固定骨盆闭环视频',64,226,540,132,22,{color:C.muted});
  T(s,'todo-title','待实现 / 待验收',688,174,528,37,28,{bold:true});
  T(s,'todo','图形工作台\n匹配任务的完整闭环评价\n真机部署验收',688,226,528,132,22,{color:C.muted});
  table(s,[['主实验记录','结果与含义'],['测试 RMSE（越低越好）','模型 0.06642 rad；保持 state 基线 0.04745 rad'],['固定骨盆闭环','56.3% 目标分量截断；未评价搬箱成功率']],64,382,1152,125,[315,837],20);
  const stages=['采集与资产','数据到仿真','受限真机','第二个组合'];
  rail(s,stages,168,539,944,{size:20,labelHeight:30});
}

export function page21(s,d){
  title(s,d.title,'以下为首版拟定验收目标，具体数量可随试运行调整');
  const rows=[['采集可重复','3 次会话，每次至少 10 个回合','状态、原始回合与保存记录'],['数据确实可用','库内找回、选数、转换并读取','视图、映射、读取检查与配置'],['训练与评价闭环','1 项训练 + 1 次匹配闭环评价','模型、全部尝试、日志与视频'],['故障可定位恢复','注入相机、服务、磁盘等故障','失败阶段、恢复入口与重试记录'],['复用有实际证据','第二个来源或已接入配置','适配差异、运行记录与范围']];
  table(s,[['维度','拟验收目标','保留证据'],...rows],64,178,1152,342,[230,480,442],20);
  T(s,'closing','管线运行结果与策略任务效果分别报告',64,555,1152,42,28,{bold:true,color:C.blue});
}

export const renderers={3:page03,4:page04,5:page05,6:page06,7:page07,8:page08,9:page09,10:page10,11:page11,12:page12,13:page13,14:page14,15:page15,16:page16,17:page17,18:page18,19:page19,20:page20,21:page21};
