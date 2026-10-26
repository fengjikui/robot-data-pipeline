"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const sourceLabels = {self_capture: "自行采集", open: "开源数据", purchased: "采购交付", simulation: "仿真数据", synthetic: "合成教学样例"};
  const stageLabels = {check: "质量检查", export: "派生导出", check_export: "检查并导出"};
  const statusLabels = {queued: "排队中", running: "运行中", cancelling: "正在停止", succeeded: "已完成", failed: "失败", cancelled: "已停止", interrupted: "中断待重试"};
  const policyLabels = {act: "ACT", diffusion: "Diffusion Policy", openpi: "openpi / π0", openvla: "OpenVLA", ppo: "PPO"};
  const guidance = {
    act: "ACT 可使用具有兼容观察、动作语义和时间组织的 LeRobot 数据。本版导出的是工作台 JSONL 契约；接入指定 LeRobot 后端、相机映射、归一化与训练窗口后，仍需完成训练读取验收。",
    diffusion: "Diffusion Policy 需要核对观察历史、动作预测窗口、动作定义及归一化。兼容的 LeRobot 后端可复用同一数据导出；原作者实现可能使用其他容器。本版 JSONL 不能直接当作其训练数据。",
    openpi: "openpi 需要与具体配方对应的数据重排、机器人变换、归一化统计和模型输入处理。容器可读取不代表动作可用，本版尚未接入这些适配与训练后端。",
    openvla: "OpenVLA 的参考训练路径需要对应的数据读取器与动作处理；不能把 28 维动作简单截取成 7 维。需要核对数据语义、归一化、训练和控制接口，本版尚未接入。",
    ppo: "在线 PPO 还需要可交互环境、奖励、重置与终止规则。静态遥操作示范可以用于独立的预训练或混合方法，但不能直接替代 PPO 在线采样，本版尚未接入此类环境。"
  };
  const state = {data: null, assetId: null, jobId: null, panel: "quality", busy: false, messageTimer: null, refreshing: false};

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function notify(text, type = "info", persist = false) {
    clearTimeout(state.messageTimer);
    $("message").textContent = text;
    $("message").className = `message ${type}`;
    $("message").hidden = false;
    if (!persist) state.messageTimer = setTimeout(() => { $("message").hidden = true; }, 9000);
  }

  async function api(path, body) {
    const options = {cache: "no-store", headers: {Accept: "application/json"}};
    if (body !== undefined) {
      if (!state.data?.csrf_token) throw new Error("本地连接尚未就绪，请刷新后重试。");
      options.method = "POST";
      options.headers["Content-Type"] = "application/json";
      options.headers["X-Workbench-Token"] = state.data.csrf_token;
      options.body = JSON.stringify(body);
    }
    const response = await fetch(path, options);
    let result;
    try { result = await response.json(); } catch (_) { throw new Error("服务返回了无法读取的结果，请查看本地运行日志。"); }
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : result.message || `操作失败（HTTP ${response.status}）`);
    return result;
  }

  const selectedAsset = () => state.data?.assets?.find((asset) => asset.id === state.assetId);
  const selectedJobs = () => (state.data?.jobs || []).filter((job) => job.asset_id === state.assetId);
  const active = (job) => ["queued", "running", "cancelling"].includes(job.status);
  const isGood = (asset) => asset?.quality?.valid === true;
  const formatTime = (value) => {
    if (!value) return "时间未记录";
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString("zh-CN", {month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"});
  };

  function setImport(visible) {
    $("import-section").hidden = !visible;
    $("toggle-import").setAttribute("aria-expanded", String(visible));
    if (visible) {
      $("import-task").value ||= state.data?.project?.task || "";
      $("import-section").scrollIntoView({block: "start", behavior: "instant"});
      $("import-path").focus();
    }
  }

  function showPanel(panel, moveFocus = false) {
    state.panel = panel;
    for (const name of ["quality", "jobs"]) {
      const selected = name === panel;
      $("panel-" + name).hidden = !selected;
      $("tab-" + name).setAttribute("aria-selected", String(selected));
      $("tab-" + name).tabIndex = selected ? 0 : -1;
    }
    if (moveFocus) $("tab-" + panel).focus();
  }

  function badge(text, tone = "neutral") { return element("span", text, "badge " + tone); }

  function listFocusKey(list) {
    const focused = document.activeElement;
    return list.contains(focused) && focused.matches("button[data-focus-key]") ? focused.dataset.focusKey : null;
  }

  function restoreListFocus(list, key) {
    if (!key) return;
    const button = [...list.querySelectorAll("button[data-focus-key]")].find((item) => item.dataset.focusKey === key);
    button?.focus({preventScroll: true});
  }

  function renderProject() {
    const project = state.data.project || {};
    $("project-summary").replaceChildren();
    for (const [label, value] of [["任务", project.task || "尚未设置"], ["目标", project.target || "尚未指定"], ["策略", policyLabels[project.policy] || project.policy || "尚未选择"]]) {
      const item = element("span");
      item.append(element("strong", label), document.createTextNode(String(value)));
      $("project-summary").append(item);
    }
    if ($("project-form").hidden) {
      $("project-task").value = project.task || "";
      $("project-target").value = project.target || "";
      $("project-policy").value = project.policy || "act";
    }
  }

  function renderAssets() {
    const focusKey = listFocusKey($("asset-list"));
    const query = $("search").value.trim().toLocaleLowerCase();
    const source = $("source-filter").value;
    const assets = state.data.assets || [];
    const matches = assets.filter((asset) => (!source || asset.source_kind === source) && [asset.name, asset.task, ...(asset.tags || [])].join(" ").toLocaleLowerCase().includes(query));
    $("asset-count").textContent = `${matches.length} 份资产${matches.length !== assets.length ? ` / 共 ${assets.length} 份` : ""}`;
    $("asset-list").replaceChildren();
    if (!matches.length) $("asset-list").append(element("p", assets.length ? "没有匹配的资产。试试其他名称、任务或标签。" : "导入数据后，可在这里按任务、标签和来源查找。", "side-empty"));
    for (const asset of matches) {
      const item = element("button", null, "asset-item");
      item.type = "button";
      item.dataset.focusKey = "asset-" + asset.id;
      item.setAttribute("aria-current", String(asset.id === state.assetId));
      item.append(element("strong", asset.name || asset.id));
      item.append(element("small", asset.task || sourceLabels[asset.source_kind] || "任务待补充"));
      const quality = asset.quality;
      const status = element("span", null, "asset-status" + (quality ? (quality.valid ? " good" : " bad") : ""));
      status.append(element("span", null, "status-dot"), document.createTextNode(quality ? (quality.valid ? "结构检查通过" : "发现检查问题") : "尚未检查"));
      item.append(status);
      item.addEventListener("click", () => {
        state.assetId = asset.id;
        state.jobId = null;
        showPanel("quality");
        render();
      });
      $("asset-list").append(item);
    }
    restoreListFocus($("asset-list"), focusKey);
  }

  function renderQuality(asset) {
    const container = $("quality-content");
    container.replaceChildren();
    const quality = asset.quality;
    if (!quality) {
      container.append(element("p", "尚未运行质量检查。检查会核对已支持的原始回合结构、数值和引用文件；任务成功、硬件同步与动作物理含义仍需额外核验。", "quality-empty"));
      return;
    }
    const title = element("div", null, "quality-title");
    title.append(element("strong", quality.valid ? "结构检查通过" : "存在阻止导出的问题"), badge(quality.valid ? "限定范围内通过" : "需要处理", quality.valid ? "good" : "bad"));
    container.append(title);
    const scope = quality.scope;
    container.append(element("p", typeof scope === "string" ? scope : "检查覆盖已支持的原始记录结构、有限数值、记录顺序和引用文件。通过结果不代表物理同步、任务成功或策略可以部署。", "quality-description"));
    const summary = element("div", null, "quality-summary");
    if (Number.isFinite(quality.frames)) summary.append(element("span", `${quality.frames} 条记录`));
    if (quality.state_dim) summary.append(element("span", `state ${quality.state_dim} 维`));
    if (quality.action_dim) summary.append(element("span", `action ${quality.action_dim} 维`));
    if (summary.childNodes.length) container.append(summary);
    for (const [field, label, kind] of [["errors", "必须处理", "errors"], ["warnings", "注意与待核实", "warnings"]]) {
      const values = quality[field];
      if (Array.isArray(values) && values.length) {
        const group = element("div", null, "finding-group " + kind);
        group.append(element("h4", `${label} · ${values.length}`));
        const list = element("ul");
        for (const value of values.slice(0, 50)) list.append(element("li", typeof value === "string" ? value : JSON.stringify(value)));
        if (values.length > 50) list.append(element("li", `另有 ${values.length - 50} 项，请查看完整结果。`));
        group.append(list);
        container.append(group);
      }
    }
    const details = element("details");
    details.append(element("summary", "完整检查结果"), element("pre", JSON.stringify(quality, null, 2)));
    container.append(details);
  }

  function renderDetail() {
    const asset = selectedAsset();
    $("empty-state").hidden = Boolean(asset);
    $("asset-detail").hidden = !asset;
    if (!asset) return;
    $("asset-name").textContent = asset.name || asset.id;
    $("asset-source").textContent = sourceLabels[asset.source_kind] || asset.source_kind || "数据资产";
    $("asset-task").textContent = asset.task || "任务说明待补充";
    const qualityBadge = $("asset-quality-badge");
    qualityBadge.textContent = asset.quality ? (asset.quality.valid ? "结构检查通过" : "检查未通过") : "尚未检查";
    qualityBadge.className = "badge " + (asset.quality ? (asset.quality.valid ? "good" : "bad") : "neutral");
    const values = [
      ["数据格式", asset.format || "待识别"], ["来源本体", asset.embodiment || "未知"],
      ["记录数", Number.isFinite(asset.frames) ? String(asset.frames) : "检查后确认"], ["使用条件", asset.license || "待确认"]
    ];
    $("asset-metadata").replaceChildren();
    for (const [term, value] of values) {
      const group = element("div");
      group.append(element("dt", term), element("dd", value));
      $("asset-metadata").append(group);
    }
    $("asset-tags").replaceChildren();
    for (const tag of asset.tags || []) $("asset-tags").append(element("span", tag, "tag"));
    const jobs = selectedJobs();
    const busy = jobs.some(active) || state.busy;
    $("run-check").disabled = busy;
    $("run-export").disabled = busy || !isGood(asset);
    $("auto-chain").disabled = busy;
    $("run-check").textContent = $("auto-chain").checked ? "检查并自动导出" : "运行质量检查";
    $("stage-hint").textContent = busy ? "当前作业正在排队或运行。日志与停止操作在“运行记录”中。" : isGood(asset) ? "可导出本工作台 JSONL 契约，尚不能直接代替 LeRobot / RLDS 训练输入。" : "检查通过后才能导出；派生文件写入新目录，原始数据保留。";
    renderQuality(asset);
    const policy = state.data.project?.policy || "act";
    $("policy-label").textContent = policyLabels[policy] || policy;
    $("recipe-guidance").textContent = (guidance[policy] || "当前配方尚未接入，需要确认数据读取与动作契约。") + " G1 Dex3 常见的 28 维双臂与双手记录不包含完整 43 自由度，也不能由此补出行走数据。";
    renderJobs(jobs);
  }

  function renderJobs(jobs) {
    const focusKey = listFocusKey($("job-list"));
    $("job-count").textContent = jobs.length ? String(jobs.length) : "";
    $("job-list").replaceChildren();
    if (!jobs.length) $("job-list").append(element("p", "还没有运行记录。每次检查或导出都会创建独立作业，保存日志与产物。", "quality-empty"));
    for (const job of [...jobs].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))) {
      const row = element("div", null, "job-row");
      const button = element("button");
      button.type = "button";
      button.dataset.focusKey = "job-" + job.id;
      button.append(element("strong", stageLabels[job.stage] || job.stage), element("small", job.id));
      button.addEventListener("click", () => { state.jobId = job.id; loadJob(job.id); });
      row.append(button, badge(statusLabels[job.status] || job.status, job.status === "succeeded" ? "good" : ["failed", "interrupted"].includes(job.status) ? "bad" : "neutral"));
      const time = element("time", formatTime(job.created_at));
      if (job.created_at) time.dateTime = job.created_at;
      row.append(time);
      $("job-list").append(row);
    }
    restoreListFocus($("job-list"), focusKey);
    if (state.jobId && !jobs.some((job) => job.id === state.jobId)) state.jobId = null;
    if (!state.jobId && jobs.length) state.jobId = jobs.find(active)?.id || jobs[0].id;
    $("job-detail").hidden = !state.jobId;
    if (state.jobId && state.panel === "jobs") loadJob(state.jobId);
  }

  async function loadJob(id) {
    try {
      const data = await api("/api/jobs/" + encodeURIComponent(id));
      if (id !== state.jobId) return;
      const job = data.job || data;
      $("job-detail").hidden = false;
      $("job-detail-heading").textContent = (stageLabels[job.stage] || job.stage || "作业") + " · " + (statusLabels[job.status] || job.status || "");
      $("cancel-job").hidden = !active(job);
      $("cancel-job").disabled = state.busy;
      $("job-error").hidden = !job.error;
      $("job-error").textContent = job.error || "";
      $("job-log").textContent = (Array.isArray(data.log) ? data.log.join("\n") : data.log) || "等待作业日志…";
      const result = data.result || job.result;
      $("job-result").textContent = result ? JSON.stringify(result, null, 2) : "作业尚未产生结果。";
      $("job-artifacts").replaceChildren();
      for (const file of result?.artifacts || []) {
        if (typeof file.url !== "string" || !file.url.startsWith("/api/artifacts/")) continue;
        const link = element("a", file.name || "下载产物");
        link.href = file.url;
        link.download = "";
        $("job-artifacts").append(link);
      }
    } catch (error) { notify(error.message, "error", true); }
  }

  function render() {
    renderProject();
    renderAssets();
    renderDetail();
  }

  async function refresh({quiet = false} = {}) {
    if (state.refreshing) return;
    state.refreshing = true;
    try {
      state.data = await api("/api/state");
      if (!(state.data.assets || []).some((asset) => asset.id === state.assetId)) state.assetId = state.data.assets?.[0]?.id || null;
      $("connection").textContent = "本地服务已连接";
      $("version").textContent = state.data.version || "";
      render();
    } catch (error) {
      $("connection").textContent = "本地服务连接中断";
      if (!quiet) notify(error.message + " 可点击页脚“刷新状态”重新连接。", "error", true);
    } finally { state.refreshing = false; }
  }

  async function act(button, callback) {
    if (state.busy) return;
    state.busy = true;
    const old = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "处理中…"; }
    try { await callback(); } catch (error) { notify(error.message, "error", true); }
    finally {
      state.busy = false;
      if (button) { button.disabled = false; button.textContent = old; }
      if (state.data) render();
    }
  }

  $("toggle-import").addEventListener("click", () => setImport($("import-section").hidden));
  $("empty-import").addEventListener("click", () => setImport(true));
  $("close-import").addEventListener("click", () => setImport(false));
  $("search").addEventListener("input", () => { if (state.data) renderAssets(); });
  $("source-filter").addEventListener("change", () => { if (state.data) renderAssets(); });
  $("auto-chain").addEventListener("change", () => { if (state.data) renderDetail(); });
  $("refresh").addEventListener("click", () => refresh());
  $("toggle-project").addEventListener("click", () => {
    const open = $("project-form").hidden;
    $("project-form").hidden = !open;
    $("toggle-project").setAttribute("aria-expanded", String(open));
    $("toggle-project").textContent = open ? "收起配置" : "编辑实验配置";
    if (open) $("project-task").focus();
  });

  $("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const button = event.submitter || $("project-form").querySelector("button[type=submit]");
    act(button, async () => {
      await api("/api/project", {task: $("project-task").value.trim(), target: $("project-target").value.trim(), policy: $("project-policy").value});
      $("project-form").hidden = true;
      $("toggle-project").textContent = "编辑实验配置";
      $("toggle-project").setAttribute("aria-expanded", "false");
      await refresh();
      notify("实验配置已保存。来源本体与目标本体分别记录。", "success");
    });
  });

  $("import-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(event.submitter || $("import-form").querySelector("button[type=submit]"), async () => {
      const payload = Object.fromEntries(new FormData($("import-form")));
      for (const key of Object.keys(payload)) payload[key] = String(payload[key]).trim();
      payload.tags = payload.tags.split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean);
      const result = await api("/api/assets/import", payload);
      const asset = result.asset || result;
      state.assetId = asset.id || null;
      state.jobId = null;
      $("import-form").reset();
      setImport(false);
      showPanel("quality");
      await refresh();
      notify("数据已复制入库。可开始检查，原始目录保持原样。", "success");
    });
  });

  $("create-demo").addEventListener("click", () => act($("create-demo"), async () => {
    const result = await api("/api/demo", {});
    state.assetId = (result.asset || result).id || null;
    state.jobId = null;
    await refresh();
    notify("已生成合成教学样例，用于体验工作流。它不是真机采集数据。", "success");
  }));

  async function runStage(stage, button) {
    if (!selectedAsset()) return;
    await act(button, async () => {
      const result = await api("/api/jobs", {asset_id: state.assetId, stage});
      state.jobId = (result.job || result).id || null;
      showPanel("jobs");
      await refresh();
      notify("作业已提交，可在运行记录中查看日志或停止。", "success");
    });
  }
  $("run-check").addEventListener("click", () => runStage($("auto-chain").checked ? "check_export" : "check", $("run-check")));
  $("run-export").addEventListener("click", () => runStage("export", $("run-export")));
  $("cancel-job").addEventListener("click", () => act($("cancel-job"), async () => {
    await api("/api/jobs/" + encodeURIComponent(state.jobId) + "/cancel", {});
    await refresh();
    notify("已请求停止本次作业；其他进程不受影响。", "success");
  }));
  for (const name of ["quality", "jobs"]) {
    $("tab-" + name).addEventListener("click", () => { showPanel(name); if (name === "jobs" && state.jobId) loadJob(state.jobId); });
    $("tab-" + name).addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const panel = event.key === "Home" ? "quality" : event.key === "End" ? "jobs" : name === "quality" ? "jobs" : "quality";
        showPanel(panel, true);
        if (panel === "jobs" && state.jobId) loadJob(state.jobId);
      }
    });
  }
  refresh();
  setInterval(() => { if (!document.hidden && !state.busy) refresh({quiet: true}); }, 3000);
})();
