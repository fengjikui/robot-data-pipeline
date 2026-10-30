/* Persistent, task-oriented dataset preparation. Server polling never rebuilds editors. */
(() => {
  "use strict";
  const root = document.getElementById("preparation-root");
  if (!root || !window.Workbench) return;
  const app = window.Workbench;
  const $ = id => document.getElementById("prep-" + id);
  const node = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text != null) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const sourceNames = {self_capture:"真机采集", simulation:"仿真数据", open:"开源数据", purchased:"采购交付", synthetic:"合成样例"};
  const resultNames = {success:"任务成功", failure:"任务失败", interrupted:"任务中断", unlabeled:"结果待标"};
  const partitionNames = {train:"训练", validation:"验证", test:"测试"};
  const active = job => ["queued", "running", "cancelling"].includes(job.status);
  const duration = n => Number.isFinite(n) ? (n >= 60 ? Math.floor(n / 60) + "分 " + (n % 60).toFixed(1) + "秒" : n.toFixed(1) + "秒") : "时长未知";
  const storageKey = "robot-data-preparation:" + location.origin;
  const s = {data:null, episodes:[], episodeId:null, frame:0, frameData:null, camera:"", step:1, items:[], draft:null, parentId:null, dirty:false, busy:false, loading:false, assetSignature:null, datasetsSignature:null, initialized:false, recovered:false, localTimer:null, frameTimer:null, frameRequest:0, episodeRequest:0, undo:[], focusedRun:null, previous:null, editorEpoch:0};
  root.innerHTML = `
    <div class="prep-heading"><div><div class="eyebrow">本轮任务 · 数据准备</div><h2>准备本轮训练数据</h2><p>保留原件，明确选择、切段和划分；每次准备都能追溯。</p></div><div class="prep-heading-actions"><button id="prep-import" type="button" class="button">导入数据</button><button id="prep-demo" type="button" class="text-button">使用合成样例</button><span class="badge neutral">项目准备包</span></div></div>
    <div class="prep-draftbar"><div class="prep-draft-picker"><label for="prep-dataset">继续已有训练集</label><select id="prep-dataset"><option value="">新建训练集草稿</option></select></div><button id="prep-load" type="button" class="button">载入</button><button id="prep-new" type="button" class="text-button">新建草稿</button><button id="prep-restore" type="button" class="text-button" hidden>恢复切换前的编辑</button><button id="prep-fork" type="button" class="button" hidden>基于此版本新建</button><span id="prep-save-state" class="prep-save-state">尚未保存</span><button id="prep-save" type="button" class="button">保存草稿</button></div>
    <p id="prep-feedback" class="prep-feedback" role="status" aria-live="polite" hidden></p>
    <nav class="prep-stepper" aria-label="训练数据准备步骤"><button type="button" data-prep-step="1" aria-current="step"><span>01</span>选回合与预览</button><button type="button" data-prep-step="2"><span>02</span>组合与划分</button><button type="button" data-prep-step="3"><span>03</span>确认并构建</button></nav>
    <section id="prep-step-1" class="prep-step" aria-label="选回合与预览">
      <div class="prep-episode-toolbar"><label class="prep-search"><span class="sr-only">搜索回合任务、名称或来源</span><input id="prep-search" type="search" placeholder="搜索任务、数据集或回合" autocomplete="off"></label><select id="prep-source" aria-label="筛选回合来源"><option value="">全部来源</option><option value="self_capture">真机采集</option><option value="simulation">仿真数据</option><option value="open">开源数据</option><option value="purchased">采购交付</option></select><select id="prep-result-filter" aria-label="筛选任务结果"><option value="">全部任务结果</option><option value="success">任务成功</option><option value="failure">任务失败</option><option value="interrupted">任务中断</option><option value="unlabeled">结果待标</option></select><select id="prep-quality-filter" aria-label="筛选质检状态"><option value="">全部质检状态</option><option value="pass">结构通过</option><option value="fail">结构有问题</option><option value="unknown">尚未检查</option></select></div>
      <div class="prep-workspace"><section class="prep-episode-column"><div class="prep-list-head"><span id="prep-episode-count">读取回合中…</span><div class="prep-list-actions"><button id="prep-refresh-episodes" class="text-button" type="button">刷新</button><button id="prep-select-visible" class="text-button" type="button">选择筛选结果中的整回合</button></div></div><div id="prep-episodes" class="prep-episodes"></div></section>
      <section class="prep-preview" aria-labelledby="prep-preview-title"><div id="prep-preview-empty" class="prep-preview-empty"><span class="prep-empty-symbol" aria-hidden="true">↖</span><h3>选一个回合预览</h3><p>点击回合名称查看图像与记录；勾选后才会加入本轮训练集。</p></div><div id="prep-preview-body" hidden>
        <div class="prep-preview-heading"><div><h3 id="prep-preview-title"></h3><p id="prep-preview-path" class="prep-preview-path"></p><p id="prep-preview-meta"></p></div><select id="prep-camera" aria-label="预览相机"></select></div>
        <div class="prep-image-wrap"><img id="prep-image" alt="回合原始图像" tabindex="0" hidden><div id="prep-image-state" class="prep-image-state">正在读取图像…</div></div>
        <div class="prep-player"><button id="prep-frame-prev" class="button small" type="button" aria-label="上一帧">←</button><input id="prep-frame" type="range" min="0" max="0" value="0" aria-label="回合当前帧"><button id="prep-frame-next" class="button small" type="button" aria-label="下一帧">→</button><label class="prep-frame-number"><span class="sr-only">跳转到帧</span><input id="prep-frame-number" type="number" min="0" value="0" aria-label="跳转到帧"></label></div><p id="prep-frame-position" class="field-note"></p>
        <details class="prep-observation"><summary>这一帧的 state / action</summary><div class="prep-observation-grid"><div><strong>state · 实际记录</strong><pre id="prep-state"></pre></div><div><strong>action · 目标记录</strong><pre id="prep-action"></pre></div></div><p class="field-note">显示原始记录值，不代表动作语义或单位已经通过硬件验收。</p></details>
        <section class="prep-clip"><div class="section-title"><h3>保留一个时间片段</h3><span>原始回合保持不变</span></div><div class="prep-clip-fields"><div class="field"><label for="prep-clip-start">开始帧（包含）</label><div class="prep-compact-input"><input id="prep-clip-start" type="number" min="0" value="0"><button id="prep-set-start" class="text-button" type="button">用当前帧</button></div></div><div class="field"><label for="prep-clip-end">结束帧（不包含）</label><div class="prep-compact-input"><input id="prep-clip-end" type="number" min="1" value="1"><button id="prep-set-end" class="text-button" type="button">含当前帧</button></div></div></div><div class="field"><label for="prep-clip-task">片段的训练用途 / 子任务</label><input id="prep-clip-task" maxlength="300" placeholder="例如：双手从桌 A 取箱"></div><p id="prep-clip-hint" class="field-note"></p><button id="prep-add-clip" class="button" type="button">加入此片段</button><span id="prep-clip-locked" class="prep-clip-locked" hidden>此版本已确认，基于此版本新建后可修改</span></section>
        <details class="prep-annotation"><summary>标记本回合的任务结果</summary><div class="field"><label for="prep-annotation-result">任务结果</label><select id="prep-annotation-result"><option value="unlabeled">待标记</option><option value="success">成功</option><option value="failure">失败</option><option value="interrupted">中断</option></select></div><div class="field"><label for="prep-annotation-note">备注</label><textarea id="prep-annotation-note" rows="2" maxlength="1000" placeholder="失败原因、接管或其他需要说明的情况"></textarea></div><button id="prep-save-annotation" class="button small" type="button">保存任务标记</button><p class="field-note">任务成功与数据结构通过分别记录。这里是操作者标记。</p></details>
        <details class="prep-quality-detail"><summary>该回合的检查详情</summary><div id="prep-episode-quality"></div></details>
      </div></section></div>
    </section>
    <section id="prep-step-2" class="prep-step" aria-label="组合与划分" hidden>
      <div class="prep-composition"><section><div class="section-title"><h3>本轮采用的数据</h3><span id="prep-selected-count" class="muted"></span></div><div id="prep-selected-list" class="prep-selected-list"></div><button id="prep-clear-selection" class="text-button" type="button">清空本轮选择</button></section><section class="prep-recipe-pane"><h3>训练时的来源采样</h3><p class="field-note">采样频率与原始数据数量分别记录，权重仅用于训练部分。</p><div class="field"><label for="prep-sampling-mode">采样方式</label><select id="prep-sampling-mode"><option value="natural">按原始训练记录分布</option><option value="weighted">自定义来源比例</option></select></div><div id="prep-source-weights"></div><p id="prep-weight-hint" class="field-note"></p>
      <section class="prep-split-section"><div class="section-title"><h3>数据划分</h3><span class="muted">同一母回合保持在同一集合</span></div><div class="field"><label for="prep-split-preset">划分方案</label><select id="prep-split-preset"><option value="80,20,0">训练 80% / 验证 20%</option><option value="100,0,0">全部用于训练（明确不留出验证/测试）</option><option value="custom">自定义比例</option></select></div><div class="prep-split-inputs"><div class="field"><label for="prep-split-train">训练 %</label><input id="prep-split-train" type="number" min="0" max="100" value="80"></div><div class="field"><label for="prep-split-validation">验证 %</label><input id="prep-split-validation" type="number" min="0" max="100" value="20"></div><div class="field"><label for="prep-split-test">测试 %</label><input id="prep-split-test" type="number" min="0" max="100" value="0"></div></div><details><summary>划分随机种子</summary><div class="field"><label for="prep-split-seed">固定种子</label><input id="prep-split-seed" type="number" min="0" value="42"></div></details><p id="prep-split-hint" class="field-note"></p><button id="prep-preview-split" class="button" type="button">保存并预览划分</button><div id="prep-split-summary" class="prep-split-summary"></div></section>
      </section></div>
    </section>
    <section id="prep-step-3" class="prep-step" aria-label="确认并构建" hidden>
      <div class="prep-review-layout"><section><div class="field"><label for="prep-name">训练集名称</label><input id="prep-name" maxlength="120" placeholder="例如：搬箱 · 第一轮训练数据"></div><div id="prep-review" class="prep-review"></div><div id="prep-problems" class="prep-problems"></div><div id="prep-warnings" class="prep-warnings"></div></section><aside class="prep-build-pane"><h3>这次会生成什么</h3><p>所选图像、JSONL 记录、来源与片段清单、划分和采样配置，以及项目读取验收结果。</p><p class="field-note">这是可追溯的项目准备包。官方 LeRobot 数据与 ACT 等训练器读取仍需单独适配验收；当前不会启动模型训练。</p><div id="prep-build-state" class="prep-build-state"></div><button id="prep-confirm" class="button primary" type="button">确认并构建准备包</button><button id="prep-build-again" class="button" type="button" hidden>构建准备包</button><div id="prep-build-links"></div></aside></div>
    </section>
    <div class="prep-selection-bar"><div><strong id="prep-basket">尚未选择回合</strong><span id="prep-outside-filter" class="field-note"></span></div><button id="prep-undo" class="text-button" type="button" disabled>撤销上次选数</button><div class="prep-step-actions"><button id="prep-back" class="button" type="button" hidden>上一步</button><button id="prep-next" class="button primary" type="button">组合与划分 →</button></div></div>
  `;
  const episode = id => s.episodes.find(e => e.id === (id || s.episodeId));
  const locked = () => Boolean(s.draft && s.draft.status !== "draft");
  const statusText = value => ({draft:"草稿",confirmed:"已确认",building:"构建中",ready:"准备包已生成",failed:"构建失败"}[value] || value);
  const button = (text, action, cls="button") => {const n=node("button",text,cls);n.type="button";n.addEventListener("click",action);return n;};
  function feedback(text, tone="info") {$("feedback").hidden=!text;$("feedback").textContent=text;$("feedback").className="prep-feedback "+tone;}
  function fieldValues() {
    const split={train:Number($("split-train").value),validation:Number($("split-validation").value),test:Number($("split-test").value),seed:Number($("split-seed").value)};
    const sampling={mode:$("sampling-mode").value,weights:{}};
    if(sampling.mode==="weighted") for(const n of $("source-weights").querySelectorAll("input[data-source]")) sampling.weights[n.dataset.source]=Number(n.value)/100;
    return {name:$("name").value.trim(),items:s.items.map(i=>({...i})),split,sampling};
  }
  function rememberOpenedDataset(id) {
    try { if(id)localStorage.setItem(storageKey+":last-dataset",JSON.stringify({id,step:s.step})); else localStorage.removeItem(storageKey+":last-dataset"); } catch(_) {}
  }
  function localBackup() {
    if(!s.initialized)return;
    if(s.draft?.id&&!s.dirty)rememberOpenedDataset(s.draft.id);
    if(locked())return;
    try{localStorage.setItem(storageKey,JSON.stringify({...fieldValues(),dirty:s.dirty,draft_id:s.draft?.id||null,revision:s.draft?.revision||null,parent_id:s.parentId,step:s.step,updated_at:Date.now()}));}catch(_){/* Saving to the backend remains available. */}
  }
  function dirty() {
    s.editorEpoch++;s.dirty=true;$("save-state").textContent="编辑已暂存 · 待保存";
    clearTimeout(s.localTimer);s.localTimer=setTimeout(localBackup,180);
    renderControls();
  }
  function remember() {s.undo.push(s.items.map(i=>({...i})));if(s.undo.length>20)s.undo.shift();}
  function mutateItems(fn) {if(locked()||s.busy)return;remember();fn();dirty();renderTable();renderSelected();renderWeights();renderClipHint();renderBasket();}
  function selectedFrames() {return s.items.reduce((n,i)=>n+i.end_frame-i.start_frame,0);}
  function sources() {
    const counts={};for(const item of s.items){const e=episode(item.episode_id);if(e)counts[e.source_kind]=(counts[e.source_kind]||0)+item.end_frame-item.start_frame;}return counts;
  }
  function filtered() {
    const q=$("search").value.trim().toLocaleLowerCase(),source=$("source").value,result=$("result-filter").value,quality=$("quality-filter").value;
    return s.episodes.filter(e=>(!q||[e.asset_name,e.relative_path,e.task].join(" ").toLocaleLowerCase().includes(q))&&(!source||e.source_kind===source)&&(!result||(e.annotation?.result||"unlabeled")===result)&&(!quality||(quality==="pass"?e.quality?.valid===true:quality==="fail"?e.quality?.valid===false:e.quality?.valid==null)));
  }
  function fullSelected(e){return s.items.some(i=>i.episode_id===e.id&&i.start_frame===0&&i.end_frame===e.frames);}
  function renderTable() {
    const visible=filtered(),list=$("episodes");root.classList.toggle("prep-no-data",s.episodes.length===0);$("demo").hidden=s.episodes.length>0;
    const focused=document.activeElement?.dataset.episodeFocus;
    list.replaceChildren();$("episode-count").textContent=s.loading?"读取回合中…":`${visible.length} 个回合${visible.length!==s.episodes.length?` / 共 ${s.episodes.length} 个`:""}`;
    $("select-visible").disabled=locked()||!visible.length||s.loading;
    if(!visible.length){const empty=node("div",null,"prep-empty");empty.append(node("h3",s.loading?"正在读取回合":s.episodes.length?"没有符合条件的回合":"先加入一份数据"),node("p",s.episodes.length?"修改筛选条件不会清空已经选中的数据。":"导入已保存的回合目录，或主动生成样例体验完整准备流程。"));if(!s.episodes.length&&!s.loading){empty.append(button("导入本地数据",()=>window.WorkbenchShell?.importData(),"button primary"),button("生成合成教学样例",()=>document.getElementById("create-demo").click(),"text-button"));}list.append(empty);renderBasket();return;}
    for(const e of visible){const row=node("div",null,"prep-episode-row"+(s.episodeId===e.id?" inspected":""));const check=node("input");check.type="checkbox";check.checked=fullSelected(e);check.disabled=locked()||s.busy||!Number.isInteger(e.frames)||e.frames<=0;check.setAttribute("aria-label","选择整回合 "+e.asset_name+" "+e.relative_path);check.dataset.episodeFocus="check-"+e.id;check.dataset.emptyEpisode=String(!Number.isInteger(e.frames)||e.frames<=0);check.addEventListener("change",()=>mutateItems(()=>{s.items=s.items.filter(i=>i.episode_id!==e.id);if(check.checked)s.items.push({episode_id:e.id,start_frame:0,end_frame:e.frames,task:e.task||""});}));
      const name=button("",()=>inspectEpisode(e.id),"prep-episode-name");name.dataset.episodeFocus="preview-"+e.id;name.setAttribute("aria-label","预览 "+e.asset_name+" "+e.relative_path);name.append(node("strong",e.asset_name),node("span",e.relative_path||e.id),node("small",`${sourceNames[e.source_kind]||e.source_kind}${e.synthetic?" · 合成样例":""} · ${e.frames} 帧 · ${duration(e.duration)}`));
      const statuses=node("div",null,"prep-episode-status");statuses.append(node("span",e.quality?.valid===true?"结构通过":e.quality?.valid===false?"结构有问题":"待检查","badge "+(e.quality?.valid===true?"good":e.quality?.valid===false?"bad":"neutral")),node("small",resultNames[e.annotation?.result||"unlabeled"]||"结果待标"));const clips=s.items.filter(i=>i.episode_id===e.id&&!fullSelected(e));if(clips.length)statuses.append(node("small",`已选 ${clips.length} 个片段`,"prep-selected-mark"));row.append(check,name,statuses);list.append(row);}
    if(focused)list.querySelector(`[data-episode-focus="${focused}"]`)?.focus({preventScroll:true});renderBasket();
  }
  async function loadEpisodes() {
    const request=++s.episodeRequest;s.loading=true;renderTable();
    try{const result=await app.api("/api/episodes");if(request!==s.episodeRequest)return;s.episodes=result.episodes||[];s.loading=false;
      if(!s.recovered){s.recovered=true;await recover();if(request!==s.episodeRequest)return;}
      renderTable();renderSelected();renderWeights();renderBasket();
      if(s.episodeId&&!episode())s.episodeId=null;
      if(!s.episodeId&&s.episodes.length)inspectEpisode(s.episodes[0].id);
      renderControls();
    }catch(error){if(request!==s.episodeRequest)return;s.loading=false;renderTable();feedback("回合读取失败："+error.message+"。已选数据不会被清空。","error");}
  }
  async function inspectEpisode(id) {
    const e=episode(id);if(!e)return;
    s.episodeId=id;s.frame=0;s.frameData=null;s.camera=e.camera_keys?.[0]||"";
    $("preview-empty").hidden=true;$("preview-body").hidden=false;
    $("preview-title").textContent=e.asset_name||e.relative_path||e.id;
    $("preview-path").textContent=e.relative_path||e.id;
    $("preview-meta").textContent=`${sourceNames[e.source_kind]||e.source_kind}${e.synthetic?" · 合成教学样例":""} · ${e.frames} 帧`;
    $("camera").replaceChildren();for(const camera of e.camera_keys||[])$("camera").add(new Option(camera,camera));
    $("frame").max=Math.max(0,e.frames-1);$("frame").value=0;$("frame-number").max=Math.max(0,e.frames-1);$("frame-number").value=0;
    $("clip-start").value=0;$("clip-start").max=Math.max(0,e.frames-1);$("clip-end").value=e.frames;$("clip-end").max=e.frames;$("clip-task").value=e.task||"";
    $("annotation-result").value=e.annotation?.result||"unlabeled";$("annotation-note").value=e.annotation?.note||"";
    const quality=$("episode-quality");quality.replaceChildren();quality.append(node("p",e.quality?.scope||"当前检查覆盖范围由后端报告。","field-note"));for(const text of [...(e.quality?.errors||[]),...(e.quality?.warnings||[])])quality.append(node("p",text,"field-note"));
    renderTable();renderClipHint();renderControls();await loadFrame(0);
  }
  async function loadFrame(index) {
    const e=episode();if(!e)return;
    index=Math.max(0,Math.min(e.frames-1,Number(index)||0));s.frame=index;$("frame").value=index;$("frame-number").value=index;
    const request=++s.frameRequest;$("image-state").hidden=false;$("image-state").textContent="正在读取第 "+index+" 帧…";
    try{const result=await app.api(`/api/episodes/${encodeURIComponent(e.id)}/frames/${index}`);if(request!==s.frameRequest||e.id!==s.episodeId)return;s.frameData=result;paintFrame();}
    catch(error){if(request!==s.frameRequest)return;$("image").hidden=true;$("image-state").textContent="该帧无法读取："+error.message;$("frame-position").textContent=`帧 ${index} / ${e.frames-1}`;}
  }
  function paintFrame(){const e=episode(),frame=s.frameData;if(!e||!frame)return;const image=(frame.images||[]).find(i=>i.camera===$("camera").value)||(frame.images||[])[0];
    if(image&&typeof image.url==="string"&&image.url.startsWith("/api/")){$("image").hidden=false;$("image").alt=`${e.asset_name} · ${image.camera} · 第 ${s.frame} 帧`;$("image").src=image.url;$("image-state").hidden=true;}else{$("image").hidden=true;$("image-state").hidden=false;$("image-state").textContent="该帧没有可用图像。";}
    const stamp=Number.isFinite(frame.timestamp)?`${frame.timestamp.toFixed(3)} 秒（记录时间）`:Number.isFinite(e.nominal_fps)&&e.nominal_fps>0?`${(s.frame/e.nominal_fps).toFixed(3)} 秒（按标称 ${e.nominal_fps} fps 估算）`:"时间未知，按帧定位";
    $("frame-position").textContent=`帧 ${s.frame} / ${Math.max(0,e.frames-1)} · ${stamp}`;$("state").textContent=JSON.stringify(frame.state,null,2);$("action").textContent=JSON.stringify(frame.action,null,2);$("frame-prev").disabled=s.frame<=0;$("frame-next").disabled=s.frame>=e.frames-1;
  }
  function clipData(){const e=episode();return e?{episode_id:e.id,start_frame:Number($("clip-start").value),end_frame:Number($("clip-end").value),task:$("clip-task").value.trim()}:null;}
  function renderClipHint(){const e=episode(),clip=clipData();if(!e||!clip)return;let error="";if(!Number.isInteger(clip.start_frame)||!Number.isInteger(clip.end_frame)||clip.start_frame<0||clip.end_frame>e.frames||clip.start_frame>=clip.end_frame)error="请输入有效区间：开始帧小于结束帧，范围在 0 到 "+e.frames+" 之间。";
    const full=fullSelected(e),overlap=s.items.some(i=>i.episode_id===e.id&&!(i.start_frame===0&&i.end_frame===e.frames)&&clip.start_frame<i.end_frame&&clip.end_frame>i.start_frame);
    if(!error&&overlap)error="与已选片段重叠。请调整区间，或在组合页移除原片段后重选。";
    $("clip-hint").textContent=error||(full?"该回合已整段选中；加入片段将替换整回合选择，可撤销。":`将保留 ${Math.max(0,clip.end_frame-clip.start_frame)} 帧，区间为 [${clip.start_frame}, ${clip.end_frame})。`);
    $("clip-hint").classList.toggle("error-text",Boolean(error));$("clip-locked").hidden=!locked();$("add-clip").setAttribute("aria-describedby",locked()?"prep-clip-locked":"prep-clip-hint");$("add-clip").disabled=s.busy||locked()||Boolean(error);$("add-clip").textContent=full?"用此片段替换整回合":"加入此片段";
  }
  function addClip(){const clip=clipData(),e=episode();if(!clip||!e||$("add-clip").disabled)return;mutateItems(()=>{s.items=s.items.filter(i=>!(i.episode_id===e.id&&i.start_frame===0&&i.end_frame===e.frames));s.items.push(clip);});feedback("片段已加入本轮选择，原始回合保持不变。","success");}
  function renderSelected(){const list=$("selected-list");list.replaceChildren();$("selected-count").textContent=`${new Set(s.items.map(i=>i.episode_id)).size} 个回合 · ${s.items.length} 个区间`;
    if(!s.items.length)list.append(node("p","还没有选择数据。返回第一步勾选整回合，或添加保留片段。","field-note"));
    s.items.forEach((item,index)=>{const e=episode(item.episode_id),row=node("div",null,"prep-selected-row"),info=node("div");info.append(node("strong",e?.asset_name||item.episode_id),node("small",`${e?.relative_path||""} · [${item.start_frame}, ${item.end_frame}) · ${item.end_frame-item.start_frame} 帧`),node("small",item.task||"训练用途待确认"));const remove=button("移除",()=>mutateItems(()=>s.items.splice(index,1)),"text-button");remove.disabled=s.busy||locked();row.append(info,remove);list.append(row);});
    $("clear-selection").disabled=locked()||!s.items.length;
  }
  function renderWeights(preserve=true){const box=$("source-weights"),old={};if(preserve)for(const input of box.querySelectorAll("input[data-source]"))old[input.dataset.source]=input.value;box.replaceChildren();const groups=sources(),total=Object.values(groups).reduce((a,b)=>a+b,0),weighted=$("sampling-mode").value==="weighted";
    for(const [kind,frames] of Object.entries(groups)){const row=node("div",null,"prep-source-weight"),label=node("label",sourceNames[kind]||kind);const id="prep-weight-"+kind;label.htmlFor=id;const share=total?frames/total*100:0;const meta=node("small",`${frames} 个选中帧 · ${share.toFixed(1)}%`);row.append(label,meta);if(weighted){const input=node("input");input.type="number";input.min=0;input.max=100;input.step="0.1";input.id=id;input.dataset.source=kind;input.value=old[kind]??share.toFixed(1);input.disabled=locked();input.setAttribute("aria-label",(sourceNames[kind]||kind)+"训练采样百分比");input.addEventListener("input",()=>{dirty();renderWeightHint();});row.append(input,node("span","%"));}box.append(row);}
    renderWeightHint();
  }
  function renderWeightHint(){const weighted=$("sampling-mode").value==="weighted";if(!s.items.length){$("weight-hint").textContent="选中数据后显示各来源分布。";return;}const total=[...$("source-weights").querySelectorAll("input")].reduce((n,i)=>n+Number(i.value),0);$("weight-hint").textContent=weighted?`比例合计 ${total.toFixed(1)}%。请设为 100%；它改变抽样频率，不增加独立示范。`:"自然分布按实际准备的训练记录计算；当前显示所选帧占比，正式结果以划分与读取报告为准。";$("weight-hint").classList.toggle("error-text",weighted&&Math.abs(total-100)>0.11);}
  function renderBasket(){const unique=new Set(s.items.map(i=>i.episode_id)).size;$("basket").textContent=s.items.length?`已选 ${unique} 个回合 · ${s.items.length} 个区间 · ${selectedFrames()} 帧`:"尚未选择回合";const visible=new Set(filtered().map(e=>e.id));const outside=s.items.filter(i=>!visible.has(i.episode_id)).length;$("outside-filter").textContent=outside?`${outside} 个已选区间不在当前筛选中，选择仍然保留。`:"选择与预览互相独立，原始数据保持不变。";$("undo").disabled=locked()||!s.undo.length;renderControls();}
  function renderSplit(){const sum=["train","validation","test"].reduce((n,k)=>n+Number($("split-"+k).value),0);const groups=new Set(s.items.map(i=>episode(i.episode_id)?.group_fingerprint||i.episode_id)).size;$("split-hint").textContent=`当前约 ${groups} 个独立母回合组。比例合计 ${sum}%；切段与同源重复数据不会跨集合。`;$("split-hint").classList.toggle("error-text",sum!==100);
    const box=$("split-summary");box.replaceChildren();if(s.draft?.splits&&!s.dirty){for(const key of ["train","validation","test"]){const part=s.draft.splits[key];if(!part)continue;const row=node("div");row.append(node("strong",partitionNames[key]),node("span",`${part.group_count} 组 · ${part.clip_count} 区间 · ${part.frame_count} 帧`));box.append(row);}}else box.append(node("p","保存后由后端生成分组划分预览。","field-note"));if(!s.dirty&&s.draft?.problems?.length){const problems=node("ul",null,"prep-inline-problems");for(const message of s.draft.problems)problems.append(node("li",message));box.append(problems);}}
  function renderReview(){const box=$("review");box.replaceChildren();const groups=sources(),summary=s.draft?.summary;const values=[["选择范围",`${new Set(s.items.map(i=>i.episode_id)).size} 个回合 / ${s.items.length} 个区间 / ${selectedFrames()} 帧`],["来源组成",Object.entries(groups).map(([k,v])=>(sourceNames[k]||k)+" "+v+" 帧").join("；")||"尚未选择"],["数据划分",["train","validation","test"].map(k=>partitionNames[k]+" "+$("split-"+k).value+"%").join(" / ")],["采样方式",$("sampling-mode").value==="natural"?"原始训练记录分布":"自定义来源采样比例"],["当前状态",s.draft?statusText(s.draft.status)+(s.dirty?" · 有未保存修改":"") : "尚未保存草稿"]];
    const groupCount=!s.dirty&&summary?.group_count!=null?summary.group_count:new Set(s.items.map(i=>episode(i.episode_id)?.group_fingerprint||i.episode_id)).size;values.push(["独立母回合组",String(groupCount)]);if($("sampling-mode").value==="weighted")values.push(["来源采样比例",Object.entries(fieldValues().sampling.weights).map(([k,v])=>(sourceNames[k]||k)+" "+(v*100).toFixed(1)+"%").join(" / ")]);
    const dl=node("dl",null,"stage-contract");for(const [key,value] of values){const row=node("div");row.append(node("dt",key),node("dd",value));dl.append(row);}box.append(dl);if(s.items.some(i=>episode(i.episode_id)?.synthetic))box.append(node("p","当前选择包含合成教学数据，只验证工作台流程，不证明机器人任务或策略效果。","prep-synthetic-note"));
    renderProblems();renderBuild();
  }
  function renderProblems(){const problems=$("problems"),warnings=$("warnings");problems.replaceChildren();warnings.replaceChildren();if(s.dirty){problems.append(node("p","当前选择或配置有修改，保存后重新检查兼容性与划分。","field-note"));return;}
    if(s.draft?.problems?.length){problems.append(node("h3","准备前需要处理"));const list=node("ul");for(const message of s.draft.problems)list.append(node("li",message));problems.append(list);}for(const message of s.draft?.warnings||[])warnings.append(node("p",message,"field-note"));}
  function renderBuild(){const jobs=s.data?.jobs||[],matching=jobs.filter(j=>j.dataset_id===s.draft?.id),latest=matching[0];const box=$("build-state"),links=$("build-links");box.replaceChildren();links.replaceChildren();if(latest){box.append(node("strong",({queued:"准备作业排队中",running:"正在构建准备包",cancelling:"正在停止",succeeded:"准备包已生成",failed:"构建失败",cancelled:"作业已停止",interrupted:"作业已中断"}[latest.status]||latest.status)));if(latest.error)box.append(node("p",latest.error,"error-text"));links.append(button("查看日志与产物 →",()=>window.WorkbenchShell?.openRun(latest.id),"text-button"));if(latest.status==="succeeded")box.append(node("p","项目读取验收结果与训练器接入状态请以作业产物契约为准。","field-note"));}
    $("build-again").hidden=!locked();$("build-again").disabled=s.busy||jobs.some(active);$("confirm").hidden=locked();}
  function renderControls(){const isLocked=locked();$("new").disabled=s.busy;$("restore").disabled=s.busy;for(const n of root.querySelectorAll(".prep-episode-row > input,.prep-selected-row > button"))n.disabled=s.busy||isLocked||n.dataset.emptyEpisode==="true";$("dataset").disabled=s.busy;$("select-visible").disabled=s.busy||isLocked||!filtered().length;$("clear-selection").disabled=s.busy||isLocked||!s.items.length;$("undo").disabled=s.busy||isLocked||!s.undo.length;renderClipHint();$("save").disabled=s.busy||isLocked||!s.items.length;$("load").disabled=s.busy||!$("dataset").value;$("fork").hidden=!isLocked;$("fork").disabled=s.busy;$("next").disabled=s.busy||!s.items.length;$("back").hidden=s.step===1;$("next").hidden=s.step===3;$("next").textContent=s.step===1?"组合与划分 →":"核对并准备 →";$("preview-split").disabled=s.busy||isLocked||!s.items.length;$("confirm").disabled=s.busy||!s.items.length||Boolean(s.draft&&!s.dirty&&s.draft.problems?.length)||Boolean(s.data?.jobs?.some(active));
    for(const id of ["name","sampling-mode","split-preset","split-train","split-validation","split-test","split-seed"])$(id).disabled=s.busy||isLocked;
    for(const input of $("source-weights").querySelectorAll("input"))input.disabled=s.busy||isLocked;
    if(isLocked)$("save-state").textContent="已确认版本 · 修改请另存新版本";
  }
  function setStep(step){s.step=step;for(const n of root.querySelectorAll("[data-prep-step]")){if(Number(n.dataset.prepStep)===step)n.setAttribute("aria-current","step");else n.removeAttribute("aria-current");}for(let n=1;n<=3;n++)$("step-"+n).hidden=n!==step;if(step===2){renderSelected();renderWeights();renderSplit();}if(step===3)renderReview();renderBasket();localBackup();}
  function updateDatasetPicker(){if(!s.data)return;const datasets=s.data.datasets||[];const signature=JSON.stringify(datasets.map(d=>[d.id,d.name,d.revision,d.status]));if(signature===s.datasetsSignature)return;s.datasetsSignature=signature;const old=$("dataset").value;$("dataset").replaceChildren(new Option("新建训练集草稿",""));for(const d of datasets)$("dataset").add(new Option(d.name+" · "+statusText(d.status)+(d.summary?.contains_synthetic?" · 含合成样例":""),d.id));$("dataset").value=s.draft?.id||old;if(!$("dataset").value)$("dataset").value="";renderControls();}
  function applyDraft(draft){s.editorEpoch++;s.draft=draft;rememberOpenedDataset(draft.id);s.parentId=draft.parent_id||null;s.items=(draft.items||[]).map(i=>({...i}));s.dirty=false;s.undo=[];$("name").value=draft.name||"";applyRecipe(draft);$("save-state").textContent=locked()?"已确认版本 · 修改请另存新版本":"草稿已保存 · r"+draft.revision;renderTable();renderSelected();renderWeights();renderBasket();renderSplit();renderReview();try{localStorage.removeItem(storageKey);}catch(_){}updateDatasetPicker();$("dataset").value=draft.id||"";renderControls();}
  function applyRecipe(data){for(const k of ["train","validation","test","seed"])$("split-"+k).value=data.split?.[k]??(k==="train"?80:k==="validation"?20:k==="test"?0:42);const preset=["train","validation","test"].map(k=>$("split-"+k).value).join(",");$("split-preset").value=["80,20,0","100,0,0"].includes(preset)?preset:"custom";$("sampling-mode").value=data.sampling?.mode||"natural";renderWeights(false);for(const input of $("source-weights").querySelectorAll("input[data-source]"))if(data.sampling?.weights?.[input.dataset.source]!=null)input.value=(data.sampling.weights[input.dataset.source]*100).toFixed(1);renderWeightHint();}
  async function recover(){
    let backup,last;
    try {
      backup=JSON.parse(localStorage.getItem(storageKey)||"null");
      last=JSON.parse(localStorage.getItem(storageKey+":last-dataset")||"null");
      s.previous=JSON.parse(localStorage.getItem(storageKey+":previous")||"null");
      $("restore").hidden=!s.previous;
    } catch(_) {}
    const pending=backup&&backup.dirty!==false&&(backup.items?.length||backup.dirty===true);
    if(pending){
      const valid=Array.isArray(backup.items)&&backup.items.every(i=>episode(i.episode_id));
      if(valid){
        const server=(s.data.datasets||[]).find(d=>d.id===backup.draft_id);
        s.items=backup.items;s.parentId=backup.parent_id||null;
        if(server?.status==="draft")s.draft={...server,id:backup.draft_id,revision:backup.revision,status:"draft"};
        else if(server){s.draft=null;s.parentId=server.id;rememberOpenedDataset(null);}
        $("name").value=backup.name||"";applyRecipe(backup);s.dirty=true;
        $("save-state").textContent="已恢复浏览器草稿 · 请保存";
        feedback(server&&server.status!=="draft"?"原版本已确认，未保存的编辑已恢复为新草稿，原确认版本保持不变。":"已恢复未保存的选择与配置。确认后可保存为工作区草稿。","info");
        setStep([1,2,3].includes(backup.step)?backup.step:1);
        return;
      }
      feedback("发现上一工作区的浏览器草稿，数据引用与当前工作区不一致，未自动载入。请从已有训练集恢复。","warning");
    }
    const id=last?.id||(!pending&&backup?.draft_id)||null;
    if(!id)return;
    if(!(s.data.datasets||[]).some(d=>d.id===id)){rememberOpenedDataset(null);return;}
    const epoch=s.editorEpoch;
    try {
      const dataset=await app.api("/api/datasets/"+encodeURIComponent(id));
      if(epoch!==s.editorEpoch)return;
      applyDraft(dataset);
      setStep([1,2,3].includes(last?.step)?last.step:3);
      feedback("已恢复上次打开的训练集"+(dataset.status!=="draft"?"及其确认状态。":"草稿。"),"info");
    } catch(error) {
      feedback("上次打开的训练集暂未恢复："+error.message+"。可以从上方列表重新载入。","warning");
    }
  }
  function editorSnapshot(){const draft=s.draft?Object.fromEntries(Object.entries(s.draft).filter(([key])=>key!=="manifest")):null;return {...fieldValues(),draft,parent_id:s.parentId,dirty:s.dirty,step:s.step};}
  function stashEditor(){if(!s.items.length&&!s.dirty&&!s.draft)return;s.previous=editorSnapshot();try{localStorage.setItem(storageKey+":previous",JSON.stringify(s.previous));}catch(_){}$("restore").hidden=false;}
  function newDraft(){s.editorEpoch++;stashEditor();rememberOpenedDataset(null);s.draft=null;s.parentId=null;s.items=[];s.undo=[];$("dataset").value="";$("name").value=(s.data?.project?.task||"任务")+" · 训练数据";applyRecipe({});s.dirty=false;renderTable();renderSelected();renderWeights(false);setStep(1);$("save-state").textContent="新建草稿 · 尚未保存";feedback("已开始新草稿。切换前的编辑可通过上方入口恢复。","info");localBackup();}
  function restoreEditor(){s.editorEpoch++;const old=s.previous;if(!old)return;if(!(old.items||[]).every(i=>episode(i.episode_id))){feedback("切换前的编辑包含当前工作区不存在的回合，未载入。","error");return;}const current=editorSnapshot();s.draft=old.draft||null;s.parentId=old.parent_id||null;s.items=(old.items||[]).map(i=>({...i}));s.dirty=Boolean(old.dirty);s.undo=[];$("name").value=old.name||"";applyRecipe(old);s.previous=current;try{localStorage.setItem(storageKey+":previous",JSON.stringify(current));}catch(_){}renderTable();renderSelected();renderWeights();setStep(old.step||1);$("dataset").value=s.draft?.id||"";$("save-state").textContent=s.dirty?"已恢复切换前的编辑 · 请保存":s.draft?statusText(s.draft.status):"已恢复草稿";feedback("已恢复切换前的选择和配置。","success");rememberOpenedDataset(s.draft?.id||null);localBackup();}
  function validate(){const value=fieldValues();if(!value.name)throw new Error("请先在确认页填写训练集名称。");if(!value.items.length)throw new Error("请至少选择一个回合或片段。");if(!Object.values(value.split).every(Number.isFinite)||value.split.train+value.split.validation+value.split.test!==100)throw new Error("训练、验证、测试比例合计必须为 100%。");if(value.sampling.mode==="weighted"){const values=Object.values(value.sampling.weights);if(!values.length||values.some(v=>!Number.isFinite(v)||v<0)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>.0011)throw new Error("来源采样比例需为非负数，合计 100%。");}return value;}
  async function saveDraft(){const value=validate();if(locked())throw new Error("这个版本已确认。请先基于它新建版本。");if(s.draft?.id){value.id=s.draft.id;value.revision=s.draft.revision;}if(s.parentId)value.parent_id=s.parentId;const draft=await app.api("/api/datasets/draft",value);applyDraft(draft);await app.refresh();return draft;}
  async function perform(action){if(s.busy)return;s.busy=true;renderControls();try{await action();}catch(error){feedback(error.message+" 当前选择与编辑已保留。","error");app.notify(error.message,"error",true);}finally{s.busy=false;renderControls();}}
  async function confirmBuild(){await perform(async()=>{if(!$("name").value.trim()){$("name").focus();throw new Error("请填写训练集名称。");}const draft=s.dirty||!s.draft?await saveDraft():s.draft;if(draft.problems?.length){renderReview();throw new Error("请先处理列出的兼容性或划分问题。");}const confirmed=await app.api(`/api/datasets/${encodeURIComponent(draft.id)}/confirm`,{revision:draft.revision});applyDraft(confirmed);await app.refresh();await build();});}
  async function build(){if(!s.draft?.id)return;const job=await app.api(`/api/datasets/${encodeURIComponent(s.draft.id)}/build`,{});s.focusedRun=(job.job||job).id;feedback("准备作业已提交，可在运行记录查看日志和下载产物。","success");await app.refresh();renderBuild();}
  async function saveAnnotation(){const e=episode();if(!e)return;const control=$("save-annotation");control.disabled=true;$("annotation-result").disabled=true;$("annotation-note").disabled=true;try{const value=await app.api(`/api/episodes/${encodeURIComponent(e.id)}/annotation`,{result:$("annotation-result").value,note:$("annotation-note").value,revision:e.annotation?.revision??0});e.annotation=value.annotation||value;renderTable();feedback("任务结果标记已保存。它与结构检查结论分别记录。","success");}catch(error){feedback("标记保存失败："+error.message,"error");}finally{control.disabled=false;$("annotation-result").disabled=false;$("annotation-note").disabled=false;}}
  for(const b of root.querySelectorAll("[data-prep-step]"))b.addEventListener("click",()=>setStep(Number(b.dataset.prepStep)));
  $("next").addEventListener("click",()=>setStep(Math.min(3,s.step+1)));$("back").addEventListener("click",()=>setStep(Math.max(1,s.step-1)));
  for(const id of ["search","source","result-filter","quality-filter"])$(id).addEventListener(id==="search"?"input":"change",renderTable);
  $("import").addEventListener("click",()=>window.WorkbenchShell?.importData());$("demo").addEventListener("click",()=>document.getElementById("create-demo").click());
  $("refresh-episodes").addEventListener("click",loadEpisodes);
  $("select-visible").addEventListener("click",()=>mutateItems(()=>{for(const e of filtered().filter(e=>Number.isInteger(e.frames)&&e.frames>0)){s.items=s.items.filter(i=>i.episode_id!==e.id);s.items.push({episode_id:e.id,start_frame:0,end_frame:e.frames,task:e.task||""});}}));
  $("undo").addEventListener("click",()=>{if(!s.undo.length||locked())return;s.items=s.undo.pop();dirty();renderTable();renderSelected();renderWeights();renderClipHint();renderBasket();});$("clear-selection").addEventListener("click",()=>mutateItems(()=>s.items=[]));
  $("frame").addEventListener("input",()=>{clearTimeout(s.frameTimer);$("frame-number").value=$("frame").value;s.frameTimer=setTimeout(()=>loadFrame($("frame").value),75);});$("frame-number").addEventListener("change",()=>loadFrame($("frame-number").value));$("frame-number").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();clearTimeout(s.frameTimer);loadFrame($("frame-number").value);}});$("frame-prev").addEventListener("click",()=>loadFrame(s.frame-1));$("frame-next").addEventListener("click",()=>loadFrame(s.frame+1));$("image").addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight"].includes(e.key)){e.preventDefault();loadFrame(s.frame+(e.key==="ArrowRight"?1:-1));}});$("image").addEventListener("error",()=>{$("image").hidden=true;$("image-state").hidden=false;$("image-state").textContent="图像文件无法读取，可换相机或查看检查详情。";});$("camera").addEventListener("change",paintFrame);
  for(const id of ["clip-start","clip-end"])$(id).addEventListener("input",renderClipHint);$("set-start").addEventListener("click",()=>{$("clip-start").value=s.frame;renderClipHint();});$("set-end").addEventListener("click",()=>{$("clip-end").value=s.frame+1;renderClipHint();});$("add-clip").addEventListener("click",addClip);$("save-annotation").addEventListener("click",saveAnnotation);
  $("sampling-mode").addEventListener("change",()=>{dirty();renderWeights();});$("name").addEventListener("input",dirty);$("split-preset").addEventListener("change",()=>{if($("split-preset").value!=="custom"){const values=$("split-preset").value.split(",");["train","validation","test"].forEach((k,i)=>$("split-"+k).value=values[i]);}dirty();renderSplit();});for(const k of ["train","validation","test","seed"])$("split-"+k).addEventListener("input",()=>{$("split-preset").value="custom";dirty();renderSplit();});
  $("save").addEventListener("click",()=>perform(async()=>{await saveDraft();feedback("草稿已保存，原始数据与已确认版本保持不变。","success");}));$("preview-split").addEventListener("click",()=>perform(async()=>{await saveDraft();renderSplit();feedback(s.draft.problems?.length?"已保存。请查看需要处理的划分或兼容性问题。":"草稿与分组划分已保存。",s.draft.problems?.length?"warning":"success");}));
  $("dataset").addEventListener("change",renderControls);$("load").addEventListener("click",()=>perform(async()=>{stashEditor();const draft=await app.api("/api/datasets/"+encodeURIComponent($("dataset").value));applyDraft(draft);setStep(3);feedback("已载入训练集。确认版本可通过“基于此版本新建”继续调整。","info");}));
  $("new").addEventListener("click",newDraft);$("restore").addEventListener("click",restoreEditor);
  $("fork").addEventListener("click",()=>{const parent=s.draft?.id;rememberOpenedDataset(null);s.parentId=parent;s.draft=null;s.dirty=true;s.undo=[];$("name").value=$("name").value+" · 新版本";$("dataset").value="";dirty();renderTable();renderSelected();renderWeights();renderClipHint();setStep(2);feedback("已建立新版本草稿，原确认版本不会被改写。","info");});$("confirm").addEventListener("click",confirmBuild);$("build-again").addEventListener("click",()=>perform(build));
  document.addEventListener("workbench:state",event=>{s.data=event.detail.data;updateDatasetPicker();if(!s.initialized){s.initialized=true;$("name").value=(s.data.project?.task||"任务")+" · 训练数据";}const signature=JSON.stringify((s.data.assets||[]).map(a=>[a.id,a.name,a.source_kind,a.quality?.valid,a.quality?.manifest_sha256]));if(signature!==s.assetSignature){s.assetSignature=signature;loadEpisodes();}if(s.step===3)renderBuild();renderControls();});
  window.addEventListener("pagehide",localBackup);
  window.PreparationWorkbench={refreshEpisodes:loadEpisodes};
  setStep(1);
  app.refresh();
})();
