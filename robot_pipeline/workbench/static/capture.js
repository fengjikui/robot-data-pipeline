/* Real capture intents and per-episode receipts. Editors survive status polling. */
(() => {
  'use strict';
  const app=window.Workbench, $=id=>document.getElementById('capture-'+id);
  if(!app||!$('session-root'))return;
  const names={disconnected:'尚未准备采集',connecting:'正在连接采集电脑',idle:'采集电脑已连接',starting:'正在准备采集',ready:'可以启用随动',following:'可以开始录制',recording:'正在录制',saving:'正在保存回合',stopping:'正在结束服务',stopped:'本次采集已结束',failed:'采集服务出现问题',error:'回合保存出现问题',unknown:'连接状态待核对'};
  const busyStates=['starting','ready','following','recording','saving','stopping','unknown'];
  let snapshot=null,mode='real',busy=false,initialized=false,polling=false,lastAssetSignature='',collapseOnConnect=false,lastCriticalState='',receiptSignature='';
  function element(tag,text,cls){const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;}
  function feedback(text,error=false){$('session-message').textContent=text;$('session-message').className='capture-notice'+(error?' error':snapshot?.runtime?.synthetic?' synthetic':'');}
  function loadFields(){const c=snapshot?.connections?.[mode];$('transport').value=c?.transport||'local';$('ssh').value=c?.ssh_alias||'';$('agent-python').value=c?.agent_python||'';$('profile-directory').value=c?.profile_directory||'';transportFields();}
  function transportFields(){const remote=$('transport').value==='ssh';$('ssh').disabled=!remote;$('python-picker').disabled=remote;$('profile-picker').disabled=remote;$('path-note').textContent=remote?'填写 Linux 执行机上的绝对路径；系统选择器只能选择本机目录。':'配置文件固定设备、依赖服务与输出目录；浏览器不传入任意命令。';}
  function render(value){
    snapshot=value;const runtime=value.runtime||{};const globalState=value.connected?runtime.state:'disconnected';$('global-status').hidden=!['starting','ready','following','recording','saving','stopping','unknown','error'].includes(globalState);$('global-status').textContent=(runtime.synthetic?'合成试运行':globalState==='recording'?'正在录制':globalState==='following'?'遥操作随动中':'采集服务运行中')+' · 返回采集';const same=value.connected&&value.mode===mode,state=same?runtime.state:value.mode===mode&&value.busy?'connecting':'disconnected',synthetic=same?runtime.synthetic:Boolean(value.connections?.[mode]?.synthetic_trial);
    if(!initialized){initialized=true;mode=value.mode||'real';$('mode').value=mode;loadFields();}
    if(collapseOnConnect&&same){$('connect-details').open=false;collapseOnConnect=false;}
    const title=state==='starting'&&runtime.pending?.intent==='follow'?'正在启用随动':state==='starting'&&runtime.pending?.intent==='record_start'?'正在开始录制':names[state]||state;
    $('runtime-badge').textContent=title;$('state-title').textContent=title;
    $('runtime-badge').className='badge '+(['failed','error','unknown'].includes(state)?'bad':['ready','following'].includes(state)?'good':state==='recording'?'running':'neutral');
    $('backend-note').textContent=synthetic?'合成数据试运行：未连接机器人或 GPU 仿真器，所有回合保留合成标记。':same?'Unitree 执行器 · '+(mode==='real'?'真机模式':'仿真模式')+' · 实际设备与 XR 状态仍需现场核对。':'首次使用先配置执行机；也可以用合成数据试运行整条流程。';
    const active=same&&busyStates.includes(state);$('mode').disabled=busy||Boolean(value.busy)||active;$('trial').disabled=busy||Boolean(value.busy)||active;$('connect').disabled=busy||Boolean(value.busy)||active;
    $('restore-connection').hidden=!value.trial_previous_available?.[mode];$('restore-connection').disabled=busy||active;
    const critical=['failed','error','unknown'].includes(state);
    if(critical&&lastCriticalState!==state)$('operator-ready').checked=false;lastCriticalState=critical?state:'';
    $('ready-label').hidden=synthetic&&!critical;$('operator-ready').disabled=busy||active&&!critical;
    $('ready-text').textContent=critical?'已在现场核对状态，允许清理本次失败进程；清理不代表控制释放已验证':'已核对头显、控制模式与动作范围；本次启动包含控制初始化';
    const allowed={start_services:Boolean(value.connections?.[mode])&&['disconnected','idle','stopped'].includes(state)&&(synthetic||$('operator-ready').checked),follow:same&&state==='ready',record_start:same&&state==='following'&&!runtime.pending,record_stop:same&&(state==='recording'||runtime.upstream?.RECORD_RUNNING===true)&&!runtime.pending,stop_services:same&&['ready','following','failed','error','unknown'].includes(state)&&!runtime.pending,cleanup:same&&critical&&$('operator-ready').checked};
    document.querySelector('[data-capture-action=cleanup]').hidden=!critical;
    for(const button of document.querySelectorAll('[data-capture-action]')){
      const action=button.dataset.captureAction;button.disabled=busy||Boolean(value.busy)||!allowed[action];
      button.hidden=action==='start_services'?!['disconnected','idle','stopped'].includes(state):action==='cleanup'?!critical:!allowed[action];
      if(['start_services','follow'].includes(action))button.classList.add('primary');
    }
    $('record-detail').textContent=runtime.active_episode?'当前回合 '+runtime.active_episode.id.slice(0,8):runtime.session_id?'会话 '+runtime.session_id.slice(0,8):'';
    const current=state==='recording'?'recording':state==='saving'?'saving':state==='following'?'following':'services';
    for(const n of document.querySelectorAll('[data-capture-stage]')){if(n.dataset.captureStage===current&&same)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');}
    if(runtime.error||value.last_error)feedback(runtime.error||value.last_error,true);
    else if(synthetic)feedback('这是可操作的合成采集试运行。启动服务、启用随动后可开始录制，停止保存后会自动入库和质检。');
    else if(state==='recording')feedback('正在录制。结束本回合请点“停止并保存回合”，不要直接结束服务。');
    else if(state==='saving')feedback('记录器正在完成写入；完成事件到达后自动接收，部分文件不会提前入库。');
    else if(same)feedback(state==='ready'?'服务已准备好。请连接头显、完成姿态对齐后启用随动。':state==='following'?'确认现场画面和动作正常后开始录制。回合保存、入库和检查由工作台处理。':state==='stopped'?'本次采集已结束，已保存的数据和检查结果会保留。可以继续整理数据。':'当前状态：'+(names[state]||state)+'。工作台会显示下一步可做的操作。');
    $('action-note').textContent=synthetic?'试运行只生成合成数据，每回合最长约30秒后自动保存。可继续采集下一回合。':state==='following'?'随动状态来自上游反馈；确认现场追踪和动作正确后开始录制。':'启动服务包含上游控制初始化；“结束服务”是正常退出流程，不是硬件急停。';
    renderReceipts(value.episodes||[]);
    const list=$('service-list');list.replaceChildren();for(const s of runtime.services||[]){const row=element('div',null,'capture-service-line');row.append(element('span',s.name),element('span',(s.owned?'本次管理':'复用服务')+' · '+(s.running?'运行中':s.state==='reachable'?'可达':s.exit_code!=null?'已退出（'+s.exit_code+'）':s.state||'待检查'),'muted'));list.append(row);}
    const logs=(runtime.services||[]).filter(s=>s.log).map(s=>'['+s.name+']\n'+s.log).join('\n\n');
    const text=logs||value.connection_log||'连接执行器后显示实际日志。';if($('session-log').textContent!==text)$('session-log').textContent=text;
  }
  function renderReceipts(items){
    const signatureNow=JSON.stringify(items);
    if(signatureNow===receiptSignature)return;
    const focused=document.activeElement;
    if(focused?.tagName==='SELECT'&&focused.closest('#capture-episode-list')&&!focused.disabled)return;
    receiptSignature=signatureNow;
    $('receipt-count').textContent=items.length+' 个回合';const box=$('episode-list');box.replaceChildren();
    if(!items.length){box.append(element('p','尚无已保存回合。结束一次录制后，这里会显示接收进度。','quality-empty'));return;}
    const statusNames={waiting:'等待接收',packaging:'采集端整理文件',transferring:'接收文件中',registering:'正在入库',registered:'已入库',queued:'已入库 · 等待质检',failed:'接收失败'};
    const signature=items.map(i=>i.asset_id||'').filter(Boolean).join(',');
    if(lastAssetSignature&&signature!==lastAssetSignature)app.refresh({quiet:true});lastAssetSignature=signature;
    for(const item of items){
      const row=element('div',null,'capture-receipt'),info=element('div');info.append(element('strong',item.task||'采集回合'),element('small',(item.synthetic?'合成试运行 · ':'')+(item.mode==='real'?(item.synthetic?'真机流程演练':'真机采集'):(item.synthetic?'仿真流程演练':'仿真采集'))+' · '+item.frames+' 帧 · '+new Date(item.created_at).toLocaleTimeString()));
      let label=statusNames[item.status]||item.status;
      if(item.quality_status==='succeeded')label='已入库 · 结构质检通过';
      else if(item.quality_status==='failed')label='已入库 · 质检有问题';
      else if(item.quality_status==='running')label='已入库 · 正在质检';
      else if(['cancelled','interrupted'].includes(item.quality_status))label='已入库 · 质检'+(item.quality_status==='cancelled'?'已取消':'已中断');
      const progress=element('div',label,'field-note');
      if(item.status==='transferring'){const bar=document.createElement('progress');bar.max=item.bytes_total||1;bar.value=item.bytes_received||0;bar.setAttribute('aria-label','回合文件接收进度');progress.append(bar);}
      if(item.error)info.append(element('small',item.error,'capture-receipt-error'));
      const actions=element('div',null,'capture-receipt-actions');
      if(item.data_episode_id){const result=document.createElement('select');result.setAttribute('aria-label','任务结果 '+item.id.slice(0,8));for(const [key,text] of [['unlabeled','结果待判断'],['success','任务成功'],['failure','任务失败'],['interrupted','任务中断']])result.add(new Option(text,key));result.value=item.annotation?.result||'unlabeled';result.addEventListener('change',async()=>{result.disabled=true;try{await app.api('/api/episodes/'+item.data_episode_id+'/annotation',{result:result.value,note:item.annotation?.note||'',revision:item.annotation?.revision||0});window.PreparationWorkbench?.refreshEpisodes();await refresh();}catch(error){feedback(error.message,true);result.disabled=false;}});actions.append(result);}
      if(item.asset_id){const b=element('button','查看回合 →','text-button');b.type='button';b.addEventListener('click',async()=>{window.WorkbenchShell?.showView('task');await window.PreparationWorkbench?.previewAsset(item.asset_id);});actions.append(b);}
      if(item.quality_job_id){const b=element('button','质检记录','text-button');b.type='button';b.addEventListener('click',()=>window.WorkbenchShell?.openRun(item.quality_job_id));actions.append(b);}
      if(['failed','cancelled','interrupted'].includes(item.quality_status)){const b=element('button','重新检查','text-button');b.type='button';b.disabled=busy;b.addEventListener('click',()=>run('retry_quality',{episode_id:item.id}));actions.append(b);}
      if(item.status==='failed'){const b=element('button','重试接收','text-button');b.type='button';b.disabled=busy;b.addEventListener('click',()=>run('retry_ingest',{episode_id:item.id}));actions.append(b);}
      row.append(info,progress,actions);box.append(row);
    }
  }
  async function refresh(){if(polling)return;polling=true;try{render(await app.api('/api/capture/state'));}catch(error){feedback(error.message,true);}finally{polling=false;}}
  async function perform(fn){if(busy)return;busy=true;if(snapshot)render(snapshot);try{await fn();await refresh();}catch(error){feedback(error.message,true);app.notify(error.message,'error',true);}finally{busy=false;if(snapshot)render(snapshot);}}
  async function run(action,extra={}){await perform(async()=>{await app.api('/api/capture/action',{action,mode,request_id:crypto.randomUUID().replace(/-/g,''),operator_ready:$('operator-ready').checked||Boolean(snapshot?.runtime?.synthetic),...extra});feedback('操作已提交，等待执行器的实际状态。');});}
  $('mode').addEventListener('change',()=>{mode=$('mode').value;loadFields();$('operator-ready').checked=false;if(snapshot)render(snapshot);});
  $('transport').addEventListener('change',transportFields);$('operator-ready').addEventListener('change',()=>snapshot&&render(snapshot));
  $('connection-form').addEventListener('submit',event=>{event.preventDefault();perform(async()=>{await app.api('/api/capture/connection',{mode,transport:$('transport').value,ssh_alias:$('ssh').value.trim(),agent_python:$('agent-python').value.trim(),profile_directory:$('profile-directory').value.trim()});collapseOnConnect=true;await app.api('/api/capture/action',{action:'connect',mode,request_id:crypto.randomUUID().replace(/-/g,'')});});});
  $('trial').addEventListener('click',()=>perform(async()=>{await app.api('/api/capture/trial',{mode});await refresh();loadFields();collapseOnConnect=true;await app.api('/api/capture/action',{action:'prepare',mode,operator_ready:true,request_id:crypto.randomUUID().replace(/-/g,'')});}));
  $('restore-connection').addEventListener('click',()=>perform(async()=>{await app.api('/api/capture/restore',{mode});await refresh();loadFields();}));
  $('global-status').addEventListener('click',()=>window.WorkbenchShell?.showView('capture'));
  $('settings').addEventListener('click',()=>{$('connect-details').open=!$('connect-details').open;});
  for(const button of document.querySelectorAll('[data-capture-action]'))button.addEventListener('click',()=>run(button.dataset.captureAction==='start_services'?'prepare':button.dataset.captureAction));
  document.addEventListener('workbench:state',event=>{if(event.detail.data.capture_session)render(event.detail.data.capture_session);});
  setInterval(()=>{if(!document.hidden&&!document.getElementById('view-capture').hidden)refresh();},1000);
  refresh();
})();
