from pathlib import Path
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
root=Path(__file__).resolve().parents[1]
f=FontProperties(fname='/System/Library/Fonts/STHeiti Light.ttc')
m=json.loads((root/'artifacts/bc_run/metrics.json').read_text())['metrics']['test']
labels=['轻量行为克隆模型','保持当前关节位置','固定训练集均值']
values=[m['bc_rmse_rad'],m['state_identity_rmse_rad'],m['train_mean_rmse_rad']]
fig,ax=plt.subplots(figsize=(12,6.8));fig.patch.set_facecolor('#f7f8fb');ax.set_facecolor('#f7f8fb')
ax.barh(range(3),values,color=['#3978ad','#32866b','#a6b3c4'],height=.52);ax.invert_yaxis()
ax.set_yticks(range(3),labels,fontproperties=f,fontsize=16);ax.set_xlim(0,.43)
for i,v in enumerate(values):ax.text(v+.005,i,f'{v:.4f}',va='center',fontsize=14,color='#263c55')
ax.set_xlabel('Joint target RMSE (rad)',fontsize=13);ax.grid(axis='x',alpha=.2);ax.set_axisbelow(True)
for edge in ax.spines.values():edge.set_visible(False)
fig.suptitle('真实开源 G1 数据上的测试结果',fontproperties=f,fontsize=24,x=.06,ha='left',color='#182b45')
fig.text(.06,.865,'16 个完整回合  按回合划分  测试 3962 帧  越低越好',fontproperties=f,fontsize=14,color='#50637b')
fig.text(.06,.07,'模型测试表现仍弱于保持当前状态的基线  离线误差不能替代任务成功率',fontproperties=f,fontsize=14,color='#8a4d23')
fig.subplots_adjust(left=.26,right=.95,top=.78,bottom=.2)
fig.savefig(root/'artifacts/figures/03_training_results.png',dpi=160);plt.close(fig)
