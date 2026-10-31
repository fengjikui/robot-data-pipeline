/* The daily workflow describes user goals, while technical controls stay available on demand. */
(() => {
  const app=window.Workbench,$=id=>document.getElementById(id);
  if(!app||!$('daily-main'))return;
  let data=null,latest=null;
  function openPreparation(refresh=true){window.WorkbenchShell?.showView('task');$('data-preparation-panel').open=true;$('data-preparation-panel').scrollIntoView({block:'start',behavior:'auto'});if(refresh)window.PreparationWorkbench?.refreshEpisodes();}
  function render(value){
    data=value;const total=value.assets?.length||0,count=(value.assets||[]).filter(a=>a.task===value.project?.task).length;latest=(value.jobs||[]).find(j=>j.stage==='prepare'&&j.status==='succeeded');
    $('daily-acquire-state').textContent=count?'本任务 '+count+' 份数据已入库':total?'本任务暂无数据 · 库内有历史数据':'还没有数据';
    $('daily-prepare-state').textContent=latest?(count?'文件已整理 · 训练转换待接入':'有历史整理结果 · 本轮待选择'):count?'可检查和整理':'有数据后自动检查';
    $('daily-stage-acquire').classList.toggle('done',count>0);$('daily-stage-prepare').classList.toggle('done',Boolean(latest?.result?.training_ready));
    $('daily-next-title').textContent=count?'检查一下，这轮准备用哪些数据？':'先为这个任务准备数据';
    $('daily-next-copy').textContent=!count&&total?'库中已有其他数据；当前任务还没有明确匹配的数据。可以开始采集或导入，也可展开下方手动选择已有数据。':latest?'已有历史整理结果。新增回合是否用于本轮训练，由你确认；原来的选择和结果会保留。':count?'工作台已经保留原始数据。查看回合结果，采用推荐数据或调整选择，再确认使用。':'自己采集，或导入已有数据。保存后的接收、入库和检查由工作台处理。';
    $('daily-main').textContent=count?'整理数据':'开始采集';$('daily-capture').hidden=!count;
    $('daily-result').hidden=!latest;
  }
  $('daily-main').addEventListener('click',()=>data?.assets?.some(a=>a.task===data.project?.task)?openPreparation():window.WorkbenchShell?.showView('capture'));
  $('daily-result').addEventListener('click',()=>latest&&window.WorkbenchShell?.openRun(latest.id));
  $('daily-capture').addEventListener('click',()=>window.WorkbenchShell?.showView('capture'));
  $('daily-import').addEventListener('click',()=>window.WorkbenchShell?.importData());
  document.addEventListener('workbench:state',event=>render(event.detail.data));
  window.DailyWorkflow={openPreparation};
})();
