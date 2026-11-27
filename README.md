# AhaStation 桌面工作区（未完成界面 Demo）

**请注意：这是未完成的界面演示（UI Demo），不是成品软件。** 流程、视觉和部分交互仍在打磨中，仅供预览和讨论界面用，请不要当作可交付产品。

本仓库是 **AhaStation 产品原型**（桌面工作区 + 掌机附屏）。颜色、字体、间距与组件规范在独立的设计系统仓库维护，不和本仓库混在一起：[AhaStation-design-system](https://github.com/Leonardolee351-LMX/AhaStation-design-system)。本仓库地址：[AhaStation-prototype](https://github.com/Leonardolee351-LMX/AhaStation-prototype)。

## 这是什么

按桌面端交互动线搭建的可点击原型，包括：

- 三栏工作区、页签复用、项目室、任务面板与任务会话
- 审批与验收、讨论与提议、历史接续
- 关联信息、连接主机、额度可视化、设置
- 随身附屏（掌机窗口）

语音、Git、终端、主机健康检查和模型调用均为模拟，不会访问真实麦克风、本地仓库或远程主机。

## 环境要求

需要先安装 [Node.js](https://nodejs.org)（含 npm）。建议使用 Node 18 或更高版本。

## 快速启动

解压后保留文件夹里的启动脚本，在解压目录中运行：

- **Windows：** 双击 `start.cmd`
- **macOS：** 双击 `start.command`

若 macOS 提示无法打开，可在「系统设置 → 隐私与安全性」中允许，或在终端执行：

```bash
chmod +x start.command
./start.command
```

首次启动会自动安装依赖，然后打开浏览器访问 [http://localhost:5177/](http://localhost:5177/)。若该地址已经在运行，脚本会直接打开浏览器，不会再启动一份服务。

也可以在解压目录里手动执行：

```bash
npm install
npm start
```

## 附屏

左侧栏底部的「掌机」按钮，或「设置 → 通用」里的「打开掌机附屏」，会打开同步讨论和审批的附屏窗口。也可以直接访问 [http://localhost:5177/?view=handheld](http://localhost:5177/?view=handheld)。

## 其他说明

- 预览端口固定为 `5177`。
- 本目录是独立原型，不依赖旧项目或组件库安装包。
- 风格 token 写在 `src/tokens.css`。
