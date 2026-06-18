// ==================== 可用线路节点 ====================
var DEFAULT_NODES = [
  { id: "1", name: "线路 1 - 法国 Hysteria2", scheme: "http", host: "127.0.0.1", port: 7890 },
  { id: "2", name: "线路 2 - 法国 Hysteria",  scheme: "http", host: "127.0.0.1", port: 7890 },
];

var DEFAULTS = {
  enabled: false,
  mode: "rule",
  activeNode: "1",
  nodes: DEFAULT_NODES,
  nodeStatus: {},
  autoSelect: false,
};

// ==================== 加载 GFW 域名列表 ====================
importScripts("rules/gfw-domains.js");

// ==================== PAC 缓存 ====================
var pacCache = new Map();
var _refreshing = false;
var _switching = false;

// ==================== Helper API 地址 ====================
var HELPER_API = "http://127.0.0.1:9877";

// ==================== 获取线路信息 ====================
async function fetchNodeInfo() {
  try {
    var resp = await fetch(HELPER_API + "/status", { mode: "cors" });
    var data = await resp.json();
    if (data.node && data.location) {
      var nodeInfo = {};
      nodeInfo[String(data.node)] = {
        location: data.location || "?",
        server: data.server || "?",
        port: ""
      };
      await chrome.storage.local.set({ nodeInfo: nodeInfo });
    }
  } catch (e) {
    // helper 未启动，忽略
  }
}

// ==================== 初始化 ====================
async function init() {
  var storage = await chrome.storage.local.get([
    "enabled", "mode", "activeNode", "nodes", "nodeStatus", "autoSelect",
  ]);
  if (!storage.nodes || storage.nodes.length === 0) {
    await chrome.storage.local.set(DEFAULTS);
  }
  // 浏览器启动时强制关闭代理
  await chrome.storage.local.set({ enabled: false });
  await applySettings();
  // 延迟获取线路信息（等 helper 就绪）
  setTimeout(function () { fetchNodeInfo(); }, 3000);
}

// ==================== 获取节点配置 ====================
function getNode(id) {
  return DEFAULT_NODES.find(function (n) { return n.id === id; }) || DEFAULT_NODES[0];
}

// ==================== 构建内联 PAC 脚本 ====================
function buildPacScript(proxyLine) {
  // 所有线路都用同一个端口，PAC 脚本与节点无关
  var key = "pac";
  if (pacCache.has(key)) return pacCache.get(key);

  var entries = [];
  for (var i = 0; i < GFW_DOMAINS.length; i++) {
    entries.push('_d["' + GFW_DOMAINS[i] + '"]=1');
  }

  var pac = 'function FindProxyForURL(url,host){' +
    'if(!host||isPlainHostName(host))return"DIRECT";' +
    'if(/^\\d+\\.\\d+\\.\\d+\\.\\d+$/.test(host))return"DIRECT";' +
    'host=host.toLowerCase();' +
    'var d=host;' +
    'while(1){' +
    'if(_d[d])return"PROXY 127.0.0.1:7890";' +
    'var i=d.indexOf(".");' +
    'if(i<0)return"DIRECT";' +
    'd=d.substring(i+1);' +
    '}' +
    '}' +
    'var _d={};' +
    entries.join(";") + ';';

  pacCache.set(key, pac);
  return pac;
}

// ==================== 应用代理设置 ====================
async function applySettings() {
  if (_refreshing || _switching) return;

  var storage = await chrome.storage.local.get([
    "enabled", "mode", "activeNode", "nodeStatus",
  ]);

  var enabled = storage.enabled === true;
  var mode = storage.mode || "rule";
  var activeId = storage.activeNode || "1";
  var nodeStatus = storage.nodeStatus || {};

  if (!enabled) {
    await chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });
    await chrome.action.setBadgeText({ text: "" });
    await chrome.action.setIcon({ path: { "16": "icon16_off.png", "48": "icon48_off.png", "128": "icon128_off.png" } });
    return;
  }

  try {
    if (mode === "direct") {
      await chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });
    } else if (mode === "global") {
      // 固定指向 Clash 端口，Clash 后端负责实际线路
      await chrome.proxy.settings.set({
        value: {
          mode: "fixed_servers",
          rules: { singleProxy: { scheme: "http", host: "127.0.0.1", port: 7890 } },
        },
        scope: "regular",
      });
    } else {
      // 规则模式：PAC 脚本
      var pacData = buildPacScript();
      await chrome.proxy.settings.set({
        value: { mode: "pac_script", pacScript: { data: pacData } },
        scope: "regular",
      });
    }

    // 更新 Badge
    var status = nodeStatus[activeId];
    if (status === "ok") {
      await chrome.action.setBadgeText({ text: "ON" });
      await chrome.action.setBadgeBackgroundColor({ color: "#34c759" });
    } else if (status === "down") {
      await chrome.action.setBadgeText({ text: "!" });
      await chrome.action.setBadgeBackgroundColor({ color: "#ff3b30" });
    } else {
      await chrome.action.setBadgeText({ text: "ON" });
      await chrome.action.setBadgeBackgroundColor({ color: "#007aff" });
    }
    await chrome.action.setIcon({ path: { "16": "icon16.png", "48": "icon48.png", "128": "icon128.png" } });
  } catch (err) {
    console.error("[代理开关] 设置代理失败:", err.message);
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ff3b30" });
  }
}

// ==================== 调用 Helper API 切换线路 ====================
async function switchLine(lineId) {
  _switching = true;
  try {
    var resp = await fetch(HELPER_API + "/switch?id=" + lineId, { mode: "cors" });
    var data = await resp.json();
    if (data.ok) {
      // 保存线路信息（地区、服务器）到 storage
      var nodeInfo = {};
      nodeInfo[lineId] = {
        location: data.location || "?",
        server: data.server || "?",
        port: data.port || "?"
      };
      await chrome.storage.local.set({ nodeInfo: nodeInfo });
    }
    return data.ok === true;
  } catch (e) {
    console.error("[代理开关] 切换线路失败:", e.message);
    return false;
  } finally {
    _switching = false;
  }
}

// ==================== 检查当前节点是否可用 ====================
async function checkCurrentNode() {
  try {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 3000);
    await fetch("https://www.google.com", { mode: "no-cors", signal: controller.signal });
    clearTimeout(timeoutId);
    return "ok";
  } catch (e) {
    return "down";
  }
}

// ==================== 批量刷新所有节点 ====================
// 注意：刷新时切换线路会重启 Clash，所以只检查当前线路
async function refreshAllNodes() {
  _refreshing = true;
  var prev = await chrome.storage.local.get([
    "enabled", "mode", "activeNode", "nodeStatus", "autoSelect",
  ]);
  var status = prev.nodeStatus || {};

  // 初始化所有节点为 unknown
  for (var i = 0; i < DEFAULT_NODES.length; i++) {
    if (!status[DEFAULT_NODES[i].id]) status[DEFAULT_NODES[i].id] = "unknown";
  }

  // 检查当前线路
  var activeId = prev.activeNode || "1";
  status[activeId] = "checking";
  await chrome.storage.local.set({ nodeStatus: status });

  status[activeId] = await checkCurrentNode();
  await chrome.storage.local.set({ nodeStatus: status });

  // 如果当前线路不可用且有自动选择，尝试切换
  if (status[activeId] === "down" && prev.autoSelect) {
    for (var j = 0; j < DEFAULT_NODES.length; j++) {
      var nid = DEFAULT_NODES[j].id;
      if (nid === activeId) continue;
      // 尝试切换
      var switched = await switchLine(nid);
      if (switched) {
        status[nid] = await checkCurrentNode();
        if (status[nid] === "ok") {
          await chrome.storage.local.set({ activeNode: nid, nodeStatus: status });
          break;
        }
      }
    }
  }

  _refreshing = false;
  await applySettings();
  return status;
}

// ==================== 事件监听 ====================
chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

chrome.storage.onChanged.addListener(function (changes) {
  if (!_refreshing && !_switching) {
    if (changes.activeNode && changes.activeNode.newValue) {
      var newId = changes.activeNode.newValue;
      switchLine(newId).then(function (ok) {
        if (ok) {
          // 切换成功后检测连通性并更新状态
          return checkCurrentNode().then(function (result) {
            var statusUpdate = {};
            statusUpdate[newId] = result;
            return chrome.storage.local.set({ nodeStatus: statusUpdate });
          });
        } else {
          console.warn("[代理开关] 线路切换失败");
        }
      });
    }
    applySettings();
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === "refreshNodes") {
    refreshAllNodes().then(function (status) {
      sendResponse({ nodeStatus: status });
    });
    return true;
  }
  if (msg.action === "switchLine") {
    switchLine(msg.nodeId).then(function (ok) {
      sendResponse({ ok: ok });
    });
    return true;
  }
  if (msg.action === "fetchNodeInfo") {
    fetchNodeInfo().then(function () {
      sendResponse({ ok: true });
    });
    return true;
  }
});
