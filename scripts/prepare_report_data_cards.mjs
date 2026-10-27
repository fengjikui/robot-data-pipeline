import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT,SKILL,RUNTIME,FONT} from './report_common.mjs';
const {importRuntimeModule}=await import(pathToFileURL(path.join(SKILL,'container_tools/runtime_helpers.mjs')));
const {createCanvas}=await importRuntimeModule('@napi-rs/canvas');
const out=path.join(ROOT,'artifacts/report/resources/data_cards');await fs.mkdir(out,{recursive:true});
const raw=JSON.parse(await fs.readFile(path.join(ROOT,'artifacts/report/resources/raw/episode_0006/data.json'),'utf8'));
const converted=JSON.parse(await fs.readFile(path.join(ROOT,'artifacts/report/resources/converted/row.json'),'utf8'));
const meta=JSON.parse(await fs.readFile(path.join(ROOT,'artifacts/report/resources/converted/info.json'),'utf8'));
function card(filename,title,subtitle,lines){
  const canvas=createCanvas(1200,800),ctx=canvas.getContext('2d');ctx.fillStyle='#F5F6F7';ctx.fillRect(0,0,1200,800);
  ctx.fillStyle='#202124';ctx.font=`bold 32px "${FONT}"`;ctx.fillText(title,42,53);
  ctx.fillStyle='#5F6368';ctx.font=`22px "${FONT}"`;ctx.fillText(subtitle,42,91);
  ctx.strokeStyle='#DADCE0';ctx.beginPath();ctx.moveTo(42,112);ctx.lineTo(1158,112);ctx.stroke();
  ctx.font=`25px "${FONT}"`;ctx.fillStyle='#202124';lines.forEach((line,i)=>ctx.fillText(line,42,155+i*29));
  ctx.font=`21px "${FONT}"`;ctx.fillStyle='#5F6368';ctx.fillText('真实文件值的排版节选；原件未改写，完整字段见资料链接。',42,772);
  return fs.writeFile(path.join(out,filename),canvas.toBuffer('image/png'));
}
const row=raw.data[0];
const vector=(v,indent='        ')=>([0,3,6].map((i,j)=>indent+v.slice(i,i+3).map(x=>String(x)).join(', ')+(j<2?',':'')));
await card('raw_excerpt.png','原始回合：episode_0006/data.json','只节选任务、图像路径和同一左臂 state/action；其他字段省略。',[
  `"goal": ${JSON.stringify(raw.text.goal)},`,
  `"idx": ${row.idx},`,
  `"colors": {"color_0": ${JSON.stringify(row.colors.color_0)}},`,
  '"states": {"left_arm": {"qpos": [',...vector(row.states.left_arm.qpos),'  ]}},',
  '"actions": {"left_arm": {"qpos": [',...vector(row.actions.left_arm.qpos),'  ]}}',
  '', '同条记录还包括 right_arm、left_hand、right_hand；各7维。',
  'body 为 null；joint_names 仅填写了 left_arm 的7个名称。'
]);
const r=converted.row;
await card('lerobot_excerpt.png','官方 LeRobot 样例：元数据与 Parquet 行','独立 ToastedBread 数据示例；不是左侧原始回合的实际转换结果。',[
  'meta/info.json',
  `  codebase_version: ${JSON.stringify(meta.codebase_version)}`,
  `  fps: ${meta.fps}`,
  `  observation.state.shape: ${JSON.stringify(meta.features['observation.state'].shape)}`,
  `  action.shape: ${JSON.stringify(meta.features.action.shape)}`,
  '',
  'data/chunk-000/file-000.parquet：第一行（数组只显示前3项）',
  `  observation.state: [${r['observation.state'].slice(0,3).map(String).join(', ')}, …]`,
  `  action: [${r.action.slice(0,3).map(String).join(', ')}, …]`,
  `  episode_index: ${r.episode_index}`,
  `  frame_index: ${r.frame_index}`,
  `  task_index: ${r.task_index}`,
  '',
  '图像：observation.images.*，按 meta 指定路径读取视频。',
  '目录：data/ + videos/ + meta/；任务与回合边界另有元数据。'
]);
const manifest={date:'2026-10-27',method:'deterministic text rendering from genuine local official files; no image generation model',rawSource:'raw/episode_0006/data.json',convertedSource:'converted/row.json',convertedInfo:'converted/info.json',notice:'Side-by-side examples are independent, not a paired conversion. Array ellipsis is explicitly marked; original bytes remain unchanged.'};
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
await fs.writeFile(path.join(ROOT,'artifacts/report/resources/data_cards.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>数据格式原件与放大节选</title><style>body{font:17px/1.6 system-ui,"Microsoft YaHei",sans-serif;max-width:1200px;margin:32px auto;padding:0 22px;color:#202124}h1{color:#b4232a}a{color:#1a73e8}img{max-width:100%;height:auto}nav{display:flex;gap:22px;flex-wrap:wrap}section{margin-top:36px}</style><h1>原始数据与训练格式：真实样例节选</h1><nav><a href="../start.html">资料总入口</a><a href="raw_episode.html">原始JSON与图像浏览</a><a href="raw/episode_0006/data.json">完整原始data.json</a><a href="converted_episode.html">官方LeRobot数值与meta</a></nav><p>这两份官方样例相互独立，不是本次成对转换的结果。节选图由真实文件值排版生成；完整字段和值以原件为准。</p><section id="raw"><h2>原始回合</h2><a href="data_cards/raw_excerpt.png"><img src="data_cards/raw_excerpt.png" alt="原始JSON字段节选"></a></section><section id="lerobot"><h2>LeRobot样例</h2><a href="data_cards/lerobot_excerpt.png"><img src="data_cards/lerobot_excerpt.png" alt="LeRobot元数据和真实行节选"></a></section></html>`);
console.log('Prepared two source-backed data thumbnails and their offline full-size viewer.');
