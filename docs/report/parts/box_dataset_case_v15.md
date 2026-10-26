# 搬箱任务：外部数据实例与可复现路线（v15）

核查日期：2026-10-26。调研使用官方文档、仓库元数据和固定说明文件；随后主任务另下载并读取了Arena单回合Parquet与18.3秒视频，核对915条记录、915帧和50Hz，保存原始哈希。本次未训练、未运行 Isaac Sim，未将公开示范或官方示例输出当成本项目模型实测结果。

## 可以放进报告的结论

首期外部数据路线选 **NVIDIA Arena G1 Loco-Manipulation** 最贴近目标：它同时公开搬箱示范、匹配仿真环境、转换和训练流程、已训练策略及闭环评估入口。先复现它的“货架取箱、移动、放入桌上蓝筐”，再改成我们的“桌A取箱、移动、桌B放箱”。这能把下载、筛选、导入、训练和验证串在一个具体任务中。

“箱子相关”“同为 G1”“已经是 LeRobot”都只能用于寻找候选。真实任务、手型、动作和匹配评估环境才决定能否用于这一轮实验。下面三个例子能直接说明区别。

## 三个真实案例

| 数据集 | 实际内容与格式 | 首期怎样使用 |
| --- | --- | --- |
| [NVIDIA Arena-G1-Loco-Manipulation-Task](https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/tree/07de42fdade76102fc09d921c7b6200d0b31ec01) | G1 仿真搬箱。固定版为 LeRobot v2.1，100回合、94,936帧、50Hz，头部RGB，43维关节记录及额外导航/高度命令；也提供 HDF5。 | 优先复现。已有匹配的 Arena 环境、GR00T N1.6 配置和策略，可进入闭环验证。先下载元信息和1回合，再取需要的完整子目录。 |
| [Unitree G1_WBT_Brainco_Plastic_Box_Parts](https://huggingface.co/datasets/unitreerobotics/G1_WBT_Brainco_Plastic_Box_Parts/tree/6a5fe2adb86604dc5fe821c7c3b9a44e169119f4) | 真机 G1 + BrainCo 手，LeRobot v3，400回合、30Hz、4相机、全身字段。任务表实际描述把塑料箱内零件移到货架。 | 名称含 box，但不是搬箱；手型也不同。可登记为相关候选，本轮不直接并入目标微调数据。没有在本次核查中找到与这套真机数据一一匹配的公开闭环仿真场景。 |
| [DROID](https://droid-dataset.github.io/droid/the-droid-dataset) | Franka Panda 单臂真机操作。RLDS/TFRecord 用于训练，也提供 HDF5 轨迹与 MP4/SVO 原始包。 | 通过任务指令/回合元信息筛出相关操作，用于泛化或预训练候选；不能只转换容器就得到 G1 双臂携箱和行走监督。官方提供100回合调试包，适合验证检索与读取能力。 |

许可分别登记：Arena 数据 CC-BY-4.0；Unitree 此数据卡 Apache-2.0；DROID 原作者论文声明数据 CC-BY-4.0。**Arena 现成模型卡另写 non-commercial use only**，不能把数据许可套用到模型。商业使用前应核对所选版本实际条款。

### Unitree 案例为何是一个有用的反例

它的 `meta/tasks.parquet` 中实际任务为 “Move parts from the plastic box to the shelf.”。固定版全库约54.5GB，BrainCo 手状态/命令为双手合计12通道，并非我们的双 Dex3 14通道。这个案例说明平台需要先索引说明和任务表，让使用者在下载整库之前排除任务、手型或评估条件不符的数据。不能只靠名字、标签或数组长度判断适配。

## Arena 固定版本与最小下载

- Arena 官方源码固定提交：`38b200cdb4b506ee8329e89480c6479cae5bc2dc`，为本次核查的 main；它是开发版本，实施前应选择并验证同一组 Arena/Isaac Lab/GR00T 依赖，不能混用原先 Unitree 的环境。
- 数据 revision `arena_v0.2_lab_v3.0` 实际解析到：`07de42fdade76102fc09d921c7b6200d0b31ec01`，公开、未设 gate。
- 模型 revision `gn1_6` 实际解析到：`dfe74af855007f26093f362cd2d7a2f404b64b93`，公开、未设 gate。
- 模型：[GN1x-Tuned-Arena-G1-Loco-Manipulation](https://huggingface.co/nvidia/GN1x-Tuned-Arena-G1-Loco-Manipulation/tree/dfe74af855007f26093f362cd2d7a2f404b64b93)。

建议第一步下载 `lerobot/meta/*`、`lerobot/data/chunk-000/episode_000000.parquet`、`lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4`。数据文件约630KB，视频约2.25MB。查看真实任务、动作切分和第一回合后再取训练集。

```bash
hf download nvidia/Arena-G1-Loco-Manipulation-Task \
  --repo-type dataset \
  --revision 07de42fdade76102fc09d921c7b6200d0b31ec01 \
  --include 'lerobot/meta/*' \
            'lerobot/data/chunk-000/episode_000000.parquet' \
            'lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4' \
  --local-dir datasets/arena_g1_box_sample
```

以上按文件选取是“检查样本”，不代表新导出一个完整的一回合 LeRobot 数据集。原始 info 和 episodes 清单仍描述整库，导入工作台后应显示“目录中100回合，实际持有1回合”，或由正式子集工具重写一致的元信息；不能假装整库已下载。

完整 LeRobot 子树约298.3MB，可按 `--include 'lerobot/*'` 下载。不要默认整库下载：同 repo 还有23.36GB的 generated HDF5、230.1MB的 small HDF5 和214.0MB的 annotated HDF5。模型仓库也带优化器/分布式训练状态，整库约50.6GB；推理的两片 safetensors 共6.57GB，另需模型配置、处理器、统计等运行文件。下载规则须排除无关训练状态并保持必要文件完整。

版本质量问题也要记录：该固定版 README 仍写50回合/旧模型描述，而 `lerobot/meta/info.json` 实际为100回合。以本次解析到的固定元数据说明数量，同时保留这处差异供审核。

## 从下载到仿真效果验证的实际路线

1. **检查样本**：读取 task、episode、视频、state/action 和额外命令，确认抓箱、携带、放置过程与帧时间；人或 Agent 提交疑点，人复核关键接触。
2. **登记并选数**：保存固定来源、许可、实际持有范围与校验值；按回合/场景划分训练和留出评价。先做官方固定场景复现。
3. **导入或转换**：已转换的 LeRobot 分支直接接对应读取器；若选 HDF5，使用官方 `isaaclab_arena_gr00t/lerobot/convert_hdf5_to_lerobot.py --yaml_file .../g1_locomanip_config.yaml`。它不是 Unitree 28维 JSON 转换脚本。
4. **训练**：调用 Arena 官方 GR00T N1.6 训练配方。先用现成 checkpoint 检查环境/接口，再做我们自己选择数据的训练；前者是运行时基线，不能当作本轮训练验收。
5. **闭环仿真**：启动 GR00T policy server，使用 `policy_runner.py` 在 `galileo_g1_locomanip_pick_and_place`、`g1_wbc_joint` 中执行。使用当前观察推理，记录抓起、运送、放置、总成功与失败视频。回放记录不计为策略闭环成功。
6. **目标场景扩展**：改为桌A/桌B、核实箱体重量/尺寸、移动距离、接触与成功判定，重新收集或生成缺失覆盖，再做独立闭环评估。迁到真机仍需单独验证相机、动作、控制器和载荷。

这条路线目前是**有完整公开材料的待复现计划**。不能在报告里写“本项目仿真已通过”或“该数据保证效果好”。建议把首期验收写成：保留固定测试配置、多次闭环成功率及失败分类、视频、输入数据和模型记录，达到团队预先约定的目标；不使用单个成功视频替代统计结果。

### 腰腿如何参与

记录中有43维关节 state/action，但官方 N1.6 配方选取双臂、双手和腰部作为上身状态（31维），动作还加入机身高度1维和导航3维。对应35维高层动作，底层 WBC 产生腿部目标。这与“直接训练43个关节动作”不同。双手关节名为拇指/食指/中指，每手7个关节，与 Dex3 三指参考相符，仍需核对到货配置。

官方采集/生成使用 `g1_wbc_pink` 的末端控制，闭环策略使用 `g1_wbc_joint`；两者数据与执行接口已有明确映射。首期工作台应复用这一整套已公开组合，再让新增本体或策略通过适配器接入。

### 算力边界

该 Arena 路线要求 Linux + NVIDIA GPU/Isaac Sim 环境。官方 N1.6 示例建议8张48GB GPU，训练约4–8小时，并建议大主存；文档允许缩小 batch/worker 适应较少资源，但不保证原训练时长或收敛。不要在本机 Mac 上直接启动整套训练。先获取实际服务器规格，评估环境与策略是否可分开执行，再选择先闭环推理还是重新训练。

## 大数据集筛选要解决什么

使用者先填目标任务、G1/Dex3、观察、动作层级和用途。平台先读取远端清单/任务表，显示“相关候选、缺少阶段、手型不同、可直接复现的环境”等具体理由；预览代表回合后选择范围，计算需要下载的文件并断点续传。对分片视频/Parquet，按回合索引映射到真实分片，不能承诺远端总能只下载一个回合的字节。

数据仓库分开保存“远端目录”“实际持有”“本次实验选择”。原件和媒体存对象存储/文件系统，目录、任务、适配结论和索引入数据库；训练用固定 manifest 与本地缓存/顺序分片读取。新增转换方法只有在原始信号足够时研发，缺失腰腿动作或手型差异不靠容器转换解决。

## 一手出处

- [Arena 完整任务概览](https://github.com/isaac-sim/IsaacLab-Arena/blob/38b200cdb4b506ee8329e89480c6479cae5bc2dc/docs/pages/example_workflows/locomanipulation/index.rst)
- [Arena 下载、转换与训练](https://github.com/isaac-sim/IsaacLab-Arena/blob/38b200cdb4b506ee8329e89480c6479cae5bc2dc/docs/pages/example_workflows/locomanipulation/step_4_policy_training.rst)
- [Arena 闭环评估与动作控制边界](https://github.com/isaac-sim/IsaacLab-Arena/blob/38b200cdb4b506ee8329e89480c6479cae5bc2dc/docs/pages/example_workflows/locomanipulation/step_5_evaluation.rst)
- [GR00T 动作/观察配置](https://github.com/isaac-sim/IsaacLab-Arena/blob/38b200cdb4b506ee8329e89480c6479cae5bc2dc/isaaclab_arena_gr00t/embodiments/g1/g1_sim_wbc_data_config.py)
- [Arena 数据固定版 info](https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/blob/07de42fdade76102fc09d921c7b6200d0b31ec01/lerobot/meta/info.json)与[模态切分](https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/blob/07de42fdade76102fc09d921c7b6200d0b31ec01/lerobot/meta/modality.json)
- [Unitree 实际任务表](https://huggingface.co/datasets/unitreerobotics/G1_WBT_Brainco_Plastic_Box_Parts/blob/6a5fe2adb86604dc5fe821c7c3b9a44e169119f4/meta/tasks.parquet)
- [DROID 原始/训练数据获取与 schema](https://droid-dataset.github.io/droid/the-droid-dataset)
- [DROID 原作者论文与数据许可](https://www.jiajunwu.com/papers/droid_rss.pdf)

本次核查快照和哈希见 `evidence/report_v15_dataset_sources.json`；主任务下载与数值/视频核验见 `evidence/report_v15_case/`。未下载大规模HDF5、模型或整套视频。

## 可执行入口备查

以下命令是固定官方路线的参数化模板，路径相对于Arena根目录或其Isaac-GR00T子模块；先完成匹配Linux/NVIDIA驱动、Arena Base容器及GR00T原生uv环境。本次只实际执行了前面的单回合下载/读取；未运行以下完整数据、模型、训练与仿真命令。该训练后端与前半Unitree LeRobot脚本分别固定环境。

### 取已转换数据，跳过大HDF5

```bash
hf download nvidia/Arena-G1-Loco-Manipulation-Task \
  --repo-type dataset \
  --revision 07de42fdade76102fc09d921c7b6200d0b31ec01 \
  --include 'lerobot/*' \
  --local-dir datasets/arena_g1
```

这会得到 `datasets/arena_g1/lerobot`。仅持有一回合时不运行整库训练，应先取实际训练所选范围并重验元信息一致性，或下载完整约298MB子树。需要从HDF5开始时，编辑匹配yaml中的data_root/hdf5_name后，在Arena Base容器运行：

```bash
python isaaclab_arena_gr00t/lerobot/convert_hdf5_to_lerobot.py \
  --yaml_file isaaclab_arena_gr00t/lerobot/config/g1_locomanip_config.yaml
```

### 推理基线模型与服务

模型文件选择应保留权重、索引、config、processor、tokenizer和统计文件，排除 `optimizer.pt` 与 `global_step20000/` 训练状态。按上文固定模型revision和Hub清单选择文件；先核对许可和磁盘预算，不默认拉整库。将推理包置于Arena根目录下 `models/arena_g1_reference`。

从 `submodules/Isaac-GR00T` 的原生uv环境启动服务：

```bash
uv run python gr00t/eval/run_gr00t_server.py \
  --modality-config-path ../../isaaclab_arena_gr00t/embodiments/g1/g1_sim_wbc_data_config.py \
  --model-path ../../models/arena_g1_reference \
  --embodiment-tag NEW_EMBODIMENT \
  --device cuda --host 127.0.0.1 --port 5555
```

Arena Base容器与宿主服务之间的挂载、网络和地址按官方Docker部署配置；不能把macOS/Windows的Docker环回地址套成Linux主机网络。服务器可远程部署，但必须核对可达地址和必要访问配置。

### 自己选数后训练

下面保留官方8卡示例，演示脚本、参数和产物关系，不作为本次自动执行计划。训练机规格确认后才能调整batch、GPU数和worker，并留出独立评价。相对路径以 `submodules/Isaac-GR00T` 为工作目录：

```bash
uv run python -m torch.distributed.run --nproc_per_node=8 --standalone \
  gr00t/experiment/launch_finetune.py \
  --dataset-path ../../datasets/arena_g1/lerobot \
  --output-dir ../../models/arena_g1_trained \
  --modality-config-path ../../isaaclab_arena_gr00t/embodiments/g1/g1_sim_wbc_data_config.py \
  --global-batch-size 96 --max-steps 20000 --num-gpus 8 \
  --save-steps 5000 --save-total-limit 5 \
  --base-model-path nvidia/GR00T-N1.6-3B \
  --no-tune-llm --tune-visual --tune-projector --tune-diffusion-model \
  --dataloader-num-workers 16 \
  --color-jitter-params brightness 0.3 contrast 0.4 saturation 0.5 hue 0.08 \
  --embodiment-tag NEW_EMBODIMENT
```

上述颜色参数来自官方参考配方，不代表我们的数据已批准使用该强度。可先做无增强基线和经审查配方对照。自己训练后须把服务指向实际生成的检查点，原始/公开模型运行结果与新模型分开记录。

### 匹配仿真的闭环入口

从Arena Base容器内的仓库根目录运行，保证5555端口上的服务和对应WBC/场景版本可用：

```bash
python isaaclab_arena/evaluation/policy_runner.py \
  --viz kit \
  --policy_type isaaclab_arena_gr00t.policy.gr00t_remote_closedloop_policy.Gr00tRemoteClosedloopPolicy \
  --policy_config_yaml_path isaaclab_arena_gr00t/policy/config/g1_locomanip_gr00t_closedloop_config.yaml \
  --remote_host 127.0.0.1 --remote_port 5555 \
  --num_steps 1500 --enable_cameras \
  galileo_g1_locomanip_pick_and_place \
  --object brown_box --embodiment g1_wbc_joint
```

这一步才是根据环境当前反馈推理执行。官方文档中的单回合 `success_rate:1.0` 是示例输出，不能抄作本项目成绩；实际验收保存多次初始条件、完整任务成功率、阶段失败与录像。随后迁移桌A/B和真机，分别重验。
