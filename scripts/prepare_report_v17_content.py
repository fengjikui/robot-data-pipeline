"""Rebuild the agreed four-part report, keeping the scheme pending discussion."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
base = json.loads((ROOT / 'docs/report/parts/report_revision_v16.json').read_text())
old = {p['contentPage']: p for p in base['pages']}


def refs(*keys):
    result = []
    for key in keys:
        for item in old[key]['sources']:
            if item['url'] not in {r['url'] for r in result}:
                result.append(item)
    return result


pages = [
    dict(contentPage='agenda', title='具身智能数据管线方案',
         subtitle='以 G1 搬箱任务为例', talkSeconds=40, sources=[],
         shortScript='报告按四部分展开。先用G1搬箱任务介绍真机采集，再说明数据怎样进入训练、仿真和部署，以及有哪些增强方法。接着用真实案例说明外部数据的格式、获取和采购。最后重点讨论我们的数据管线要解决哪些连续交接问题，以及分阶段怎样实现。',
         speakerNotes='任务背景为桌A取箱、抱持移动、桌B放置。当前参考本体为G1 EDU高自由度配置，准确手型、相机和控制器仍以到货清单为准。四部分分别为任务与真机采集、数据处理训练与部署、外部数据与采购、我们的方案与实施。'),
    dict(contentPage='capture', title='任务与真机采集',
         subtitle='桌 A 取箱、抱持移动、桌 B 放置', talkSeconds=130,
         sources=refs('capture_compact'),
         shortScript='真机采集先看这张物理关系图。头显在Safari中提供头手追踪和第一视角。Host运行遥操作主程序，完成IK、动作目标和回合记录。机内PC2运行相机服务，负责图像。机器人交换网络同时连接相机计算和运控，Host通过网线进入这个网络。实际关节反馈由Host直接订阅，不必先经过PC2相机服务汇总。下方按依赖给出每次采集的顺序，首次安装环境和证书另行准备。最后保存的state是实际反馈，action是记录的控制目标。',
         speakerNotes=old['capture_compact']['speakerNotes'].replace('这页承接设备结构和逻辑数据流，回答“实际在哪台设备启动哪个程序”。主讲时用约半分钟概括即可，命令和详细条件供会后查阅。', '设备图直接标注各设备的程序和职责，下方给出每次采集的启动依赖。')
         + '\n\n搬箱范围：标准28维臂手采集不包含腿部与腰部控制意图。若完成携带移动，需要另行确定腰部和移动目标的数据接口，以及与之匹配的行走/WBC控制器。G1外形沿用已确认的说明插图，参考官方外观生成，非实机照片；生成记录随资料包保留。机内方框表示计算单元与运控功能关系，不表示机壳内精确安装坐标。设备位置与数据通路沿用原设备分工和数据流页的同一组锚点。'),
    dict(contentPage='processing', title='数据处理、训练与部署',
         subtitle='原始回合、训练输入与闭环评价', talkSeconds=150,
         sources=refs('data_compact', 'tools_compact'),
         shortScript='原始回合是JSON和图像，保存任务文字、实际state和控制目标action。转换器把已有字段整理为LeRobot的Parquet、视频和meta。左右两份是独立的官方样例，用来说明格式，不能看成已经完成了这段回合的实际转换。质量检查覆盖文件、数值、时间关系和任务过程。已有LeRobot训练脚本支持多种策略，指定数据、策略和训练参数即可进入对应配方。训练之后在匹配环境做闭环仿真，再通过本体运行接口部署。图像回放只能用于检查数据，闭环评价才说明模型在环境反馈下能否完成任务。',
         speakerNotes='''原始文件来自宇树固定版本可视化脚本提供的rerun_testdata.zip。本地episode_0006共167条记录、334张640×480 JPG，JSON和图像原始字节均保留。图中节选由真实文件值排版，没有编造数值。右侧为独立的官方ToastedBread LeRobot v3样例，不是左侧回合的实际转换结果。

state与action：states.*.qpos是记录时读取的实际关节反馈。actions.*.qpos是记录器保存的关节控制目标，不等于实际已经执行到的位置，也不等于完整的最终电机报文。标准Unitree_G1_Dex3配方按双臂双手各7维整理为28维。原始测试样本的joint_names只填left_arm的7个名称，但全部167条记录中四个臂/手组的state和action均各有7个数，body为null。元信息缺名不表示没有记录，正式使用前需核对名称顺序、单位和手型。

转换命令（在固定宇树LeRobot仓库根目录）：
```bash
python unitree_lerobot/utils/convert_unitree_json_to_lerobot.py \\
  --raw-dir datasets/raw \\
  --repo-id local/g1_box_v1 \\
  --robot-type Unitree_G1_Dex3
```
脚本的raw-dir选择源目录，repo-id确定数据集标识和输出路径，robot-type选择已有字段映射。标准转换器固定30fps；它不会补造没有记录的腰腿动作。输出位于HF_LEROBOT_HOME/repo-id，脚本对已存在的同名输出有删除重建逻辑，正式运行应先使用独立的新输出标识并保存原件。转换前后都需要检查时间、维数、关节顺序、单位、视频可读性和回合边界。

质量检查：文件存在、图像解码、有限数值、维度与单位、时间关系分别检查。任务阶段、成功与失败通过回合预览核实，结构规则不能单独证明任务成功。问题回合可保留、补标或补采。增强配方在下一页单独展开，可作用于训练读取或产生派生回合，具体位置随方法决定。

训练命令示例：
```bash
lerobot-train --dataset.repo_id=local/g1_box_v1 \\
  --policy.type=act --batch_size=8 --steps=10000
```
宇树固定LeRobot子模块a5b29d4包含ACT、Diffusion、pi0、pi05、groot入口。这里暂按现有训练脚本已经完成这些策略集成讨论，训练时选择对应policy.type、预训练权重、相机键、状态动作语义、时间窗、归一化、batch和steps等配置。数据读取正确且动作定义匹配时，不必为每种策略重新发明一个转换器。ACT动作chunk、Diffusion时间窗、VLA任务文本/预训练权重仍由各自配方决定。上面的batch和steps只是命令示例，不是已验证的搬箱训练配方。

评估与部署：宇树示例入口为unitree_lerobot/eval_robot/eval_g1_sim.py与eval_g1.py。需要对应机器人、本体控制与相机配置。仿真评价必须在环境当前反馈下执行模型，记录完整取箱、携带、放置及总成功率、失败分类和视频。部署还需匹配模型、统计量、动作解释和控制器。Arena采用自己的GR00T policy server及policy_runner.py等路线，不能与标准Unitree28维样例混用参数。

移动搬箱：标准28维记录仅包含臂手。连续取箱、行走、放置还需确定移动目标、腰部信号与行走/WBC接口。Arena公开配方从43维关节记录取31维上身状态，并使用31维关节目标、1维机身高度和3维导航组成35维高层动作，腿部由匹配WBC执行。相同G1名称并不使28维数据自动满足这份配方。

本地查看：resources/data_cards.html#raw和#lerobot提供大图节选，原始JSON/图像和LeRobot数值/元信息的离线入口分别在resources/raw_episode.html与resources/converted_episode.html。'''),
    dict(contentPage='augmentation', title='数据增强的方法与产出',
         subtitle='图像变化、仿真执行、示范扩增与生成式方法', talkSeconds=150,
         sources=refs('augmentation_compact'),
         shortScript=old['augmentation_compact']['shortScript'],
         speakerNotes=old['augmentation_compact']['speakerNotes'].split('## 讲稿中的事实与实现层级', 1)[-1]),
    dict(contentPage='external', title='外部数据与采购',
         subtitle='真实案例、获取范围与样本验收', talkSeconds=110,
         sources=refs('external_compact'),
         shortScript=old['external_compact']['shortScript'],
         speakerNotes=old['external_compact']['speakerNotes']),
]
config = dict(revision='v17', date='2026-10-27', action='create',
              status='重新生成的前半部分，核心方案待讨论', slideCount=5,
              eventualReportMaxSlides=8, reservedFinalPages=[6, 7, 8],
              scope='目录1页、采集1页、处理训练部署2页、外部数据采购1页；方案实施3页待讨论',
              backendCodeChanged=False, pages=pages)
(ROOT / 'docs/report/parts/report_revision_v17.json').write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
