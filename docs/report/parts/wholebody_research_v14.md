# 腰腿数据与连续搬箱：v14 专项核查

核查日期：2026-10-26。本文供报告正文、讲稿和后续采集设计使用。结论来自固定版本的官方源码和文档；未运行真机、Isaac Sim 或完整训练，因此不构成本项目移动搬箱验收。

## 建议直接补入的两页

### 页 A：当前 28 维数据，腰和腿在哪里？

**主结论：当前参考路线记录双臂与双手；机器人有 43 个自由度，不代表训练数据已经覆盖 43 维。**

建议版面：上方用身体示意区分“腿 12 + 腰 3 + 双臂 14 + 双手 14”；下方用三列展示采集、原始记录、导出，突出两个截断位置。

页面文字：

- **当前路线：G1_29 + Dex3 + 手部追踪**
  - 双臂 14 + 双手 14 → 标准转换配置导出 28 维 state / action。
  - 该采集分支的 `states.body`、`actions.body` 为空，腰腿没有进入这份训练数据。[1][2]
- **其他分支：可以出现身体状态与移动命令**
  - 部分“控制器追踪 + 夹爪/手”分支记录身体电机状态和 `vx / vy / yaw_rate`。
  - 状态与命令含义不同；移动速度命令不是腿关节目标角。[1][3]
- **转换仍需补齐**
  - 标准 `Unitree_G1_Dex3` 等配置只选臂和手，忽略 `body`。
  - 换训练策略不会自动补出腰腿；需要补记录，并增加对应的数据配方与执行接口。[2][4]

页脚来源：官方 `xr_teleoperate` 采集分支与 `unitree_lerobot` 的 G1 配置；详细链接放讲稿。

**讲稿建议：**

前面讨论的 28 维，是左右臂各 7 维、左右 Dex3 手各 7 维。按这套 G1_29 + 双 Dex3 的参考配置，身体还有 12 个腿部关节和 3 个腰部关节，总计 43 个自由度。但数据能训练什么，取决于实际记录了什么。当前固定版本的 Dex3 + hand 分支把 body 状态和 body 动作写为空，所以它是一份双臂、双手的操作数据，不是全身搬运数据。[1][2][3]

这里也不能简单说“官方程序完全没有记录身体的能力”。Dex1、外接 Brainco 等部分控制器分支会记录 `get_current_motor_q()` 的结果，同时记录摇杆给出的三维移动速度。对于 G1_29，这个函数遍历 35 个底层槽位，其中 0–28 对应 29 个身体关节，29–34 在这个枚举里标记为未使用；它不是已经整理干净的 29 维关节向量。不同手型、内接夹爪和固件还要核对具体槽位解释。[1][3]

另一个容易误解的地方是：这版原始 JSON 把身体动作仍放在 `actions.body.qpos` 名下，但实际内容是前后速度、左右速度、转向角速度；不能按名字把它解释成髋、膝或踝的角度目标。标准 G1 转换配方又没有读取 body，所以原始包里有这些字段，也不代表导出的 LeRobot 数据会保留下来。[1][2][4]

因此下一步不是补一个“腿部策略名称”。应先确定要学习哪一层动作，再让记录器、转换器和部署接口使用同一份定义。缺失的腰腿命令不能通过改标签、补零或切换 `--policy.type` 产生。

讲稿引用：

[1] [官方采集程序：body 各分支及写入字段](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/teleop_hand_and_arm.py#L373-L427)，固定提交 `817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b`；JSON 写入见同文件 L466–L514。

[2] [G1 Dex3 标准转换配置](https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/constants.py#L131-L176)，固定提交 `41c2805742de879ddab2d8d6beaeaf215f876395`。

[3] [G1_29 状态读取及关节枚举](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/robot_control/robot_arm.py#L217-L227)；同文件 L304–L349 是腿、腰、臂和未使用槽位枚举。

[4] [转换器 state/action 特征定义](https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/unitree_lerobot/utils/convert_unitree_json_to_lerobot.py#L218-L235)。

### 页 B：连续搬箱：先把操作策略与行走控制接起来

**主结论：第一阶段采用分层控制。学习抓放与携带，复用经过验证的行走控制；把两者协调起来并一起记录。**

建议版面：上方横向阶段轴“桌 A 抓取 → 携带 → 走到桌 B → 放置”；下方分层图：

```text
                 任务阶段 / 目标桌位 / 状态判断
                          │
               ┌──────────┴───────────┐
               │                      │
       操作策略：双腕 / 臂手目标     导航：机身速度目标
               │                      │
       上身控制 / IK（可含腰）     已验证的平衡与行走控制
               │                      │
              臂手                   髋 / 膝 / 踝
               └──────────┬───────────┘
                 图像、全身反馈、执行结果
```

页面文字：

- **当前 `--motion` 的作用**：让臂手遥操作与已有运控并行；手柄或 R3 提供行走输入。它不是“自动学习全身动作”开关。[5][6]
- **管线要补的内容**：同步记录全身反馈、实际下发的移动目标、操作阶段与导航目标；增加移动操作数据配方和协调执行模块。
- **已有官方参考：Isaac Lab G1 Locomanipulation**
  - 匹配的静态操作 HDF5 → 导航与操作轨迹生成。
  - 高层输出机身速度、双腕位姿和手指目标；上身 IK 与下身行走策略执行。[7][8][9]
- **任务落地仍需适配**：现成示例是 `SteeringWheel-Locomanipulation`；桌 A 到桌 B 双臂抱箱需另做箱体、抓持、载荷、场景和成功条件验证。

页脚来源：Unitree `--motion` 说明；Isaac Lab v2.3.0 G1 Locomanipulation 官方文档与源码。

**讲稿建议：**

完成“拿起、行走、放下”，并不要求首版模型直接预测每个髋膝关节角。可以让操作策略负责双臂双手，让导航或操作者给出机身移动速度，再由已有的平衡与行走控制生成腿部动作。中间还需要任务阶段控制，决定什么时候可以起步、携带时如何保持抓持、到位后什么时候允许放置。这是建议的首阶段工程路线，不代表当前工作台已经把这些模块联调完成。

宇树的 `--motion` 已经体现了并行控制的思路：手臂命令改发 `rt/arm_sdk`，同时读取 `rt/lowstate`；控制器模式下，摇杆通过 LocoClient 发送 `vx / vy / yaw_rate`。手部追踪模式可以由 R3 控制正常行走。但这不代表当前 Dex3 手追踪记录器保存了 R3 命令，也不代表现有臂手部署脚本已经具有导航、腰部协调和整段任务状态机。[5][6]

更完整的官方例子是 Isaac Lab v2.3.0 的 G1 Locomanipulation 数据生成。它读取匹配的静态操作示范，按抓取、抬起、导航、接近和放置等阶段生成轨迹。高层给出的是机身速度、双腕位姿和手指目标。源码中，上身的 Pink IK 可控制腰部关节；下身调用预训练 Agile 行走策略，最后才得到腿部关节位置目标。因此“模型动作里没有逐个腿关节角”和“机器人没有腿部控制”是两回事。[7][8][9]

这个例子能说明工具与架构已经有公开参考，也提供了数据生成入口；不能用它证明我们的双臂抱箱任务已经完成。现成任务名称是 SteeringWheel，迁到真实箱体时仍要处理双手接触、重量、摩擦、遮挡、桌高、携带姿态和放稳条件，再通过闭环评估确认效果。

讲稿引用：

[5] [Unitree `--motion` 官方说明](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/README.md#L236)，固定提交 `817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b`；内部 Dex1 与 motion 的限制见同 README L463。

[6] [行走命令产生位置](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/teleop_hand_and_arm.py#L348-L359)，以及 [手臂命令通道](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/robot_control/robot_arm.py#L97-L104)。

[7] [Isaac Lab v2.3.0 官方 G1 Locomanipulation 教程](https://isaac-sim.github.io/IsaacLab/v2.3.0/source/overview/imitation-learning/teleop_imitation.html#demo-2-data-generation-and-policy-training-for-humanoid-robot-locomanipulation-with-unitree-g1)。

[8] [生成脚本实际动作组装](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/scripts/imitation_learning/locomanipulation_sdg/generate_data.py#L714-L722)；[G1 动作向量定义](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_mimic/isaaclab_mimic/locomanipulation_sdg/envs/g1_locomanipulation_sdg_env.py#L180-L233)。

[9] [上身 IK 包含腰部](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_tasks/isaaclab_tasks/manager_based/locomanipulation/pick_place/configs/pink_controller_cfg.py#L79-L89)；[下身 Agile 预训练策略配置](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_tasks/isaaclab_tasks/manager_based/locomanipulation/pick_place/locomanipulation_g1_env_cfg.py#L88-L104)；[实际下身动作计算与执行](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_tasks/isaaclab_tasks/manager_based/locomanipulation/pick_place/mdp/actions.py#L93-L125)。

## 逐项事实与边界

| 问题 | 核查结果 | 对管线的影响 |
|---|---|---|
| 43 自由度为什么导出只有 28 维？ | 参考硬件为身体 29 + 双手 14；当前 Dex3/hand 记录 body 空，标准配置仅选双臂双手。 | UI 需展示“实际覆盖的动作部位”，不能只展示本体总 DOF。 |
| 现有采集是否绝对不支持腰腿状态？ | 并非如此：Dex1/Dex1_internal 的 controller 分支及 Brainco/controller 分支会调用全电机状态读取；但当前 Dex3/hand 不这样做。 | 配方必须包含本体、末端、输入模式与记录版本，不能只看机器人名字。 |
| body 状态有多少维？ | G1_29 的该读取函数返回 35 个底层槽位；0–28 为身体关节，29–34 在该枚举中未使用。内部夹爪等具体模式还需结合设备解释。 | 保留 raw slot 信息，导出时按已核验有效索引和名称选取，不写“35 DOF”。 |
| body 动作是什么？ | 对上述 controller 记录分支，是三维摇杆移动速度，虽然字段名仍为 qpos。记录分支本身未检查 `args.motion`。 | 还需记录控制模式与命令实际发送状态；没有 motion 时，记录摇杆值不能证明行走命令已执行。 |
| 开 motion 是否就能记录完整搬运？ | 不能。Dex3/hand 中 body 仍空；R3 移动输入也未在此分支记录。 | 要补接移动命令采集。仅有腿部反馈，不能还原当时准确下发的高层命令。 |
| 标准转换会保留 body 吗？ | G1 Dex3/Dex1/Brainco/Inspire 标准配置均只取臂手。 | 移动操作需新增转换配方；不得假定通用输出已包含全身。 |
| 选带 Waist 的 robot_type 即可？ | 现有 MoveibleLift/Lift 配置读取 `waist.qpos`、`torso.height/qvel`、`chassis.qvel` 等特定输入；不是双足全身导出开关。 | 不能把另一类硬件输入配方当作 G1 双足腿数据映射。 |
| 现有转换器能否随意拼接速度动作？ | 固定版本对 observation.state/action 都使用 len(motors)；身体观测和机身速度目标可能维度、单位都不同。 | 新后端必须分别定义 observation/action 的 feature、维度、顺序和单位，必要时扩展导出器。 |
| motion 模式怎样控制腿？ | 上层发机身速度，底层已有运控生成腿动作；臂手命令走 arm_sdk。 | 导出高层速度动作并复用运控是一种可行设计；不必一开始直接学腿关节目标。 |
| 腰部怎么办？ | 当前 28 维策略无独立腰部动作；要通过已验证的姿态/全身控制接口或包含腰的 IK 规划解决。 | 不要臆造一个 LocoClient 腰关节控制参数，也不要默认普通双臂 IK 已包含腰。 |

补充源：`--motion` 仅支持官方描述的 Regular 模式；内部接线 Dex1 同时使用 motion 在固定 README 中明确为不支持。不能因代码里存在记录分支，就宣布某种硬件控制组合已获验证。

## 后续实现方案：确定学习层级，再定义数据

### 路线一：分层移动操作，建议首期推进

1. 操作层执行抓取、保持携带姿态与放置；输出可为臂手关节目标或双腕位姿加手部目标，必须匹配实际执行后端。
2. 导航层根据目标桌位、定位与障碍物提供机身速度命令；早期也可由操作者提供，先验证整条采集和控制链。
3. 通过厂商或已验证控制器完成站立、行走和平衡；上身控制与下身控制要协调载荷、姿态和控制权。
4. 任务阶段控制负责抓持确认、起步条件、到达判断、放置条件、失败与人工接管回流。先分段验收，再接成长序列。

建议记录：

| 信号 | 最小内容 | 用途 |
|---|---|---|
| 图像与时间 | 已用相机、帧时间、同步关系 | 保持视觉/状态/动作对应 |
| 实际关节 | 臂手状态；有效的腰腿 q，按需要补 dq | 重建全身实际状态、排查异常 |
| 高层操作目标 | 实际下发的臂手 q 或 EEF pose / 手指目标 | 操作模仿学习目标 |
| 高层移动目标 | vx、vy、yaw_rate；实际使用的姿态/高度目标 | 学习或复现导航与携带动作 |
| 控制上下文 | 模式、控制权、控制器和配置版本、目标是否发送成功 | 确认动作语义，处理接管和无效命令 |
| 机身状态 | IMU 姿态/角速度；可得的定位、速度估计 | 平衡、移动操作观测与诊断 |
| 任务上下文 | 桌位、阶段、物体/载荷、成功失败与接管 | 训练条件、筛选、评估 |

触觉、足端接触、力/力矩等字段在实际具备传感器或可靠估计时追加；未测量的内容不要填成“真实观测”。基座速度的单位应为 m/s，转向为 rad/s，关节 q 为 rad；坐标系、绝对/相对动作和目标时间必须写入契约。

### 路线二：直接学习全身或全身目标，作为后续独立模块

可选择学习全身关节目标、人体重定向目标、全身末端目标或 latent skill。这些方案不是同一种 action。需要匹配的全身遥操作/重定向或仿真轨迹生成、全身控制器、全身观测、训练后端和部署约束。

若目标是 G1_29 + Dex3 的逐关节控制，可从 29 个有效身体关节 + 14 个手部关节定义状态，另行明确动作是否同样是 43 维关节目标；若采用速度/末端/技能接口，动作维度可能完全不同。关节数相同也不证明可以直接执行，必须确认顺序、限位、动作定义和控制频率。

## Isaac Lab 已公开工具入口（备查，不作为本项目验收）

版本：Isaac Lab `v2.3.0`。该版本教程说明 Mimic 支持 Linux；示例的 `--device cpu` 是仿真计算设备选项，不能据此推断 Mac 或无 GPU 环境具备完整 Isaac Sim 功能。

入口脚本：`scripts/imitation_learning/locomanipulation_sdg/generate_data.py`。

示意命令（已按 argparse 核对参数，未实际执行；输入文件、阶段索引按自己的匹配示范填写）：

```bash
./isaaclab.sh -p scripts/imitation_learning/locomanipulation_sdg/generate_data.py \
  --task Isaac-G1-SteeringWheel-Locomanipulation \
  --dataset datasets/input_manipulation.hdf5 \
  --output_file datasets/output_locomanipulation.hdf5 \
  --lift_step 60 --navigate_step 130 --num_runs 1 \
  --enable_pinocchio --enable_cameras \
  --kit_args="--enable isaacsim.replicator.mobility_gen"
```

| 参数 | 实际含义 |
|---|---|
| `--dataset` | 与该环境匹配的静态操作 HDF5。不是任意原始 Unitree JSON。 |
| `--output_file` | 输出 HDF5；文档说明文字个别处写 `output_file_name`，源码实参是 output_file。 |
| `--lift_step` | 原示范中抓取已完成、可以进入抬起的步索引。 |
| `--navigate_step` | 原示范中抬起完成、可以导航的步索引。 |
| `--num_runs` | 生成轨迹数量；默认 1。 |
| `--demo` | 选择输入示范，默认 None。 |
| `--enable_pinocchio` | 在 AppLauncher 前导入 Pinocchio，供 IK 等模块使用。 |
| 其他 | 线速度/角速度增益、速度上限、到达距离/角度阈值、路径前视距离、放置随机化等。 |

源代码中，`generate_data.py` 调 `env.build_action_vector()` 后步进环境。G1 环境把双腕各 7 维 pose、双手各 7 维手指目标和 3 维机身速度写入 action，并补充一个固定髋高目标。下身 action term 的输入实际是 `[vx, vy, wz, hip_height]`，通过 Agile 策略产生腿关节目标；腰部包含在上身 Pink IK 的控制关节集合。高层训练目标与最终电机目标是两层数据，不能互相替代。

官方教程还给出了转换为 GR00T N1.5 所需 LeRobot 格式、再做微调的路线。它需要与该示例动作/观测定义匹配的转换与训练流程，不是直接调用 Unitree 的 28 维 JSON 转换器。

源码：

- [生成脚本参数](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/scripts/imitation_learning/locomanipulation_sdg/generate_data.py#L18-L108)。
- [生成器写入的目标、机身和路径等字段](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_mimic/isaaclab_mimic/locomanipulation_sdg/envs/locomanipulation_sdg_env.py#L17-L39)。
- [从输入 HDF5 读取静态操作字段](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_mimic/isaaclab_mimic/locomanipulation_sdg/envs/g1_locomanipulation_sdg_env.py#L154-L178)。
- [下身 action 维度与输入定义](https://github.com/isaac-sim/IsaacLab/blob/v2.3.0/source/isaaclab_tasks/isaaclab_tasks/manager_based/locomanipulation/pick_place/mdp/actions.py#L58-L61)。

## 其他全身遥操作参考：OpenWBT

OpenWBT 是银河通用与清华参与的公开全身遥操作项目；该仓库释放的目标硬件包含 Unitree G1。不能因软件作者来自银河通用，就将其解释为银河通用本体或 Galaxea 机器人方案。

固定提交 `a0154ca822815c8eca26f5174afa6268f8e3d465` 的 README 列出 G1 真机、MuJoCo/Isaac Sim 使用路线；H1 和 latent skill space 不应当成该版本已完成交付。其真机入口为 `python -m deploy.run_teleoperation_real`，带 `--config` 和 `--net`；另有 `--save_data`、`--save_data_dir`、`--save_image` 选项。它提供全身遥控候选工具，但本次没有核验其完整落盘 schema、时间同步与 LeRobot 导出，不能直接宣布可替换当前采集后端。

- [OpenWBT 固定版 README](https://github.com/GalaxyGeneralRobotics/OpenWBT/blob/a0154ca822815c8eca26f5174afa6268f8e3d465/README.md)。
- [真机入口与记录参数](https://github.com/GalaxyGeneralRobotics/OpenWBT/blob/a0154ca822815c8eca26f5174afa6268f8e3d465/deploy/run_teleoperation_real.py#L125-L134)。

## 不应在报告中作出的表述

- “43 自由度 G1 的这份数据就是 43 维”。
- “现有官方遥操作完全没有 body 记录”。实际随输入模式和手型分支变化。
- “body.qpos 两边都是同维度关节角”。动作侧实际可能是三维速度。
- “加 `--motion` 后就完成了全身数据采集与自主移动部署”。
- “换一个带 Waist 的 robot_type 即可恢复缺失腿部数据”。
- “同一份 28 维 LeRobot 数据换策略就能学会走到另一张桌”。
- “Isaac Lab 现成 G1 移动操作任务已经验证了我们的双臂抱箱”。

## 仅供后续代码审查的固定版本细节

`xr_teleoperate` 的主程序在双摇杆按下时调用 `loco_wrapper.Damp()`，但同提交的 `teleop/utils/motion_switcher.py` 中 wrapper 提供的是 `Enter_Damp_Mode()`，本次静态核查未发现同名 `Damp()` 包装方法。这是需要进一步确认/修复的接口不一致，不能在没有真机联调的情况下把该分支当成已验收的退出行为。主讲页面无需展开此实现细节。

[对应 wrapper 源码](https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/teleop/utils/motion_switcher.py)。
