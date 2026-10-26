import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PresentationFile,FileBlob,finalizePresentation,sources,notes} from './report_common.mjs';
import {toc} from './report_layouts.mjs';
import {externalIntakeRoutes} from './report_external_routes.mjs';

const revision='v10',build=path.join(ROOT,'.build/full-report',revision);
await fs.mkdir(build,{recursive:true});
const original=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v9.pptx');
const p=await PresentationFile.importPptx(await FileBlob.load(original));
const oldManifest=JSON.parse(await fs.readFile(path.join(ROOT,'.build/full-report/v9/manifest.json'),'utf8'));
if(p.slides.items.length!==23||oldManifest.pages.length!==23)throw new Error('Expected the existing 23-slide deck');
const before=p.toProto().slides;
const byKey=new Map(oldManifest.pages.map((m,i)=>[m.contentPage,p.slides.items[i]]));
const sequence=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8'));
const extra=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/external_intake_routes.json'),'utf8'));
const short=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/short_scripts.json'),'utf8'));
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
const contents=byKey.get('toc');for(const e of [...contents.shapes.items,...contents.images.items])e.delete();
toc(contents,true,sequence.chapters);sources(contents,[],'目录');contents.speakerNotes.text=short.toc;
const external=byKey.get(5),externalNotes=overrides.find(x=>x.contentPage===5);
external.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+externalNotes.shortScript+'\n\n扩展讲稿与原始出处\n\n'+externalNotes.speakerNotes;
const s=p.slides.add();externalIntakeRoutes(s,extra);sources(s,extra.sources,13);notes(s,extra);
s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+extra.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;
byKey.set(extra.contentPage,s);
p.slides.reorder(sequence.contentOrder.map(key=>{const id=byKey.get(key).id;return id.startsWith('sl/')?id:'sl/'+id;}));
let page=0;
for(const key of sequence.contentOrder){const slide=byKey.get(key),footer=slide.shapes.items.find(x=>x.name==='content-page');if(!footer)throw new Error('Missing page footer: '+key);footer.text=String(key==='toc'?'目录':key==='capture_startup'?'备查':++page);}
const normalize=slide=>JSON.stringify({...slide,index:0,elements:slide.elements.filter(e=>!JSON.stringify(e).includes('"content-page"'))});
const after=p.toProto().slides;
for(const [oldIndex,m]of oldManifest.pages.entries()){
  if(m.contentPage==='toc'||m.contentPage===5)continue;
  const newIndex=sequence.contentOrder.indexOf(m.contentPage);
  if(normalize(before[oldIndex])!==normalize(after[newIndex]))throw new Error('Unexpected content change: '+m.contentPage);
}
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,`artifacts/report/具身智能数据管线_组会报告_${revision}.pptx`);
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:24,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const env={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
if(process.argv.includes('--reuse-previews')){
  const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,'14','15'],{cwd:ROOT,stdio:'inherit',env});if(render.status!==0)throw new Error('Route slide rendering failed');
}
const render=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,...(process.argv.includes('--reuse-previews')?['--reuse-previews']:[])],{cwd:ROOT,stdio:'inherit',env});if(render.status!==0)throw new Error('Rendering/reader synchronization failed');
console.log('Reordered external data after deployment, added intake routes, renumbered content and synchronized notes.');
