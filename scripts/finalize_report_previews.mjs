import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const ROOT='/Users/fengjikui/Documents/dev-coding/codex_build/robot_data_pipeline';
const RUNTIME='/Users/fengjikui/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const revision=process.argv[2];
if(!/^v\d+$/.test(revision??''))throw new Error('Invalid revision');
const build=path.join(ROOT,'.build/full-report',revision),out=path.join(ROOT,'artifacts/report');
const data=[];
for(const f of ['pages03_04.json','pages05_11.json','pages12_14_19_21.json','pages15_18.json'])data.push(...JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts',f),'utf8')));
data.sort((a,b)=>a.contentPage-b.contentPage);
const metadata=[{contentPage:'toc',title:'报告内容'},{contentPage:1,title:'搬箱任务与数据管线全貌'},{contentPage:2,title:'真机采集的设备分工'},...data];
const short=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/short_scripts.json'),'utf8'));
try{
  const external=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/external_intake_routes.json'),'utf8'));
  metadata.push(external);short[external.contentPage]=external.shortScript;
}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  const contract=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/conversion_policy_contract.json'),'utf8'));
  metadata.push(contract);short[contract.contentPage]=contract.shortScript;
}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  const supplement=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/capture_startup.json'),'utf8'));
  metadata.splice(metadata.findIndex(m=>m.contentPage===supplement.afterContentPage)+1,0,supplement);
  short[supplement.contentPage]=supplement.shortScript;
}catch(e){if(e.code!=='ENOENT')throw e;}
try{
  const sequence=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8'));
  const byKey=new Map(metadata.map(m=>[m.contentPage,m]));
  metadata.splice(0,metadata.length,...sequence.contentOrder.map(key=>{const m=byKey.get(key);if(!m)throw new Error('Missing content key '+key);return m;}));
}catch(e){if(e.code!=='ENOENT')throw e;}
let revisionConfig=null;
let focusedConfig=null;
if(Number(revision.slice(1))>=14){
  revisionConfig=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v14.json'),'utf8'));
  for(const item of revisionConfig.pages){const existing=metadata.find(m=>m.contentPage===item.contentPage);if(existing)Object.assign(existing,item);else metadata.push(item);short[String(item.contentPage)]=item.shortScript;}
  const byKey=new Map(metadata.map(m=>[m.contentPage,m]));metadata.splice(0,metadata.length,...revisionConfig.contentOrder.map(key=>byKey.get(key)));
}
if(Number(revision.slice(1))>=15){
  focusedConfig=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v15.json'),'utf8'));
  for(const item of focusedConfig.pages){metadata.push(item);short[String(item.contentPage)]=item.shortScript;}
  const byKey=new Map(metadata.map(m=>[m.contentPage,m]));metadata.splice(0,metadata.length,...focusedConfig.contentOrder.map(key=>byKey.get(key)));
}
let bodyCount=0;
for(const m of metadata)m.displayPage=m.contentPage==='toc'?'目录':m.contentPage==='capture_startup'||m.isSupplement?'备查':++bodyCount;
const slideCount=metadata.length;
const supplementCount=metadata.filter(m=>m.displayPage==='备查').length;
if(!process.argv.includes('--reuse-previews'))for(let start=0;start<slideCount;start+=6){
  const telemetry=spawnSync('/bin/zsh',[path.join(ROOT,'scripts/resource_snapshot.sh')],{encoding:'utf8'});
  await fs.writeFile(path.join(build,`resource-before-batch-${start}.txt`),telemetry.stdout??'');
  const r=spawnSync(path.join(RUNTIME,'node/bin/node'),[path.join(ROOT,'scripts/render_report_batch.mjs'),revision,String(start),String(Math.min(start+6,slideCount))],{cwd:ROOT,stdio:'inherit',env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',VECLIB_MAXIMUM_THREADS:'1'}});
  if(r.status!==0)throw new Error('Preview batch failed: '+start);
}
try{
  const overrides=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/authority_reference_overrides.json'),'utf8'));
  for(const o of overrides){short[String(o.contentPage)]=o.shortScript;const m=metadata.find(x=>x.contentPage===o.contentPage);if(m)m.sources=o.sources;}
}catch(e){if(e.code!=='ENOENT')throw e;}
if(Number(revision.slice(1))>=13){
  const solution=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/workbench_solution_v13.json'),'utf8'));
  for(const item of solution){short[String(item.contentPage)]=item.shortScript;const m=metadata.find(x=>x.contentPage===item.contentPage);if(m)Object.assign(m,item);}
}
if(revisionConfig)for(const item of revisionConfig.pages){short[String(item.contentPage)]=item.shortScript;Object.assign(metadata.find(m=>m.contentPage===item.contentPage),item);}
if(focusedConfig)for(const item of focusedConfig.pages){short[String(item.contentPage)]=item.shortScript;Object.assign(metadata.find(m=>m.contentPage===item.contentPage),item);}
let md=`# 具身智能数据管线：逐页阅读与演讲稿\n\n更新：2026 年 10 月 26 日。共 ${bodyCount} 页正文、1 页目录与 ${supplementCount} 页备查，合计 ${slideCount} 张幻灯片。先完整介绍自采到部署，再介绍外部数据接入与采购，最后讲工作台方案。标题为红色，白/浅灰与石墨黑为主体，少量蓝色强调。${revisionConfig?'标题距左和上均1.1 cm，所有可见页码与目录页码范围已移除，底部1.3 cm完整留给公司模板。':'每页底部约80px留作公司页脚。'}\n\n每页先给精讲口述，随后保留扩展讲稿。仅在用到官方文档、原作者源码或论文时列出参考资料，自行整理与设计不作为参考。主线精讲按约 20–25 分钟演练，备查页可略讲，实际以演练为准。${Number(revision.slice(1))>=13?'v0.1.2 已实现本地导入、结构质检与 JSONL 导出；新页面展示的完整工作流与可点击原型仍属方案，真机采集、训练和部署尚未接入。':'图形工作台与完整自主搬箱尚未实现，规划页已明确标注。'}\n\n`;
for(let i=0;i<metadata.length;i++){
  const m=metadata[i],stem='page-'+String(i+1).padStart(2,'0');
  let long=await fs.readFile(path.join(build,stem+'.notes.txt'),'utf8');
  const divider=/扩展讲稿(?:与原始出处)?\n\n/;if(divider.test(long))long=long.split(divider).slice(1).join('\n\n');
  for(const marker of ['\n\n图标来源：','\n\n配图与制作来源：'])if(long.includes(marker))long=long.split(marker)[0];
  const label=m.contentPage==='toc'||m.sources?.length===0?'扩展讲稿':'扩展讲稿与原始出处';
  md+=`## 幻灯片 ${i+1}（${typeof m.displayPage==='number'?'正文 '+m.displayPage:m.displayPage}）${m.title}\n\n![${m.title}](../../artifacts/report/full_${revision}/${stem}.png)\n\n### 精讲口述\n\n${short[String(m.contentPage)]}\n\n### ${label}\n\n${long}\n\n`;
}
md+='## 配图与复现说明\n\n机器人说明插图使用内置 image_gen，参考宇树官方外形和遥操作相机图片。它不是实机照片或内部装配图。\n\n- [机器人配图提示](../../assets/report_slide02/image_generation_prompt.txt)\n- [视觉增强三联图提示](../../assets/report_generated/augmentation_triptych_v1.prompt.txt)\n- [生成与来源记录](../../assets/report_generated/augmentation_triptych_v1.record.json)\n- 硬件参考图片与哈希：`assets/report_slide02/source_manifest.json`。图标原始许可保存在素材目录与原页面备注。\n\n';
const reader=path.join(ROOT,'docs/report/07_全稿逐页阅读与演讲稿.md');await fs.writeFile(reader,md);
const finalPath=path.join(out,`具身智能数据管线报告_${revision}.pptx`);
let deviceFinal=path.join(out,`02_真机采集的设备分工_页脚与配色版_${revision}.pptx`);
try{await fs.access(deviceFinal);}catch{deviceFinal=path.join(out,'02_真机采集的设备分工_页脚与配色版_v2.pptx');}
const validation=JSON.parse(await fs.readFile(path.join(build,'validation.json'),'utf8'));
await fs.writeFile(path.join(build,'manifest.json'),JSON.stringify({date:'2026-10-26',revision,finalPath,deviceFinal,reader,slideCount,bodyCount,footerSafeZone:revisionConfig?{top:720-1.3*96/2.54,bottom:720,reservedCm:1.3}:{top:640,bottom:720},pages:metadata.map((m,i)=>({slide:i+1,contentPage:m.contentPage,displayPage:m.displayPage,title:m.title,preview:path.join(out,'full_'+revision,'page-'+String(i+1).padStart(2,'0')+'.png')})),status:'awaiting final visual review',finalSha256:validation.finalSha256},null,2));
console.log(JSON.stringify({finalPath,deviceFinal,reader,rendered:slideCount},null,2));
