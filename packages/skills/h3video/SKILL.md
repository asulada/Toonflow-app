---
name: h3video
description: MiniMax H3 视频提示词规范（双模式）。当视频生成节点的目标模型属 MiniMax H3 系——modelId 为 minimaxH3R2V / minimaxH3I2v，或 providerId、label 含 MiniMax H3——时，用它替代 Seedance 提示词规则与 {{ref N}} 写法：全参考流（mode 含 imageReference，最多 9 张参考图）走 Full-Reference 六段式；单图/关键帧流（mode 为 singleImage / startEndRequired / endFrameOptional / startFrameOptional）走 Base 三字段（T2VA / I2VA / FL2VA / L2VA）。
metadata:
  version: "1.0.0"
  displayName: MiniMax H3 视频提示词规范
  author: Toonflow
---

# MiniMax H3 视频提示词规范（双模式）

本规范定义 MiniMax H3 视频模型的提示词写法。它是 H3 路线在提示词阶段的**唯一规则源**，替代 Seedance 的 `Objective` / `Reference binding` 架构，也替代 canvas 默认的 `{{ref N}}` 写法。画布读写、节点函数、阶段确认仍按 `workflow` 与 `canvas` 手册执行；本文件只规定**提示词怎么写**。

## 0. 何时使用（强制）

满足任一条即进入本规范：

- 视频生成节点 `getConfig` 返回的 `config.modelId` / `config.providerId` 含 `MiniMax H3`（不分大小写、忽略连字符，如 `minimaxH3R2V`、`toonflow-minimax-h3-r2v`、`comfyuiLocalMinimaxH3I2vSelflift`）；
- 节点可用模型列表 `models[]` 中实际选中的模型 `label` 含 `MiniMax H3`。

进入本规范后：

- **不执行** `workflow` 内嵌 Seedance PART A 的 A9 模板（`Objective` / `Reference binding` / `Immutable locks` / `Timeline` / `Preserve` / `Avoid`）；
- 提示词里**不出现** `{{ref N}}`，改用本文件的 `<Subject N>` / `<Picture N>` / `<Audio N>` / `<Video N>`；
- 不写绝对秒数时间轴式的中文分段（那不是 H3 的字段结构）。

Seedance 的 A0–A8 创作判断（剧情保真、节拍解析、站位、表演、连续性、生成稳定性预检）**可以继续沿用其判断原则**，但最终**输出外壳必须换成下面第 4 节或第 5 节的字段**。

## 1. 先判定模式（两路，必做）

读 `node:getConfig` 的 `config.mode`：

| 判定 | 模式 | 结构 |
|---|---|---|
| `mode` 是**数组形式**（含 `imageReference:N` / `videoReference:N` / `audioReference:N`，表示多参考组合） | **Full-Reference** | 第 5 节 · 六段式 |
| `mode` 是**单个字符串**（`text` / `singleImage` / `startEndRequired` / `endFrameOptional` / `startFrameOptional`） | **Base** | 第 4 节 · 三字段 |

模型 id 兜底对照：

- `minimaxH3R2V`（全参考生视频，最多 9 张参考图）→ Full-Reference；
- `minimaxH3I2v`（图生视频，首帧/尾帧）→ Base。

两条流的模式判定互斥。**不确定时先 `getCanvas` + `getConfig` 读真实值，不猜。**

## 2. 两模式共享的写作规则

以下规则同时适用于 Base 与 Full-Reference。

### 2.1 语言

- **正文全部英文。** 字段名、镜头标记、运镜、主体描述、声音描述一律英文。
- **只保留原文不译的内容**：`<d>[Language] ...</d>` 内的台词与歌词；画面中真实可见的文字（招牌、字幕、霓虹灯等，用英文双引号包裹）。

```text
A red neon sign reading "营业中" glows above the doorway.
```

### 2.2 镜头与切换

- `[Shot 1]` 是开场镜，**不带时间戳**。
- 后续镜用 `[Shot N] At MM:SS.mmm, ...` 标出严格递增的切点时间，且切点必须落在视频总时长内。
- 切镜句式：`the camera cuts to` / `the shot cuts to` / `the shot transitions to` / `the shot changes to` / `the shot switches to`。用户明确要求时才用 cross-dissolve / fade / wipe。
- 切镜要带来新信息（主体、空间、状态、视角或时间的变化）；只是景别或轻微角度变化时，优先用运镜而不是切镜。

```text
[Shot 2] At 00:03.500, the camera cuts to a close-up of the folded letter in her hands.
```

### 2.3 运镜

完整运镜表达有三维：**运动类型 + 幅度 + 速度**。幅度与速度只在有意义时写，中等幅度、常速通常省略。

| 维度 | 可用表达 |
|---|---|
| 运动类型 | `Zoom In / Zoom Out`、`Push In / Pull Out`、`Pan Left / Pan Right`、`Truck Left / Truck Right`、`Tilt Up / Tilt Down`、`Pedestal Up / Pedestal Down`、`Arc Shot`、`Tracking Shot`、`Static Shot`、`Shake Slightly / Shake Strongly`、`POV`、`Roll Clockwise / Roll Counterclockwise` |
| 幅度 | `with small amplitude`、`with large amplitude` |
| 速度 | `at slow speed`、`at fast speed` |

写成镜内的自然英语动作句，**不要**在句尾堆标签：

```text
The camera pushes in with small amplitude at slow speed toward the folded letter in her hands.
The camera holds a static shot as the runner exits the frame.
```

### 2.4 说话人与台词

- 会说话、唱歌或发出画外人声的主体用稳定 ID：`(S1)`、`(S2)`。多人齐声用 `(S1,S2)`等复合 ID。
- 同一说话人跨镜保持同一 ID；**从不发声的角色不分配 ID**。
- 说话人首次出现时，用视觉或听觉信息建立稳定身份（人物类型、年龄、性别、是否在画内、音高、音色、语速、口音）。身份描述、ID、动作、发声方式写在 `<d>` **外面**；`<d>` **里面只放**语言标签和用户给的原话。
- 台词**逐字保留原文与标点**，不翻译、不改写；听不清处写 `[unclear]`，不猜。

```text
The young woman with a quiet, breathy voice (S1) says: <d>[English] I get off at the next station.</d>
The two children (S1,S2) shout together, <d>[English] Wait for us!</d>
```

- **画外音**固定写 `says in an off-screen voiceover`，并在 `<d>` 之后立刻说明对应在画角色的嘴唇保持闭合：

```text
The man (S1) says in an off-screen voiceover: <d>[English] I still remember that road.</d> while his lips remain completely closed.
```

- 同一句台词跨切镜时，在两侧接点写 `<scenetrans>`，并说明声音跨切延续；被视频结尾截断时写 `<cutoff>`。延续可用 `continues seamlessly across the cut`、`continues uninterrupted into the next shot`、`carries over from the previous shot`、`remains audible across the transition`。

### 2.5 overall_soundscape

用 **1–4 句英文**、一段连续文字，概括全片的环境音、物理动作音与非语义人声（风、雨、交通、脚步、衣物摩擦、碰撞、呼吸、笑、喘）。**台词、歌声、diegetic 音乐已在主体描述里，不在这里重复。** 只有用户明确要求全片静音时才写 `N/A`。

```text
overall_soundscape: Steady rain taps against the café windows while low room ambience continues underneath. The entrance bell rings once, followed by wet footsteps and the soft scrape of a chair.
```

### 2.6 non_diegetic_music

用 **1–3 句英文**描述角色听不到、只有观众听到的背景音乐。写**乐器、速度、节奏、力度变化**，**不用抽象情绪词、不解释配乐的情感功能**。角色能听到的歌声、乐器、收音机、电视、手机音乐属 diegetic，放主体描述里。没有非叙事音乐时写 `N/A`。

```text
non_diegetic_music: Sparse piano notes at a slow tempo, joined by sustained low strings that gradually increase in volume before fading out.
```

## 3. 标签体系与 Toonflow 资产映射

### 3.1 四类标签

| 标签 | 含义 |
|---|---|
| `<Subject N>` | 从参考素材中抽象出的、可在目标视频里复用或修改的**可见内容** |
| `<Picture N>` | 作为某镜具体帧或构图锚点使用的**参考图** |
| `<Video N>` | 提供剪辑源、续接起点或整体时间结构的**参考视频** |
| `<Audio N>` | 被复制或引用的**音频信号** |

标签一旦分配，在 `subject_definitions` / `summary` / `retention_analysis` / `detailed_description` 与两个声音段中**含义恒定**。

### 3.2 Toonflow 画布怎么映射成标签（关键）

先 `getCanvas` 读视频节点的**实际入边顺序**，再按下列规则分配：

| 画布上的东西 | H3 标签 |
|---|---|
| 角色图 / 场景图 / 道具图（作为身份、外观、环境、形制的参考） | `<Subject N>`；在它的定义里用「in `<Picture 图号>`」标出来源图 |
| 节点入边的参考图，按 `data.referenceOrder` 排序后的第 N 项 | `<Picture N>`（N = 排序后序号，从 1 开始） |
| 仅作首帧 / 尾帧 / 关键帧锚点的图 | 独立 `<Picture N>` 条目 |
| 参考视频（提供运镜、剪辑、续接） | `<Video N>` |
| 音频参考（音色、节奏、BGM 风格） | `<Audio N>` |

**硬规则：**

- **`<Picture N>` 的 N 必须与节点实际入边顺序一致**（第 N 项 = `<Picture N>`）。接线、删除或排序变化后**重新核对**，不沿用旧编号。
- `<Video N>` 与 `<Audio N>` **各自独立编号**，同源文件可以既是 `<Video 1>` 又是 `<Audio 2>`，编号差异不表示来源不同。普通参考视频有声音时**不**自动生成 `<Audio N>`。
- ✅ **参考视频 / 参考音频槽已接**（r2v v2.2.0 起）：`ref_videos` 收帧序列、`ref_audios` 收独立音轨，画布入边挂了视频或音频会真的送进去。
  ⚠️ 但 **`ref_video_audios`（同一个视频自带的音轨）仍未接** ⇒ 参考视频的**声音不会**自动成为 `<Audio N>`；
  要用它的声音，得另挂一段独立音频素材。同理，一个视频槽位只贡献 `<Video N>` 一个标签，不附带音轨标签。
- 一张图**只控制它被指定或可明确判断的维度**，禁止越权控制其他维度（如用角色图控制站位）。
- 同一主体由多张素材定义时，合并到一条 `<Subject N>` 里说明各自提供什么。
- **不写 `{{ref N}}`。** 编号无法确认时不猜、不触发生成。

### 3.3 只在必要时建 `<Picture N>` 独立条目

官方规则：图片本身作为某镜的**首帧、关键帧、尾帧、构图锚点**时，才单独写 `<Picture N>` 条目。若一张图只是用来定义角色、场景、服装或风格，**不建独立条目**，而是在对应 `<Subject N>` 定义里引用它的图号。

```text
<Subject 1> is the young woman in <Picture 1>, with long dark hair, a blue cardigan, and a thin silver necklace.
<Picture 2> is the first frame of [Shot 1], showing a woman seated beside a café window.
```

### 3.4 任务类型对照（只用于 Base 与 FullRef 的定义，不是新字段）

| 任务类型 | 何时使用 |
|---|---|
| `keyframe completion` | 图片作为首帧、关键帧、尾帧、剪辑关键帧或其他具体帧锚点 |
| `reference generation` | 图 / 视频 / 音频为角色、场景、风格、动作、运镜、分镜提供生成指引，而不作为具体帧或待编辑的源视频 |
| `video editing` | 直接修改已有源视频（编辑图片或在静帧之间插值**不算**） |
| `video continuation` | 新内容延续、扩展、接续或过渡自已有源视频 |
| `audio reuse` | 同一音频信号被整体或部分复用 |
| `audio reference` | 不直接复制音频信号，只参考其音乐风格、音色、台词内容、音效质感、节拍或连续性 |

## 4. Base 模式（T2VA / I2VA / FL2VA / L2VA）

### 4.1 结构：指令头（按需）+ 三个核心字段

Base 内部再按 `config.mode` 与实际连接的图片数确定子类型：

| `config.mode` | 实际图片数 | 子类型 | 指令头 |
|---|---|---|---|
| `text` | 0 | T2VA † | 无 |
| `singleImage` | 1 | I2VA | I2VA 头 |
| `endFrameOptional` | 1 | I2VA | I2VA 头 |
| `endFrameOptional` | 2 | FL2VA | FL2VA 头 |
| `startEndRequired` | 2 | FL2VA | FL2VA 头 |
| `startFrameOptional` | 1 | L2VA（仅尾帧）† | L2VA 头 |
| `startFrameOptional` | 2 | FL2VA † | FL2VA 头 |

> `frameMode` **不是** `config.mode` 的取值。它是节点内部的派生标记（表示当前模式改用 `firstFrame` / `lastFrame` 通道下发图片，而不是 `images`），不会出现在 `getConfig` 返回值里，不要拿它做判定。
> ⚠️ 表中带 † 的行在**当前 i2v 适配器上选不到**：该适配器要求首帧必填，`mode` 只声明 `singleImage` / `endFrameOptional` / `startEndRequired` 三项 —— `text`（0 张图）与 `startFrameOptional`（只给尾帧）不会出现在节点下拉里，硬传也会在入口报「图生视频需要一张首帧图片」。这两行保留只为协议完整性。

**T2VA**（无有效分镜图）：无指令头，直接写三字段。

**I2VA**（单张分镜图为 0s 首帧）指令头固定：

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.
```

**FL2VA**（两张图对应首尾帧）指令头固定：

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.
```

**L2VA**（单张图为末尾关键帧）指令头固定：

```text
How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.
```

其中 `N` 是最终实际镜号，`S.SS` 是**有效视频时长，保留两位小数**（取自节点 `getConfig` 的 `duration`）。指令头必须是最终提示词的**第一行**，其后空一行再接核心字段。

### 4.2 三个核心字段

```text
integrated_multimodal_description: [Shot 1] ...

overall_soundscape: ...

non_diegetic_music: ...
```

- `integrated_multimodal_description`：**主正文**。沿时间轴描述画面、动作、镜头、说话人、台词、歌唱与 diegetic 音频。
- `overall_soundscape` / `non_diegetic_music`：写法见 2.5 / 2.6。

### 4.3 关键帧如何融入主体描述

- **I2VA**：`<Picture 1>` 是 0.00s 的真实首帧，属于 `[Shot 1]`。先确立图里的风格、主体、构图与场景锚点，再描述接下来的动作。人物身份、服装、颜色、关键物件、空间关系保持一致。推荐结构：**首帧锚点 → 动作起势 → 连续发展 → 结果或反应**。
- **FL2VA**：`Picture 1` 是开头，`Picture 2` 是结尾。写主体怎么移动、姿态怎么变、物件怎么被操作、构图怎么演进、场景或光线怎么过渡。推荐单镜，让模型在第一帧到最后一帧之间连续插值；多镜只在明确指定时用。最后一帧必须由视频末尾的 `[Shot N]` 抵达。推荐结构：**首帧状态 → 可观察的中间变化 → 差异逐步收窄 → 尾帧状态**。
- **L2VA**：`<Picture 1>` 是视频最后一帧，属于最后的 `[Shot N]`，本身不属于 Shot 1。先从前情推断一个合理早态，再描述人物、物件、镜头、场景如何逐步逼近参考图。推荐结构：**合理前置状态 → 明确动作与过渡路径 → 末镜逐步收敛 → 落在尾帧**（注意：当前 i2v 适配器要求首帧必填，此组合需先确认模型侧支持无首帧生成）。

### 4.4 主体描述开头

在 `[Shot 1]` 开头先给全片风格与初始构图。常见风格词：`Cinematic`、`live-action`、`2D-animated`、`3D CG`、`claymation`、`watercolor`、`vintage film`。关键帧任务从参考图取风格；T2VA 从用户文本取。

```text
[Shot 1] Live-action, cinematic, a medium-wide shot frames...
```

## 5. Full-Reference 模式（六段式）

**六段顺序固定，不可调换。**

| 段 | 用途 |
|---|---|
| `subject_definitions` | 定义被引用内容及其参考标签 |
| `summary` | 概括任务类型、目标视频与主要引用关系 |
| `retention_analysis` | 描述各引用内容如何被保留、转移或复用 |
| `detailed_description` | 按播放顺序描述画面、动作、镜头、声音与台词 |
| `overall_soundscape` | 概括环境与物理声音 |
| `non_diegetic_music` | 描述只有观众听到的背景音乐 |

### 5.1 subject_definitions

每条被单独追踪的内容占一行，说明标签指代什么、引用角色、要遵循的主要特征；需要澄清来源时点出对应素材。

```text
<Subject 1> is the young woman in <Picture 1>, with long dark hair, a blue cardigan, and a thin silver necklace.
```

同一主体来自多个素材时，合并来源并说明各自提供什么：

```text
<Subject 1> is the woman whose appearance comes from <Picture 1> and whose walking motion comes from <Video 1>.
```

`<Picture N>` 作为分镜或镜头规划参考时，说明它对应哪些镜、提供什么规划信息：

```text
<Picture 3> is a storyboard reference for [Shot 1] and [Shot 2], defining their viewpoint, subject placement, and shot order.
```

`<Audio N>` 明确对应某个目标说话人时，复用该说话人的全局 ID：映射到已定义主体时写 `<Subject N> (Sx)`，否则用稳定音色描述后接 `(Sx)`。该 ID 来自目标视频的全局说话顺序，**不在这里重新编号**。

```text
<Audio 1> is the voice-timbre reference for <Subject 1> (S1).
```

### 5.2 summary

一段**简短英文**，概括目标视频与其引用关系，以方括号任务类型前缀开头（类型取自 3.4，多关系用 ` + ` 连接且不重复）：

```text
[reference generation] ...
[reference generation + audio reference] ...
[video continuation + keyframe completion] ...
```

只使用前面已定义的标签，**不引入新标签**。视频剪辑任务在前缀之后以这句开头：

```text
The target video is an edited version of <Video 1>.
```

### 5.3 retention_analysis

每个标签一行，保持 `subject_definitions` 里确立的含义。

可见内容（`<Subject N>` / `<Picture N>` / `<Video N>`）用固定英文标记：

| 标记 | 含义 |
|---|---|
| `fully_preserved` | 引用内容的既定角色被完整保留 |
| `partially_preserved` | 仍被使用，但部分既定特征被改变或仅部分保留 |
| `attribute_transfer` | 引用的特征被转移到另一个可识别目标主体 |
| `weak_reference` | 只保留风格、类别、构图或氛围上的宽泛相似 |

```text
<Subject 1> (appears in [Shot 1], [Shot 3]): fully_preserved - ...
<Picture 2> ([Shot 1] first frame): fully_preserved - ...
<Video 1> (cut and pacing structure): weak_reference - ...
```

音频（`<Audio N>`）用：

| 标记 | 含义 |
|---|---|
| `fully_copy` | 完整源音频作为目标视频的完整最终音轨 |
| `partially_copy` | 只复制部分时间轴或部分音频层，或复制后增删替换了其他声音 |
| `reference` | 不直接复制信号，只参考音色、节奏、音乐风格、台词内容或音效质感 |
| `weak_reference` | 只保留类别或氛围上的宽泛相似 |

```text
<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.
```

只在标签已定义的引用角色范围内选择标记。**不要把目标视频新增的动作、背景或剧情事件当成引用保真度的损失。**

### 5.4 detailed_description

这是 Full-Reference 的**主正文**，按目标视频播放顺序逐镜描述画面、动作、声音与台词，并在适用处插入引用标签。

与 Base 的差异：

| 维度 | Base（T2VA） | Full-Reference |
|---|---|---|
| 主字段 | `integrated_multimodal_description` | `detailed_description` |
| 风格开头 | 写在 `[Shot 1]` 之后 | 在 `[Shot 1]` 之前用一到两句英文建立 |
| 引用信息 | 不用全参考标签 | 在首次出现处及作用生效处插入 `<Subject N>` / `<Picture N>` / `<Video N>` / `<Audio N>` |
| 音频关系 | 只描述目标视频自身声音 | 在对应镜或音频阶段引用 `<Audio N>` 并说明是复制还是参考 |

```text
The target video is in a cinematic, literary music-video style with soft lighting and a slightly desaturated color palette.
[Shot 1] The scene opens in a crowded urban street...
[Shot 2] At 00:09.000, the shot cuts to an extreme close-up...
```

生成任务通常 **350–500 英文词**；台词密集时优先保证完整台词时间轴，而不是机械凑词数。单镜不因只有一镜就自动写短。

引用标签在镜内的用法：

- 重要 `<Subject N>` 第一次清晰出现时，在实际可见范围内描述其被引用的特征、画面位置与当前动作；后续镜继续用同一标签，**不重新定义**。
- 具体帧锚点用自然措辞：`the shot begins from <Picture 1>`、`the shot's keyframe corresponds to <Picture 2>`、`the shot ends on <Picture 3>`。
- 被引用主体实际说话时同时保留视觉标签与说话人 ID：`<Subject 2> (S1) turns toward the woman and says, <d>[English] ...</d>`。`<Subject N>` 标识被引用主体，`(Sx)` 标识实际发声者。同一主体画外发声时形式不变，另标 `off-screen`。
- 台词只作为直接复用的 BGM 或完整音轨里的一个片段、且没有具体人/角色/旁白实际发出时，用 `<Audio N>` 作可闻来源，**不另造 `(Sx)`**。
- 直接复用参考音频的台词、旁白或歌词时，`<d>` 内逐字保留原词与原文语言；标点标准化为 `,` `.` `?` `!`，去掉重复波浪号、表情、项目符号与装饰性标点；完整陈述、疑问、感叹分别以 `.` `?` `!` 收尾再闭合 `</d>`。
- 只参考音色、节奏、情绪或表达方式时，**不把参考音频里的原台词带进目标视频**。
- `(Sx)` 按目标视频实际发声事件的顺序分配一次，后续在每个发声事件复用；`retention_analysis` 里**不写** `(Sx)`。

### 5.5 两个声音段

定义与 Base 相同（见 2.5 / 2.6）。使用参考音频时，复制或引用关系只在匹配的可闻层说明：环境与音效放 `overall_soundscape`，纯观众向配乐放 `non_diegetic_music`。同一份音频同时提供两类内容时，两段各写对应关系：

```text
overall_soundscape: The copied ambience layer from <Audio 1> continues throughout the target video.
non_diegetic_music: <Audio 2> is directly reused as the complete audience-only score.
```

完整台词与歌词只写在 `detailed_description` 的 `<d>` 内，**不在这两段重复**。

## 6. 完整示例

### 6.1 Base · I2VA

```text
For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, the young woman shown in <Picture 1> remains beside the rain-covered train window, preserving her appearance, clothing, seat position, and the carriage layout. The camera trucks right with small amplitude at slow speed as she lifts her gaze from the folded letter toward the passing city lights. Her reflection moves across the glass while the quiet, breathy young woman (S1) says: <d>[English] I get off at the next station.</d> She folds the letter along its existing crease.

overall_soundscape: The train wheels produce a steady metallic rhythm beneath a low ventilation hum. Rain ticks against the window while paper rustles softly in her hands.

non_diegetic_music: Sustained cello notes at a slow tempo with widely spaced piano tones, gradually decreasing in volume.
```

### 6.2 Base · FL2VA

```text
How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot 1) aligns with the 8.00-second mark of the target video.

integrated_multimodal_description: [Shot 1] Live-action, cinematic, a rain-soaked cyclist begins in the position and framing established by Picture 1, holding a closed black umbrella beside a silver bicycle. The camera pulls out with small amplitude at slow speed as she releases the bicycle handle, raises the umbrella above her shoulder, and presses the runner upward until the canopy opens. Water rolls from the expanding fabric while she steps beneath it, rotates the handle into the final angle, and settles into the pose, spacing, and composition established by Picture 2 at the end of the shot.

overall_soundscape: Rain falls steadily on the pavement, followed by the metallic click of the umbrella runner and the soft snap of the canopy opening. Water drips from the bicycle frame as distant traffic passes.

non_diegetic_music: N/A
```

### 6.3 Full-Reference · 六段式

```text
subject_definitions:
<Subject 1> is the coffee-shop environment in <Picture 1>, featuring an exposed brick wall, an orange tufted sofa with patterned pillows, a neon sign, and a wooden coffee table.
<Subject 2> is the fluffy white Samoyed in <Picture 2>, <Picture 3>, and <Picture 4>, with thick white fur, pointed ears, a dark nose, and a curved tail.
<Subject 3> is the young blonde woman in <Video 1>, with long blonde hair and a light-pink button-down shirt with rolled-up sleeves.
<Audio 1> is the voice-timbre reference for <Subject 3> (S1), containing a spoken English vocal layer.

summary:
[reference generation + audio reference] The target video shows <Subject 3> eating a cookie in <Subject 1>. A young man enters with <Subject 2>, which lunges toward the cookie. The three-shot exchange uses <Audio 1> as the voice-timbre reference for <Subject 3> and ends with a canned audience laugh.

retention_analysis:
<Subject 1> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table are retained.
<Subject 2> (appears in [Shot 1], [Shot 2]): fully_preserved - the Samoyed's thick white fur, pointed ears, dark nose, and curved tail are retained.
<Subject 3> (appears in [Shot 1], [Shot 2], [Shot 3]): fully_preserved - the blonde woman's identity, long hair, and light-pink shirt are retained.
<Audio 1>: reference - its vocal timbre guides the dialogue delivery of <Subject 3> without copying the original signal.

detailed_description:
The target video uses a realistic multi-camera sitcom style with warm indoor lighting.
[Shot 1] A medium shot establishes <Subject 1>, the coffee shop with its exposed brick wall, orange tufted sofa, patterned pillows, neon sign, and wooden coffee table. <Subject 3> (S1), the young woman with long blonde hair and a light-pink button-down shirt with rolled-up sleeves, sits on the sofa holding a chocolate-chip cookie. From the left, a young man in a dark-grey hoodie enters holding the leash of <Subject 2>. The dog lunges toward the cookie and pulls the leash taut. <Subject 3> (S1) jerks her hand back and, using the clear youthful voice timbre referenced from <Audio 1>, exclaims with light annoyance, <d>[English] Hey! Watch your dog!</d> She closes her lips and guards the cookie while the man pulls the dog back.
[Shot 2] At 00:03.000, the shot cuts to a close-up of <Subject 2> held securely in the man's arms. He says in a casual young male voice with a playful tone, <d>[English] He just likes cookies more than me.</d> He closes his mouth into an apologetic smile and strokes the dog's thick white fur.
[Shot 3] At 00:05.000, the shot cuts to a close-up of <Subject 3> (S1). Her annoyance softens as she looks toward the Samoyed. <Subject 3> (S1) replies in the same clear youthful voice referenced from <Audio 1> with an amused cadence, <d>[English] Well, he has good taste at least.</d> She smiles and raises the cookie in a small toast-like gesture. A classic canned audience laugh begins immediately after the line and continues through the final frame.

overall_soundscape:
Soft indoor coffee-shop room tone continues throughout the scene.

non_diegetic_music:
N/A
```

## 7. 边界

- **本规范只规定提示词文本。** 节点选择、连线、参数、生成触发、结果验收仍按 `workflow` 与 `canvas` 手册，不得把模式或标签塞进 `node:setConfig` 参数。
- **H3 不写 `{{ref N}}`。** 若画布已按旧规则写入 `{{ref N}}`，用 `node:setPrompt` 重写为 H3 标签。
- **不混用两套格式。** Base 三字段与 Full-Reference 六段式互斥；H3 提示词里不出现 Seedance 的 `Objective` / `Reference binding` / `Immutable locks` / `Timeline` / `Avoid` 字段。
- **不承诺生成结果。** 提示词合规不等于视频无穿帮；真实是否出现多手多指、肢体融合、身份漂移、道具闪现等，必须在媒体实际可读时另做结果验收。
