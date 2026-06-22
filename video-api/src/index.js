import cors from "cors";
import express from "express";
import crypto from "node:crypto";

const app = express();
const port = process.env.PORT || 3001;
const pageSize = 10;
const videoSources = [
  "https://vd2.bdstatic.com/mda-sds35yps6ebaai57/cae_h264/1777256555648167493/mda-sds35yps6ebaai57.mp4?abtest=peav_l52&appver=&auth_key=1782140310-0-0-dd769a6bbe0286d30973ee2097990d45&bcevod_channel=searchbox_feed&cd=0&cr=0&did=cfcd208495d565ef66e7dff9f98764da&logid=1709953398&model=&osver=&pd=1&pt=4&sl=428&sle=1&split=688087&vid=9248166097828513410&vt=1",
  "https://vd3.bdstatic.com/mda-seerja65rr7hwrrf/cae_h264/1778868304233052050/mda-seerja65rr7hwrrf.mp4?abtest=peav_l52&appver=&auth_key=1782140310-0-0-8988c2debe5342d6c07f91e5dba22ed1&bcevod_channel=searchbox_feed&cd=0&cr=0&did=cfcd208495d565ef66e7dff9f98764da&logid=1709953398&model=&osver=&pd=1&pt=4&sl=543&sle=1&split=532771&vid=1781085754333413367&vt=1",
  "https://vd3.bdstatic.com/mda-setz90z4j2hx0ftv/cae_h264/1780011099463399779/mda-setz90z4j2hx0ftv.mp4?abtest=peav_l52&appver=&auth_key=1782140310-0-0-35a8f373b7f87c1233aa276cf87b1ea5&bcevod_channel=searchbox_feed&cd=0&cr=0&did=cfcd208495d565ef66e7dff9f98764da&logid=1709953398&model=&osver=&pd=1&pt=4&sl=292&sle=1&split=363796&vid=10756986748314344447&vt=1",
];
const authors = [
  "@视频观察员",
  "@移动端玩家",
  "@前端小栈",
  "@灵感制造机",
  "@产品体验官",
  "@夜间调试员",
  "@短视频实验室",
  "@Expo练习生",
];
const captions = [
  "这一条是接口实时生成的视频数据，用来测试分页加载和播放器状态。",
  "每次请求都会换一组内容，方便观察列表是否真的刷新。",
  "视频地址带了随机参数，尽量绕开播放器和网络层缓存。",
  "滑动到下一页时，新的 id、文案和视频源都会重新生成。",
  "适合用来测试短视频流、加载状态、列表 key 和滚动性能。",
  "如果你看到重复内容，那多半是视频服务或播放器缓存仍然生效。",
  "接口结构保持不变，前端可以继续直接读取 payload.data。",
  "这一页数据来自 Node 服务端随机生成，不再依赖本地静态数组。",
];
const tags = [
  "推荐",
  "视频",
  "开发",
  "测试",
  "随机",
  "Expo",
  "React Native",
  "短视频",
];

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

app.get("/api/videos", (req, res) => {
  const page = toPositiveInteger(req.query.page, 1);
  const data = getPageItems(page);

  res.json({
    code: 0,
    message: "success",
    page,
    pageSize,
    data,
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Video API server is running at http://localhost:${port}`);
});
