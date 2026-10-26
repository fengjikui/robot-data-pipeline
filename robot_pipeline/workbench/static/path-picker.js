"use strict";

// Shared directory control. Add data-path-input="<input-id>" to another path button.
window.WorkbenchPathPicker = {
  init({api, notify}) {
    const $ = (id) => document.getElementById(id);
    const dialog = $("path-picker");
    const picker = {input: null, trigger: null, path: null, parent: null, page: null, sequence: 0, timer: null};

    function node(tag, text, className) {
      const element = document.createElement(tag);
      if (text !== undefined) element.textContent = text;
      if (className) element.className = className;
      return element;
    }

    function renderRoots(roots) {
      $("picker-roots").replaceChildren();
      for (const root of roots) {
        const button = node("button", root.label, "button small");
        button.type = "button";
        button.addEventListener("click", () => navigate(root.path));
        $("picker-roots").append(button);
      }
    }

    async function load(path, {append = false, query = "", offset = 0} = {}) {
      const sequence = ++picker.sequence;
      $("picker-status").textContent = "正在读取文件夹…";
      $("picker-list").setAttribute("aria-busy", "true");
      $("picker-confirm").disabled = true;
      $("picker-more").hidden = true;
      if (!append) $("picker-list").replaceChildren();
      try {
        const page = await api("/api/paths/list", {path: path || null, query, offset});
        if (sequence !== picker.sequence || !dialog.open) return;
        picker.path = page.path;
        picker.parent = page.parent;
        picker.page = page;
        $("picker-location").value = page.path;
        $("picker-selection").textContent = page.path;
        $("picker-parent").disabled = !page.parent;
        $("picker-confirm").disabled = false;
        renderRoots(page.roots);
        for (const entry of page.entries) {
          const button = node("button", undefined, "picker-entry");
          button.type = "button";
          button.disabled = !entry.selectable;
          button.title = entry.reason || entry.path;
          button.setAttribute("aria-label", "打开文件夹 " + entry.name + (entry.reason ? "，" + entry.reason : ""));
          const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          icon.setAttribute("viewBox", "0 0 24 24");
          icon.setAttribute("fill", "none");
          icon.setAttribute("aria-hidden", "true");
          const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
          outline.setAttribute("d", "M3 7h7l2-3h7a2 2 0 0 1 2 2v13H3V7Zm0 2h18");
          icon.append(outline);
          button.append(icon, node("span", entry.name));
          if (entry.reason) button.append(node("small", entry.reason));
          button.addEventListener("click", () => navigate(entry.path));
          $("picker-list").append(button);
        }
        const shown = page.offset + page.entries.length;
        $("picker-status").textContent = page.total ? `已显示 ${shown} / ${page.total} 个目录` : query ? "没有匹配的子目录，可清空筛选或选择当前目录。" : "没有子目录，可以直接选择当前目录。";
        if (page.scan_truncated) $("picker-status").textContent += " 项目较多，请输入更具体的目录路径。";
        $("picker-more").hidden = !page.has_more;
      } catch (error) {
        if (sequence !== picker.sequence || !dialog.open) return;
        $("picker-status").textContent = error.message;
        $("picker-selection").textContent = "请选择可读取的目录";
        picker.path = null;
        picker.page = null;
        // Home remains available even if the manually typed initial path is invalid.
        if (!$("picker-roots").childNodes.length) {
          const home = node("button", "主目录", "button small");
          home.type = "button";
          home.addEventListener("click", () => navigate(null));
          $("picker-roots").append(home);
        }
      } finally {
        if (sequence === picker.sequence) $("picker-list").setAttribute("aria-busy", "false");
      }
    }

    function navigate(path) {
      clearTimeout(picker.timer);
      $("picker-query").value = "";
      load(path);
    }

    for (const button of document.querySelectorAll("[data-path-input]")) {
      button.addEventListener("click", () => {
        picker.input = $(button.dataset.pathInput);
        picker.trigger = button;
        picker.path = null;
        picker.parent = null;
        $("picker-location").value = picker.input.value.trim();
        $("picker-query").value = "";
        $("picker-roots").replaceChildren();
        $("picker-selection").textContent = "读取中…";
        $("picker-parent").disabled = true;
        dialog.showModal();
        load(picker.input.value.trim() || null);
      });
    }
    $("picker-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => {
      clearTimeout(picker.timer);
      picker.sequence++;
      picker.trigger?.focus();
    });
    $("picker-location-form").addEventListener("submit", (event) => {
      event.preventDefault();
      navigate($("picker-location").value.trim());
    });
    $("picker-parent").addEventListener("click", () => { if (picker.parent) navigate(picker.parent); });
    $("picker-query").addEventListener("input", () => {
      clearTimeout(picker.timer);
      if (picker.path) picker.timer = setTimeout(() => load(picker.path, {query: $("picker-query").value.trim()}), 200);
    });
    $("picker-more").addEventListener("click", () => {
      if (picker.page?.has_more) load(picker.path, {append: true, query: $("picker-query").value.trim(), offset: picker.page.next_offset});
    });
    $("picker-confirm").addEventListener("click", () => {
      if (!picker.path) return;
      picker.input.value = picker.path;
      picker.input.dispatchEvent(new Event("input", {bubbles: true}));
      dialog.close();
      picker.input.focus();
      notify("目录已选择，填写来源信息后可确认复制入库。", "success");
    });
  }
};
