// background.js

// 监听来自 Content Script 的消息
const connectedTabs = new Set();
let activeWindows = new Map(); // url -> windowId
const tabHeartbeats = new Map(); // tabId -> lastSeen

// 初始化：尝试从 storage 恢复 activeWindows
// Service Worker 可能在空闲时被终止，重启后内存数据丢失
// 我们需要将关键状态持久化到 session storage
chrome.storage.session.get(['activeWindows'], (result) => {
  if (result.activeWindows && Array.isArray(result.activeWindows)) {
    activeWindows = new Map(result.activeWindows);
    console.log('Restored activeWindows from storage:', activeWindows);
  }
});

// 辅助函数：保存 activeWindows 到 storage
function saveActiveWindows() {
  chrome.storage.session.set({
    activeWindows: Array.from(activeWindows.entries())
  });
}

// 定时检查心跳 (每 5 秒检查一次)
setInterval(() => {
  const now = Date.now();
  const timeout = 15000; // 15秒无响应判定为崩溃

  for (const [tabId, lastSeen] of tabHeartbeats.entries()) {
    if (now - lastSeen > timeout) {
      console.log(`Tab ${tabId} heartbeat timeout, possible crash.`);
      handleTabCrash(tabId);
    }
  }
}, 5000);

async function handleTabCrash(tabId) {
  let windowId = null;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab) windowId = tab.windowId;
  } catch (e) {
    // Tab 可能已经完全消失
  }

  tabHeartbeats.delete(tabId);
  connectedTabs.delete(tabId);

  // 广播崩溃消息
  broadcastData({
    type: 'WINDOW_CRASHED',
    tabId: tabId,
    windowId: windowId
  }, { tab: null });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source !== 'DUAL_SCREEN_SDK') return;

  // 立即返回 true，表示我们将异步处理响应
  handleMessage(message, sender)
    .then(response => {
      sendResponse({ 
        source: 'DUAL_SCREEN_EXT', 
        action: 'RESPONSE', 
        reqId: message.reqId, 
        payload: response 
      });
    })
    .catch(error => {
      console.error("Handler Error:", error);
      sendResponse({ 
        source: 'DUAL_SCREEN_EXT', 
        action: 'RESPONSE', 
        reqId: message.reqId, 
        error: error.message 
      });
    });

  return true; // 保持消息通道开启以进行异步响应
});

// 监听 Tab 关闭，移除已注册的连接
chrome.tabs.onRemoved.addListener((tabId) => {
  connectedTabs.delete(tabId);
});

// 监听窗口关闭，移除单例映射，并通知所有客户端
chrome.windows.onRemoved.addListener((windowId) => {
  let closedUrl = null;
  for (const [url, id] of activeWindows.entries()) {
    if (id === windowId) {
      activeWindows.delete(url);
      saveActiveWindows();
      closedUrl = url;
      break;
    }
  }

  // 无论是否是受控窗口，都广播一个事件，让 SDK 知道有窗口关闭了
  // 如果是受控窗口，带上 url 信息
  broadcastData({
    type: 'WINDOW_CLOSED',
    windowId: windowId,
    url: closedUrl
  }, { tab: null }); // sender 为 null 表示系统消息
});

// 监听窗口状态变化 (位置、大小、状态)
const boundsChangeTimers = new Map(); // windowId -> timerId

chrome.windows.onBoundsChanged.addListener((window) => {
  // 只关注受控窗口
  let isManaged = false;
  for (const id of activeWindows.values()) {
    if (id === window.id) {
      isManaged = true;
      break;
    }
  }
  if (!isManaged) return;

  // 防抖
  if (boundsChangeTimers.has(window.id)) {
    clearTimeout(boundsChangeTimers.get(window.id));
  }

  const timer = setTimeout(() => {
    broadcastData({
      type: 'WINDOW_STATE_CHANGED',
      windowId: window.id,
      state: window.state,
      bounds: {
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height
      }
    }, { tab: null });
    boundsChangeTimers.delete(window.id);
  }, 200);

  boundsChangeTimers.set(window.id, timer);
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'REGISTER_CLIENT':
      if (sender.tab) {
        connectedTabs.add(sender.tab.id);
        tabHeartbeats.set(sender.tab.id, Date.now()); // 初始化心跳
        return { success: true };
      }
      return { success: false, error: 'Not a tab sender' };
    case 'HEARTBEAT':
      if (sender.tab) {
        // 如果连接列表丢失（SW 重启），尝试恢复
        if (!connectedTabs.has(sender.tab.id)) {
          connectedTabs.add(sender.tab.id);
        }
        tabHeartbeats.set(sender.tab.id, Date.now());
        return { success: true };
      }
      return { success: false, error: 'Not a tab sender' };
    case 'GET_DISPLAYS':
      return await getDisplays();
    case 'OPEN_WINDOW':
      return await openWindow(message.payload);
    case 'CLOSE_WINDOW':
      return await closeWindow(message.payload);
    case 'BROADCAST_DATA':
      return await broadcastData(message.payload, sender);
    default:
      throw new Error(`Unknown action: ${message.action}`);
  }
}

async function getDisplays() {
  return new Promise((resolve) => {
    chrome.system.display.getInfo((displays) => {
      resolve(displays);
    });
  });
}

async function openWindow(payload) {
  const { url, displayId, left, top, width, height, type, state, reuse } = payload;
  
  // 1. 检查是否重用现有窗口
  if (reuse && activeWindows.has(url)) {
    const existingWindowId = activeWindows.get(url);
    try {
      const win = await chrome.windows.get(existingWindowId);
      if (win) {
        await chrome.windows.update(existingWindowId, { focused: true });
        return { windowId: existingWindowId, reused: true };
      }
    } catch (e) {
      // 窗口可能已被关闭但事件未触发或异常，清理记录
      activeWindows.delete(url);
    }
  }

  // 默认配置
  let createData = {
    url: url,
    type: type || 'popup', // 'popup' 只有标题栏，更像应用窗口；'normal' 有地址栏
  };

  if (state) {
    createData.state = state; // 'normal', 'minimized', 'maximized', 'fullscreen'
  }

  if (width) createData.width = width;
  if (height) createData.height = height;

  // 如果指定了 displayId，尝试找到该显示器并设置坐标
  if (displayId !== undefined) {
    const displays = await getDisplays();
    // 尝试匹配 id，注意 display.id 可能是 string
    const targetDisplay = displays.find(d => d.id === displayId) || displays[displayId]; // 支持索引或ID

    if (targetDisplay) {
      // 如果没有指定具体的 left/top，则默认居中或左上角
      createData.left = (left !== undefined) ? targetDisplay.bounds.left + left : targetDisplay.bounds.left;
      createData.top = (top !== undefined) ? targetDisplay.bounds.top + top : targetDisplay.bounds.top;
    }
  } else if (left !== undefined && top !== undefined) {
    // 直接使用绝对坐标
    createData.left = left;
    createData.top = top;
  }

  const newWindow = await chrome.windows.create(createData);
  
  // 记录打开的窗口
  activeWindows.set(url, newWindow.id);
  saveActiveWindows();

  return { windowId: newWindow.id, tabId: newWindow.tabs[0].id };
}

async function closeWindow(payload) {
  const { windowId } = payload;
  if (windowId) {
    await chrome.windows.remove(windowId);
    return { success: true };
  }
  return { success: false, error: 'Missing windowId' };
}

async function broadcastData(payload, sender) {
  // 只向已连接的客户端发送
  const tabIds = Array.from(connectedTabs);
  
  const promises = tabIds.map(tabId => {
    // 跳过发送者自己（如果 sender.tab 存在）
    if (sender && sender.tab && tabId === sender.tab.id) return Promise.resolve();
    
    // 发送给其他 Tab 的 Content Script
    return chrome.tabs.sendMessage(tabId, {
      source: 'DUAL_SCREEN_EXT',
      action: 'DATA_RECEIVED',
      payload: payload
    }).catch(() => {
      // 如果发送失败（例如 tab 已刷新但未重新注册），从列表中移除
      connectedTabs.delete(tabId);
    });
  });

  await Promise.all(promises);
}
