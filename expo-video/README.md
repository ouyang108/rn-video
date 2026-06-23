# Expo Video

## SafeAreaProvider

### 作用

`SafeAreaProvider` 是 `react-native-safe-area-context` 库提供的**上下文提供者（Context Provider）**，负责测量并向下传递设备的安全区域边距（如状态栏、灵动岛、底部 Home Indicator 等）。

### 使用方式

必须在应用的**根布局**中包裹，通常在 `_layout.tsx` 中：

```tsx
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* 其他所有组件 */}
    </SafeAreaProvider>
  );
}
```

本项目中的实际用法（[src/app/_layout.tsx](src/app/_layout.tsx)）：

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <HeroUINativeProvider>
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  </HeroUINativeProvider>
</GestureHandlerRootView>
```

### 注意事项

1. **只需一个 Provider**：`SafeAreaProvider` 只能存在一个，放在根组件中即可，不要在子组件中再次包裹。
2. **必须是最外层之一**：Provider 需要能测量整个屏幕，因此应该尽量靠近根节点，包裹所有需要安全区域的子组件。
3. **不产生任何视觉 UI**：它本身不渲染任何视图，仅提供上下文数据。

---

## SafeAreaView

### 作用

`SafeAreaView` 是 `react-native-safe-area-context` 提供的**视图组件**，会自动给内容添加 `padding`，使内容避开设备的安全区域（刘海、灵动岛、状态栏、底部指示条等）。

### 使用方式

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

// 作为页面容器：内容不会与安全区域重叠
<SafeAreaView style={{ flex: 1 }}>
  <Text>这段文字不会被刘海或底部指示条遮挡</Text>
</SafeAreaView>
```

### 常用属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `edges` | `('top' \| 'bottom' \| 'left' \| 'right')[]` | 指定需要避开哪些边缘。默认 `['top', 'bottom', 'left', 'right']` |
| `mode` | `'padding' \| 'margin'` | 安全区域的实现方式，默认 `'padding'` |

```tsx
// 只需要避开顶部安全区域（例如在全屏视频播放页面）
<SafeAreaView edges={['top']} style={{ flex: 1 }}>
  <VideoPlayer />
</SafeAreaView>
```

### 注意事项

1. **必须嵌套在 `SafeAreaProvider` 内部**：单独使用 `SafeAreaView` 而不包裹 `SafeAreaProvider` 会报错或无法获取正确的安全区域值。
2. **与 React Native 自带组件的区别**：React Native 也有一个 `SafeAreaView`（仅 iOS），功能有限且不支持动态更新。建议始终从 `react-native-safe-area-context` 导入，它跨平台、功能更完善。
3. **`flex: 1` 与安全区域的配合**：给 `SafeAreaView` 设置 `style={{ flex: 1 }}` 可以让它填满整个可用空间（扣除安全区域后的剩余空间），这是最常见的布局方式。
4. **嵌套顺序敏感**：`SafeAreaView` 的 padding 会叠加。如果你在一个 `SafeAreaView` 内再嵌套一个 `SafeAreaView`，内层的 padding 会在外层的基础上再增加。
5. **`edges` 的默认值**：默认四条边都会添加安全区域 padding。如果你的页面顶部有自定义 Header，可能只需要 `edges={['bottom']}` 来避开底部指示条。

---

## SafeAreaProvider vs SafeAreaView 对比

| | SafeAreaProvider | SafeAreaView |
|---|---|---|
| **类型** | Context Provider（上下文提供者） | View 组件 |
| **数量** | 应用中只有 1 个 | 每个页面 / 组件可以有多个 |
| **视觉表现** | 不可见 | 可见的布局容器 |
| **职责** | 测量安全区域、提供数据 | 根据数据为子组件添加内边距 |
| **依赖关系** | 独立使用 | 必须嵌套在 SafeAreaProvider 内 |

---

## Stack（expo-router 堆叠导航）

### 作用

`Stack` 是 Expo Router 提供的**堆叠式导航容器**。它以"页面栈"的方式管理屏幕切换——新页面从右侧推入，返回时从左侧弹出，符合 iOS/Android 原生导航习惯。

### 使用方式

```tsx
import { Stack } from 'expo-router';

// 在根布局 _layout.tsx 中定义顶层路由栈
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
</Stack>
```

本项目中的实际用法（[src/app/_layout.tsx](src/app/_layout.tsx)）：

```tsx
<SafeAreaView style={{ flex: 1 }}>
  <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
    <Stack>
      {/* (tabs) 是一个布局组目录，包含多个 tab 页面 */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* modal 是一个独立的模态页面 */}
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
    <StatusBar style="auto" />
  </ThemeProvider>
</SafeAreaView>
```

### 常用属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `screenOptions` | `object` | 作用于所有 `Stack.Screen` 的默认配置，可被单个 Screen 的 `options` 覆盖 |
| `initialRouteName` | `string` | 指定初始加载的路由名称 |

### Stack.Screen 常用 options

| 选项 | 类型 | 说明 |
|------|------|------|
| `headerShown` | `boolean` | 是否显示顶部导航栏。默认 `true` |
| `title` | `string` | 导航栏标题文字 |
| `presentation` | `'card'` \| `'modal'` \| `'transparentModal'` \| `'containedModal'` \| `'containedTransparentModal'` \| `'fullScreenModal'` \| `'formSheet'` | 页面的呈现方式 |
| `headerStyle` | `object` | 导航栏样式（背景色等） |
| `headerTintColor` | `string` | 导航栏返回按钮和标题的颜色 |
| `animation` | `string` | 页面切换动画类型 |
| `gestureEnabled` | `boolean` | 是否允许手势返回。默认 `true` |
| `contentStyle` | `object` | 页面内容区域的样式 |

### 本项目路由结构

```
src/app/
├── _layout.tsx          ← 根布局（Stack 在此定义）
├── modal.tsx            ← 模态页面
└── (tabs)/
    ├── _layout.tsx      ← Tab 布局（Tabs 在此定义）
    ├── index.tsx         ← Home 页
    └── explore.tsx       ← Explore 页
```

- **`_layout.tsx`（根布局）**：使用 `Stack` 管理顶层路由，包含 `(tabs)` 布局组和 `modal` 页面。
- **`(tabs)/_layout.tsx`**：使用 `Tabs` 管理底部标签页，包含 `index` 和 `explore` 两个标签。
- **`modal.tsx`**：以模态方式呈现的独立页面，会从底部弹出覆盖在当前页面之上。

### 关键用法说明

#### 1. `(tabs)` — 布局组（Layout Group）

```tsx
<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
```

- 带括号的目录名 `(tabs)` 是 Expo Router 的**布局组**，表示这是一个纯布局容器，**不会作为 URL 路径段**出现。
- `headerShown: false`：隐藏 Stack 自带的导航栏。因为 `(tabs)` 内部有自己的 `Tabs` 导航栏，不需要 Stack 再显示一层 header。

#### 2. `modal` — 模态页面

```tsx
<Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
```

- `presentation: 'modal'`：页面以模态方式呈现，从屏幕底部向上滑入，视觉上与堆叠导航区分开。
- `title: 'Modal'`：设置模态页面导航栏的标题。
- 模态页面不会出现在底部 Tab 栏中，适合用于设置页、表单、详情弹窗等场景。

### 注意事项

1. **`Stack` 必须在 `_layout.tsx` 中使用**：不要尝试在普通页面组件（如 `index.tsx`）中直接使用 `Stack`——它会根据文件系统自动路由，只在布局文件中定义。
2. **`name` 与文件路径对应**：`Stack.Screen` 的 `name` 属性必须与 `src/app/` 下的文件名或目录名匹配。Expo Router 基于文件系统自动路由，文件名即路由名。
3. **布局组的括号命名约定**：目录名加括号如 `(tabs)` 表示布局组，不影响 URL。普通目录如 `profile` 会出现在 URL 路径中（`/profile`）。
4. **`headerShown: false` 的时机**：当子布局（如 Tabs）已经自带导航栏时，父级 Stack 的 header 就是多余的——关闭它，避免出现双导航栏。
5. **模态页面需要手动注册**：在文件系统中创建 `modal.tsx` 后，必须同时在 `_layout.tsx` 的 `Stack` 中用 `<Stack.Screen name="modal" ...>` 显式注册，否则无法导航到该页面。
6. **`Stack` 与 `Tabs` 的嵌套关系**：根布局用 `Stack` 管理顶层路由（Tab 组 + Modal），Tab 布局内部用 `Tabs` 管理标签页切换。两者分工明确：`Stack` 负责页面级别的进出，`Tabs` 负责标签级别的切换。
7. **`screenOptions` 可统一配置**：如果多个 `Stack.Screen` 需要相同的配置（如统一的 header 样式），可以在 `Stack` 上使用 `screenOptions` 作为默认值，避免逐个重复配置。
