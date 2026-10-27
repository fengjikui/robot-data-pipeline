import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,C,T,PresentationFile,FileBlob} from './report_common.mjs';

const build=path.join(ROOT,'.build/full-report/v18');
await fs.mkdir(build,{recursive:true});
const p=await PresentationFile.importPptx(await FileBlob.load(path.join(ROOT,'artifacts/report/具身智能数据管线报告_v17.pptx')));
const s=p.slides.items[1];
T(s,'layer-topology-caption','设备与网络拓扑',898,118,318,27,19,{color:C.muted});
T(s,'layer-data-caption','控制、图像与实际反馈',898,118,318,27,19,{color:C.blue});
s.speakerNotes.text='本页分两步放映\n\n初始显示设备与物理网络，AP、网线文字同时显示。推进一次，物理网络及其文字消失，同时显示控制、图像、实际反馈与WebRTC路径及其文字。设备、机内分区、程序、启动时间线和资料出处保持可见。\n\nPowerPoint放映模式可使用鼠标单击、向右/向下推进，向左/向上退回上一动画。滚轮的行为需在实际播放软件中验证。编辑模式通常显示所有层，不用于判断初始放映状态。\n\n微软放映快捷键说明：https://support.microsoft.com/en-us/accessibility/powerpoint/use-keyboard-shortcuts-to-deliver-powerpoint-presentations\n\n'+s.speakerNotes.text;
await(await PresentationFile.exportPptx(p)).save(path.join(build,'authored.pptx'));
console.log('Prepared v18 native shapes and presenter notes.');
