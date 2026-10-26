'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const pages = [['overview','任务总览'],['capture','采集会话'],['assets','数据资产'],['prepare','准备训练数据'],['train','训练与评估'],['deploy','部署与回流'],['runs','运行记录']];
  const assets = [
    {id:'self',name:'自采样本 · 原地抓放',source:'自行采集',scope:'12 个示例回合',task:'双臂抓取与放置',robot:'G1 / 演示双臂双手配置',format:'原始 JSON + 图像',issue:'动作单位需要核实',use:'本轮抓放候选，未覆盖负载行走',fact:'来源声明与样本结构分开保存；动作维数不等于整机自由度。'},
    {id:'open',name:'公开轨迹 · 格式示例',source:'公开数据',scope:'仅样本 · 4 个回合',task:'烤面包操作',robot:'来源 G1 / 手型待核实',format:'LeRobot / 版本待核实',issue:'任务和控制范围有差异',use:'操作预训练研究候选，不能直接证明搬箱适用',fact:'这里只是示例条目，没有实际下载公开数据；源任务不会被目标任务覆盖。'},
    {id:'buy',name:'采购交付 · 清单示例',source:'采购交付',scope:'仅登记 · 尚无文件',task:'供应商声明：箱体搬运',robot:'待供应商说明',format:'待交付样本',issue:'缺样本、动作与相机说明',use:'先索取小样与交付契约，再判断是否值得完整获取',fact:'登记不等于已持有，名称和标签不构成可训练证据。'}
  ];
  const state = {page:'overview',capture:'未连接',episodes:0,failNext:false,selected:'self',query:'',source:'全部来源',register:false,viewId:'self',unit:false,mapped:false,read:false,recipe:'act',trained:false,evaluated:false,runs:[],message:''};
  const escape = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const btn=(label,action,primary=false,disabled=false)=>`<button type="button" data-action="${action}" ${primary?'class="primary"':''} ${disabled?'disabled':''}>${label}</button>`;
  const tag=(label,tone='')=>`<span class="status ${tone}">${label}</span>`;
  const heading=(title,desc)=>`<div class="eyebrow">搬箱任务 / 本轮受限抓放</div><h1>${title}</h1><p class="lede">${desc}</p>`;
  const context=()=>`<div class="context-line"><span>数据视图 <strong>${escape(assets.find(a=>a.id===state.viewId).name)} / ${escape(assets.find(a=>a.id===state.viewId).scope)}</strong></span><span>本体 <strong>G1 演示配置</strong></span><span>配方 <strong>${state.recipe==='act'?'ACT':'Diffusion Policy'}</strong></span><span>执行位置 <strong>待登记的 Linux Host</strong></span></div>`;
  function message(text){state.message=text;$('message').textContent=text;$('message').hidden=false;}
  function log(title,detail,status='完成'){state.runs.unshift({title,detail,status,time:new Date().toLocaleTimeString('zh-CN',{hour12:false})});}
  function navigate(page){state.page=page;state.message='';render();$('main').focus({preventScroll:true});}
  function overview(){
    const labels=['数据取得','检查整理','准备输入','训练','仿真评估','部署'];
    const routes=['assets','prepare','prepare','train','train','deploy'];
    const current=!state.unit?1:!state.read?2:!state.trained?3:!state.evaluated?4:5;
    const progress=['已有示例样本',state.unit?'示例单位已确认':'需要确认动作单位',state.read?'示例读取通过':state.mapped?'等待读取验收':'等待适配',state.trained?'演示流程完成':'尚未验证',state.evaluated?'已有演示记录':'尚未验证','尚未验证'];
    const nextTitle=!state.unit?'来源动作单位尚未核实':!state.read?'当前配方的读取检查尚未完成':!state.trained?'输入已准备，可进入训练':!state.evaluated?'已有模型演示记录，可安排闭环评价':'示例评价已记录，部署仍需真实条件';
    const nextDetail=!state.unit?'样本可以入库和预览。完成单位说明与相机映射后，才能检查这份数据是否满足当前配方。':!state.read?'源语义和可复用映射保留。完成当前配方读取验收后再运行训练。':!state.evaluated?'按选定配方与执行机组织实验，读取、训练和评价结果分别记录。':'原型不连接设备。到货配置、真实模型与现场验收准备完成后，才能讨论实机启用。';
    const nextPage=!state.read?'prepare':!state.evaluated?'train':'deploy';
    return heading('让下一步清楚可见','先确认任务、数据与配方，再运行当前条件允许的步骤。总目标与本轮验收范围分别保留。')+context()+
      `<div class="stage-line">${labels.map((x,i)=>`<button class="stage ${i===current?'active':''}" data-page="${routes[i]}"><strong>0${i+1}</strong><span>${progress[i]}</span>${x}</button>`).join('')}</div>`+
      `<div class="split"><section><h2>当前要解决的问题</h2><div class="notice"><strong>${nextTitle}</strong><p>${nextDetail}</p></div><div class="actions">${btn(nextPage==='prepare'?'查看差异并准备数据':nextPage==='train'?'进入训练与评估':'查看部署条件','go-'+nextPage,true)}${btn('先采集新的回合','go-capture')}</div><p class="small">如果已有兼容产物，可以复用；外部数据无需从第一步全部重做。</p></section><section><h2>两类数据入口</h2><div class="route-step"><span>01</span><div><h3>自己采集</h3><p>复用设备档案，逐项准备服务，录制后等待保存完成再入库。</p><button class="link-button" data-page="capture">查看采集流程</button></div></div><div class="route-step"><span>02</span><div><h3>公开或采购数据</h3><p>先登记和取样，确认用途与适配缺项，再决定获取范围。</p><button class="link-button" data-page="assets">查看资产与来源</button></div></div></section></div>`+
      `<section class="section"><h2>当前实现与理想方案分开说明</h2><p class="small">v0.1.2 已支持本地导入、结构质检、自有 JSONL 导出和运行记录。本原型展示未来采集、适用性、训练与部署交互，全部为演示。</p></section><details><summary>可选自动串联：运行到仿真评价</summary><p class="small">准备输入、读取检查、训练、仿真依次运行。缺关键说明时等待人工，复用已经成功的步骤，不自动进入真实部署。</p><div class="actions">${btn('演示运行到仿真评价','chain')}</div></details>`;
  }
  function capture(){
    const ready=state.capture!=='未连接'&&state.capture!=='状态未知';
    let actions='';
    if(state.capture==='未连接')actions=btn('演示只读预检与准备','preflight',true);
    if(state.capture==='等待头显')actions=btn('演示头显已进入 XR','xr',true);
    if(state.capture==='可启用跟随')actions=btn('演示启用跟随','follow',true);
    if(state.capture==='跟随中')actions=btn('演示开始录制','record',true)+btn('演示结束会话','end');
    if(state.capture==='录制中')actions=btn('演示结束并保存','save',true);
    if(state.capture==='保存中')actions=btn('演示保存中…','none',true,true);
    if(state.capture==='保存失败')actions=btn('演示重试保存','retry-save',true)+btn('查看失败记录','go-runs');
    if(state.capture==='状态未知')actions=btn('演示重新查询状态','reconnect',true);
    const tone=state.capture==='保存失败'||state.capture==='状态未知'?'bad':ready?'good':'';
    return heading('采集会话','首次配置设备与环境，以后复用档案。只读检查、控制启用和录制分别呈现。')+
      `<div class="context-line"><span>设备档案 <strong>G1 / 双臂抓放 / 示例</strong></span><span>输出 <strong>Host 受管理回合目录</strong></span><span>说明 <strong>没有连接机器人</strong></span></div>`+
      `<div class="state-title"><strong>${escape(state.capture)}</strong>${tag('演示状态',tone)}<span>本次已完成 ${state.episodes} 个演示回合</span></div>`+
      `<div class="split wide"><section><h2>设备与准备条件</h2><ul class="check-list"><li><span>Host · 环境、网卡、只读状态</span>${tag(ready?'示例检查通过':'尚未检查',ready?'good':'')}</li><li><span>PC2 · 相机服务与新鲜帧</span>${tag(ready?'示例检查通过':'尚未检查',ready?'good':'')}</li><li><span>Vision Pro · Safari XR 会话</span>${tag(['等待头显','未连接','状态未知'].includes(state.capture)?'等待人工':'示例已连接','warn')}</li><li><span>控制范围 · 本轮双臂抓放</span>${tag(['跟随中','录制中','保存中','保存失败'].includes(state.capture)?'演示跟随已启用':'尚未启用')}</li></ul><div class="actions">${actions}</div><p class="small">${state.capture==='保存失败'?'保存未完成，回合保持隔离，不进入资产库。修复后只恢复保存步骤。':state.capture==='状态未知'?'连接丢失后先查询真实状态，不盲目重发录制切换命令。':'保存完成事件与文件清单确认后才登记资产。停止录制与退出遥操作分开。'}</p></section><section><div class="preview"><strong>图像与状态预览</strong><span>正式版显示真实相机与时间戳</span><span class="small">此原型无摄像头、SDK 或动作输出</span></div><label class="choice"><input type="checkbox" id="fail-next" ${state.failNext?'checked':''}>下一次保存演示失败</label><div class="actions">${btn('演示连接中断','disconnect',false,!ready||state.capture==='保存中')}</div></section></div>`;
  }
  function assetView(){
    const filtered=assets.filter(x=>(state.source==='全部来源'||state.source===x.source)&&[x.name,x.task,x.robot].some(s=>s.toLowerCase().includes(state.query.toLowerCase())));
    const selected=filtered.find(x=>x.id===state.selected)||filtered[0];
    if(selected)state.selected=selected.id;
    return heading('数据资产与来源','来源可以先登记，数据可以只取样。能找到、能读取与适合当前任务分别判断。')+
      `<div class="toolbar"><input id="asset-query" aria-label="搜索数据资产" placeholder="搜索名称、原始任务或本体" value="${escape(state.query)}"><select id="asset-source" aria-label="筛选来源">${['全部来源','自行采集','公开数据','采购交付'].map(x=>`<option ${x===state.source?'selected':''}>${x}</option>`).join('')}</select>${btn('登记外部来源','register',true)}</div>`+
      (state.register?`<form id="source-form" class="notice"><strong>登记来源，暂不下载</strong><div class="field"><label for="source-kind">来源类别</label><select id="source-kind"><option>公开数据</option><option selected>采购交付</option></select></div><div class="field"><label for="source-name">来源名称</label><input id="source-name" required maxlength="100" placeholder="例如：供应商第一批试采"></div><div class="field"><label for="source-url">网址、Hub ID 或交付说明</label><input id="source-url" required maxlength="500" placeholder="只登记说明，不自动访问"></div><p class="small">本原型只登记本页示例，不联网、不下载。正式版先识别来源与版本，再由用户选范围和执行位置。</p><div class="actions"><button class="primary" type="submit">登记示例来源</button>${btn('取消','register')}</div></form>`:'')+
      `<div class="split wide"><section><div class="table-wrap"><table><thead><tr><th>数据 / 原始任务</th><th>来源与持有范围</th><th>当前缺项</th></tr></thead><tbody>${filtered.map(x=>`<tr class="${x.id===state.selected?'selected':''}"><td><button class="table-button" data-asset="${x.id}">${escape(x.name)}<span class="row-description">${escape(x.task)}</span></button></td><td>${escape(x.source)}<span class="row-description">${escape(x.scope)}</span></td><td>${escape(x.issue)}</td></tr>`).join('')||'<tr><td colspan="3">没有匹配结果。可清空筛选，不会修改数据。</td></tr>'}</tbody></table></div><p class="small">${filtered.length} 条示例记录。任务标签只缩小候选范围，不直接放行训练。</p></section><section><h2>选中资产的档案</h2>${selected?`<dl class="definition"><dt>原始任务</dt><dd>${escape(selected.task)}</dd><dt>来源本体</dt><dd>${escape(selected.robot)}</dd><dt>组织方式</dt><dd>${escape(selected.format)}</dd><dt>实际持有</dt><dd>${escape(selected.scope)}</dd><dt>本次用途</dt><dd>${escape(selected.use)}</dd></dl><p class="small">${escape(selected.fact)}</p><div class="actions">${btn('加入任务并检查适用性','asset-prepare',true,selected.source!=='自行采集')}</div>${selected.source!=='自行采集'?'<p class="small">示例展示缺项路径，未接入该来源读取器。先补资料与样本，不直接转换。</p>':''}`:'<p class="small">当前筛选没有结果，不显示其他资产的旧详情。</p>'}</section></div>`;
  }
  function prepare(){
    const recipe=state.recipe==='act'?'ACT：动作块与训练窗口由配方定义':'Diffusion：观察历史、预测窗口与归一化由配方定义';
    return heading('准备当前配方的训练输入','先解释差异，再运行已有适配。相同存储容器不代表所有策略都能直接使用。')+context()+
      `<div class="toolbar"><label>训练配方 <select id="recipe"><option value="act" ${state.recipe==='act'?'selected':''}>ACT</option><option value="diffusion" ${state.recipe==='diffusion'?'selected':''}>Diffusion Policy</option></select></label><span class="small">${recipe}</span></div>`+
      `<div class="table-wrap"><table><thead><tr><th>需要核对</th><th>当前情况</th><th>处理与证据</th></tr></thead><tbody><tr><td>动作含义与单位</td><td>${tag(state.unit?'演示说明已补齐':'来源单位未知',state.unit?'good':'bad')}</td><td>${state.unit?'示例假设：目标关节位置 / rad，仍需真实材料核验':btn('补齐单位说明（演示）','unit')}</td></tr><tr><td>相机名称与字段</td><td>${tag(state.mapped?'演示映射已完成':'有已支持映射',state.mapped?'good':'blue')}</td><td>预览：源相机字段映射到配方观察键，保留原件</td></tr><tr><td>任务与控制范围</td><td>${tag('仅本轮抓放','warn')}</td><td>不覆盖负载行走，完整搬箱需要额外数据与验证</td></tr><tr><td>划分与增强</td><td>${tag('按母回合固定划分')}</td><td>增强仅作用训练集合，派生继承母回合划分</td></tr><tr><td>目标后端读取</td><td>${tag(state.read?'演示读取检查通过':'尚未验收',state.read?'good':'')}</td><td>绑定数据视图、本体配置与当前配方，切换配方需复查</td></tr></tbody></table></div>`+
      `<div class="actions">${btn('演示运行已有映射','map',false,!state.unit||state.mapped)}${btn('演示训练读取检查','read',true,!state.unit||!state.mapped||state.read)}${btn('进入训练','go-train',false,!state.read)}</div><p class="small">${!state.unit?'当前阻断：请先核实动作单位。允许保留和预览资产。':!state.mapped?'下一步运行已支持映射，不修改原始数据。':!state.read?'下一步做当前配方读取检查；转换结束不代表训练已经完成。':'当前是原型演示通过，正式版必须实际调用目标后端加载样本。'}</p><details><summary>展开配置与失效规则</summary><p class="small">换配方后保留原始数据、已确认的源语义与可复用映射，相关读取结论需复查。源版本、动作定义、相机、本体或控制范围变化时，重新评估受影响步骤。</p></details>`;
  }
  function train(){return heading('训练与闭环评估','训练产物、仿真结果和真机验证分别保留，不用离线损失替代任务效果。')+context()+
    `<section class="section"><h2>运行前确认</h2><dl class="definition"><dt>输入条件</dt><dd>${state.read?'当前示例配方的读取检查已演示通过':'尚未完成读取检查，请先准备训练数据'}</dd><dt>运行位置</dt><dd>示例 Linux 执行机，真实环境与算力待核实</dd><dt>运行预算</dt><dd>正式版指定步数、时间与资源；本页不消耗算力</dd><dt>绑定产物</dt><dd>数据视图、划分、统计、配方、模型权重和日志</dd></dl><div class="actions">${btn(state.trained?'演示训练已完成':'演示训练流程','train',true,!state.read||state.trained)}${btn('返回准备数据','go-prepare')}</div></section>`+
    `<section class="section"><h2>匹配场景闭环评价</h2><p>${state.evaluated?'已生成一条演示评价记录。成功率、视频和任务效果仍待真实运行。':'训练完成后，在匹配本体、传感器、控制器和成功规则的环境中评价。'}</p><div class="actions">${btn('演示建立评价记录','evaluate',false,!state.trained||state.evaluated)}${btn('查看部署条件','go-deploy')}</div><p class="small">拟保存：场景/随机种子、模型、成功判据、成功与失败、视频、中止原因。原型不虚构实测成功率。</p></section>`;}
  function deploy(){return heading('部署与数据回流','模型、输入处理与动作执行接口一起核对，先验收已定义的控制范围。')+`<div class="notice"><strong>尚不能进入真实部署</strong><p>到货设备选配、控制模式、真实模型包和现场验收均未核实。本原型不提供实际机器人控制。</p></div><div class="table-wrap"><table><thead><tr><th>匹配条件</th><th>需要的证据</th><th>当前状态</th></tr></thead><tbody><tr><td>设备与控制</td><td>型号/手型、SDK、控制范围、动作解释器</td><td>待现场核实</td></tr><tr><td>模型包</td><td>权重、统计、观察/动作定义与配方版本</td><td>${state.trained?'仅有演示记录':'未生成'}</td></tr><tr><td>场景与停止流程</td><td>受限任务评价、正常退出、现场回退</td><td>未完成真实验收</td></tr></tbody></table></div><section class="section"><h2>从问题返回数据需求</h2><p class="small">例如评价发现“桌 B 放置样本不足”，保留对应模型与回合，再建立补采待办。</p><div class="actions">${btn('演示建立补采待办','feedback',true)}${btn('查看运行记录','go-runs')}</div></section>`;}
  function runs(){return heading('运行记录与恢复','记录属于哪个阶段、在哪里执行、用了什么输入，以及失败后能继续什么。')+(state.runs.length?state.runs.map(r=>`<div class="run-item"><span class="time">${r.time}</span><div><strong>${escape(r.title)}</strong><p>${escape(r.detail)}</p></div>${tag(r.status,r.status==='失败'?'bad':r.status==='等待人工'?'warn':'good')}</div>`).join(''):'<p class="empty">暂无演示作业。可先体验采集保存失败或数据准备，随后在这里查看过程。</p>')+`<p class="small">所有记录仅存在于本原型内存，刷新或重置即可恢复初始状态，不写入正式工作区。</p>`;}
  function design(){return heading('原型范围与使用说明','此处用于讨论未来的交互和信息组织，不是已经接通硬件的产品。')+`<section class="section"><h2>建议体验顺序</h2><p>先看任务总览，再进入采集会话，演示准备、XR、跟随、录制与保存。勾选“下一次保存演示失败”，观察恢复路径。</p><p>进入数据资产筛选公开或采购来源，查看已持有范围与缺项。回到自采样本进入准备数据，补齐演示单位、运行映射并做读取检查。切换配方后观察读取结论需复查。</p><p>最后看训练、部署与运行记录。所有按钮中的“演示”都不会调用网络、SDK、训练器或机器人。</p></section><section class="section"><h2>当前生产版本</h2><p>v0.1.2 支持本机目录导入、结构质检、自有 JSONL 导出与运行记录。此原型中的采集、适用性、训练、评价和部署是后续设计。</p><p class="small">本原型无系统路径控件。正式版本机目录用原生选择器，远程路径通过已登记执行机单独校验。</p></section>`;}
  function render(){
    const focusId=document.activeElement?.id;
    $('nav').innerHTML=pages.map(([id,name])=>`<button type="button" data-page="${id}" ${state.page===id?'aria-current="page"':''}>${name}</button>`).join('');
    const views={overview,capture,assets:assetView,prepare,train,deploy,runs,design};$('content').innerHTML=views[state.page]();
    $('message').textContent=state.message;$('message').hidden=!state.message;
    if(['recipe','asset-source','fail-next'].includes(focusId))$(focusId)?.focus({preventScroll:true});
  }
  function saving(fail){state.capture='保存中';render();setTimeout(()=>{if(state.capture!=='保存中')return;if(fail){state.capture='保存失败';state.failNext=false;log('演示回合保存','文件清单未完成，未登记资产，可只恢复保存步骤。','失败');}else{state.capture='跟随中';state.episodes++;assets.push({id:'session-'+state.episodes,name:'采集会话 · 演示回合 '+state.episodes,source:'自行采集',scope:'1 个完成的演示回合',task:'本轮受限双臂抓放',robot:'G1 / 演示双臂双手配置',format:'原始回合与完成清单（示例）',issue:'仍需数据与语义检查',use:'本轮抓放候选，未覆盖负载行走',fact:'来自原型的保存完成事件，没有产生真实文件。'});log('演示回合已完成并登记','已确认示例完成事件与文件清单；下游可进入检查。');}render();},450);}
  document.addEventListener('click',event=>{
    const node=event.target.closest('button,a');if(!node)return;
    if(node.dataset.page){event.preventDefault();navigate(node.dataset.page);return;}
    if(node.dataset.asset){state.selected=node.dataset.asset;render();return;}
    const action=node.dataset.action;if(!action)return;
    if(action.startsWith('go-')){navigate(action.slice(3));return;}
    if(action==='preflight'){state.capture='等待头显';log('演示只读预检与服务准备','示例Host/PC2已准备，等待操作者在Vision Pro进入XR。');}
    if(action==='xr'){state.capture='可启用跟随';log('演示XR已连接','检查示例输入新鲜度，控制尚未启用。');}
    if(action==='follow'){state.capture='跟随中';log('演示跟随已启用','范围仅为本轮示例双臂抓放。');}
    if(action==='record'){state.capture='录制中';log('演示开始录制','只表示正在记录，尚无完成资产。');}
    if(action==='save'){saving(state.failNext);return;}
    if(action==='retry-save'){saving(false);return;}
    if(action==='disconnect'){state.capture='状态未知';log('演示连接丢失','先查询真实状态，不自动重发控制或录制命令。','失败');}
    if(action==='reconnect'){state.capture='等待头显';log('演示重新核对状态','未完成回合保留待核对，重新检查XR和控制准备。');}
    if(action==='end'){state.capture='未连接';log('演示正常结束会话','仅清理本次管理的服务，不重启厂商基础栈。');}
    if(action==='register')state.register=!state.register;
    if(action==='asset-prepare'){if(state.viewId!==state.selected){state.viewId=state.selected;state.unit=false;state.mapped=false;state.read=false;state.trained=false;state.evaluated=false;}navigate('prepare');return;}
    if(action==='unit'){state.unit=true;assets.find(a=>a.id===state.viewId).issue='示例单位说明已补，仍需配方检查';log('演示补充单位材料','仅作原型假设，不是实物数据事实。');}
    if(action==='map'){state.mapped=true;log('演示已有字段映射','原始资产保持不变；尚需训练读取检查。');}
    if(action==='read'){state.read=true;log('演示训练读取检查','绑定当前配方的示例结论，不表示实际调用训练器。');}
    if(action==='train'){state.trained=true;log('演示训练流程','展示输入/配置/模型绑定，无真实训练和loss。');}
    if(action==='evaluate'){state.evaluated=true;log('演示闭环评价记录','实际成功率、视频和效果待真实运行。');}
    if(action==='chain'){if(!state.unit){state.page='prepare';log('演示串联等待人工','动作单位未知，尚未执行映射、读取或训练。','等待人工');render();message('串联已停在资料补齐步骤，完成关键说明后才能继续。');return;}state.mapped=true;state.read=true;state.trained=true;state.evaluated=true;log('演示串联到仿真评价','按所选示例配方依次准备、读取、训练和评价，不进入真实部署。');state.page='train';}
    if(action==='feedback'){log('演示补采待办','桌B放置样本不足，关联当前示例实验，待人工确认。');state.page='runs';}
    render();
  });
  document.addEventListener('change',event=>{if(event.target.id==='fail-next')state.failNext=event.target.checked;if(event.target.id==='asset-source'){state.source=event.target.value;render();}if(event.target.id==='recipe'){state.recipe=event.target.value;state.read=false;state.trained=false;state.evaluated=false;render();message('配方已切换，原件和可复用映射保留，相关读取与实验结论需复查。');}});
  document.addEventListener('input',event=>{if(event.target.id!=='asset-query')return;state.query=event.target.value;const start=event.target.selectionStart;render();$('asset-query').focus();$('asset-query').setSelectionRange(start,start);});
  document.addEventListener('submit',event=>{if(event.target.id!=='source-form')return;event.preventDefault();const name=$('source-name').value.trim(),location=$('source-url').value.trim();if(!name||!location)return;assets.push({id:'new-'+assets.length,name,source:$('source-kind').value,scope:'仅登记 · 尚无文件',task:'待来源说明',robot:'未知',format:'待取样核实',issue:'缺样本和字段说明',use:'先登记，不自动放行训练',fact:'登记说明：'+location});state.selected=assets.at(-1).id;state.register=false;state.query='';state.source='全部来源';log('演示登记外部来源','未访问来源地址、未下载文件。');render();message('来源示例已登记，尚无文件。下一步先获取样本和关键说明。');});
  $('reset').addEventListener('click',()=>location.reload());$('design-link').addEventListener('click',event=>{event.preventDefault();navigate('design');});
  render();
})();
