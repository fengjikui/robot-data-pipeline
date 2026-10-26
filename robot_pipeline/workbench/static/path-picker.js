"use strict";

window.WorkbenchPathPicker = {
  init({api, notify}) {
    let pending = false;
    for (const button of document.querySelectorAll('[data-path-input]')) {
      button.addEventListener('click', async () => {
        if (pending) return;
        pending = true;
        const input = document.getElementById(button.dataset.pathInput);
        const label = button.textContent;
        button.disabled = true;
        button.textContent = '等待系统选择…';
        try {
          const result = await api('/api/paths/pick', {initial_path: input.value.trim() || null});
          if (result.cancelled) {
            notify('已取消目录选择，原路径保持不变。');
          } else {
            input.value = result.path;
            input.dispatchEvent(new Event('input', {bubbles: true}));
            notify('目录已选择，请核对后保存配置或导入数据。', 'success');
          }
        } catch (error) { notify(error.message, 'error', true); }
        finally {
          pending = false;
          button.disabled = false;
          button.textContent = label;
          input.focus();
        }
      });
    }
  }
};
