// DualScreenSDK.js
// 这是一个前端项目接入使用的 SDK 示例文件
// 你可以将此类复制到你的 Vue/React/Angular 项目中作为工具类使用

class DualScreenSDK {
  constructor() {
    this.sourceId = 'DUAL_SCREEN_SDK';
    this.callbacks = new Map(); // 存储请求的回调
    this.listeners = new Set(); // 存储消息监听器

    // 初始化监听
    window.addEventListener('message', this._handleMessage.bind(this));
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
      this.listeners.forEach(callback => callback(data.payload));
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
   * @param {object} options - 配置 { displayId: number/string, width: number, height: number, left: number, top: number }
   * @returns {Promise<object>} 新窗口信息
   */
  async openWindow(url, options = {}) {
    return this._send('OPEN_WINDOW', {
      url,
      ...options
    });
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
   * @param {function} callback 
   */
  onData(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback); // 返回取消订阅函数
  }
}

// 导出 (适配 CommonJS 和 ES Module)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DualScreenSDK;
} else {
  window.DualScreenSDK = DualScreenSDK;
}
