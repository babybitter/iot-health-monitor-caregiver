# IoT 健康监测护工端

面向病区或照护机构值守人员的微信原生小程序。项目复用患者端的 MQTT 3.1.1、生命体征阈值、输液监测、ECharts 与小程序基础能力，并按当前“一套实体设备对应一个当前照护对象”的演示条件重新组织工作台、监控、任务和个人中心。

项目不生成患者、生命体征、任务、证书或培训测试数据。监控页显示的数值、异常和趋势均来自运行期间实际接收的 MQTT 消息；未收到数据时统一显示空状态或 `--`。

## 技术栈

- 微信原生小程序：JavaScript、WXML、WXSS
- 原生 `wx.connectSocket` 与 MQTT 3.1.1 二进制报文
- ECharts 微信小程序画布组件，用于本次运行的真实数据趋势
- 轻量事件 Store，用于 MQTT 数据在工作台和监控页之间同步
- `wxStorage`，用于本机头像、考勤、照护记录和未来业务任务缓存
- Node.js 自检脚本；无第三方运行时依赖

## 目录结构

```text
caregiver/
├─ components/          导航、状态面板和状态标签
├─ config/              MQTT、单设备映射与指标阈值
├─ ec-canvas/           ECharts 小程序适配组件
├─ images/              从患者端复用的规范图标
├─ pages/
│  ├─ workbench/        值班、实时异常、当前设备和任务摘要
│  ├─ monitor/          生命体征、输液、真实趋势与设备控制
│  ├─ tasks/            业务任务状态筛选与分页
│  ├─ task-detail/      任务状态处理
│  ├─ records/          单一当前照护对象的工作记录
│  ├─ record-edit/      工作记录表单与校验
│  ├─ attendance/       本机签到、签退和记录
│  ├─ certificates/     证书空状态与后续接口承载页
│  ├─ training/         培训空状态与后续接口承载页
│  └─ profile/          患者端个人中心结构的护工化版本
├─ services/            本地业务仓库、HTTP 与 MQTT 连接
├─ store/               实时监测数据、异常和会话趋势
├─ styles/              蓝色医疗照护主题变量
├─ utils/               时间、缓存和指标阈值工具
└─ scripts/             工程校验与核心逻辑测试
```

## 环境要求与运行

- Node.js 18 或更高版本
- npm 9 或更高版本
- 微信开发者工具，建议基础库不低于 `3.8.10`

```bash
npm install
npm run build
```

随后在微信开发者工具中导入 `caregiver` 目录。实体调试使用 `ws://106.14.12.227:8083/mqtt`，开发者工具需按患者端相同方式允许调试非 HTTPS/WSS 域名；正式发布应切换到 `wss://mqtt.healthtrack.top:8084/mqtt`，并在微信公众平台配置合法 socket 域名。

## 检查命令

```bash
npm run lint
npm test
npm run build
```

- `lint` 校验 JSON、页面和组件注册、JavaScript 语法、AI 路由残留、WXML 兼容性、Emoji 与明显溢出布局。
- `test` 覆盖阈值、真实主题映射、组合上报、输液数据、设备反馈、会话趋势、考勤和照护记录。
- `build` 串行执行前两项；最终小程序编译由微信开发者工具完成。

## MQTT 配置与真实数据流

配置位于 `config/index.js`。护工端与患者端订阅相同主题：

```text
patient/monitor/light
patient/monitor/pressure
patient/monitor/temperature
patient/monitor/humidity
patient/monitor/breathing
patient/monitor/heart_rate
patient/monitor/blood_oxygen
patient/upload/data/temperature
patient/monitor/weight
patient/monitor/weight-begin
patient/monitor/infusion-speed
patient/status/device
patient/upload/data
patient/advice/device
home/devices/onoff/#
```

设备控制发布到 `patient/control/device`；输液低余量提醒沿用患者端的 `patient/monitor/weight-drive`。MQTT 连接由 `services/realtime.js` 管理，负责鉴权、订阅、保活和断线重连。`store/work-store.js` 将消息按主题映射为指标、输液状态、设备反馈、阈值异常与最多 240 个会话趋势点。

`config.careSubject` 是单设备部署信息适配层。当前没有患者分配接口，因此只显示“当前照护对象”，不在客户端推断或虚构患者身份。接入真实绑定关系后，只需由登录后的后端配置替换该对象，无需改变 MQTT 数据模型。

## 已实现功能

- 工作台：值班与签到、实时异常数量、MQTT 状态、当前照护对象、最近生命体征和业务任务空状态
- 智能监控：八项生命与环境指标、真实阈值异常、异常核对、输液重量与滴速、会话趋势、设备状态和 MQTT 控制
- 任务：状态筛选、分页、详情和状态更新；没有业务接口时不生成任务
- 照护记录：固定当前照护对象、分页、本机新增、必填和长度校验
- 考勤：本机签到、签退、二次确认和时间记录；明确不伪造定位校验
- 我的：沿用患者端头像登录与分组列表结构，调整为护工信息、考勤、记录、证书和培训入口
- 通用状态：网络离线、MQTT 失败、空数据、加载、刷新、防重复提交和操作反馈

## 接入真实业务接口

生命体征已经直接接入 MQTT。任务、护工身份、排班、证书和培训仍缺少服务端接口，因此页面使用空数组和明确空状态，不提供测试数据。后续接入点集中在 `services/repository.js`：

- `getCaregiverProfile`：替换为登录后的护工信息
- `listTasks`、`getTask`、`updateTask`：替换为任务服务
- `getAttendance`、`clock`：替换为考勤服务并按需要申请定位权限
- `listCertificates`、`listTraining`：替换为资质与培训服务
- `listRecords`、`createRecord`：替换为照护记录服务

页面不直接调用测试数据模块，替换 repository 实现时无需重写页面。

## 主题、布局和端差异

主题变量统一位于 `styles/theme.wxss`。所有可点击卡片显式占满容器，四项标签使用等分 Flex，文本容器设置 `min-width: 0`、省略或换行；页面禁止横向滚动，顶部导航与底部原生 tabBar 均预留安全区域。

与患者端相比，护工端不提供 AI 助手和患者自助资料入口；首屏围绕实时异常、设备、任务和值班状态；智能监控不再切换多个虚构患者，而是服务于当前实体设备；整体采用克制的蓝色值守主题。

## 当前限制

- MQTT 测试服务器配置与患者端保持一致。正式发布前应改用 WSS，并通过受信任后端下发短期凭据。
- 趋势只包含小程序本次运行期间真实收到的数据，关闭小程序后不伪造历史曲线；长期历史需要接入服务端时序接口。
- 护工业务接口尚未提供，任务、证书和培训默认为空；本机考勤和照护记录不能跨设备同步。
- 定位考勤、证书上传和在线考试未实现，相关页面不会伪造成功结果。
