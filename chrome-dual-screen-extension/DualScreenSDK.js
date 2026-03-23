// DualScreenSDK.js
// 这是一个前端项目接入使用的 SDK 示例文件
// 你可以将此类复制到你的 Vue/React/Angular 项目中作为工具类使用

class DualScreenSDK {
  constructor() {
    this.sourceId = 'DUAL_SCREEN_SDK';
    this.callbacks = new Map(); // 存储请求的回调
    this.listeners = new Set(); // 存储消息监听器
    this.windowClosedListeners = new Set(); // 存储窗口关闭监听器
    this.windowCrashedListeners = new Set(); // 存储窗口崩溃监听器
    this.windowStateListeners = new Set(); // 存储窗口状态监听器

    // 初始化监听
    window.addEventListener('message', this._handleMessage.bind(this));

    // 注册客户端（延迟一点确保 content script 就绪）
    setTimeout(() => {
      this._send('REGISTER_CLIENT').catch(() => {
        // 第一次可能失败
      });
    }, 100);

    // 启动心跳 (每 3 秒发送一次)
    setInterval(() => {
      window.postMessage({
        source: this.sourceId,
        action: 'HEARTBEAT',
        reqId: 'hb-' + Date.now()
      }, '*');
    }, 3000);
  }

  /**
   * 内部处理来自插件的消息
   */
  _handleMessage(event) {
    if (event.source !== window) return;
    
    const data = event.data;
    if (!data || data.source !== 'DUAL_SCREEN_EXT') return;

    // 处理请求响应
    if (data.action === 'RESPONSE' && data.reqId) {
      // 忽略心跳响应
      if (data.reqId.startsWith('hb-')) return;
      
      if (this.callbacks.has(data.reqId)) {
        const { resolve, reject } = this.callbacks.get(data.reqId);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data.payload);
        }
        this.callbacks.delete(data.reqId);
      }
    }

    // 处理广播消息
    if (data.action === 'DATA_RECEIVED') {
      const payload = data.payload;
      
      // 特殊处理窗口关闭事件
      if (payload && payload.type === 'WINDOW_CLOSED') {
        this.windowClosedListeners.forEach(callback => callback(payload.windowId));
      } else if (payload && payload.type === 'WINDOW_CRASHED') {
        // 窗口崩溃事件
        this.windowCrashedListeners.forEach(callback => callback(payload));
      } else if (payload && payload.type === 'WINDOW_STATE_CHANGED') {
        // 窗口状态变化事件
        this.windowStateListeners.forEach(callback => callback(payload));
      } else {
        // 普通数据广播
        this.listeners.forEach(callback => callback(payload));
      }
    }
  }

  /**
   * 发送消息给插件
   */
  _send(action, payload) {
    return new Promise((resolve, reject) => {
      const reqId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      // 设置超时处理（可选）
      const timer = setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          this.callbacks.delete(reqId);
          reject(new Error('Timeout: Extension not responding. Make sure the extension is installed.'));
        }
      }, 5000);

      this.callbacks.set(reqId, { 
        resolve: (res) => { clearTimeout(timer); resolve(res); }, 
        reject: (err) => { clearTimeout(timer); reject(err); }
      });

      window.postMessage({
        source: this.sourceId,
        action: action,
        reqId: reqId,
        payload: payload
      }, '*');
    });
  }

  /**
   * 获取所有显示器信息
   * @returns {Promise<Array>} 显示器列表
   */
  async getDisplays() {
    return this._send('GET_DISPLAYS');
  }

  /**
   * 在指定显示器打开新窗口
   * @param {string} url - 目标 URL
   * @param {object} options - 配置 { displayId: number/string, width: number, height: number, left: number, top: number, state: 'normal'|'fullscreen'|'maximized'|'minimized' }
   * @returns {Promise<object>} 新窗口信息
   */
  async openWindow(url, options = {}) {
    return this._send('OPEN_WINDOW', {
      url,
      ...options
    });
  }

  /**
   * 关闭指定窗口
   * @param {number} windowId - 窗口 ID
   * @returns {Promise<object>}
   */
  async closeWindow(windowId) {
    return this._send('CLOSE_WINDOW', { windowId });
  }

  /**
   * 广播数据给其他窗口
   * @param {any} data - 要发送的数据
   */
  async broadcast(data) {
    return this._send('BROADCAST_DATA', data);
  }

  /**
   * 监听来自其他窗口的数据
   * @param {function} callback - (message) => void
   */
  onData(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * 监听窗口关闭事件
   * @param {function} callback - (windowId) => void
   */
  onWindowClosed(callback) {
    this.windowClosedListeners.add(callback);
    return () => this.windowClosedListeners.delete(callback);
  }

  /**
   * 监听窗口崩溃事件 (心跳超时)
   * @param {function} callback - ({ tabId, windowId }) => void
   */
  onWindowCrashed(callback) {
    this.windowCrashedListeners.add(callback);
    return () => this.windowCrashedListeners.delete(callback);
  }

  /**
   * 监听窗口状态变化 (位置、大小、最大化/最小化)
   * @param {function} callback - ({ windowId, state, bounds }) => void
   */
  onWindowStateChanged(callback) {
    this.windowStateListeners.add(callback);
    return () => this.windowStateListeners.delete(callback);
  }
}

// 导出 (适配 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DualScreenSDK;
} else if (typeof window !== 'undefined') {
  window.DualScreenSDK = DualScreenSDK;
}

export default DualScreenSDK;
