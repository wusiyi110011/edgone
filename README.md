# 双腔式胸腔闭式引流瓶 H5 教学小游戏

这个仓库包含三部分：

- `apps/h5`：学生游玩的 H5 页面，包含 3D 模型、连接管出现逻辑、接管判定和实时统计。
- `apps/server`：记录每位同学提交结果的统计接口，返回正确人数、错误人数和最近提交记录。
- `apps/miniprogram`：微信小程序壳，入口页通过云托管接口读取统计，并使用 `web-view` 打开 H5。

## 本地运行

1. 在仓库根目录执行：

```bash
npm run dev
```

2. 打开 H5：

```text
http://localhost:5173
```

3. 后端接口默认运行在：

```text
http://localhost:3001
```

## 游戏说明

- 单指拖动可旋转 3D 模型，双指可缩放。
- 模型初始顶部三个接口都不挂外接透明管，点击第一个接口后连接管才会出现。
- 再点击第二个接口完成一条连接，然后提交判定。
- 三个接口分别是“引流管接口”“排气口”“水封管接口”。
- 只有“排气口”连接“水封管接口”才计入正确人数；判定正确后，剩下的“引流管接口”会自动补出一根单独的管子。
- 统计面板提供“重置统计”按钮，可一键清空正确人数、错误人数和最近提交记录。

## 微信小程序集成

小程序目录在 [apps/miniprogram](/Users/wusiyi/Documents/openclaw/apps/miniprogram)。

接入前需要先修改 [utils/config.js](/Users/wusiyi/Documents/openclaw/apps/miniprogram/utils/config.js)：

- `envId`：你的云开发环境 ID。
- `serviceName`：你在云托管里创建的服务名。
- `webBaseUrl`：你的云托管自定义域名，用于小程序 `web-view` 打开 H5 页面。

然后在微信开发者工具中导入 [apps/miniprogram](/Users/wusiyi/Documents/openclaw/apps/miniprogram) 即可。

## 微信云托管部署

项目已经改成可部署到单个云托管服务：

- 根目录 [Dockerfile](/Users/wusiyi/Documents/openclaw/Dockerfile) 会构建 H5 和 Node 服务。
- 云托管启动后，同一个服务同时提供：
  - `/`：H5 游戏页面
  - `/api/*`：统计接口

你需要在微信/腾讯云控制台中完成这些操作：

1. 开通云开发环境，并记下 `envId`。
2. 在腾讯云账号信息里绑定微信开放体系账号。
3. 在云托管中创建一个 Node 服务，服务名建议用 `openclaw-game`。
4. 选择“代码部署”或“Dockerfile 部署”，指向本仓库根目录的 [Dockerfile](/Users/wusiyi/Documents/openclaw/Dockerfile)。
5. 服务启动端口填写 `80`。
6. 部署完成后获取服务 HTTPS 域名；正式使用建议绑定自定义域名。
7. 把该域名填写到 [config.js](/Users/wusiyi/Documents/openclaw/apps/miniprogram/utils/config.js) 的 `webBaseUrl`。
8. 在微信公众平台为小程序配置 `web-view` 业务域名，填入上一步的域名。
9. 在微信开发者工具里将小程序绑定到同一个 `envId`，再重新编译。

云托管默认只需暴露一个服务域名即可，因为小程序首页统计走 `wx.cloud.callContainer`，H5 页面和接口都由同一个服务提供。

## 部署建议

- 生产环境建议为云托管绑定已备案的自定义域名，再把该域名加入小程序 `web-view` 业务域名。
- 当前架构下 H5 和 API 共用同一个云托管服务域名，不需要额外拆分 API 域名。
- 当前统计结果仍保存在容器本地的 `apps/server/data/results.json`。这只适合本地演示，不适合微信云托管正式使用，因为服务重启、重新部署或扩容后数据可能丢失。
- 如果你要给同学正式扫码使用，下一步建议把统计存储改成云开发数据库或 MySQL。
# EdgeOne Pages 部署

如果你想用中国区、尽量 0 成本、学生直接扫码访问的方案，推荐使用腾讯 `EdgeOne Pages` 免费版。

## 一键生成上传包

在项目根目录执行：

```bash
npm run build:edgeone
```

执行后会生成上传目录：

```text
edgeone-deploy
```

这个目录已经包含：

- 构建后的 H5 静态文件
- EdgeOne 路由配置 `edgeone.json`
- Node Functions 接口 `/api/*`

## 直接上传到 EdgeOne Pages

1. 打开 [EdgeOne Pages](https://pages.edgeone.ai/zh/)
2. 创建项目
3. 选择 `直接上传`
4. 上传整个 `edgeone-deploy` 文件夹
5. 等待部署完成

部署成功后，学生就可以直接扫码访问生成的 HTTPS 链接。

## 统计功能说明

当前 EdgeOne 版本的统计数据保存在函数实例内存中，适合课堂演示和短时训练：

- 正常访问期间可以统计正确/错误人数
- 如果重新部署、函数实例回收或平台重启，统计数据可能清零

如果你后面要长期保存统计结果，我建议下一步再接一个数据库服务。
