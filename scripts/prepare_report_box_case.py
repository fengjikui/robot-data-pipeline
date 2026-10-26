"""Prepare the downloaded Arena episode as an attributed, offline report attachment."""
from pathlib import Path
import hashlib
import html
import json
import shutil
import subprocess

import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/report_case_v15/arena_g1"
OUT = ROOT / "artifacts/report/resources/box_case"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "evidence/report_v15_case/download_manifest.json").read_text())
    for item in manifest["files"]:
        source = SOURCE / item["path"]
        assert hashlib.sha256(source.read_bytes()).hexdigest() == item["sha256"]
        dest = OUT / item["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
    video = OUT / "lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4"
    table = pq.read_table(OUT / "lerobot/data/chunk-000/episode_000000.parquet", use_threads=False)
    assert table.num_rows == 915
    rows = [table.slice(i, 1).to_pylist()[0] for i in [0, 300, 450, 600, 914]]
    assert all(len(r["observation.state"]) == len(r["action"]) == 43 for r in rows)
    assert all(len(r["teleop.navigate_command"]) == 3 for r in rows)
    (OUT / "sample_rows.json").write_text(json.dumps({"description": "Unmodified row values extracted from the original Parquet at indices 0,300,450,600,914; display export, not a new training dataset", "rows": rows}, ensure_ascii=False, indent=2) + "\n")
    for second in [6, 9, 12, 17]:
        subprocess.run(["ffmpeg", "-v", "error", "-threads", "1", "-ss", str(second), "-i", str(video), "-frames:v", "1", "-threads", "1", "-q:v", "2", "-y", str(OUT / f"frame_{second:02d}s.jpg")], check=True)
    original_info = json.loads((OUT / "lerobot/meta/info.json").read_text())
    manifest.update({"metadata_episode_count": original_info["total_episodes"], "held_episode_ids": [0], "held_episode_rows": table.num_rows, "held_video_frames": 915, "held_duration_seconds": 18.3, "sample_is_complete_training_dataset": False, "inference_or_training_executed": False, "attribution": "NVIDIA, Arena-G1-Loco-Manipulation-Task, CC-BY-4.0", "changes": "Original files unchanged; five row excerpts and JPEG stills created for presentation only"})
    (OUT / "source_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (ROOT / "evidence/report_v15_case/sample_validation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    rows_json = json.dumps(rows, ensure_ascii=False).replace("<", "\\u003c")
    task = json.loads((OUT / "lerobot/meta/tasks.jsonl").read_text())["task"]
    body = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G1 搬箱公开样本</title><style>body{{font:16px/1.65 system-ui,"Microsoft YaHei",sans-serif;color:#202124;margin:0}}main{{max-width:1050px;margin:30px auto;padding:0 24px 60px}}h1{{color:#b4232a;font-size:30px}}a{{color:#1a73e8}}nav{{display:flex;gap:20px;flex-wrap:wrap}}video{{width:min(100%,640px);height:auto}}pre{{background:#f5f6f7;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere}}.note{{border-left:3px solid #1a73e8;padding:8px 18px;background:#f5f6f7}}table{{border-collapse:collapse;width:100%}}td,th{{padding:12px;text-align:left;border-bottom:1px solid #dadce0}}</style><main>
<h1>G1 搬箱：一段真实可下载的公开示范</h1><nav><a href="../../start.html">资料总入口</a><a href="https://huggingface.co/datasets/nvidia/Arena-G1-Loco-Manipulation-Task/tree/{manifest['revision']}">官方固定目录</a><a href="source_manifest.json">来源与文件哈希</a><a href="../../notes/box_case_guide.html">从下载到闭环的复现步骤</a></nav>
<p class="note">这是 NVIDIA 公开仿真示范 episode 0，包含915条记录、18.3秒视频。它不是本项目训练模型的闭环输出。原库元数据描述100回合，本附件只持有1回合，不是可直接作为整库使用的训练集。</p>
<p>任务原文：{html.escape(task)}</p><video id="video" controls preload="metadata" poster="frame_09s.jpg" src="lerobot/videos/chunk-000/observation.images.ego_view/episode_000000.mp4"></video><p>来源：NVIDIA，CC-BY-4.0。原始视频和数据文件未修改；下方数值为原Parquet行值展示导出。</p>
<nav><a href="lerobot/meta/info.json">原始 info.json</a><a href="lerobot/meta/tasks.jsonl">原始任务</a><a href="lerobot/meta/modality.json">原始字段切分</a><a href="lerobot/data/chunk-000/episode_000000.parquet">原始 Parquet</a><a href="sample_rows.json">五条真实记录</a></nav>
<h2>记录与训练动作分开看</h2><table><tr><th>层级</th><th>当前公开组合</th></tr><tr><td>数据记录</td><td>43维关节state/action，另有3维导航和1维机身高度命令</td></tr><tr><td>官方 N1.6 训练配置</td><td>取双臂、双手、腰的31维状态；动作再加高度与导航，合计35维</td></tr><tr><td>执行</td><td>高层关节/导航目标交给匹配WBC，腿部控制由该控制器完成</td></tr></table>
<h2>真实记录节选</h2><p>原始元数据50Hz；下列记录由索引选择。完整915条数值保存在随附Parquet中。</p><pre id="rows"></pre>
<h2>本次持有与下一步</h2><p>已核对任务、版本、单回合数值与视频；未下载模型，未执行GPU闭环或重新训练。下一步先用匹配公开模型跑运行时基线，再按本轮数据选择训练，保留多回合成功率和失败录像。数据许可与模型非商用条件分别登记。</p>
<p>数据集：NVIDIA Arena-G1-Loco-Manipulation-Task；版本 {manifest['revision']}；许可 <a href="https://creativecommons.org/licenses/by/4.0/">CC-BY-4.0</a>。本页增加排版、数值节选与视频截图，原始文件保留原字节。</p></main><script type="application/json" id="row-data">{rows_json}</script><script>document.getElementById('rows').textContent=JSON.stringify(JSON.parse(document.getElementById('row-data').textContent),null,2);</script></html>'''
    (OUT / "index.html").write_text(body)
    print(json.dumps({"rows": table.num_rows, "duration": 18.3, "metadata_episodes": original_info["total_episodes"], "held_episodes": 1, "training_executed": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
