# Chrome 双屏/多屏协作插件 (Dual Screen Linker)

这是一个专为 Web 应用设计的 Chrome 扩展，旨在解决 Web 页面无法获取物理显示器信息和跨屏窗口管理的痛点。通过本插件，Web 应用可以轻松实现多屏检测、精准分屏显示以及跨窗口数据通信。

## 🔄 更新日志 / Changelog

* **[2024-03-23]**: 彻底修复 `openWindow` 时因同时指定 `displayId` (坐标) 和 `state: 'fullscreen'` 导致的 Chrome API 底层报错 `Invalid value for state` 的问题，通过创建后延迟全屏的方式绕过 Chrome 限制。进一步优化了跨屏全屏逻辑，采用“创建 -> 强制移动定位 -> 延迟全屏”的三步走策略，解决 Chrome 系统可能会将未完全定位的窗口强行拉回主屏全屏的底层 Bug。
* **[2024-03-23]**: 新增 `getCurrentDisplay()` API，允许前端动态获取当前窗口所在的屏幕，从而实现“始终在另一个屏幕打开”的智能逻辑。
* **[2024-03-23]**: 增强了对 `openWindow` API 中 `state` 参数的校验，防止传入非法状态（如拼写错误）导致插件报错崩溃，非法状态将自动回退为默认正常窗口。
* **[2024-03-23]**: 修复了 `DualScreenSDK.js` 在现代前端框架 (如 Vue/Vite) 中以 ES Module 方式引入时报 `does not provide an export named 'default'` 的错误，添加了 `export default` 语法支持。
* **[2024-03-23]**: 优化项目配置，将 Playwright 测试产生的缓存目录 (`playwright-report/`, `test-results/`) 加入 `.gitignore`，防止污染 Git 提交记录。

## ✨ 核心功能

1.  **多屏检测 (Display Detection)**: 获取所有连接的显示器信息（分辨率、位置坐标、是否为主屏等）。
2.  **精准分屏 (Window Management)**: 在指定的物理显示器上打开全屏或自定义尺寸的窗口，支持“霸屏”模式。
3.  **跨窗口通信 (Cross-Window Messaging)**: 提供简单的广播机制，实现主控屏与展示屏之间的数据同步。
4.  **SDK 支持**: 提供 `DualScreenSDK.js`，方便 Vue/React/Angular 等前端项目快速接入。

## � 环境要求

由于本插件基于 Chrome Manifest V3 架构，并使用了 `chrome.storage.session` 等新特性，请确保浏览器版本满足以下要求：

*   **Google Chrome**: v102 或更高版本 (推荐使用最新稳定版)
*   **Microsoft Edge**: v102 或更高版本 (基于 Chromium 内核)

> **注意**: 低于 v102 的版本将无法支持本插件的核心功能（如窗口状态持久化）。

## � 安装指南

### 开发者模式安装
由于本插件通常作为内部工具使用，建议通过源码安装：

1.  下载本项目源码到本地。
2.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/`。
3.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
4.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
5.  选择 `chrome-dual-screen-extension` 文件夹即可（注意是包含 `manifest.json` 的那层目录）。
6.  安装成功后，记下插件 ID（虽然 SDK 会自动处理，但在某些特定配置中可能需要）。

## 🛠️ 前端开发接入指南

本项目提供了一个封装好的 SDK 类 `DualScreenSDK.js`，你可以直接将其复制到你的前端项目中。

### 1. 引入 SDK
将 `chrome-dual-screen-extension/DualScreenSDK.js` 文件复制到你的项目工具目录（如 `src/utils/`）。

```javascript
import DualScreenSDK from '@/utils/DualScreenSDK';

const dualScreen = new DualScreenSDK();
```

### 2. API 文档

#### 2.1 获取显示器列表 `getDisplays()`
获取当前连接的所有显示器信息。

```javascript
const displays = await dualScreen.getDisplays();
console.log(displays);
```

**返回数据结构说明 (Display Object):**
| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `id` | string | 显示器唯一标识符，用于指定窗口打开位置 |
| `name` | string | 显示器名称 (如 "Dell U2417H") |
| `isPrimary` | boolean | 是否为主显示器 |
| `bounds` | object | `{ left, top, width, height }` 显示器在虚拟桌面中的绝对物理坐标 |
| `workArea` | object | `{ left, top, width, height }` 可用工作区坐标 (减去任务栏) |

#### 2.2 打开新窗口 `openWindow(url, options)`
在指定显示器上打开新窗口。

```javascript
// 示例 1：在第二个屏幕打开全屏窗口
const displays = await dualScreen.getDisplays();
if (displays.length > 1) {
  const secondScreen = displays[1];
  
  await dualScreen.openWindow('http://localhost:3000/show', {
    displayId: secondScreen.id, // 指定显示器 ID
    state: 'fullscreen',        // 可选: 'normal', 'minimized', 'maximized', 'fullscreen'
  });
}

// 示例 2：单例模式打开（如果窗口已存在，则聚焦它而不是新建）
await dualScreen.openWindow('http://localhost:3000/dashboard', {
  reuse: true, // 开启重用模式
  width: 800,
  height: 600
});
```

**参数 `options`:**
- `displayId` (String): 目标显示器 ID。
- `state` (String): 窗口状态 `'normal'`, `'minimized'`, `'maximized'`, `'fullscreen'`。
- `reuse` (Boolean): **单例模式**。如果为 `true`，且该 URL 已有打开的窗口，则直接聚焦该窗口，不会创建新窗口。
- `left`, `top` (Number): 绝对坐标 (如果提供了 `displayId`，则相对于该显示器左上角)。
- `width`, `height` (Number): 窗口尺寸。
- `type` (String): `'popup'` (无地址栏，推荐) 或 `'normal'` (标准浏览器窗口)。

#### 2.3 关闭窗口 `closeWindow(windowId)`
关闭之前通过 `openWindow` 打开的窗口。

```javascript
const win = await dualScreen.openWindow('...', { ... });
// ... 业务结束后
await dualScreen.closeWindow(win.windowId);
```

#### 2.4 数据通信 (Broadcast & Listen)
插件提供了简单的广播机制，允许主窗口与子窗口之间互相发送消息。

**发送广播:**
```javascript
// 向所有连接的窗口（包括自己打开的子窗口）发送数据
await dualScreen.broadcast({
  type: 'UPDATE_ORDER',
  payload: { orderId: '12345', status: 'cooking' }
});
```

**接收广播:**
```javascript
// 监听来自其他窗口的数据
const unsubscribe = dualScreen.onData((message) => {
  console.log('收到广播:', message);
  if (message.type === 'UPDATE_ORDER') {
    updateView(message.payload);
  }
});

// 不需要时取消监听
// unsubscribe();
```

#### 2.5 监听窗口关闭 `onWindowClosed(callback)`
当任何由插件管理的窗口关闭时触发。

```javascript
dualScreen.onWindowClosed((windowId) => {
  console.log('窗口已关闭:', windowId);
  // 可以在这里做一些清理工作，比如重置按钮状态
});
```

#### 2.6 监听窗口崩溃 `onWindowCrashed(callback)`
当受控窗口（页面）崩溃或无响应超过 15 秒时触发。

```javascript
dualScreen.onWindowCrashed(({ tabId, windowId }) => {
  console.log('窗口已崩溃:', windowId, tabId);
  // 可以在这里提示用户，或尝试重新打开窗口
});
```

#### 2.7 监听窗口状态变化 `onWindowStateChanged(callback)`
当受控窗口的位置、大小或状态（最大化/最小化）发生变化时触发。

```javascript
dualScreen.onWindowStateChanged(({ windowId, state, bounds }) => {
  console.log('窗口状态变化:', windowId, state, bounds);
});
```

## 3. 完整场景示例：餐饮店点餐系统

**场景描述**：
- **主控屏 (POS)**：收银员操作，负责下单。
- **客显屏 (Display)**：面向顾客，展示订单详情。

### 3.1 主控端代码 (POS)
```javascript
import DualScreenSDK from './DualScreenSDK';
const dualScreen = new DualScreenSDK();

// 1. 初始化：检测是否有第二块屏幕
async function initDualScreen() {
  const displays = await dualScreen.getDisplays();
  
  // 如果有副屏，打开客显页面
  if (displays.length > 1) {
    const customerScreen = displays.find(d => !d.isPrimary);
    
    await dualScreen.openWindow('http://localhost:8080/customer-view', {
      displayId: customerScreen.id,
      state: 'fullscreen',
      reuse: true // 避免重复打开
    });
  }
}

// 2. 更新订单时，同步数据给客显屏
async function updateOrder(orderData) {
  // 发送广播
  await dualScreen.broadcast({
    type: 'ORDER_UPDATED',
    payload: orderData
  });
}
```

### 3.2 客显端代码 (Display)
```javascript
import DualScreenSDK from './DualScreenSDK';
const dualScreen = new DualScreenSDK();

// 监听来自主控端的消息
dualScreen.onData((msg) => {
  if (msg.type === 'ORDER_UPDATED') {
    const order = msg.payload;
    console.log('收到新订单:', order);
    // 更新 UI...
    renderOrderList(order);
  }
});

// 也可以向主控端发送反馈（例如顾客扫码支付成功）
function onPaymentSuccess() {
  dualScreen.broadcast({ type: 'PAYMENT_COMPLETE' });
}
```

## 🧪 测试指南

本项目包含完善的自动化测试套件，确保插件核心功能正常。

### 运行自动化测试 (推荐)
使用 Playwright 模拟真实浏览器环境进行测试。

1.  **安装依赖**:
    ```bash
    npm install
    ```

2.  **运行测试**:
    ```bash
    npm test
    ```
    测试将自动启动一个加载了插件的 Chrome 实例，并验证消息通信、显示器获取等功能。

### 手动测试
1.  加载插件。
2.  打开任意网页，打开控制台 (F12)。
3.  输入以下代码验证：
    ```javascript
    window.postMessage({ source: 'DUAL_SCREEN_SDK', action: 'GET_DISPLAYS', reqId: 'test' }, '*');
    window.addEventListener('message', e => console.log(e.data));
    ```

## 🛡️ 安全性配置 (强烈推荐)

默认情况下，插件允许所有 `<all_urls>` 调用。为了防止恶意网站滥用插件功能，建议在 `manifest.json` 中配置白名单，或在 `background.js` 中添加校验逻辑。

**方法：修改 `background.js` 添加域名校验**

```javascript
// 在 handleMessage 函数开头添加
const ALLOWED_DOMAINS = ['localhost', '127.0.0.1', 'your-domain.com'];

function isAllowed(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return ALLOWED_DOMAINS.some(d => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch { return false; }
}

if (!isAllowed(sender.tab.url)) {
  console.warn('Blocked request from:', sender.tab.url);
  return { error: 'Forbidden' };
}
```

## ⚠️ 常见问题 & 注意事项

1.  **跨域限制**: 插件配置了 `<all_urls>` 权限，理论上支持所有域名的注入。
2.  **弹窗拦截**: 浏览器可能会拦截 `window.open` 或插件创建的窗口。请确保在浏览器设置中允许该站点的“弹出式窗口和重定向”。
3.  **坐标系**: Chrome 的多屏坐标系是连续的。主屏通常从 (0,0) 开始，副屏可能是负值或正值（取决于摆放位置）。使用 `bounds` 字段可以自动处理这些坐标。

## 📅 更新日志 (Changelog)

### v1.0.1 (2026-03-10)
- **System**: 最低 Chrome 版本要求 v102+ (支持 `chrome.storage.session`)。
- **Feature**: 新增窗口状态同步 (`onWindowStateChanged`)，实时感知窗口位置和大小变化。
- **Feature**: 新增心跳检测与崩溃恢复机制 (`onWindowCrashed`)，自动清理无效窗口。
- **Fix**: 修复 Service Worker 在闲置后状态丢失的问题，实现状态持久化和自动重连。
- **Docs**: 新增安全性配置指南 (域名白名单) 和完整场景示例代码。
- **Perf**: 优化广播机制，支持窗口单例模式 (`reuse: true`)。
