import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root='/Users/fengjikui/Documents/dev-coding/codex_build/robot_data_pipeline';
const skill='/Users/fengjikui/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations';
const runtime='/Users/fengjikui/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=path.join(runtime,'node/node_modules');
const {importRuntimeModule}=await import(pathToFileURL(path.join(skill,'container_tools/runtime_helpers.mjs')));
const {GlobalFonts}=await importRuntimeModule('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(root,'artifacts/docx_fonts/HeitiSC.ttf'));
const font='Heiti SC';
if(!GlobalFonts.families.some(item=>item.family===font))throw new Error('Chinese font unavailable');
const {Presentation,PresentationFile,FileBlob}=await importRuntimeModule('@oai/artifact-tool');
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')));
const revision=process.argv[2]||'v3';
if(!/^v\d+$/.test(revision))throw new Error('Expected v1, v2, ...');
const build=path.join(root,'.build/report-slide02',revision);
const out=path.join(root,'artifacts/report');
const previews=path.join(out,'previews');
await fs.mkdir(build,{recursive:true});
await fs.mkdir(previews,{recursive:true});
const finalPath=path.join(out,`02_真机采集的设备分工_${revision}.pptx`);
const previewPath=path.join(previews,`slide02_${revision}.png`);
const p=Presentation.create({slideSize:{width:1280,height:720}});
p.theme.defaultFont=font;
p.theme.colorScheme={name:'Technical report equipment baseline',themeColors:{
  accent1:'#B4232A',accent2:'#216D7A',accent3:'#E9F2F3',accent4:'#A2B6BF',accent5:'#667184',accent6:'#F5F7F8',
  bg1:'#FFFFFF',bg2:'#F5F7F8',tx1:'#20292F',tx2:'#63717A',dk1:'#111A20',dk2:'#39464E',lt1:'#FFFFFF',lt2:'#E9F2F3',
  hlink:'#3C6677',folHlink:'#3C6677',
}};
const slide=p.slides.add();
slide.background.fill='bg1';
function text(name,value,x,y,w,h,size=22,extra={}){
  const s=slide.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  s.text=value;
  s.text.style={typeface:font,fontSize:size,color:'tx1',insets:0,alignment:'left',verticalAlignment:'middle',wrap:'none',autoFit:'none',...extra};
  return s;
}
function line(name,x1,y1,x2,y2,color='#A2B6BF',width=1.5,dashed=false){
  const s=slide.shapes.add({geometry:'line',name,position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)},fill:'none',line:{fill:color,width,style:dashed?'dashed':'solid'}});
  return s;
}
function dot(name,x,y,size=7,color='#216D7A'){
  return slide.shapes.add({geometry:'ellipse',name,position:{left:x-size/2,top:y-size/2,width:size,height:size},fill:color,line:{fill:'#FFFFFF',width:1.5}});
}
function ring(name,x,y,size=20,color='#216D7A'){
  return slide.shapes.add({geometry:'ellipse',name,position:{left:x-size/2,top:y-size/2,width:size,height:size},fill:'none',line:{fill:color,width:1.8}});
}
const iconDir=path.join(root,'assets/report_icons/lucide-0.468.0');
const sources=Object.fromEntries(await Promise.all(['laptop','router','camera','cpu'].map(async name=>[name,await fs.readFile(path.join(iconDir,name+'.svg'),'utf8')])));
function icon(name,kind,x,y,w=44,color='#216D7A'){
  const svg=sources[kind].replaceAll('currentColor',color).replace('width="24"','width="256"').replace('height="24"','height="256"');
  return slide.images.add({svg,alt:name,fit:'contain',position:{left:x,top:y,width:w,height:w}});
}
function chip(name,label,x,y,w,h,color){
  const s=slide.shapes.add({geometry:'roundRect',name,position:{left:x,top:y,width:w,height:h},fill:'#F3F8F9',borderRadius:5,line:{fill:color,width:1.6}});
  s.text=label;
  s.text.style={typeface:font,fontSize:label==='PC2'?22:16,color,alignment:'center',verticalAlignment:'middle',insets:0,wrap:'none',autoFit:'none',bold:true};
  return s;
}

text('slide-title','真机采集的设备分工',64,42,1150,56,40,{bold:true,color:'accent1'});
text('slide-subtitle','外部 Host 负责遥操作与记录，机内感知与运动执行各有分工',64,108,1150,34,23,{color:'tx2'});

// Network connections are distinct from the narrow grey annotation leaders.
// Dashed segments show reachable Wi-Fi/LAN, not a prescribed AP port topology.
line('avp-wifi',211,233,365,233,'#7B9BA5',2,true);
line('ap-lan-horizontal',415,233,500,233,'#7B9BA5',2,true);
line('ap-lan-vertical',500,233,500,468,'#7B9BA5',2,true);
line('host-ethernet',207,468,583,468,'#216D7A',3);
line('ethernet-to-robot',583,468,583,306,'#216D7A',3);
line('robot-ethernet-port',583,306,697,306,'#216D7A',3);

// Vision Pro artwork from Unitree's official system diagram, cropped in PPT.
slide.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'assets/report_slide02/official_teleop_diagram.png'))),contentType:'image/png',alt:'Apple Vision Pro，取自宇树官方遥操作设备图',fit:'contain',crop:{left:1750/3415,top:65/2465,right:1-1975/3415,bottom:1-190/2465},position:{left:64,top:189,width:143,height:80}});
text('avp-title','Apple Vision Pro',64,285,260,36,26,{bold:true});
text('avp-role','头手追踪、机器人视角',64,328,270,30,20,{color:'tx2'});

icon('无线接入点示意','router',366,200,50,'#607D88');
text('wifi-label','Wi-Fi / AP',319,273,190,30,22,{alignment:'center'});
text('wifi-scope','可访问 Host 与 PC2',290,311,240,28,18,{color:'tx2',alignment:'center'});

icon('外部 Host 主机示意','laptop',80,409,110,'#435C6A');
text('host-title','Host 外部主机',64,532,280,37,26,{bold:true});
text('host-role','动作映射、IK、数据记录',64,574,320,29,20,{color:'tx2'});
text('ethernet-label','网线',316,421,170,33,23,{color:'accent2',alignment:'center'});
text('ethernet-role','接入机器人交换网络',268,491,290,29,19,{color:'tx2',alignment:'center'});

slide.images.add({blob:new Uint8Array(await fs.readFile(path.join(root,'assets/report_slide02/g1_illustration_v1.png'))),contentType:'image/png',alt:'参考宇树官方 G1 / Dex3 外形生成的说明插图，非实机照片',fit:'contain',position:{left:580,top:148,width:330,height:495}});

// Editable functional overlay inside the torso. It does not represent mounting.
line('internal-network',697,278,697,320,'#216D7A',2.2);
line('internal-to-pc2',697,278,713,278,'#216D7A',2.2);
line('internal-to-pc1',697,320,713,320,'#216D7A',2.2);
chip('pc2-in-torso','PC2',713,259,78,40,'#216D7A');
chip('pc1-in-torso','运控 PC1',713,306,78,28,'#667184');
dot('external-ethernet-end',697,306,7,'#216D7A');

// Camera and joint callouts share a restrained baseline grid.
dot('head-camera-location',744,179,8,'#216D7A');
line('head-camera-leader',752,179,909,179,'#9EADB3',1.1);
text('head-camera-title','头部视角相机',929,163,288,35,25,{bold:true});
text('head-camera-role','提供第一视角图像',929,205,288,29,20,{color:'tx2'});

line('pc2-leader-1',791,279,907,279,'#9EADB3',1.1);
line('pc2-leader-2',907,279,907,306,'#9EADB3',1.1);
text('pc2-title','机内 PC2',929,290,288,36,26,{bold:true,color:'accent2'});
text('pc2-role','独立开发计算单元',929,333,288,29,20,{color:'tx2'});
text('pc2-service','本例运行相机服务',929,366,288,29,20,{color:'tx2'});

ring('elbow-feedback-location',813,315,20,'#667184');
ring('knee-feedback-location',788,489,19,'#667184');
line('joint-leader-1',825,315,887,315,'#9EADB3',1.1);
line('joint-leader-2',887,315,887,437,'#9EADB3',1.1);
line('joint-leader-3',887,437,909,437,'#9EADB3',1.1);
text('control-title','运控 PC1 与关节',929,420,288,36,25,{bold:true});
text('control-role','执行目标，反馈实际状态',929,463,288,29,20,{color:'tx2'});

icon('腕部相机选配位置','camera',804,368,20,'#216D7A');
line('wrist-camera-leader-1',827,379,865,379,'#9EADB3',1.1);
line('wrist-camera-leader-2',865,379,865,559,'#9EADB3',1.1);
line('wrist-camera-leader-3',865,559,909,559,'#9EADB3',1.1);
text('wrist-camera-title','腕部相机（选配）',929,542,288,35,24,{bold:true});
text('wrist-camera-role','补充近距离操作视角',929,584,288,28,19,{color:'tx2'});

text('illustration-scope','机内分区为功能示意，相机与手型以到货配置为准。',64,625,600,24,14.5,{color:'tx2'});
const pin='https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/';
const wiki='https://github.com/unitreerobotics/xr_teleoperate/wiki/CycloneDDS-and-UnitreeSDK-%28en%29#42-unitree-robot-development';
const references=text('page-sources','资料：宇树设备清单、遥操作 README、网络说明、状态订阅源码。配图参考宇树资料绘制。',64,652,1150,23,14.5,{color:'tx2'});
for(const [label,uri] of [['设备清单',pin+'Device.md'],['遥操作 README',pin+'README.md'],['网络说明',wiki],['状态订阅源码',pin+'teleop/robot_control/robot_arm.py#L97-L109']])references.text.get(label).link={uri,isExternal:true};

const md=await fs.readFile(path.join(root,'docs/report/06_第02页内容与讲稿.md'),'utf8');
const notes=md.split('## 演讲稿（含原始出处）\n')[1].split('\n## 版面与图示约定')[0].trim();
const iconLicense=await fs.readFile(path.join(iconDir,'LICENSE'),'utf8');
const featherLicense=await fs.readFile(path.join(iconDir,'FEATHER_LICENSE'),'utf8');
slide.speakerNotes.text=notes+'\n\n配图与制作来源：\nG1 外形参考 https://www.unitree.com/g1 和固定版 xr_teleoperate 官方示意，使用内置 image_gen 生成透明说明插图；图像不表示实机照片或精确内部装配。原始参考、SHA256、生成提示在 assets/report_slide02/。\nVision Pro 图取自上述官方仓库 README 的系统设备图，在本页原生裁剪。\nLucide 0.468.0 https://github.com/lucide-icons/lucide/tree/0.468.0/icons ，原始许可：\n'+iconLicense+'\n'+featherLicense;
const candidatePath=path.join(build,'candidate.pptx');
await(await PresentationFile.exportPptx(p)).save(candidatePath);
const result=await finalizePresentation({workspaceDir:root,candidatePath,finalPath,explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
  pythonExecutable:path.join(runtime,'python/bin/python3'),integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--validate-bullet-geometry'],fontPolicy:{basis:'design',families:[font]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const saved=await PresentationFile.importPptx(await FileBlob.load(finalPath));
await fs.writeFile(previewPath,new Uint8Array(await(await saved.export({slide:saved.slides.items[0],format:'png',scale:1.5})).arrayBuffer()));
await fs.writeFile(path.join(build,'layout.json'),await(await saved.slides.items[0].export({format:'layout'})).text());
console.log(JSON.stringify({finalPath,previewPath,integrity:result.packageIntegrity.status,layoutFindings:result.presentationLayout.findingCount},null,2));
