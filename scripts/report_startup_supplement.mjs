import {T,C,title,table,rail} from './report_common.mjs';

export function startupSupplement(s,d){
  title(s,d.title,'备查：G1_29 + Dex3 参考配置，首次部署完成后的每次采集');
  table(s,[
    ['运行位置','程序 / 服务','对应前面的职责'],
    ['机器人运控侧','厂商运控与状态服务（检查复用）','执行目标，发布实际状态'],
    ['机内 PC2','teleimager-server','读取相机，按配置发布图像'],
    ['外部 Host','teleop_hand_and_arm.py','接收输入、解算动作、控制与回合记录'],
    ['Vision Pro','Safari 中的 WebXR 页面','提供头手追踪，显示第一视角'],
  ],64,169,1152,240,[204,433,515],20);
  T(s,'host-modules','Host 的图像客户端、televuer、IK / 手重定向、SDK 与记录器由主程序组织。',64,425,1152,29,18,{color:C.muted});
  rail(s,['基础状态检查','PC2 图像服务','Host 主程序','头显 XR 会话','随动 / 录制'],160,490,960,{size:20,labelHeight:36});
  T(s,'control-record-distinction','主程序启动已涉及控制准备。r 开始随动，s 开始 / 结束回合，保存完成后再退出。',64,577,1152,28,18,{color:C.muted});
}
