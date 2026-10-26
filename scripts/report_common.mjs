import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const ROOT='/Users/fengjikui/Documents/dev-coding/codex_build/robot_data_pipeline';
export const SKILL='/Users/fengjikui/.codex/plugins/cache/openai-primary-runtime/presentations/26.1020.11348/skills/presentations';
export const RUNTIME='/Users/fengjikui/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=path.join(RUNTIME,'node/node_modules');
const {importRuntimeModule}=await import(pathToFileURL(path.join(SKILL,'container_tools/runtime_helpers.mjs')));
const canvas=await importRuntimeModule('@napi-rs/canvas');
canvas.GlobalFonts.registerFromPath(path.join(ROOT,'artifacts/docx_fonts/HeitiSC.ttf'));
export const FONT='Heiti SC';
export const {Presentation,PresentationFile,FileBlob}=await importRuntimeModule('@oai/artifact-tool');
export const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')));
export const C={red:'#B4232A',blue:'#1A73E8',ink:'#202124',muted:'#5F6368',pale:'#E8F0FE',soft:'#F5F6F7',line:'#DADCE0',green:'#188038',amber:'#B06000',white:'#FFFFFF'};
export const PIN='https://github.com/unitreerobotics/xr_teleoperate/blob/817fb00c63cde15e5f24a0f8fa08e1e33ed89d3b/';
export const LEROBOT='https://github.com/unitreerobotics/unitree_lerobot/blob/41c2805742de879ddab2d8d6beaeaf215f876395/';
export function setTheme(p){p.theme.defaultFont=FONT;p.theme.colorScheme={name:'Technical report light neutral',themeColors:{accent1:C.red,accent2:C.blue,accent3:C.pale,accent4:C.line,accent5:C.muted,accent6:C.soft,bg1:C.white,bg2:C.soft,tx1:C.ink,tx2:C.muted,dk1:'#111111',dk2:'#3C4043',lt1:C.white,lt2:C.pale,hlink:C.blue,folHlink:'#174EA6'}};}
const ctx=canvas.createCanvas(8,8).getContext('2d');
export function wrap(value,width,size){
  ctx.font=`${size}px "${FONT}"`;
  return String(value).split('\n').flatMap(paragraph=>{
    const lines=[];let line='';
    for(const ch of paragraph){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line=ch;}else line+=ch;}
    lines.push(line);return lines;
  }).join('\n');
}
export function T(slide,name,value,x,y,w,h,size=23,opt={}){
  const {raw=false,...style}=opt;
  const s=slide.shapes.add({geometry:'textbox',name,position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
  s.text=raw?String(value):wrap(value,w-2,size);
  s.text.style={typeface:FONT,fontSize:size,color:C.ink,insets:0,alignment:'left',verticalAlignment:'middle',wrap:'none',autoFit:'none',...style};
  return s;
}
export function L(s,name,x1,y1,x2,y2,color=C.line,width=2,dashed=false,arrow=false){
  if(arrow){return s.shapes.add({geometry:'connector',name,kind:'straight',position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1),horizontalFlip:x2<x1,verticalFlip:y2<y1},line:{fill:color,width,style:dashed?'dashed':'solid'},tail:{type:'triangle',width:'sm',length:'sm'}});}
  return s.shapes.add({geometry:'line',name,position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)},fill:'none',line:{fill:color,width,style:dashed?'dashed':'solid'}});
}
export function B(s,name,x,y,w,h,fill=C.soft,stroke='none',radius=0){return s.shapes.add({geometry:radius?'roundRect':'rect',name,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1.2},...(radius?{borderRadius:radius}:{})});}
export function D(s,name,cx,cy,r=6,fill=C.blue,stroke='none',dashed=false){return s.shapes.add({geometry:'ellipse',name,position:{left:cx-r,top:cy-r,width:r*2,height:r*2},fill,line:{fill:stroke,width:stroke==='none'?0:1.6,style:dashed?'dashed':'solid'}});}
export async function IMG(s,file,x,y,w,h,alt,crop){return s.images.add({blob:new Uint8Array(await fs.readFile(path.join(ROOT,file))),contentType:file.endsWith('.jpg')?'image/jpeg':'image/png',alt,fit:'contain',position:{left:x,top:y,width:w,height:h},...(crop?{crop}:{})});}
export function title(s,value,sub='',status=''){
  s.background.fill=C.white;
  T(s,'title',value,64,40,1152,52,value.length>20?35:38,{bold:true,color:C.red});
  if(sub)T(s,'subtitle',sub,64,104,1152,38,23,{color:C.muted});
  if(status)T(s,'status',status,64,566,1152,31,18,{color:C.muted});
}
export function sources(s,refs,page){
  refs=(refs??[]).filter(r=>r.kind!=='project'&&/^https:\/\//.test(r.url??''));
  let x=64;if(refs.length){T(s,'source-prefix','资料：',x,611,46,24,14.5,{color:C.muted});x+=46;}
  for(const [i,r]of refs.slice(0,4).entries()){
    const label=r.label.length>23?r.label.slice(0,22)+'…':r.label;
    ctx.font=`14.5px "${FONT}"`;const w=Math.min(ctx.measureText(label).width+12,325);
    const t=T(s,'source-'+i,label,x,611,w,24,14.5,{color:C.muted,raw:true});
    if(r.url)t.text.get(label).link={uri:r.url,isExternal:true};x+=w+12;
    if(x>1120)break;
  }
  T(s,'content-page',String(page),1170,611,44,24,14.5,{color:C.muted,alignment:'right'});
}
export function replaceSources(s,refs,page){
  for(const shape of [...s.shapes.items]){
    const name=shape.name??shape.toSnapshot().name??'';
    if(/^(source-prefix|source-\d+|slide-sources|page-sources|content-page)$/.test(name))shape.delete();
    else if(name==='icon-credit')shape.position={...shape.position,top:611,height:24};
  }
  sources(s,refs,page);
}
export function notes(s,item){
  let text=item.speakerNotes??'';
  if(item.sources?.length&&!item.sources.every(r=>text.includes(r.url)))text+='\n\n原始参考资料\n'+item.sources.map((r,i)=>`[${i+1}] ${r.label}\n${r.url}\n${r.version??''}`).join('\n\n');
  const boundaries=(item.boundaries??[]).filter(x=>!/本页只引用|artifacts\/|docs\//.test(x));
  if(boundaries.length)text+='\n\n讲述边界\n'+boundaries.join('\n');
  s.speakerNotes.text=text;
}
export function rowList(s,items,x,y,w,gap=67,size=24,color=C.ink){
  items.forEach((item,i)=>{T(s,'row-number-'+i,String(i+1).padStart(2,'0'),x,y+i*gap,45,32,18,{color:C.muted});T(s,'row-label-'+i,item,x+58,y+i*gap,w-58,gap-8,size,{color});});
}
export function rail(s,labels,x=100,y=262,w=1080,{size=23,details=[],colors=[],optional=-1,labelHeight=67}={}){
  const step=w/(labels.length-1);L(s,'rail',x,y,x+w,y,C.line,2.5);
  labels.forEach((label,i)=>{const cx=x+i*step,col=colors[i]??C.blue;D(s,'milestone-'+i,cx,y,20,i===optional?C.white:C.pale,col,i===optional);T(s,'milestone-number-'+i,String(i+1),cx-16,y-15,32,30,19,{alignment:'center',color:col});T(s,'rail-label-'+i,label,cx-step*.43,y+38,step*.86,labelHeight,size,{alignment:'center',bold:true});if(details[i])T(s,'rail-detail-'+i,details[i],cx-step*.44,y+109,step*.88,76,19,{alignment:'center',color:C.muted});});
}
export function table(s,values,x,y,width,height,colWidths,size=21){
  const rows=values.length,cols=values[0].length;
  const t=s.tables.add({rows,columns:cols,left:x,top:y,width,height,values,columnWidths:colWidths});
  t.styleOptions={headerRow:true,bandedRows:false};t.borders.assign({style:'solid',fill:C.line,width:.7});
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const cell=t.getCell(r,c);cell.fill=r===0?C.soft:C.white;
    cell.text.style={typeface:FONT,fontSize:size,bold:r===0,color:r===0?C.ink:C.muted,verticalAlignment:'middle',alignment:'left',insets:12,wrap:'square',autoFit:'none'};
  }
  return t;
}

// Prefix identifiers in documented serialized models before combining decks.
function namespaced(proto,prefix){
  const m=new Map();function collect(v){if(!v||typeof v!=='object')return;if(typeof v.id==='string')m.set(v.id,prefix+v.id);for(const x of Object.values(v))if(typeof x==='object')collect(x);}
  collect(proto);
  function copy(v,key=''){
    if(v instanceof Uint8Array)return new Uint8Array(v);
    if(Array.isArray(v))return v.map(x=>copy(x,key));
    if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,copy(x,k)]));
    if(typeof v==='string'&&m.has(v)&&(key==='id'||/Ids?$/.test(key)||key==='ref'))return m.get(v);
    return v;
  }
  return copy(proto);
}
const replacement=new Map([
  ['#216D7A',C.blue],['216D7A',C.blue.slice(1)],['#E9F2F3',C.pale],['E9F2F3',C.pale.slice(1)],
  ['#F3F8F9',C.pale],['F3F8F9',C.pale.slice(1)],['#A2B6BF',C.line],['A2B6BF',C.line.slice(1)],
  ['#7B9BA5','#9AA0A6'],['7B9BA5','9AA0A6'],['#607D88',C.muted],['607D88',C.muted.slice(1)],
  ['#435C6A','#3C4043'],['435C6A','3C4043'],['#20292F',C.ink],['20292F',C.ink.slice(1)],['#63717A',C.muted],['63717A',C.muted.slice(1)],
]);
function recolor(v){if(v instanceof Uint8Array)return v;if(Array.isArray(v))return v.map(recolor);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,recolor(x)]));return replacement.get(v)??v;}
export function shrink(s,f=.94){
  for(const e of [...s.shapes.items,...s.images.items]){
    const r=e.position; if(!r)continue;
    e.position={left:64+(r.left-64)*f,top:40+(r.top-40)*f,width:r.width*f,height:r.height*f};
    if(e.text){const fs=e.text.fontSize;if(typeof fs==='number'&&fs>0)e.text.fontSize=fs*f;}
  }
}
export async function approvedSlides(){
  const a=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'artifacts/report/01_搬箱任务与数据管线全貌_v4.pptx')));
  const b=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'artifacts/report/02_真机采集的设备分工_v3.pptx')));
  const pa=namespaced(a.toProto(),'intro_');const pb=recolor(namespaced(b.toProto(),'devices_'));
  for(const image of pb.images??[]){
    if(image.contentType==='image/svg+xml'&&image.data){
      let svg=Buffer.from(image.data).toString('utf8');for(const [from,to]of replacement)if(from.startsWith('#'))svg=svg.replaceAll(from,to);image.data=new Uint8Array(Buffer.from(svg));
    }
  }
  const merged={...pb,slides:[pa.slides[0],pb.slides[0]],layouts:[...pa.layouts,...pb.layouts],images:[...pa.images,...pb.images],charts:[...pa.charts,...pb.charts],fonts:[...pa.fonts,...pb.fonts]};
  merged.slides.forEach((s,i)=>s.index=i);const p=Presentation.load(merged);setTheme(p);for(const s of p.slides.items)shrink(s);
  return p;
}
