# Chrome Dual Screen Linker

这是一个 Chrome 扩展插件，用于帮助 Web 应用轻松实现双屏/多屏显示和跨窗口通信。

## 功能特性
1.  **多屏检测**：获取连接的显示器信息。
2.  **精准分屏**：在指定显示器上打开新窗口（全屏或指定尺寸）。
3.  **跨窗口通信**：主屏与副屏（或任意窗口间）通过简单的 API 进行数据广播。

## 安装说明
1.  打开 Chrome 浏览器，进入 `chrome://extensions/`。
2.  开启右上角的 **开发者模式 (Developer mode)**。
3.  点击 **加载已解压的扩展程序 (Load unpacked)**。
4.  选择本项目根目录 `chrome-dual-screen-extension`。

## 如何接入 (前端开发指南)

本插件提供了一个 `DualScreenSDK.js` 类，你可以将其集成到你的 Vue/React 项目中。

### 1. 引入 SDK
将 `DualScreenSDK.js` 复制到你的项目中，然后导入：

```javascript
import DualScreenSDK from './utils/DualScreenSDK'; // 假设你放在 utils 目录下

const sdk = new DualScreenSDK();
```

### 2. 获取显示器列表
```javascript
const displays = await sdk.getDisplays();
console.log(displays);
// 输出示例: [{ id: "...", bounds: { left: 0, top: 0, ... }, isPrimary: true }, ...]
```

### 3. 打开副屏窗口
假设你有两个屏幕，想在第二个屏幕打开展示页面：

```javascript
// 获取第二个屏幕（索引为 1）
const displays = await sdk.getDisplays();
if (displays.length > 1) {
  const secondDisplay = displays[1];
  
  await sdk.openWindow('http://your-internal-domain.com/dashboard', {
    displayId: secondDisplay.id, // 或者直接传索引 1
    // 可选参数
    // width: 1920,
    // height: 1080,
    // type: 'popup' // 'popup' (无地址栏) 或 'normal'
  });
}
```

### 4. 发送与接收数据

**发送方 (主控端):**
```javascript
sdk.broadcast({ type: 'UPDATE_CHART', data: [1, 2, 3] });
```

**接收方 (展示端):**
```javascript
sdk.onData((message) => {
  if (message.type === 'UPDATE_CHART') {
    updateChart(message.data);
  }
});
```

## 注意事项
- 插件需要 `host_permissions` 为 `<all_urls>` 以支持所有内部域名的注入。
- 确保浏览器允许弹出窗口。
