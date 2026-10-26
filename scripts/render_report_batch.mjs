import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,PresentationFile,FileBlob} from './report_common.mjs';
const [revision,startText,endText]=process.argv.slice(2);
if(!/^v\d+$/.test(revision??''))throw new Error('Invalid revision');
const start=Number(startText),end=Number(endText);
const file=path.join(ROOT,'artifacts/report',`具身智能数据管线报告_${revision}.pptx`);
const p=await PresentationFile.importPptx(await FileBlob.load(file));
const previews=path.join(ROOT,'artifacts/report','full_'+revision),build=path.join(ROOT,'.build/full-report',revision);
await fs.mkdir(previews,{recursive:true});
for(let i=start;i<end;i++){
  const s=p.slides.items[i],stem='page-'+String(i+1).padStart(2,'0');
  await fs.writeFile(path.join(previews,stem+'.png'),new Uint8Array(await(await p.export({slide:s,format:'png',scale:1.5})).arrayBuffer()));
  await fs.writeFile(path.join(build,stem+'.layout.json'),await(await s.export({format:'layout'})).text());
  await fs.writeFile(path.join(build,stem+'.notes.txt'),s.speakerNotes.text);
  console.log('rendered',i+1);
}
