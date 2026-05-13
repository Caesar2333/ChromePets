# Task: Build a Codex-Compatible Browser Pet Extension

你现在要实现一个浏览器插件。目标不是重新发明一套宠物资源格式，而是复用 Codex hatch-pet / Petdex 风格的宠物资源生态。

核心要求：

1. 宠物资源只能是两个文件：
   - pet.json
   - spritesheet.webp

2. 不允许拆成 idle.webp、walk.webp、hover.webp 等多个状态图片。

3. 播放器必须兼容 Codex hatch-pet 的固定 atlas 规格：
   - atlas columns: 8
   - atlas rows: 9
   - cell width: 192px
   - cell height: 208px
   - atlas width: 1536px
   - atlas height: 1872px
   - 每一行是一个状态
   - 每一列是该状态的一帧
   - 未使用的格子必须视为透明空格，不参与播放

4. 第一版浏览器插件只需要支持 Chrome / Edge Manifest V3。

5. 插件在网页里注入一个可拖拽的小人宠物 overlay，读取 pet.json 和 spritesheet.webp，然后按 Codex hatch-pet 的 9 个固定状态播放。

不要把它做成 GIF 播放器。
不要把每个状态拆成单独图片。
不要重新设计宠物资源规范。
不要破坏 Codex 可复用性。

---

# Existing Pet Package

我会提供类似这样的宠物包：

public/pets/wasteland-helper/
  pet.json
  spritesheet.webp

pet.json 可能是最小格式：

{
  "id": "wasteland-helper",
  "displayName": "Wasteland Helper",
  "description": "A retro-future wasteland survivor desktop pet with chibi armor, blue-yellow gear, and task feedback animations.",
  "spritesheetPath": "spritesheet.webp"
}

注意：

- 不要要求我额外提供 animations.json。
- 不要要求我额外提供 manifest.json 给宠物。
- 浏览器插件自己的 manifest.json 是插件用的，不是宠物资源用的。
- 宠物包内部只有 pet.json 和 spritesheet.webp。
- 如果 pet.json 只有基础字段，播放器必须使用内置的 Hatch Pet 默认动画规格。
- 如果以后 pet.json 里出现可选的 browserPet 或 animations 字段，可以允许覆盖默认规格，但第一版不要依赖它。

---

# Hatch Pet Animation Contract

请在代码中内置一个默认的 HatchPetAnimationSpec。

固定状态如下：

Row 0: idle
Row 1: running-right
Row 2: running-left
Row 3: waving
Row 4: jumping
Row 5: failed
Row 6: waiting
Row 7: running
Row 8: review

固定 atlas：

- columns: 8
- rows: 9
- cellWidth: 192
- cellHeight: 208
- atlasWidth: 1536
- atlasHeight: 1872

每个状态的帧数与帧时长如下：

1. idle
   - row: 0
   - used columns: 0-5
   - frame count: 6
   - durations: [280, 110, 110, 140, 140, 320]
   - loop: true
   - purpose: 默认待机、呼吸、眨眼、小幅动作

2. running-right
   - row: 1
   - used columns: 0-7
   - frame count: 8
   - durations: [120, 120, 120, 120, 120, 120, 120, 220]
   - loop: true
   - purpose: 向右移动 / 拖拽向右

3. running-left
   - row: 2
   - used columns: 0-7
   - frame count: 8
   - durations: [120, 120, 120, 120, 120, 120, 120, 220]
   - loop: true
   - purpose: 向左移动 / 拖拽向左

4. waving
   - row: 3
   - used columns: 0-3
   - frame count: 4
   - durations: [140, 140, 140, 280]
   - loop: false
   - next: idle
   - purpose: 打招呼、被用户唤起、用户 hover 后的轻反馈

5. jumping
   - row: 4
   - used columns: 0-4
   - frame count: 5
   - durations: [140, 140, 140, 140, 280]
   - loop: false
   - next: idle
   - purpose: 点击宠物、开心反馈、轻量互动

6. failed
   - row: 5
   - used columns: 0-7
   - frame count: 8
   - durations: [140, 140, 140, 140, 140, 140, 140, 240]
   - loop: false
   - next: idle
   - purpose: 资源缺失、配置错误、异常状态、失败反馈

7. waiting
   - row: 6
   - used columns: 0-5
   - frame count: 6
   - durations: [150, 150, 150, 150, 150, 260]
   - loop: true
   - purpose: 等待用户输入、页面长时间无交互、插件等待指令

8. running
   - row: 7
   - used columns: 0-5
   - frame count: 6
   - durations: [120, 120, 120, 120, 120, 220]
   - loop: true
   - purpose: 插件正在执行任务、加载中、处理中、后台工作中
   - 注意：这个状态不是方向移动，不要把它当成走路；它表示“工作中 / 处理任务中”。

9. review
   - row: 8
   - used columns: 0-5
   - frame count: 6
   - durations: [150, 150, 150, 150, 150, 280]
   - loop: true
   - purpose: 查看、思考、审阅、专注观察页面

---

# Browser Interaction Hooks

请实现统一的 hooks.ts，不要在代码里到处散落字符串。

需要的 hooks：

- extension_enabled
- extension_disabled
- page_loaded
- pet_loaded
- mouseenter_pet
- mouseleave_pet
- click_pet
- pointer_down_pet
- drag_start_pet
- drag_move_left
- drag_move_right
- drag_end_pet
- user_activity
- user_inactive
- window_focus
- window_blur
- page_scroll
- viewport_resize
- asset_missing
- config_error
- task_start
- task_complete
- task_failed
- review_start
- review_end
- waiting_for_user
- debug_force_state

hooks 到状态的第一版映射：

- extension_enabled -> idle
- page_loaded -> idle
- pet_loaded -> idle
- mouseenter_pet -> review
- mouseleave_pet -> idle
- click_pet -> jumping
- drag_start_pet -> running-right or running-left, based on pointer direction
- drag_move_right -> running-right
- drag_move_left -> running-left
- drag_end_pet -> idle
- user_inactive -> waiting
- window_blur -> waiting
- window_focus -> idle
- user_activity -> idle, unless dragging or forced state
- page_scroll -> review for a short moment, then idle
- viewport_resize -> clamp position; if pet was outside viewport, briefly play failed, then idle
- asset_missing -> failed
- config_error -> failed
- task_start -> running
- task_complete -> waving, then idle
- task_failed -> failed, then idle
- review_start -> review
- review_end -> idle
- waiting_for_user -> waiting
- debug_force_state -> target state from popup

注意：

- 不要新增 sleep、hover、tap、walk 这些资源状态。
- 浏览器插件的行为可以叫 hover/tap/drag，但最终动画状态必须映射到 hatch-pet 的 9 个固定状态。
- 这样才能让同一个 pet.json + spritesheet.webp 同时被 Codex、Petdex、浏览器插件复用。

---

# State Machine Rules

请实现 PetStateMachine。

状态机不要写成一大坨 if else。

请使用清晰的数据结构：

- currentState
- previousState
- isEnabled
- isDragging
- isPointerInside
- isUserInactive
- forcedState
- lastPointerX
- lastPointerY
- currentDirection
- lastActivityAt

状态优先级建议：

1. disabled: highest
2. drag states: running-left / running-right
3. error state: failed
4. forced debug state
5. task states: running / review / waiting
6. direct user interaction: jumping / waving
7. hover/focus observation: review
8. idle

规则：

- dragging 时，不允许 hover/review/jumping 打断。
- failed 是一次性状态，播放完回 idle。
- jumping 是一次性状态，播放完回 idle。
- waving 是一次性状态，播放完回 idle。
- idle、running-left、running-right、waiting、running、review 是循环状态。
- popup force state 可以临时强制任何一个 hatch-pet 状态。
- force state 关闭后回到 idle。
- 插件 disabled 时销毁 overlay 或隐藏 overlay。
- 任何资源错误都进入 failed，但不能让插件崩溃。

---

# Sprite Player

请实现 HatchPetSpritePlayer。

播放器职责：

- 读取 pet config
- 读取 spritesheet.webp
- 使用内置 HatchPetAnimationSpec
- 播放指定状态
- 根据 row / column 裁切当前帧
- 根据 durations 控制每一帧停留时间
- 使用 requestAnimationFrame
- 不要用 setInterval 作为主循环
- 支持 loop 和 one-shot
- one-shot 播放完后触发 onComplete
- 支持 pause/resume/destroy
- 支持 setScale
- 页面隐藏时暂停，页面恢复时继续

裁帧逻辑：

- 当前状态 state 有 row
- 当前帧 index 是 column
- background-position-x = -column * 192px
- background-position-y = -row * 208px
- sprite div 的逻辑尺寸是 192px × 208px
- background-size 是 1536px 1872px
- 缩放使用 transform: scale(...) 或外层尺寸控制，但不要改变裁帧坐标

建议 DOM：

browser-pet-root
  shadowRoot
    div.pet-shell
      div.pet-sprite

pet-sprite CSS：

- width: 192px
- height: 208px
- background-image: url(...)
- background-repeat: no-repeat
- background-size: 1536px 1872px
- image-rendering: auto
- pointer-events: auto

---

# Extension Architecture

使用 Chrome Manifest V3。

建议目录：

browser-pet-extension/
  package.json
  tsconfig.json
  vite.config.ts
  manifest.json

  public/
    pets/
      wasteland-helper/
        pet.json
        spritesheet.webp

  src/
    background/
      service-worker.ts

    content/
      content.ts
      injectPet.ts
      petOverlay.css
    
    popup/
      popup.html
      popup.tsx
      Popup.tsx
    
    pet/
      hatchPetSpec.ts
      types.ts
      loadPet.ts
      spritePlayer.ts
      stateMachine.ts
      hooks.ts
      storage.ts
      dragController.ts
      activityTracker.ts
      bounds.ts
    
    shared/
      messages.ts

---

# manifest.json Requirements

Manifest V3。

必须包含：

- manifest_version: 3
- name
- version
- description
- background.service_worker
- content_scripts
- action.default_popup
- permissions:
  - storage
- host_permissions:
  - <all_urls> if needed
- web_accessible_resources:
  - pets/*/pet.json
  - pets/*/spritesheet.webp

content script 默认匹配：

- <all_urls>

但是这些页面不要强行注入：

- chrome://*
- edge://*
- about:*
- chrome-extension://*
- Chrome Web Store
- 浏览器受限页面
- iframe 内部页面

如果不能注入，静默跳过，不要报错刷屏。

---

# Content Script Injection

content script 负责：

1. 判断当前页面是否允许注入。
2. 防止重复注入。
3. 创建 browser-pet-root。
4. attachShadow。
5. 加载 petOverlay.css。
6. 加载 pet.json。
7. 加载 spritesheet.webp。
8. 创建 HatchPetSpritePlayer。
9. 创建 PetStateMachine。
10. 绑定 pointer / mouse / window / document 事件。
11. 响应 popup 消息。
12. 插件禁用时移除 overlay。

必须使用 Shadow DOM，避免被网页 CSS 污染。

根节点 id：

- browser-pet-root

如果页面里已经存在这个 id，不要重复创建。

---

# Storage

使用 chrome.storage.local 保存设置。

PetSettings：

{
  enabled: boolean;
  petId: string;
  scale: number;
  position: {
    x: number;
    y: number;
  } | null;
  debugMode: boolean;
  forcedState: string | null;
}

默认值：

{
  enabled: true,
  petId: "wasteland-helper",
  scale: 1,
  position: null,
  debugMode: false,
  forcedState: null
}

要求：

- 初始化时读取 settings。
- 拖拽结束保存 position。
- popup 修改后通知 content script。
- storage 不可用时使用内存 fallback。
- reset position 时回到右下角默认位置。

---

# Drag Behavior

拖拽要求：

- pointerdown 记录起点。
- 移动超过 4px 后进入 dragging。
- dragging 时根据 x 方向选择：
  - deltaX >= 0 -> running-right
  - deltaX < 0 -> running-left
- pointermove 更新 fixed left/top。
- pointerup 停止拖拽，保存位置，回 idle。
- pointercancel 也要停止拖拽。
- 拖拽时阻止选中文字。
- 拖拽时不要触发页面下面元素。
- 宠物必须被限制在 viewport 内。
- resize 后如果越界，自动 clamp 回可见区域。

---

# Activity Tracking

实现 activityTracker.ts。

监听：

- mousemove
- keydown
- scroll
- pointerdown
- visibilitychange
- window focus
- window blur

规则：

- 用户 2 分钟无交互 -> user_inactive -> waiting
- 用户重新交互 -> user_activity -> idle
- window blur -> waiting
- window focus -> idle
- document hidden -> pause player
- document visible -> resume player

---

# Popup

popup 第一版要简单可用。

功能：

1. Enable Pet 开关
2. Scale slider，范围 0.5 到 2，步长 0.1
3. Reset Position 按钮
4. Force State select，选项必须是：
   - none
   - idle
   - running-right
   - running-left
   - waving
   - jumping
   - failed
   - waiting
   - running
   - review
5. Debug Mode checkbox
6. 当前 petId 显示

popup 修改 settings 后：

- 保存 chrome.storage.local
- 给当前 tab 发送消息
- content script 收到后即时更新

消息类型：

- PET_SETTINGS_UPDATED
- PET_RESET_POSITION
- PET_FORCE_STATE
- PET_GET_STATUS
- PET_STATUS_RESPONSE

---

# Resource Loading

loadPet.ts 负责加载：

- chrome.runtime.getURL("pets/wasteland-helper/pet.json")
- pet.json 里的 spritesheetPath
- chrome.runtime.getURL("pets/wasteland-helper/" + spritesheetPath)

要求：

- pet.json 缺失 -> config_error -> failed
- spritesheet.webp 缺失 -> asset_missing -> failed
- pet.json 没有 spritesheetPath 时默认使用 spritesheet.webp
- pet.json 可以是最小格式，不要强制要求 animations 字段
- 内置 HatchPetAnimationSpec 是默认播放协议

---

# Validation

启动时做轻量校验：

- pet.id 存在
- spritesheetPath 存在或可默认
- spritesheet 图片可加载
- 图片 naturalWidth 应该是 1536
- 图片 naturalHeight 应该是 1872

如果尺寸不匹配：

- console.warn
- 进入 failed 状态
- 不要让插件崩溃

---

# Acceptance Criteria

完成后必须满足：

1. npm install 成功。
2. npm run build 成功。
3. dist 可以作为 unpacked extension 加载到 Chrome / Edge。
4. 普通网页右下角出现小人。
5. 小人默认播放 idle。
6. 鼠标 hover 小人时播放 review。
7. 鼠标离开后回 idle。
8. 点击小人播放 jumping，结束后回 idle。
9. 拖拽小人时根据方向播放 running-left / running-right。
10. 松手后保存位置并回 idle。
11. 长时间不操作后进入 waiting。
12. 重新操作页面后回 idle。
13. popup 可以开关、缩放、重置位置、强制状态。
14. 所有动画都来自同一个 spritesheet.webp。
15. 所有宠物元信息都来自同一个 pet.json。
16. 不生成 per-state webp。
17. 不生成 animations.json。
18. 不破坏 Codex hatch-pet 资源兼容性。
19. 资源错误时播放 failed 或安全降级，不白屏、不崩溃。
20. README 写清楚这是 Codex-compatible pet package：one pet.json + one spritesheet.webp。

---

# Implementation Order

请按顺序实现：

1. 创建或检查 Vite + TypeScript 项目。
2. 创建 Manifest V3 插件结构。
3. 放置 public/pets/wasteland-helper/pet.json 和 spritesheet.webp。
4. 实现 hatchPetSpec.ts，写死 Codex hatch-pet 默认 atlas 和 9 个状态规格。
5. 实现 loadPet.ts。
6. 实现 HatchPetSpritePlayer。
7. 实现 Shadow DOM overlay 注入。
8. 实现 PetStateMachine。
9. 实现 dragController。
10. 实现 activityTracker。
11. 实现 storage。
12. 实现 popup。
13. 实现消息通信。
14. 实现资源校验和错误降级。
15. 写 README。
16. 跑 npm run build。
17. 给出最终文件结构和使用说明。

---

# Important Constraints

必须遵守：

- 只使用一个 pet.json 和一个 spritesheet.webp 作为宠物资源。
- 不拆分状态图片。
- 不使用 GIF。
- 不使用远程资源。
- 不依赖后端。
- 不污染网页全局 CSS。
- 不在 iframe 里默认注入。
- 不在浏览器受限页面报错。
- 不把状态机写成混乱 if else。
- 不把动画帧写死成 DOM 图片列表。
- 不新建独立的宠物资源格式。
- 不新增和 hatch-pet 不兼容的必填字段。
- 允许 pet.json 有可选扩展字段，但播放器必须兼容最小 pet.json。
- 浏览器交互状态必须映射到 hatch-pet 的 9 个固定状态。

现在开始实现。