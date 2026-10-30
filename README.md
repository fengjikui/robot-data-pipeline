# 具身智能数据管线工作台

面向单人、单机器人，把数据来源、检查结果、转换计划与运行记录组织到同一个界面。首期以 G1 为研究对象，保留按本体和训练配方逐项接入的边界。

**当前源码版本 v0.3.0：回合级数据准备工作台。** 在“当前任务”中完成回合筛选、真实图像与 state/action 预览、任务结果标记、非破坏手动切段、多来源组合、自然/自定义采样与分组划分。保存并确认选择后，生成包含媒体、来源清单、划分、采样配置及独立读取器的便携准备包。草稿可恢复，确认版本保持不变，作业有日志、取消和重试入口。首次启动为空，合成样例由使用者主动载入。详见[使用与验收说明](docs/implementation/11_回合级数据准备与用户验收.md)及[本轮方案与边界](docs/implementation/12_回合级工作台方案与本轮实现边界.md)。

本轮为第一阶段的数据准备里程碑。真机遥操作、仿真采集、外部来源下载器、官方 LeRobot 转换、策略训练、闭环仿真和部署仍待适配器接入。项目读取验收不等于官方训练器验收；准备包始终明确标记不是 LeRobot。现有离线实验 CLI 单独保留。

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

1. 保存任务、目标本体和策略设置；选择策略暂不启动训练。
2. 导入回合目录。“选择文件夹…”打开**服务所在电脑**的系统窗口，也可粘贴绝对路径；Linux 需桌面与 Zenity/KDialog。可以主动生成合成样例，但单个样例组不足以划分多个非空集合，需添加更多数据或明确选择仅训练。
3. 在“当前任务”筛选、预览回合，选择整回合或手动片段；修改任务结果标记不改写原始文件。切换筛选和预览不会清空选择。
4. 配置组合、采样比例和训练/验证/测试划分。同一母回合及完整重复源保持在同一集合；组数不足或权重来源缺样本时显示具体问题。
5. 保存并确认清单，构建准备包。在运行记录中查看日志、下载 `dataset.zip`；已确认版本可派生新草稿，旧版本不被覆盖。
6. 解压准备包，在该目录执行 `python reader.py . --draws 32`，即可用标准库读取记录/媒体并验证采样；这不是 LeRobot 读取器。

本版导入上限为 128 MiB、10000 个文件，单个 JSON 不超过 20 MiB。采用复制模式，源目录保持原样；暂不提供互联网下载和大规模数据流式导入。结构检查支持 Unitree 风格的 28 维双臂双手记录，检查数值、索引与图像路径存在性；不解码图像，不证明同步、标定或任务成功。

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
- [工作台 v0.3.0 安装包与源码](https://github.com/fengjikui/robot-data-pipeline/releases/tag/v0.3.0)
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
