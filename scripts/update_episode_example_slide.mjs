import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,Presentation,PresentationFile,FileBlob,finalizePresentation,sources,notes} from './report_common.mjs';
import {page04} from './report_layouts.mjs';

const revision='v7',index=5,build=path.join(ROOT,'.build/full-report',revision);
await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v6.pptx');
const imported=await PresentationFile.importPptx(await FileBlob.load(original));
if(imported.slides.items.length!==23)throw new Error('Expected 23 slides including the startup supplement');
const proto=imported.toProto(),otherBefore=JSON.stringify(proto.slides.filter((_,i)=>i!==index));
if(!imported.slides.items[index].shapes.items.some(s=>String(s.text)==='一个回合里保存了什么'))throw new Error('Episode page is not at physical slide 6');
proto.slides[index].elements=[];
const p=Presentation.load(proto),s=p.slides.items[index];
const data=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/pages03_04.json'),'utf8'));
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
const d={...data.find(d=>d.contentPage===4),...overrides.find(d=>d.contentPage===4)};
await page04(s,d);sources(s,d.sources,4);notes(s,d);
s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+d.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;
if(JSON.stringify(p.toProto().slides.filter((_,i)=>i!==index))!==otherBefore)throw new Error('Unexpected change outside the episode slide');
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v7.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:23,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const next=path.join(ROOT,'artifacts/report/full_v7');await fs.mkdir(next,{recursive:true});
for(let i=1;i<=23;i++){
  const stem='page-'+String(i).padStart(2,'0');await fs.copyFile(path.join(ROOT,'artifacts/report/full_v6',stem+'.png'),path.join(next,stem+'.png'));
  for(const ext of ['.notes.txt','.layout.json'])await fs.copyFile(path.join(ROOT,'.build/full-report/v6',stem+ext),path.join(build,stem+ext));
}
const childEnv={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
const telemetry=spawnSync('/bin/zsh',[path.join(ROOT,'scripts/resource_snapshot.sh')],{encoding:'utf8'});await fs.writeFile(path.join(build,'resource-before-render.txt'),telemetry.stdout??'');
const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,String(index),String(index+1)],{cwd:ROOT,stdio:'inherit',env:childEnv});if(render.status!==0)throw new Error('Episode preview rendering failed');
const reader=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,'--reuse-previews'],{cwd:ROOT,stdio:'inherit',env:childEnv});if(reader.status!==0)throw new Error('Reader synchronization failed');
console.log('Updated episode slide with genuine dataset links and sample values. Other 22 slides and notes preserved.');
