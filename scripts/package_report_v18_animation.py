"""Update the verified v17 offline package with the same-page native animation."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from html.parser import HTMLParser
import hashlib
import json
import shutil
import zipfile
from markdown_it import MarkdownIt
from build_portable_report import page

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/report'
DEST = OUT / 'portable_v18/robot_data_pipeline_report'
if DEST.exists():
    shutil.rmtree(DEST)
shutil.copytree(OUT / 'portable_v17/robot_data_pipeline_report', DEST)
(DEST / '具身智能数据管线报告_v17.pptx').unlink()
shutil.copy2(OUT / '具身智能数据管线报告_v18.pptx', DEST / '具身智能数据管线报告_v18.pptx')
shutil.copytree(OUT / 'full_v18', DEST / 'previews', dirs_exist_ok=True)
guide = (ROOT / 'docs/report/20_采集页动画使用说明.md').read_text()
(DEST / 'notes/animation_guide.md').write_text(guide)
(DEST / 'notes/animation_guide.html').write_text(page('采集页动画使用说明', '<nav><a href="../start.html">资料入口</a></nav>' + MarkdownIt('commonmark').enable('table').render(guide)))
for file in [DEST / 'start.html', DEST / 'README.txt', DEST / 'notes/speaker_notes.md', DEST / 'notes/speaker_notes.html']:
    text = file.read_text().replace('具身智能数据管线报告_v17.pptx', '具身智能数据管线报告_v18.pptx').replace('v17前半部分讨论稿', 'v18前半部分讨论稿').replace('v17 前半部分讨论稿', 'v18 前半部分讨论稿')
    text = text.replace('该版为静态合成页，不依赖动画插件；没有宣称完成Windows放映验证。', '采集页采用同页原生出现/消失动画，初始显示拓扑，推进一次切换到数据流。Mac WPS实播通过，Windows版PowerPoint/WPS尚待试播。')
    text = text.replace('2026-10-27。按最新讨论重新生成画布与页面，没有复制旧稿的幻灯片、母版或表格。复用已经核实的事实、原始文件、参考出处和已确认的设备图素材。', '2026-10-27。本稿内容沿用v17前半部分，第2张采集页增加同页分步动画。其他技术内容继续使用已核实的事实、原始文件和参考出处。')
    if file.name == 'start.html':
        text = text.replace('<h2>现场资料</h2>', '<h2>采集页动画</h2><p>采集仍占一张幻灯片。进入放映后，先显示设备与网络拓扑，推进一次切到数据流，后退恢复拓扑。</p><nav><a href="notes/animation_guide.html">操作说明与实播范围</a><a href="previews/page-02.png">拓扑状态预览</a><a href="previews/capture-data.png">数据流状态预览</a></nav><h2>现场资料</h2>')
    if file.name == 'README.txt':
        text += '\n动画：第2张采集页使用原生PPT出现/消失动画，仍占一张。\n进入放映后单击或向下推进显示数据流，向上/向左退回拓扑。\nMac WPS已实测鼠标滚轮上下切换；Windows版PowerPoint/WPS仍需目标机试播。\n详细说明：notes/animation_guide.html。编辑模式会显示所有对象，请以放映效果为准。\n'
    file.write_text(text)


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        self.links.extend(attrs[a] for a in ['href', 'src'] if attrs.get(a))


count = 0
for file in DEST.rglob('*.html'):
    parser = Links()
    parser.feed(file.read_text())
    for link in parser.links:
        bits = urlsplit(link)
        if bits.scheme or bits.netloc:
            continue
        target = (file.parent / unquote(bits.path)).resolve() if bits.path else file
        assert target.is_relative_to(DEST) and target.exists(), (file, link)
        if bits.fragment:
            target_parser = Links()
            target_parser.feed(target.read_text())
            assert bits.fragment in target_parser.ids, link
        count += 1
(DEST / 'manifest.json').unlink()
files = [dict(path=f.relative_to(DEST).as_posix(), bytes=f.stat().st_size, sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in sorted(DEST.rglob('*')) if f.is_file()]
manifest = dict(revision='v18', slide_count=5, capture_slide=2, capture_states=2, native_animation=True, status='background draft; core scheme pending discussion', local_links='relative', html_targets_checked=count, mac_wps_slideshow_tested=True, windows_slideshow_tested=False, files=files)
(DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
archive = OUT / 'robot_data_pipeline_report_windows_v18.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
    for f in sorted(DEST.rglob('*')):
        if f.is_file():
            z.write(f, 'robot_data_pipeline_report/' + f.relative_to(DEST).as_posix(), compress_type=zipfile.ZIP_STORED if f.suffix.lower() in {'.png', '.jpg', '.mp4', '.zip', '.parquet', '.pptx'} else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
print(json.dumps(dict(package=archive.name, bytes=archive.stat().st_size, html_targets_checked=count, slides=5), ensure_ascii=False))
