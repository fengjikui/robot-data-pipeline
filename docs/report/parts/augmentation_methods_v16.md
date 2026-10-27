# 数据增强方法全景：一页版材料（v16）

核查：2026-10-27。仅查官方文档、作者论文与公开源码，没有下载模型、运行仿真或训练。本文给报告提供方法和来源，不表示工作台已接入这些能力。

## 一页正文建议

标题：**数据增强：从图像变化，到新的动作示范**

页面主体可用六行表格，最后用一条短横栏补充真实补采。每行说清“改什么、得到什么、有什么现成方法”，避免只有产品名。

| 方法层级 | 具体可以做什么 | 输入与产出 | 工具或公开研究 |
| --- | --- | --- | --- |
| 训练输入增强 | 亮度、对比度、色温、阴影；噪声、模糊、压缩；裁剪、平移与小幅仿射 | 已有图像/视频帧 → 变化后的观察 | LeRobot、torchvision、自定义变换 |
| 三维场景重渲染 | 改灯光、HDR背景、材质/纹理、相机位置；重出RGB、深度、分割 | 可恢复的场景/轨迹 → 新视图与视觉标注 | Isaac Sim / Omniverse Replicator |
| 场景与动力学随机化 | 改物体初始位姿、尺寸、质量、摩擦、控制参数；重新执行交互 | 场景与执行策略 → 新场景中的state/action回合 | Isaac Lab事件随机化与任务控制器 |
| 示范扩增与轨迹重定向 | 子任务分段、物体相对轨迹迁移、连接与重组、双臂协调、规划连接 | 少量已标注示范 + 匹配环境 → 新动作示范 | MimicGen、Isaac Lab Mimic / SkillGen；DexMimicGen研究 |
| 生成式外观扩增 | 替换背景、纹理、物体外观和干扰物；用深度/边缘/分割约束视频变化 | 原图/视频 + 掩码或结构条件 → 新图像/视频 | GenAug、ROSIE；Cosmos视频迁移路线 |
| 世界模型生成行为 | 从图像与任务生成机器人视频；由逆动力学模型提取动作，或使用已适配的世界动作模型 | 图像/指令/动作条件 → 候选视频、推断动作或想象转移 | GR00T-Dreams / DreamGen；Cosmos 3公开示例 |

**补充真实覆盖：**换光照/物体/桌位补采、失败恢复示范、专家介入重标与DAgger数据聚合；语言条件任务还可以扩充语义一致的任务表述。

信息密度需要进一步压缩时，可把“输入与产出”列合进每行第二行文字。主讲控制在2–3分钟，突出三种产出：**新的观察、新的物理执行轨迹、模型推断的候选轨迹**。注意事项与方法边界留讲稿，页面不放大段风险提示。

## 可以直接使用的精讲口述

增强不只是把视频调亮。第一层是训练读取时改变颜色、成像退化和局部视野，LeRobot和torchvision已经有很多工具，也可以自写变换。第二层是有了三维场景以后重新渲染灯光、材质和相机；进一步改变物体位置、质量与摩擦，就能在新条件里重新执行。第三层是从少量示范扩出新的动作：MimicGen一类方法按子任务重定向与重组，SkillGen再用运动规划连接。生成模型又提供两条路线：GenAug、ROSIE和Cosmos迁移外观；DreamGen则还要从生成的视频中推断动作。最后，真实失败与新场景补采也很重要，它直接增加我们缺少的操作覆盖。工作台应该把这些不同方法作为配方接入，保存原件、来源和生成结果，便于预览与复用。

## 讲稿中的事实与实现层级

### 1. LeRobot与自写增强

2026-10-27核查的LeRobot main提交为 `45cca1a6ba368cf29cc8b4e0f49a1db875d15f61`。当前源码含图像变换与按样本批处理的后端，能覆盖颜色、gamma、色温、局部阴影、传感器噪声、运动模糊等；torchvision另有裁剪、仿射、锐度等通用变换。训练时作用于解码帧，不必先重写整套视频。这里的产出是新的观察，不是新动作真值。

前版报告固定的宇树LeRobot子模块仍是 `a5b29d4`，它的内置工厂只有 `Identity / ColorJitter / SharpnessJitter / RandomAffine`。因此增强页可以讲方法全景，但不能把当前main的新type直接放进旧版CLI冒充可用。旧版可通过callable、变换工厂或读取器扩展。具体参数和安装版本另放备查。

### 2. Replicator与Isaac Lab不是同一层

Replicator是Isaac Sim里的可脚本化场景/渲染与标注工具，官方示例覆盖灯光、材质、物体摆放和相机随机化。它能输出RGB及由仿真直接得到的视觉标注；单纯重渲染不自动生成新的机器人行为。[S3][S4]

Isaac Lab的事件随机化接口能改变刚体质量、物理材料、关节/执行器参数、初始状态等。为取得新的机器人控制数据，仍要让任务控制器、已有策略或示范生成器在这些条件下执行，再保存观测和动作。[S5] 报告不沿用某些营销摘要中“Isaac Lab没有合成数据生成”的笼统说法，官方Mimic和SkillGen文档明确提供这类流程。

### 3. Mimic、MimicGen、DexMimicGen与SkillGen

MimicGen有公开数据生成代码，利用物体相对的子任务运动，将少量源示范迁到新的物体配置并执行，输出新回合。Isaac Lab Mimic提供收集、标注、生成与模仿学习流程。[S6][S7]

SkillGen是Isaac Lab的扩展：从标注示范取局部技能段，用cuRobo运动规划连接，并在新物体摆放中生成和筛选成功回合。[S8] 它比仅改图片更接近“新增有效轨迹”，但需要匹配环境、技能标注和规划配置。

DexMimicGen论文研究了双臂、多指、协调与异步子任务的数据生成。**固定公开仓库 `940e8a1` 的README声明释放环境和数据集，树中未查到与MimicGen同等的数据生成器入口，主要包含数据下载/回放、环境和训练配置。** 页面可把它列为双臂灵巧操作的研究方法与公开数据参考，不能宣称已有可直接运行的“DexMimicGen通用生成命令”。[S9]

### 4. NVIDIA的视觉迁移与世界模型路线

Cosmos-Transfer2.5的明确公开机器人工作流，输入RGB和深度、边缘、分割等结构控制，可生成不同环境/材质/光照的视频。它的直接产出是视频。Isaac Lab Augmented Imitation官方教程有HDF5导出视频、Cosmos改外观、再由 `mp4_to_hdf5.py` 与原始state/action配对的流程；这能具体说明增强如何回到训练数据，而不是只展示漂亮视频。[S10][S11]

时效性：2026-10-27，Cosmos-Transfer2.5仓库已声明进入有限维护并引导迁移Cosmos 3。**Cosmos 3是当前官方模型家族**，公开README/COOKBOOK包含生成、迁移、动作/逆动力学，以及2026年10月的交互式双臂神经仿真示例。[S12] 因此主页面推荐写“Cosmos视频迁移/世界模型”，讲稿再区分已有Transfer2.5参考流程与当前Cosmos 3具体变体，避免把Transfer1说成最新模型，也避免认定不同模型的能力和接口完全相同。

GR00T-Dreams公开的DreamGen流程先适配视频世界模型，生成视频，然后由为目标本体训练的逆动力学模型（IDM）提取动作、转成LeRobot并训练策略。固定仓库列出的处理本体是Franka、Fourier GR1、SO-100和RoboCasa；这不是当前G1的现成通用动作生成器。[S13] 产出动作属于推断标签，报告不把它称为物理仿真已执行的真值。Cosmos 3的动作或交互仿真示例同样要选匹配本体和后训练配置。

### 5. GenAug、ROSIE与真实补采

GenAug/ROSIE是作者公开的生成式视觉增强研究。它们用生成模型改变背景、物体外观或干扰物，ROSIE还结合指令与区域掩码产生语义标注。ROSIE原流程依赖Imagen Editor，作者页面不等于已经提供一个完全可本地复现的开源生成器；可列研究方案，不能包装成工作台现成功能。[S14][S15]

真实补采与DAgger归在“扩量/覆盖补充”，与不增加机器人执行的图像增强分开。DAgger的要点是采样当前策略会到达的状态、请专家给对应动作标签，再聚合训练。[S16] 对搬箱，可以补充不同桌位、箱体、照明和抓持失败恢复。任务指令改写只用于有语言条件的配方；普通的重采样、切片或重复回合本身不等于产生新技能。

## 平台接入时只保留一条讲稿原则

每个方法都声明输入条件、输出种类和调用后端。产物带原始母回合、配方与随机种子，允许人/Agent看原始/生成对照。具体几何、时序、接触和任务效果检查留到配方审核与实验，不能在这一页挤成注意事项墙。这里没有承诺任意方法必然改善G1搬箱效果。

## 权威来源

- [S1 LeRobot固定当前源码](https://github.com/huggingface/lerobot/blob/45cca1a6ba368cf29cc8b4e0f49a1db875d15f61/src/lerobot/transforms/transforms.py)
- [S2 Torchvision图像与视频变换（访问时为0.29文档）](https://docs.pytorch.org/vision/stable/transforms.html)
- [S3 Isaac Sim官方随机化示例](https://docs.isaacsim.omniverse.nvidia.com/latest/replicator_tutorials/tutorial_replicator_isaac_randomizers.html)
- [S4 Replicator随机化API示例](https://docs.omniverse.nvidia.com/extensions/latest/ext_replicator/randomizer_details.html)
- [S5 Isaac Lab事件/动力学随机化API（v2.3.0）](https://isaac-sim.github.io/IsaacLab/v2.3.0/source/api/lab/isaaclab.envs.mdp.html)
- [S6 MimicGen固定公开代码](https://github.com/NVlabs/mimicgen/blob/c0fbff22ba40060f05a917a80817f3f5c20731e7/README.md)
- [S7 Isaac Lab Mimic官方流程](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/teleop_imitation.html)
- [S8 Isaac Lab SkillGen官方流程](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/skillgen.html)
- [S9 DexMimicGen固定公开仓库](https://github.com/NVlabs/dexmimicgen/blob/940e8a1b3ad70eb1925ada6b364b197de6bb2af9/README.md)与[作者项目/论文](https://dexmimicgen.github.io/)
- [S10 Cosmos-Transfer2.5固定公开工作流](https://github.com/nvidia-cosmos/cosmos-transfer2.5/blob/2ff49d0717af02057ae79bc75c00fbff9da1b4e7/README.md)
- [S11 Isaac Lab Augmented Imitation：视频增强回配原动作](https://isaac-sim.github.io/IsaacLab/main/source/features/imitation-learning/augmented_imitation.html)
- [S12 Cosmos 3当前家族](https://github.com/NVIDIA/cosmos/blob/0c9e2f1330b235c87dc77d7af489c78a901c4c9e/README.md)及[公开Cookbook](https://github.com/NVIDIA/cosmos/blob/0c9e2f1330b235c87dc77d7af489c78a901c4c9e/COOKBOOK.md)
- [S13 GR00T-Dreams / DreamGen固定公开管线](https://github.com/NVIDIA/GR00T-Dreams/blob/ec3881d44545016871997f8e17dd15f1d792e91d/README.md)
- [S14 GenAug作者项目](https://genaug.github.io/)
- [S15 ROSIE作者项目](https://diffusion-rosie.github.io/)
- [S16 DAgger原论文（AISTATS 2011）](https://proceedings.mlr.press/v15/ross11a.html)

来源与版本清单见 `evidence/report_v16_augmentation_sources.json`。自行归纳的六类结构是报告编排，不当作权威分类标准。
