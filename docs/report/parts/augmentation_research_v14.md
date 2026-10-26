# 数据增强专项核查（报告 v14）

核查日期：2026-10-26。结论按实际固定源码整理，未安装训练环境、未执行增强/训练、未声称 G1 效果已提升。

## 1. 版本基准已核实

Git tree 实查：`unitreerobotics/unitree_lerobot@41c2805742de879ddab2d8d6beaeaf215f876395` 的 `unitree_lerobot/lerobot` 为 mode `160000`、type `commit`，指向 **`a5b29d430105f5235eb05bbf2db5a0d747a869d6`**。宇树 README 第47行仍写 `0878c68`，与真实 gitlink 不一致；报告应以 gitlink 为准。证据保存于 `evidence/augmentation_research_v14/unitree_lerobot_gitlink.json`。

本节精确配置对应 a5b29d4，不与当前 main 的新增 GPU 后端/额外变换混用。

## 2. LeRobot 已有增强，通常无需先改写一遍视频

固定版源码支持训练加载时的图像变换，既适用于图像记录，也适用于解码后的视频帧。它改变训练输入，不直接增加独立运动技能或新的动作真值，也不必另存一套 MP4。

| 核实项 | 固定 a5b29d4 的实际行为 | 来源 |
| --- | --- | --- |
| 配置 | `dataset.image_transforms.enable` 默认 false；`max_num_transforms=3`；`random_order=false` | [A1][A2] |
| 默认候选 | 亮度、对比度、饱和度、色相、锐度，以及随机仿射（旋转/平移） | [A1] |
| 默认范围 | 亮度/对比度 `[0.8,1.2]`，饱和度/锐度 `[0.5,1.5]`，色相 `[-0.05,0.05]`，仿射旋转 `[-5,5]` 度、平移比例 `[0.05,0.05]` | [A1] |
| 配置工厂 | 固定版只接受 `Identity`、`ColorJitter`、`SharpnessJitter`、`RandomAffine` 这4种 type | [A1] |
| 自写扩展 | `LeRobotDataset(image_transforms=callable)` 可接自定义/torchvision变换；要由统一训练 CLI 调用，须接入工厂/配置路径，不能把不存在的 type 直接填进固定版 CLI | [A1][A3] |
| 多相机 | 数据集逐个相机调用同一变换对象，会分别采样；不保证多相机共享一次全局光照参数 | [A3] |
| 时序 | torchvision v2 支持带前导时序维的张量。单次调用可对一段张量一致变换，但不能因此认定整个回合/各训练样本连续不闪烁 | [A1][A6] |

补充版本差异：2026-10-26访问的 LeRobot main 官方文档还列出 `GaussianNoise`、`MotionBlur`、`JPEGCompression`、`RandomShadow`、`GammaCorrection`、`PlanckianJitter` 等，且增加GPU增强后端说明。[A13] 这些不属于本报告固定 a5b29d4 的可用 type/参数；若后续升级，应按新版本重验数值类型、视频时序和训练器接口。

因此不建议首期只打开默认开关后便把“全部增强”直接投入正式训练。先明确要模拟的部署差异，显式选择保守增强配方，再检查样本并做对照。

## 3. 能真正写进 PPT 的工具和参数

### 3.1 增强预览工具

已安装匹配版本的 LeRobot 后，从其仓库/环境运行：

```bash
lerobot-imgtransform-viz \
  --repo_id=local/g1_box \
  --episodes='[0]' \
  --image_transforms.enable=true
```

对应脚本为 `src/lerobot/scripts/lerobot_imgtransform_viz.py`。也可 `python src/lerobot/scripts/lerobot_imgtransform_viz.py ...`。可选子配置为 `--image_transforms.max_num_transforms=2`、`--image_transforms.random_order=false`、`--image_transforms.tfs='<完整JSON映射>'`。

**本版实际限制：**

- 预览 CLI 用 `--repo_id`、`--image_transforms...`，没有 `dataset.` 前缀；训练 CLI 则有该前缀。
- 只取所选第一个回合、第一相机的第一帧。默认每种变换/组合输出5例及单项 min/max/mean。它不是完整视频/多相机审核器。
- 默认输出为 `outputs/image_transforms/<repo最后一段>/`。不要照当前文档示例写 `--output-dir`、`--n-examples` 当作本固定版标准 CLI 字段：它们是 Python 函数形参，而 `draccus.wrap` 从第一参数 `DatasetConfig` 解析命令行。已核查该项目固定的 Draccus 0.10.0 源码。
- 该脚本没有将 `cfg.root` 传给数据集，不能承诺 `--root=<任意本地目录>` 生效。上述例子要求数据已经处于该 repo_id 的默认缓存/可获取位置。任意工作区路径预览要加小包装器，以 `LeRobotDataset(root=...)` 显式读取。

来源：[A4][A5]。说明原始工具边界，正好体现后续工作台可以补全回合/多相机/关键帧审核。

### 3.2 真正执行训练时增强

增强可直接挂在现有训练器上，不需要先运行一个虚构的通用 `augment.py`：

```bash
python src/lerobot/scripts/lerobot_train.py \
  --dataset.repo_id=local/g1_box \
  --dataset.root=<LEROBOT_DIR> \
  --policy.type=act \
  --policy.device=cuda \
  --policy.push_to_hub=false \
  --dataset.image_transforms.enable=true \
  --dataset.image_transforms.max_num_transforms=2 \
  --dataset.image_transforms.random_order=false \
  --dataset.image_transforms.tfs='{"brightness":{"weight":1.0,"type":"ColorJitter","kwargs":{"brightness":[0.9,1.1]}},"contrast":{"weight":1.0,"type":"ColorJitter","kwargs":{"contrast":[0.9,1.1]}}}' \
  --steps=10000 --batch_size=8 --num_workers=1 \
  --seed=42 --wandb.enable=false \
  --output_dir=outputs/train/g1_box_act_aug
```

这是 Bash/训练执行机上的参数模板，仅完成字段/函数签名核查，未在完整依赖环境运行。`<LEROBOT_DIR>` 为已转换数据的实际目录，`repo_id`需与元数据一致；资源参数示例不是本任务训练预算或效果保证。

上述 `tfs` 是显式替换候选映射，仅保留两项、各 `[0.9,1.1]`，而非默认再混入 hue/affine。它是工程上建议的起始试验范围，不是论文证明的 G1 最优值。PPT可显示关键 flags，长 JSON放讲稿。已有 `lerobot-train` 命令入口等价于该脚本入口。[A1][A2][A5]

### 3.3 仿真轨迹扩增是另一类工具

Isaac Lab **v2.3.2** 官方示例的实际工具链为 `record_demos.py`、`annotate_demos.py`、`isaaclab_mimic/generate_dataset.py`。生成器关键参数：`--input_file`、`--output_file`、`--generation_num_trials`、`--num_envs`；视觉数据另需 `--enable_cameras`，具体任务与标注须匹配。

示例：

```bash
./isaaclab.sh -p scripts/imitation_learning/isaaclab_mimic/generate_dataset.py \
  --device cpu --enable_cameras --num_envs 1 --generation_num_trials 10 \
  --input_file ./datasets/annotated_dataset.hdf5 \
  --output_file ./datasets/generated_dataset_small.hdf5
```

这是官方流程的小规模参数化模板，`num_envs=1`为保守并发选择，未在本机执行；不能直接把任意宇树 JSON 当成该 HDF5/任务输入。生成后要重验任务成功和接触/动作有效性。[A7]

## 4. 方法目录和建议优先级

这里的“优先”是面向我们当前阶段的工程判断，不表示这些方法在 G1 搬箱上已稳定增益。RAD/DrQ等提供特定视觉控制基准证据，GenAug/ROSIE/MimicGen在各自操作场景验证，不能外推其成功率。

| 建议 | 方法 | 能覆盖什么 | 必须保持/补充什么 |
| --- | --- | --- | --- |
| 先试 | 小幅亮度、对比度、曝光/gamma或色温扰动 | 常见照明/曝光差异，成本较低 | 主体、接触和目标仍清楚；颜色驱动指令不随意改hue。LeRobot固定版内置亮度/对比；gamma/色温需自写扩展 |
| 按实测问题试 | 轻微模糊、传感器噪声、压缩伪影、局部阴影 | 真实相机链路/运动模糊或弱照度退化 | 先测真实传感器分布，小范围；不要淹没接触细节；固定版部分类型需扩展 |
| 审核后试 | 小幅裁剪/平移/仿射、分辨率变化 | 小相机偏移/观察扰动 | 不裁掉箱子、夹持点；像素标注、深度和内参按需一致处理；不把二维图像变换当成真实视角变化 |
| 优先补真实覆盖 | 多光照/背景/箱体位置、失败恢复回合的真实采集 | 直接覆盖部署域及策略未见状态 | 属于补采/数据扩展，非廉价图像变换；保留真实动作和结果证据 |
| 场景具备后做 | 仿真材质/灯光/相机重渲染 | 保持物理轨迹，增加视觉环境 | 仿真状态可恢复、相机/标定明确，重渲染数据与原轨迹时序对应 |
| 场景具备后做 | 物体位姿/尺寸/摩擦/质量随机化、MimicGen轨迹生成 | 扩大起始状态和交互覆盖 | 必须重新闭环执行、重新记录状态/动作并筛成功，不能只改视频和旧动作 |
| 研究试验 | 背景/纹理/干扰物生成式编辑（GenAug、ROSIE等） | 增加语义和视觉域变化 | 保护机器人、目标和接触区域；检查多帧/多视角一致性、几何和指令，保留原件；不默认信任生成器 |
| 条件适用 | 同义任务指令/语言描述变体 | 语言条件策略的表达覆盖 | 必须语义等价，不更改目标/动作；ACT等不使用语言的配方不能自动获得相同收益 |
| 高约束、后做 | 轨迹空间变换、对称性、坐标重定向 | 特定等变任务/跨设置复用 | 状态、动作、几何、控制器和约束共同变换，并做物理复验；不是简单把关节向量加噪 |

禁止默认套用分类任务的水平翻转、CutMix、MixUp、动作随机扰动或乱序/倒放视频。并非所有这些操作永远不可用，而是没有满足机器人任务相应不变性、重标或重执行条件前不能当成标签保持增强。

## 5. 人与 Agent 怎么审查

建议的平台流程：**增强配方草稿 → 保存原始/增强对照 → Agent初筛与人复核 → 小规模配对实验 → 当前任务/配方批准**。这是拟新增能力。

1. 先按母回合/采集场景划分训练和留出集，母回合派生继承划分。最终评价保留未增强、独立采集的真实样本/环境。
2. 固定配方版本、参数、随机种子、来源/母回合、实现commit；生成式方案另存模型/提示词/掩码。保留原始像素和数值，训练时在线增强不覆盖原件。
3. 审查每相机、首中末帧、接触/抓取/放置时段，并抽取多个种子和强度边界，不只看默认预览的一帧。对RGB、深度/像素标注和动作进行关联核对。
4. 规则/Agent筛查全黑过曝、目标被裁、颜色语义变化、机器人/夹持区域被改、视频闪烁、多相机几何冲突、错误时间关系和数值变化。全局照明扰动可共享时序参数，传感器独立噪声可按物理模型分别处理，不将“所有相机永远相同”当成唯一规则。
5. 人审核新配方、高风险生成/几何方案和Agent疑点；自动评审通过不能证明物理动作或最终收益。
6. 对照“不增强 / 保守增强 / 更强增强”，固定同一训练划分、训练预算与评价场景，使用多个种子或重复运行；比较正常场景是否退化、光照偏移场景是否改善，以及闭环任务成功/失败。未改善或导致关键场景退化则回退，不凭训练loss批准。

## 6. 建议的两页 PPT

### 页 A：数据增强的几条可执行路径

主画面为三条并列路线：

- **训练时图像增强**：LeRobot现成参数，亮度/对比/颜色/锐度与仿射；首期小幅照明扰动。
- **自定义观察增强**：传感器噪声、模糊/压缩、局部阴影；通过callable/适配器接入。
- **重新生成有效示范**：仿真重渲染、场景随机化、轨迹生成，生成式编辑单列研究候选。

底部：`lerobot-imgtransform-viz --repo_id=... --image_transforms.enable=true`；训练加 `--dataset.image_transforms.enable=true`。说明预览与执行分开，具体配方参数放讲稿。

讲稿：增强不只有仿真。LeRobot在加载图像或视频帧时就能做现成图像变换，不必事先重写整段视频，也可以挂自定义逻辑。我们先从和真实部署差异相符、语义较容易保持的轻量照明扰动开始，再按问题加入模糊等。仿真重新生成轨迹属于另一层，必须重新验证动作和任务。论文验证的是各自场景，不能保证我们的搬箱任务一定提升。

资料：固定LeRobot变换/预览源码 [A1][A4]、Torchvision [A6]、Isaac Lab [A7]。

### 页 B：增强要经过审查和效果验证

用流程线展示：**配置与预览 → 规则/Agent初筛 → 人复核 → 留出场景对照 → 批准/回退**。

画面只保留四项检查：目标/接触区域、时序与多相机、标签/动作保持、真实闭环收益。加注：同源派生不跨训练/测试集合；固定版官方预览只看首相机首帧，平台需补全。

讲稿：漂亮不等于有效。增强前先留出真实评价场景，之后既看不同光照是否改善，也看原场景有没有退化。自动审查可以找遮挡、闪烁、颜色语义或接触区域被改的疑点，人重点复核新配方和高风险案例。最后仍要用相同预算做闭环对照，没收益就回退。平台应保存配方和母回合，允许审批和追溯，而不是一键生成后全量入训。

资料：LeRobot预览源码 [A4]、Torchvision视频/变换说明 [A6]、RAD/DrQ原论文 [A8][A9]；审查流程为本项目设计，不拿内部材料当权威引用。

## 一手来源

[A1] [LeRobot a5b29d4 transforms.py](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/datasets/transforms.py)

[A2] [DatasetConfig](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/configs/default.py)；[训练工厂](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/datasets/factory.py)

[A3] [固定版 LeRobotDataset：逐相机应用变换](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/datasets/lerobot_dataset.py#L1018-L1021)

[A4] [固定版增强预览脚本](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/scripts/lerobot_imgtransform_viz.py)

[A5] [固定版入口](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/pyproject.toml#L181-L185)；[训练参数](https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/configs/train.py)

[A6] [Torchvision v2 图像与视频变换](https://docs.pytorch.org/vision/stable/transforms.html)；[ColorJitter](https://docs.pytorch.org/vision/stable/generated/torchvision.transforms.v2.ColorJitter.html)

[A7] [Isaac Lab v2.3.2 官方示范生成流程](https://isaac-sim.github.io/IsaacLab/v2.3.2/source/overview/imitation-learning/teleop_imitation.html)

[A8] [RAD 原论文](https://arxiv.org/abs/2004.14990)

[A9] [DrQ 原论文](https://arxiv.org/abs/2004.13649)

[A10] [MimicGen 原作者项目](https://mimicgen.github.io/)

[A11] [GenAug 原作者项目](https://genaug.github.io/)

[A12] [ROSIE 原作者项目](https://diffusion-rosie.github.io/)

[A13] [LeRobot main 当前增强说明](https://github.com/huggingface/lerobot/blob/main/docs/source/lerobot-dataset-v3.mdx)，访问日2026-10-26，动态文档仅作未来升级参考。

核查源文件、SHA256与发布版 Draccus 0.10.0 源码保存在 `evidence/augmentation_research_v14/`。这里只列源码真实存在的工具，不声称本项目工作台已有相应执行/审核功能。
