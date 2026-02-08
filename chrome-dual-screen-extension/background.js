// background.js

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source !== 'DUAL_SCREEN_SDK') return;

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
      sendResponse({ 
        source: 'DUAL_SCREEN_EXT', 
        action: 'RESPONSE', 
        reqId: message.reqId, 
        error: error.message 
      });
    });

  return true; // 保持消息通道开启以进行异步响应
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'GET_DISPLAYS':
      return await getDisplays();
    case 'OPEN_WINDOW':
      return await openWindow(message.payload);
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
  const { url, displayId, left, top, width, height, type } = payload;
  
  // 默认配置
  let createData = {
    url: url,
    type: type || 'popup', // 'popup' 只有标题栏，更像应用窗口；'normal' 有地址栏
  };

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
  return { windowId: newWindow.id, tabId: newWindow.tabs[0].id };
}

async function broadcastData(payload, sender) {
  // 获取所有标签页
  const tabs = await chrome.tabs.query({});
  
  const promises = tabs.map(tab => {
    // 跳过发送者自己
    if (sender.tab && tab.id === sender.tab.id) return Promise.resolve();
    
    // 发送给其他 Tab 的 Content Script
    return chrome.tabs.sendMessage(tab.id, {
      source: 'DUAL_SCREEN_EXT',
      action: 'DATA_RECEIVED',
      payload: payload
    }).catch(() => {
      // 忽略无法接收消息的 Tab（例如没有注入 content script 的页面）
    });
  });

  await Promise.all(promises);
  return { status: 'broadcasted', count: tabs.length - 1 };
}
