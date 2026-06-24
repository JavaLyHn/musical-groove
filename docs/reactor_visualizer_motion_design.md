# 音乐反应式「核反应堆」动效设计

> 一座漂浮在深空中的体素城市，随音乐像反应堆堆芯一样呼吸、跳动、向外扩散冲击波。

## 1. 设计定位与核心隐喻

整个画面本质上是**一张被弯折到球面上的三维频谱图**——这是它区别于普通柱状均衡器、显得高级的关键。不要把它当成一面平铺的 EQ 墙，而要当成"从轨道俯瞰一颗由数据构成的星球 / 一座封闭的反应堆堆芯"。

三个隐喻同时成立，动效要同时服务这三者：

- **反应堆**：中心是高温堆芯，能量在这里聚集、爆发；外圈是冷却 / 安全壳结构。
- **呼吸的城市**：成千上万根柱子像会呼吸的天际线，永不完全静止。
- **遥测中的星球**：底部数字是实时遥测，弱辉光的地平线是大气层。

一句话基调：**克制、冷峻、数据化的科技感**——冷色为主，只有在节拍命中时才允许"过曝"般的白热爆发。

## 2. 场景解剖

**几何**

- 数千个小立方体（建议 instanced，5k–20k）排布在球面网格上（斐波那契球或经纬网格），形成弯曲地平线。
- 每根"柱子" = 一列立方体的高度，区间从近乎贴地到中心的高耸尖柱。
- 中心一簇最高、最亮，向外整体趋势降低、变冷——但单根高度由音频实时决定，不是固定地形。
- 约 5–10% 的立方体表面带有**微缩数据屏纹理**（滚动字符网格、极小的波形 / 网点），增加"信息密度"。

**配色**（按高度映射的发光色阶 LUT）

| 位置 / 高度 | 颜色 | Hex |
|---|---|---|
| 堆芯白热（最高） | 冷白 | `#F4F6FF` |
| 高位 | 淡紫 | `#C3BEF2` |
| 中位 | 青蓝 | `#6E78C8` |
| 低位 | 深蓝 | `#2A3A78` |
| 边缘 / 待机 | 暗蓝青 | `#15205A` |
| 背景虚空 | 近黑藏蓝 | `#060A1C` |
| 大气辉光 / Drop 强调 | 冷青 | `#5FD0E0`（极少量） |

**氛围**

- 深藏蓝虚空背景，球体边缘一圈极淡的大气 rim 辉光。
- 体积雾 / 薄霾，越靠地平线越浓，制造纵深与"星球感"。
- 极淡的尘埃 / 星点颗粒漂浮。

## 3. 核心动效模型（柱子如何跳动）

**频率 → 位置映射（建议径向）**

把 FFT 频谱按**到中心的半径**铺开：中心 = 超低频 / 低频（让堆芯随底鼓爆发），向外半径递增 = 频率递增，最外圈 = 高频。这样底鼓一击，能量天然从中心向外炸开，完美契合"反应堆脉冲"。
（备选：对角 / 线性映射，更像把平面频谱弯到球上，节奏感更"扫描"，可按曲风选。）

**单柱动力学（让它"活"的关键）**

- 目标高度 `target = base + amp[band] × gain`。
- **起音快、衰减慢**：上升用大插值系数（≈0.5，1–2 帧顶上去），下落每帧乘 0.90–0.94 像被重力慢慢"融化"回落——这是 VU 表的灵魂。
- **峰值保持帽（Peak-hold）**：每根柱顶有一片极薄的发光"帽"，瞬间跳到峰值后以极慢速度（每帧 ×0.98）下沉——既是经典 EQ 的悬浮刻度，又读作"反应堆控制棒"。
- 硬命中时给一点**弹性过冲**（spring 轻微回弹）增加生命感。

**待机呼吸（永不死寂）**

即使音乐很轻，也叠一层低幅 Perlin / Simplex 噪声驱动高度，整片场永远在缓慢起伏——像反应堆的"嗡鸣"。

## 4. 节拍事件编排

这是把"会动"变成"有编舞"的部分。用 onset / 频谱通量做节拍检测，命中时触发：

- **堆芯爆闪**：中心一簇瞬间转白热（`#F4F6FF`），Bloom 强度尖峰，0.1s 内拉满，再用 0.4s 缓落。
- **径向冲击波**：一圈"高度 + 亮度"的同心环从中心以固定速度向外扩散，振幅随半径衰减；多次节拍 = 多圈叠加，形成漂亮的**干涉波纹**。环宽、环速、衰减都可调（建议环速覆盖全场约 0.6–1.0s）。
- **低频驱动堆芯**：单独取 sub-bass 控制堆芯最高柱 + 整个球体极轻微的整体缩放"呼吸"。
- **微镜头冲击**：命中瞬间 1–2px 的极轻微相机抖动，只在重拍触发。

## 5. 色彩与材质动态

- **高度 → 发光色**：用上面的色阶 LUT，越高越白热，越低越冷蓝（在片元着色器里按高度插值）。
- **能量 → 全局**：整体响度越大，Bloom 越强、饱和度轻微抬升；安静段反之。
- **Drop 调色偏移**：副歌 / Drop 时整条色阶短暂整体推向白 / 冷青，再缓慢回落。
- **材质**：自发光 + 立方体边缘 Fresnel 描边辉光（edge glow）；顶面做玻璃质轻反射，映出邻居的光；少量立方体带动态数据屏纹理。

## 6. 镜头语言

- **低轨道掠角**：贴着球面、略微俯视，复刻参考图的弯曲地平线。
- **持续缓动**：极慢的轨道环绕 + 轻微推拉（视差），约 2–3 分钟转一圈，营造电影感而非眩晕。
- **浅景深**：堆芯锐利、地平线与前景边缘柔焦散景（bokeh）。
- **Drop 推进**：重拍 / 副歌时镜头轻推向堆芯（约 5–8%，0.4s），再用 1.5s 缓退。

## 7. 后期与氛围

- **Bloom**：阈值调高，只让最亮的堆芯溢光。
- **体积雾 / 大气**：基于深度，藏蓝色调。
- **轻微色散**（chromatic aberration）：仅画面边缘。
- **胶片颗粒 + 有序抖动 dithering**：消除暗部色阶断层——深色渐变的高级感全靠它。
- **暗角 vignette**。
- 可选：极低透明度的扫描线 / 网格叠层强化 HUD 气质；堆芯最亮点一点点镜头脏污 / 微光晕。

## 8. 段落编排（随曲子起伏）

- **前奏 / 安静**：冷、低、慢起伏，Bloom 极弱，镜头偏远，整体偏深蓝。
- **Build-up**：整体高度渐次抬升，外圈高频"闪烁"增多，雾与对比度渐增积累张力。
- **Drop / 副歌**：堆芯同步暴涨、白热爆闪、大冲击波外扩、镜头推进、Bloom 拉满——随后整体"喘息"回落。
- **间奏 / 段落断点**：降饱和、整体下沉、节奏放缓，留白。

## 9. 遥测数字（92.0 / 70.2 / 47.0）

当作**实时频段电平 / dB / 峰值**读数处理：用与柱子一致的起音快、衰减慢平滑；等宽字体；数值刷新时极轻微闪烁。它们是"这台机器在运转"的旁证，动效要可信而克制。

## 10. 可直接套用的提示词

### A. 风格定帧 / 概念图（Midjourney、SD 等）

```
Cinematic 3D audio visualizer, vast voxel cityscape of glowing cubes mapped
onto a curved planetary surface, dense skyline of pillars rising like a nuclear
reactor core, bright white-hot cluster at the center fading to lavender,
periwinkle and deep teal-blue toward the edges, self-illuminated emissive blocks,
faint data-screen textures on some cube faces, deep navy-black void, soft
atmospheric rim glow on the curved horizon, volumetric haze, shallow depth of
field, low orbital camera angle skimming the surface, bloom, fine film grain,
dark premium tech aesthetic, holographic data art, ultra detailed, octane render
--ar 16:9 --style raw
```

中文要点：弯折到球面的体素频谱 / 白热堆芯 → 淡紫 → 深蓝 / 自发光 / 深空虚空 / 地平线大气辉光 / 浅景深 / 低掠角 / Bloom + 颗粒。负面词：无人物、无文字、无 LOGO。

### B. 视频生成（Runway、Sora、可灵、即梦等）

```
A music-reactive 3D landscape of thousands of glowing cubes on a curving
planetary grid. The pillars pulse and jump up and down to the beat like a
breathing reactor core: the central cluster surges white-hot on each beat and
sends concentric shockwaves of light and height rippling outward across the
field; tall pillars glow white and lavender while shorter ones stay deep blue.
Slow orbital camera drift skimming low over the surface, a gentle push-in on the
bass drops, shallow depth of field with soft bokeh at the horizon, bloom,
volumetric haze, subtle chromatic aberration, film grain, dark cinematic
premium-tech mood. Continuous seamless loop. No text, no UI, no people.
```

中文要点：上万发光立方体随节拍上下跳动 / 堆芯重拍爆白并外扩同心冲击波 / 高柱白—低柱蓝 / 缓慢轨道掠拍 + Drop 推镜 / 浅景深散景 / Bloom + 雾 + 颗粒 / 无缝循环。

提醒：视频生成只能做出"看起来"随节拍的观感，**无法真正与某首歌精确同步**；要真同步必须用代码实时跑音频。

### C. 真正落地实现的方向（如果要做成真实可交互界面）

- 技术栈：Three.js / WebGL（或 react-three-fiber）+ Web Audio API 的 `AnalyserNode.getByteFrequencyData`。
- 几何：`InstancedMesh` 立方体铺在球面网格上，逐实例高度缩放 + 逐实例发光色（instanced attribute / 着色器）。
- 每帧：读 FFT → 按半径映射到各实例 → 写 `target` 高度 → 起音 / 衰减插值平滑 → 更新 `instanceMatrix` 的 `scale.y`；颜色在片元着色器里按高度走色阶。
- 事件：频谱通量做 onset → 用 uniform 驱动冲击波（已用时间 × 半径）+ Bloom 强度 uniform。
- 后期：`UnrealBloomPass` + 自定义雾 + `FilmPass`（颗粒）+ 轻微色散 + 暗角；加 dithering 防色带。
- 峰值帽：第二层极薄 instanced 帽 mesh，慢速衰减。
