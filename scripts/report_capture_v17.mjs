import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,C,T,L,B,D,IMG} from './report_common.mjs';

export async function captureScene(s){
  // Shared anchors preserve the original equipment and logical-flow composition.
  const net='#C8CDD3', state='#626970';

  await IMG(s,'assets/report_slide02/official_teleop_diagram.png',64,177,140,79,'Vision Pro，原设备图裁剪',{left:1750/3415,top:65/2465,right:1-1975/3415,bottom:1-190/2465});
  T(s,'vision-name','Apple Vision Pro',64,266,265,32,23,{bold:true});
  T(s,'vision-program','Safari / WebXR',64,304,240,26,18,{color:C.blue});
  const icon=async(name,x,y,w,h)=>{const svg=(await fs.readFile(path.join(ROOT,'assets/report_icons/lucide-0.468.0',name+'.svg'),'utf8')).replaceAll('currentColor',name==='router'?C.muted:C.ink);s.images.add({svg,alt:name==='router'?'Wi-Fi / AP':'Host外部主机',fit:'contain',position:{left:x,top:y,width:w,height:h}});};
  await icon('router',391,188,43,40);
  T(s,'ap-name','Wi-Fi / AP',369,232,150,27,18,{color:C.muted});
  T(s,'ap-access','可访问 Host 与 PC2',340,261,250,25,16.6,{color:C.muted});
  await icon('laptop',76,371,110,78);
  T(s,'host-name','Host 外部主机',64,455,268,30,23,{bold:true});
  T(s,'host-program','teleop_hand_and_arm.py',64,490,274,27,17.7,{raw:true,color:C.blue});
  T(s,'host-role','主程序组织图像、追踪、IK与SDK，组合数据并按回合保存',64,519,561,20,15.5,{color:C.muted});

  await IMG(s,'assets/report_slide02/g1_illustration_v1.png',600,160,240,360,'沿用已确认的G1外形说明插图，非实机照片');
  // Physical network: no arrows. Logical channels below use their own arrowheads.
  L(s,'physical-wifi-left',204,215,391,215,net,1.2,true);
  L(s,'physical-wifi-right',434,215,650,215,net,1.2,true);
  L(s,'physical-wifi-pc2-a',650,215,650,255,net,1.2,true);
  L(s,'physical-wifi-pc2-b',650,255,678,255,net,1.2,true);
  L(s,'physical-wifi-down',329,215,329,401,net,1.2,true);
  L(s,'physical-wifi-host',186,401,329,401,net,1.2,true);
  L(s,'physical-wire-a',186,442,556,442,net,3);
  L(s,'physical-wire-b',556,442,556,295,net,3);
  L(s,'physical-wire-c',556,295,678,295,net,3);
  L(s,'switch-bus',678,255,678,295,net,2);
  L(s,'switch-pc2',678,255,697,255,net,2);
  L(s,'switch-pc1',678,291,697,291,net,2);

  B(s,'pc2-body',697,241,70,30,C.pale,C.blue); T(s,'pc2-body-label','PC2',697,241,70,30,20.5,{color:C.blue,alignment:'center',bold:true});
  B(s,'pc1-body',697,279,70,25,C.soft,C.line); T(s,'pc1-body-label','运控 PC1',697,279,70,25,14.1,{alignment:'center',color:C.muted});

  // Logical channels reuse the exact equipment anchors. They do not represent extra cables.
  L(s,'tracking',199,337,199,368,C.red,2.3,false,true); T(s,'tracking-caption','头手姿态',216,337,152,26,18,{color:C.red});
  const paths=[
    ['control',[[202,431],[579,431],[579,292],[697,292]],C.red],
    ['image',[[697,257],[535,257],[535,384],[202,384]],C.blue],
    ['state',[[697,310],[603,310],[603,411],[202,411]],state],
  ];
  for(const [name,pts,col]of paths)for(let i=0;i<pts.length-1;i++)L(s,name+'-'+i,...pts[i],...pts[i+1],col,2.2,false,i===pts.length-2);
  T(s,'image-caption','图像：显示与记录',341,350,232,27,17.6,{color:C.blue});
  T(s,'state-caption','实际状态：Host 直接订阅',341,389,300,20,16.4,{color:state});
  T(s,'action-caption','IK / 重定向后的目标动作',341,459,300,27,17.5,{color:C.red});
  T(s,'wire-caption','网线：接入机器人交换网络',341,491,340,26,17.3,{color:C.muted});
  L(s,'webrtc-a',697,246,614,246,C.blue,1.5,true);
  L(s,'webrtc-b',614,246,614,169,C.blue,1.5,true);
  L(s,'webrtc-c',614,169,216,169,C.blue,1.5,true,true);
  T(s,'webrtc-caption','WebRTC 显示路径（按配置）',310,143,330,25,17,{color:C.blue});

  // Programs replace the old table and sit beside the units that actually run them.
  D(s,'head-camera-dot',725,182,3.5,C.blue); L(s,'head-camera-leader',730,182,877,182,C.line,1);
  T(s,'head-camera-head','头部视角相机',898,164,318,29,22,{bold:true});
  T(s,'head-camera-role','第一视角图像',898,200,318,25,18,{color:C.muted});
  L(s,'pc2-leader',767,256,877,256,C.line,1);
  T(s,'pc2-head','机内 PC2：独立计算单元',898,241,318,29,21.5,{bold:true,color:C.blue});
  T(s,'pc2-program','teleimager-server',898,275,318,27,18.5,{raw:true,color:C.blue});
  T(s,'pc2-role','读取相机，按配置发布图像',898,308,318,25,17.8,{color:C.muted});
  L(s,'pc1-leader',767,292,861,292,C.line,1); L(s,'pc1-leader-down',861,292,861,360,C.line,1); L(s,'pc1-leader-end',861,360,877,360,C.line,1);
  T(s,'pc1-head','运控 PC1 与关节',898,347,318,29,21.5,{bold:true});
  T(s,'pc1-program','厂商运控与状态服务，SDK / DDS',898,382,318,26,17.3,{color:C.muted});
  T(s,'pc1-role','执行目标，反馈实际状态',898,415,318,25,17.8,{color:C.muted});
  D(s,'wrist-camera-dot',782,329,3.5,C.blue); L(s,'wrist-camera-leader',787,329,837,329,C.line,1); L(s,'wrist-camera-down',837,329,837,476,C.line,1); L(s,'wrist-camera-end',837,476,877,476,C.line,1);
  T(s,'wrist-head','腕部相机（选配）',898,459,318,29,21.5,{bold:true});
  T(s,'wrist-role','补充近距离操作视角',898,494,318,25,17.8,{color:C.muted});

  const labels=['基础状态检查','PC2 图像服务','Host 主程序','头显 XR 会话','随动 / 录制'];
  L(s,'startup-line',149,555,1110,555,C.line,2.3);
  labels.forEach((label,i)=>{const x=149+i*240.25;D(s,'startup-dot-'+i,x,555,16,C.pale,C.blue);T(s,'startup-n-'+i,String(i+1),x-14,541,28,28,17.5,{alignment:'center',color:C.blue});T(s,'startup-label-'+i,label,x-107,581,214,29,19.5,{bold:true,alignment:'center'});});
  T(s,'startup-keys','G1_29 + Dex3参考配置，首次部署后。启动涉及控制准备，r随动，s开始/结束回合，等保存后退出。',64,615,1152,20,14.8,{color:C.muted});
  T(s,'configuration-note','机内为功能分区，相机与手型以到货配置为准。',650,521,566,20,14.2,{color:C.muted});
}
