# Windows 部署与启动指南（供 Agent 执行）

适用版本：工作台 v0.1.0；文档日期：2026-10-26。默认使用 Windows 原生 PowerShell 与 CPython，不把 WSL 的执行结果记成 Windows 原生验收。

先通读并选择路线：第2节初始化参数 → 第3节选择源码或 wheel 安装 → 第4节选择前台或后台启动 → 第5节验收 → 第9节交接。安装与启动的替代方案不能不加判断地全部执行，第6节完整测试按验收需要运行。

## 1. 先明确本次要部署什么

仓库：<https://github.com/fengjikui/robot-data-pipeline>，默认分支 `main`。旧 `embodied-data-pipeline` 仓库已归档，不作为部署入口。如果排障需要新建分支，使用 `fix/windows-startup` 等名称，**不要使用 `codex` 前缀**。

本次交付的是本机浏览器工作台：目录导入、来源/标签登记、结构质检、自有 JSONL 导出、作业日志与取消。真实遥操作、官方 LeRobot 转换、训练、仿真和部署后端尚未接入，不能用“网页能打开”表示这些能力已经验收。

基础服务只需要 Python 3.11+，没有第三方运行依赖。优先使用已经通过原生 CI 的 Python 3.11 或 3.14。**不要为启动工作台安装 `requirements.txt`、`requirements-lock.txt` 或 `.[experiments]`**，它们属于原有实验环境。也不需要 Node、CUDA、管理员权限或修改防火墙。

最终至少交付：实际 URL、源码 commit/安装包版本、解释器路径、工作区路径、进程或会话标识、日志位置和验证结果。

## 2. 执行约定与环境检查

以下命令使用 PowerShell 语法，不是 CMD/Bash。片段之间的变量默认属于**同一个 PowerShell 会话**；若 Agent 每次调用都启动新 shell，必须重新设置参数，不能假设变量还存在。

先记录环境与已有工具：

```powershell
$PSVersionTable.PSVersion
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture
Get-Command py, python, git -ErrorAction SilentlyContinue | Select-Object Name, Source
```

选择现有 Python；以下示例使用已安装的 3.11。若实际使用 3.14，把选择参数改为 `-3.14`。没有 `py` 时，用实际 `python.exe` 完整路径赋给 `$bootstrapPython`，不要猜测解释器位置。如果只有旧版本，先按 [Python 官方 Windows 安装说明](https://docs.python.org/3.14/using/windows.html)准备合适的运行时，再继续。

```powershell
$ErrorActionPreference = 'Stop'
function Assert-NativeSuccess {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) { throw "$Step failed, exit=$LASTEXITCODE" }
}

$bootstrapPython = (py -3.11 -c "import sys; print(sys.executable)")
Assert-NativeSuccess 'Locate Python'
$bootstrapPython = $bootstrapPython.Trim()
& $bootstrapPython -c "import sys; print(sys.version); assert sys.version_info >= (3, 11)"
Assert-NativeSuccess 'Check Python version'

# 默认使用当前用户可写目录；可改成已确认可写的短路径。
$baseDir = Join-Path $env:USERPROFILE 'robot-data'
$repoRoot = Join-Path $baseDir 'source'
$venvRoot = Join-Path $baseDir 'venv-workbench'
$workspaceRoot = Join-Path $baseDir 'workspace-main'
$logRoot = Join-Path $baseDir 'run-logs'
$port = 8765
$baseUrl = "http://127.0.0.1:$port"
New-Item -ItemType Directory -Path $baseDir, $logRoot -Force | Out-Null
```

注意：`$ErrorActionPreference` 不能代替外部程序的退出码检查，因此 Git、Python 和 pip 后面都有 `Assert-NativeSuccess`。不要使用 `$Host`、`$PID`、`$HOME` 等已有系统变量保存本任务状态。

代码、虚拟环境、用户工作区分别存放，避免更新源码时碰到数据。路径可以有中文与空格，传参用变量/参数数组；不要把引号写进目录名，也不要使用 `.venv/bin/python`、`source`、`export` 或 Bash 的续行方式。

执行安装构建或批量检查前，先按第6节检查本机资源；不要等到命令结束后才补记负载。

## 3. 获取源码、创建独立环境并安装

首次部署执行：

```powershell
if (Test-Path -LiteralPath $repoRoot) {
    throw 'Source directory exists. Inspect its remote and working tree before reuse.'
}
git clone --branch main https://github.com/fengjikui/robot-data-pipeline.git $repoRoot
Assert-NativeSuccess 'Clone repository'
git -C $repoRoot rev-parse HEAD
Assert-NativeSuccess 'Record source commit'

if (-not (Test-Path -LiteralPath $venvRoot)) {
    & $bootstrapPython -m venv $venvRoot
    Assert-NativeSuccess 'Create virtual environment'
}
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Virtual environment is incomplete.' }
& $pythonExe -m pip install --no-deps $repoRoot
Assert-NativeSuccess 'Install workbench'

# 在源码目录之外检查，避免恰好从当前目录导入代码而掩盖安装失败。
Push-Location $baseDir
try {
    & $pythonExe -I -m robot_pipeline.workbench --help
    Assert-NativeSuccess 'Check installed CLI'
    & $pythonExe -I -c "import sys, robot_pipeline.workbench as w; print(sys.executable); print(w.__file__)"
    Assert-NativeSuccess 'Record installed module'
} finally { Pop-Location }
```

已有正确工作副本时，先执行 `git -C $repoRoot remote -v`、`git -C $repoRoot status --short` 和 `git -C $repoRoot branch --show-current`。工作区干净、分支和远端正确时才 `git -C $repoRoot pull --ff-only`，随后重装。不要用 `reset --hard`、`clean -fd` 或删除目录覆盖别人的改动。

不需要执行 `Activate.ps1`，也不需要更改 PowerShell 执行策略。从源码安装可能需要联网获取构建依赖 setuptools；“无第三方运行依赖”不表示源码构建一定离线成功。

如果暂时无法安装包，可用现有 Python 直接启动源码入口：

```powershell
& $pythonExe (Join-Path $repoRoot 'scripts\start_workbench.py') --workspace $workspaceRoot --port $port
```

此入口会占用当前终端。只有安装成功后，才能在其他目录使用 `-m robot_pipeline.workbench`；不要在未安装时照搬下面的后台模块启动方式。

### 固定版本 wheel / 离线安装（替代源码安装）

从 [v0.1.0 发布页](https://github.com/fengjikui/robot-data-pipeline/releases/tag/v0.1.0)获取 `robot_data_pipeline-0.1.0-py3-none-any.whl`，拷贝到目标机。目标机仍需 Python 3.11+ 和独立虚拟环境。该模式不要求克隆源码；保留上一节相同的 `$baseDir`、`$pythonExe`、`$workspaceRoot` 等参数。

```powershell
if (-not (Test-Path -LiteralPath $venvRoot)) {
    & $bootstrapPython -m venv $venvRoot
    Assert-NativeSuccess 'Create wheel environment'
}
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'
# 改成目标机上实际的 wheel 文件路径。
$wheelPath = Join-Path $baseDir 'robot_data_pipeline-0.1.0-py3-none-any.whl'
$expectedSha256 = 'da3b4ad26167533f94473e9d6b2eaf64e7c8051e92bd7f6c115cf1c3939cee60'
$actualSha256 = (Get-FileHash -LiteralPath $wheelPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) { throw 'Wheel SHA256 does not match v0.1.0.' }
& $pythonExe -m pip install --no-index --no-deps --force-reinstall $wheelPath
Assert-NativeSuccess 'Install pinned wheel'
& $pythonExe -I -m robot_pipeline.workbench --help
Assert-NativeSuccess 'Check wheel CLI'
```

哈希只对应上面的固定版本，依据[安装包验收清单](../../evidence/implementation/native_platform_acceptance.json)。不要把此值套到后续版本。

## 4. 先检查端口，再选择一种启动方式

```powershell
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
    $listeners | Select-Object LocalAddress, LocalPort, OwningProcess
    throw 'Port is occupied. Identify the existing service or select another port.'
}
```

端口被占用时先辨认服务；如果已经是目标工作台，检查其版本与工作区后复用。否则换成 `8766` 等空闲端口并同步修改 `$baseUrl`，不要按端口随意杀进程。不同实例必须使用不同工作区；只换端口不能绕过同一工作区的实例锁。

### 方式 A：前台启动，优先用于首次排障

```powershell
& $pythonExe -I -m robot_pipeline.workbench --workspace $workspaceRoot --port $port
```

看到 URL 后进程会一直运行，这是正常的服务行为。Agent 应使用执行工具的持久会话能力，或选择下面的后台方式；不要把“命令尚未退出”当成失败。当前只监听 `127.0.0.1`，浏览器也应在这台 Windows 上打开。

在另一个终端执行第5节检查。前台服务使用当前会话的 Ctrl+C 优雅退出，会清理本工作台直接持有的 worker。

### 方式 B：Agent 后台运行，保存 PID 和日志

前台与后台只能二选一，不能对同一工作区重复启动。以下参数使用第2节生成的不带尾随反斜杠的目录路径；手工更改时保持此形式。

```powershell
$runName = 'server-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$sessionLogDir = Join-Path $logRoot $runName
New-Item -ItemType Directory -Path $sessionLogDir | Out-Null

# Start-Process 会把 ArgumentList 拼成命令行；路径含空格时保留内层双引号。
$serverArguments = @(
    '-I', '-m', 'robot_pipeline.workbench',
    '--workspace', ('"{0}"' -f $workspaceRoot),
    '--port', "$port"
)
$startOptions = @{
    FilePath = $pythonExe
    ArgumentList = $serverArguments
    WorkingDirectory = $baseDir
    RedirectStandardOutput = (Join-Path $sessionLogDir 'stdout.log')
    RedirectStandardError = (Join-Path $sessionLogDir 'stderr.log')
    PassThru = $true
}
$serverProcess = Start-Process @startOptions
Set-Content -LiteralPath (Join-Path $sessionLogDir 'server.pid') -Value $serverProcess.Id -Encoding ascii
$serverProcess.Id
$sessionLogDir
```

按 [Microsoft 的 Start-Process 参数说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process)，参数数组不等于自动处理每个带空格参数的引号。这里的内层引号仅用于 `Start-Process`；前台 `& $pythonExe ... --workspace $workspaceRoot` 不需要这层手工引号。

Windows 通常允许 `Start-Process` 创建独立进程；Agent 的执行宿主仍可能有额外的进程回收规则。必须在启动调用结束后，另一次调用中验证 PID 和 HTTP 服务依然存在，不能只凭返回 PID 宣布完成。

## 5. 启动验收

新终端或新的 Agent shell 必须先重设实际地址：

```powershell
$baseUrl = 'http://127.0.0.1:8765'  # 若更换端口，这里也要更改。
$ready = $false
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    try {
        $health = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 2
        if ($health.status -eq 'ok') { $ready = $true; break }
    } catch { }
    Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw 'Health check failed. Inspect stdout/stderr and process state.' }
$health

foreach ($item in @(
    @{ Path = '/'; Type = 'text/html' },
    @{ Path = '/app.js'; Type = 'text/javascript' },
    @{ Path = '/styles.css'; Type = 'text/css' }
)) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl + $item.Path) -TimeoutSec 5
    if ($response.StatusCode -ne 200 -or $response.Headers['Content-Type'] -notlike ($item.Type + '*')) {
        throw ('Unexpected static response: ' + $item.Path)
    }
}
Start-Process $baseUrl
```

预期健康响应为 `status=ok`，当前版本 `version=0.1.0`。还要实际打开 Edge/Chrome 检查页面能显示、无脚本加载错误；API 能响应不能代替界面验收。首次新建工作区应为空，复用工作区则保留原数据，不能清空它来制造“空状态”。

如果需要主动验证“合成样例 → 质检 → 导出”，请使用独立临时工作区，或运行下一节现成测试。不要往用户正式工作区自动塞入样例。API 写请求需要从 `/api/state` 获取当前会话的 `csrf_token`，放在 `X-Workbench-Token` 请求头中；PowerShell 发送中文 JSON 时使用 UTF-8 字节。不要通过关闭 Host/Origin/token 检查解决403。

## 6. 完整环境验收（需要源码时）

只验证基础工作台时执行下面的模式，避免把旧数值实验依赖混进来：

```powershell
& $pythonExe -m unittest discover -s (Join-Path $repoRoot 'tests') -p 'test_workbench*.py' -v
Assert-NativeSuccess 'Workbench tests'

& $pythonExe -m pip wheel $repoRoot --no-deps --wheel-dir (Join-Path $repoRoot 'dist')
Assert-NativeSuccess 'Build wheel'
& $pythonExe (Join-Path $repoRoot 'scripts\test_installed_workbench.py')
Assert-NativeSuccess 'Installed wheel smoke'
```

安装烟测会创建并清理独立临时环境，从源码仓库外安装 wheel，验证界面资源、显式合成样例、真实 worker、质检、导出与产物获取。它要求仓库 `dist` 中恰好有一个 `robot_data_pipeline-*.whl`。若存在多个历史版本，先列出并选择干净的构建副本，不要盲删用户已有产物。

既有 v0.1.0 的 [Windows 原生 CI](https://github.com/fengjikui/robot-data-pipeline/actions/runs/40250416133)在 Python 3.11、3.14 上均通过：每组37项、2项条件跳过，另有安装烟测。跳过的是 POSIX 专用路径语法测试和无法构造的大小写双文件；不能把历史 CI 说成本次目标机已完成测试。交接时写实际执行的测试、数量、跳过原因与日志。

批量检查、构建、训练或渲染前与运行期间，按用户要求检查负载、可用内存和能取得的热状态。例如用 CIM 读取与界面语言无关的属性：

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory, TotalVisibleMemorySize
Get-CimInstance Win32_Processor | Select-Object Name, LoadPercentage
```

内存属性单位为 KiB。Windows 没有保证可用的通用 CPU 温度接口，若现有工具没有可靠读数，记录“温度/热状态不可取得”，不编造数值。采用保守并行度；影响用户其他工作时降负载、分段或暂停本任务。工作台自有 worker 默认串行，数值线程设为1。

## 7. 停止、重启与更新

前台实例优先 Ctrl+C。后台实例先读取本次记录的 PID，核对 `ExecutablePath`、`CommandLine` 中的模块、工作区和端口，防止 PID 已被系统复用：

```powershell
# $sessionLogDir 必须是本次启动时记录的日志目录。
$ownedProcessId = [int](Get-Content -LiteralPath (Join-Path $sessionLogDir 'server.pid'))
Get-CimInstance Win32_Process -Filter "ProcessId = $ownedProcessId" |
    Select-Object ProcessId, ExecutablePath, CommandLine
```

**`Stop-Process` 不等于优雅退出。** 后台模式若还有 `queued/running/cancelling` 作业，先通过界面或 `/api/jobs/<id>/cancel` 请求停止，轮询确认 worker 完成回收。只在确认属于本任务、且无活动作业时，才对该 PID 执行 `Stop-Process -Id $ownedProcessId`。不要 `taskkill /IM python.exe`、`Stop-Process -Name python`，也不要靠删除 `workbench.lock` 绕过实例锁。

更新前停止服务，备份**整个工作区**；源码工作区干净时拉取并重新安装，之后使用同一个绝对工作区路径启动。当前没有跨版本数据库迁移工具，后续版本需先看变更说明。更新不会要求删除原始数据或数据库。

## 8. Windows 常见故障

| 现象 | Agent 应检查与处理 |
| --- | --- |
| `py`/`python` 找不到，或跳到商店 | 检查安装和实际解释器路径；使用完整 `python.exe` 路径，不以文件别名存在当作运行时可用 |
| `No module named robot_pipeline` | 确认安装与启动使用同一个 `$pythonExe`；安装完成前用源码 wrapper；不要靠切换到源码目录掩盖问题 |
| PowerShell 阻止 `Activate.ps1` | 直接调用 `Scripts\python.exe`，不需要激活或放宽执行策略 |
| 中文帮助/日志出现编码错误 | 使用当前版本入口；它在 argparse 前配置 UTF-8。保留 `-I` 验证，不以删除隔离条件或仅设置环境变量代替修复 |
| PowerShell 5.1 中文脚本内容被误读 | 含非 ASCII 的 `.ps1` 保存为 UTF-8 BOM；PowerShell 7 可用 UTF-8。用 `Get-Content -Encoding UTF8` 读取应用 UTF-8 日志 |
| 后台启动参数含空格后失效 | 对照第4节的内层引号，核对进程 `CommandLine`；不要把 Bash/PowerShell 引号层级混用 |
| 窗口一闪而过/进程退出 | 读取本次 `stdout.log` 和 `stderr.log`；检查解释器、安装、端口、路径和工作区实例锁 |
| 网页空白，但 `/api/health` 正常 | 查看 JS/CSS 状态和 Content-Type、浏览器控制台，确认实际运行当前安装；不要关闭 `nosniff` 规避类型错误 |
| 403 或“令牌失效” | 使用实际 `127.0.0.1:端口` 地址，重启后刷新；检查同源与当前 token，不修改校验规则 |
| 别的电脑打不开此 URL | 当前只服务本机，不是局域网部署。不要擅自改成 `0.0.0.0` 或开放防火墙 |
| 目录导入失败 | 路径指服务机器的本机目录；缩短路径，检查大小写冲突、保留名、链接/junction与128 MiB/10000文件限制 |
| 导出被拒绝或作业中断 | 看限定范围的质检与日志；不要修改清单绕过保护，也不要把旧运行状态手改为成功 |

PowerShell 5.1 的编码规则依据 [Microsoft 官方说明](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding)；Python `-I` 会忽略 `PYTHON*` 环境变量，依据 [Python 命令行文档](https://docs.python.org/3.14/using/cmdline.html#cmdoption-I)。

## 9. Agent 交接格式

```text
源码：仓库、分支、commit，或固定 release 与 wheel SHA256
系统：Windows版本/架构、PowerShell版本、Python版本和解释器路径
URL：http://127.0.0.1:<实际端口>
运行方式：前台持久会话标识，或后台PID与核对后的命令行
工作区：绝对路径；新建/复用；未自动加入正式样例
日志：本次stdout/stderr位置，及作业日志位置
验证：健康、HTML/JS/CSS、实际浏览器、已执行的隔离测试及结果
进程：服务是否保留运行；临时测试进程是否清理；停止方式
未完成：真机/官方转换/训练/仿真/部署接入，不记作已验收
```

用户使用说明见[安装、启动与日常使用](03_安装启动与日常使用.md)，实现边界见[首版实现与后续适配](02_首版实现与后续适配.md)，已有证据见[首版验收记录](04_首版验收记录.md)。
