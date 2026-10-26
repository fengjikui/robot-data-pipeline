# 转换后的 LeRobot 公开数据查看

这部分移至报告正文第7页“数据转换与训练输入”。它是独立的官方数据示例，不能描述成前述原始测试包的实际转换结果。



右侧三个链接分别打开随包携带的 LeRobot 数值节选浏览页、官方在线 Viewer 与本地 meta/info.json。完整官方目录和固定版本链接保留在来源与离线浏览页，离线文件不冒充整套数据集。[4] 这是独立的官方 LeRobot 公开样本，不是把前述 rerun_testdata 的 episode_0006 转换后的结果。本项目没有据此宣称已完成官方上游转换。

该公开数据的固定提交为 02cb29161f5adb2981a072aa35b408d82a556d07。data/ 下是 Parquet，videos/ 下保存四路相机视频，meta/info.json 提供字段形状、关节名称、fps 和路径模板，meta/tasks.parquet 提供任务文本。meta/info.json 是元数据，不能冒充原始采集的 data.json。

可在 Viewer 第一行看到 episode_index=0、frame_index=0、task_index=0。observation.state 与 action 各28维，meta/info.json 第0维名称为 kLeftShoulderPitch；相应真实值分别为 -0.0662078857421875 与 -0.0746285542845726。task_index=0 对应 meta/tasks.parquet 中的 toasted bread。图像通过相机视频与回合/时间索引关联，不能只按一个视频文件等于一个回合来猜测。

这些链接用于了解整理后的训练输入。原始样本的 left_hand/right_hand 和当前参考转换器的 left_ee/right_ee 等差异，需要按实际版本配置处理；跨来源文件名相似也不代表动作语义、单位、顺序与相机配置自动一致。

[4] 官方 LeRobot 公开数据、固定元数据和在线样本
https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/tree/02cb29161f5adb2981a072aa35b408d82a556d07
https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/blob/02cb29161f5adb2981a072aa35b408d82a556d07/meta/info.json
https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/viewer

## 本地备查

- [从真实 Parquet 行提取的 JSON 展示导出](../../evidence/report_episode_example_2026-10-26/real_lerobot_row_display_export.json)
- [官方 meta/info.json 本地副本](../../evidence/report_episode_example_2026-10-26/official_info.json)

这些是已转换数据的展示副本，不能作为原始采集 data.json。
