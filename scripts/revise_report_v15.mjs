import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {ROOT,SKILL,RUNTIME,FONT,C,T,L,B,D,IMG,title,rail,table,sources,notes,Presentation,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';

const revision='v15',build=path.join(ROOT,'.build/full-report',revision),out=path.join(ROOT,'artifacts/report');
await fs.mkdir(build,{recursive:true});
const attempt=path.join(build,'attempt-'+Date.now());await fs.mkdir(attempt);
const config=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/report_revision_v15.json'),'utf8'));
const input=path.join(out,'具身智能数据管线报告_v14.pptx');
const original=await PresentationFile.importPptx(await FileBlob.load(input));
if(original.slides.items.length!==29)throw new Error('Expected original 29-slide v14');
const proto=original.toProto();proto.slides=proto.slides.slice(0,19);
const prefixBefore=JSON.stringify(proto.slides);
const p=Presentation.load(proto);
const link=(s,name,label,url,x,y,w,size=19)=>{const t=T(s,name,label,x,y,w,29,size,{color:C.blue,raw:true});t.text.get(label).link={uri:url,isExternal:true};};
const renderers={
  v15_external_cases(s){
    table(s,[['真实候选','保存格式','实际任务与用途','本轮选择'],['Arena G1 搬箱\n仿真数据','LeRobot v2.1\n另有 HDF5','取箱、移动、放置\n配套仿真与训练路线','首期闭环候选'],['宇树 Plastic Box Parts\nG1 + BrainCo','LeRobot v3','从箱内取零件到货架\n不属于完整搬箱','排除目标微调'],['DROID\nFranka 单臂','RLDS / TFRecord\n原始 HDF5 + MP4/SVO','日常操作大库\n按任务筛选预训练候选','后续迁移研究']],64,174,1152,286,[252,237,409,254],19.5);
    rail(s,['看任务与本体','预览目标回合','只取所需文件','登记来源和范围'],160,507,960,{size:20,labelHeight:36});
    T(s,'download-scope','Arena 整仓约24GB；已转换 LeRobot 子目录约298MB。先读清单，再取范围。',64,591,1152,31,20,{color:C.blue});
  },
  v15_procurement(s){
    const columns=[['提什么需求','指定 G1、手型与控制器\n桌 A 取箱、抱持移动、桌 B 放置\n箱体、桌高、路径与光照范围'],['交什么数据','同步图像和实际全身状态\n臂手目标、机身移动指令\n字段、标定与回合结果'],['用什么验收','先交有代表性的试样\n真实读取、必要转换和任务评估\n按有效回合与覆盖分批交付']];
    columns.forEach(([a,b],i)=>{const x=64+i*400;D(s,'contract-dot-'+i,x+21,204,20,C.pale,C.blue);T(s,'contract-number-'+i,i+1,x+5,189,32,30,19,{color:C.blue,alignment:'center'});T(s,'contract-title-'+i,a,x+62,183,290,43,28,{bold:true});T(s,'contract-detail-'+i,b,x,266,352,180,23);if(i<2)L(s,'contract-divider-'+i,x+375,265,x+375,440,C.line,1);});
    T(s,'existing-data','已有数据：先验证对当前任务的适用性。',64,475,552,37,24,{color:C.blue,bold:true});
    T(s,'new-data','委托新采：先试采，确认规范后再批量交付。',664,475,552,37,23,{color:C.blue,bold:true});
    B(s,'purchase-footer',64,546,1152,63,C.soft);T(s,'purchase-deliverables','交付约定另写清：覆盖与有效数量、数据和模型用途、缺项补交及整改责任。',84,558,1112,40,21,{color:C.muted});
  },
  v15_problems(s){
    const rows=[['流程靠人串','多设备、多脚本和重复配置，\n出错后难找恢复位置。','保存配方，按步骤执行','统一启动与记录；阶段按钮可串联，\n失败后从该阶段继续。'],['好数据难找难接','大库任务混杂，下载整库后\n才发现内容或手型不合适。','按任务找，先看样本再取数','预览回合、选择范围、复用已有下载，\n按已验证配方完成必要转换。'],['数据越多越难复用','文件与实验分散，后来的人\n找不到合适回合和可用结果。','让数据、模型和评价关联','按目录检索、按回合清单选数，\n复用原件、处理结果与训练输入。']];
    rows.forEach(([a,b,c,d],i)=>{const y=175+i*138;T(s,'pain-title-'+i,a,64,y,385,38,28,{bold:true});T(s,'pain-detail-'+i,b,64,y+47,385,70,22,{color:C.muted});L(s,'pain-to-result-'+i,460,y+57,497,y+57,C.blue,2,false,true);T(s,'result-title-'+i,c,535,y,681,38,27,{bold:true,color:C.blue});T(s,'result-detail-'+i,d,535,y+47,681,70,23);if(i<2)L(s,'pain-divider-'+i,64,y+125,1216,y+125,C.line,1);});
    T(s,'first-proof','首期用 G1 搬箱证明：采集能启动、数据能选对、一次实验能复跑。',64,595,1152,31,23,{color:C.blue});
  },
  v15_overall(s){
    const source=(name,a,b,x,w)=>{B(s,name,x,175,w,92,C.soft,C.line);T(s,name+'-title',a,x+16,185,w-32,34,24,{bold:true});T(s,name+'-sub',b,x+16,226,w-32,29,19,{color:C.muted});};
    source('capture-input','真机 / 仿真遥操作','设备与服务按配方启动',64,280);
    source('external-input','开源 / 商业数据','检索预览、范围下载与入库',435,356);
    T(s,'task-context','同一任务工作区\nG1 配置、搬箱范围与训练配方',844,178,372,79,24,{color:C.blue,bold:true});
    const xs=[100,280,460,640,820,1000,1180];L(s,'seven-step-rail',100,357,1180,357,C.line,2.5);
    L(s,'capture-to-first',204,267,100,329,C.blue,2,false,true);L(s,'external-to-check',613,267,280,329,C.blue,2,false,true);
    const steps=[['数据捕获','多设备启动\n回合落盘'],['质量检查','预览问题\n定位回合'],['数据转换','匹配配方\n字段与格式'],['数据增强','预览审查\n按需启用'],['模型训练','选择策略\n执行资源'],['仿真测试','闭环成功率\n失败录像'],['真机部署','人工启用\n结果回流']];
    steps.forEach(([a,b],i)=>{D(s,'stage-dot-'+i,xs[i],357,20,C.pale,C.blue);T(s,'stage-number-'+i,i+1,xs[i]-16,342,32,30,19,{color:C.blue,alignment:'center'});T(s,'stage-label-'+i,a,xs[i]-75,399,150,39,24,{bold:true,alignment:'center'});T(s,'stage-output-'+i,b,xs[i]-75,457,150,73,20,{color:C.muted,alignment:'center'});});
    T(s,'stage-controls','每步可单独点击，也可串联。输入、执行位置、日志与产物始终可见。',64,565,1152,35,23,{bold:true,color:C.blue});
    T(s,'skip-rule','现成训练格式可跳过重复转换，增强按需；真机部署保留明确的人工启用。',64,607,1152,25,18.5,{color:C.muted});
  },
  async v15_box_validation(s){
    await IMG(s,'artifacts/report/resources/box_case/frame_09s.jpg',64,178,400,300,'NVIDIA Arena公开仿真示范episode0第9秒，非本项目策略闭环结果');
    link(s,'open-case','公开示范 / NVIDIA CC BY 4.0 / 查看 ↗','resources/box_case/index.html',64,486,440,16);
    T(s,'case-combination','NVIDIA Arena / G1 / GR00T N1.6',520,175,696,39,27,{bold:true,color:C.blue});
    const lines=[['数据、模型与场景齐备','货架取箱、移动、放入蓝筐；配套 GR00T 与 WBC。'],['本次实际核查','固定版本，读取1回合915条记录与18.3秒原始视频。'],['下一步实际运行','先用公开模型验环境，再选数训练，做多回合闭环评价。']];
    lines.forEach(([a,b],i)=>{T(s,'case-label-'+i,a,520,234+i*74,696,29,23,{bold:true});T(s,'case-detail-'+i,b,520,269+i*74,696,31,20.5,{color:C.muted});});
    T(s,'case-control','记录43维关节；配方取31维上身状态、35维高层动作。\n腿由 WBC 执行。桌 A / B 迁移与指定真机还需验证。',520,456,696,57,20,{color:C.muted});
    rail(s,['查清单与样本','取所需数据','质检与配方','训练 / 微调','闭环评价'],160,550,960,{size:20,labelHeight:30});
  },
  v15_roadmap(s){
    T(s,'current-status','当前 v0.1.2：本地导入、结构检查与 JSONL 导出，七步执行后端尚未接齐。',64,172,1152,42,23,{color:C.muted});
    const xs=[240,640,1040];L(s,'phase-rail',240,275,1040,275,C.line,2.5);
    const phases=[['S1','先跑通 G1 搬箱','固定一套 G1 配置和训练配方\n遥操作与开源数据两类入口\n训练、仿真和受限真机验证','交付：可复跑的任务包\n数据、模型、日志和闭环视频'],['S2','把数据用得更好','增强配方、人 / Agent 审查\n多策略对照与失败补采\n针对真实缺口研发新转换','交付：任务效果对照报告\n可复用的新数据和处理配方'],['S3','企业数据规模化','跨任务检索、权限与共享\n存储、去重与训练加载优化\n按采购计划增加本体与来源','交付：可测的检索与加载效率\n跨项目复用和新组合验收']];
    phases.forEach(([id,a,b,c],i)=>{const x=xs[i];D(s,'phase-node-'+i,x,275,23,C.pale,C.blue);T(s,'phase-id-'+i,id,x-22,260,44,30,19,{color:C.blue,alignment:'center'});T(s,'phase-name-'+i,a,x-176,327,352,43,27,{bold:true,alignment:'center',color:i===0?C.blue:C.ink});T(s,'phase-description-'+i,b,x-176,396,352,116,21,{color:C.muted,alignment:'center'});T(s,'phase-deliverable-'+i,c,x-176,536,352,66,20,{color:C.blue,alignment:'center'});});
  },
  v15_warehouse(s){
    B(s,'warehouse-query',64,173,1152,61,C.soft);T(s,'query-label','按任务选数：搬箱 / G1 与手型 / 任务阶段 / 质量与验证状态',85,184,1110,39,24,{bold:true});
    const columns=[['找得到','目录索引','任务、本体、动作、阶段与质量\n来源版本、许可、实际持有范围\n能预览回合，知道选它的理由'],['能复用','共享资产与数据视图','原件放共享 / 对象存储\n项目保存回合清单和处理配方\n按引用复用，减少整库重复复制'],['读得快','训练侧缓存与加载','按实际格式选择分片与读取\n近端缓存、预取和并行加载\n针对 I/O 与解码瓶颈做优化']];
    columns.forEach(([a,b,c],i)=>{const x=64+i*400;T(s,'warehouse-benefit-'+i,a,x,274,352,45,31,{color:C.blue,bold:true});T(s,'warehouse-component-'+i,b,x,337,352,38,25,{bold:true});T(s,'warehouse-detail-'+i,c,x,395,352,111,21);if(i<2)L(s,'warehouse-divider-'+i,x+376,278,x+376,504,C.line,1);});
    B(s,'warehouse-metrics',64,545,1152,67,C.soft);T(s,'warehouse-measure','用实测优化：找数耗时、首批次等待、样本吞吐、重复存储与实验复现。',85,559,1110,39,22,{color:C.muted});
  }
};

for(const item of config.pages){
  const s=p.slides.add();title(s,item.title,item.subtitle);await renderers[item.contentPage](s);sources(s,item.sources,'');notes(s,item);
  s.speakerNotes.text='精讲口述\n\n'+item.shortScript+'\n\n'+(item.sources.length?'扩展讲稿与原始出处':'扩展讲稿')+'\n\n'+s.speakerNotes.text;
  for(const el of [...s.shapes.items]){
    const name=el.name??el.toSnapshot().name??'';
    if(name==='content-page'){el.delete();continue;}
    if(name==='title')el.position={...el.position,left:1.1*96/2.54,top:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(name==='subtitle')el.position={...el.position,left:1.1*96/2.54,width:1280-2.2*96/2.54};
    if(/^(source-prefix|source-\d+)$/.test(name))el.position={...el.position,top:630};
  }
}
if(JSON.stringify(p.toProto().slides.slice(0,19))!==prefixBefore)throw new Error('Unintended edit to the first 19 slides');
if(p.slides.items.length!==26)throw new Error('Expected 26 slides');
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(attempt,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,'具身智能数据管线报告_v15.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:26,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'reference',families:[FONT],referencePath:input,referenceSha256:createHash('sha256').update(await fs.readFile(input)).digest('hex')},verifyArtifactToolImport:true,receiptPath:path.join(attempt,'validation.json')});
await fs.copyFile(path.join(attempt,'validation.json'),path.join(build,'validation.json'));
await fs.writeFile(path.join(build,'preservation.json'),JSON.stringify({baseRevision:'v14',slideCount:26,preservedPrefixSlides:19,prefixProtoUnchanged:true,replacedOldSlides:[20,21,22,23,24,25,26,27,28,29],newContentSlides:[20,21,22,23,24,25,26],layoutFindings:result.presentationLayout.findingCount},null,2));
console.log(JSON.stringify({finalPath,slideCount:26,preservedPrefixSlides:19,layoutFindings:result.presentationLayout.findingCount},null,2));
