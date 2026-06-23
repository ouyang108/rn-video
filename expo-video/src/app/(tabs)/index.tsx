// 从 React Navigation 引入判断当前页面是否聚焦的 Hook。
import { useIsFocused } from '@react-navigation/native';
// 从 Legend List 引入更适合重型 item 的虚拟列表组件和可见项类型。
import { LegendList, ViewToken } from '@legendapp/list/react-native';
// 从 Expo Constants 读取开发服务器地址等运行时配置。
import Constants from 'expo-constants';
// 从 expo-video 引入视频播放器 Hook 和视频渲染组件。
import { useVideoPlayer, VideoView } from 'expo-video';
// 从 lucide-react-native 引入页面里使用的图标。
import {
  // 收藏图标。
  Bookmark,
  // 点赞图标。
  Heart,
  // 菜单图标。
  Menu,
  // 评论图标。
  MessageCircle,
  // 关注加号图标。
  Plus,
  // 搜索图标。
  Search,
  // 分享图标。
  Share2,
} from 'lucide-react-native';
// 从 React 引入组件状态、生命周期、缓存函数和 ref。
import { useCallback, useEffect, useRef, useState } from 'react';
// 从 React Native 引入基础组件和类型。
import {
  // 加载中的菊花组件。
  ActivityIndicator,
  // 平台判断工具。
  Platform,
  // 状态栏组件。
  StatusBar,
  // 样式创建工具。
  StyleSheet,
  // 文本组件。
  Text,
  // 可点击组件。
  TouchableOpacity,
  // 布局容器组件。
  View,
} from 'react-native';
// 从安全区库获取状态栏和刘海屏边距。
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 定义首页视频流里每条视频的数据结构。
type FeedVideo = {
  // 视频唯一 id，用作 FlatList 的 key。
  id: string;
  // 视频作者展示名。
  author: string;
  // 视频文案。
  caption: string;
  // 视频标签。
  tag: string;
  // 视频播放地址。
  uri: string;
  // 结束 FeedVideo 类型定义。
};

// 顶部频道导航文案。
const channels = ['直播', '团购', '宁波', '关注', '商城', '推荐'];
// 首页首次请求的分页页码。
const INITIAL_VIDEO_PAGE = 1;
// 本地接口服务端口。
const API_PORT = 3001;
// 当前滑动方向前方保留的视频播放器数量。
const PRELOAD_AHEAD = 5;
// 当前滑动方向后方保留的视频播放器数量。
const PRELOAD_BEHIND = 1;
// 列表额外绘制距离倍数，控制可见区域外多渲染多少内容。
const DRAW_DISTANCE_MULTIPLIER = 2;
// 滚动事件节流时间，保持滚动和可见项计算及时。
const SCROLL_EVENT_THROTTLE = 16;
// 短视频流减速系数，配合分页吸附使用。
const DECELERATION_RATE = 0.98;
// 当前内存里最多保留的视频数据条数；先设小一点方便测试裁剪。
const MAX_VIDEO_ITEMS = 40;
// 触发裁剪时从列表头部裁掉多少条数据。
const TRIM_HEAD_COUNT = 20;
// 当前播放位置超过这个本地 index 时，才允许裁剪头部数据。
const MIN_ACTIVE_INDEX_BEFORE_TRIM = 25;
// 获取 Expo 开发环境里可以访问电脑本机服务的主机名。
function getDevApiHost() {
  // Expo Dev Server 通常会把电脑的局域网地址放在 hostUri 里，例如 192.168.1.8:8081。
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  // 从 hostUri 里去掉端口，只保留主机名或 IP。
  const devServerHost = hostUri?.split(':')[0];

  // 判断当前是否运行在 Web 端。
  if (Platform.OS === 'web') {
    // Web 运行在电脑浏览器里时，localhost 就是电脑本机。
    return 'localhost';
  }

  // 判断 Android 环境下是否没有拿到开发服务器地址。
  if (!devServerHost && Platform.OS === 'android') {
    // Android 模拟器访问宿主机 localhost 要用 10.0.2.2。
    return '10.0.2.2';
  }

  // 判断 Android 环境下拿到的地址是否仍然是 localhost。
  if (Platform.OS === 'android' && devServerHost === 'localhost') {
    // 避免 Android 模拟器把 localhost 当成模拟器自己。
    return '10.0.2.2';
  }

  // 真机调试时优先使用 Expo 提供的电脑局域网 IP，iOS 模拟器也可以使用 localhost 兜底。
  return devServerHost ?? 'localhost';
  // 结束 getDevApiHost 函数。
}

// 根据传入页码生成首页视频列表接口地址。
function getVideoApiUrl(page: number) {
  // page 参数从当前 state 统一拼接，页码变化时会请求不同接口。
  return `http://${getDevApiHost()}:${API_PORT}/api/videos?page=${page}`;
  // 结束 getVideoApiUrl 函数。
}

// 定义单条视频卡片组件。
function FeedItem({
  // 接收当前要渲染的视频数据。
  item,
  // 接收当前视频项高度。
  height,
  // 接收当前视频是否处于激活播放状态。
  isActive,
  // 接收当前视频是否需要挂载播放器。
  shouldMountPlayer,
  // 定义 FeedItem 参数类型。
}: {
  // item 必须符合 FeedVideo 结构。
  item: FeedVideo;
  // height 是当前视频项高度。
  height: number;
  // isActive 表示当前项是否应该播放。
  isActive: boolean;
  // shouldMountPlayer 表示当前项是否处在预加载窗口内。
  shouldMountPlayer: boolean;
  // 结束 FeedItem 参数类型。
}) {
  // 保存用户是否手动暂停了当前视频。
  const [isPausedByUser, setIsPausedByUser] = useState(false);

  // 每次视频重新成为当前项时，清掉上一次手动暂停状态。
  useEffect(() => {
    // 只有进入激活态时才重置，避免用户当前点击暂停后立刻被恢复。
    if (isActive) {
      // 清除用户暂停状态，让重新刷到该视频时自动播放。
      setIsPausedByUser(false);
    }
    // 只跟随激活态变化。
  }, [isActive]);

  // 返回单条视频的完整 UI。
  return (
    // 视频项外层容器，高度等于当前屏幕可用高度。
    <View style={[styles.item, { height }]}>
      {/* 视频加载前或视频区域背后的底色层。 */}
      <View style={styles.videoFallback} />

      {/* 点击视频区域可以切换暂停和播放。 */}
      <TouchableOpacity
        // 视频舞台铺满整条 item。
        style={styles.videoStage}
        // 点击时不降低透明度，避免视频闪烁。
        activeOpacity={1}
        // 点击后切换用户暂停状态。
        onPress={() => setIsPausedByUser((paused) => !paused)}>
        {/* 只有预加载窗口内的 item 才挂载播放器；窗口外只保留黑底和叠层。 */}
        {shouldMountPlayer && (
          <FeedVideoPlayer
            item={item}
            isActive={isActive}
            isPausedByUser={isPausedByUser}
          />
        )}
        {/* 当前视频激活且被用户暂停时显示暂停提示。 */}
        {isActive && isPausedByUser && (
          // 暂停提示的半透明圆形背景。
          <View style={styles.pauseIndicator}>
            {/* 暂停后展示的播放按钮符号。 */}
            <Text style={styles.pauseIcon}>▶</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 保留一个空 View，不影响布局，和原页面结构保持一致。 */}
      <View />

      {/* 右侧点赞、评论、收藏、分享等操作区。 */}
      <View style={styles.actions}>
        {/* 作者头像区域。 */}
        <View style={styles.avatar}>
          {/* 头像里的文字。 */}
          <Text style={styles.avatarText}>云</Text>
          {/* 关注加号角标。 */}
          <View style={styles.followBadge}>
            {/* 关注加号图标。 */}
            <Plus size={13} color="#fff" />
          </View>
        </View>
        {/* 点赞按钮。 */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          {/* 点赞图标。 */}
          <Heart size={34} color="#fff" />
          {/* 点赞数量。 */}
          <Text style={styles.actionText}>1.4w</Text>
        </TouchableOpacity>
        {/* 评论按钮。 */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          {/* 评论图标。 */}
          <MessageCircle size={34} color="#fff" />
          {/* 评论数量。 */}
          <Text style={styles.actionText}>321</Text>
        </TouchableOpacity>
        {/* 收藏按钮。 */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          {/* 收藏图标。 */}
          <Bookmark size={34} color="#fff" />
          {/* 收藏数量。 */}
          <Text style={styles.actionText}>15</Text>
        </TouchableOpacity>
        {/* 分享按钮。 */}
        <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
          {/* 分享图标。 */}
          <Share2 size={34} color="#fff" />
          {/* 分享数量。 */}
          <Text style={styles.actionText}>9</Text>
        </TouchableOpacity>
      </View>

      {/* 左下角视频信息区。 */}
      <View style={styles.meta}>
        {/* 作者和标签所在的一行。 */}
        <View style={styles.authorRow}>
          {/* 作者名。 */}
          <Text style={styles.author}>{item.author}</Text>
          {/* 标签胶囊背景。 */}
          <View style={styles.tagPill}>
            {/* 标签文字。 */}
            <Text style={styles.tagText}>{item.tag}</Text>
          </View>
        </View>
        {/* 视频文案，最多显示三行。 */}
        <Text style={styles.caption} numberOfLines={3}>
          {/* 渲染接口返回的视频文案。 */}
          {item.caption}
        </Text>
        {/* 话题标签，最多显示一行。 */}
        <Text style={styles.hashtags} numberOfLines={1}>
          {/* 固定展示的话题标签。 */}
          #云南ip #云南服务器租用 #云南服务商
        </Text>
      </View>
    </View>
  );
  // 结束 FeedItem 组件。
}

// 定义真正持有 expo-video 播放器的子组件，方便窗口外卸载释放播放器。
function FeedVideoPlayer({
  // 接收当前要播放的视频数据。
  item,
  // 接收当前播放器是否应该播放。
  isActive,
  // 接收用户是否手动暂停。
  isPausedByUser,
}: {
  // item 必须符合 FeedVideo 结构。
  item: FeedVideo;
  // isActive 表示当前项是否处于播放位。
  isActive: boolean;
  // isPausedByUser 表示用户是否手动暂停当前项。
  isPausedByUser: boolean;
}) {
  // 根据视频地址创建 expo-video 播放器实例；组件卸载时 useVideoPlayer 会自动清理。
  const player = useVideoPlayer(item.uri, (player) => {
    // 设置视频循环播放。
    player.loop = true;
    // 预加载窗口里的非激活视频保持静音，避免多播放器抢音频。
    player.muted = true;
    // 结束播放器初始化回调。
  });

  // 根据激活状态和用户暂停状态控制播放或暂停。
  useEffect(() => {
    // 只有当前项激活并且用户没有手动暂停，才允许出声播放。
    if (isActive && !isPausedByUser) {
      // 当前播放器解除静音。
      player.muted = false;
      // 调用播放器播放。
      player.play();
      // 否则暂停播放器并静音。
    } else {
      // 非激活播放器始终静音。
      player.muted = true;
      // 调用播放器暂停。
      player.pause();
    }
    // 依赖变化时重新判断播放状态。
  }, [isActive, isPausedByUser, player]);

  // 返回真正渲染视频画面的组件。
  return (
    <VideoView
      // 视频组件铺满舞台。
      style={styles.video}
      // 绑定当前播放器实例。
      player={player}
      // 保持视频完整显示，不裁剪内容。
      contentFit="contain"
      // 隐藏系统原生控制条。
      nativeControls={false}
    />
  );
  // 结束 FeedVideoPlayer 组件。
}

// 根据当前索引、激活索引和滑动方向，判断是否保留播放器。
function shouldMountFeedPlayer(index: number, activeIndex: number, direction: 'up' | 'down') {
  // 计算当前项和激活项的距离。
  const distanceFromActive = index - activeIndex;
  // 当前项永远保留播放器。
  if (distanceFromActive === 0) {
    // 当前项需要挂载播放器。
    return true;
  }

  // 紧邻前后项无论方向都保留，避免来回轻滑时黑屏。
  if (Math.abs(distanceFromActive) <= 1) {
    // 邻居项需要挂载播放器。
    return true;
  }

  // 判断当前项是否在滑动方向前方。
  const isAhead = direction === 'down' ? distanceFromActive > 0 : distanceFromActive < 0;
  // 判断当前项是否在滑动方向后方。
  const isBehind = direction === 'down' ? distanceFromActive < 0 : distanceFromActive > 0;

  // 滑动方向前方保留更多播放器，用来提前加载即将刷到的视频。
  if (isAhead && Math.abs(distanceFromActive) <= PRELOAD_AHEAD) {
    // 前方预加载窗口内需要挂载播放器。
    return true;
  }

  // 滑动方向后方只保留少量播放器，降低内存占用。
  if (isBehind && Math.abs(distanceFromActive) <= PRELOAD_BEHIND) {
    // 后方预加载窗口内需要挂载播放器。
    return true;
  }

  // 远离当前播放位的 item 不挂载播放器。
  return false;
  // 结束 shouldMountFeedPlayer 函数。
}

// 定义首页组件。
export default function HomeScreen() {
  // 获取设备顶部安全区高度。
  const insets = useSafeAreaInsets();
  // 判断当前 Tab 页面是否处于聚焦状态。
  const isFocused = useIsFocused();
  // 保存当前滑动方向，控制预加载窗口前后数量。
  const directionRef = useRef<'up' | 'down'>('down');
  // 保存当前激活 index 的同步引用，滚动结束时裁剪数据会用到。
  const activeIndexRef = useRef(0);
  // 保存当前数据长度的同步引用，避免裁剪逻辑依赖过期闭包。
  const videosLengthRef = useRef(0);
  // 记录当前数据窗口第一条对应的全局偏移，避免把分页状态绑在 videos.length 上。
  const baseVideoIndexRef = useRef(0);
  // 保存当前激活视频的索引，用于控制哪条视频播放。
  const [activeIndex, setActiveIndex] = useState(0);
  // 保存视频流区域高度，用于一屏一条视频。
  const [feedHeight, setFeedHeight] = useState(0);
  // 保存当前已经请求到的分页页码。
  const [videoPage, setVideoPage] = useState(INITIAL_VIDEO_PAGE);
  // 保存接口返回并转换后的首页视频列表。
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  // 保存已经从头部裁掉的数据数量，用等高 header 占位保持滚动位置稳定。
  const [trimmedHeadCount, setTrimmedHeadCount] = useState(0);
  // 控制首次请求时的 loading 遮罩。
  const [isLoading, setIsLoading] = useState(true);
  // 控制加载下一页时的状态，避免重复触发分页请求。
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 保存接口请求失败时需要展示的错误文案。
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // videoPage 变化后请求对应 page 的视频列表。
  useEffect(() => {
    // AbortController 用来在组件卸载时取消尚未完成的请求。
    const controller = new AbortController();
    // 判断当前请求是否是首次加载。
    const isFirstPage = videoPage === INITIAL_VIDEO_PAGE;

    // 封装异步请求逻辑，方便在 effect 内调用。
    async function loadVideos() {
      // try/catch/finally 分别处理成功、失败和收尾状态。
      try {
        // 根据是否首次加载决定显示哪种 loading。
        if (isFirstPage) {
          // 首次请求打开全屏 loading。
          setIsLoading(true);
          // 非首次请求进入加载更多状态。
        } else {
          // 后续分页只标记加载更多。
          setIsLoadingMore(true);
        }
        // 请求开始时清空上一次错误。
        setErrorMessage(null);

        // 调用首页视频接口，并把取消信号传给 fetch。
        const response = await fetch(getVideoApiUrl(videoPage), {
          // 组件卸载时可通过 controller.abort() 中断请求。
          signal: controller.signal,
        });

        // 非 2xx 状态码统一当作请求失败。
        if (!response.ok) {
          // 抛出带状态码的错误，方便展示。
          throw new Error(`请求失败：${response.status}`);
        }

        // 把接口响应体解析成 JSON。
        const payload = await response.json();
        // 接口返回格式固定，直接使用 data 作为视频数组。
        const nextVideos = payload.data as FeedVideo[];

        // 判断是否是第一页数据。
        if (isFirstPage) {
          // 首次请求直接渲染接口数据。
          setVideos(nextVideos);
          // 首次加载重置数据窗口偏移。
          baseVideoIndexRef.current = 0;
          // 首次加载清空头部占位。
          setTrimmedHeadCount(0);
          // 首次加载同步记录当前数据长度。
          videosLengthRef.current = nextVideos.length;
          // 首次加载重置当前播放 index。
          activeIndexRef.current = 0;
          setActiveIndex(0);
          // 非第一页数据需要追加到已有列表后面。
        } else {
          // 使用函数式 setState，确保拿到最新的视频列表。
          setVideos((currentVideos) => {
            // 把当前列表和新请求到的一页直接合并，不做裁剪。
            const mergedVideos = [...currentVideos, ...nextVideos];
            // 同步记录合并后的数据长度，供滚动结束裁剪使用。
            videosLengthRef.current = mergedVideos.length;
            // 返回合并结果。
            return mergedVideos;
          });
        }
        // 捕获请求、解析或状态码异常。
      } catch (error) {
        // 如果是组件卸载导致的主动取消，不展示错误。
        if (error instanceof Error && error.name === 'AbortError') {
          // 直接结束本次请求处理。
          return;
        }

        // 保存错误文案，用于页面顶部提示。
        setErrorMessage(error instanceof Error ? error.message : '视频加载失败');
        // 无论成功失败都要收尾 loading 状态。
      } finally {
        // 如果请求没有被取消，就关闭 loading。
        if (!controller.signal.aborted) {
          // 请求完成后隐藏 loading 遮罩。
          setIsLoading(false);
          // 请求完成后允许下一次分页触发。
          setIsLoadingMore(false);
        }
      }
    }

    // 触发首页视频请求。
    loadVideos();

    // 组件卸载时取消请求，避免卸载后继续 setState。
    return () => {
      // 中断正在进行中的 fetch 请求。
      controller.abort();
    };
    // 当 videoPage 变化时重新请求接口。
  }, [videoPage]);

  // activeIndex 变化时同步给 ref，方便滚动回调拿到最新值。
  useEffect(() => {
    // 同步当前激活 index。
    activeIndexRef.current = activeIndex;
    // 依赖当前激活 index。
  }, [activeIndex]);

  // videos 长度变化时同步给 ref，方便滚动回调拿到最新值。
  useEffect(() => {
    // 同步当前数据长度。
    videosLengthRef.current = videos.length;
    // 依赖当前数据长度。
  }, [videos.length]);

  // 滚动结束后再裁剪头部数据，避免边滚动边改 data 导致 LegendList 偶发空白。
  const trimVideosIfNeeded = useCallback(() => {
    // feed 高度还没准备好时不裁剪。
    if (feedHeight <= 0) {
      // 直接退出。
      return;
    }

    // 读取最新的数据长度和当前播放 index。
    const currentLength = videosLengthRef.current;
    const currentActiveIndex = activeIndexRef.current;

    // 数据不多时不裁剪。
    if (currentLength <= MAX_VIDEO_ITEMS) {
      // 直接退出。
      return;
    }

    // 当前播放位置还靠近头部时不裁剪，避免裁到当前视频前后的缓存窗口。
    if (currentActiveIndex < MIN_ACTIVE_INDEX_BEFORE_TRIM) {
      // 继续保留头部数据。
      return;
    }

    // 计算本次最多能裁掉多少，确保不会裁过当前播放项。
    const trimCount = Math.min(TRIM_HEAD_COUNT, currentActiveIndex);
    // 裁剪后的当前播放本地 index。
    const nextActiveIndex = currentActiveIndex - trimCount;

    // 更新同步 ref，避免后续滚动回调读到旧 index。
    activeIndexRef.current = nextActiveIndex;
    // 更新全局偏移；后续如果需要埋点/恢复位置，可以用这个值还原全局 index。
    baseVideoIndexRef.current += trimCount;
    // 增加等高头部占位，避免裁剪后主动滚动导致视频短暂黑屏。
    setTrimmedHeadCount((count) => count + trimCount);

    // 裁掉头部旧数据，分页页码 videoPage 不变，因此不会影响继续加载更多。
    setVideos((currentVideos) => {
      // 如果数据在回调前已经变化到无需裁剪，则保持原样。
      if (currentVideos.length <= MAX_VIDEO_ITEMS || currentActiveIndex >= currentVideos.length) {
        // 同步当前长度。
        videosLengthRef.current = currentVideos.length;
        // 返回原数据。
        return currentVideos;
      }

      // 生成裁剪后的数据窗口。
      const trimmedVideos = currentVideos.slice(trimCount);
      // 同步裁剪后的长度。
      videosLengthRef.current = trimmedVideos.length;
      // 返回裁剪结果。
      return trimmedVideos;
    });

    // 同步修正当前播放 index。
    setActiveIndex(nextActiveIndex);
    // 依赖 feedHeight，因为 offset 需要用到 item 高度。
  }, [feedHeight]);

  // 配置 LegendList 判断可见项的规则。
  const viewabilityConfig = useRef({
    // item 至少 50% 可见才认为它是当前可见项，和一屏一条视频的吸附更匹配。
    itemVisiblePercentThreshold: 50,
    // 不等待用户交互，首次渲染也能选出当前视频。
    waitForInteraction: false,
    // 不额外等待可见时长。
    minimumViewTime: 0,
    // 可见区域覆盖阈值和 item 阈值保持一致。
    viewAreaCoveragePercentThreshold: 50,
    // 使用 ref 固定配置对象，避免列表配置变化。
  }).current;

  // LegendList 可见项变化时更新当前激活索引。
  const onViewableItemsChanged = useRef(
    // 接收 LegendList 回调传入的可见项数组。
    ({ viewableItems }: { viewableItems: ViewToken<FeedVideo>[] }) => {
      // 取第一个可见项的索引。
      const nextIndex = viewableItems[0]?.index;

      // 只有索引是数字时才更新状态。
      if (typeof nextIndex === 'number') {
        // 同步 state，触发当前视频播放状态更新。
        setActiveIndex((currentIndex) => {
          // 根据前后 index 判断当前滑动方向。
          if (nextIndex !== currentIndex) {
            // 更新方向 ref，供 renderItem 计算非对称预加载窗口。
            directionRef.current = nextIndex > currentIndex ? 'down' : 'up';
          }

          // 同步 ref，滚动结束裁剪会读取它。
          activeIndexRef.current = nextIndex;
          // 返回新的激活索引。
          return nextIndex;
        });
      }
    }
    // 使用 ref 固定回调引用，避免 LegendList 反复注册。
  ).current;

  // LegendList 使用 callback pairs 注册可见项回调，保持配置对象稳定。
  const viewabilityConfigCallbackPairs = useRef([
    {
      // 使用上面固定的可见项配置。
      viewabilityConfig,
      // 可见项变化时更新当前播放索引。
      onViewableItemsChanged,
    },
  ]).current;

  // 缓存 LegendList 的单项渲染函数。
  const renderItem = useCallback(
    // 接收当前 item 和 index，并渲染 FeedItem。
    ({ item, index }: { item: FeedVideo; index: number }) => {
      // 当前 item 是否是真正播放位。
      const isActive = isFocused && index === activeIndex;
      // 当前 item 是否在播放器挂载窗口内。
      const shouldMountPlayer =
        isFocused && shouldMountFeedPlayer(index, activeIndex, directionRef.current);

      // FeedItem 负责单条视频外壳和覆盖 UI，播放器只在窗口内挂载。
      return (
        <FeedItem
          item={item}
          height={feedHeight}
          isActive={isActive}
          shouldMountPlayer={shouldMountPlayer}
        />
      );
    },
    // activeIndex、feedHeight、isFocused 变化时重新生成渲染函数。
    [activeIndex, feedHeight, isFocused]
  );

  // 列表接近底部时触发加载下一页。
  const handleEndReached = useCallback(() => {
    // 如果首次加载或分页加载正在进行，就不重复请求。
    if (isLoading || isLoadingMore) {
      // 直接退出，避免重复加页码。
      return;
    }

    // 页码加一，触发 useEffect 重新请求接口。
    setVideoPage((page) => page + 1);
    // loading 状态变化时更新回调。
  }, [isLoading, isLoadingMore]);

  // 滚动结束时再做数据窗口裁剪，避免滚动过程中改 data 导致空白。
  const handleScrollEnd = useCallback(() => {
    // 等待可见项回调先更新 activeIndex。
    requestAnimationFrame(() => {
      // 尝试裁剪过旧数据。
      trimVideosIfNeeded();
    });
    // 裁剪函数变化时更新回调。
  }, [trimVideosIfNeeded]);

  // 给 LegendList 提供固定 item 高度，避免动态测量带来的额外开销。
  const getFixedItemSize = useCallback(() => feedHeight, [feedHeight]);

  // 当前列表只包含一种 item 类型，固定类型可以减少内部判断。
  const getItemType = useCallback(() => 'video', []);

  // 控制列表在可视区域外绘制的距离。
  const drawDistance = feedHeight * DRAW_DISTANCE_MULTIPLIER;
  // 被裁掉的头部数据对应的占位高度，保持滚动内容总高度连续。
  const trimmedHeaderHeight = trimmedHeadCount * feedHeight;

  // 返回首页整体 UI。
  return (
    // 页面根容器。
    <View
      // 根容器样式。
      style={styles.container}
      // 获取根容器高度，用作每条视频的高度。
      onLayout={(event) => setFeedHeight(event.nativeEvent.layout.height)}>
      {/* 设置沉浸式透明状态栏。 */}
      <StatusBar
        // 让状态栏浮在内容上方。
        translucent
        // 状态栏背景透明。
        backgroundColor="transparent"
        // 状态栏图标使用浅色。
        barStyle="light-content"
      />

      {/* 只有拿到高度后才渲染 LegendList，确保每条视频高度正确。 */}
      {feedHeight > 0 && (
        // 视频流列表。
        <LegendList
          // 列表数据来自接口。
          data={videos}
          // 使用服务端保证唯一的 id 作为 key。
          keyExtractor={(item) => item.id}
          // 使用缓存后的单项渲染函数。
          renderItem={renderItem}
          // activeIndex / 数据长度 / 聚焦状态变化时显式刷新 item。
          extraData={`${activeIndex}:${videos.length}:${trimmedHeadCount}:${isFocused}`}
          // 用头部占位补回被裁掉的数据高度，避免裁剪时列表跳动。
          ListHeaderComponent={
            trimmedHeaderHeight > 0 ? (
              <View style={{ height: trimmedHeaderHeight }} />
            ) : null
          }
          // 告诉列表头部占位的估算高度，减少裁剪后的布局抖动。
          estimatedHeaderSize={trimmedHeaderHeight}
          // 开启分页滚动，一次滑动一屏。
          pagingEnabled
          // 隐藏右侧滚动条。
          showsVerticalScrollIndicator={false}
          // 禁止多页惯性滚动。
          disableIntervalMomentum
          // 使用正常减速手感。
          decelerationRate={DECELERATION_RATE}
          // 设置可见项判断规则和回调。
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
          // 接近底部时加载下一页。
          onEndReached={handleEndReached}
          // 惯性滚动结束后裁剪旧数据。
          onMomentumScrollEnd={handleScrollEnd}
          // 拖拽结束后也尝试裁剪，覆盖没有惯性滚动的情况。
          onScrollEndDrag={handleScrollEnd}
          // 倒数第二条数据附近开始加载更多数据。
          onEndReachedThreshold={1.2}
          // 告诉 LegendList 单项高度，减少测量和布局抖动。
          estimatedItemSize={feedHeight}
          // 提供固定 item 高度，匹配一屏一条视频。
          getFixedItemSize={getFixedItemSize}
          // 限制可视区域外绘制距离。
          drawDistance={drawDistance}
          // 当前列表只有视频一种类型。
          getItemType={getItemType}
          // 控制滚动事件频率。
          scrollEventThrottle={SCROLL_EVENT_THROTTLE}
          // 禁用顶部/底部弹性和 Android 过度滚动光效。
          bounces={false}
          // Android 关闭越界滚动光效。
          overScrollMode="never"
        />
      )}

      {/* 首次加载时显示居中的 loading。 */}
      {isLoading && (
        // loading 遮罩。
        <View style={styles.loadingOverlay}>
          {/* 白色加载指示器。 */}
          <ActivityIndicator color="#fff" />
        </View>
      )}

      {/* 请求失败且 loading 结束后显示错误提示。 */}
      {errorMessage && !isLoading && (
        // 错误提示条。
        <View style={styles.errorToast}>
          {/* 错误提示文字。 */}
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* 顶部导航栏，位置避开安全区。 */}
      <View style={[styles.topBar, { top: insets.top + 12 }]}>
        {/* 左侧菜单按钮。 */}
        <TouchableOpacity style={styles.menuButton} activeOpacity={0.8}>
          {/* 菜单图标。 */}
          <Menu size={32} color="#fff" />
          {/* 菜单消息角标。 */}
          <View style={styles.menuBadge}>
            {/* 角标数字。 */}
            <Text style={styles.menuBadgeText}>17</Text>
          </View>
        </TouchableOpacity>

        {/* 中间频道列表。 */}
        <View style={styles.channels}>
          {/* 遍历频道并渲染文字。 */}
          {channels.map((channel) => {
            // 当前高亮频道固定为推荐。
            const active = channel === '推荐';

            // 返回单个频道文字。
            return (
              // 频道文字，激活时追加高亮样式。
              <Text key={channel} style={[styles.channelText, active && styles.channelActive]}>
                {/* 渲染频道名称。 */}
                {channel}
              </Text>
            );
          })}
        </View>

        {/* 右侧搜索按钮。 */}
        <TouchableOpacity style={styles.searchButton} activeOpacity={0.8}>
          {/* 搜索图标。 */}
          <Search size={34} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
  // 结束 HomeScreen 组件。
}

// 创建页面样式对象。
const styles = StyleSheet.create({
  // 页面根容器样式。
  container: {
    // 占满父容器。
    flex: 1,
    // 页面背景色为黑色。
    backgroundColor: '#000',
  },
  // 单条视频 item 样式。
  item: {
    // 隐藏超出 item 范围的内容。
    overflow: 'hidden',
    // item 默认背景色。
    backgroundColor: '#111',
  },
  // 视频底层占位背景样式。
  videoFallback: {
    // 铺满父容器。
    ...StyleSheet.absoluteFillObject,
    // 设置半透明黑色背景。
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  // 视频舞台样式。
  videoStage: {
    // 铺满父容器。
    ...StyleSheet.absoluteFillObject,
    // 子元素水平居中。
    alignItems: 'center',
    // 子元素垂直居中。
    justifyContent: 'center',
    // 视频区域背景黑色。
    backgroundColor: '#000',
  },
  // 视频组件样式。
  video: {
    // 视频宽度占满父容器。
    width: '100%',
    // 视频高度占满父容器。
    height: '100%',
  },
  // loading 遮罩样式。
  loadingOverlay: {
    // loading 遮罩铺满整个首页。
    ...StyleSheet.absoluteFillObject,
    // zIndex 低于顶部栏和错误提示，高于视频内容。
    zIndex: 8,
    // 水平方向居中 loading。
    alignItems: 'center',
    // 垂直方向居中 loading。
    justifyContent: 'center',
    // loading 背景保持黑色，贴合视频页视觉。
    backgroundColor: '#000',
  },
  // 错误提示容器样式。
  errorToast: {
    // 错误提示使用绝对定位浮在内容上方。
    position: 'absolute',
    // 左侧和屏幕保持 16 像素距离。
    left: 16,
    // 右侧和屏幕保持 16 像素距离。
    right: 16,
    // 顶部位置避开状态栏和频道栏。
    top: 96,
    // zIndex 高于 loading 和顶部栏，确保提示可见。
    zIndex: 12,
    // 圆角保持和当前 UI 风格一致。
    borderRadius: 8,
    // 横向内边距让文字不贴边。
    paddingHorizontal: 14,
    // 纵向内边距让提示条有可读高度。
    paddingVertical: 10,
    // 使用半透明红色作为错误提示背景。
    backgroundColor: 'rgba(255, 45, 103, 0.88)',
  },
  // 错误提示文字样式。
  errorText: {
    // 错误文字使用白色保证对比度。
    color: '#fff',
    // 错误文字字号保持轻提示样式。
    fontSize: 14,
    // 错误文字加粗提高可读性。
    fontWeight: '700',
    // 错误文字居中展示。
    textAlign: 'center',
  },
  // 暂停提示圆形背景样式。
  pauseIndicator: {
    // 使用绝对定位叠加在视频中间。
    position: 'absolute',
    // 暂停圆宽度。
    width: 76,
    // 暂停圆高度。
    height: 76,
    // 圆角为宽高一半，形成圆形。
    borderRadius: 38,
    // 图标水平居中。
    alignItems: 'center',
    // 图标垂直居中。
    justifyContent: 'center',
    // 半透明黑色背景。
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  // 暂停图标文字样式。
  pauseIcon: {
    // 图标颜色为白色。
    color: '#fff',
    // 图标字号。
    fontSize: 36,
    // 略微右移，让播放三角视觉居中。
    marginLeft: 4,
  },
  // 顶部导航栏样式。
  topBar: {
    // 顶部栏浮在视频上。
    position: 'absolute',
    // 左侧间距。
    left: 16,
    // 右侧间距。
    right: 16,
    // 层级高于视频内容。
    zIndex: 10,
    // 横向排列菜单、频道、搜索。
    flexDirection: 'row',
    // 垂直居中。
    alignItems: 'center',
    // 子元素之间间距。
    gap: 12,
  },
  // 菜单按钮样式。
  menuButton: {
    // 按钮宽度。
    width: 40,
    // 按钮高度。
    height: 40,
    // 图标水平居中。
    alignItems: 'center',
    // 图标垂直居中。
    justifyContent: 'center',
  },
  // 菜单角标样式。
  menuBadge: {
    // 角标浮在菜单按钮右上方。
    position: 'absolute',
    // 角标顶部偏移。
    top: -5,
    // 角标右侧偏移。
    right: -4,
    // 角标最小宽度。
    minWidth: 22,
    // 角标高度。
    height: 22,
    // 圆角让角标变圆。
    borderRadius: 11,
    // 角标文字水平居中。
    alignItems: 'center',
    // 角标文字垂直居中。
    justifyContent: 'center',
    // 角标背景色。
    backgroundColor: '#ff2d67',
  },
  // 菜单角标文字样式。
  menuBadgeText: {
    // 文字颜色白色。
    color: '#fff',
    // 文字字号。
    fontSize: 11,
    // 文字加粗。
    fontWeight: '700',
  },
  // 频道容器样式。
  channels: {
    // 占满中间剩余空间。
    flex: 1,
    // 频道横向排列。
    flexDirection: 'row',
    // 频道垂直居中。
    alignItems: 'center',
    // 频道平均分布。
    justifyContent: 'space-between',
  },
  // 普通频道文字样式。
  channelText: {
    // 普通频道文字半透明白色。
    color: 'rgba(255, 255, 255, 0.72)',
    // 频道文字字号。
    fontSize: 17,
    // 频道文字加粗。
    fontWeight: '700',
  },
  // 激活频道文字样式。
  channelActive: {
    // 激活频道文字纯白。
    color: '#fff',
    // 激活频道添加下划线。
    textDecorationLine: 'underline',
  },
  // 搜索按钮样式。
  searchButton: {
    // 按钮宽度。
    width: 40,
    // 按钮高度。
    height: 40,
    // 图标水平居中。
    alignItems: 'center',
    // 图标垂直居中。
    justifyContent: 'center',
  },
  // 右侧操作区样式。
  actions: {
    // 操作区浮在视频上。
    position: 'absolute',
    // 距离右边 16 像素。
    right: 16,
    // 距离底部 48 像素。
    bottom: 48,
    // 操作按钮水平居中。
    alignItems: 'center',
    // 操作项之间间距。
    gap: 18,
  },
  // 作者头像样式。
  avatar: {
    // 头像宽度。
    width: 54,
    // 头像高度。
    height: 54,
    // 圆角为宽高一半形成圆形头像。
    borderRadius: 27,
    // 头像文字水平居中。
    alignItems: 'center',
    // 头像文字垂直居中。
    justifyContent: 'center',
    // 头像边框宽度。
    borderWidth: 2,
    // 头像边框颜色。
    borderColor: '#fff',
    // 头像背景色。
    backgroundColor: '#31a7e8',
  },
  // 头像文字样式。
  avatarText: {
    // 头像文字颜色。
    color: '#fff',
    // 头像文字字号。
    fontSize: 18,
    // 头像文字加粗。
    fontWeight: '900',
  },
  // 关注角标样式。
  followBadge: {
    // 关注角标浮在头像右下角。
    position: 'absolute',
    // 角标右侧偏移。
    right: -2,
    // 角标底部偏移。
    bottom: -4,
    // 角标宽度。
    width: 22,
    // 角标高度。
    height: 22,
    // 圆角形成圆形角标。
    borderRadius: 11,
    // 加号水平居中。
    alignItems: 'center',
    // 加号垂直居中。
    justifyContent: 'center',
    // 角标背景色。
    backgroundColor: '#ff2d67',
  },
  // 单个操作按钮样式。
  actionButton: {
    // 图标和文字水平居中。
    alignItems: 'center',
    // 图标和文字之间间距。
    gap: 4,
  },
  // 操作按钮文字样式。
  actionText: {
    // 文字颜色白色。
    color: '#fff',
    // 文字字号。
    fontSize: 13,
    // 文字加粗。
    fontWeight: '700',
  },
  // 左下角视频信息区域样式。
  meta: {
    // 信息区域浮在视频上。
    position: 'absolute',
    // 距离左边 16 像素。
    left: 16,
    // 右侧避开操作按钮区域。
    right: 92,
    // 距离底部 28 像素。
    bottom: 28,
    // 信息行之间间距。
    gap: 10,
  },
  // 作者和标签所在行样式。
  authorRow: {
    // 横向排列作者和标签。
    flexDirection: 'row',
    // 垂直居中。
    alignItems: 'center',
    // 作者和标签之间间距。
    gap: 10,
  },
  // 作者文字样式。
  author: {
    // 作者文字颜色。
    color: '#fff',
    // 作者文字字号。
    fontSize: 18,
    // 作者文字加粗。
    fontWeight: '900',
  },
  // 标签胶囊样式。
  tagPill: {
    // 标签圆角。
    borderRadius: 8,
    // 标签横向内边距。
    paddingHorizontal: 10,
    // 标签纵向内边距。
    paddingVertical: 5,
    // 标签半透明背景。
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  // 标签文字样式。
  tagText: {
    // 标签文字颜色。
    color: '#fff',
    // 标签文字字号。
    fontSize: 14,
    // 标签文字加粗。
    fontWeight: '700',
  },
  // 视频文案样式。
  caption: {
    // 文案文字颜色。
    color: '#fff',
    // 文案文字字号。
    fontSize: 16,
    // 文案行高。
    lineHeight: 22,
    // 文案文字加粗。
    fontWeight: '600',
  },
  // 话题标签样式。
  hashtags: {
    // 话题文字颜色。
    color: '#fff',
    // 话题文字字号。
    fontSize: 15,
    // 话题文字加粗。
    fontWeight: '700',
  },
  // 结束样式对象。
});
