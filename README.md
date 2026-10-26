# 具身智能数据管线工作台

面向单人、单机器人，把数据来源、检查结果、转换计划与运行记录组织到同一个界面。首期以 G1 为研究对象，保留按本体和训练配方逐项接入的边界。

**当前版本 v0.1.2：已实现本机浏览器工作台。** 数据目录通过系统原生窗口选择，也可粘贴路径；可以登记数据目录、复制原始快照、填写来源与标签，执行结构质检、导出本项目 JSONL，或串联“检查 → 导出”；保存项目配置、日志、输入哈希与产物，支持取消和中断恢复。首次启动为空，合成样例由使用者主动载入。

真机遥操作、官方 LeRobot 转换、ACT/Diffusion/openpi/OpenVLA 训练、仿真与部署尚未接入工作台。自有 JSONL 不是 LeRobot，也不能据此声称可以直接训练或部署机器人。现有离线实验 CLI 单独保留。

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

1. 保存任务、目标本体和策略设置。
2. 点击“选择文件夹…”打开**服务所在电脑**的系统目录窗口，或粘贴绝对路径；也可主动载入“合成流程样例”。Linux 需要桌面与 Zenity/KDialog，无图形桌面时直接粘贴路径。
3. 查看资产档案，点击质检；通过后点击导出，也可一次串联两步。
4. 在运行记录中查看实际日志、错误和下载产物。

本版导入上限为 128 MiB、10000 个文件，单个 JSON 不超过 20 MiB。采用复制模式，源目录保持原样；暂不提供互联网下载和大规模数据流式导入。结构检查支持 Unitree 风格的 28 维双臂双手记录，检查数值、索引与图像路径存在性；不解码图像，不证明同步、标定或任务成功。

## 报告与设计

- [具身智能数据管线报告 v12，PPT 与 Windows 完整演示包](https://github.com/fengjikui/robot-data-pipeline/releases/tag/report-v12)：目录、23 页正文、启动步骤备查，以及逐页讲稿、官方来源与离线原始资料。完整解压演示包后保持相对目录。
- [v0.1.2 安装包](https://github.com/fengjikui/robot-data-pipeline/releases/tag/v0.1.2)
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

工作台基础服务与自有 worker 面向 Windows、macOS、Linux，使用当前解释器、参数数组、显式 UTF-8、受管理相对路径和单 worker。CI 在三种原生 runner 上分别用 Python 3.11、3.14 构建 wheel、在仓库外安装运行，并执行平台与 API 测试。v0.1.2 的[六组原生检查全部通过](https://github.com/fengjikui/robot-data-pipeline/actions/runs/40259009291)，每组49项测试；版本验收记录对应源码 commit、跳过项与 wheel 哈希。原生选择器的组件/API 测试不等于各系统 GUI 自动点选，具体范围见[路径选择说明](docs/implementation/07_路径选择与三平台说明.md)。

机器人 Host、PC2、XR 服务和 GPU 训练机可以是不同计算设备。工作台在 Windows 运行，不代表这些厂商工具也支持 Windows。旧 MuJoCo 渲染与报告制作脚本仍有本机资源/字体依赖，未列入基础工作台跨平台承诺。

本机工具只监听 `127.0.0.1`，写请求验证会话 token 与来源，不提供任意 shell 命令接口。它是单用户本地程序；多人/公网部署需要另行设计认证与执行隔离。退出服务会停止本工作台持有的直接 worker，不影响其他 Python 进程。

## 测试

```bash
python -m unittest discover -s tests -p "test_workbench*.py" -v
python -m pip wheel . --no-deps --wheel-dir dist
python scripts/test_installed_workbench.py
```

最后一条在干净虚拟环境中安装 wheel，从源码仓库之外检查静态资源、API、真实 worker、质检与导出；测试使用独立临时工作区。

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
