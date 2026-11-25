# 血压记 H5 / PWA

独立的浏览器版本，数据存储在当前浏览器的 `localStorage`，可安装为 PWA。此项目不使用 Expo 或原生 App 依赖。

## 启动

```bash
npm start
```

访问 `http://localhost:4173`。使用 Node.js 内置 HTTP 服务，无需安装额外依赖。可通过 `PORT=8080 npm start` 更改端口。部署到静态主机时，将本目录文件作为站点根目录，并启用 HTTPS 以支持 PWA 安装和 Service Worker。

当前项目保留独立 `package.json`。为满足本地复用依赖的约定，`node_modules` 链接到同级 `health-app/node_modules`；运行时不依赖其中的 Expo 或 React Native 包。

## 功能

- 今日均值、最近记录、连续记录天数和近 7 天偏高天数
- 新增、编辑、删除血压记录，含心率、情境和备注
- 近 7 / 30 天每日均值趋势图与历史日期筛选
- CSV 导入 / 导出与备份恢复、PWA 离线缓存、浏览器本地存储
- 医疗免责声明和输入范围校验

## 代码结构

```text
app.js                     # 浏览器入口
src/app.js                 # 页面协调与事件绑定
src/core/records.js        # 本地存储、日期格式、统计与分级
src/features/csv-backup.js # CSV 备份导入与导出
src/features/trend-chart.js# 趋势图绘制与手势聚焦
```

数据只存在当前浏览器。清除浏览器数据、使用隐私模式或更换浏览器设备前，请先导出 CSV 备份。
