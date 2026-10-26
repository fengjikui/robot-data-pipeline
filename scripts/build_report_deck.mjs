import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,C,PIN,LEROBOT,Presentation,PresentationFile,FileBlob,finalizePresentation,approvedSlides,T,sources,notes,replaceSources} from './report_common.mjs';
import {page01,toc,renderers} from './report_layouts.mjs';
import {startupSupplement} from './report_startup_supplement.mjs';
import {externalIntakeRoutes} from './report_external_routes.mjs';
import {conversionPolicyContract} from './report_conversion_contract.mjs';

const revision=process.argv[2]||'v1';
if(!/^v\d+$/.test(revision))throw new Error('Expected a version v1, v2, ...');
if(Number(revision.slice(1))>=13)throw new Error('For v13 use scripts/refresh_workbench_solution.mjs; for v14 use scripts/revise_report_v14.mjs to preserve the confirmed source deck.');
const build=path.join(ROOT,'.build/full-report',revision);
const out=path.join(ROOT,'artifacts/report');
const previews=path.join(out,'full_'+revision);
await fs.mkdir(build,{recursive:true});await fs.mkdir(previews,{recursive:true});
const data=[];
for(const f of ['pages03_04.json','pages05_11.json','pages12_14_19_21.json','pages15_18.json'])data.push(...JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts',f),'utf8')));
data.sort((a,b)=>a.contentPage-b.contentPage);
if(data.length!==19||new Set(data.map(x=>x.contentPage)).size!==19)throw new Error('Incomplete content pages 3–21');
const short=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/short_scripts.json'),'utf8'));
let supplement;
let external,sequence,contract;
try{contract=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/conversion_policy_contract.json'),'utf8'));short[contract.contentPage]=contract.shortScript;}catch(e){if(e.code!=='ENOENT')throw e;}
try{external=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/external_intake_routes.json'),'utf8'));short[external.contentPage]=external.shortScript;sequence=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
try{supplement=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/capture_startup.json'),'utf8'));short[supplement.contentPage]=supplement.shortScript;}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
  for(const o of overrides){const i=data.findIndex(d=>d.contentPage===o.contentPage);if(i>=0)data[i]={...data[i],...o};short[String(o.contentPage)]=o.shortScript;}
}catch(e){if(e.code!=='ENOENT')throw e;}
const p=await approvedSlides();
const first=p.slides.items[0],devices=p.slides.items[1];
for(const el of [...first.shapes.items,...first.images.items])el.delete();
await page01(first);
replaceSources(first,[{label:'宇树 xr_teleoperate',url:PIN+'README.md'},{label:'宇树 unitree_lerobot',url:LEROBOT+'README.md'}],1);
replaceSources(devices,[{label:'宇树设备清单',url:PIN+'Device.md'},{label:'遥操作 README',url:PIN+'README.md'},{label:'官方网络说明',url:'https://github.com/unitreerobotics/xr_teleoperate/wiki/CycloneDDS-and-UnitreeSDK-%28en%29'},{label:'状态订阅源码',url:PIN+'teleop/robot_control/robot_arm.py#L97-L109'}],2);
const deviceOnly=Presentation.load(p.toProto());deviceOnly.slides.keep([1]);
const deviceCandidate=path.join(build,'devices-candidate.pptx');await(await PresentationFile.exportPptx(deviceOnly)).save(deviceCandidate);

const contents=p.slides.add();toc(contents,!!supplement,sequence?.chapters);sources(contents,[],'目录');contents.speakerNotes.text=short.toc;
p.slides.reorder([contents.id,first.id,devices.id].map(id=>id.startsWith('sl/')?id:'sl/'+id));
const metadata=[{contentPage:'toc',title:'报告内容',speakerNotes:contents.speakerNotes.text},{contentPage:1,title:'搬箱任务与数据管线全貌',speakerNotes:first.speakerNotes.text},{contentPage:2,title:'真机采集的设备分工',speakerNotes:devices.speakerNotes.text}];
for(const item of data){
  item.speakerNotes=item.speakerNotes.replaceAll('M3 真机验收完成后','完成受限真机验收后');
  const s=p.slides.add();await renderers[item.contentPage](s,item);sources(s,item.sources,item.contentPage);notes(s,item);
  metadata.push({...item,speakerNotes:s.speakerNotes.text});
  console.log('authored',item.contentPage,item.title);
  if(supplement&&item.contentPage===supplement.afterContentPage){
    const extra=p.slides.add();startupSupplement(extra,supplement);sources(extra,supplement.sources,'备查');notes(extra,supplement);metadata.push(supplement);
  }
}
if(external){const s=p.slides.add();externalIntakeRoutes(s,external);sources(s,external.sources,'13');notes(s,external);metadata.push(external);}
if(contract){const s=p.slides.add();conversionPolicyContract(s,contract);sources(s,contract.sources,'8');notes(s,contract);metadata.push(contract);}
for(let i=0;i<p.slides.items.length;i++){
  const s=p.slides.items[i],m=metadata[i];
  if(m.contentPage!=='toc')s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+short[String(m.contentPage)]+'\n\n'+(m.sources?.length===0?'扩展讲稿':'扩展讲稿与原始出处')+'\n\n'+s.speakerNotes.text;
}
if(sequence){
  const slidesByKey=new Map(metadata.map((m,i)=>[m.contentPage,p.slides.items[i]]));
  const metadataByKey=new Map(metadata.map(m=>[m.contentPage,m]));
  p.slides.reorder(sequence.contentOrder.map(k=>{const id=slidesByKey.get(k).id;return id.startsWith('sl/')?id:'sl/'+id;}));
  metadata.splice(0,metadata.length,...sequence.contentOrder.map(k=>metadataByKey.get(k)));
  let page=0;for(let i=0;i<metadata.length;i++){
    const key=metadata[i].contentPage,label=key==='toc'?'目录':key==='capture_startup'?'备查':++page;
    const footer=p.slides.items[i].shapes.items.find(x=>x.name==='content-page');if(footer)footer.text=String(label);
  }
}
const slideCount=22+(supplement?1:0)+(external?1:0)+(contract?1:0);
if(p.slides.items.length!==slideCount)throw new Error('Unexpected total slide count');
const nativeOwners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,`具身智能数据管线报告_${revision}.pptx`);
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:slideCount,requiredNativeTableOwnerSlides:nativeOwners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--validate-bullet-geometry',...nativeOwners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const deviceFinal=path.join(out,`02_真机采集的设备分工_页脚与配色版_${revision}.pptx`);
await finalizePresentation({workspaceDir:ROOT,candidatePath:deviceCandidate,finalPath:deviceFinal,explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'devices-validation.json')});
// Render in fresh sequential workers so WASM image memory is released per batch.
const previewResult=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision],{cwd:ROOT,stdio:'inherit',env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
if(previewResult.status!==0)throw new Error('Preview finalization failed');
console.log(JSON.stringify({finalPath,deviceFinal,slideCount,packageStatus:result.packageIntegrity.status,layoutFindings:result.presentationLayout.findingCount},null,2));
