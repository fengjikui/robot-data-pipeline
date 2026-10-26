import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,SKILL,RUNTIME,FONT,C,T,L,B,D,IMG,title,rail,table,sources,notes,Presentation,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';
const revision='v14',build=path.join(ROOT,'.build/full-report',revision),out=path.join(ROOT,'artifacts/report');
await fs.mkdir(build,{recursive:true});const attempt=path.join(build,'attempt-'+Date.now());await fs.mkdir(attempt);
const config=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v14.json'),'utf8'));
const oldOrder=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8')).contentOrder;
const imported=await PresentationFile.importPptx(await FileBlob.load(path.join(out,'具身智能数据管线报告_v13.pptx')));
if(imported.slides.items.length!==25)throw new Error('Expected v13 with 25 slides');
const proto=imported.toProto();
for(const d of config.pages){const index=oldOrder.indexOf(d.contentPage);if(index>=0)proto.slides[index].elements=[];}
const p=Presentation.load(proto),byKey=new Map(oldOrder.map((key,i)=>[key,p.slides.items[i]]));
const textLink=(s,name,label,url,x,y,w=480,size=19)=>{const t=T(s,name,label,x,y,w,28,size,{color:C.blue,raw:true});t.text.get(label).link={uri:url,isExternal:true};return t;};
const renderers={
  4(s,d){
    title(s,d.title,d.subtitle);
    T(s,'raw-actual','官方原始回放样本：167 条记录',64,171,650,39,25,{bold:true});
    table(s,[['字段组','关节名项数','state维数','action维数'],['left_arm','7','7','7'],['right_arm','0','7','7'],['left_hand','0','7','7'],['right_hand','0','7','7'],['body','0','null','null']],64,228,640,270,[180,140,160,160],20);
    T(s,'metadata-gap','0 表示没有填写名称，不表示动作值为零。',64,507,640,30,19,{color:C.muted});
    textLink(s,'raw-viewer','浏览原始 JSON 与图像 ↗','resources/raw_episode.html',64,549,620);
    textLink(s,'raw-json','打开未改写的 data.json ↗','resources/raw/episode_0006/data.json',64,585,620);
    T(s,'same-joint','同一左肩关节（idx = 0）',760,171,456,39,25,{bold:true});
    T(s,'state-field','states.left_arm.qpos[0]',760,237,456,30,20,{raw:true,color:C.muted});
    T(s,'state-actual','−0.333695',760,277,456,49,36);
    T(s,'state-caption','state：机器人实际反馈',760,335,456,30,22,{color:C.muted});
    T(s,'action-field','actions.left_arm.qpos[0]',760,384,456,30,20,{raw:true,color:C.muted});
    T(s,'action-actual','−0.312242',760,424,456,49,36,{color:C.blue});
    T(s,'action-caption','action：记录的控制目标',760,483,456,30,22,{color:C.muted});
    T(s,'raw-task','任务文字：text.goal',760,541,456,28,20,{bold:true});
    T(s,'raw-task-value','Pick up the red cup on the table.',760,578,456,28,18.5,{color:C.muted,raw:true});
  },
  async 9(s,d){
    title(s,d.title,d.subtitle);
    await IMG(s,'assets/report_generated/augmentation_triptych_v1.png',64,171,720,240,'增强视觉说明：中性、偏暖暗、偏冷亮；非实测变换结果');
    ['中性光照','偏暖 / 偏暗','偏冷 / 偏亮'].forEach((v,i)=>T(s,'variant-'+i,v,64+i*240,419,240,30,21,{alignment:'center',color:C.muted}));
    T(s,'illustration-only','视觉示意，非真实增强实验结果。',64,456,720,24,16,{color:C.muted});
    T(s,'built-in','LeRobot 已内置',838,175,378,40,27,{bold:true,color:C.blue});
    T(s,'built-in-detail','亮度、对比度、颜色、锐度\n默认候选还含随机仿射',838,227,378,79,22,{color:C.muted});
    T(s,'custom-transform','也可以自写逻辑',838,330,378,39,26,{bold:true});
    T(s,'custom-detail','模糊、噪声、压缩、阴影等\n通过变换工厂或读取路径接入',838,381,378,84,21,{color:C.muted});
    T(s,'augment-command','lerobot-imgtransform-viz --repo_id=local/g1_box_v1 --image_transforms.enable=true',64,495,1152,32,19,{raw:true});
    T(s,'online-augment','训练配置：--dataset.image_transforms.enable=true',64,539,1152,31,21,{raw:true,color:C.blue});
    T(s,'augment-scope','官方预览仅首相机首帧；训练要指定审过的配方，不能把默认全部候选自动当作批准。',64,588,1152,30,17.5,{color:C.muted});
  },
  augmentation_review(s,d){
    title(s,d.title,d.subtitle);
    table(s,[['优先级','可以采用的方法','重点核对'],['低成本先试','轻量光照、曝光、对比度','颜色指令、目标与接触仍有效'],['按问题加入','模糊、噪声、压缩、局部阴影','强度符合真实相机退化'],['先审几何','裁剪、平移、分辨率/仿射','标注、相机和动作语义一致'],['有场景再做','重渲染、随机化、重新生成轨迹','物理变化后重新执行并记录'],['研究候选','生成式编辑、语言或空间变换','保护机器人/目标，复验语义']],64,178,1152,292,[200,502,450],20);
    rail(s,['配置预览','Agent 初筛','人复核','闭环对照','批准或回退'],160,515,960,{size:21,labelHeight:30});
    T(s,'review-rule','先按母回合划分；派生不跨训练/测试集合。保留真实留出场景，未改善就回退。',64,597,1152,26,18,{color:C.muted});
  },
  10(s,d){
    title(s,d.title,d.subtitle);
    T(s,'raw-title','原始回合',64,170,480,37,27,{bold:true});B(s,'raw-files',64,216,468,86,C.soft);T(s,'raw-code','episode/  data.json\ncolors/*.jpg',88,223,426,73,22,{raw:true,color:C.muted});
    T(s,'target-title','LeRobot 数据',721,170,495,37,27,{bold:true,color:C.blue});B(s,'target-files',721,216,495,86,C.soft);T(s,'target-code','Parquet + 视频/图像 + meta',741,224,455,34,22,{color:C.muted});
    [['本地数值节选','resources/converted_episode.html'],['meta 信息','resources/converted/info.json'],['公开目录','https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/tree/02cb29161f5adb2981a072aa35b408d82a556d07']].forEach(([label,url],i)=>textLink(s,'converted-link-'+i,label,url,741+i*154,268,147,17.5));
    L(s,'convert-arrow',567,261,678,261,C.blue,2.3,false,true);
    T(s,'independent-example','右侧链接为独立官方示例，非前述历史回合的转换结果。',64,308,1152,24,17,{color:C.muted});
    table(s,[['源记录','LeRobot 字段'],['states.*.qpos','observation.state（标准 G1 Dex3：28维）'],['actions.*.qpos','action（双臂与双手，不自动读取body）'],['图像 / text.goal','observation.images.* / task']],64,339,1152,180,[465,687],19.5);
    T(s,'conversion-command','python unitree_lerobot/utils/convert_unitree_json_to_lerobot.py \\\n  --raw-dir datasets/raw --repo-id local/g1_box_v1 --robot-type Unitree_G1_Dex3',64,539,1152,57,18.5,{raw:true});
    T(s,'conversion-location','输出：HF_LEROBOT_HOME/repo_id；使用新的 repo-id。频率、关节/相机配置必须匹配来源。',64,602,1152,24,17,{color:C.muted});
  },
  conversion_policy_contract(s,d){
    title(s,d.title,d.subtitle);rail(s,['采集工具','官方转换器','已有训练器'],244,214,792,{size:25,labelHeight:43});
    const cols=[['保存已经取得的信号\n本体、手型、相机与记录范围','--arm G1_29 --ee dex3\n--input-mode hand --record'],['选择源记录对应的配置\n关节、手部与相机字段映射','--raw-dir <RAW_ROOT>\n--repo-id local/g1_box_v1\n--robot-type Unitree_G1_Dex3'],['调用框架已有策略实现\n选择数据、模型与训练配方','--dataset.repo_id=...\n--policy.type=act']];
    cols.forEach(([a,b],i)=>{const x=64+i*396;T(s,'role-'+i,a,x,334,360,93,23);T(s,'argument-'+i,b,x,449,360,73,19,{color:C.muted,raw:true});});
    T(s,'shared-dataset','同一份已匹配的 LeRobot 数据，通过 policy.type 选择策略。',64,548,1152,35,25,{bold:true,color:C.blue});
    T(s,'new-signal-contract','腰腿与移动所需的新信号，需要扩展采集与数据契约。',64,591,1152,28,20,{color:C.muted});
  },
  11(s,d){
    title(s,d.title,d.subtitle);
    table(s,[['已集成策略','policy.type 取值','主要调整的配方参数'],['ACT','act','chunk_size、n_action_steps'],['Diffusion','diffusion','n_obs_steps、horizon、n_action_steps'],['π₀','pi0','基座检查点、训练步数与资源'],['π₀.₅','pi05','pretrained_path、dtype、梯度检查点'],['GR00T','groot','检查点、骨干/扩散模块微调配置']],64,178,1152,282,[250,230,672],20.5);
    T(s,'same-entry','同一个入口，切换类型与配方',64,478,1152,35,25,{bold:true,color:C.blue});
    T(s,'train-command','lerobot-train --dataset.repo_id=local/g1_box_v1 \\\n  --policy.type=act --policy.push_to_hub=false',64,528,1152,58,21,{raw:true});
    T(s,'other-implementations','OpenVLA 独立后端、在线 PPO 另走对应流程；此处不把缺失的腰腿信号当成模型适配问题。',64,600,1152,24,17,{color:C.muted});
  },
  wholebody_data(s,d){
    title(s,d.title,d.subtitle);
    table(s,[['实际路线','记录/转换中有什么','如何理解'],['当前 Dex3 + hand','双臂双手 state/action 各28维\nbody为空','可学操作部分\n未记录R3行走意图'],['另一些 controller 分支','body状态含腰腿与保留槽\nbody动作是三维移动速度','速度是移动目标\n不是每个腿关节目标'],['标准 G1 转换配置','只读取双臂与末端，不读取body','换 policy.type\n不会自动纳入腰腿']],64,183,1152,270,[250,520,382],20.5);
    T(s,'wholebody-intent','先定义要学什么动作，再同步记录对应状态与目标。',64,493,1152,42,28,{bold:true,color:C.blue});
    T(s,'needed-signals','建议补充：真实移动指令、基座/腰腿状态、任务阶段及其时间关系。',64,548,1152,34,23);
    T(s,'wholebody-boundary','G1_29 原始反馈含保留槽，不能把数组长度当作有效自由度；标准28维也不能补零成完整搬箱数据。',64,600,1152,25,17.5,{color:C.muted});
  },
  wholebody_control(s,d){
    title(s,d.title,d.subtitle);
    rail(s,['桌 A 抓取','抱持移动','桌 B 放置'],240,198,800,{size:25,labelHeight:40});
    const node=(name,label,sub,x,y,w,h=78)=>{B(s,name,x,y,w,h,C.soft,C.line);T(s,name+'-label',label,x+14,y+10,w-28,34,24,{bold:true,alignment:'center'});if(sub)T(s,name+'-sub',sub,x+14,y+47,w-28,h-51,18,{alignment:'center',color:C.muted});};
    node('coordinator','任务与阶段协调','',64,315,330,178);T(s,'coordinator-detail','输入当前观察与状态\n处理抓取/行走/放置条件\n形成相互协调的目标',84,372,290,104,20,{alignment:'center',color:C.muted});
    node('upper-target','双腕 / 手指目标','按模型与控制器定义',500,315,300);node('upper-controller','手臂 / 腰部 IK','腰部参与方式按具体配置',885,315,331);
    node('base-target','机身速度 / 导航目标','当前状态反馈参与闭环',500,425,300);node('base-controller','已有行走与平衡控制','产生腿部执行目标',885,425,331);
    for(const [name,x1,y1,x2,y2]of [['to-upper',394,354,500,354],['to-base',394,464,500,464],['upper-execute',800,354,885,354],['base-execute',800,464,885,464]])L(s,name,x1,y1,x2,y2,C.blue,2.1,false,true);
    T(s,'layered-principle','上层给任务目标，下层生成具体腰腿动作；需补移动意图与全程同步示范。',64,535,1152,35,24,{color:C.blue,bold:true});
    T(s,'existing-locomani','Isaac Lab 已有 G1 Locomanipulation 工具。现成 SteeringWheel 场景仍需适配并验证搬箱。',64,594,1152,29,18,{color:C.muted});
  },
  tools_cli(s,d){
    title(s,d.title,d.subtitle);
    const stages=[
      ['01','转换为 LeRobot','python unitree_lerobot/utils/convert_unitree_json_to_lerobot.py \\\n  --raw-dir datasets/raw --repo-id local/g1_box_v1 \\\n  --robot-type Unitree_G1_Dex3 --mode video',181,224],
      ['02','预览增强，再审配方','lerobot-imgtransform-viz --repo_id=local/g1_box_v1 \\\n  --image_transforms.enable=true --episodes=\'[0]\'',327,370],
      ['03','调用已有训练器','lerobot-train --dataset.repo_id=local/g1_box_v1 --policy.type=act \\\n  --policy.device=cuda --policy.push_to_hub=false \\\n  --batch_size=8 --steps=10000 --output_dir=outputs/g1_box_act',451,494]
    ];
    L(s,'tool-timeline',85,201,85,469,C.line,2);
    for(const [n,label,code,y,cy]of stages){D(s,'step-'+n,85,y+19,18,C.pale,C.blue);T(s,'step-num-'+n,n,68,y+5,34,28,16,{alignment:'center',color:C.blue});T(s,'tool-name-'+n,label,128,y,1088,36,25,{bold:true});T(s,'tool-code-'+n,code,128,cy,1088,n==='02'?59:78,18.5,{raw:true});}
    T(s,'tool-runtime','相对路径按上游仓库；示例 CUDA 训练机，完整依赖/数据需先准备。',64,595,770,25,17,{color:C.muted});
    textLink(s,'full-command-guide','完整命令与增强配方 ↗','notes/tool_commands_guide.html',860,593,356,18);
  }
};
for(const d of config.pages){let s=byKey.get(d.contentPage);if(!s){s=p.slides.add();byKey.set(d.contentPage,s);}await renderers[d.contentPage](s,d);sources(s,d.sources,'');notes(s,d);s.speakerNotes.text='精讲口述\n\n'+d.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;}
p.slides.reorder(config.contentOrder.map(key=>{const id=byKey.get(key).id;return id.startsWith('sl/')?id:'sl/'+id;}));
const pxCm=96/2.54,left=1.1*pxCm,reserve=1.3*pxCm,safeTop=720-reserve;
let removed=0;
for(const s of p.slides.items){
  for(const el of [...s.shapes.items]){
    const name=el.name??el.toSnapshot().name??'';
    if(name==='content-page'||/^chapter-p-\d+$/.test(name)){el.delete();removed++;continue;}
    if(name==='title'||name==='slide-title'){el.position={...el.position,left,top:left,width:1280-left*2};}
    if(name==='subtitle'||name==='slide-subtitle'){el.position={...el.position,left,width:1280-left*2};}
    if(/^(source-prefix|source-\d+|icon-credit|slide-sources|page-sources)$/.test(name))el.position={...el.position,top:630};
    if(name==='optional-augmentation'){el.text='训练时亦可';}
    if(name==='rail-label-0'&&el.position.left<0)el.position={...el.position,left:0};
  }
}
if(p.slides.items.length!==config.slideCount)throw new Error('Incorrect slide count');
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(attempt,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,'具身智能数据管线报告_v14.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:config.slideCount,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(attempt,'validation.json')});
await fs.copyFile(path.join(attempt,'validation.json'),path.join(build,'validation.json'));
await fs.writeFile(path.join(build,'format_contract.json'),JSON.stringify({slideCount:config.slideCount,headerLeftCm:1.1,headerTopCm:1.1,footerReservedCm:1.3,footerSafeTopPx:safeTop,removedPageMarkers:removed,titleXpx:left,fullTextBoxAudit:'checked after export by package inspection',sourcesTopPx:630},null,2));
console.log(JSON.stringify({finalPath,slideCount:config.slideCount,removedPageMarkers:removed,layoutFindings:result.presentationLayout.findingCount},null,2));
