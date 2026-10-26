import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';
const build=path.join(ROOT,'.build/full-report/v3');await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v2.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(original));
const old=p.slides.items;
if(old.length!==22)throw new Error('Unexpected slide count');
p.slides.reorder([old[1],old[0],...old.slice(2)].map(s=>s.id.startsWith('sl/')?s.id:'sl/'+s.id));
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v3.pptx');
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:22,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const prev=path.join(ROOT,'artifacts/report/full_v2'),next=path.join(ROOT,'artifacts/report/full_v3');await fs.mkdir(next,{recursive:true});
for(let i=1;i<=22;i++){
  const srcIndex=i===1?2:i===2?1:i,src='page-'+String(srcIndex).padStart(2,'0'),dst='page-'+String(i).padStart(2,'0');
  await fs.copyFile(path.join(prev,src+'.png'),path.join(next,dst+'.png'));
  for(const ext of ['.notes.txt','.layout.json'])await fs.copyFile(path.join(ROOT,'.build/full-report/v2',src+ext),path.join(build,dst+ext));
}
const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),'v3','0','2'],{cwd:ROOT,stdio:'inherit',env:{...process.env,OMP_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
if(render.status!==0)throw new Error('First slides render failed');
const reader=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),'v3','--reuse-previews'],{cwd:ROOT,stdio:'inherit'});
if(reader.status!==0)throw new Error('Reader update failed');
await fs.copyFile(finalPath,original);
console.log('Directory moved to slide 1; original file and new v3 updated.');
