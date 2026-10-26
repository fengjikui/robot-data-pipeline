# 具身智能数据管线工作台

目标是建设带界面的数据管线工作台：组织多设备服务与遥操作采集，并按阶段完成数据检查、可选增强、转换、训练、仿真评价和部署；公开或购买数据通过独立来源入口进入共同下游。首先接通单人、单台宇树 G1，阶段按钮为主，可选择自动串联，再逐步接入其他来源和本体。

当前已完成产品需求与三家厂商适配调研，另有前一轮 CLI 技术验证；**图形工作台尚未实现，真机链路尚未验收**。已知设备为 43 DoF，暂按 G1 29 本体与 Dex3 双手研究，准确配置待到货核实。

## 最新数据管线报告

- [Windows 完整演示包（PPT、讲稿、离线原始资料）](artifacts/report/robot_data_pipeline_report_windows_v12.zip)
- [整套可编辑 PPT：23 页正文、1 页目录与 1 页备查](artifacts/report/具身智能数据管线报告_v12.pptx)
- [原始回合数据查看与字段对应（官方测试包）](docs/report/09_回合真实数据查看与字段对应.md)
- [真机采集程序与启动顺序（备查，含命令模板）](docs/report/08_真机采集程序与启动顺序_备查.md)
- [逐页预览、精讲稿、扩展说明与原始出处](docs/report/07_全稿逐页阅读与演讲稿.md)
- [第 2 页单页：扩大页脚留白并更新配色](artifacts/report/02_真机采集的设备分工_页脚与配色版_v2.pptx)

全稿采用红色标题、白/灰/石墨黑与少量蓝色强调。底部约 80 px 保留公司区域，按需附权威外部出处，无参考页不显示来源行；精讲稿约 4500 字符，可按约 20 分钟演练。报告中的工作台、跨本体扩展和完整搬箱链路仍属于规划，现有局部实验的失败结果与限制已保留。

## 本轮产品主文档

- [先读：产品定位与结论](docs/product/00_先读产品定位与结论.md)
- [产品需求与分期验收](docs/product/01_产品需求说明.md)
- [G1 一键采集与多设备服务编排](docs/product/02_G1一键采集与服务编排.md)
- [宇树、智元、银河通用与更换本体的适配调研](docs/product/03_三家厂商与更换本体适配调研.md)
- [自行采集、开源及购买数据的转换层次](docs/product/04_数据来源与转换层次.md)
- [页面、阶段按钮和异常恢复](docs/product/05_页面按钮与异常流程.md)
- [调研来源与版本证据](docs/product/06_调研来源与证据.md)
- [外部数据资产库：导入、分类、任务选数与复用](docs/product/07_外部数据资产库与使用流程.md)
- [跨本体遥操作与采集接口初步调研](docs/product/08_跨本体遥操作与采集接口初步调研.md)
- [任务驱动的数据选型与采购验收](docs/product/09_任务驱动的数据选型与采购验收.md)

本轮按用户要求先梳理、不新增功能实现。Markdown 是当前产品需求主文档；旧 Word 保留为上一轮技术参考，尚未同步本轮产品定位和适配调研。

## G1 技术原理与已有实验

- [组会报告全稿逐页总纲（先看此页）](docs/report/00_全稿逐页总纲.md)
- [组会报告前半部分逐页大纲（16 页正文）](docs/report/01_前半部分逐页大纲.md)
- [组会报告后半部分逐页大纲（7 页）](docs/report/02_后半部分逐页大纲.md)
- [报告制作要求与模型适配备查](docs/report/03_制作要求与模型适配备查.md)
- [数据采购两页内容与演讲稿](docs/report/04_数据采购两页内容稿.md)
- [第 1 页内容、预览与演讲稿](docs/report/05_第01页内容与讲稿.md)
- [第 1 页可编辑 PPT 时间轴版](artifacts/report/01_搬箱任务与数据管线全貌_v4.pptx)
- [第 2 页设备分工、预览与含出处的演讲稿](docs/report/06_第02页内容与讲稿.md)
- [第 2 页可编辑 PPT 版式基准（最新页脚与配色）](artifacts/report/02_真机采集的设备分工_页脚与配色版_v2.pptx)
- [上一轮独立阅读与上手手册](artifacts/G1_EDU具身智能数据管线原理与上手手册.docx)
- [报告讲稿与问答](docs/05_报告讲稿与问答.md)
- [设备与数据流图](artifacts/figures/01_devices_and_dataflow.png)
- [本轮训练与视频的解释](docs/04_仿真演示与算力计划.md)
- [来源与事实核查](docs/06_来源索引与事实核查.md)

为 2026 年 10 月 26 日技术原理报告准备的技术材料按 `docs/00` 至 `docs/06` 排列。四条数据流、state 与 action、28 与 43 的区别、质量审查、转换参数、ACT/Diffusion 的配置差异、真机操作步骤和云端仿真计划均已整理。文中事实对应官方源码和数据快照，推断与未验证条件单独标注。

## 前一轮已完成的技术验证

从公开 Unitree G1 + Dex3 数值数据中取 16 个完整回合，完成按回合隔离的训练/验证/测试，训练 state-only 行为克隆模型，并在 43 关节 G1 模型上生成离线预测和固定骨盆闭环视频。自动测试 10 项通过。

测试 RMSE 为 0.06642 rad，弱于保持当前 state 基线的 0.04745 rad。闭环 360 步里，56.3% 的目标分量越过模型范围并被截断，因此模型不可部署。这是管线、评价和失败分析演示，没有完成自主搬箱或行走。

## 视频

- [离线预测可视化](artifacts/g1_demo/g1_offline_predictions.mp4)：每帧使用测试记录的 state，执行运动学投影。
- [固定机身闭环仿真](artifacts/g1_demo/g1_fixed_pelvis_closed_loop.mp4)：模型读取仿真反馈，执行 MuJoCo 物理积分；无物体任务，含超限截断提示。

两段均为 12 秒、30 fps，编码单线程。视频的限制、模型和统计记录在 `artifacts/g1_demo/render_report.json`。

## 本地运行现有 CLI

```bash
uv venv .venv --python python3
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m robot_pipeline --help
.venv/bin/python -m robot_pipeline check-raw \
  examples/raw/schema_fixture/episode_0000/data.json
.venv/bin/python -m robot_pipeline inspect-info \
  evidence/datasets/G1_Dex3_ToastedBread_Dataset/meta__info.json
.venv/bin/python -m robot_pipeline plan-convert examples/raw \
  --repo-id report/g1-dex3-demo
```

`examples/raw/` 是显式标记的合成格式样例，不是机器人采集数据。本项目 `export-numeric` 导出自有 NPZ 契约，不应称为官方 LeRobot 转换；`plan-convert` 只展示固定官方转换器的执行方案。官方转换尚未在完整上游依赖环境执行，参数帮助通过源码签名抽取核查。

真实数据与模型下载、训练和视频复现命令见 [仿真实验说明](docs/04_仿真演示与算力计划.md)。程序拒绝覆盖已有的训练和导出目录；重复实验使用新输出名。数据文件和网格不纳入未来 Git 管理，来源 revision 和 SHA256 已保存。

```bash
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 \
  .venv/bin/python -m unittest discover -s tests -v
```

## 文件结构

```text
robot_pipeline/      质检 数值适配 转换规划 训练 仿真渲染
scripts/             下载 证书模板 资源快照 文档与配图构建
examples/            合成原始数据格式样例
tests/               缺图 越界路径 NaN 划分隔离与模型重载验证
docs/product/        最新产品需求 页面流程 厂商与数据来源适配调研
docs/                G1 技术材料与操作步骤
evidence/            固定源码 元数据 下载哈希和参数帮助
assets/unitree_g1/   G1 MJCF 与必要网格 保留上游许可
artifacts/           独立手册 配图 视频 模型 指标与检查记录
```

真机到货后先按 [真机手册](docs/02_真机上手手册.md) 逐级验收。官方真机命令会发送动作，不能把开启可视化当成离线运行。本地原型没有接入宇树 SDK。

当前本机依赖锁定于 `requirements-lock.txt`；常规运行最小依赖在 `requirements.txt`。文档工具使用 Codex 自带的独立运行时，不属于机器人采集或部署依赖。源代码许可证和模型许可证保留在 `evidence/upstream/` 与 `assets/unitree_g1/LICENSE`。
