import {T,L,B,C,title} from './report_common.mjs';

export function externalIntakeRoutes(s,d){
  title(s,d.title,d.subtitle);
  T(s,'existing-flow','已介绍的流程：按交付阶段和适配结果选择接入位置',64,166,1152,31,21,{color:C.muted});
  const stages=[
    [64,200,'① 原始记录',''],
    [352,248,'② 质检与处理','增强 / 适配 / 转换'],
    [688,216,'③ 训练前验收',''],
    [992,224,'训练 / 评估 / 部署',''],
  ];
  stages.forEach(([x,w,label,sub],i)=>{
    B(s,'join-stage-'+i,x,210,w,69,i<3?C.pale:C.soft,i<3?C.blue:'none',4);
    T(s,'join-stage-label-'+i,label,x+8,sub?215:225,w-16,38,i===3?20:23,{bold:true,color:i<3?C.blue:C.ink,alignment:'center'});
    if(sub)T(s,'join-stage-detail-'+i,sub,x+8,250,w-16,23,17,{color:C.muted,alignment:'center'});
  });
  for(const [a,b]of [[264,332],[600,668],[904,972]])L(s,'flow-'+a,a,244,b,244,C.line,2,false,true);
  for(const [x,w,t]of [[64,246,'拿到的数据'],[352,566,'先核对，按缺项处理'],[992,224,'接入位置']])T(s,'route-heading-'+x,t,x,298,w,28,18,{color:C.muted});
  const rows=[
    ['原始传感 / 日志','按缺项解包、分段，核对时间与标定','① 原始记录'],
    ['已整理轨迹','核对字段、单位、坐标系和动作表达','② 质检与处理'],
    ['已有训练格式','核对读取器、配方、划分和统计量','③ 训练前验收'],
  ];
  rows.forEach((r,i)=>{
    const y=332+i*72;
    T(s,'incoming-'+i,r[0],64,y,246,43,22,{bold:true});
    L(s,'incoming-arrow-'+i,304,y+22,334,y+22,C.line,1.8,false,true);
    T(s,'prepare-'+i,r[1],352,y,566,43,21,{color:C.muted});
    L(s,'return-arrow-'+i,926,y+22,976,y+22,C.blue,1.8,false,true);
    B(s,'return-box-'+i,992,y,224,43,C.pale,'none',4);
    T(s,'return-label-'+i,r[2],1000,y,208,43,20,{color:C.blue,bold:true,alignment:'center'});
  });
  B(s,'extra-route',64,548,1152,54,C.soft);
  T(s,'extra-route-title','额外分支',80,556,124,35,20,{bold:true});
  T(s,'extra-route-detail','本体、动作语义或关键模态不匹配：可能需重定向、补标或补采，再回到核验。',220,552,974,46,19,{color:C.muted});
}
