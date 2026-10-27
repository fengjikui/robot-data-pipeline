import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {ROOT,SKILL,RUNTIME,FONT,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';

const build=path.join(ROOT,'.build/full-report/v18'), out=path.join(ROOT,'artifacts/report');
const candidatePath=path.join(build,'candidate.pptx'), finalPath=path.join(out,'具身智能数据管线报告_v18.pptx');
const referencePath=path.join(out,'具身智能数据管线报告_v17.pptx');
const sha=async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:5,requiredNativeTableOwnerSlides:[4,5],requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit','--require-native-table-slide','4','--require-native-table-slide','5'],fontPolicy:{basis:'reference',families:[FONT],referencePath,referenceSha256:await sha(referencePath)},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
if(await sha(candidatePath)!==await sha(finalPath))throw new Error('Final file differs from the WPS-tested candidate');
const previews=path.join(out,'full_v18');await fs.mkdir(previews,{recursive:true});
async function resource(label){await fs.writeFile(path.join(build,'resource-'+label+'.txt'),execFileSync('bash',[path.join(ROOT,'scripts/resource_snapshot.sh')],{cwd:ROOT}));}
await resource('before-topology-render');
{
  const p=await PresentationFile.importPptx(await FileBlob.load(path.join(build,'phase-topology.pptx')));
  for(let i=0;i<5;i++){
    const s=p.slides.items[i],stem='page-'+String(i+1).padStart(2,'0');
    await fs.writeFile(path.join(previews,stem+'.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));
    await fs.writeFile(path.join(build,stem+'.layout.json'),await(await s.export({format:'layout'})).text());
    await fs.writeFile(path.join(build,stem+'.notes.txt'),s.speakerNotes.text);
  }
}
await resource('before-data-render');
{
  const p=await PresentationFile.importPptx(await FileBlob.load(path.join(build,'phase-data.pptx'))),s=p.slides.items[1];
  await fs.writeFile(path.join(previews,'capture-data.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));
  await fs.writeFile(path.join(build,'capture-data.layout.json'),await(await s.export({format:'layout'})).text());
}
console.log(JSON.stringify({finalPath,sha256:await sha(finalPath),slides:5,captureStates:2,nativeAnimation:true,testedCandidatePreserved:true,layoutFindings:result.presentationLayout.findingCount},null,2));
