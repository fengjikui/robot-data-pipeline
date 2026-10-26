import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,Presentation,PresentationFile,FileBlob,finalizePresentation,sources,notes} from './report_common.mjs';
import {toc,page11} from './report_layouts.mjs';
import {conversionPolicyContract} from './report_conversion_contract.mjs';

const revision='v11',build=path.join(ROOT,'.build/full-report',revision);await fs.mkdir(build,{recursive:true});
const input=path.join(ROOT,'artifacts/report/具身智能数据管线_组会报告_v10.pptx');
const imported=await PresentationFile.importPptx(await FileBlob.load(input));
const oldManifest=JSON.parse(await fs.readFile(path.join(ROOT,'.build/full-report/v10/manifest.json'),'utf8'));
if(imported.slides.items.length!==24||oldManifest.pages.length!==24)throw new Error('Expected the existing 24-slide report');
const before=imported.toProto().slides;
const proto=imported.toProto(),policyIndex=oldManifest.pages.findIndex(m=>m.contentPage===11);proto.slides[policyIndex].elements=[];
const p=Presentation.load(proto),byKey=new Map(oldManifest.pages.map((m,i)=>[m.contentPage,p.slides.items[i]]));
const sequence=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8'));
const contract=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/conversion_policy_contract.json'),'utf8'));
const data=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/pages05_11.json'),'utf8'));
const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
const d={...data.find(x=>x.contentPage===11),...overrides.find(x=>x.contentPage===11)};
const policy=byKey.get(11);page11(policy,d);sources(policy,d.sources,9);notes(policy,d);
policy.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+d.shortScript+'\n\n扩展讲稿与原始出处\n\n'+policy.speakerNotes.text;
const s=p.slides.add();conversionPolicyContract(s,contract);sources(s,contract.sources,8);notes(s,contract);
s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+contract.shortScript+'\n\n扩展讲稿与原始出处\n\n'+s.speakerNotes.text;byKey.set(contract.contentPage,s);
const contents=byKey.get('toc');for(const e of [...contents.shapes.items,...contents.images.items])e.delete();toc(contents,true,sequence.chapters);sources(contents,[],'目录');
contents.speakerNotes.text='先完整讲完G1真机采集到处理、训练、评估和部署；其中新增采集/转换/训练配置职责，并逐项解释各策略的数据适配。接着介绍外部数据、接入与采购，最后介绍工作台方案和实施验收。';
p.slides.reorder(sequence.contentOrder.map(k=>{const id=byKey.get(k).id;return id.startsWith('sl/')?id:'sl/'+id;}));
let page=0;for(const key of sequence.contentOrder){const slide=byKey.get(key);const footer=slide.shapes.items.find(x=>x.name==='content-page');if(!footer)throw new Error('Missing footer '+key);footer.text=String(key==='toc'?'目录':key==='capture_startup'?'备查':++page);slide.speakerNotes.text=slide.speakerNotes.text.replaceAll('report.pptx','演示 PPT');}
const normal=slide=>JSON.stringify({...slide,index:0,elements:slide.elements.filter(e=>!JSON.stringify(e).includes('"content-page"'))});
const after=p.toProto().slides;
for(const [i,m]of oldManifest.pages.entries()){
  if(['toc',11,4].includes(m.contentPage))continue;
  if(normal(before[i])!==normal(after[sequence.contentOrder.indexOf(m.contentPage)]))throw new Error('Unexpected change to content '+m.contentPage);
}
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);const candidatePath=path.join(build,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(ROOT,`artifacts/report/具身智能数据管线_组会报告_${revision}.pptx`);
await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:25,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
const env={...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'};
if(process.argv.includes('--reuse-previews')){
  const child=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,'9','11'],{cwd:ROOT,stdio:'inherit',env});if(child.status!==0)throw new Error('Changed-page rendering failed');
}
const child=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/finalize_report_previews.mjs'),revision,...(process.argv.includes('--reuse-previews')?['--reuse-previews']:[])],{cwd:ROOT,stdio:'inherit',env});if(child.status!==0)throw new Error('Rendering and note synchronization failed');
console.log('Clarified source mapping versus policy preparation, with per-route guidance and consistent body numbering.');
