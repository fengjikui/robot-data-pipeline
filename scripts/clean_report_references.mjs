import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PIN,LEROBOT,PresentationFile,FileBlob,finalizePresentation,replaceSources} from './report_common.mjs';

const revision='v4';
const build=path.join(ROOT,'.build/full-report',revision);await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v3.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(original));
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
const byPage=new Map(overrides.map(x=>[x.contentPage,x]));
const boundaryByPage=new Map();
for(const f of ['pages03_04.json','pages05_11.json','pages12_14_19_21.json','pages15_18.json'])for(const d of JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts',f),'utf8')))boundaryByPage.set(d.contentPage,(d.boundaries??[]).filter(x=>!/本页只引用|artifacts\/|docs\//.test(x)));
const short=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/short_scripts.json'),'utf8'));
const firstRefs=[{label:'宇树 xr_teleoperate',url:PIN+'README.md',kind:'upstream'},{label:'宇树 unitree_lerobot',url:LEROBOT+'README.md',kind:'upstream'}];
const deviceRefs=[{label:'宇树设备清单',url:PIN+'Device.md',kind:'upstream'},{label:'遥操作 README',url:PIN+'README.md',kind:'upstream'},{label:'官方网络说明',url:'https://github.com/unitreerobotics/xr_teleoperate/wiki/CycloneDDS-and-UnitreeSDK-%28en%29#42-unitree-robot-development',kind:'upstream'},{label:'状态订阅源码',url:PIN+'teleop/robot_control/robot_arm.py#L97-L109',kind:'upstream'}];
for(const [i,s]of p.slides.items.entries()){
  const item=i>=3?byPage.get(i):null;
  const refs=i===0?[]:i===1?firstRefs:i===2?deviceRefs:item.sources;
  replaceSources(s,refs,i===0?'目录':i);
  if(i===0)s.speakerNotes.text=short.toc;
  else if(item){
    const heading=refs.length?'扩展讲稿与原始出处':'扩展讲稿';
    const boundary=boundaryByPage.get(i)??[];
    s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+item.shortScript+'\n\n'+heading+'\n\n'+item.speakerNotes.replaceAll('M3 真机验收完成后','完成受限真机验收后')+(boundary.length?'\n\n讲述边界\n'+boundary.join('\n'):'');
  }
}
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v4.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:22,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const r=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision],{cwd:ROOT,stdio:'inherit',env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
if(r.status!==0)throw new Error('Reference cleanup preview failed');
await fs.copyFile(finalPath,original);
console.log('Cleaned self-citations; source-free slides:',[0,...overrides.filter(x=>!x.sources.length).map(x=>x.contentPage)].map(x=>x===0?1:x+1));
