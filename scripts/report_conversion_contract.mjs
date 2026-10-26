import {T,C,title,rail} from './report_common.mjs';

export function conversionPolicyContract(s,d){
  title(s,d.title,d.subtitle);
  rail(s,['采集','转换','训练'],244,218,792,{size:25,labelHeight:43});
  const columns=[
    ['本体 / 手型 / 相机\n状态与动作的记录范围\n任务、频率与时间信息','例：--arm G1_29 --ee dex3'],
    ['源字段、关节与相机映射\n文件组织与存储模式\n匹配源数据的本体配置','--robot-type\nUnitree_G1_Dex3'],
    ['策略实现与输入 / 输出\n时间窗口与归一化\n优化参数与运行设备','LeRobot 例：\n--policy.type act / diffusion'],
  ];
  columns.forEach(([detail,example],i)=>{
    const x=64+i*396;
    T(s,'config-detail-'+i,detail,x,331,360,109,22,{color:C.ink});
    T(s,'config-example-'+i,example,x,457,360,61,18,{color:C.muted,raw:true});
  });
  T(s,'mapping-persists','采集决定已有信号；转换仍要选对应映射，目标本体迁移另行适配。',64,548,1152,34,24,{bold:true,color:C.blue});
  T(s,'missing-signals','未记录的信号不能凭空补齐；在线 PPO 的交互环境与奖励需要另外设计。',64,585,1152,24,17.5,{color:C.muted});
}
