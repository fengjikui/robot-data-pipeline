import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,SKILL,RUNTIME,FONT,C,T,L,B,D,IMG,title,table,sources,notes,Presentation,PresentationFile,FileBlob,finalizePresentation} from './report_common.mjs';

const revision='v13', build=path.join(ROOT,'.build/full-report',revision), out=path.join(ROOT,'artifacts/report');
await fs.mkdir(build,{recursive:true});
const attempt=path.join(build,'attempt-'+Date.now());
await fs.mkdir(attempt,{recursive:true});
const input=path.join(out,'具身智能数据管线报告_v12.pptx');
const imported=await PresentationFile.importPptx(await FileBlob.load(input));
const sequence=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/presentation_sequence.json'),'utf8'));
let bodyPage=0;
const manifest={pages:sequence.contentOrder.map(key=>({contentPage:key,displayPage:key==='toc'?'目录':key==='capture_startup'?'备查':++bodyPage}))};
const data=JSON.parse(await fs.readFile(path.join(ROOT,'docs/report/parts/workbench_solution_v13.json'),'utf8'));
if(imported.slides.items.length!==25||manifest.pages.length!==25)throw new Error('Expected existing 25-slide report');
const before=imported.toProto();
const proto=imported.toProto();
for(let i=18;i<25;i++)proto.slides[i].elements=[];
const p=Presentation.load(proto);
const map=new Map(manifest.pages.map((m,i)=>[m.contentPage,p.slides.items[i]]));
const renderers={
  15(s){
    title(s,'现有流程中的交接成本','已有工具覆盖单项能力，日常使用还需要把条件、配置与结果衔接起来');
    table(s,[['环节','使用者现在要组织什么','平台应交付的使用体验'],['获取','多设备准备；来源、版本与下载范围','复用档案，看到真实就绪与实际持有范围'],['处理','核对动作、相机、时间和任务过程','预览差异，按需适配，直接定位问题'],['使用','对齐配方、执行机、模型与控制接口','先验收读取，再训练、评价和受限部署'],['迭代','找回输入与产物，处理失败后的重做','保留成功步骤，把失败转成可执行待办']],64,172,1152,338,[140,447,565],22);
    T(s,'analysis-boundary','LeLab 等已有图形流程；本项目的价值需要通过 G1 场景与真实用户任务验证。',64,548,1152,43,21,{color:C.muted});
  },
  16(s){
    title(s,'理想方案：围绕任务组织完整流程','两类数据入口，共用资产、回合视图与执行记录');
    B(s,'task-context',64,163,1152,54,C.soft);T(s,'task-context-label','任务目标 / 本轮范围 / 已支持本体 / 训练配方',87,172,1106,36,24,{bold:true});
    const box=(name,label,x,y,w,h,sub)=>{B(s,name,x,y,w,h,C.soft,C.line);T(s,name+'-label',label,x+16,y+12,w-32,32,24,{bold:true,alignment:'center'});if(sub)T(s,name+'-sub',sub,x+16,y+49,w-32,h-58,19,{color:C.muted,alignment:'center'});};
    box('capture-source','真机 / 仿真采集',64,253,244,84,'完成回合与原始清单');
    box('external-source','公开 / 采购数据',64,365,244,84,'先登记、取样与选范围');
    L(s,'merge-top',308,295,350,295,C.line,2);L(s,'merge-bottom',308,407,350,407,C.line,2);L(s,'merge-stem',350,295,350,407,C.line,2);L(s,'merge-assets',350,351,390,351,C.blue,2,false,true);
    box('assets-view','资产与回合视图',390,300,223,104,'保存来源，按需选数');
    L(s,'assets-to-prepare',613,352,651,352,C.blue,2,false,true);
    box('prepare-input','检查与训练输入',651,300,269,104,'按需适配、增强与读取验收');
    L(s,'prepare-to-train',920,352,960,352,C.blue,2,false,true);
    box('train-evaluate','训练与闭环评价',960,300,256,104,'固定配方和匹配场景');
    L(s,'evaluate-to-deploy',1088,404,1088,452,C.blue,2,false,true);
    box('deploy','受限实机验证',960,452,256,80,'明确控制范围');
    L(s,'feedback-link',960,492,920,492,C.blue,2,false,true);
    T(s,'feedback','评价问题形成补采、重标或配方改进待办',390,466,530,58,23,{color:C.blue});
    T(s,'shared-records','阶段按钮为主，可选串联。人工待办、执行位置、日志与完成产物始终可见。',64,555,1152,40,21,{color:C.muted});
  },
  17(s){
    title(s,'选数据时，先回答当前组合能做什么','任务标签用于找候选，适用性要绑定具体数据、本体、用途与配方');
    T(s,'asset-levels','来源条目  /  实际持有范围  /  本次回合视图',64,165,1152,39,25,{bold:true});
    table(s,[['核对方面','需要知道什么','用户得到什么'],['任务与用途','技能、场景、本轮范围；预训练或目标微调','相关性和缺失覆盖'],['观察与动作','模态、state/action、单位、参考系','可映射项与关键未知'],['时间与质量','对齐、频率、完整性、标定与任务标注','问题回合和排除理由'],['本体与控制','源/目标配置、手型、关节与控制范围','已支持适配或需新方案'],['配方与条件','读取器、版本、划分/统计、使用条件','检查结论与下一步']],64,221,1152,317,[175,580,397],21);
    T(s,'compatibility-outcomes','结论：条件满足 / 有已支持适配 / 缺材料 / 需新增适配。关键条件变化时复查。',64,553,1152,39,20.5,{color:C.muted});
  },
  async 18(s){
    title(s,'交互设计：当前条件与下一步放在首屏','独立可点击的方案原型，全部为示例，不连接设备或训练后端');
    await IMG(s,'docs/design/workbench_prototype/overview.jpg',64,167,794,430,'工作台方案原型：任务上下文、阶段导航、阻断与下一步');
    const labels=[['任务上下文','目标、数据、本体与配方同屏'],['当前阻断','说明缺项，提供直接补齐的入口'],['下一步与恢复','主要动作明确，失败保留输入']];
    labels.forEach(([a,b],i)=>{T(s,'ui-heading-'+i,a,900,181+i*137,316,39,26,{bold:true});T(s,'ui-detail-'+i,b,900,228+i*137,316,65,21,{color:C.muted});});
    const label='打开交互方案原型（离线）';
    const link=T(s,'open-prototype',label,900,574,316,27,18,{color:C.blue});
    link.text.get(label).link={uri:'prototype/index.html',isExternal:true};
  },
  19(s){
    title(s,'有限支持清单，按需增加适配后端','先完成一个 G1 配置和一个配方，再验证第二个组合能否复用流程');
    B(s,'shared-application',64,170,1152,72,C.soft,C.line);T(s,'shared-objects','共享工作台：任务 / 资产 / 回合视图 / 作业 / 结果与日志',88,185,1104,41,27,{bold:true,alignment:'center'});
    L(s,'shared-down',640,242,640,285,C.line,2);L(s,'backend-bus',190,285,1090,285,C.line,2);
    const cols=[['来源获取','Hub / 交付盘 / 网盘','新增来源与获取规则'],['遥操作采集','输入 / 控制 / 相机 / 记录','新增本体与采集后端'],['处理与训练','读取 / 映射 / 配方 / 评价','新增格式、策略与场景'],['部署执行','运行时 / 动作解释 / 设备','匹配模型与控制接口']];
    cols.forEach(([a,b,c],i)=>{const x=64+i*300;L(s,'backend-branch-'+i,x+126,285,x+126,329,C.blue,2,false,true);T(s,'backend-title-'+i,a,x,347,252,41,27,{bold:true});T(s,'backend-detail-'+i,b,x,400,252,70,21,{color:C.muted});T(s,'backend-change-'+i,c,x,485,252,48,20,{color:C.blue});});
    T(s,'backend-boundary','能接入新本体，与旧数据或模型能否迁移，分别判断和验收。厂商执行环境按实际支持系统运行。',64,553,1152,42,20.5,{color:C.muted});
  },
  20(s){
    title(s,'从基础原型到完整管线，分四阶段交付','沿用 M0–M4：当前为 M0 的部分基础，后续每阶段交付可验证结果');
    T(s,'current-foundation','当前 v0.1.2：本地导入、结构质检、自有 JSONL、日志与取消',64,165,1152,48,25,{bold:true});
    const xs=[190,490,790,1090];L(s,'roadmap',190,278,1090,278,C.line,2.5);
    const items=[['M1','采集与入库','设备预检、录制与可靠保存\n外部来源登记与样本整理','3 次会话，每次 10 回合'],['M2','处理、训练与仿真','固定适配与读取器\n一个配方真实训练和闭环','数据、模型与视频可追溯'],['M3','受限部署与回流','匹配模型包与控制接口\n失败样本形成补采待办','受限任务先做现场验收'],['M4','按需扩展','增加来源、配方或本体\n每次验证一个具体组合','复用工作流，独立验收']];
    items.forEach(([m,a,b,c],i)=>{const x=xs[i];D(s,'phase-dot-'+i,x,278,20,C.pale,C.blue);T(s,'phase-id-'+i,m,x-23,263,46,30,18,{color:C.blue,alignment:'center'});T(s,'phase-title-'+i,a,x-125,324,250,64,26,{bold:true,alignment:'center'});T(s,'phase-detail-'+i,b,x-132,398,264,85,20,{color:C.muted,alignment:'center'});T(s,'phase-check-'+i,c,x-132,500,264,53,20,{color:C.blue,alignment:'center'});});
    T(s,'roadmap-boundary','M3 验收后才称首个完整 G1 管线。双臂抓放通过，不代表完整抱箱行走已完成。',64,567,1152,31,20,{color:C.muted});
  },
  21(s){
    title(s,'用真实任务验收平台价值','先测现有流程基线，再比较任务完成、求助次数、错误和恢复成本');
    table(s,[['验收任务','拟验证的使用结果','证据'],['重复采集','初始化后，3 次会话各保存 10 回合','无需重复手工启动已接入服务'],['找回与选数','5 名试用者中至少 4 名独立完成','找对来源/范围，能解释适配缺项'],['失败后继续','保存或转换失败，仅恢复失败步骤','输入和成功产物保留，未完成输出隔离'],['复现一次实验','从评价结果找回数据、配置与模型','视图、划分、统计、权重、日志和视频']],64,176,1152,348,[175,490,487],22);
    T(s,'acceptance-boundary','以上是拟验收目标，尚无实测节省比例。平台流程成功与策略任务成功分开评价。',64,553,1152,42,21,{color:C.muted});
  }
};
for(const item of data){const s=map.get(item.contentPage);await renderers[item.contentPage](s);sources(s,item.sources,manifest.pages.find(m=>m.contentPage===item.contentPage).displayPage);notes(s,item);s.speakerNotes.text='精讲口述（建议45–75秒，实际以演练为准）\n\n'+item.shortScript+'\n\n'+(item.sources.length?'扩展讲稿与原始出处':'扩展讲稿')+'\n\n'+s.speakerNotes.text;}
const after=p.toProto();for(let i=0;i<18;i++)if(JSON.stringify(before.slides[i])!==JSON.stringify(after.slides[i]))throw new Error('Unexpected edit to preserved slide '+(i+1));
const owners=p.slides.items.flatMap((s,i)=>s.tables.items.length?[i+1]:[]);
const candidatePath=path.join(attempt,'candidate.pptx');await(await PresentationFile.exportPptx(p)).save(candidatePath);
const finalPath=path.join(out,'具身智能数据管线报告_v13.pptx');
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath,finalPath,explicitTotalSlideCount:25,requiredNativeTableOwnerSlides:owners,requiredNativeChartOwnerSlides:[],pythonExecutable:path.join(RUNTIME,'python/bin/python3'),integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit',...owners.flatMap(i=>['--require-native-table-slide',String(i)])],fontPolicy:{basis:'design',families:[FONT]},verifyArtifactToolImport:true,receiptPath:path.join(attempt,'validation.json')});
await fs.copyFile(path.join(attempt,'validation.json'),path.join(build,'validation.json'));
await fs.writeFile(path.join(build,'preserved-slides.json'),JSON.stringify({source:'v12',preservedPhysicalSlides:[1,18],changedPhysicalSlides:[19,25],slideCount:25,sha256:result.finalSha256},null,2));
console.log(JSON.stringify({finalPath,slideCount:25,findings:result.presentationLayout.findingCount},null,2));
