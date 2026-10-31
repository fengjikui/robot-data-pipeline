(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const app = window.Workbench;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const stages = [
    {id: "input", title: "数据获取", subtitle: "自行采集 / 外部导入", copy: "两种来源汇合为一份可追溯的数据资产。先选数据，再进入处理阶段。", input: "已保存的采集回合，或已下载的开源 / 采购目录", output: "原始文件快照、来源标签、文件清单与校验值", note: "本机导入上限 128 MiB / 10,000 文件。采集执行器支持保存后自动入库；网页搜索和外部下载待接入。"},
    {id: "check", title: "质量检查", subtitle: "结构、引用、数值与维度", copy: "先确认文件能否正确读取，定位缺失图像、异常数值与状态 / 动作维度问题。", input: "当前数据资产的原始快照", output: "检查报告、问题列表与警告", note: "当前检查器覆盖 Unitree 原始 JSON 的 28 维双臂与双手结构。结构通过不代表搬箱任务质量已经验收。"},
    {id: "convert", title: "数据转换", subtitle: "派生产物与训练格式", copy: "保留原始文件，在独立目录生成派生产物。当前已接入工作台 JSONL 导出，官方 LeRobot 转换器仍待接入。", input: "通过结构质检的数据快照", output: "records.jsonl、contract.json 与来源信息", note: "当前 JSONL 是工作台中间契约，不能直接当成 LeRobot 训练数据。后续转换需明确关节顺序、动作语义、图像通道与采样频率。"},
    {id: "augment", title: "数据增强", subtitle: "按需增强，审查后使用", copy: "为同一份合格数据生成可审查的派生版本，再由训练任务选择使用。增强配方与原始来源一起记录。", input: "已检查的数据与增强配方", output: "增强版本、原件对照和审查结论", note: "待接入图像增强与审查工具。首批可从光照、颜色、轻微噪声开始；改变几何或动作的数据需要单独验证。"},
    {id: "train", title: "模型训练", subtitle: "策略、数据与运行环境", copy: "把数据版本、策略配置和运行环境绑定到一次训练，记录模型产物及其数据来源。", input: "目标策略可读取的数据、训练参数与计算环境", output: "模型检查点、训练日志和完整配置", note: "ACT、Diffusion 等训练器待接入。选择页面上方的策略只保存目标组合，目前不会启动训练。"},
    {id: "evaluate", title: "仿真测试", subtitle: "在目标任务中闭环验证", copy: "将模型放进匹配的机器人、控制器和搬箱场景里执行，查看完整回合，而不只看离线损失。", input: "模型检查点、仿真环境和评估条件", output: "成功率、失败回合、轨迹和演示视频", note: "仿真后端待接入。当前工作台尚未产生模型闭环仿真结果。"},
    {id: "deploy", title: "真机部署", subtitle: "模型与设备验收", copy: "将通过评估的策略打包到目标运行环境，核对本体、动作范围与控制接口。", input: "通过验收的模型、设备配置和部署适配器", output: "部署包、设备版本和验收记录", note: "部署服务待接入。当前页面不会连接机器人或下发控制命令。"}
  ];
  const sourceNames = {self_capture: "自行采集", open: "开源数据", purchased: "采购交付", simulation: "仿真数据", synthetic: "合成样例"};
  const jobNames = {prepare: "构建准备包", check: "质量检查", export: "JSONL 导出", check_export: "检查 → JSONL 导出"};
  const statusNames = {queued: "排队中", running: "运行中", cancelling: "停止中", succeeded: "已完成", failed: "失败", cancelled: "已停止", interrupted: "已中断"};
  const active = j => ["queued", "running", "cancelling"].includes(j.status);
  const time = value => value ? new Date(value).toLocaleString("zh-CN", {hour12: false}) : "—";
  let state = null, stageId = "input", view = "task", runId = null;
  let configLoaded = false, selectionPending = false, runRequest = 0;
  let chain = false;
  const current = () => state?.data.assets.find(a => a.id === state.assetId);
  const jobs = () => state?.data.jobs || [];
  const assetJobs = () => jobs().filter(j => j.asset_id === state?.assetId);
  function button(label, action, cls = "button") {
    const node = el("button", label, cls); node.type = "button";
    node.addEventListener("click", action); return node;
  }
  function showView(name, updateHash = true) {
    if (!["task", "library", "capture", "runs"].includes(name)) name = "task";
    view = name;
    for (const key of ["task", "library", "capture", "runs"]) $("view-" + key).hidden = key !== name;
    for (const node of document.querySelectorAll("[data-view]")) {
      if (node.dataset.view === name) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    }
    if (updateHash && location.hash !== "#" + name) location.hash = name;
    if (name === "runs") { if (!runId) runId = jobs()[0]?.id || null; renderRuns(); if (runId) loadRun(); }
  }
  function importData(source, path = "") {
    showView("library"); app.setImport(true);
    if (source) $("import-source").value = source;
    if (["open", "purchased"].includes(source)) $("import-task").value = "";
    if (path) $("import-path").value = path;
  }
  function status(stage) {
    const asset = current();
    if (stage.id === "input") return asset ? ["已入库", "good"] : ["待选数据", "neutral"];
    if (["check", "convert"].includes(stage.id)) {
      if (!asset) return ["待输入", "neutral"];
      const matching = assetJobs().filter(j => stage.id === "check" ? ["check", "check_export"].includes(j.stage) : ["export", "check_export"].includes(j.stage));
      const latest = matching[0];
      if (latest && active(latest)) return [statusNames[latest.status], "running"];
      if (latest && ["failed", "interrupted", "cancelled"].includes(latest.status)) return [statusNames[latest.status], "bad"];
      if (stage.id === "check" && asset?.quality) return asset.quality.valid ? ["结构通过", "good"] : ["发现问题", "bad"];
      if (stage.id === "convert" && latest?.status === "succeeded") return ["JSONL 已导出", "good"];
      return [stage.id === "check" ? "可运行" : asset.quality?.valid ? "JSONL 可导出" : "待质检", "neutral"];
    }
    return ["待接入", "neutral"];
  }
  function renderTask() {
    const asset = current();
    $("project-heading").textContent = state.data.project.task || "当前任务";
    $("nav-asset-count").textContent = state.data.assets.length;
    $("nav-job-count").textContent = jobs().length;
    const select = $("task-asset");
    const signature = JSON.stringify(state.data.assets.map(a => [a.id, a.name]));
    if (select.dataset.signature !== signature) {
      select.replaceChildren(new Option("请选择本次处理的数据", ""));
      for (const a of state.data.assets) select.add(new Option(a.name, a.id));
      select.dataset.signature = signature;
    }
    if (!selectionPending) select.value = state.assetId || "";
    $("task-library").disabled = !asset;
    $("task-input-note").textContent = asset ? `${sourceNames[asset.source_kind] || asset.source_kind} · ${asset.format || "待识别格式"} · ${asset.frames ?? "未知"} 条记录 · ${asset.embodiment || "来源本体待确认"}。数据任务：${asset.task || "待确认"}${asset.synthetic ? "（合成样例，非真机数据）" : ""}` : "尚未选择输入。可导入已保存的目录，也可用合成样例体验流程。";
    $("task-first-run").hidden = Boolean(asset);
    const pipeline = $("task-pipeline");
    const focusKey = document.activeElement?.dataset.stage;
    pipeline.replaceChildren();
    stages.forEach((stage, index) => {
      const [label, tone] = status(stage);
      const li = el("li");
      const node = button("", () => { stageId = stage.id; renderTask(); $("flow-" + stage.id).focus(); }, "flow-step");
      node.id = "flow-" + stage.id; node.dataset.stage = stage.id;
      if (stage.id === stageId) node.setAttribute("aria-current", "step");
      const text = el("span", null, "flow-text");
      text.append(el("strong", stage.title), el("small", stage.subtitle));
      node.append(el("span", String(index + 1).padStart(2, "0"), "flow-number"), text, el("span", label, "flow-status " + tone));
      li.append(node); pipeline.append(li);
    });
    if (focusKey) $("flow-" + focusKey)?.focus({preventScroll: true});
    renderStage();
  }
  function renderStage() {
    const stage = stages.find(s => s.id === stageId), asset = current();
    const focusId = $("stage-inspector").contains(document.activeElement) ? document.activeElement.id : null;
    $("stage-position").textContent = `阶段 ${stages.indexOf(stage) + 1} / ${stages.length}`;
    const [label, tone] = status(stage);
    $("stage-status").textContent = label; $("stage-status").className = "badge " + tone;
    $("stage-title").textContent = stage.title; $("stage-copy").textContent = stage.copy;
    $("stage-note").textContent = stage.note;
    $("stage-contract").replaceChildren();
    for (const [key, value] of [["输入", stage.input], ["输出", stage.output]]) {
      const group = el("div"); group.append(el("dt", key), el("dd", value)); $("stage-contract").append(group);
    }
    const actions = $("stage-actions"); actions.replaceChildren();
    if (stage.id === "input") {
      if (asset) actions.append(button("下一步：质量检查 →", () => { stageId = "check"; renderTask(); }, "button primary"));
      actions.append(button(asset ? "查看当前数据" : "去数据集库", () => showView("library"), asset ? "button" : "button primary"), button("导入目录", () => importData()));
    } else if (["check", "convert"].includes(stage.id)) {
      const canRun = Boolean(asset) && !state.busy && !jobs().some(active) && (stage.id === "check" || asset.quality?.valid);
      const action = button(stage.id === "check" ? (chain ? "检查并自动导出" : "运行质量检查") : "导出工作台 JSONL", () => app.runStage(stage.id === "check" ? (chain ? "check_export" : "check") : "export", action), "button primary");
      action.id = "stage-run"; action.disabled = !canRun; actions.append(action);
      if (stage.id === "check") {
        const control = el("label", null, "check-label"); const checkbox = el("input"); checkbox.type = "checkbox"; checkbox.id = "task-chain"; checkbox.checked = chain; checkbox.disabled = !canRun;
        checkbox.addEventListener("change", () => { chain = checkbox.checked; renderStage(); });
        control.append(checkbox, document.createTextNode("通过后自动导出 JSONL")); actions.append(control);
      }
      if (!asset) actions.append(button("先选择数据", () => { stageId = "input"; renderTask(); }, "text-button"));
      else if (stage.id === "convert" && !asset.quality?.valid) actions.append(button("先运行质量检查", () => { stageId = "check"; renderTask(); }, "text-button"));
    } else {
      actions.append(el("span", "此阶段尚未接入执行后端", "unavailable-note"));
    }
    const history = $("stage-history"); history.replaceChildren();
    const matching = assetJobs().filter(j => stage.id === "check" ? ["check", "check_export"].includes(j.stage) : stage.id === "convert" ? ["export", "check_export"].includes(j.stage) : false).slice(0, 2);
    if (!matching.length) history.append(el("p", "尚无运行记录。执行后可查看日志与下载产物。", "field-note"));
    for (const job of matching) {
      const link = button(`${statusNames[job.status]} · ${time(job.created_at)} →`, () => openRun(job.id), "history-link"); history.append(link);
    }
    if (focusId) $(focusId)?.focus({preventScroll: true});
  }
  function renderRuns() {
    if (!state) return;
    $("runs-count").textContent = `${jobs().length} 次运行`;
    const list = $("all-runs");
    const focusKey = document.activeElement?.dataset.run;
    list.replaceChildren();
    if (!jobs().length) list.append(el("div", "还没有运行记录。选择数据后，从质量检查开始。", "runs-empty"));
    for (const job of jobs()) {
      const asset = state.data.assets.find(a => a.id === job.asset_id);
      const dataset = (state.data.datasets || []).find(d => d.id === job.dataset_id);
      const row = button("", () => openRun(job.id), "run-row");
      row.dataset.run = job.id; row.setAttribute("aria-current", String(job.id === runId));
      const info = el("span"); info.append(el("strong", jobNames[job.stage] || job.stage), el("small", dataset ? "训练集 · " + dataset.name : asset?.name || job.asset_id || job.dataset_id));
      row.append(info, el("span", statusNames[job.status] || job.status, "badge " + (job.status === "succeeded" ? "good" : job.status === "failed" ? "bad" : "neutral")), el("time", time(job.created_at)));
      list.append(row);
    }
    if (focusKey) list.querySelector(`[data-run="${focusKey}"]`)?.focus({preventScroll: true});
  }
  function openRun(id) { if (runId !== id) $("run-inspector").hidden = true; runId = id; showView("runs"); }
  async function loadRun() {
    const id = runId, request = ++runRequest;
    try {
      const data = await app.api("/api/jobs/" + encodeURIComponent(id));
      if (request !== runRequest || id !== runId || view !== "runs") return;
      const job = data.job;
      $("run-inspector").hidden = false;
      $("run-title").textContent = `${jobNames[job.stage] || job.stage} · ${statusNames[job.status]}`;
      $("run-cancel").hidden = !active(job);
      $("run-context").replaceChildren();
      const asset = state.data.assets.find(a => a.id === job.asset_id);
      const dataset = (state.data.datasets || []).find(d => d.id === job.dataset_id);
      for (const [key, value] of [["输入数据", dataset ? "训练集 · " + dataset.name : asset?.name || job.asset_id || job.dataset_id], ["作业编号", job.id], ["创建时间", time(job.created_at)]]) {
        const node = el("div"); node.append(el("dt", key), el("dd", value)); $("run-context").append(node);
      }
      $("run-error").hidden = !job.error; $("run-error").textContent = job.error || "";
      $("run-log").textContent = data.log || "等待运行日志…";
      $("run-result").textContent = JSON.stringify({input: data.input || null, result: data.result}, null, 2);
      $("run-artifacts").replaceChildren();
      for (const file of data.result?.artifacts || []) {
        if (typeof file.url !== "string" || !file.url.startsWith("/api/artifacts/")) continue;
        const a = el("a", file.name || "下载产物"); a.href = file.url; a.download = ""; $("run-artifacts").append(a);
      }
    } catch (error) { app.notify(error.message, "error", true); }
  }
  document.addEventListener("workbench:state", event => {
    state = event.detail;
    renderTask();
    if (!configLoaded) {
      for (const field of $("capture-form").elements) if (field.name) field.value = state.data.capture?.[field.name] || "";
      $("capture-saved").textContent = state.data.capture?.updated_at ? "上次保存 " + time(state.data.capture.updated_at) : "尚未保存";
      configLoaded = true;
    }
    if (view === "runs") { if (!runId) runId = jobs()[0]?.id || null; renderRuns(); if (runId) loadRun(); }
  });
  for (const nav of document.querySelectorAll("[data-view]")) nav.addEventListener("click", () => showView(nav.dataset.view));
  window.addEventListener("hashchange", () => {
    const route = location.hash.slice(1);
    if (["", "task", "library", "capture", "runs"].includes(route)) showView(route, false);
  });
  $("source-capture").addEventListener("click", () => showView("capture"));
  $("source-external").addEventListener("click", () => importData("open"));
  $("task-library").addEventListener("click", () => showView("library"));
  $("task-import").addEventListener("click", () => importData());
  $("task-demo").addEventListener("click", () => $("create-demo").click());
  $("task-asset").addEventListener("change", async () => {
    selectionPending = true; $("task-asset").disabled = true;
    try { await app.selectAsset($("task-asset").value); }
    catch (error) { app.notify(error.message, "error", true); }
    finally { selectionPending = false; $("task-asset").disabled = false; if (state) renderTask(); }
  });
  $("capture-import").addEventListener("click", () => importData("self_capture", $("capture-directory").value));
  $("capture-form").addEventListener("submit", async event => {
    event.preventDefault(); const submit = event.submitter || $("capture-form").querySelector('button[type="submit"]'); if (submit.disabled) return; submit.disabled = true;
    try {
      const config = await app.api("/api/capture/config", Object.fromEntries(new FormData($("capture-form"))));
      $("capture-saved").textContent = "已保存 " + time(config.updated_at);
      app.notify("设备备注已保存；采集服务请使用上方操作区。", "success"); await app.refresh();
    } catch (error) { app.notify(error.message, "error", true); }
    finally { submit.disabled = false; }
  });
  $("run-cancel").addEventListener("click", async () => {
    const node = $("run-cancel"); node.disabled = true;
    try { await app.api("/api/jobs/" + encodeURIComponent(runId) + "/cancel", {}); await app.refresh(); }
    catch (error) { app.notify(error.message, "error", true); }
    finally { node.disabled = false; }
  });
  window.WorkbenchShell = {showView, openRun, importData};
  showView(location.hash.slice(1), false);
})();
