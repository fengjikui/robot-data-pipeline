import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PresentationFile,FileBlob,finalizePresentation,sources,notes} from './report_common.mjs';
import {toc} from './report_layouts.mjs';
import {startupSupplement} from './report_startup_supplement.mjs';

const revision='v6',build=path.join(ROOT,'.build/full-report',revision);
await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v5.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(original));
if(p.slides.items.length!==22)throw new Error('Expected the existing 22-slide deck');
const before=p.toProto().slides;
const originalSlides=[...p.slides.items];
const d=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/capture_startup.json'),'utf8'));
const extra=p.slides.add();startupSupplement(extra,d);sources(extra,d.sources,'备查');notes(extra,d);
extra.speakerNotes.text='精讲口述（备查，建议约30秒）\n\n'+d.shortScript+'\n\n扩展讲稿与原始出处\n\n'+extra.speakerNotes.text;
const contents=originalSlides[0];
for(const el of [...contents.shapes.items,...contents.images.items])el.delete();
toc(contents,true);sources(contents,[],'目录');contents.speakerNotes.text+='\n\n另有一页程序分工与启动顺序备查，现场简要带过。';
const ordered=[...originalSlides.slice(0,4),extra,...originalSlides.slice(4)];
p.slides.reorder(ordered.map(s=>s.id.startsWith('sl/')?s.id:'sl/'+s.id));
const after=p.toProto().slides;
const normal=s=>JSON.stringify({...s,index:0});
for(let i=1;i<before.length;i++)if(normal(before[i])!==normal(after[i<4?i:i+1]))throw new Error('Changed original content slide '+i);
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v6.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:23,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const previews=path.join(ROOT,'artifacts/report/full_v6');await fs.mkdir(previews,{recursive:true});
for(let i=1;i<=22;i++){
  const from='page-'+String(i).padStart(2,'0'),to='page-'+String(i<=4?i:i+1).padStart(2,'0');
  await fs.copyFile(path.join(ROOT,'artifacts/report/full_v5',from+'.png'),path.join(previews,to+'.png'));
  for(const ext of ['.notes.txt','.layout.json'])await fs.copyFile(path.join(ROOT,'.build/full-report/v5',from+ext),path.join(build,to+ext));
}
const childEnv={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
for(const [start,end]of [[0,1],[4,5]]){
  const telemetry=spawnSync('/bin/zsh',[path.join(ROOT,'scripts/resource_snapshot.sh')],{encoding:'utf8'});await fs.writeFile(path.join(build,`resource-before-render-${start}.txt`),telemetry.stdout??'');
  const r=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,String(start),String(end)],{cwd:ROOT,stdio:'inherit',env:childEnv});if(r.status!==0)throw new Error('Changed page rendering failed');
}
const reader=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,'--reuse-previews'],{cwd:ROOT,stdio:'inherit',env:childEnv});if(reader.status!==0)throw new Error('Reader synchronization failed');
console.log('Inserted physical slide 5. All 21 original content slides and their notes preserved.');
