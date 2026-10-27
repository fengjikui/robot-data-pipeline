import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,SKILL,RUNTIME,FONT,C,T,L,B,D,IMG,title,rail,table,sources,notes,Presentation,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';

const revision='v16',build=path.join(ROOT,'.build/full-report',revision),out=path.join(ROOT,'artifacts/report');
await fs.mkdir(build,{recursive:true});const attempt=path.join(build,'attempt-'+Date.now());await fs.mkdir(attempt);
const input=path.join(out,'具身智能数据管线报告_v15.pptx');
const original=await PresentationFile.importPptx(await FileBlob.load(input));
const proto=original.toProto();proto.slides=[];
const p=Presentation.load(proto);
const config=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v16.json'),'utf8'));
const link=(s,name,label,url,x,y,w,size=19)=>{const t=T(s,name,label,x,y,w,28,size,{color:C.blue,raw:true});t.text.get(label).link={uri:url,isExternal:true};return t;};
function denseTable(s,values,x,y,w,h,widths,size=19,inset=6){
  const t=table(s,values,x,y,w,h,widths,size);
  for(let r=0;r<values.length;r++)for(let c=0;c<values[0].length;c++)t.getCell(r,c).text.style={typeface:FONT,fontSize:size,bold:r===0,color:r===0?C.ink:C.muted,alignment:'left',verticalAlignment:'middle',insets:inset,wrap:'square',autoFit:'none'};
  return t;
}
const renderers={
  async capture_compact(s){
    await IMG(s,'assets/report_slide02/official_teleop_diagram.png',64,181,143,80,'Vision Pro：宇树官方设备图原生裁剪',{left:1750/3415,top:65/2465,right:1-1975/3415,bottom:1-190/2465});
    T(s,'vision-label','Vision Pro',64,267,155,31,21,{bold:true});
    const svg=(await fs.readFile(path.join(ROOT,'assets/report_icons/lucide-0.468.0/laptop.svg'),'utf8')).replaceAll('currentColor',C.ink);
    s.images.add({svg,alt:'Host电脑，Lucide现有图标',fit:'contain',position:{left:80,top:335,width:105,height:73}});
    T(s,'host-label','Host',80,412,110,28,21,{bold:true});
    await IMG(s,'assets/report_slide02/official_start_pose.png',290,170,220,295,'宇树官方G1启动姿态原图，非生成图');
    B(s,'pc2',374,259,86,34,C.pale,C.blue);T(s,'pc2-label','PC2',374,261,86,30,21,{bold:true,color:C.blue,alignment:'center'});
    B(s,'pc1',374,303,86,29,C.soft,C.line);T(s,'pc1-label','运控 PC1',374,303,86,29,16,{color:C.muted,alignment:'center'});
    L(s,'wifi-a',207,221,248,221,C.muted,1.6,true);L(s,'wifi-b',248,221,248,368,C.muted,1.6,true);L(s,'wifi-c',185,368,248,368,C.muted,1.6,true);
    T(s,'wireless-label','Wi-Fi',208,283,82,27,17,{color:C.muted});
    L(s,'ethernet-a',185,391,280,391,C.blue,2.3);L(s,'ethernet-b',280,391,280,296,C.blue,2.3);L(s,'ethernet-c',280,296,344,296,C.blue,2.3);
    L(s,'network-bus',344,276,344,318,C.blue,1.6);L(s,'network-pc2',344,276,374,276,C.blue,1.6);L(s,'network-pc1',344,318,374,318,C.blue,1.6);
    T(s,'wired-label','网线 / 机器人交换网络',194,432,348,28,18,{color:C.blue});
    D(s,'camera',411,202,4,C.blue);L(s,'camera-leader',416,202,472,202,C.line,1.1);T(s,'camera-caption','相机',478,188,87,28,18);
    D(s,'joint',430,344,5,C.muted);L(s,'joint-leader',436,344,481,371,C.line,1.1);T(s,'joint-caption','关节与反馈',470,378,118,29,18);
    L(s,'figure-divider',590,170,590,487,C.line,1);
    const deviceTable=denseTable(s,[['设备','运行什么','负责什么'],['机内 PC2','teleimager-server','读相机、发布图像'],['Host','teleop_hand_and_arm.py','追踪、IK、控制\n按回合记录与保存'],['Vision Pro','Safari / WebXR','头手追踪与机器人视角'],['运控 / 关节','厂商SDK与状态服务','执行目标、发布实际状态']],620,171,596,280,[105,250,241],18.4,6);
    deviceTable.getCell(2,1).text.style={typeface:FONT,fontSize:15.8,color:C.muted,alignment:'left',verticalAlignment:'middle',insets:6,wrap:'none',autoFit:'none'};
    T(s,'state-direction','追踪→Host→关节目标；图像和实际反馈→Host→回合保存。\n实际反馈由Host直接订阅，不需PC2转发。',620,466,596,45,18,{color:C.muted});
    rail(s,['基础状态检查','PC2 图像服务','Host 主程序','头显 XR 会话','随动 / 录制保存'],150,537,960,{size:20,labelHeight:31});
    T(s,'capture-note','外观为官方图；机内方框表示功能关系。准备、随动、录制、保存分别确认，命令见讲稿。',64,608,1152,23,16.5,{color:C.muted});
  },
  async data_compact(s){
    T(s,'raw-heading','原始回合：JSON + 图像',64,166,504,37,26,{bold:true});
    T(s,'raw-sub','官方历史测试回合 episode_0006',64,205,504,24,17.5,{color:C.muted});
    await IMG(s,'artifacts/report/resources/raw/episode_0006/colors/000000_color_0.jpg',64,240,164,123,'官方原始回合color_0首帧，历史测试样本');
    T(s,'raw-photo-label','167条、两路图像\nstate / action / task',64,369,170,40,16.5,{color:C.muted});
    await IMG(s,'artifacts/report/resources/data_cards/raw_excerpt.png',242,232,326,183,'原始JSON真实值排版节选，原件未改写',{left:0,top:0,right:0,bottom:.1});
    T(s,'target-heading','训练格式：LeRobot',712,166,504,37,26,{bold:true,color:C.blue});
    T(s,'target-sub','独立 ToastedBread 官方样例，非左侧实际转换结果',712,205,504,24,17.5,{color:C.muted});
    await IMG(s,'artifacts/report/resources/data_cards/lerobot_excerpt.png',712,232,504,183,'官方LeRobot元数据及真实Parquet行节选',{left:0,top:0,right:0,bottom:.22});
    L(s,'convert-direction',599,318,680,318,C.blue,2.3,false,true);
    T(s,'format-only','格式示意',589,282,102,25,17,{color:C.muted,alignment:'center'});
    link(s,'open-raw','放大节选 / 查看完整原始 JSON ↗','resources/data_cards.html#raw',64,420,504,19);
    link(s,'open-lerobot','放大节选 / 查看 LeRobot 数值与 meta ↗','resources/data_cards.html#lerobot',712,420,504,19);
    denseTable(s,[['原始记录','LeRobot字段','对应含义'],['states.*.qpos','observation.state（标准配方28维）','实际关节反馈'],['actions.*.qpos','action（标准配方28维）','记录的控制目标']],64,459,1152,96,[260,450,442],18.8,4);
    T(s,'convert-command','python unitree_lerobot/utils/convert_unitree_json_to_lerobot.py \\\n  --raw-dir datasets/raw --repo-id local/g1_box_v1 --robot-type Unitree_G1_Dex3',64,575,1152,47,18.2,{raw:true});
  },
  tools_compact(s){
    denseTable(s,[['环节','关键工作','现有工具 / 接口','留下什么'],['质量检查','文件/数值、时间关系、动作含义\n预览任务阶段、成功与失败','规则脚本 / 回合预览\n关键片段人工复核','问题回合清单\n保留、补标或补采'],['模型训练','ACT、Diffusion、π0/π0.5、GR00T\n读取、时间窗、归一化与训练配置','lerobot-train\n--dataset.repo_id / --policy.type','checkpoint、统计量\n日志与数据划分'],['仿真测试','根据环境当前反馈闭环执行\n统计成功率，保留失败录像','eval_g1_sim.py（宇树）\npolicy_runner.py（Arena）','闭环结果与视频\n对应场景和配置'],['真机部署','匹配本体、相机和动作解释\n执行并记录实际状态与接管','eval_g1.py / SDK与运控\n模型 + 统计量 + 运行配置','执行回合与失败样本\n补采和迭代依据']],64,170,1152,300,[150,384,400,218],18.7,6);
    T(s,'shared-trainer','同一个训练入口，用参数选择策略与配方',64,490,1152,34,24,{bold:true,color:C.blue});
    T(s,'training-command','lerobot-train --dataset.repo_id=local/g1_box_v1 --policy.type=act --batch_size=8 --steps=10000',64,535,1152,32,18.5,{raw:true});
    B(s,'wholebody-note',64,591,1152,37,C.soft);T(s,'wholebody-text','移动搬箱：标准28维只含臂手；补录腰部和移动目标，并复用匹配的行走 / WBC 控制。',76,594,1128,30,19,{color:C.muted});
  },
  augmentation_compact(s){
    const values=[['方法与产出','可增加的变化','工具 / 公开研究'],
      ['训练输入变换\n输出：新观察','亮度、对比、色温、阴影；噪声、模糊、压缩\n裁剪、平移、小幅仿射，也可自写变换','LeRobot / torchvision\n按图像或解码视频帧处理'],
      ['三维场景重渲染\n输出：新视图与标注','改变灯光、HDR背景、材质纹理、相机位置\n重新输出RGB、深度、分割等视觉数据','Isaac Sim\nOmniverse Replicator'],
      ['场景 / 动力学变化\n输出：执行回合','改变箱体位置、尺寸、质量、摩擦和机器人初态\n重新执行交互，记录state/action','Isaac Lab事件与域随机化\n匹配任务控制器 / 策略'],
      ['示范轨迹扩增\n输出：新动作示范','子任务分段、相对物体位姿迁移、轨迹组合\n规划连接、双臂协同与灵巧操作扩展','MimicGen / Isaac Lab Mimic / SkillGen\nDexMimicGen（研究方法）'],
      ['生成式外观扩增\n输出：图像 / 视频','改变背景、纹理和干扰物\n用深度、边缘、分割等结构条件控制视频变化','GenAug / ROSIE（研究）\nCosmos视频迁移 / 世界模型'],
      ['世界模型生成行为\n输出：推断动作候选','图像与指令生成任务视频，再以IDM提取动作\n或使用已适配的世界动作模型','GR00T-Dreams / DreamGen（研究管线）\nCosmos 3匹配本体示例']];
    denseTable(s,values,64,167,1152,426,[200,540,412],18.5,6);
    T(s,'real-coverage','补充覆盖：多场景补采、失败恢复、专家介入 / DAgger；语言条件配方可扩充任务表述。',64,605,1152,27,18.8,{color:C.blue});
  },
  external_compact(s){
    denseTable(s,[['真实候选','格式与实际内容','本轮如何看待'],['Arena G1 搬箱','LeRobot v2.1 / HDF5\n仿真取箱、移动、放置','配套数据、模型和仿真路线\n优先复现'],['宇树 Plastic Box Parts','LeRobot v3，G1 + BrainCo\n从箱内取零件到货架','名称含box\n需核对实际任务与手型'],['DROID','RLDS / TFRecord，另有原始包\nHDF5轨迹 + MP4 / SVO','Franka单臂操作大库\n按任务筛预训练候选']],64,170,1152,224,[250,490,412],18.5,6);
    T(s,'range-example','Arena 整仓约24GB；LeRobot子树约298MB；先取约3MB单回合样本，再决定训练范围。',64,411,1152,37,21,{bold:true,color:C.blue});
    T(s,'purchase-heading','采购先约定',64,474,552,34,24,{bold:true});
    T(s,'purchase-details','任务、本体、阶段覆盖及同步图像 / 状态 / 目标\n先用样本读取、必要转换和任务评价\n再约定有效数量、用途、来源与整改责任',64,519,552,96,20);
    T(s,'catalog-heading','导入后持续维护',664,474,552,34,24,{bold:true});
    T(s,'catalog-details','来源版本、许可、实际持有与可获取范围\n按任务、本体、阶段和质量建立目录索引\n用回合清单关联处理、训练和评价结果',664,519,552,96,20);
  }
};

for(const item of config.pages){
  const s=p.slides.add();title(s,item.title,item.subtitle);await renderers[item.contentPage](s);sources(s,item.sources,'');notes(s,item);
  s.speakerNotes.text='精讲口述（约'+item.talkSeconds+'秒）\n\n'+item.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;
  for(const el of [...s.shapes.items]){
    const name=el.name??el.toSnapshot().name??'';
    if(name==='content-page'){el.delete();continue;}
    if(name==='title')el.position={...el.position,left:1.1*96/2.54,top:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(name==='subtitle')el.position={...el.position,left:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(/^(source-prefix|source-\d+)$/.test(name))el.position={...el.position,top:638};
  }
}
if(p.slides.items.length!==5)throw new Error('Only the5authorized background slides are authored');
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(attempt,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,'具身智能数据管线报告_v16.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:5,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'reference',families:[FONT],referencePath:input,referenceSha256:createHash('sha256').update(await fs.readFile(input)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(attempt,'validation.json')});
await fs.copyFile(path.join(attempt,'validation.json'),path.join(build,'validation.json'));
console.log(JSON.stringify({finalPath,backgroundSlides:5,eventualReportLimit:8,schemeStatus:'pending discussion; no workbench implementation change',layoutFindings:result.presentationLayout.findingCount},null,2));
