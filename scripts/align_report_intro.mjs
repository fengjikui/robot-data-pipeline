import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PIN,LEROBOT,PresentationFile,FileBlob,finalizePresentation,replaceSources} from './report_common.mjs';
import {page01} from './report_layouts.mjs';

const revision='v5',build=path.join(ROOT,'.build/full-report',revision);await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v4.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(original));
const index=p.slides.items.findIndex(s=>s.shapes.items.some(sh=>String(sh.text)==='具身智能数据管线'));
if(index!==1)throw new Error('Expected the task introduction after the contents slide');
const originalNotes=p.slides.items[index].speakerNotes.text;
const restBefore=JSON.stringify(p.toProto().slides.filter((_,i)=>i!==index));
const s=p.slides.items[index];for(const el of [...s.shapes.items,...s.images.items])el.delete();
await page01(s);
replaceSources(s,[{label:'宇树 xr_teleoperate',url:PIN+'README.md',kind:'upstream'},{label:'宇树 unitree_lerobot',url:LEROBOT+'README.md',kind:'upstream'}],1);
s.speakerNotes.text=originalNotes;
if(JSON.stringify(p.toProto().slides.filter((_,i)=>i!==index))!==restBefore)throw new Error('Unexpected modification outside the requested slide');
const owners=p.slides.items.flatMap((slide,i)=>slide.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v5.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:22,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const prev=path.join(ROOT,'artifacts/report/full_v4'),next=path.join(ROOT,'artifacts/report/full_v5');await fs.mkdir(next,{recursive:true});
for(let i=1;i<=22;i++){
  const stem='page-'+String(i).padStart(2,'0');await fs.copyFile(path.join(prev,stem+'.png'),path.join(next,stem+'.png'));
  for(const ext of ['.notes.txt','.layout.json'])await fs.copyFile(path.join(ROOT,'.build/full-report/v4',stem+ext),path.join(build,stem+ext));
}
const childEnv={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,'1','2'],{cwd:ROOT,stdio:'inherit',env:childEnv});if(render.status!==0)throw new Error('Introduction rendering failed');
const reader=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,'--reuse-previews'],{cwd:ROOT,stdio:'inherit',env:childEnv});if(reader.status!==0)throw new Error('Reader synchronization failed');
await fs.copyFile(finalPath,original);
console.log('Aligned the introductory pipeline slide; other slides and speaker notes preserved.');
