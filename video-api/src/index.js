import cors from 'cors';
import crypto from 'node:crypto';
import express from 'express';

const app = express();
const port = process.env.PORT || 3001;
const pageSize = 10;
const videoSources = [
  'https://lorem.video/720p',
  'https://lorem.video/1080p',
  'https://lorem.video/1280x720_h264_10s_30fps',
];
const authors = [
  '@视频观察员',
  '@移动端玩家',
  '@前端小栈',
  '@灵感制造机',
  '@产品体验官',
  '@夜间调试员',
  '@短视频实验室',
  '@Expo练习生',
];
const captions = [
  '这一条是接口实时生成的视频数据，用来测试分页加载和播放器状态。',
  '每次请求都会换一组内容，方便观察列表是否真的刷新。',
  '视频地址带了随机参数，尽量绕开播放器和网络层缓存。',
  '滑动到下一页时，新的 id、文案和视频源都会重新生成。',
  '适合用来测试短视频流、加载状态、列表 key 和滚动性能。',
  '如果你看到重复内容，那多半是视频服务或播放器缓存仍然生效。',
  '接口结构保持不变，前端可以继续直接读取 payload.data。',
  '这一页数据来自 Node 服务端随机生成，不再依赖本地静态数组。',
];
const tags = ['推荐', '视频', '开发', '测试', '随机', 'Expo', 'React Native', '短视频'];

app.use(cors());
app.use(express.json());

function toPositiveInteger(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getPageItems(page) {
  const start = (page - 1) * pageSize;
  const requestId = crypto.randomUUID();

  return Array.from({ length: pageSize }, (_item, index) => {
    const absoluteIndex = start + index;
    const itemId = crypto.randomUUID();
    const source = pickRandom(videoSources);

    return {
      id: `${page}-${absoluteIndex}-${itemId}`,
      author: pickRandom(authors),
      caption: pickRandom(captions),
      tag: pickRandom(tags),
      uri: `${source}?page=${page}&index=${absoluteIndex}&request=${requestId}&id=${itemId}&t=${Date.now()}`,
    };
  });
}

app.get('/api/videos', (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const data = getPageItems(page);

  res.json({
    code: 0,
    message: 'success',
    page,
    pageSize,
    data,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Video API server is running at http://localhost:${port}`);
});
