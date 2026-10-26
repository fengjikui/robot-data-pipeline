"""Prepare offline data viewers and a relocatable, self-contained report folder."""
from pathlib import Path
import argparse, hashlib, html, json, re, shutil, zipfile
from urllib.parse import quote
from markdown_it import MarkdownIt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/report'
RES = OUT / 'resources'
REV = 'v9'
STYLE = '''body{font:16px/1.65 system-ui,"Segoe UI","Microsoft YaHei",sans-serif;color:#202124;margin:0;background:#fff}main{max-width:1120px;margin:36px auto;padding:0 28px 56px}h1{font-size:30px;color:#b4232a;line-height:1.3}h2{font-size:22px;margin-top:30px}a{color:#1a73e8}nav{display:flex;flex-wrap:wrap;gap:12px 24px;margin:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f7;padding:18px;border-radius:6px;font:14px/1.6 Consolas,monospace}table{border-collapse:collapse;width:100%;font-size:15px}td,th{border-bottom:1px solid #dadce0;padding:9px 12px;text-align:left}th{background:#f5f6f7}.muted{color:#5f6368}.images{display:grid;grid-template-columns:1fr 1fr;gap:20px}.images img{display:block;width:100%;height:auto}input[type=range]{width:min(650px,70vw)}input[type=number]{width:85px;padding:6px}select,button{font:inherit;padding:6px 12px}details{margin:18px 0}summary{cursor:pointer;font-weight:600}article img{max-width:100%;height:auto}article>h2{margin-top:52px;border-top:1px solid #dadce0;padding-top:24px}.warning{border-left:3px solid #b4232a;padding:6px 16px;background:#faf7f7}.controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:22px 0}code{font-family:Consolas,monospace}@media(max-width:700px){.images{grid-template-columns:1fr}main{padding:0 16px}}'''

def page(title, body, script=''):
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html.escape(title)+'</title><style>'+STYLE+'</style><main>'+body+'</main>'+script+'</html>'

def embedded(value, ident):
    return '<script type="application/json" id="'+ident+'">'+json.dumps(value,ensure_ascii=False).replace('<','\\u003c')+'</script>'

def cp(src, dest):
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dest)

def prepare():
    raw=ROOT/'examples/raw/official_rerun_testdata/episode_0006'
    shutil.copytree(raw,RES/'raw/episode_0006',dirs_exist_ok=True)
    cp(ROOT/'data/downloads/rerun_testdata.zip',RES/'raw_official_sample.zip')
    ev=ROOT/'evidence/report_episode_example_2026-10-26'
    for source,dest in [('real_lerobot_row_display_export.json','row.json'),('official_info.json','info.json'),('official_tasks.parquet','tasks.parquet')]:
        cp(ev/source,RES/'converted'/dest)
    evidence=ROOT/'evidence/report_raw_episode_2026-10-26'
    cp(evidence/'official_rerun_visualizer.py',RES/'provenance/official_rerun_visualizer.py')
    m=json.loads((evidence/'source_manifest.json').read_text())
    m['path_base']='presentation folder';m['archive']['path']='resources/raw_official_sample.zip';m['json_path']='resources/raw/episode_0006/data.json'
    (RES/'provenance/raw_source_manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    for source,dest in [
        ('assets/report_slide02/image_generation_prompt.txt','robot_image_prompt.txt'),
        ('assets/report_generated/augmentation_triptych_v1.prompt.txt','augmentation_prompt.txt'),
        ('assets/report_generated/augmentation_triptych_v1.record.json','augmentation_record.json'),
    ]:
        cp(ROOT/source,RES/'provenance'/dest)
        if dest.endswith('.json'):
            p=RES/'provenance'/dest
            record=json.loads(p.read_text())
            def relative_record(v):
                if isinstance(v,dict):return {k:relative_record(x) for k,x in v.items()}
                if isinstance(v,list):return [relative_record(x) for x in v]
                if isinstance(v,str):return v.replace(str(ROOT)+'/', '')
                return v
            record=relative_record(record)
            if dest=='augmentation_record.json':
                cp(ROOT/'assets/report_generated/augmentation_triptych_v1.png',RES/'provenance/augmentation_illustration.png')
                cp(ROOT/'assets/report_slide02/g1_illustration_v1.png',RES/'provenance/robot_illustration.png')
                record['asset']='augmentation_illustration.png'
                record['prompt_file']='augmentation_prompt.txt'
                record['reference_images']=['robot_illustration.png']
                record['original_generation_filename']=Path(record.pop('original_generated_path')).name
            record['record_path_base']='this JSON directory'
            p.write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    d=json.loads((raw/'data.json').read_text())
    body='''<h1>原始回合：episode_0006</h1><p class="muted">宇树官方回放测试包中的原始 JSON + JPG。167 条记录，两路图像，未转换为 LeRobot。</p>
<nav><a href="../start.html">资料总入口</a><a href="raw/episode_0006/data.json">完整原始 data.json</a><a href="raw_official_sample.zip">原始 ZIP</a><a href="provenance/raw_source_manifest.json">来源与哈希</a></nav>
<p class="warning">历史测试样本：手部字段为 left_hand / right_hand，型号未完整标明；任务文字与首帧画面存在待核验之处。它用于解释保存结构，不作为搬箱任务示范。</p>
<p>这份原件的 <code>info.joint_names</code> 仅填写 left_arm 的7个名称；但167条记录的 states/actions 中，left_arm、right_arm、left_hand、right_hand 都各有7个 qpos 数值。名称缺失不表示该组没有记录。body 为 null。页面保留这一原始缺项，不猜填关节名称。</p>
<div class="controls"><label for="frame">记录序号</label><input id="frame" type="range" min="0" max="166" value="0"><input id="frameNumber" aria-label="记录序号数值" type="number" min="0" max="166" value="0"><span id="frameLabel"></span></div>
<div class="images"><figure style="margin:0"><img id="cam0" alt="color_0 原始图片"><figcaption id="cap0" class="muted"></figcaption></figure><figure style="margin:0"><img id="cam1" alt="color_1 原始图片"><figcaption id="cap1" class="muted"></figcaption></figure></div>
<h2>同一记录中的实际反馈与目标</h2><div class="controls"><label for="part">身体部位</label><select id="part"><option>left_arm</option><option>right_arm</option><option>left_hand</option><option>right_hand</option></select></div><table><thead><tr><th>关节索引</th><th>states.*.qpos：实际反馈</th><th>actions.*.qpos：目标</th></tr></thead><tbody id="values"></tbody></table>
<details><summary>本条原始记录的全部字段</summary><pre id="record"></pre></details><details><summary>info 和 text 元信息原值</summary><pre id="meta"></pre></details>
<p class="muted">页面按读取值排版展示；“完整原始 data.json”和 JPG 文件保留原字节。idx / 名义 fps 不能证明硬件同步，控制目标也不等于最终电机报文。</p>'''
    script=embedded(d,'episode')+'''<script>
const episode=JSON.parse(document.getElementById('episode').textContent),slider=document.getElementById('frame'),number=document.getElementById('frameNumber'),part=document.getElementById('part');
function show(i){i=Math.max(0,Math.min(episode.data.length-1,Number(i)||0));slider.value=number.value=i;const row=episode.data[i];document.getElementById('frameLabel').textContent=`idx ${row.idx} / 共 ${episode.data.length} 条`;for(const [id,key]of [['cam0','color_0'],['cam1','color_1']]){const p=row.colors[key];document.getElementById(id).src='raw/episode_0006/'+p;document.getElementById(id==='cam0'?'cap0':'cap1').textContent=p;}document.getElementById('record').textContent=JSON.stringify(row,null,2);const states=row.states[part.value].qpos,actions=row.actions[part.value].qpos,tbody=document.getElementById('values');tbody.replaceChildren();states.forEach((value,j)=>{const tr=document.createElement('tr');for(const cell of [j,value,actions[j]]){const td=document.createElement('td');td.textContent=String(cell);tr.append(td);}tbody.append(tr);});}
slider.addEventListener('input',()=>show(slider.value));number.addEventListener('input',()=>show(number.value));part.addEventListener('change',()=>show(slider.value));document.getElementById('meta').textContent=JSON.stringify({info:episode.info,text:episode.text},null,2);show(0);
</script>'''
    (RES/'raw_episode.html').write_text(page('原始回合资料',body,script))
    row=json.loads((RES/'converted/row.json').read_text());info=json.loads((RES/'converted/info.json').read_text())
    body='''<h1>转换后的 LeRobot 公开样本</h1><p>这里是官方 ToastedBread 数据的单条数值节选与完整字段元信息，供理解训练输入。它是独立示例，非前述原始回合的实际转换结果。</p><nav><a href="../start.html">资料总入口</a><a href="converted/row.json">真实行的 JSON 展示导出</a><a href="converted/info.json">官方 meta/info.json</a><a href="https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/viewer">官方在线 Viewer</a></nav>
<p class="muted">本地包含数值节选、meta/info.json 与 tasks.parquet，未包含整套数据和相机视频。原 Parquet 行导出为 JSON 仅为方便查看，不能称作原始采集 data.json。</p>
<h2>第一行真实数值</h2><pre id="row"></pre><details><summary>meta/info.json 原值</summary><pre id="info"></pre></details><p>固定版本：02cb29161f5adb2981a072aa35b408d82a556d07。完整目录、Parquet 与视频可从 <a href="https://huggingface.co/datasets/unitreerobotics/G1_Dex3_ToastedBread_Dataset/tree/02cb29161f5adb2981a072aa35b408d82a556d07">官方目录</a>查看。</p>'''
    script=embedded(row,'sample')+embedded(info,'metadata')+'''<script>document.getElementById('row').textContent=JSON.stringify(JSON.parse(document.getElementById('sample').textContent),null,2);document.getElementById('info').textContent=JSON.stringify(JSON.parse(document.getElementById('metadata').textContent),null,2);</script>'''
    (RES/'converted_episode.html').write_text(page('LeRobot 样本资料',body,script))
    print('Prepared offline resources and viewers.')

def portable_markdown(s):
    replacements={
        f'../../artifacts/report/full_{REV}/':'../previews/',
        '../../examples/raw/official_rerun_testdata/episode_0006':'../resources/raw/episode_0006',
        '../../data/downloads/rerun_testdata.zip':'../resources/raw_official_sample.zip',
        '../../evidence/report_raw_episode_2026-10-26/source_manifest.json':'../resources/provenance/raw_source_manifest.json',
        '../../evidence/report_episode_example_2026-10-26/real_lerobot_row_display_export.json':'../resources/converted/row.json',
        '../../evidence/report_episode_example_2026-10-26/official_info.json':'../resources/converted/info.json',
        '../../assets/report_slide02/image_generation_prompt.txt':'../resources/provenance/robot_image_prompt.txt',
        '../../assets/report_generated/augmentation_triptych_v1.prompt.txt':'../resources/provenance/augmentation_prompt.txt',
        '../../assets/report_generated/augmentation_triptych_v1.record.json':'../resources/provenance/augmentation_record.json',
        '10_转换后LeRobot公开数据查看.md':'converted_guide.md',
        '14_工具命令与参数备查.md':'tool_commands_guide.md',
        'parts/wholebody_research_v14.md':'wholebody_guide.md',
    }
    for a,b in replacements.items():s=s.replace(a,b)
    # Within speaker prose, local resource names are rooted at the presentation;
    # make inline code explicit without creating invalid clickable links.
    return s

def package():
    folder=OUT/f'portable_{REV}/robot_data_pipeline_report'
    ppt_name=f'具身智能数据管线报告_{REV}.pptx'
    if folder.exists():shutil.rmtree(folder)
    folder.mkdir(parents=True)
    cp(OUT/ppt_name,folder/ppt_name)
    shutil.copytree(RES,folder/'resources')
    shutil.copytree(OUT/f'full_{REV}',folder/'previews')
    notes=folder/'notes';notes.mkdir()
    render=MarkdownIt('commonmark',{'html':False}).enable('table')
    report_sources = [
        ('07_全稿逐页阅读与演讲稿.md','speaker_notes'),
        ('09_回合真实数据查看与字段对应.md','raw_episode_guide'),
        ('10_转换后LeRobot公开数据查看.md','converted_guide'),
        ('11_外部数据接入阶段与额外处理路径.md','external_data_guide'),
        ('12_采集转换训练配置与策略适配.md','strategy_conversion_guide'),
    ]
    if int(REV[1:]) >= 14:
        report_sources += [
            ('14_工具命令与参数备查.md','tool_commands_guide'),
            ('parts/augmentation_research_v14.md','augmentation_guide'),
            ('parts/wholebody_research_v14.md','wholebody_guide'),
        ]
    for source,name in report_sources:
        s=portable_markdown((ROOT/'docs/report'/source).read_text()).replace('report.pptx',ppt_name);(notes/(name+'.md')).write_text(s)
        html_source=re.sub(r'\]\(([^)]+)\.md(#[^)]*)?\)',lambda m:']('+m.group(1)+'.html'+(m.group(2) or '')+')',s)
        body='<nav><a href="../start.html">资料总入口</a><a href="'+name+'.md">Markdown 原稿</a></nav><article>'+render.render(html_source)+'</article>'
        (notes/(name+'.html')).write_text(page('报告讲稿与说明',body))
    if int(REV[1:]) >= 13:
        shutil.copytree(ROOT/'docs/design/workbench_prototype',folder/'prototype')
        design_sources = {
            ROOT/'docs/product/10_整体方案与产品价值_2026-10-26.md': 'product_plan',
            ROOT/'docs/product/11_交互逻辑与界面设计说明.md': 'interaction_design',
            ROOT/'docs/product/12_开发工作包与验收映射.md': 'implementation_backlog',
            ROOT/'docs/implementation/08_真机采集接入现状与实施顺序.md': 'capture_status',
        }
        for source,name in design_sources.items():
            def rewrite_link(match):
                label,target=match.groups()
                if re.match(r'^[a-z]+:',target) or target.startswith('#'):
                    return match.group(0)
                linked=(source.parent/target.split('#')[0]).resolve()
                if linked in design_sources:
                    dest=design_sources[linked]+'.md'
                elif linked == ROOT/'docs/report/12_采集转换训练配置与策略适配.md':
                    dest='strategy_conversion_guide.md'
                elif linked == ROOT/'docs/design/workbench_prototype/index.html':
                    dest='../prototype/index.html'
                elif linked.is_relative_to(ROOT):
                    dest='https://github.com/fengjikui/robot-data-pipeline/blob/main/'+quote(linked.relative_to(ROOT).as_posix())
                else:
                    raise ValueError('Unexpected design document link')
                return '['+label+']('+dest+')'
            s=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',rewrite_link,source.read_text())
            (notes/(name+'.md')).write_text(s)
            html_source=re.sub(r'\]\(([a-z_]+)\.md\)',r'](\1.html)',s)
            (notes/(name+'.html')).write_text(page('方案与交互设计','<nav><a href="../start.html">资料总入口</a><a href="'+name+'.md">Markdown 原稿</a></nav><article>'+render.render(html_source)+'</article>'))
    body='''<h1>具身智能数据管线 · 演示资料</h1><p>离线资料与演示文稿已放在同一目录。先完整解压 ZIP，再打开本页或 report.pptx；复制到 Windows 时保留整个文件夹，无需改成本机绝对路径。</p>
<h2>演示与讲稿</h2><nav><a href="report.pptx">打开演示 PPT</a><a href="notes/speaker_notes.html">逐页预览与完整讲稿</a></nav>
<h2>原始采集数据</h2><nav><a href="resources/raw_episode.html">按帧浏览原始 JSON 与图像</a><a href="resources/raw/episode_0006/data.json">原始 data.json</a><a href="notes/raw_episode_guide.html">字段对应与样本边界</a></nav>
<h2>转换后的数据</h2><nav><a href="resources/converted_episode.html">LeRobot 本地数值节选</a><a href="notes/converted_guide.html">转换后数据说明</a><a href="notes/strategy_conversion_guide.html">逐策略转换与验收清单</a></nav>
<h2>外部数据与采购</h2><nav><a href="notes/external_data_guide.html">外部数据接入阶段与额外处理路径</a></nav>
<p>原始回放测试样本为167条记录、334张JPG，原始字节保留。LeRobot数据为独立的官方示例，不能当作这段原始回合的转换产物。</p>
<h2>在 Windows 上使用</h2><ol><li>对ZIP执行“全部解压”，不要从压缩包内部临时打开PPT。</li><li>用桌面版PowerPoint或WPS打开 report.pptx，进入放映后点击资料链接。编辑状态可能需 Ctrl + 单击。</li><li>若本地资料链接被Office策略提示，仍可从本页用Edge/Chrome打开相同的离线浏览页。资料不需要Python、服务器或互联网。</li><li>官方仓库、论文、在线Viewer等外部来源仍需联网；已用于现场查看的数据和讲稿可离线打开。</li></ol><p class="muted">当前已完成目录迁移、相对链接静态检查与离线脚本数据绑定检查；尚未在你的Windows版PowerPoint/WPS实播验证。PPT已嵌入展示用图片与数值，完整原始文件随包，通过相对链接打开。</p>'''
    if int(REV[1:]) >= 13:
        body += '''<h2>后续完整方案与交互原型</h2><nav><a href="notes/product_plan.html">现状问题、价值与四阶段路线</a><a href="notes/interaction_design.html">用户旅程与详细交互设计</a><a href="notes/implementation_backlog.html">开发工作包与验收</a><a href="notes/capture_status.html">真机采集当前接入状态</a><a href="prototype/index.html">打开可点击方案原型</a></nav><p>原型全部使用示例状态，不连接机器人，不下载、不训练、不部署。可以演示采集保存失败恢复、外部数据筛选、训练输入差异与配方切换。</p>'''
    if int(REV[1:]) >= 14:
        body += '''<h2>本版专项备查</h2><nav><a href="notes/tool_commands_guide.html">转换、增强与训练的真实命令和参数</a><a href="notes/augmentation_guide.html">增强方法、审查与效果对照</a><a href="notes/wholebody_guide.html">腰腿数据与连续搬箱控制</a></nav><p>v14 共29张：目录、26页正文、2页备查。页面不带页码，标题距左和上均1.1cm，底部1.3cm留给公司模板。</p>'''
    (folder/'start.html').write_text(page('演示资料入口',body.replace('report.pptx',ppt_name)))
    (folder/'README.txt').write_text('具身智能数据管线演示包\n\n1. 完整解压ZIP，保持文件夹结构。\n2. 打开 start.html 查看全部资料，或打开 report.pptx 开始报告。\n3. resources包含完整原始回合、原ZIP、离线浏览页及转换后节选；notes包含完整讲稿。\n4. 本地链接相对于 report.pptx，无用户目录或盘符依赖。不要只复制PPT文件。\n5. 图像与关键数值已嵌入PPT；完整原始文件为随包附件，并非OLE嵌入对象。\n6. 外部权威来源链接仍需联网。本包没有宏、可执行安装器或服务要求。\n\n尚未在目标Windows版PowerPoint/WPS实播，建议在报告前打开并点击一次资料入口。\n')
    readme=folder/'README.txt';readme.write_text(readme.read_text().replace('report.pptx',ppt_name))
    # Check every local Markdown target before shipping.
    for f in notes.glob('*.md'):
        for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',f.read_text()):
            if re.match(r'^[a-z]+:',target):continue
            target=target.split('#')[0]
            if target and not (f.parent/target).exists():raise RuntimeError(f'Missing Markdown target: {f.name}: {target}')
    files=[]
    for p in sorted(folder.rglob('*')):
        if p.is_file():files.append({'path':p.relative_to(folder).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.file_digest(p.open('rb'),'sha256').hexdigest()})
    (folder/'manifest.json').write_text(json.dumps({'revision':REV,'path_base':'package root','local_links':'relative','entry':'start.html','presentation':ppt_name,'raw_episode_frames':167,'raw_images':334,'full_dataset_embedded_ole':False,'files':files},ensure_ascii=False,indent=2)+'\n')
    archive=OUT/f'robot_data_pipeline_report_windows_{REV}.zip'
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
        for p in sorted(folder.rglob('*')):
            if p.is_file():z.write(p,'robot_data_pipeline_report/'+p.relative_to(folder).as_posix(),compress_type=zipfile.ZIP_STORED if p.suffix.lower() in {'.jpg','.png','.pptx','.zip','.parquet'} else zipfile.ZIP_DEFLATED)
    print(json.dumps({'package':str(archive.relative_to(ROOT)),'bytes':archive.stat().st_size,'files':len(files)+1},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--prepare',action='store_true');p.add_argument('--package',action='store_true');p.add_argument('--revision',default='v9');args=p.parse_args()
    REV=args.revision
    if not re.fullmatch(r'v\d+',REV):raise ValueError('Invalid revision')
    if args.prepare:prepare()
    if args.package:package()
