import fs from 'node:fs/promises';
import {captureScene} from './report_capture_v17.mjs';
import path from 'node:path';
import {ROOT,SKILL,RUNTIME,FONT,C,T,L,B,D,IMG,title,table,sources,notes,Presentation,PresentationFile,finalizePresentation,setTheme} from './report_common.mjs';

const revision='v17', build=path.join(ROOT,'.build/full-report',revision), out=path.join(ROOT,'artifacts/report');
await fs.mkdir(build,{recursive:true}); const attempt=path.join(build,'attempt-'+Date.now()); await fs.mkdir(attempt);
// Fresh presentation and fresh slide objects. No old slide, layout or master is copied.
const p=Presentation.create({slideSize:{width:1280,height:720}}); setTheme(p);
const config=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v17.json'),'utf8'));
function textLink(s,name,label,url,x,y,w,size=18){
  const el=T(s,name,label,x,y,w,27,size,{color:C.blue,raw:true}); el.text.get(label).link={uri:url,isExternal:true}; return el;
}
function nativeTable(s,values,x,y,w,h,widths,size=18.2){
  const t=table(s,values,x,y,w,h,widths,size);
  for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++)t.getCell(r,c).text.style={typeface:FONT,fontSize:size,bold:r===0,color:r===0?C.ink:C.muted,alignment:'left',verticalAlignment:'middle',insets:6,wrap:'square',autoFit:'none'};
  return t;
}
async function hostIcon(s,x,y,w,h){
  const svg=(await fs.readFile(path.join(ROOT,'assets/report_icons/lucide-0.468.0/laptop.svg'),'utf8')).replaceAll('currentColor',C.ink);
  s.images.add({svg,alt:'Host电脑，Lucide图标',fit:'contain',position:{left:x,top:y,width:w,height:h}});
}
const renderers={
  agenda(s){
    const items=[['任务与真机采集','设备、程序、数据流和启动顺序'],['数据处理、训练与部署','原始样例、转换、增强和闭环评价'],['外部数据与采购','真实候选、按需获取和样本验收'],['我们的方案与实施','连续流程中的问题、整体方案和实现阶段']];
    L(s,'agenda-line',103,216,103,570,C.line,2);
    items.forEach(([name,description],i)=>{
      const y=205+i*108; D(s,'section-dot-'+i,103,y+11,9,i===3?C.blue:C.white,C.blue);
      T(s,'section-name-'+i,name,150,y-9,450,48,30,{bold:true,color:i===3?C.blue:C.ink});
      T(s,'section-description-'+i,description,650,y-2,550,39,23,{color:C.muted});
    });
  },
  capture: captureScene,
  async processing(s){
    T(s,'raw-head','原始回合：JSON + 图像',64,162,338,32,23,{bold:true});
    await IMG(s,'artifacts/report/resources/data_cards/raw_excerpt.png',64,202,338,151,'原始JSON真实值排版节选',{left:0,top:0,right:0,bottom:.1});
    await IMG(s,'artifacts/report/resources/raw/episode_0006/colors/000000_color_0.jpg',64,365,105,79,'原始回合color_0首帧');
    T(s,'raw-photo-caption','167条记录，两路图像\nstate、action、任务',181,369,221,56,16.8,{color:C.muted});
    T(s,'lerobot-head','训练格式：LeRobot',457,162,350,32,23,{bold:true,color:C.blue});
    await IMG(s,'artifacts/report/resources/data_cards/lerobot_excerpt.png',457,202,350,151,'官方LeRobot元信息和真实Parquet行节选',{left:0,top:0,right:0,bottom:.22});
    T(s,'field-map','states.*.qpos  →  observation.state\nactions.*.qpos →  action',457,366,350,53,17.5,{raw:true,color:C.muted});
    L(s,'format-arrow',412,273,447,273,C.blue,1.9,false,true);
    textLink(s,'raw-link','放大 / 原始 JSON 与图像 ↗','resources/data_cards.html#raw',64,446,338,17.5);
    textLink(s,'lerobot-link','放大 / LeRobot 数值与 meta ↗','resources/data_cards.html#lerobot',457,446,350,17.5);
    L(s,'commands-divider',830,166,830,468,C.line,1);
    T(s,'convert-heading','转换命令',856,162,360,30,22,{bold:true});
    T(s,'convert-script','python …/convert_unitree_json_to_lerobot.py',856,205,360,28,14.4,{raw:true});
    T(s,'convert-options','--raw-dir datasets/raw\n--repo-id local/g1_box_v1\n--robot-type Unitree_G1_Dex3',856,239,360,82,17,{raw:true,color:C.muted});
    T(s,'train-heading','多策略训练入口',856,338,360,30,22,{bold:true});
    T(s,'train-script','lerobot-train',856,377,360,28,19.5,{raw:true,color:C.blue});
    T(s,'train-options','--dataset.repo_id=local/g1_box_v1\n--policy.type=act\n--batch_size=8 --steps=10000',856,410,360,61,15.5,{raw:true,color:C.muted});
    const labels=['质量检查','数据转换','模型训练','仿真测试','真机部署'];
    const details=['文件 / 数值 / 时序\n回合预览与结果','Parquet + 视频 + meta\n关节顺序与动作语义','ACT / Diffusion / VLA\n数据、策略与训练配置','eval_g1_sim.py\n闭环成功与失败录像','eval_g1.py\n模型、统计量与控制器'];
    L(s,'process-line',149,517,1110,517,C.line,2.5);
    labels.forEach((label,i)=>{const x=149+i*240.25;D(s,'process-dot-'+i,x,517,6,C.blue);T(s,'process-label-'+i,label,x-110,535,220,31,21,{bold:true,alignment:'center'});T(s,'process-detail-'+i,details[i],x-110,577,220,46,16.8,{alignment:'center',color:C.muted});});
    T(s,'data-footnote','左右为独立官方样例。标准28维仅含臂手，移动搬箱另需腰部、移动目标与匹配的行走 / WBC。',64,476,1152,26,17.1,{color:C.muted});
  },
  augmentation(s){
    nativeTable(s,[['方法与产出','可增加的变化','工具与公开研究'],
      ['训练输入变换\n新观察','亮度、对比、色温、阴影、噪声、模糊与压缩\n裁剪、小幅仿射，可在读取时自写变换','LeRobot / torchvision\n图像与解码视频帧'],
      ['三维场景重渲染\n新视图与标注','灯光、HDR背景、材质纹理、相机位置\n输出RGB、深度、分割等视觉数据','Isaac Sim\nOmniverse Replicator'],
      ['场景与动力学变化\n新的执行回合','箱体位置、尺寸、质量、摩擦、机器人初态\n重新执行任务并记录state/action','Isaac Lab事件与域随机化\n匹配控制器或已有策略'],
      ['示范轨迹扩增\n新动作示范','子任务分段、相对物体轨迹迁移与组合\n规划连接、双臂协同与灵巧操作','MimicGen / Isaac Lab Mimic / SkillGen\nDexMimicGen（研究）'],
      ['生成式外观扩增\n新图像或视频','改变背景、纹理、干扰物\n以深度、边缘、分割等结构条件约束变化','GenAug / ROSIE（研究）\nCosmos视频迁移'],
      ['世界模型生成行为\n推断动作候选','图像与任务生成视频，再以IDM提取动作\n或使用已适配的世界动作模型','GR00T-Dreams / DreamGen（研究）\nCosmos 3匹配本体示例']],64,164,1152,431,[200,550,402],18.3);
    T(s,'real-coverage','补充真实覆盖：多场景补采、失败恢复、专家介入 / DAgger。语言条件配方可扩充任务表述。',64,608,1152,26,18,{color:C.blue});
  },
  async external(s){
    await IMG(s,'artifacts/report/resources/box_case/frame_09s.jpg',64,171,310,175,'Arena公开示范视频第9秒截图，不是本项目模型闭环结果');
    T(s,'arena-caption','Arena G1：取箱、携带与放置',64,360,310,57,21,{bold:true});
    textLink(s,'arena-case','查看示范与实际字段 ↗','resources/box_case/index.html',64,418,310,18);
    nativeTable(s,[['候选与格式','实际内容','使用前判断'],
      ['Arena G1\nLeRobot v2.1 / HDF5','G1仿真搬箱\n配套模型、环境和控制器','优先复现完整路线\n核对上身与WBC接口'],
      ['宇树 Plastic Box Parts\nLeRobot v3','G1 + BrainCo\n从箱内取零件到货架','名称含box仍需看任务\n核对手型与动作定义'],
      ['DROID\nRLDS / TFRecord及原始包','Franka单臂操作大库\nHDF5 + MP4 / SVO','按任务筛相关回合\n跨本体还需额外适配']],414,171,802,243,[270,259,273],17.5);
    T(s,'arena-range','Arena 整仓约24GB，LeRobot子树约298MB。本次先取约3MB单回合样本。',414,429,802,32,19.5,{color:C.blue,bold:true});
    T(s,'get-heading','选取与获取',64,492,548,32,24,{bold:true});
    T(s,'get-details','先读任务、本体、阶段、格式与许可元信息\n看代表回合，验证读取和必要转换\n选定回合与分片，下载后保留来源与原件',64,539,548,86,19.6);
    T(s,'purchase-heading','采购约定与验收',665,492,551,32,24,{bold:true});
    T(s,'purchase-details','约定任务覆盖及图像、实际状态、动作目标\n先试采或交样本，必要转换后做任务验证\n按有效回合、用途、来源和整改责任交付',665,539,551,86,19.6);
  }
};
for(const item of config.pages){
  const s=p.slides.add(); title(s,item.title,item.subtitle); await renderers[item.contentPage](s);
  if(item.sources.length)sources(s,item.sources,'');
  notes(s,item); s.speakerNotes.text='精讲口述（约'+item.talkSeconds+'秒）\n\n'+item.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;
  for(const el of [...s.shapes.items]){
    const name=el.name??el.toSnapshot().name??'';
    if(name==='content-page'){el.delete();continue;}
    if(name==='title')el.position={...el.position,left:1.1*96/2.54,top:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(name==='subtitle')el.position={...el.position,left:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(/^(source-prefix|source-\d+)$/.test(name))el.position={...el.position,top:item.contentPage==='capture'?644:638};
  }
}
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(attempt,'candidate.pptx'); await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,'具身智能数据管线报告_v17.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:5,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(attempt,'validation.json')});
await fs.copyFile(path.join(attempt,'validation.json'),path.join(build,'validation.json'));
console.log(JSON.stringify({finalPath,slides:5,totalPlanned:8,schemePages:'pending discussion',layoutFindings:result.presentationLayout.findingCount},null,2));
