import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Local PowerPoint authoring through the bundled Artifact Tool runtime.
const root = '/Users/fengjikui/Documents/dev-coding/codex_build/robot_data_pipeline';
const skill = '/Users/fengjikui/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations';
const runtime = '/Users/fengjikui/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES = path.join(runtime, 'node/node_modules');
const { importRuntimeModule } = await import(pathToFileURL(path.join(skill, 'container_tools/runtime_helpers.mjs')));
const { GlobalFonts } = await importRuntimeModule('@napi-rs/canvas');
GlobalFonts.registerFromPath(path.join(root, 'artifacts/docx_fonts/HeitiSC.ttf'));
const font = 'Heiti SC';
if (!GlobalFonts.families.some(item => item.family === font)) throw new Error('Chinese font not available: ' + font);
const { Presentation, PresentationFile, FileBlob } = await importRuntimeModule('@oai/artifact-tool');
const { finalizePresentation } = await import(pathToFileURL(path.join(skill, 'container_tools/artifact_tool_utils.mjs')));

const revision = process.argv[2] || 'v4';
if (!/^v\d+$/.test(revision)) throw new Error('Use a revision such as v1');
const build = path.join(root, '.build/report-slides', revision);
const output = path.join(root, 'artifacts/report');
const previews = path.join(output, 'previews');
await fs.mkdir(build, { recursive: true });
await fs.mkdir(previews, { recursive: true });
const finalPath = path.join(output, `01_搬箱任务与数据管线全貌_${revision}.pptx`);
const previewPath = path.join(previews, `slide01_${revision}.png`);

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
p.theme.defaultFont = font;
p.theme.colorScheme = {
  name: 'Technical report timeline',
  themeColors: {
    accent1:'#B4232A',accent2:'#3C7FAE',accent3:'#EAF3FA',accent4:'#C4D8E8',accent5:'#607F96',accent6:'#F3F7FA',
    bg1:'#FFFFFF',bg2:'#F3F7FA',tx1:'#243444',tx2:'#607080',dk1:'#152330',dk2:'#3A5266',lt1:'#FFFFFF',lt2:'#EAF3FA',
    hlink:'#426F91',folHlink:'#426F91',
  },
};
const slide = p.slides.add();
slide.background.fill = 'bg1';
function text(name, value, x, y, w, h, size, extra={}) {
  const s=slide.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  s.text=value;
  s.text.style={typeface:font,fontSize:size,color:'tx1',insets:0,alignment:'left',verticalAlignment:'middle',wrap:'none',autoFit:'none',...extra};
  return s;
}
function line(name,x,y,w,h=0,color='#C4D8E8',width=2){
  return slide.shapes.add({geometry:'line',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:color,width}});
}
function circle(name,cx,cy,size,fill='#EAF3FA',stroke='#C4D8E8',dashed=false){
  return slide.shapes.add({geometry:'ellipse',name,position:{left:cx-size/2,top:cy-size/2,width:size,height:size},fill,line:{fill:stroke,width:dashed?2.2:1.3,style:dashed?'dashed':'solid'}});
}
const iconDir=path.join(root,'assets/report_icons/lucide-0.468.0');
const iconNames=['hand','footprints','package-check','clipboard-check','wand-sparkles','file-cog','brain-circuit','monitor-play','bot','gamepad-2','database'];
const iconSources=Object.fromEntries(await Promise.all(iconNames.map(async name=>[name,await fs.readFile(path.join(iconDir,name+'.svg'),'utf8')])));
function icon(name,kind,cx,cy,size=28,color='#3C7FAE'){
  // Recolor an official, attributed SVG asset without changing its geometry.
  const svg=iconSources[kind].replaceAll('currentColor',color).replace('width="24"','width="192"').replace('height="24"','height="192"');
  return slide.images.add({svg,alt:name,fit:'contain',position:{left:cx-size/2,top:cy-size/2,width:size,height:size}});
}

text('report-title','具身智能数据管线',64,46,1110,60,43,{bold:true,color:'accent1'});
text('task-subtitle','以 G1 搬箱任务为例：从桌 A 搬到桌 B',64,115,1110,40,26,{color:'tx2'});

// Editable milestone rails, with sourced icons above the labels.
line('task-timeline',160,222,960,0,'#C4D8E8',2.5);
for(const [cx,kind,label,detail] of [
  [160,'hand','桌 A 取箱','识别位置，双手抓取'],
  [640,'footprints','抱持移动','携箱行走，维持稳定'],
  [1120,'package-check','桌 B 放箱','对准位置，放稳松手'],
]){
  circle(label+'-milestone',cx,222,66,'#EAF3FA','#C4D8E8');
  icon(label,kind,cx,222,32);
  text(label+'-label',label,cx-132,267,264,42,29,{bold:true,alignment:'center'});
  text(label+'-detail',detail,cx-150,313,300,30,21,{color:'tx2',alignment:'center'});
}

text('pipeline-label','数据流程',64,373,1100,35,24,{bold:true});
icon('遥操作采集','gamepad-2',78,442,27);
text('self-capture','自己采集',104,425,168,32,23);
text('self-capture-detail','真机或仿真遥操作',104,458,173,26,17,{color:'tx2'});
icon('外部数据','database',78,516,27);
text('external-data','外部数据',104,499,168,32,23);
text('external-detail','开源数据集或采购',104,532,173,26,17,{color:'tx2'});

line('source-1-join',269,442,31,0,'#A8C3D9',1.6);
line('source-2-join',269,516,31,0,'#A8C3D9',1.6);
line('source-join',300,442,0,74,'#A8C3D9',1.6);
line('processing-timeline',300,480,845,0,'#BCD3E4',2.5);
const stages=[
  [355,'clipboard-check','质量检查'],
  [513,'wand-sparkles','数据增强'],
  [671,'file-cog','数据转换'],
  [829,'brain-circuit','模型训练'],
  [987,'monitor-play','仿真评估'],
  [1145,'bot','真机部署'],
];
for(const [i,[cx,kind,label]] of stages.entries()){
  const optional=kind==='wand-sparkles';
  const highlighted=kind==='brain-circuit';
  text(label+'-ordinal',String(i+1).padStart(2,'0'),cx-30,420,60,24,16,{color:'tx2',alignment:'center'});
  circle(label+'-milestone',cx,480,58,highlighted?'#DCECF7':optional?'#F5F9FC':'#EAF3FA',highlighted?'#6596BA':optional?'#7295B0':'#A9C6DC',optional);
  icon(label,kind,cx,480,29,highlighted?'#286991':'#3C7FAE');
  text(label+'-label',label,cx-70,522,140,34,23,{bold:highlighted,alignment:'center',color:highlighted?'#286991':'tx1'});
}
text('optional-augmentation','按需',453,558,120,26,17,{color:'tx2',alignment:'center'});
text('task-status','搬箱为贯穿示例，移动与操作能力需分别验证。',64,602,1120,28,18,{color:'tx2'});

const xr='https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/README.md';
const lr='https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/README.md';
const refs=text('slide-sources','资料：宇树 xr_teleoperate、unitree_lerobot。流程为本报告整理。',64,638,930,24,15,{color:'tx2'});
refs.text.get('xr_teleoperate').link={uri:xr,isExternal:true};
refs.text.get('unitree_lerobot').link={uri:lr,isExternal:true};
const iconCredit=text('icon-credit','图标：Lucide',1040,638,175,24,15,{color:'tx2',alignment:'right'});
iconCredit.text.get('Lucide').link={uri:'https://lucide.dev/license',isExternal:true};

const md=await fs.readFile(path.join(root,'docs/report/05_第01页内容与讲稿.md'),'utf8');
const script=md.split('## 演讲稿\n')[1].split('\n## 版面与展示')[0].trim();
const sources=md.split('## 原始资料与边界\n')[1].split('\n关于背景替换：')[0].trim();
const iconLicense=await fs.readFile(path.join(iconDir,'LICENSE'),'utf8');
const featherLicense=await fs.readFile(path.join(iconDir,'FEATHER_LICENSE'),'utf8');
slide.speakerNotes.text=script+'\n\n原始资料与边界\n'+sources+'\n\n图标来源：Lucide 0.468.0，https://github.com/lucide-icons/lucide/tree/0.468.0/icons 。使用对应图标表达通用步骤，不代表设备实物照片。原始许可全文：\n'+iconLicense+'\n\n继承图标的 Feather 原始许可：\n'+featherLicense;

const candidatePath=path.join(build,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const result=await finalizePresentation({
  workspaceDir:root,candidatePath,finalPath,
  explicitTotalSlideCount:1,
  requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],
  pythonExecutable:path.join(runtime,'python/bin/python3'),
  integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--validate-bullet-geometry'],
  fontPolicy:{basis:'design',families:[font]},
  verifyArtifactToolImport:true,
  receiptPath:path.join(build,'validation.json'),
});
// Preview the validated file rather than an unexported in-memory version.
const saved=await PresentationFile.importPptx(await FileBlob.load(finalPath));
await fs.writeFile(previewPath,new Uint8Array(await (await saved.export({slide:saved.slides.items[0],format:'png',scale:1.5})).arrayBuffer()));
await fs.writeFile(path.join(build,'layout.json'),await (await saved.slides.items[0].export({format:'layout'})).text());
await fs.writeFile(path.join(build,'font_inventory.json'),JSON.stringify(GlobalFonts.families.filter(item=>/Heiti|Hiragino|PingFang/.test(item.family)),null,2));
console.log(JSON.stringify({finalPath,previewPath,packagePassed:result.packageIntegrity.status,layoutFindings:result.presentationLayout.findingCount},null,2));
