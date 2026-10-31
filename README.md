# 具身智能数据管线工作台

面向单人、单机器人，把数据来源、检查结果、转换计划与运行记录组织到同一个界面。首期以 G1 为研究对象，保留按本体和训练配方逐项接入的边界。

**当前源码版本 v0.4.1：采集接线与任务流程简化。** 日常界面按“采集或导入 → 整理训练数据 → 训练 → 仿真验证”组织。设备设置、来源比例、划分和历史选择按需展开，主流程只保留当前下一步与必要判断。补丁版修复数据整理后 Windows 数据库文件占用的问题。

本地/SSH 采集执行器已接线：支持真机和仿真独立配置，启动受控服务、启用随动、开始/停止录制，在记录器确认保存后自动接收、入库并排队质检。没有设备时，可主动选择**合成采集试运行**，真实体验软件链路；合成数据保留标记。Unitree 固定版本接线与软件测试不等于真机、XR 或 GPU 仿真已实测通过，当前工作站仍待配置。

已有数据可预览图像和 state/action、标记结果、手动切段、组合来源，确认后自动保存选择并整理成含媒体与独立读取器的项目数据包。项目包不是官方 LeRobot，官方格式转换、增强执行、策略训练、闭环仿真和部署仍待接入。

先读[用户与工作台职责](docs/product/15_从采集到仿真_用户与工作台职责.md)，了解完整闭环中哪些自动完成、哪些需要判断。部署者查看[双采集接入与使用](docs/implementation/13_双采集接入方案与使用.md)。

## 启动工作台

Windows 上执行部署的 Agent 请先读[Windows Agent 部署与启动指南](docs/implementation/05_Windows_Agent部署与启动指南.md)，其中包含独立环境、后台日志、健康检查和交接步骤。

需要 Python 3.11 或更新版本，基础运行只使用标准库。浏览器打开启动后显示的本机地址，默认 `http://127.0.0.1:8765`。

从源码直接启动：

```bash
# macOS / Linux
python3 scripts/start_workbench.py --workspace ".workspace/main" --port 8765
```

```powershell
# Windows PowerShell，无需运行 Activate.ps1
py -3 scripts/start_workbench.py --workspace ".workspace/main" --port 8765
```

也可安装为独立命令：

```bash
python -m pip install .
robot-data-workbench --workspace "你的数据工作区目录" --port 8765
```

`python` 应是你选择的 Python 3.11+ 解释器。虚拟环境中可直接调用 `bin/python`（macOS/Linux）或 `Scripts\python.exe`（Windows），无需依赖 shell 激活脚本。离开源码目录后，已安装的命令仍可运行。

1. 选择已有任务，点击“开始采集”。已部署设备使用“准备采集”；暂无设备可点“没有设备？用合成数据试运行”。
2. 服务就绪后启用随动，再开始录制。点击“停止并保存回合”后，接收、入库和检查自动执行，可继续下一回合。
3. 快速标记回合成功、失败、中断或待判断。结束采集后回到当前任务，点击“整理数据”。
4. 采用推荐的当前任务成功回合，或手动选择、保留片段。点击“核对这些数据”时工作台自动保存并生成默认划分；只有需要实验调整时才展开设置。
5. 确认使用这些数据，工作台自动保留输入版本并整理文件。在运行记录查看结果，必要时下载 `dataset.zip`。

真实采集适配器在 Linux Host 运行，Mac/Windows/Linux 工作台通过本地或 SSH 接入；底层 SDK、XR 和实际控制模式须按设备联调。自动接收单回合上限为 4 GiB / 100000 文件、单个 JSON 20 MiB。普通本机目录手工导入仍为 128 MiB / 10000 文件、单个 JSON 20 MiB。新工作区默认无数据，不自动启动采集或训练。

详见[回合级准备说明](docs/implementation/11_回合级数据准备与用户验收.md)。该旧版说明保留底层步骤用于备查，当前日常界面已经自动收拢这些操作。

## 后续完整方案与交互设计

- [本轮重点：G1搬箱的三个问题、整体方案与S1–S3路线](docs/report/15_后半部方案与搬箱验证.md)：第一阶段同时覆盖遥操作和有限开源数据入口，形成特定任务完整闭环。
- [真实外部数据案例与Arena搬箱复现步骤](docs/report/parts/box_dataset_case_v15.md)：已取得单回合原始样本；GPU训练和仿真未执行。
- [现状问题、平台价值、理想方案与四阶段实现](docs/product/10_整体方案与产品价值_2026-10-26.md)
- [用户旅程、页面、按钮、状态和异常恢复](docs/product/11_交互逻辑与界面设计说明.md)
- [会后 PRD 共识与本轮实现范围](docs/product/14_PRD共创稿_2026-10-30.md)
- [开发工作包、依赖与验收映射](docs/product/12_开发工作包与验收映射.md)
- [独立交互原型](docs/design/workbench_prototype/index.html)：下载源码后可直接打开，全部为示例，不调用硬件或训练器。

## 报告与设计

- [最新 PPT：具身智能数据管线报告 v18（前半部分，5张）](https://github.com/fengjikui/robot-data-pipeline/releases/tag/report-v18)：重新整合技术背景，采集页包含拓扑 / 数据流切换动画。下载 Windows 离线演示 ZIP 并完整解压，可一并获得 PPT、讲稿、预览、原始数据和配套资料；核心方案部分尚未合并进这份新版，旧完整版 v15 继续保留。动画已在 Mac WPS 实播，Windows 仍需目标机试播。
- [具身智能数据管线报告 v15，PPT 与 Windows 完整演示包](https://github.com/fengjikui/robot-data-pipeline/releases/tag/report-v15)：共26张（目录、23页正文、2页备查），保留前19张，第20张起从10页收束为7页。用真实数据案例讲筛选与采购，重点说明问题、七步整体方案、首期G1搬箱、三阶段路线及企业数据仓库。附公开G1搬箱单回合视频与字段，完整解压后保持相对目录。
- [转换、增强与训练工具命令备查](docs/report/14_工具命令与参数备查.md)
- [工作台 v0.4.1 安装包与源码](https://github.com/fengjikui/robot-data-pipeline/releases/tag/v0.4.1)
- [下载最新 main 分支代码 ZIP](https://github.com/fengjikui/robot-data-pipeline/archive/refs/heads/main.zip)：代码 ZIP 不含大型 PPT 成品，请从上方报告 Release 下载演示包。
- [路径选择与三平台说明](docs/implementation/07_路径选择与三平台说明.md)
- [真机采集接入现状与实施顺序](docs/implementation/08_真机采集接入现状与实施顺序.md)
- [首版验收记录](docs/implementation/04_首版验收记录.md)
- [用户视角实测：当前能做什么、怎么使用、还缺什么](docs/implementation/06_用户视角实测与使用路径.md)
- [跨平台架构与验收设计](docs/implementation/01_跨平台架构与验收设计.md)
- [首版实现与后续适配](docs/implementation/02_首版实现与后续适配.md)
- [安装、启动与日常使用](docs/implementation/03_安装启动与日常使用.md)
- [当前产品定位](docs/product/00_先读产品定位与结论.md)
- [产品需求与分期验收](docs/product/01_产品需求说明.md)
- [采集、转换、训练与不同策略的配置边界](docs/report/12_采集转换训练配置与策略适配.md)
- [GitHub Actions 跨平台验收](https://github.com/fengjikui/robot-data-pipeline/actions/workflows/platform-tests.yml)

旧 `embodied-data-pipeline` 仓库已归档并指向这里；旧仓库的完整 Git bundle 已随 `report-v12` 发布保存。当前凭据缺少 GitHub `delete_repo` 权限，因此未删除旧仓库。源码、当前需求与新实现以本仓库为准。

## 运行范围与跨平台检查

工作台基础服务与自有 worker 面向 Windows、macOS、Linux，使用当前解释器、参数数组、显式 UTF-8、受管理相对路径和单 worker。CI 在三种原生 runner 上分别用 Python 3.11、3.14 构建 wheel、在仓库外安装运行，并执行平台与 API 测试。v0.1.2 的[六组原生检查全部通过](https://github.com/fengjikui/robot-data-pipeline/actions/runs/40259009291)，每组49项测试；版本验收记录对应源码 commit、跳过项与 wheel 哈希。v0.2.0 的[六组原生检查也已全部通过](https://github.com/fengjikui/robot-data-pipeline/actions/runs/40422998086)，对应工作台源码提交 `4b7d910`。原生选择器的组件/API 测试不等于各系统 GUI 自动点选，具体范围见[路径选择说明](docs/implementation/07_路径选择与三平台说明.md)。

机器人 Host、PC2、XR 服务和 GPU 训练机可以是不同计算设备。工作台在 Windows 运行，不代表这些厂商工具也支持 Windows。旧 MuJoCo 渲染与报告制作脚本仍有本机资源/字体依赖，未列入基础工作台跨平台承诺。

本机工具只监听 `127.0.0.1`，写请求验证会话 token 与来源，不提供任意 shell 命令接口。它是单用户本地程序；多人/公网部署需要另行设计认证与执行隔离。退出服务会停止本工作台持有的直接 worker，不影响其他 Python 进程。

## 测试

```bash
python -m unittest discover -s tests -p "test_workbench*.py" -v
python -m unittest discover -s tests -p "test_preparation*.py" -v
python -m unittest discover -s tests -p "test_capture.py" -v
python -m pip wheel . --no-deps --wheel-dir dist
python scripts/test_installed_workbench.py
```

最后一条在干净虚拟环境中安装 wheel，从源码仓库之外检查静态资源、API、真实 worker、质检与导出，以及回合预览、确认冻结和含媒体的准备包；测试使用独立临时工作区。

旧数值/训练/渲染实验需要额外依赖，可在独立环境安装 `.[experiments]`，运行 `python -m robot_pipeline --help`。`requirements-lock.txt` 是原本机实验快照，不能作为三系统依赖锁使用。16 个公开回合的 state-only BC 实验测试误差弱于保持当前状态基线，闭环含明显超限截断，不能部署，更未完成全身搬箱。详见[仿真与算力计划](docs/04_仿真演示与算力计划.md)。

## 目录

```text
robot_pipeline/workbench/  基础工作台、资产、作业与浏览器界面
robot_pipeline/            原有数值/训练/渲染实验 CLI
scripts/                   启动、测试、下载与报告制作工具
examples/raw/schema_fixture/ 明确标注的合成格式样例
tests/                     数据、API、进程与跨平台验证
docs/implementation/       实现设计、使用方法与验收
docs/product/              产品需求、厂商调研与数据资产设计
docs/report/               报告内容、讲稿与来源
evidence/                  固定上游源码、元信息与来源快照
assets/                    报告素材及上游许可
```

原始大数据、模型权重、虚拟环境、实验 vendor 和生成产物不进入 Git。报告生成文件从 Releases 获取；上游资料的许可证与固定 revision 保留在各自目录和来源清单。
