// ==================== 可用线路节点 ====================
var DEFAULT_NODES = [
  { id: "1", name: "线路 1 - Hysteria2", desc: "实时获取中..." },
  { id: "2", name: "线路 2 - Hysteria",  desc: "实时获取中..." },
];

// ==================== DOM 引用 ====================
var $ = function (s) { return document.querySelector(s); };
var masterToggle = $("#masterToggle");
var segmented = $("#segmented");
var statusDot = $("#statusDot");
var statusText = $("#statusText");
var nodeList = $("#nodeList");
var btnRefresh = $("#btnRefresh");
var autoSelect = $("#autoSelect");

// ==================== 加载状态 ====================
async function load() {
  var storage = await chrome.storage.local.get([
    "enabled", "mode", "activeNode", "nodeStatus", "autoSelect", "nodeInfo",
  ]);

  var enabled = storage.enabled === true;
  var mode = storage.mode || "rule";
  var activeId = storage.activeNode || "1";
  var nodeStatus = storage.nodeStatus || {};
  var auto = storage.autoSelect === true;
  var nodeInfo = storage.nodeInfo || {};

  masterToggle.checked = enabled;

  var btns = segmented.querySelectorAll("button");
  btns.forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  autoSelect.checked = auto;

  updateStatusBar(enabled, mode, activeId, nodeStatus, nodeInfo);
  renderNodeList(enabled, mode, activeId, nodeStatus, nodeInfo);

  // 如果 nodeInfo 为空，请求后台获取
  if (!nodeInfo || Object.keys(nodeInfo).length === 0) {
    chrome.runtime.sendMessage({ action: "fetchNodeInfo" });
  }
}

// ==================== 状态栏 ====================
function updateStatusBar(enabled, mode, activeId, nodeStatus, nodeInfo) {
  statusDot.className = "status-dot";
  if (!enabled) {
    statusText.textContent = "代理已关闭";
    return;
  }
  if (mode === "direct") {
    statusText.textContent = "直连模式 - 不使用代理";
    return;
  }

  var info = (nodeInfo && nodeInfo[activeId]) || {};
  var loc = info.location || "?";
  var s = nodeStatus[activeId];

  if (s === "switching") {
    statusDot.classList.add("checking");
    statusText.textContent = "正在切换线路...";
  } else if (s === "ok") {
    statusDot.classList.add("ok");
    statusText.textContent = "连接正常 - " + loc;
  } else if (s === "down") {
    statusDot.classList.add("down");
    statusText.textContent = "无响应 - 请换线";
  } else {
    statusText.textContent = "未检测";
  }
}

// ==================== 节点列表 ====================
var _switchingPopup = false;

function renderNodeList(enabled, mode, activeId, nodeStatus, nodeInfo) {
  if (!enabled || mode === "direct") {
    nodeList.style.display = "none";
    return;
  }
  nodeList.style.display = "";

  var html = "";
  for (var i = 0; i < DEFAULT_NODES.length; i++) {
    var n = DEFAULT_NODES[i];
    var isActive = n.id === activeId;
    var s = nodeStatus[n.id] || "unknown";
    var info = (nodeInfo && nodeInfo[n.id]) || {};
    var detail = info.location ? info.location + " | " + (info.server || "?") : n.desc;

    html += '<div class="node-item' + (isActive ? " active" : "") + '" data-id="' + n.id + '">' +
      '<span class="radio"></span>' +
      '<div class="node-info">' +
        '<div class="node-name">' + esc(n.name) + '</div>' +
        '<div class="node-detail">' + esc(detail) + '</div>' +
      '</div>' +
      '<span class="node-status ' + s + '"></span>' +
    '</div>';
  }

  nodeList.innerHTML = html;

  var items = nodeList.querySelectorAll(".node-item");
  items.forEach(function (item) {
    item.addEventListener("click", async function () {
      if (_switchingPopup) return;
      if (item.dataset.id === activeId) return;

      _switchingPopup = true;
      var ns = {};
      ns[item.dataset.id] = "switching";
      await chrome.storage.local.set({ nodeStatus: ns });
      await chrome.storage.local.set({ activeNode: item.dataset.id });
      setTimeout(function () { _switchingPopup = false; }, 3000);
    });
  });
}

// ==================== 主开关 ====================
masterToggle.addEventListener("change", async function () {
  await chrome.storage.local.set({ enabled: masterToggle.checked });
});

// ==================== 分段控件 ====================
segmented.addEventListener("click", function (e) {
  if (e.target.tagName === "BUTTON" && e.target.dataset.mode) {
    chrome.storage.local.set({ mode: e.target.dataset.mode });
  }
});

// ==================== 刷新检测 ====================
btnRefresh.addEventListener("click", async function () {
  if (btnRefresh.disabled) return;
  btnRefresh.disabled = true;
  btnRefresh.textContent = "检测中...";

  try {
    var resp = await chrome.runtime.sendMessage({ action: "refreshNodes" });
    if (resp && resp.nodeStatus) {
      await load();
    }
  } catch (e) {
    statusText.textContent = "刷新失败: " + e.message;
  } finally {
    btnRefresh.disabled = false;
    btnRefresh.textContent = "刷新检测";
  }
});

// ==================== 自动选择 ====================
autoSelect.addEventListener("change", async function () {
  await chrome.storage.local.set({ autoSelect: autoSelect.checked });
});

// ==================== 监听存储变化 ====================
chrome.storage.onChanged.addListener(function (changes) {
  load();
});

// ==================== HTML 转义 ====================
function esc(s) {
  var d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

load();
