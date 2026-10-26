import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,Presentation,PresentationFile,FileBlob,finalizePresentation,sources,notes} from './report_common.mjs';
import {page04,page10} from './report_layouts.mjs';

const revision='v9',changed=[5,11],build=path.join(ROOT,'.build/full-report',revision);
await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v8.pptx');
const imported=await PresentationFile.importPptx(await FileBlob.load(original));
if(imported.slides.items.length!==23)throw new Error('Expected 23 existing slides');
const proto=imported.toProto(),otherBefore=JSON.stringify(proto.slides.filter((_,i)=>!changed.includes(i)));
for(const i of changed)proto.slides[i].elements=[];
const p=Presentation.load(proto);
const data=[];for(const name of ['pages03_04.json','pages05_11.json'])data.push(...JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts',name),'utf8')));
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
for(const [index,contentPage,render]of [[5,4,page04],[11,10,page10]]){
  const d={...data.find(x=>x.contentPage===contentPage),...overrides.find(x=>x.contentPage===contentPage)};
  const s=p.slides.items[index];await render(s,d);sources(s,d.sources,contentPage);notes(s,d);
  s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+d.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;
}
if(JSON.stringify(p.toProto().slides.filter((_,i)=>!changed.includes(i)))!==otherBefore)throw new Error('Unexpected edit outside the two requested pages');
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v9.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:23,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const next=path.join(ROOT,'artifacts/report/full_v9');await fs.mkdir(next,{recursive:true});
for(let i=1;i<=23;i++){
  const stem='page-'+String(i).padStart(2,'0');await fs.copyFile(path.join(ROOT,'artifacts/report/full_v8',stem+'.png'),path.join(next,stem+'.png'));
  for(const ext of ['.notes.txt','.layout.json'])await fs.copyFile(path.join(ROOT,'.build/full-report/v8',stem+ext),path.join(build,stem+ext));
}
const childEnv={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
for(const index of changed){
  const telemetry=spawnSync('/bin/zsh',[path.join(ROOT,'scripts/resource_snapshot.sh')],{encoding:'utf8'});await fs.writeFile(path.join(build,`resource-before-render-${index}.txt`),telemetry.stdout??'');
  const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,String(index),String(index+1)],{cwd:ROOT,stdio:'inherit',env:childEnv});if(render.status!==0)throw new Error('Rendering changed slide failed');
}
const reader=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,'--reuse-previews'],{cwd:ROOT,stdio:'inherit',env:childEnv});if(reader.status!==0)throw new Error('Reader synchronization failed');
console.log('Local resource links are relative and point to offline viewers. Other 21 slides and notes preserved.');
