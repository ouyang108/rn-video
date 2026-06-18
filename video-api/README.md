# video-api

Node Express 视频分页接口服务。

## 启动

```bash
npm install
npm run dev
```

默认端口是 `3001`，也可以通过 `PORT` 环境变量修改。

## 接口

```http
GET /api/videos?page=1
```

每页固定返回 10 条数据。当前数据不足 10 条时，会从头循环补齐；后续只需要在 `src/data.js` 的 `videos` 数组里继续添加新数据。
