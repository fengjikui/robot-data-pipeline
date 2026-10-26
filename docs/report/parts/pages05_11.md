# 正文第 5–11 页：内容、讲稿与事实边界

2026 年 10 月 26 日。供主稿整合使用，不含 PPT 或图形实现。

## 第 5 页 外部数据的类型与整理层级

先看数据怎样保存，再看已经整理到了哪一步

### 投影文字

- 外部数据可以来自开源平台或供应商交付
- 文件容器与轨迹组织约定属于不同层次
- 格式与标签只能缩小候选，训练适用性仍需验证

### 图示数据

```json
{
  "type": "layers_and_examples",
  "fileExamples": [
    [
      "JSON + 图像/视频",
      "轨迹记录与独立媒体文件"
    ],
    [
      "HDF5 / Zarr",
      "数组与回合数据的容器"
    ],
    [
      "rosbag",
      "按话题记录传感器与控制消息"
    ]
  ],
  "organizationExamples": [
    [
      "LeRobot",
      "特征、视频、回合和元数据"
    ],
    [
      "RLDS",
      "episode / step 及其字段约定"
    ]
  ],
  "stages": [
    "原始采集记录",
    "已整理、标注的轨迹",
    "面向指定训练配方的输入"
  ],
  "categoryFields": [
    "任务/技能",
    "来源本体",
    "观察模态",
    "动作表达",
    "处理阶段",
    "来源/版本"
  ],
  "displayNote": "格式、处理层级、适用性分别登记；详细获取与配置在后半部分展开。"
}
```

### 演讲稿与参考出处

除了自己采集，我们还可能拿到开源数据，或者供应商通过硬盘、网盘交付的数据。先看它怎样保存：常见的是 JSON 配图像或视频、HDF5 或 Zarr 数组容器，也可能是按话题记录的 rosbag。DROID 就同时提供原始传感与轨迹等组织方式。[1][4]

LeRobot 和 RLDS 更接近轨迹组织与读取约定，不能把它们和所有文件后缀当成同一层、互斥的分类。比如 LeRobot v3 使用 Parquet、视频和元数据共同描述数据，RLDS 强调 episode 和 step 的结构。[2][3]

还要看数据整理到了哪一步：是原始记录、已清洗标注的轨迹，还是已经给某个训练配方准备好的输入。这些层级和文件格式分开登记。平台后面再用任务、本体、模态、动作、处理阶段和来源版本筛选候选；标签相关并不等于能够直接训练。具体怎样下载、导入和配置，在后半部分展开。[5]


参考出处：
[1] DROID 数据组织说明：https://github.com/droid-dataset/droid/blob/main/docs/the-droid-dataset.md。版本/性质：2026-10-26 查阅快照，非固定提交。
[2] LeRobotDataset v3：https://huggingface.co/docs/lerobot/lerobot-dataset-v3。版本/性质：2026-10-26 查阅快照，非固定提交。
[3] RLDS 数据结构：https://github.com/google-research/rlds。版本/性质：2026-10-26 查阅快照，非固定提交。
[4] rosbag2：https://github.com/ros2/rosbag2/tree/rolling。版本/性质：2026-10-26 查阅快照，非固定提交。
[5] 外部数据资产库设计：../../product/07_外部数据资产库与使用流程.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- LeRobot/RLDS 与 HDF5/Zarr/rosbag 不组成同层互斥分类。
- 整理层级与平台分类字段是本项目设计。
- 本页只做初步认识，不据格式判断跨本体兼容。

## 第 6 页 数据采购：甲方怎样提需求

把“买一些搬箱数据”变成可以逐项回答和验收的需求

### 投影文字

- 先固定任务、目标本体与训练配方
- 数量、覆盖、交付层级和责任一起约定
- 已有数据看样本，委托采集先试采

### 图示数据

```json
{
  "type": "requirements_table",
  "headers": [
    "需求",
    "甲方写清什么"
  ],
  "rows": [
    [
      "任务与设备",
      "取箱、负载移动、放置；本体、手型、相机、控制范围"
    ],
    [
      "训练输入输出",
      "固定配方；观察与动作含义、时间要求"
    ],
    [
      "覆盖与数量",
      "物体/场景变化；有效回合、时长和成功/失败分布"
    ],
    [
      "交付与责任",
      "原始包、清单/schema、必要标定、转换与整改责任"
    ],
    [
      "使用条件",
      "样本试用、允许训练/转换及数据与模型产物用途"
    ]
  ],
  "routes": [
    [
      "已有数据",
      "先拿清单与样本，对照缺口"
    ],
    [
      "委托新采",
      "先试采，确认规格后分批交付"
    ]
  ]
}
```

### 演讲稿与参考出处

采购时先固定任务和目标本体，再讨论买什么。以搬箱为例，要说清需要取箱、抱持、负载移动和放置中的哪些阶段，并说明手型、相机、状态和动作怎样定义。数据说明框架和 Dataset Cards 提醒我们记录组成、采集方法、缺失与用途，但机器人专属需求仍要由本项目补全。[1][2][3]

数量不能只看文件大小。我们要一起看不重复的有效回合、时长、物体和场景覆盖，也要记录成功、失败和中止的分布。重复增强得到的数据量与原创示范量应分开说明。[3]

如果供应商已经有数据，先要清单和代表样本，对照缺口。如果需要委托新采，先试采，修订规格后再分批交付。交付哪些原始包、说明与标定，谁负责转换和整改，数据及模型产物允许怎样使用，也应一起明确。这张表是项目的工程需求单，具体数量和门槛需要双方结合任务约定。[3]


参考出处：
[1] Datasheets for Datasets：https://arxiv.org/abs/1803.09010v8。版本/性质：v8，2021；数据说明框架。
[2] Hugging Face Dataset Cards：https://huggingface.co/docs/hub/datasets-cards。版本/性质：2026-10-26 查阅快照，非固定提交。
[3] 任务驱动的选型与采购验收：../../product/09_任务驱动的数据选型与采购验收.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- 这是本项目工程采购建议，不是厂商统一标准。
- 没有未经实验支持的最低回合数、时长或成功率。
- 使用条件作为待约定需求，未提供具体合同法律意见。

## 第 7 页 数据采购：用样本验证适配性

把“可以用”落实为可复查的样本、映射和评价结果

### 投影文字

- 选主要场景样本，并加入随机样本
- 用目标训练器实际加载，按用途开展试训与评价
- 读取、训练运行和任务效果分别记录

### 图示数据

```json
{
  "type": "validation_timeline",
  "stages": [
    "拿清单与说明",
    "分层并随机选样本",
    "预览与质量检查",
    "执行必要转换",
    "目标读取与试训",
    "独立任务评价"
  ],
  "verdicts": [
    [
      "直接满足",
      "样本与目标要求一致"
    ],
    [
      "明确规则可转换",
      "保存映射与可验证产物"
    ],
    [
      "需要额外材料/适配",
      "补字段、标定或本体对应"
    ],
    [
      "需要补采/专项研究",
      "缺少任务阶段或关键动作"
    ]
  ],
  "evidenceLevels": [
    "读取通过",
    "训练运行",
    "任务效果"
  ]
}
```

### 演讲稿与参考出处

供应商说能用，或者转换一下就能用，我们要把这句话变成可以复查的证据。先拿清单、schema、来源说明和已知缺项，按主要任务与场景分层选择样本，同时加入随机样本，避免只看几段成功视频。[3]

然后预览图像、状态和动作，检查时间关系，按明确映射执行必要转换，再用我们真正采用的读取器和训练配置加载。转换脚本只能处理它已有规则覆盖的字段，无法凭空产生缺失信号。[1][2]

例如，已知单位换算或字段重排可以做成重复执行的模板；缺少负载移动指令、关键视角或本体对应关系，就需要补材料、补采或者单独研究。最后记录直接满足、规则可转换、需要额外适配、需要补采四种结论，以及各自的责任和证据。读取通过、小规模训练能运行，与在独立条件下完成任务是三种不同结论，采购范围应据此确认，后续批次再沿用约定的检查规则。[3]


参考出处：
[1] LeRobotDataset v3 读取组织：https://huggingface.co/docs/lerobot/lerobot-dataset-v3。版本/性质：2026-10-26 查阅快照，非固定提交。
[2] Unitree 固定版转换器：https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/convert_unitree_json_to_lerobot.py。版本/性质：41c2805742de879ddab2d8d6beaeaf215f876395。
[3] 样本验证与采购验收方案：../../product/09_任务驱动的数据选型与采购验收.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- 样本验证结果不等于已完成整库验收。
- 任务效果评价需要与采购目标匹配的试用数据和独立环境。
- 四类判定和抽样方案为项目建议，样本规模与效果门槛需约定。

## 第 8 页 数据质量检查

既检查文件能否读取，也检查信号含义与任务过程

### 投影文字

- 文件、数值、语义、时间和任务层面都要检查
- 名义采样频率不能证明严格同步
- 按训练用途保留、切段或排除回合

### 图示数据

```json
{
  "type": "quality_matrix",
  "headers": [
    "检查层面",
    "主要问题",
    "处理与证据"
  ],
  "rows": [
    [
      "完整性",
      "缺图、损坏、长度不一致、NaN",
      "逐回合检查，保留错误清单"
    ],
    [
      "信号语义",
      "关节顺序、单位、动作含义不明",
      "核对 schema 与本体配置"
    ],
    [
      "时间关系",
      "丢帧、旧画面、图像与动作错位",
      "检查采集时间/同步证据"
    ],
    [
      "任务过程",
      "掉箱、抓偏、中止、阶段缺失",
      "预览并标注，按用途切段或筛选"
    ]
  ],
  "decisions": [
    "保留",
    "切段/补标注",
    "排除或补采"
  ],
  "displayNote": "质量规则按任务与本体配置，检查结果随数据一起保存。"
}
```

### 演讲稿与参考出处

拿到数据后，第一层检查是它能不能完整读出来：图像有没有缺失、数值有没有 NaN、同一回合的各路长度是否一致。官方记录器把图片路径、状态和动作写入记录，转换器按这些字段读取，因此坏文件和错误引用会直接影响后续处理。[1][2]

第二层是含义和时间。相同长度的向量，关节顺序、单位或目标动作解释也可能不同，要按具体本体配置逐项核对。看到三十赫兹的声明，不能直接推断图像与关节严格同步；要看真实采集时间、旧帧和丢帧等可用证据，证据缺失就明确记录。[2][3]

第三层才是任务过程：是否抓稳、有没有掉箱、在哪一步中止。处理方式要结合训练用途，失败数据可能用于恢复行为或其他学习目标，不能一律静默删除。工作台应输出按回合的问题清单，并保留人工确认、切段、补标注或排除的记录。这些细项是结合源码提出的工程建议，不是官方统一质检标准。[4]


参考出处：
[1] 宇树回合记录器：https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/utils/episode_writer.py。版本/性质：817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b。
[2] Unitree 转换器与特征读取：https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/convert_unitree_json_to_lerobot.py。版本/性质：41c2805742de879ddab2d8d6beaeaf215f876395。
[3] G1 Dex3 特征与关节顺序：https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/constants.py。版本/性质：41c2805742de879ddab2d8d6beaeaf215f876395。
[4] 本项目质量检查建议：../../03_数据质检转换与训练.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- 没有声称现有本地原型已实现完整时间同步与任务成功判定。
- 固定转换器不会自动修复质量与语义问题。
- 关节阈值和时间容差按任务与设备验证，不能用统一常数替代。

## 第 9 页 数据增强

增加变化之前，先确认原来的动作标签仍然有效

### 投影文字

- 增强是按需步骤，可发生在训练时
- 改变场景或动力学后要重新验证标签和动作
- 同源增强样本不跨训练、验证和测试集

### 图示数据

```json
{
  "type": "augmentation_comparison",
  "columns": [
    {
      "title": "视觉变化",
      "examples": [
        "亮度、对比度、色彩小范围调整",
        "仿真回放后改变光照并重采图像"
      ],
      "condition": "任务和动作含义保持有效"
    },
    {
      "title": "场景与动力学变化",
      "examples": [
        "物体位置、重量、摩擦变化",
        "相机位置或机器人几何变化"
      ],
      "condition": "重新验证轨迹、坐标与任务结果"
    }
  ],
  "splitRule": "同一原创示范及其增强变体，留在同一数据划分。",
  "timing": "可在训练时变换，也可通过仿真重渲染生成新视觉数据。"
}
```

### 演讲稿与参考出处

增强希望增加训练覆盖的变化，但先要确认动作标签仍然成立。LeRobot 的图像变换可以在训练时调整亮度、对比度和色彩，原始数据保持不变，因此增强不一定是一轮固定的离线文件转换。[1]

另一种方式是仿真回放。宇树仿真仓库提供回放并重新采集图像的路径，可以调整光照和相机参数来生成视觉变化。这里的前提是对应场景能够正确重建，参数也经过小规模调试。[2]

如果改变的是箱子重量、摩擦、位置或机器人几何，原来那段动作未必还能成功；移动相机也要核对新的观察是否仍与动作、标定和坐标约定一致，不能只换画面。我们还要把一段原创示范和它的增强变体放在同一个训练、验证或测试划分中，避免高度相似内容泄漏到评价集。具体允许哪些增强，是本项目按任务验证的配置，而不是把所有变化都当成免费有效数据。[3]


参考出处：
[1] LeRobot 训练时图像变换：https://huggingface.co/docs/lerobot/lerobot-dataset-v3。版本/性质：2026-10-26 查阅快照，非固定提交。
[2] 宇树仿真回放与数据增强：https://github.com/unitreerobotics/unitree_sim_isaaclab/blob/e30c25b1dffdf92ada1d6c8c1fe9a47bdde0fecc/README.md。版本/性质：e30c25b1dffdf92ada1d6c8c1fe9a47bdde0fecc，§2.4.3 及后续增强说明。
[3] 本项目数据处理与划分建议：../../03_数据质检转换与训练.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- 不声称视觉增强能补齐缺失的行走控制、传感信号或任务阶段。
- 仿真重渲染需匹配场景与轨迹条件。
- 划分隔离是本项目实验设计建议，未声称为某仓库自动保证。

## 第 10 页 数据转换与训练输入

官方脚本完成指定字段的整理与打包，训练兼容仍要逐项核对

### 投影文字

- 原始 JSON 与图片，整理为数值、视觉和元数据
- robot-type 决定关节顺序、动作维度与相机映射
- 格式打包不会自动修复语义、单位、同步或跨本体差异

### 图示数据

```json
{
  "type": "conversion_mapping",
  "before": {
    "label": "原始回合",
    "root": "raw/task/episode/",
    "files": [
      "data.json",
      "colors/*.jpg"
    ],
    "fields": [
      "states / actions：双臂与双手 qpos",
      "colors：图像相对路径",
      "text.goal：任务文本"
    ]
  },
  "after": {
    "label": "LeRobot 组织",
    "files": [
      "Parquet：数值、时间与索引",
      "视频/图像：相机观察",
      "meta：schema、任务和回合信息"
    ],
    "fields": [
      "observation.state：28 维",
      "action：28 维",
      "observation.images.* / task"
    ]
  },
  "mappings": [
    [
      "states.*.qpos",
      "observation.state"
    ],
    [
      "actions.*.qpos",
      "action"
    ],
    [
      "color_0…3",
      "指定相机 key"
    ],
    [
      "text.goal",
      "task"
    ]
  ],
  "parameters": [
    [
      "--raw-dir",
      "含 task 子目录的原始根目录"
    ],
    [
      "--repo-id",
      "数据集标识"
    ],
    [
      "--robot-type",
      "Unitree_G1_Dex3"
    ],
    [
      "--mode",
      "video / image"
    ],
    [
      "--push-to-hub",
      "默认 false，显式启用才上传"
    ]
  ],
  "fixedAssumptions": [
    "固定配置拼接 28 维双臂/双手，不含腿部与腰部",
    "源码设定 fps=30、480×640×3，未自动重采样/对齐"
  ],
  "displayNote": "版本配套 + 样本转换 + 目标读取器验收，才算完成这一步。",
  "advancedParameters": [
    [
      "--dataset-config.use-videos",
      "true；须与mode配套验证"
    ],
    [
      "--dataset-config.tolerance-s",
      "0.0001；不是物理同步修复"
    ],
    [
      "--dataset-config.image-writer-processes",
      "默认10，本机先设1"
    ],
    [
      "--dataset-config.image-writer-threads",
      "默认5，本机先设1"
    ],
    [
      "--dataset-config.video-backend",
      "默认None，按环境验证"
    ]
  ]
}
```

### 演讲稿与参考出处

以这份固定版本的官方脚本为例，输入按 raw、task、episode 两层子目录扫描，每个回合包含 data.json 和图片。它按 robot-type 配置读取双臂、双手的 qpos，分别拼接为状态与目标动作，映射图像 key，并把 text.goal 作为任务文本写入目标数据集。[1][2]

G1 Dex3 配置是双臂十四维加双手十四维，共二十八维，并没有自动包含腿部和腰部。相机配置把 color_0 到 color_3 对应到头部左右与两只腕部视角。LeRobot 再把数值、视觉和元数据组织成训练读取器能够加载的样本，具体目录布局要与所用数据版本一致。[2][3]

最关键的参数是原始根目录 raw-dir、数据集标识 repo-id、设备配置 robot-type，以及 video 或 image 模式；上传默认关闭。写图进程和线程也能配置。源码同时固定了三十赫兹和图像尺寸，不会自动重采样、校准单位、修复时间对齐，也不会凭空补出行走指令。使用前需要版本配套，用副本转换代表样本，再由目标读取器验收。[1][4]

操作备查：固定脚本会删除相同 repo-id 对应的既有输出目录，因此应采用新的输出标识/独立缓存并保留原始数据。参数拼写由固定源码抽取的 tyro 帮助核过，但本项目尚未在完整上游依赖环境执行官方转换。该固定源码未见 v3 文档要求的 finalize() 调用；必须在锁定依赖版本的样本运行中确认写入完成和可读取性，不能把这份示例脚本当成所有版本的直接运行保证。[1][3][4]


参数备查（供演后查阅，不必逐条口述）：
必填 --raw-dir、--repo-id、--robot-type。可选 --push-to-hub 默认 false；--mode 默认 video。DatasetConfig 的 --dataset-config.use-videos 默认 true；--dataset-config.tolerance-s 默认 0.0001；--dataset-config.image-writer-processes 默认 10；--dataset-config.image-writer-threads 默认 5；--dataset-config.video-backend 默认 None。本机试样建议先将写图进程和线程各设为 1。该版本没有 --fps、--root 或自动运动重定向参数。参数拼写由 evidence/converter_signature_help.txt 的签名抽取帮助核验，正式环境仍须执行上游 --help 并试样确认。[1][4]

参考出处：
[1] Unitree JSON → LeRobot 转换器：https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/convert_unitree_json_to_lerobot.py。版本/性质：41c2805742de879ddab2d8d6beaeaf215f876395。
[2] Unitree G1 Dex3 字段配置：https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/constants.py。版本/性质：41c2805742de879ddab2d8d6beaeaf215f876395。
[3] LeRobotDataset v3 保存与读取：https://huggingface.co/docs/lerobot/lerobot-dataset-v3。版本/性质：2026-10-26 查阅快照，非固定提交。
[4] 转换参数与执行前核对：../../03_数据质检转换与训练.md。版本/性质：本项目设计/工程建议，2026-10-26。

### 事实边界

- 未声称已完成官方全量转换或直接适用于所有策略。
- 28 维动作不等于 G1 全身 43 DoF 的完整控制。
- 同 repo-id 既有输出删除、固定 fps/图像尺寸及依赖版本配套需在实际执行前处理。
- 固定源码没有自动同步、单位修复或运动学迁移功能。

## 第 11 页 策略模型与数据适配

同一种数据组织可被多种实现读取，模型要求仍由具体配方决定

### 投影文字

- 文件可读取之后，仍要匹配观察、动作、语言与时间窗口
- 原版 7 维动作示例不能直接接 G1 的 28 维关节目标
- 明确规则可模板化，缺失信号和跨本体迁移需要额外工作

### 图示数据

```json
{
  "type": "policy_compatibility_table",
  "headers": [
    "代表实现",
    "所查读取组织",
    "额外准备"
  ],
  "rows": [
    [
      "ACT",
      "LeRobot；原版另有 HDF5",
      "相机/状态/动作配置、chunk、归一化"
    ],
    [
      "Diffusion Policy",
      "LeRobot；原版常用 Zarr",
      "观察/预测窗口、动作表达、归一化"
    ],
    [
      "原版 OpenVLA",
      "默认 RLDS",
      "语言、动作标准化、输出空间与读取映射"
    ],
    [
      "π₀ / π₀.₅（openpi）",
      "自定义微调示例用 LeRobot",
      "字段重组、本体变换、统计量与时间窗"
    ],
    [
      "在线 PPO",
      "环境交互 rollout",
      "可交互环境、奖励、重置与终止条件"
    ]
  ],
  "automatic": [
    "已知 schema/单位/字段映射",
    "按回合切窗、统计量、格式打包"
  ],
  "needsMore": [
    "缺失信号与任务覆盖",
    "跨本体动作迁移、训练输出空间不匹配"
  ],
  "displayNote": "学习方法、策略架构与 VLA 路线并非互斥分类；表格比较具体实现。"
}
```

### 演讲稿与参考出处

转换后能否用于很多模型，答案取决于具体实现与训练配方。ACT 和 Diffusion Policy 的 LeRobot 实现都能使用相应的 LeRobot 数据组织，但它们对输入特征、动作预测窗口和执行方式的配置不同。原版 ACT 另有 HDF5 数据路径，原版 Diffusion Policy 常用 Zarr，因此不能给一个模型名称规定唯一文件格式。[1][2][6][7]

原版 OpenVLA 默认使用 RLDS，示例输出七维动作，还要有有效任务语言和匹配的动作标准化。我们的二十八维 G1 关节目标，不能靠改字段名就套入这个七维示例。openpi 的自定义微调示例可以使用 LeRobot，但还需配置字段重组、本体输入输出变换、归一化统计量和时间窗口；已有 LeRobot 只解决一部分存储读取条件。[3][4]

在线 PPO 则需要当前策略与环境交互，收集观察、动作、奖励和终止等经验。普通示范文件转换并不会补齐奖励、重置和在线环境。这里的行为克隆、ACT/扩散架构、VLA 路线和 PPO 算法不处在同一分类层级，我们比较的是代表实现。[5]

工作台可以把已确认的字段映射、切窗、打包和统计量做成固定配方，缺失信号、动作空间不匹配或跨本体迁移则要明确列为缺口。接下来再看，一份示范具体怎样参与训练。


参考出处：
[1] LeRobot ACT 配置：https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/policies/act/configuration_act.py。版本/性质：a5b29d430105f5235eb05bbf2db5a0d747a869d6。
[2] LeRobot Diffusion 配置：https://github.com/huggingface/lerobot/blob/a5b29d430105f5235eb05bbf2db5a0d747a869d6/src/lerobot/policies/diffusion/configuration_diffusion.py。版本/性质：a5b29d430105f5235eb05bbf2db5a0d747a869d6。
[3] 原版 OpenVLA：https://github.com/openvla/openvla。版本/性质：2026-10-26 查阅快照，非固定提交。
[4] openpi 自定义数据与训练：https://github.com/Physical-Intelligence/openpi。版本/性质：2026-10-26 查阅快照，非固定提交。
[5] PPO 维护者文档：https://stable-baselines3.readthedocs.io/en/master/modules/ppo.html。版本/性质：2026-10-26 查阅快照，非固定提交。
[6] 原版 ACT：https://github.com/tonyzhaozh/act。版本/性质：2026-10-26 查阅快照，非固定提交。
[7] 原版 Diffusion Policy：https://github.com/real-stanford/diffusion_policy。版本/性质：2026-10-26 查阅快照，非固定提交。

### 事实边界

- 表内只描述所查参考实现；不涵盖同名策略所有变体。
- OpenVLA 的限制限定原版七维示例，OFT 等变体需另查。
- 未声称 G1 的 openpi/VLA 训练或部署已验证。
- 在线 PPO 与离线示范学习的条件不同，不能靠存储格式转换等同。

