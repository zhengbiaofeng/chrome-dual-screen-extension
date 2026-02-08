// content.js

console.log('[Dual Screen Linker] Content script injected.');

// 1. 监听来自 Web 页面的消息 (Web -> Content -> Background)
window.addEventListener('message', (event) => {
  // 安全检查：只接受来自当前窗口的消息
  if (event.source !== window) return;

  const data = event.data;
  
  // 只处理特定标识的消息
  if (data && data.source === 'DUAL_SCREEN_SDK') {
    // 转发给 Background
    chrome.runtime.sendMessage(data, (response) => {
      // 收到 Background 的响应（可能是异步操作的结果，或者是错误）
      // 将响应回传给 Web 页面
      window.postMessage({
        source: 'DUAL_SCREEN_EXT',
        action: 'RESPONSE', // 或者是对应请求的 action + '_RESPONSE'
        reqId: data.reqId,
        payload: response ? response.payload : null,
        error: response ? response.error : chrome.runtime.lastError?.message
      }, '*');
    });
  }
});

// 2. 监听来自 Background 的消息 (Background -> Content -> Web)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.source === 'DUAL_SCREEN_EXT') {
    // 转发给 Web 页面
    window.postMessage(message, '*');
  }
});
