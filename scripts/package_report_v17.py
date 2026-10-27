"""Create a reader and a self-contained, relocatable report background draft."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
from html.parser import HTMLParser
import hashlib
import html
import json
import re
import shutil
import zipfile

from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/report'
DOC = ROOT / 'docs/report'
REV = 'v17'
PPT = f'具身智能数据管线报告_{REV}.pptx'
FOLDER = OUT / f'portable_{REV}/robot_data_pipeline_report'
READER = DOC / '19_新版结构与前半部分讲稿.md'
CONFIG = json.loads((DOC / f'parts/report_revision_{REV}.json').read_text())
STYLE = 'body{font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif;color:#202124;margin:0}main{max-width:1120px;margin:36px auto;padding:0 28px 56px}h1{color:#b4232a;font-size:30px}h2{margin-top:36px;font-size:23px}a{color:#1a73e8}nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;background:#f5f6f7;font:14px/1.65 Consolas,monospace}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #dadce0}th{background:#f5f6f7}img{max-width:100%;height:auto}.muted{color:#5f6368}'


def document(title, body):
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + html.escape(title) + '</title><style>' + STYLE + '</style><main>' + body + '</main></html>'


text = '''# 具身智能数据管线报告：新版结构与前半部分讲稿

2026-10-27。按最新讨论重新生成画布与页面，没有复制旧稿的幻灯片、母版或表格。复用已经核实的事实、原始文件、参考出处和已确认的设备图素材。

## 整份报告安排

| 位置 | 内容 | 状态 |
| --- | --- | --- |
| 1 | 目录：四部分内容 | 已制作 |
| 2 | 任务与真机采集：共享设备场景、物理连接、数据流、程序和启动时间线 | 已制作 |
| 3 | 数据处理、训练与部署：真实样例、转换和训练命令、闭环仿真与部署 | 已制作 |
| 4 | 数据增强：六类方法及其输入产出 | 已制作 |
| 5 | 外部数据与采购：三个真实案例、获取范围和样本验收 | 已制作 |
| 6–8 | 我们的数据管线要解决的问题、整体方案、阶段与成品范围 | 待双方讨论，尚未写成页面 |

当前PPT只有前5页，是前半部分讨论稿。全稿暂按8页和15–20分钟安排，核心方案保留3页。前半部分精讲约10分钟，方案与实施约5–10分钟。产品业务代码没有因本稿发生变更。

## 采集页的阅读顺序

先看设备位置与浅灰物理网络，再看红色控制、蓝色图像和深灰实际反馈，最后解释程序标注和下方启动时间线。逻辑通路共用网络。该版为静态合成页，不依赖动画插件；没有宣称完成Windows放映验证。

融合内容的逐项对应见[采集页融合构思](18_采集页融合构思.md)。
'''
for i, p in enumerate(CONFIG['pages'], 1):
    text += f'\n## {p["title"]}\n\n![页面预览](../../artifacts/report/full_{REV}/page-{i:02d}.png)\n\n### 精讲口述\n\n{p["shortScript"]}\n\n### 扩展讲稿\n\n{p["speakerNotes"]}\n'
    if p['sources']:
        text += '\n### 原始权威出处\n\n'
        for r in p['sources']:
            text += f'- [{r["label"]}]({r["url"]})\n'
text += '''
## 备查资料

- [增强方法与固定版本来源](parts/augmentation_methods_v16.md)
- [转换、增强与训练命令备查](14_工具命令与参数备查.md)
- [原始回合与字段对应](09_回合真实数据查看与字段对应.md)
- [LeRobot样例说明](10_转换后LeRobot公开数据查看.md)
- [Arena真实数据和闭环复现路线](parts/box_dataset_case_v15.md)

使用资料包时完整解压，保留PPT、resources和notes的相对位置。数据节选图片是原始值的排版展示，完整JSON与图像原字节随包提供。Arena视频来自公开示范，不是本项目训练后的模型结果。服务端训练、闭环仿真及真机尚未执行。
'''
READER.write_text(text)

if FOLDER.exists():
    shutil.rmtree(FOLDER)
FOLDER.mkdir(parents=True)
shutil.copy2(OUT / PPT, FOLDER / PPT)
shutil.copytree(OUT / f'full_{REV}', FOLDER / 'previews')
resources = FOLDER / 'resources'
resources.mkdir()
for name in ['raw', 'converted', 'data_cards', 'box_case']:
    shutil.copytree(OUT / 'resources' / name, resources / name)
for name in ['raw_episode.html', 'converted_episode.html', 'data_cards.html', 'raw_official_sample.zip']:
    shutil.copy2(OUT / 'resources' / name, resources / name)
provenance = resources / 'provenance'
provenance.mkdir()
for name in ['raw_source_manifest.json', 'official_rerun_visualizer.py', 'robot_image_prompt.txt']:
    shutil.copy2(OUT / 'resources/provenance' / name, provenance / name)
shutil.copy2(ROOT / 'assets/report_slide02/g1_illustration_v1.png', provenance / 'robot_illustration.png')
for name in ['LICENSE', 'FEATHER_LICENSE']:
    shutil.copy2(ROOT / 'assets/report_icons/lucide-0.468.0' / name, provenance / ('lucide_' + name))

sources = {
    READER: 'speaker_notes',
    DOC / '18_采集页融合构思.md': 'capture_layout',
    DOC / 'parts/augmentation_methods_v16.md': 'augmentation_guide',
    DOC / '14_工具命令与参数备查.md': 'tool_commands_guide',
    DOC / '09_回合真实数据查看与字段对应.md': 'raw_episode_guide',
    DOC / '10_转换后LeRobot公开数据查看.md': 'converted_guide',
    DOC / 'parts/box_dataset_case_v15.md': 'box_case_guide',
}
notes = FOLDER / 'notes'
notes.mkdir()
direct = {
    ROOT / 'data/downloads/rerun_testdata.zip': '../resources/raw_official_sample.zip',
    ROOT / 'evidence/report_raw_episode_2026-10-26/source_manifest.json': '../resources/provenance/raw_source_manifest.json',
    ROOT / 'evidence/report_episode_example_2026-10-26/real_lerobot_row_display_export.json': '../resources/converted/row.json',
    ROOT / 'evidence/report_episode_example_2026-10-26/official_info.json': '../resources/converted/info.json',
}


def rewrite(source, match):
    label, target = match.groups()
    if re.match(r'^[a-z]+:', target) or target.startswith('#'):
        return match.group(0)
    bits = urlsplit(target)
    resolved = (source.parent / unquote(bits.path)).resolve()
    if resolved in sources:
        dest = sources[resolved] + '.md'
    elif resolved in direct:
        dest = direct[resolved]
    elif resolved.is_relative_to(ROOT / f'artifacts/report/full_{REV}'):
        dest = '../previews/' + resolved.name
    elif resolved.is_relative_to(ROOT / 'examples/raw/official_rerun_testdata/episode_0006'):
        dest = '../resources/raw/episode_0006/' + resolved.relative_to(ROOT / 'examples/raw/official_rerun_testdata/episode_0006').as_posix()
    else:
        raise RuntimeError(f'Unmapped local document target: {source.name}: {target}')
    return '[' + label + '](' + dest + ('#' + bits.fragment if bits.fragment else '') + ')'


render = MarkdownIt('commonmark', {'html': False}).enable('table')
for source, name in sources.items():
    content = re.sub(r'\[([^\]]*)\]\(([^)]+)\)', lambda m: rewrite(source, m), source.read_text())
    (notes / (name + '.md')).write_text(content)
    html_source = re.sub(r'\]\(([^)]+)\.md(#[^)]*)?\)', lambda m: '](' + m.group(1) + '.html' + (m.group(2) or '') + ')', content)
    body = '<nav><a href="../start.html">资料入口</a><a href="' + name + '.md">Markdown原稿</a></nav>' + render.render(html_source)
    (notes / (name + '.html')).write_text(document('报告讲稿与备查', body))

body = f'''<h1>具身智能数据管线报告</h1>
<p>v17前半部分讨论稿，共5页。目录、采集、处理训练部署、增强、外部数据采购已重新生成。核心方案与实施保留3页，待讨论后补齐。</p>
<nav><a href="{PPT}">打开PPT</a><a href="notes/speaker_notes.html">逐页预览与讲稿</a><a href="notes/capture_layout.html">采集页融合构思</a></nav>
<h2>现场资料</h2><nav><a href="resources/data_cards.html">数据节选大图</a><a href="resources/raw_episode.html">原始JSON与图像</a><a href="resources/converted_episode.html">LeRobot数值与meta</a><a href="resources/box_case/index.html">Arena搬箱示范与字段</a></nav>
<h2>详细备查</h2><nav><a href="notes/augmentation_guide.html">增强方法与来源</a><a href="notes/tool_commands_guide.html">脚本与参数</a><a href="notes/box_case_guide.html">数据获取与闭环复现路线</a></nav>
<h2>在Windows上查看</h2><ol><li>先对ZIP执行“全部解压”，保持整个文件夹结构。</li><li>从start.html查看全部资料，或在桌面PowerPoint/WPS打开PPT。</li><li>放映中点击资料文字链接。编辑状态可能需Ctrl+单击；也可回到本页打开同一资源。</li><li>本地文件不要求Python、服务或互联网。官方网页、论文和仓库出处仍需联网。</li></ol>
<p class="muted">图像与关键数值已嵌入PPT。完整原始文件随包提供，使用相对链接，非OLE对象。G1外形沿用已确认的说明插图，生成说明在resources/provenance。已静态核对相对链接与搬移目录，尚未在目标Windows版PowerPoint/WPS实际放映验证。</p>
<p>Arena视频是公开示范，服务端训练与闭环仿真尚未执行。本稿没有增加工作台业务能力。</p>'''
(FOLDER / 'start.html').write_text(document('报告资料入口', body))
(FOLDER / 'README.txt').write_text('具身智能数据管线报告 v17 前半部分讨论稿\n\n当前5页，最终暂按8页，核心方案和实现范围待讨论。\n完整解压ZIP后打开start.html，或用桌面PowerPoint/WPS打开' + PPT + '。\n保留PPT、resources、notes的相对位置，不要只复制PPT。\n原始数据、图片、讲稿和示范视频可离线查看。外部权威来源需联网。\n尚未在目标Windows版PowerPoint/WPS实际放映验证。\n')


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        for key in ['href', 'src']:
            if attrs.get(key):
                self.links.append(attrs[key])


link_count = 0
for file in FOLDER.rglob('*.html'):
    parser = Links()
    parser.feed(file.read_text())
    for href in parser.links:
        bits = urlsplit(href)
        if bits.scheme or bits.netloc:
            continue
        dest = (file.parent / unquote(bits.path)).resolve() if bits.path else file
        if not dest.is_relative_to(FOLDER) or not dest.exists():
            raise RuntimeError(f'Broken/outside HTML target: {file.name}: {href}')
        if bits.fragment:
            target = Links()
            target.feed(dest.read_text())
            if bits.fragment not in target.ids:
                raise RuntimeError(f'Missing HTML anchor: {href}')
        link_count += 1
for file in notes.glob('*.md'):
    for href in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)', file.read_text()):
        bits = urlsplit(href)
        if not bits.scheme and bits.path and not (file.parent / unquote(bits.path)).exists():
            raise RuntimeError(f'Broken Markdown target: {file.name}: {href}')

entries = []
for f in sorted(FOLDER.rglob('*')):
    if f.is_file():
        entries.append(dict(path=f.relative_to(FOLDER).as_posix(), bytes=f.stat().st_size, sha256=hashlib.sha256(f.read_bytes()).hexdigest()))
manifest = dict(revision=REV, status='background draft, scheme pending discussion', slide_count=5, planned_count=8, local_links='relative', html_targets_checked=link_count, files=entries)
(FOLDER / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
archive = OUT / f'robot_data_pipeline_report_windows_{REV}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
    for f in sorted(FOLDER.rglob('*')):
        if f.is_file():
            z.write(f, 'robot_data_pipeline_report/' + f.relative_to(FOLDER).as_posix(), compress_type=zipfile.ZIP_STORED if f.suffix in {'.jpg', '.png', '.mp4', '.zip', '.parquet', '.pptx'} else zipfile.ZIP_DEFLATED)
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None:
        raise RuntimeError('ZIP CRC mismatch')
print(json.dumps(dict(presentation=PPT, pages=5, package=archive.name, bytes=archive.stat().st_size, html_targets_checked=link_count), ensure_ascii=False))
