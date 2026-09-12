const STORAGE_KEY = "xiaohuomiao_mvp_v1";
const IGNITE_SECONDS = 180;
const MICRO_ACTIONS = [
  "打开你要用的资料。",
  "把任务相关页面打开，就算完成启动。",
  "把今天要做的内容过一遍。"
];
const QUOTE_LIBRARY =
  typeof window !== "undefined" && Array.isArray(window.quoteLibrary) ? window.quoteLibrary : ["今天也已经很好了。"];
const MUSIC_APPS = [
  { name: "网易云音乐", scheme: "orpheus://" },
  { name: "QQ音乐", scheme: "qqmusic://" },
  { name: "Apple Music", scheme: "music://" },
  { name: "Spotify", scheme: "spotify://" },
  { name: "其他", scheme: "" }
];
const DEFAULT_SETTINGS = {
  musicApp: "",
  notificationPermission: typeof Notification === "undefined" ? "unsupported" : Notification.permission
};

const defaultRuntime = {
  activeTab: "tasks",
  taskView: "home",
  meView: "home",
  expandedTaskIds: [],
  current: null,
  igniteStage: "empty",
  hasIgnited: false,
  igniteRemaining: IGNITE_SECONDS,
  microAction: MICRO_ACTIONS[0],
  focus: null,
  modal: null,
  lowEnergyIndex: 0,
  profileProgressExpanded: false,
  abilityPreviewExpanded: false,
  selectedGrowthCardId: null,
  selectedGrowthCardIds: [],
  growthManageMode: false,
  selectedRewardId: null,
  latestFeedback: null,
  pendingUnlockedRewards: [],
  pendingRedeemableRewards: [],
  reminderSentIds: []
};

let state = {
  bigTasks: [],
  growthCards: [],
  abilities: [],
  rewards: [],
  settings: { ...DEFAULT_SETTINGS },
  ...defaultRuntime
};

const app = document.querySelector("#app");

init();

function init() {
  loadStoredData();
  render();
  setInterval(tick, 1000);
}

function loadStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state.bigTasks = normalizeBigTasks(Array.isArray(parsed.bigTasks) ? parsed.bigTasks : []);
    state.growthCards = normalizeGrowthCards(Array.isArray(parsed.growthCards) ? parsed.growthCards : []);
    state.abilities = normalizeAbilities(Array.isArray(parsed.abilities) ? parsed.abilities : []);
    state.rewards = normalizeRewards(Array.isArray(parsed.rewards) ? parsed.rewards : []);
    state.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
  } catch {
    state.bigTasks = [];
    state.growthCards = [];
    state.abilities = [];
    state.rewards = [];
    state.settings = { ...DEFAULT_SETTINGS };
  }
  recalculateRewards();
}

function saveData() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      bigTasks: state.bigTasks,
      growthCards: state.growthCards,
      abilities: state.abilities,
      rewards: state.rewards,
      settings: state.settings
    })
  );
}

function normalizeBigTasks(tasks) {
  return tasks.map((task) => ({
    ...task,
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((subtask) => ({
          abilityIds: [],
          startDate: "",
          startTime: "",
          ...subtask,
          abilityIds: Array.isArray(subtask.abilityIds) ? subtask.abilityIds : [],
          startDate: subtask.startDate || "",
          startTime: subtask.startTime || "",
          startAction: subtask.startAction || ""
        }))
      : []
  }));
}

function normalizeGrowthCards(cards) {
  return cards.map((card) => ({
    abilityIds: [],
    quoteText: QUOTE_LIBRARY[0],
    ...card,
    abilityIds: Array.isArray(card.abilityIds) ? card.abilityIds : [],
    quoteText: card.quoteText || QUOTE_LIBRARY[0]
  }));
}

function normalizeAbilities(abilities) {
  return abilities.map((ability, index) => ({
    sortOrder: index,
    totalMinutes: 0,
    ...ability,
    totalMinutes: Number(ability.totalMinutes) || 0,
    sortOrder: Number.isFinite(Number(ability.sortOrder)) ? Number(ability.sortOrder) : index
  }));
}

function normalizeRewards(rewards) {
  return rewards.map((reward) => ({
    currentValue: 0,
    status: "in_progress",
    ...reward,
    currentValue: Number(reward.currentValue) || 0,
    targetValue: Math.max(0.1, Number(reward.targetValue) || 1),
    status: ["in_progress", "redeemable", "unlocked"].includes(reward.status) ? reward.status : "in_progress",
    deleted: Boolean(reward.deleted),
    redemption: reward.redemption || null
  }));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function todayText() {
  const date = new Date();
  const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function shortDate(dateLike = new Date()) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatDeadline(value) {
  if (!value) return "无截止日期";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatMinutes(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  if (safe < 60) return `${safe}分钟`;
  const hours = safe / 60;
  return `${Number.isInteger(hours) ? hours : Number(hours.toFixed(1))}小时`;
}

function todayInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatStartTime(subtask) {
  if (!subtask?.startDate || !subtask?.startTime) return "";
  const date = new Date(`${subtask.startDate}T${subtask.startTime}:00`);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月${date.getDate()}日 ${subtask.startTime}`;
}

function pickQuote() {
  if (!QUOTE_LIBRARY.length) return "今天也已经很好了。";
  return QUOTE_LIBRARY[Math.floor(Math.random() * QUOTE_LIBRARY.length)];
}

function sortedAbilities() {
  return [...state.abilities].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999;
    const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.totalMinutes - a.totalMinutes;
  });
}

function abilityScaleHours(abilities = state.abilities) {
  const maxHours = Math.max(0, ...abilities.map((ability) => (Number(ability.totalMinutes) || 0) / 60));
  if (maxHours <= 5) return 5;
  if (maxHours <= 10) return 10;
  if (maxHours <= 20) return 20;
  if (maxHours <= 50) return 50;
  return 100;
}

function rewardProgress(reward) {
  const targetValue = reward.conditionType === "completed_tasks" ? Math.max(1, Math.floor(reward.targetValue || 1)) : Math.max(0.5, Number(reward.targetValue) || 0.5);
  const available = reward.conditionType === "completed_tasks" ? availableCompletedTasks().length : availableFocusMinutes() / 60;
  const currentValue = reward.status === "unlocked" || reward.status === "redeemable" ? targetValue : Math.min(available, targetValue);
  const percent = Math.min(100, Math.round((currentValue / targetValue) * 100));
  return { currentValue, targetValue, percent, available };
}

function completedTaskCount() {
  return completedTaskRecords().length;
}

function totalFocusMinutes() {
  return state.growthCards.reduce((sum, card) => sum + (Number(card.focusMinutes) || 0), 0);
}

function formatRewardValue(value, reward) {
  if (reward.conditionType === "completed_tasks") return `${Math.floor(value)}次`;
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  return `${rounded}小时`;
}

function rewardConditionText(reward) {
  return reward.conditionType === "completed_tasks"
    ? `完成 ${Math.floor(reward.targetValue)} 次任务解锁`
    : `累计专注 ${reward.targetValue} 小时解锁`;
}

function recalculateRewards() {
  const newlyRedeemable = [];
  state.rewards.forEach((reward) => {
    if (reward.deleted || reward.status === "unlocked") return;
    const previousStatus = reward.status;
    const progress = rewardProgress(reward);
    reward.currentValue = progress.currentValue;
    reward.status = progress.available >= progress.targetValue ? "redeemable" : "in_progress";
    if (previousStatus !== "redeemable" && reward.status === "redeemable") newlyRedeemable.push(reward);
  });
  return newlyRedeemable;
}

function visibleRewards() {
  return state.rewards.filter((reward) => !reward.deleted);
}

function completedTaskRecords() {
  return state.bigTasks.flatMap((task) =>
    task.subtasks
      .filter((subtask) => subtask.status === "completed")
      .map((subtask) => ({
        ...subtask,
        bigTaskId: task.id,
        bigTaskTitle: task.title
      }))
  );
}

function usedTaskIds() {
  return new Set(
    state.rewards
      .filter((reward) => reward.status === "unlocked" && reward.conditionType === "completed_tasks")
      .flatMap((reward) => reward.redemption?.taskIds || [])
  );
}

function availableCompletedTasks() {
  const used = usedTaskIds();
  return completedTaskRecords()
    .filter((task) => !used.has(task.id))
    .sort((a, b) => new Date(a.completedAt || a.updatedAt || a.createdAt).getTime() - new Date(b.completedAt || b.updatedAt || b.createdAt).getTime());
}

function usedFocusMinutesByTaskId() {
  const used = new Map();
  state.rewards
    .filter((reward) => reward.status === "unlocked" && reward.conditionType === "focus_hours")
    .forEach((reward) => {
      (reward.redemption?.focusContributions || []).forEach((item) => {
        used.set(item.taskId, (used.get(item.taskId) || 0) + Number(item.minutesUsed || 0));
      });
    });
  return used;
}

function availableFocusRecords() {
  const used = usedFocusMinutesByTaskId();
  return completedTaskRecords()
    .map((task) => ({
      ...task,
      remainingMinutes: Math.max(0, (Number(task.investedMinutes) || 0) - (used.get(task.id) || 0))
    }))
    .filter((task) => task.remainingMinutes > 0)
    .sort((a, b) => new Date(a.completedAt || a.updatedAt || a.createdAt).getTime() - new Date(b.completedAt || b.updatedAt || b.createdAt).getTime());
}

function availableFocusMinutes() {
  return availableFocusRecords().reduce((sum, task) => sum + task.remainingMinutes, 0);
}

function clock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function priorityClass(priority) {
  return priority === "B" ? "b" : priority === "C" ? "c" : "";
}

function statusText(status) {
  return {
    not_started: "未开始",
    in_progress: "进行中",
    completed: "已完成"
  }[status];
}

function statusIcon(status) {
  return {
    not_started: "□",
    in_progress: "◐",
    completed: "☑"
  }[status];
}

function progressOf(task) {
  const total = task.subtasks.length;
  const completed = task.subtasks.filter((item) => item.status === "completed").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}

function findTask(taskId) {
  return state.bigTasks.find((task) => task.id === taskId);
}

function findSubtask(taskId, subTaskId) {
  const task = findTask(taskId);
  if (!task) return null;
  const subtask = task.subtasks.find((item) => item.id === subTaskId);
  return subtask ? { task, subtask } : null;
}

function getCurrentRefs() {
  if (!state.current) return null;
  return findSubtask(state.current.bigTaskId, state.current.subTaskId);
}

function remainingFocusMinutes(subtask) {
  const left = subtask.estimatedMinutes - subtask.investedMinutes;
  return left > 0 ? left : 5;
}

function render() {
  app.innerHTML = `
    <div class="phone">
      <section class="screen">
        ${renderActivePage()}
      </section>
      ${state.activeTab === "tasks" && state.taskView === "home" ? renderFab() : ""}
      ${renderTabs()}
      ${renderModal()}
    </div>
  `;
}

function renderActivePage() {
  if (state.activeTab === "tasks") return renderTasksPage();
  if (state.activeTab === "ignite") return renderIgnitePage();
  if (state.activeTab === "me" && state.selectedGrowthCardId) {
    const detailCard = state.growthCards.find((item) => item.id === state.selectedGrowthCardId);
    if (detailCard) return renderGrowthDetail(detailCard);
  }
  if (state.activeTab === "me" && state.meView === "settings") return renderSettingsPage();
  if (state.activeTab === "me" && state.meView === "growthLibrary") return renderGrowthLibraryPage();
  if (state.activeTab === "me" && state.meView === "abilities") return renderAbilityPage();
  if (state.activeTab === "me" && state.meView === "rewardDetail") return renderRewardDetailPage();
  if (state.activeTab === "me" && state.meView === "rewards") return renderRewardsPage();
  return renderMePage();
}

function renderTabs() {
  const tabs = [
    ["tasks", "任务"],
    ["ignite", "点火"],
    ["me", "我的"]
  ];
  return `
    <nav class="bottom-tabs">
      <div class="tabs-inner">
        ${tabs
          .map(
            ([tab, label]) => `
              <button class="tab ${state.activeTab === tab ? "active" : ""}" data-action="tab" data-tab="${tab}">
                ${label}
              </button>
            `
          )
          .join("")}
      </div>
    </nav>
  `;
}

function renderFab() {
  return `<button class="fab" aria-label="新建" data-action="open-create-sheet">+</button>`;
}

function renderTasksPage() {
  return `
    <header class="top-copy page-head">
      <div>
        <h1 class="title home-title">今天先点燃一颗小火苗吧</h1>
        <p class="eyebrow">${todayText()}</p>
      </div>
    </header>
    <div class="section-title">
      <h2>大任务</h2>
    </div>
    ${
      state.bigTasks.length === 0
        ? renderTaskEmpty()
        : `<div class="stack">${state.bigTasks.map(renderTaskCard).join("")}</div>`
    }
  `;
}

function renderTaskEmpty() {
  return `
    <div class="card empty ignite-empty">
      <p>还没有大任务。</p>
      <p>先创建一个你想推进的大目标吧。<br>比如：AI产品大赛、英语演讲、课程作业。</p>
      <button class="btn primary full" data-action="open-big-form-create">新建大任务</button>
    </div>
  `;
}

function renderTaskCard(task) {
  const isExpanded = state.expandedTaskIds.includes(task.id);
  const progress = progressOf(task);
  return `
    <article class="card task-card">
      <div class="task-main">
        <div class="task-head">
          <button class="expand-btn" data-action="toggle-expand" data-task-id="${task.id}" aria-label="${isExpanded ? "收起" : "展开"}">
            ${isExpanded ? "▾" : "▸"}
          </button>
          <div class="task-title">${escapeHTML(task.title)}</div>
          <span class="priority-badge ${priorityClass(task.priority)}">优先级 ${task.priority}</span>
        </div>
        <div class="task-meta">
          <div class="meta">截止：${formatDeadline(task.deadline)}</div>
          <div class="progress-line">
            <span>进度 ${progress.percent}%</span>
            <span>${progress.completed}/${progress.total}</span>
          </div>
          <div class="progress-track" aria-label="大任务进度">
            <div class="progress-fill" style="width:${progress.percent}%"></div>
          </div>
        </div>
        ${
          isExpanded
            ? `
              <div class="task-actions">
                <button class="btn secondary" data-action="open-sub-form-create" data-task-id="${task.id}">添加子任务</button>
                <button class="btn" data-action="open-big-form-edit" data-task-id="${task.id}">修改</button>
                <button class="btn danger" data-action="confirm-delete-big" data-task-id="${task.id}">删除</button>
              </div>
            `
            : ""
        }
      </div>
      ${isExpanded ? renderSubtaskArea(task) : ""}
    </article>
  `;
}

function renderSubtaskArea(task) {
  if (task.subtasks.length === 0) {
    return `
      <div class="subtask-area">
        <div class="empty">
          <p>这个大任务还没有子任务。</p>
          <p>把它拆成一个小小的开始吧。</p>
          <button class="btn primary full" data-action="open-sub-form-create" data-task-id="${task.id}">添加子任务</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="subtask-area">
      ${task.subtasks.map((subtask) => renderSubtaskRow(task, subtask)).join("")}
    </div>
  `;
}

function renderSubtaskRow(task, subtask) {
  const completed = subtask.status === "completed";
  const timeText = completed
    ? `预计${subtask.estimatedMinutes}分钟｜实际投入${subtask.investedMinutes}分钟`
    : `预计${subtask.estimatedMinutes}分钟｜已投入${subtask.investedMinutes}分钟`;
  const startText = formatStartTime(subtask);
  const abilityNames = (subtask.abilityIds || [])
    .map((id) => state.abilities.find((ability) => ability.id === id)?.name)
    .filter(Boolean);
  return `
    <div class="subtask-row">
      <div class="sub-title-line">
        <span class="status-icon">${statusIcon(subtask.status)}</span>
        <div>
          <div class="sub-title">${escapeHTML(subtask.title)}</div>
          ${subtask.isLowEnergy ? `<span class="low-tag">低能量任务</span>` : ""}
        </div>
      </div>
      <div class="meta">${timeText}</div>
      <div class="meta">优先级${subtask.priority}｜${statusText(subtask.status)}</div>
      ${startText ? `<div class="meta">开始时间：${startText}</div>` : ""}
      ${subtask.startAction ? `<div class="meta">点火小动作：${escapeHTML(subtask.startAction)}</div>` : ""}
      ${abilityNames.length ? `<div class="tag-row">${abilityNames.map((name) => `<span class="low-tag">${escapeHTML(name)}</span>`).join("")}</div>` : ""}
      <div class="sub-actions">
        ${
          completed
            ? ""
            : `<button class="btn primary" data-action="select-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}">点火</button>`
        }
        <button class="btn" data-action="open-sub-form-edit" data-task-id="${task.id}" data-subtask-id="${subtask.id}">修改</button>
        <button class="btn danger" data-action="confirm-delete-sub" data-task-id="${task.id}" data-subtask-id="${subtask.id}">删除</button>
      </div>
    </div>
  `;
}

function renderIgnitePage() {
  if (state.igniteStage === "feedback") return renderFeedbackBackdrop();
  if (state.igniteStage === "music") return renderMusicPage();
  if (state.igniteStage === "countdown") return renderIgniteCountdown();
  if (state.igniteStage === "success") return renderIgniteSuccess();
  if (state.igniteStage === "focus") return renderFocusPage();
  if (state.igniteStage === "lowEnergy") return renderLowEnergyPage();

  const refs = getCurrentRefs();
  if (!refs) return renderNoCurrentTask();
  return renderIgniteReady(refs.task, refs.subtask);
}

function renderNoCurrentTask() {
  return `
    <header class="top-copy">
      <h1 class="title">点火苗模式</h1>
    </header>
    <div class="card empty">
      <p>你还没有选择要点火的任务。</p>
      <p>先去任务页选择一个小任务，<br>再点燃今天的小火苗吧。</p>
      <button class="btn primary full" data-action="tab" data-tab="tasks">去任务页选择</button>
    </div>
  `;
}

function renderIgniteReady(task, subtask) {
  return `
    <header class="top-copy">
      <h1 class="title">点火苗模式</h1>
    </header>
    <div class="ignite-panel">
      <section class="card hero-card task-summary">
        <p class="eyebrow">当前任务</p>
        <h2 class="title" style="font-size:20px">${escapeHTML(task.title)} - ${escapeHTML(subtask.title)}</h2>
        <p class="meta">大任务优先级 ${task.priority}｜子任务优先级 ${subtask.priority}</p>
        <p class="meta">预计时间：${subtask.estimatedMinutes}分钟</p>
      </section>
      <section class="card hero-card">
        <p class="warm-question">你想不想听一首歌，<br>并点燃今天的小火苗？</p>
      </section>
      <div class="choice-stack">
        <button class="btn primary full" data-action="choose-music">音乐点火</button>
        <button class="btn secondary full" data-action="start-ignite-countdown">静音点火</button>
        <button class="btn full" data-action="skip-ignite">跳过，直接学习</button>
        <button class="btn success full" data-action="open-low-energy">今天状态不好，低能量模式</button>
      </div>
    </div>
  `;
}

function renderMusicPage() {
  const bound = state.settings.musicApp || "音乐软件";
  return `
    <header class="top-copy">
      <h1 class="title">音乐点火</h1>
    </header>
    <div class="card hero-card stack">
      <p class="meta" style="font-size:16px;color:var(--text)">
        已经为你打开${escapeHTML(bound)}。
      </p>
      <p class="meta" style="font-size:16px;color:var(--text)">
        如果没有自动跳转，<br>
        请手动打开音乐软件。<br><br>
        选好歌并开始播放后，<br>
        请回到小火苗，<br>
        点击“我已选好歌，开始点火”。
      </p>
      <div class="choice-stack">
        <button class="btn secondary full" data-action="open-bound-music">再次打开音乐软件</button>
        <button class="btn primary full" data-action="start-ignite-countdown">我已选好歌，开始点火</button>
        <button class="btn full" data-action="start-ignite-countdown">改用静音点火</button>
      </div>
    </div>
  `;
}

function renderIgniteCountdown() {
  const refs = getCurrentRefs();
  if (!refs) return renderNoCurrentTask();
  const progress = (IGNITE_SECONDS - state.igniteRemaining) / IGNITE_SECONDS;
  return `
    <header class="top-copy">
      <h1 class="title">点火中</h1>
    </header>
    <div class="card hero-card stack">
      <div class="task-summary">
        <p class="eyebrow">当前任务</p>
        <h2 class="title" style="font-size:20px">${escapeHTML(refs.task.title)} - ${escapeHTML(refs.subtask.title)}</h2>
      </div>
      <div class="flame-stage">
        ${renderFlame(progress)}
        <strong>小火苗正在慢慢点亮</strong>
        <div class="timer">${clock(state.igniteRemaining)}</div>
      </div>
      <div class="small-action">
        <strong>点火小动作</strong>
        <span>${state.microAction}</span>
      </div>
      <button class="btn danger full" data-action="confirm-abandon-ignite">放弃点火</button>
    </div>
  `;
}

function renderFlame(progress, success = false) {
  const clamped = Math.max(0, Math.min(1, progress));
  const scale = 0.65 + clamped * 0.55;
  const opacity = 0.25 + clamped * 0.75;
  return `
    <div class="flame-wrap ${success ? "success-flame" : ""}" style="--flame-progress:${clamped};--flame-scale:${scale};--flame-opacity:${opacity}">
      <div class="flame-glow"></div>
      <div class="flame">🔥</div>
    </div>
  `;
}

function renderIgniteSuccess() {
  return `
    <header class="top-copy">
      <h1 class="title">点火成功</h1>
    </header>
    <div class="card hero-card stack">
      <div class="flame-stage">
        ${renderFlame(1, true)}
        <strong>小火苗已点亮</strong>
      </div>
      <p class="meta" style="font-size:16px;color:var(--text)">
        恭喜你，点火成功！<br><br>
        你刚刚完成了一次<br>
        “从娱乐状态切回学习”的动作。<br><br>
        这比单纯学习3分钟更重要。<br><br>
        火箭即将发射，<br>
        要不要继续下一关？
      </p>
      <div class="choice-stack">
        <button class="btn primary full" data-action="start-focus-five">继续 5 分钟</button>
        <button class="btn secondary full" data-action="start-focus-full">进入正式专注</button>
        <button class="btn full" data-action="only-ignite">今天只完成点火也可以</button>
        <button class="btn success full" data-action="open-low-energy">换一个低能量任务</button>
      </div>
    </div>
  `;
}

function renderFocusPage() {
  const refs = getCurrentRefs();
  if (!refs || !state.focus) return renderNoCurrentTask();
  const elapsedMinutes = Math.ceil((state.focus.plannedSeconds - state.focus.remainingSeconds) / 60);
  return `
    <header class="top-copy">
      <h1 class="title">正在专注</h1>
    </header>
    <div class="card hero-card stack">
      <div class="task-summary">
        <h2 class="title" style="font-size:20px">${escapeHTML(refs.task.title)}</h2>
        <p class="meta" style="font-size:16px;color:var(--text)">${escapeHTML(refs.subtask.title)}</p>
      </div>
      <div class="focus-timer">
        <div class="timer">${clock(state.focus.remainingSeconds)}</div>
        <span class="meta">剩余专注时间</span>
      </div>
      <div class="notice">
        已投入：${refs.subtask.investedMinutes}分钟 / ${refs.subtask.estimatedMinutes}分钟<br>
        本次计时：${state.focus.paused ? "已暂停" : "进行中"}${elapsedMinutes > 0 ? `，已专注${elapsedMinutes}分钟` : ""}
      </div>
      <div class="button-row">
        ${
          state.focus.paused
            ? `<button class="btn primary" data-action="resume-focus">继续</button>`
            : `<button class="btn secondary" data-action="pause-focus">暂停</button>`
        }
      </div>
      <button class="btn success full" data-action="confirm-early-complete">提前完成</button>
      <button class="btn danger full" data-action="confirm-abandon-focus">放弃当前任务</button>
    </div>
  `;
}

function renderLowEnergyPage() {
  const candidates = lowEnergyCandidates();
  if (candidates.length === 0) {
    return `
      <header class="top-copy">
        <h1 class="title">低能量模式</h1>
      </header>
      <div class="card empty">
        <p>你还没有设置低能量任务。</p>
        <p>可以回到任务页，把某个子任务标记为低能量任务。</p>
        <button class="btn primary full" data-action="tab" data-tab="tasks">返回任务页</button>
        <button class="btn full" data-action="back-to-ready">返回</button>
      </div>
    `;
  }

  const index = state.lowEnergyIndex % candidates.length;
  const item = candidates[index];
  return `
    <header class="top-copy">
      <h1 class="title">低能量模式</h1>
    </header>
    <div class="card hero-card stack">
      <p class="eyebrow">为你找到一个低能量任务：</p>
      <div class="task-summary">
        <h2 class="title" style="font-size:20px">${escapeHTML(item.task.title)} - ${escapeHTML(item.subtask.title)}</h2>
        <p class="meta">预计时间：${item.subtask.estimatedMinutes}分钟</p>
        <p class="meta">优先级：${item.subtask.priority}</p>
      </div>
      <div class="choice-stack">
        <button class="btn primary full" data-action="use-low-energy" data-task-id="${item.task.id}" data-subtask-id="${item.subtask.id}">用这个任务点火</button>
        <button class="btn secondary full" data-action="next-low-energy">换一个</button>
        <button class="btn full" data-action="back-to-ready">返回</button>
      </div>
    </div>
  `;
}

function renderFeedbackBackdrop() {
  const card = state.growthCards.find((item) => item.id === state.latestFeedback?.cardId);
  if (!card) return renderNoCurrentTask();
  return `
    <header class="top-copy">
      <p class="eyebrow">小火苗</p>
      <h1 class="title">任务完成</h1>
    </header>
    <div class="card empty">
      <p>完成反馈卡已生成。</p>
      <p>${escapeHTML(card.bigTaskTitle)} - ${escapeHTML(card.subTaskTitle)}</p>
      <button class="btn primary full" data-action="reopen-feedback">查看完成反馈</button>
    </div>
  `;
}

function renderMePage() {
  const detailCard = state.growthCards.find((item) => item.id === state.selectedGrowthCardId);
  if (detailCard) return renderGrowthDetail(detailCard);

  const completedCount = completedTaskCount();
  const totalFocus = totalFocusMinutes();
  return `
    <header class="top-copy page-head">
      <div>
        <p class="eyebrow">小火苗</p>
        <h1 class="title">我的</h1>
      </div>
      <button class="icon-btn" data-action="open-settings" aria-label="设置">⚙️</button>
    </header>
    <div class="profile-panel">
      <section class="card overview-card">
        <h2>累计概览</h2>
        <div class="overview-pairs">
          <div><span>已完成任务</span><strong>${completedCount}个</strong></div>
          <div><span>累计成长卡</span><strong>${state.growthCards.length}张</strong></div>
          <div class="wide"><span>累计专注</span><strong>${formatMinutes(totalFocus)}</strong></div>
        </div>
      </section>
      <section class="card module-card">
        <div class="module-head">
          <h2>大任务进度</h2>
          <button class="link-btn" data-action="toggle-profile-progress">${state.profileProgressExpanded ? "收起" : "展开"}</button>
        </div>
        ${state.profileProgressExpanded ? renderProfileTaskProgress() : ""}
      </section>
      <section class="card module-card">
        <div class="module-head">
          <h2>成长库</h2>
          <button class="link-btn" data-action="open-growth-library">进入</button>
        </div>
        <p class="module-number">已积累 ${state.growthCards.length} 张成长卡</p>
        <p class="meta">记录下你每一次完成任务的证据</p>
      </section>
      <section class="card module-card">
        <div class="module-head">
          <h2>能力概览</h2>
          <div class="inline-actions">
            <button class="link-btn" data-action="toggle-ability-preview">${state.abilityPreviewExpanded ? "收起" : "展开"}</button>
            <button class="link-btn" data-action="open-abilities">进入</button>
          </div>
        </div>
        <p class="module-number">已创建 ${state.abilities.length} 个能力方向</p>
        <p class="meta">看见你把时间投入到了哪里</p>
        ${state.abilityPreviewExpanded ? renderAbilityPreview() : ""}
      </section>
      <section class="card module-card">
        <div class="module-head">
          <h2>奖励进度</h2>
          <button class="link-btn" data-action="open-rewards">管理</button>
        </div>
        ${renderRewardPreview()}
      </section>
    </div>
  `;
}

function renderProfileTaskProgress() {
  if (state.bigTasks.length === 0) return `<div class="empty slim"><p>还没有大任务进度。</p></div>`;
  return `<div class="mini-stack">${state.bigTasks.map(renderProgressItem).join("")}</div>`;
}

function renderProgressItem(task) {
  const progress = progressOf(task);
  return `
    <button class="progress-item" data-action="open-task-progress" data-task-id="${task.id}">
      <div class="progress-item-head">
        <strong>${escapeHTML(task.title)}</strong>
        <span>${progress.percent}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
      <span class="meta">已完成 ${progress.completed}/${progress.total}</span>
    </button>
  `;
}

function renderAbilityPreview() {
  const abilities = sortedAbilities().slice(0, 4);
  if (abilities.length === 0) {
    return `<div class="empty slim"><p>还没有创建能力方向。</p></div>`;
  }
  const scale = abilityScaleHours(abilities);
  return `<div class="mini-stack">${abilities.map((ability) => renderAbilityRow(ability, scale)).join("")}</div>`;
}

function renderRewardPreview() {
  const rewards = visibleRewards().filter((reward) => reward.status !== "unlocked").slice(0, 3);
  if (rewards.length === 0) {
    return `<div class="empty slim"><p>还没有进行中的奖励。</p><button class="btn secondary full" data-action="open-rewards">添加奖励</button></div>`;
  }
  return `<div class="mini-stack">${rewards.map(renderRewardItem).join("")}</div>`;
}

function renderGrowthItem(card, manageMode = false) {
  const checked = state.selectedGrowthCardIds.includes(card.id);
  if (manageMode) {
    return `
      <button class="growth-item manage-item" data-action="toggle-growth-select" data-card-id="${card.id}">
        <div class="growth-item-head">
          <strong>${checked ? "☑" : "☐"} ${escapeHTML(card.date)}｜${escapeHTML(card.bigTaskTitle)}</strong>
        </div>
        <span>${escapeHTML(card.subTaskTitle)}</span>
        <span class="meta">学习${formatMinutes(card.focusMinutes)}｜进度${card.progressBefore}%→${card.progressAfter}%</span>
      </button>
    `;
  }
  return `
    <button class="growth-item" data-action="open-card-detail" data-card-id="${card.id}">
      <div class="growth-item-head">
        <strong>${escapeHTML(card.date)}｜${escapeHTML(card.bigTaskTitle)}</strong>
      </div>
      <span>${escapeHTML(card.subTaskTitle)}</span>
      <span class="meta">学习${formatMinutes(card.focusMinutes)}｜进度${card.progressBefore}%→${card.progressAfter}%</span>
    </button>
  `;
}

function renderGrowthLibraryPage() {
  const cards = [...state.growthCards].sort(sortByCreatedDesc);
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="back-me-home" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">小火苗</p>
        <h1 class="title">成长库</h1>
      </div>
      ${
        state.growthCards.length
          ? `<button class="link-btn" data-action="toggle-growth-manage">${state.growthManageMode ? "取消" : "批量管理"}</button>`
          : ""
      }
    </header>
    ${
      state.growthManageMode
        ? `<div class="card module-card">
            <div class="module-head">
              <h2>已选择 ${state.selectedGrowthCardIds.length} 张</h2>
              <button class="btn danger" data-action="confirm-delete-growth-cards" ${state.selectedGrowthCardIds.length === 0 ? "disabled" : ""}>删除选中</button>
            </div>
          </div>`
        : ""
    }
    ${
      state.growthCards.length === 0
        ? `<div class="card empty"><p>成长库还空空的。</p><p>完成一个任务后，<br>这里会保存你的第一张成长卡。</p></div>`
        : `<div class="stack">${cards.map((card) => renderGrowthItem(card, state.growthManageMode)).join("")}</div>`
    }
  `;
}

function renderGrowthDetail(card) {
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="back-growth-library" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">小火苗</p>
        <h1 class="title">成长卡</h1>
      </div>
    </header>
    <div class="growth-detail">
      <section class="card result-block">
        <p>${escapeHTML(card.date)}</p>
        <h3>${escapeHTML(card.bigTaskTitle)}</h3>
        <p>${escapeHTML(card.subTaskTitle)}</p>
      </section>
      <section class="card result-block">
        <h3>本次投入</h3>
        <p>${formatMinutes(card.focusMinutes)}</p>
      </section>
      <section class="card result-block">
        <h3>进度变化</h3>
        <p>${card.progressBefore}% → ${card.progressAfter}%</p>
      </section>
      <section class="card result-block">
        <h3>今日成果</h3>
        <p>你完成了「${escapeHTML(card.subTaskTitle)}」。<br>这张成果卡已放入成长库。</p>
      </section>
      <section class="card result-block">
        <h3>今日鼓励</h3>
        <p>${escapeHTML(card.emotionText).replaceAll("\n", "<br>")}</p>
      </section>
      <button class="btn primary full" data-action="back-growth-library">返回成长库</button>
    </div>
  `;
}

function renderAbilityPage() {
  const abilities = sortedAbilities();
  const scale = abilityScaleHours(abilities);
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="back-me-home" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">当前刻度：满格 = ${scale}小时</p>
        <h1 class="title">能力概览</h1>
      </div>
    </header>
    <div class="stack">
      <div class="card module-card">
        <div class="module-head">
          <h2>能力管理</h2>
          <button class="link-btn" data-action="open-ability-form-create">添加能力</button>
        </div>
        ${
          abilities.length === 0
            ? `<div class="empty slim"><p>你还没有创建能力方向。</p></div>`
            : `<div class="mini-stack">${abilities.map((ability) => renderAbilityManageRow(ability, scale)).join("")}</div>`
        }
      </div>
    </div>
  `;
}

function renderAbilityRow(ability, scale = abilityScaleHours()) {
  const hours = (Number(ability.totalMinutes) || 0) / 60;
  const percent = Math.min(100, Math.round((hours / scale) * 100));
  return `
    <div class="ability-row">
      <div class="ability-line">
        <strong>${escapeHTML(ability.name)}</strong>
        <span>${formatMinutes(ability.totalMinutes)}</span>
      </div>
      <div class="ability-progress-wrap">
        <div class="progress-track ability-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <span class="meta">满格${scale}小时</span>
      </div>
    </div>
  `;
}

function renderAbilityManageRow(ability, scale) {
  const index = sortedAbilities().findIndex((item) => item.id === ability.id);
  return `
    <div class="ability-manage-row">
      ${renderAbilityRow(ability, scale)}
      <div class="sub-actions">
        <button class="btn" data-action="move-ability-up" data-ability-id="${ability.id}" ${index === 0 ? "disabled" : ""}>上移</button>
        <button class="btn" data-action="move-ability-down" data-ability-id="${ability.id}" ${index === state.abilities.length - 1 ? "disabled" : ""}>下移</button>
        <button class="btn" data-action="open-ability-form-edit" data-ability-id="${ability.id}">修改</button>
        <button class="btn danger" data-action="confirm-delete-ability" data-ability-id="${ability.id}">删除</button>
      </div>
    </div>
  `;
}

function renderRewardsPage() {
  const rewards = visibleRewards();
  const inProgress = rewards.filter((reward) => reward.status === "in_progress");
  const redeemable = rewards.filter((reward) => reward.status === "redeemable");
  const unlocked = rewards.filter((reward) => reward.status === "unlocked");
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="back-me-home" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">小火苗</p>
        <h1 class="title">我的奖励</h1>
      </div>
    </header>
    <div class="stack">
      <section class="card module-card">
        <div class="module-head">
          <h2>进行中</h2>
          <button class="link-btn" data-action="open-reward-form-create">添加奖励</button>
        </div>
        ${
          inProgress.length === 0
            ? `<div class="empty slim"><p>还没有进行中的奖励。</p></div>`
            : `<div class="mini-stack">${inProgress.map((reward) => renderRewardItem(reward, true)).join("")}</div>`
        }
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>可兑换</h2></div>
        ${
          redeemable.length === 0
            ? `<div class="empty slim"><p>还没有可兑换奖励。</p></div>`
            : `<div class="mini-stack">${redeemable.map((reward) => renderRewardItem(reward, true)).join("")}</div>`
        }
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>已解锁</h2></div>
        ${
          unlocked.length === 0
            ? `<div class="empty slim"><p>还没有解锁奖励。</p></div>`
            : `<div class="mini-stack">${unlocked.map(renderUnlockedRewardItem).join("")}</div>`
        }
      </section>
    </div>
  `;
}

function renderRewardItem(reward, withActions = false) {
  const progress = rewardProgress(reward);
  const isRedeemable = reward.status === "redeemable";
  return `
    <div class="reward-item">
      <div class="reward-head">
        <strong>${escapeHTML(reward.icon || "🎁")} ${escapeHTML(reward.name)}</strong>
        <span>${formatRewardValue(progress.currentValue, reward)} / ${formatRewardValue(progress.targetValue, reward)}</span>
      </div>
      <p class="meta">${rewardConditionText(reward)}</p>
      <p class="meta">当前进度：${formatRewardValue(progress.currentValue, reward)} / ${formatRewardValue(progress.targetValue, reward)}</p>
      <div class="progress-track"><div class="progress-fill" style="width:${progress.percent}%"></div></div>
      ${
        withActions
          ? `<div class="sub-actions">
              ${isRedeemable ? `<button class="btn primary" data-action="redeem-reward" data-reward-id="${reward.id}">兑换奖励</button>` : ""}
              <button class="btn" data-action="open-reward-form-edit" data-reward-id="${reward.id}">修改</button>
              <button class="btn danger" data-action="confirm-delete-reward" data-reward-id="${reward.id}">删除</button>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderUnlockedRewardItem(reward) {
  return `
    <div class="reward-item unlocked">
      <div class="reward-head">
        <strong>${escapeHTML(reward.icon || "🎁")} ${escapeHTML(reward.name)}</strong>
      </div>
      <p class="meta">已于${shortDate(reward.unlockedAt || reward.createdAt)}解锁</p>
      <div class="sub-actions">
        <button class="btn" data-action="open-reward-detail" data-reward-id="${reward.id}">查看详情</button>
        <button class="btn danger" data-action="confirm-delete-reward" data-reward-id="${reward.id}">删除</button>
      </div>
    </div>
  `;
}

function renderRewardDetailPage() {
  const reward = state.rewards.find((item) => item.id === state.selectedRewardId);
  if (!reward) {
    state.meView = "rewards";
    return renderRewardsPage();
  }
  const isTaskReward = reward.conditionType === "completed_tasks";
  const taskMap = new Map(completedTaskRecords().map((task) => [task.id, task]));
  const taskIds = reward.redemption?.taskIds || [];
  const focusItems = reward.redemption?.focusContributions || [];
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="open-rewards" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">已于 ${shortDate(reward.unlockedAt || reward.createdAt)} 解锁</p>
        <h1 class="title">${escapeHTML(reward.name)} ${escapeHTML(reward.icon || "🎁")}</h1>
      </div>
    </header>
    <div class="stack">
      <section class="card module-card">
        <div class="module-head"><h2>解锁条件</h2></div>
        <p class="module-number">${rewardConditionText(reward).replace("解锁", "")}</p>
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>${isTaskReward ? "用于兑换的任务" : "用于兑换的专注时长"}</h2></div>
        ${
          isTaskReward
            ? `<ol class="detail-list">${taskIds
                .map((id) => {
                  const task = taskMap.get(id);
                  return `<li>${escapeHTML(task ? `${task.bigTaskTitle} - ${task.title}` : id)}</li>`;
                })
                .join("")}</ol>`
            : `<ol class="detail-list">${focusItems
                .map((item) => `<li>${escapeHTML(item.bigTaskTitle)} - ${escapeHTML(item.taskTitle)}：${formatMinutes(item.minutesUsed)}</li>`)
                .join("")}</ol><p class="module-number">总计：${formatMinutes(reward.redemption?.totalRedeemedMinutes || 0)}</p>`
        }
      </section>
      <button class="btn primary full" data-action="open-rewards">返回</button>
    </div>
  `;
}

function renderSettingsPage() {
  const musicApp = state.settings.musicApp || "未绑定";
  return `
    <header class="top-copy page-head">
      <button class="icon-btn" data-action="back-me-home" aria-label="返回">‹</button>
      <div>
        <p class="eyebrow">小火苗</p>
        <h1 class="title">设置</h1>
      </div>
    </header>
    <div class="stack">
      <section class="card module-card">
        <div class="module-head"><h2>音乐点火设置</h2></div>
        <p class="module-number">当前已绑定：${escapeHTML(musicApp)}</p>
        <button class="btn secondary full" data-action="open-music-bind">切换音乐软件</button>
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>悬浮窗设置</h2></div>
        <p class="module-number">悬浮小火苗权限</p>
        <p class="meta">用于从音乐软件快速回到小火苗。</p>
        <button class="btn secondary full" data-action="floating-window-notice">去授权</button>
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>通知栏设置</h2></div>
        <p class="module-number">通知权限</p>
        <p class="meta">用于在任务开始前 5 分钟提醒你点燃小火苗。</p>
        <button class="btn secondary full" data-action="request-notification">去授权</button>
      </section>
      <section class="card module-card">
        <div class="module-head"><h2>关于</h2></div>
        <p class="meta">小火苗是一款面向大学生学习启动困难场景的轻量学习工具。你可以把大任务拆成更容易开始的子任务，再通过点火苗、能力累计、成长卡和奖励机制，把“知道该学但动不了”变成“先开始一点，并看见自己的推进”。</p>
      </section>
    </div>
  `;
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function renderModal() {
  if (!state.modal) return "";
  const modal = state.modal;
  if (modal.type === "create-sheet") return renderCreateSheet();
  if (modal.type === "choose-big") return renderChooseBigTask();
  if (modal.type === "big-form") return renderBigTaskForm(modal);
  if (modal.type === "sub-form") return renderSubtaskForm(modal);
  if (modal.type === "delete-big") return renderDeleteBigConfirm(modal.taskId);
  if (modal.type === "delete-sub") return renderDeleteSubConfirm(modal.taskId, modal.subTaskId);
  if (modal.type === "abandon-ignite") return renderAbandonIgniteConfirm();
  if (modal.type === "abandon-focus") return renderAbandonFocusConfirm();
  if (modal.type === "early-complete") return renderEarlyCompleteConfirm();
  if (modal.type === "timer-ended") return renderTimerEnded();
  if (modal.type === "notice") return renderNotice(modal.message);
  if (modal.type === "feedback") return renderFeedbackModal();
  if (modal.type === "music-bind-prompt") return renderMusicBindPrompt();
  if (modal.type === "music-bind") return renderMusicBindForm();
  if (modal.type === "ability-form") return renderAbilityForm(modal);
  if (modal.type === "delete-ability") return renderDeleteAbilityConfirm(modal.abilityId);
  if (modal.type === "reward-form") return renderRewardForm(modal);
  if (modal.type === "delete-reward") return renderDeleteRewardConfirm(modal.rewardId);
  if (modal.type === "reward-redeemable") return renderRewardRedeemableModal();
  if (modal.type === "reward-unlocked") return renderRewardUnlockedModal();
  if (modal.type === "delete-growth-cards") return renderDeleteGrowthCardsConfirm();
  return "";
}

function modalShell(content) {
  return `<div class="modal-backdrop"><div class="modal">${content}</div></div>`;
}

function renderCreateSheet() {
  return modalShell(`
    <h2>你想创建什么？</h2>
    <div class="choice-stack">
      <button class="btn primary full" data-action="open-big-form-create">新建大任务</button>
      <button class="btn secondary full" data-action="open-choose-big">给已有大任务添加子任务</button>
      <button class="btn ghost full" data-action="close-modal">取消</button>
    </div>
  `);
}

function renderChooseBigTask() {
  const content =
    state.bigTasks.length === 0
      ? `<p>还没有大任务。</p><button class="btn primary full" data-action="open-big-form-create">新建大任务</button>`
      : `<div class="choice-stack">${state.bigTasks
          .map(
            (task) => `
              <button class="btn full" data-action="open-sub-form-create" data-task-id="${task.id}">
                ${escapeHTML(task.title)}
              </button>
            `
          )
          .join("")}</div>`;
  return modalShell(`
    <h2>选择大任务</h2>
    ${content}
    <button class="btn ghost full" data-action="close-modal" style="margin-top:10px">取消</button>
  `);
}

function renderBigTaskForm(modal) {
  const editing = modal.mode === "edit";
  const task = editing ? findTask(modal.taskId) : null;
  return modalShell(`
    <h2>${editing ? "修改大任务" : "新建大任务"}</h2>
    <form class="form" data-form="big-task" data-mode="${modal.mode}" data-task-id="${modal.taskId || ""}">
      <div class="field">
        <label for="big-title">大任务名称</label>
        <input class="input" id="big-title" name="title" value="${escapeHTML(task?.title || "")}" required maxlength="40" />
      </div>
      <div class="field">
        <span class="label">优先级</span>
        ${renderPrioritySegment(task?.priority || "A", "big-priority")}
      </div>
      <div class="field">
        <label for="big-deadline">截止日期</label>
        <input class="input" id="big-deadline" name="deadline" type="date" value="${escapeHTML(task?.deadline || "")}" />
      </div>
      <div class="field">
        <label for="big-description">备注</label>
        <textarea class="textarea" id="big-description" name="description">${escapeHTML(task?.description || "")}</textarea>
      </div>
      <div class="button-row">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  `);
}

function renderSubtaskForm(modal) {
  const editing = modal.mode === "edit";
  const refs = editing ? findSubtask(modal.taskId, modal.subTaskId) : null;
  const subtask = refs?.subtask;
  return modalShell(`
    <h2>${editing ? "修改子任务" : "添加子任务"}</h2>
    <form class="form" data-form="sub-task" data-mode="${modal.mode}" data-task-id="${modal.taskId}" data-subtask-id="${modal.subTaskId || ""}" data-after-timer="${modal.afterTimer ? "true" : "false"}">
      <div class="field">
        <label for="sub-title">子任务名称</label>
        <input class="input" id="sub-title" name="title" value="${escapeHTML(subtask?.title || "")}" required maxlength="48" />
      </div>
      <div class="field">
        <label for="sub-minutes">预计时长</label>
        <input class="input" id="sub-minutes" name="estimatedMinutes" type="number" min="1" max="600" value="${subtask?.estimatedMinutes || 15}" required />
      </div>
      <div class="field">
        <span class="label">优先级</span>
        ${renderPrioritySegment(subtask?.priority || "A", "sub-priority")}
      </div>
      <div class="field">
        <span class="label">开始时间（可选）</span>
        <div class="date-time-row">
          <input class="input" name="startDate" type="date" value="${escapeHTML(subtask?.startDate || todayInputValue())}" />
          <input class="input" name="startTime" type="time" value="${escapeHTML(subtask?.startTime || "")}" />
        </div>
        <button class="btn ghost" type="button" data-action="clear-start-time">清空开始时间</button>
      </div>
      <label class="checkline">
        <input name="isLowEnergy" type="checkbox" ${subtask?.isLowEnergy ? "checked" : ""} />
        <span>是低能量任务</span>
      </label>
      <div class="field">
        <span class="label">对应能力（可多选）</span>
        ${renderAbilityChoices(subtask?.abilityIds || [])}
      </div>
      <div class="button-row">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  `);
}

function renderAbilityChoices(selectedIds) {
  const abilities = sortedAbilities();
  if (abilities.length === 0) {
    return `
      <div class="empty slim">
        <p>你还没有创建能力方向。</p>
        <button class="btn secondary full" type="button" data-action="open-abilities">去添加能力</button>
      </div>
    `;
  }
  return `
    <div class="checkbox-grid">
      ${abilities
        .map(
          (ability) => `
            <label class="checkline">
              <input name="abilityIds" type="checkbox" value="${ability.id}" ${selectedIds.includes(ability.id) ? "checked" : ""} />
              <span>${escapeHTML(ability.name)}</span>
            </label>
          `
        )
        .join("")}
    </div>
    <button class="btn ghost" type="button" data-action="open-abilities">管理能力</button>
  `;
}

function renderPrioritySegment(current, name) {
  return `
    <div class="segmented">
      ${["A", "B", "C"]
        .map(
          (priority) => `
            <label>
              <input type="radio" name="priority" value="${priority}" ${current === priority ? "checked" : ""} />
              ${priority}
            </label>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDeleteBigConfirm(taskId) {
  const task = findTask(taskId);
  return modalShell(`
    <h2>确认删除大任务「${escapeHTML(task?.title || "")}」吗？</h2>
    <p>该操作会删除该大任务下的所有子任务。<br>已生成的成长卡会保留在成长库中。</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="delete-big" data-task-id="${taskId}">确认删除</button>
    </div>
  `);
}

function renderDeleteSubConfirm(taskId, subTaskId) {
  const refs = findSubtask(taskId, subTaskId);
  return modalShell(`
    <h2>确认删除子任务「${escapeHTML(refs?.subtask.title || "")}」吗？</h2>
    <p>删除后，该子任务会从任务列表中移除。<br>已生成的成长卡会保留在成长库中。</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="delete-sub" data-task-id="${taskId}" data-subtask-id="${subTaskId}">确认删除</button>
    </div>
  `);
}

function renderAbandonIgniteConfirm() {
  return modalShell(`
    <h2>确定要放弃这次点火吗？</h2>
    <p>本次点火不会计入学习时间，<br>也不会生成成长卡。</p>
    <div class="button-row">
      <button class="btn primary" data-action="close-modal">继续点火</button>
      <button class="btn danger" data-action="abandon-ignite">确认放弃</button>
    </div>
  `);
}

function renderAbandonFocusConfirm() {
  return modalShell(`
    <h2>确定要放弃当前任务吗？</h2>
    <p>本次专注时间不会计入已投入时间，<br>也不会生成成长卡。</p>
    <div class="button-row">
      <button class="btn primary" data-action="close-modal">继续专注</button>
      <button class="btn danger" data-action="abandon-focus">确认放弃</button>
    </div>
  `);
}

function renderEarlyCompleteConfirm() {
  const minutes = currentSessionMinutes();
  return modalShell(`
    <h2>确认提前完成这个任务吗？</h2>
    <p>本次已专注：${minutes}分钟。<br>任务将被标记为已完成，<br>并生成完成后反馈卡。</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn success" data-action="complete-current-task">确认完成</button>
    </div>
  `);
}

function renderTimerEnded() {
  const refs = getCurrentRefs();
  const minutes = currentSessionMinutes();
  const investedAfter = (refs?.subtask.investedMinutes || 0) + minutes;
  return modalShell(`
    <h2>本次计时结束</h2>
    <p>
      当前任务：<br>
      ${escapeHTML(refs?.task.title || "")} - ${escapeHTML(refs?.subtask.title || "")}
    </p>
    <p>
      本次已专注：${minutes}分钟<br>
      累计已投入：${investedAfter}分钟 / ${refs?.subtask.estimatedMinutes || 0}分钟
    </p>
    <p>你可以选择：</p>
    <div class="choice-stack">
      <button class="btn success full" data-action="complete-current-task">标记为完成</button>
      <button class="btn secondary full" data-action="timer-edit-subtask">修改任务时间</button>
      <button class="btn full" data-action="continue-later">稍后继续</button>
    </div>
  `);
}

function renderNotice(message) {
  return modalShell(`
    <h2>提示</h2>
    <p>${escapeHTML(message).replaceAll("\n", "<br>")}</p>
    <button class="btn primary full" data-action="close-modal">知道了</button>
  `);
}

function renderFeedbackModal() {
  const card = state.growthCards.find((item) => item.id === state.latestFeedback?.cardId);
  if (!card) return "";
  const total = state.latestFeedback.total;
  const completedAfter = state.latestFeedback.completedAfter;
  return `
    <div class="modal-backdrop reward-backdrop">
      <div class="modal feedback-modal">
        <div class="feedback-modal-head">
          <div>
            <h2>🎉 任务完成</h2>
            <p>${escapeHTML(card.bigTaskTitle)} - ${escapeHTML(card.subTaskTitle)}</p>
            <p>本次投入：${formatMinutes(card.focusMinutes)}</p>
          </div>
          <button class="icon-btn close" data-action="feedback-close" aria-label="关闭">×</button>
        </div>
        <div class="feedback-modal-body">
          <section class="reward-block">
            <h3>学习进度</h3>
            <strong>${card.progressBefore}% → ${card.progressAfter}%</strong>
            <p>已完成 ${completedAfter} / ${total} 个子任务</p>
          </section>
          <section class="reward-block">
            <h3>今日成果卡已生成</h3>
            <p>你完成了「${escapeHTML(card.subTaskTitle)}」。<br>已放入成长库。</p>
          </section>
          <section class="reward-block">
            <h3>小火苗想说</h3>
            <p>${escapeHTML(card.emotionText).replaceAll("\n", "<br>")}</p>
          </section>
          <section class="reward-block quote-card">
            <h3>今日小句</h3>
            <p>“${escapeHTML(card.quoteText || "今天也已经很好了。").replaceAll("\n", "<br>")}”</p>
          </section>
        </div>
        <div class="feedback-modal-actions">
          <button class="btn primary full" data-action="feedback-view-card" data-card-id="${card.id}">查看成长卡</button>
          <button class="btn secondary full" data-action="feedback-next-task">继续下一个任务</button>
        </div>
      </div>
    </div>
  `;
}

function renderMusicBindPrompt() {
  return modalShell(`
    <h2>要开始音乐点火，先绑定你常用的音乐软件吧。</h2>
    <div class="choice-stack">
      <button class="btn primary full" data-action="go-bind-music">去绑定</button>
      <button class="btn secondary full" data-action="start-ignite-countdown">先用静音点火</button>
    </div>
  `);
}

function renderMusicBindForm() {
  const current = state.settings.musicApp || "网易云音乐";
  return modalShell(`
    <h2>绑定音乐软件</h2>
    <p>请选择你常用的音乐软件：</p>
    <form class="form" data-form="music-bind">
      <div class="radio-list">
        ${MUSIC_APPS.map(
          (appInfo) => `
            <label class="checkline">
              <input type="radio" name="musicApp" value="${escapeHTML(appInfo.name)}" ${current === appInfo.name ? "checked" : ""} />
              <span>${escapeHTML(appInfo.name)}</span>
            </label>
          `
        ).join("")}
      </div>
      <div class="button-row">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  `);
}

function renderAbilityForm(modal) {
  const editing = modal.mode === "edit";
  const ability = editing ? state.abilities.find((item) => item.id === modal.abilityId) : null;
  return modalShell(`
    <h2>${editing ? "修改能力" : "添加能力"}</h2>
    <form class="form" data-form="ability" data-mode="${modal.mode}" data-ability-id="${modal.abilityId || ""}">
      <div class="field">
        <label for="ability-name">能力名称</label>
        <input class="input" id="ability-name" name="name" value="${escapeHTML(ability?.name || "")}" placeholder="例如：表达力" required maxlength="12" />
      </div>
      <div class="button-row">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  `);
}

function renderDeleteAbilityConfirm(abilityId) {
  const ability = state.abilities.find((item) => item.id === abilityId);
  return modalShell(`
    <h2>确认删除能力「${escapeHTML(ability?.name || "")}」吗？</h2>
    <p>删除后，不会删除历史成长卡，<br>但后续任务无法再选择该能力。</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="delete-ability" data-ability-id="${abilityId}">确认删除</button>
    </div>
  `);
}

function renderRewardForm(modal) {
  const editing = modal.mode === "edit";
  const reward = editing ? state.rewards.find((item) => item.id === modal.rewardId) : null;
  const conditionType = reward?.conditionType || "completed_tasks";
  const targetMin = conditionType === "completed_tasks" ? "1" : "0.5";
  const targetStep = conditionType === "completed_tasks" ? "1" : "0.5";
  return modalShell(`
    <h2>${editing ? "修改奖励" : "添加奖励"}</h2>
    <form class="form" data-form="reward" data-mode="${modal.mode}" data-reward-id="${modal.rewardId || ""}">
      <div class="field">
        <label for="reward-name">奖励名称</label>
        <input class="input" id="reward-name" name="name" value="${escapeHTML(reward?.name || "")}" placeholder="周末咖啡" required maxlength="16" />
      </div>
      <div class="field">
        <label for="reward-icon">奖励图标</label>
        <input class="input" id="reward-icon" name="icon" value="${escapeHTML(reward?.icon || "☕")}" maxlength="4" />
      </div>
      <div class="field">
        <span class="label">解锁条件</span>
        <div class="radio-list">
          <label class="checkline">
            <input type="radio" name="conditionType" value="completed_tasks" ${conditionType === "completed_tasks" ? "checked" : ""} />
            <span>完成任务次数</span>
          </label>
          <label class="checkline">
            <input type="radio" name="conditionType" value="focus_hours" ${conditionType === "focus_hours" ? "checked" : ""} />
            <span>累计专注时长</span>
          </label>
        </div>
      </div>
      <div class="field">
        <label for="reward-target">目标数量</label>
        <input class="input" id="reward-target" name="targetValue" type="number" min="${targetMin}" step="${targetStep}" value="${reward?.targetValue || 1}" required />
      </div>
      <p class="meta">如果是任务次数，单位=次；如果是累计专注时长，单位=小时。</p>
      <div class="button-row">
        <button class="btn" type="button" data-action="close-modal">取消</button>
        <button class="btn primary" type="submit">保存</button>
      </div>
    </form>
  `);
}

function renderDeleteRewardConfirm(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  const isUnlocked = reward?.status === "unlocked";
  return modalShell(`
    <h2>${isUnlocked ? "确认删除这个已解锁奖励吗？" : `确认删除奖励「${escapeHTML(reward?.name || "")}」吗？`}</h2>
    <p>${
      isUnlocked
        ? "删除后，该奖励将从列表中移除。<br>已消耗的兑换资源不会返还。"
        : "删除后，该奖励进度会从列表中移除。"
    }</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="delete-reward" data-reward-id="${rewardId}">确认删除</button>
    </div>
  `);
}

function renderRewardRedeemableModal() {
  const reward = state.pendingRedeemableRewards[0];
  if (!reward) return "";
  return `
    <div class="modal-backdrop reward-backdrop">
      <div class="modal reward-pop">
        <h2>🎉 奖励可兑换</h2>
        <p>你已经满足：</p>
        <strong>${escapeHTML(reward.icon || "🎁")} ${escapeHTML(reward.name)}</strong>
        <p>现在可以兑换这个奖励了。</p>
        <div class="button-row">
          <button class="btn" data-action="dismiss-redeemable">稍后再说</button>
          <button class="btn primary" data-action="redeem-reward" data-reward-id="${reward.id}">立即兑换</button>
        </div>
      </div>
    </div>
  `;
}

function renderRewardUnlockedModal() {
  const rewards = state.pendingUnlockedRewards || [];
  const reward = rewards[0];
  return `
    <div class="modal-backdrop reward-backdrop">
      <div class="modal reward-pop">
    <h2>✨ 奖励已解锁</h2>
    <p>你解锁了：</p>
    <div class="mini-stack">
      ${rewards.map((reward) => `<strong>${escapeHTML(reward.icon || "🎁")} ${escapeHTML(reward.name)}</strong>`).join("")}
    </div>
    <p>这是你认真推进生活的一点小回礼。<br>记得去兑现它哦。</p>
    <div class="button-row">
      <button class="btn primary" data-action="dismiss-reward-unlocked">知道了</button>
      <button class="btn secondary" data-action="view-unlocked-reward-detail" data-reward-id="${reward?.id || ""}">查看详情</button>
    </div>
      </div>
    </div>
  `;
}

function renderDeleteGrowthCardsConfirm() {
  return modalShell(`
    <h2>确认删除选中的成长卡吗？</h2>
    <p>删除后，这些成长卡会从成长库移除。</p>
    <div class="button-row">
      <button class="btn" data-action="close-modal">取消</button>
      <button class="btn danger" data-action="delete-selected-growth-cards">确认删除</button>
    </div>
  `);
}

function lowEnergyCandidates() {
  return state.bigTasks.flatMap((task) =>
    task.subtasks
      .filter((subtask) => subtask.isLowEnergy && subtask.status !== "completed")
      .map((subtask) => ({ task, subtask }))
  );
}

function tick() {
  checkTaskReminders();

  if (state.igniteStage === "countdown") {
    if (state.igniteRemaining > 1) {
      state.igniteRemaining -= 1;
    } else {
      state.igniteRemaining = 0;
      state.igniteStage = "success";
      state.hasIgnited = true;
    }
    render();
    return;
  }

  if (state.igniteStage === "focus" && state.focus && !state.focus.paused && !state.modal) {
    if (state.focus.remainingSeconds > 1) {
      state.focus.remainingSeconds -= 1;
    } else {
      state.focus.remainingSeconds = 0;
      state.focus.paused = true;
      state.modal = { type: "timer-ended" };
    }
    render();
  }
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const taskId = button.dataset.taskId;
  const subTaskId = button.dataset.subtaskId;
  const cardId = button.dataset.cardId;
  const abilityId = button.dataset.abilityId;
  const rewardId = button.dataset.rewardId;

  if (action === "tab") {
    state.activeTab = button.dataset.tab;
    if (state.activeTab === "tasks") state.taskView = "home";
    if (state.activeTab !== "me") state.selectedGrowthCardId = null;
    if (state.activeTab === "me") {
      state.meView = "home";
      state.selectedGrowthCardId = null;
    }
    if (state.activeTab === "ignite" && !getCurrentRefs() && !["feedback", "lowEnergy"].includes(state.igniteStage)) {
      state.igniteStage = "empty";
    }
    state.modal = null;
  }

  if (action === "open-create-sheet") state.modal = { type: "create-sheet" };
  if (action === "close-modal") state.modal = null;
  if (action === "open-choose-big") state.modal = { type: "choose-big" };
  if (action === "open-big-form-create") state.modal = { type: "big-form", mode: "create" };
  if (action === "open-big-form-edit") state.modal = { type: "big-form", mode: "edit", taskId };
  if (action === "open-sub-form-create") state.modal = { type: "sub-form", mode: "create", taskId };
  if (action === "open-sub-form-edit") state.modal = { type: "sub-form", mode: "edit", taskId, subTaskId };
  if (action === "confirm-delete-big") state.modal = { type: "delete-big", taskId };
  if (action === "confirm-delete-sub") state.modal = { type: "delete-sub", taskId, subTaskId };

  if (action === "toggle-expand") toggleExpanded(taskId);
  if (action === "delete-big") deleteBigTask(taskId);
  if (action === "delete-sub") deleteSubtask(taskId, subTaskId);
  if (action === "select-subtask") selectSubtask(taskId, subTaskId);

  if (action === "choose-music") chooseMusicIgnite();
  if (action === "music-app-notice") attemptOpenMusicApp();
  if (action === "open-bound-music") attemptOpenMusicApp();
  if (action === "go-bind-music") state.modal = { type: "music-bind" };
  if (action === "start-ignite-countdown") startIgniteCountdown();
  if (action === "skip-ignite") startFocus(remainingFocusMinutes(getCurrentRefs().subtask), false);
  if (action === "confirm-abandon-ignite") state.modal = { type: "abandon-ignite" };
  if (action === "abandon-ignite") abandonIgnite();
  if (action === "start-focus-five") startFocus(5, true);
  if (action === "start-focus-full") startFocus(remainingFocusMinutes(getCurrentRefs().subtask), true);
  if (action === "only-ignite") onlyIgnite();
  if (action === "open-low-energy") openLowEnergy();
  if (action === "next-low-energy") nextLowEnergy();
  if (action === "use-low-energy") useLowEnergy(taskId, subTaskId);
  if (action === "back-to-ready") backToReady();

  if (action === "pause-focus") state.focus.paused = true;
  if (action === "resume-focus") state.focus.paused = false;
  if (action === "confirm-early-complete") {
    state.modal = { type: "early-complete" };
  }
  if (action === "confirm-abandon-focus") {
    state.modal = { type: "abandon-focus" };
  }
  if (action === "abandon-focus") abandonFocus();
  if (action === "complete-current-task") completeCurrentTask();
  if (action === "continue-later") continueLater();
  if (action === "timer-edit-subtask") timerEditSubtask();

  if (action === "feedback-back-tasks") backToTasksFromFeedback();
  if (action === "reopen-feedback") state.modal = { type: "feedback" };
  if (action === "feedback-close") closeFeedbackModal("tasks");
  if (action === "feedback-view-card") closeFeedbackModal("card", cardId);
  if (action === "feedback-next-task") closeFeedbackModal("tasks");
  if (action === "open-card-detail") openGrowthCardDetail(cardId);
  if (action === "back-growth-library") {
    state.selectedGrowthCardId = null;
    state.activeTab = "me";
    state.meView = "growthLibrary";
  }
  if (action === "open-task-progress") openTaskFromProfile(taskId);
  if (action === "open-settings") {
    state.activeTab = "me";
    state.meView = "settings";
  }
  if (action === "back-me-home") {
    state.activeTab = "me";
    state.meView = "home";
    state.selectedGrowthCardId = null;
  }
  if (action === "toggle-profile-progress") state.profileProgressExpanded = !state.profileProgressExpanded;
  if (action === "toggle-ability-preview") state.abilityPreviewExpanded = !state.abilityPreviewExpanded;
  if (action === "open-growth-library") {
    state.activeTab = "me";
    state.meView = "growthLibrary";
  }
  if (action === "open-abilities") {
    state.activeTab = "me";
    state.meView = "abilities";
    state.modal = null;
  }
  if (action === "open-rewards") {
    state.activeTab = "me";
    state.meView = "rewards";
    state.modal = null;
  }
  if (action === "open-music-bind") state.modal = { type: "music-bind" };
  if (action === "floating-window-notice") {
    state.modal = {
      type: "notice",
      message: "当前 Web 版本暂不支持直接开启系统悬浮窗。\n\n如果后续打包成 Android App，\n可以在这里跳转系统设置并开启悬浮窗权限。"
    };
  }
  if (action === "request-notification") requestNotificationPermission();
  if (action === "clear-start-time") {
    clearStartTime(button);
    return;
  }

  if (action === "open-ability-form-create") state.modal = { type: "ability-form", mode: "create" };
  if (action === "open-ability-form-edit") state.modal = { type: "ability-form", mode: "edit", abilityId };
  if (action === "confirm-delete-ability") state.modal = { type: "delete-ability", abilityId };
  if (action === "delete-ability") deleteAbility(abilityId);
  if (action === "move-ability-up") moveAbility(abilityId, -1);
  if (action === "move-ability-down") moveAbility(abilityId, 1);

  if (action === "open-reward-form-create") state.modal = { type: "reward-form", mode: "create" };
  if (action === "open-reward-form-edit") state.modal = { type: "reward-form", mode: "edit", rewardId };
  if (action === "confirm-delete-reward") state.modal = { type: "delete-reward", rewardId };
  if (action === "delete-reward") deleteReward(rewardId);
  if (action === "dismiss-reward-unlocked") dismissRewardUnlocked(false);
  if (action === "view-unlocked-reward-detail") viewUnlockedRewardDetail(rewardId);
  if (action === "dismiss-redeemable") dismissRedeemableReward();
  if (action === "redeem-reward") redeemReward(rewardId);
  if (action === "open-reward-detail") openRewardDetail(rewardId);
  if (action === "toggle-growth-manage") toggleGrowthManage();
  if (action === "toggle-growth-select") toggleGrowthSelect(cardId);
  if (action === "confirm-delete-growth-cards") state.modal = { type: "delete-growth-cards" };
  if (action === "delete-selected-growth-cards") deleteSelectedGrowthCards();

  render();
});

app.addEventListener("submit", (event) => {
  const form = event.target.closest("form");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "big-task") saveBigTaskForm(form);
  if (form.dataset.form === "sub-task") saveSubtaskForm(form);
  if (form.dataset.form === "music-bind") saveMusicBindForm(form);
  if (form.dataset.form === "ability") saveAbilityForm(form);
  if (form.dataset.form === "reward") saveRewardForm(form);
  render();
});

app.addEventListener("change", (event) => {
  const input = event.target.closest('input[name="conditionType"]');
  if (!input) return;
  const form = input.closest("form");
  const target = form?.querySelector('input[name="targetValue"]');
  if (!target) return;
  if (input.value === "completed_tasks") {
    target.min = "1";
    target.step = "1";
    if (!Number.isInteger(Number(target.value)) || Number(target.value) < 1) target.value = "1";
  } else {
    target.min = "0.5";
    target.step = "0.5";
    if (Number(target.value) < 0.5) target.value = "0.5";
  }
});

function toggleExpanded(taskId) {
  if (state.expandedTaskIds.includes(taskId)) {
    state.expandedTaskIds = state.expandedTaskIds.filter((id) => id !== taskId);
  } else {
    state.expandedTaskIds = [...state.expandedTaskIds, taskId];
  }
}

function saveBigTaskForm(form) {
  const data = new FormData(form);
  const mode = form.dataset.mode;
  const title = data.get("title").trim();
  if (!title) return;

  if (mode === "edit") {
    const task = findTask(form.dataset.taskId);
    if (task) {
      task.title = title;
      task.priority = data.get("priority");
      task.deadline = data.get("deadline") || "";
      task.description = data.get("description") || "";
      task.updatedAt = nowISO();
    }
  } else {
    const id = uid("big");
    state.bigTasks.unshift({
      id,
      title,
      priority: data.get("priority"),
      deadline: data.get("deadline") || "",
      description: data.get("description") || "",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      subtasks: []
    });
    state.expandedTaskIds = [id, ...state.expandedTaskIds];
  }
  state.modal = null;
  saveData();
}

function saveSubtaskForm(form) {
  const data = new FormData(form);
  const mode = form.dataset.mode;
  const task = findTask(form.dataset.taskId);
  const title = data.get("title").trim();
  const estimatedMinutes = Math.max(1, Number(data.get("estimatedMinutes")) || 15);
  const startTime = data.get("startTime") || "";
  const startDate = startTime ? data.get("startDate") || todayInputValue() : "";
  const abilityIds = data.getAll("abilityIds");
  if (!task || !title) return;

  if (mode === "edit") {
    const subtask = task.subtasks.find((item) => item.id === form.dataset.subtaskId);
    if (subtask) {
      subtask.title = title;
      subtask.estimatedMinutes = estimatedMinutes;
      subtask.priority = data.get("priority");
      subtask.startDate = startDate;
      subtask.startTime = startTime;
      subtask.isLowEnergy = data.has("isLowEnergy");
      subtask.abilityIds = abilityIds;
      subtask.updatedAt = nowISO();
    }
  } else {
    task.subtasks.push({
      id: uid("sub"),
      parentTaskId: task.id,
      title,
      estimatedMinutes,
      investedMinutes: 0,
      priority: data.get("priority"),
      startDate,
      startTime,
      isLowEnergy: data.has("isLowEnergy"),
      abilityIds,
      startAction: "",
      status: "not_started",
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }

  task.updatedAt = nowISO();
  if (!state.expandedTaskIds.includes(task.id)) state.expandedTaskIds.push(task.id);
  const afterTimer = form.dataset.afterTimer === "true";
  state.modal = null;
  if (afterTimer) {
    state.activeTab = "tasks";
    state.igniteStage = "pre";
    state.focus = null;
  }
  saveData();
}

function saveMusicBindForm(form) {
  const data = new FormData(form);
  state.settings.musicApp = data.get("musicApp") || "";
  state.modal = null;
  saveData();
}

function saveAbilityForm(form) {
  const data = new FormData(form);
  const mode = form.dataset.mode;
  const name = (data.get("name") || "").trim();
  if (!name) return;

  if (mode === "edit") {
    const ability = state.abilities.find((item) => item.id === form.dataset.abilityId);
    if (ability) {
      ability.name = name;
      ability.updatedAt = nowISO();
    }
  } else {
    if (state.abilities.length >= 10) {
      state.modal = { type: "notice", message: "最多只能创建 10 个能力方向。" };
      return;
    }
    state.abilities.push({
      id: uid("ability"),
      name,
      totalMinutes: 0,
      sortOrder: state.abilities.length,
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }
  state.modal = null;
  saveData();
}

function deleteAbility(abilityId) {
  state.abilities = state.abilities.filter((ability) => ability.id !== abilityId);
  state.bigTasks.forEach((task) => {
    task.subtasks.forEach((subtask) => {
      subtask.abilityIds = (subtask.abilityIds || []).filter((id) => id !== abilityId);
    });
  });
  state.abilities.forEach((ability, index) => {
    ability.sortOrder = index;
  });
  state.modal = null;
  saveData();
}

function moveAbility(abilityId, direction) {
  const sorted = sortedAbilities();
  const index = sorted.findIndex((ability) => ability.id === abilityId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= sorted.length) return;
  const [item] = sorted.splice(index, 1);
  sorted.splice(nextIndex, 0, item);
  sorted.forEach((ability, order) => {
    const original = state.abilities.find((item) => item.id === ability.id);
    if (original) original.sortOrder = order;
  });
  saveData();
}

function saveRewardForm(form) {
  const data = new FormData(form);
  const mode = form.dataset.mode;
  const name = (data.get("name") || "").trim();
  const icon = (data.get("icon") || "🎁").trim() || "🎁";
  const conditionType = data.get("conditionType") || "completed_tasks";
  const rawTarget = Number(data.get("targetValue"));
  if (!Number.isFinite(rawTarget)) {
    state.modal = { type: "notice", message: "请输入合法的目标数量。" };
    return;
  }
  if (conditionType === "completed_tasks" && (!Number.isInteger(rawTarget) || rawTarget < 1)) {
    state.modal = { type: "notice", message: "完成任务次数必须是大于等于 1 的整数。" };
    return;
  }
  if (conditionType === "focus_hours" && (rawTarget < 0.5 || Math.round(rawTarget * 2) !== rawTarget * 2)) {
    state.modal = { type: "notice", message: "累计专注时长必须是 0.5 小时的倍数，且不少于 0.5 小时。" };
    return;
  }
  const targetValue = conditionType === "completed_tasks" ? Math.floor(rawTarget) : rawTarget;
  if (!name) return;

  if (mode === "edit") {
    const reward = state.rewards.find((item) => item.id === form.dataset.rewardId);
    if (reward) {
      reward.name = name;
      reward.icon = icon;
      reward.conditionType = conditionType;
      reward.targetValue = targetValue;
      reward.updatedAt = nowISO();
      if (reward.status !== "unlocked") {
        reward.status = "in_progress";
      }
    }
  } else {
    state.rewards.push({
      id: uid("reward"),
      name,
      icon,
      conditionType,
      targetValue,
      currentValue: 0,
      status: "in_progress",
      createdAt: nowISO(),
      updatedAt: nowISO()
    });
  }
  recalculateRewards();
  state.modal = null;
  saveData();
}

function deleteReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (reward?.status === "unlocked") {
    reward.deleted = true;
    reward.updatedAt = nowISO();
  } else {
    state.rewards = state.rewards.filter((reward) => reward.id !== rewardId);
  }
  recalculateRewards();
  state.modal = null;
  saveData();
}

function redeemReward(rewardId) {
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward || reward.deleted) return;
  recalculateRewards();
  if (reward.status !== "redeemable") {
    state.modal = { type: "notice", message: "当前可兑换资源不足，还不能兑换这个奖励。" };
    return;
  }

  const now = nowISO();
  if (reward.conditionType === "completed_tasks") {
    const target = Math.floor(reward.targetValue);
    const tasksToUse = availableCompletedTasks().slice(0, target);
    if (tasksToUse.length < target) {
      state.modal = { type: "notice", message: "当前可兑换任务次数不足。" };
      return;
    }
    reward.redemption = {
      redeemedAt: now,
      taskIds: tasksToUse.map((task) => task.id)
    };
  } else {
    let needed = Math.round(Number(reward.targetValue) * 60);
    const targetMinutes = needed;
    const focusContributions = [];
    for (const task of availableFocusRecords()) {
      if (needed <= 0) break;
      const minutesUsed = Math.min(task.remainingMinutes, needed);
      focusContributions.push({
        taskId: task.id,
        taskTitle: task.title,
        bigTaskTitle: task.bigTaskTitle,
        minutesUsed
      });
      needed -= minutesUsed;
    }
    if (needed > 0) {
      state.modal = { type: "notice", message: "当前可兑换专注时长不足。" };
      return;
    }
    reward.redemption = {
      redeemedAt: now,
      focusContributions,
      totalRedeemedMinutes: targetMinutes
    };
  }

  reward.status = "unlocked";
  reward.unlockedAt = now;
  reward.updatedAt = now;
  state.pendingRedeemableRewards = state.pendingRedeemableRewards.filter((item) => item.id !== reward.id);
  state.pendingUnlockedRewards = [reward];
  recalculateRewards();
  state.modal = { type: "reward-unlocked" };
  saveData();
}

function deleteBigTask(taskId) {
  state.bigTasks = state.bigTasks.filter((task) => task.id !== taskId);
  state.expandedTaskIds = state.expandedTaskIds.filter((id) => id !== taskId);
  if (state.current?.bigTaskId === taskId) resetCurrentTask();
  state.modal = null;
  saveData();
}

function deleteSubtask(taskId, subTaskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.subtasks = task.subtasks.filter((subtask) => subtask.id !== subTaskId);
  task.updatedAt = nowISO();
  if (state.current?.bigTaskId === taskId && state.current?.subTaskId === subTaskId) resetCurrentTask();
  state.modal = null;
  saveData();
}

function selectSubtask(taskId, subTaskId) {
  const refs = findSubtask(taskId, subTaskId);
  if (!refs || refs.subtask.status === "completed") return;
  state.current = { bigTaskId: taskId, subTaskId };
  state.activeTab = "ignite";
  state.igniteStage = "pre";
  state.hasIgnited = false;
  state.focus = null;
  state.modal = null;
}

function startIgniteCountdown() {
  const refs = getCurrentRefs();
  if (!refs) return;
  state.igniteStage = "countdown";
  state.hasIgnited = true;
  state.igniteRemaining = IGNITE_SECONDS;
  state.microAction = refs.subtask.startAction || MICRO_ACTIONS[Math.floor(Math.random() * MICRO_ACTIONS.length)];
  state.modal = null;
}

function abandonIgnite() {
  state.igniteRemaining = IGNITE_SECONDS;
  state.igniteStage = "pre";
  state.hasIgnited = false;
  state.modal = null;
}

function onlyIgnite() {
  state.igniteStage = "pre";
  state.hasIgnited = false;
  state.focus = null;
  state.activeTab = "tasks";
}

function startFocus(minutes, hasIgnited) {
  const refs = getCurrentRefs();
  if (!refs) return;
  const totalSeconds = Math.max(1, Number(minutes) || 5) * 60;
  const previousStatus = refs.subtask.status;
  const previousStartedAt = refs.subtask.startedAt || "";
  if (refs.subtask.status !== "completed") {
    refs.subtask.status = "in_progress";
    refs.subtask.startedAt = refs.subtask.startedAt || nowISO();
    refs.subtask.updatedAt = nowISO();
  }
  state.igniteStage = "focus";
  state.hasIgnited = hasIgnited;
  state.focus = {
    plannedSeconds: totalSeconds,
    remainingSeconds: totalSeconds,
    paused: false,
    hasIgnited,
    previousStatus,
    previousStartedAt
  };
  state.modal = null;
  saveData();
}

function abandonFocus() {
  const refs = getCurrentRefs();
  if (refs && state.focus) {
    refs.subtask.status = state.focus.previousStatus || "not_started";
    if (state.focus.previousStartedAt) {
      refs.subtask.startedAt = state.focus.previousStartedAt;
    } else {
      delete refs.subtask.startedAt;
    }
    refs.subtask.updatedAt = nowISO();
    refs.task.updatedAt = nowISO();
    saveData();
  }
  state.focus = null;
  state.igniteStage = "pre";
  state.modal = null;
  state.activeTab = "tasks";
}

function currentSessionMinutes() {
  if (!state.focus) return 0;
  const elapsed = state.focus.plannedSeconds - state.focus.remainingSeconds;
  if (elapsed <= 0) return 1;
  return Math.max(1, Math.ceil(elapsed / 60));
}

function completeCurrentTask() {
  const result = commitCurrentSession(true);
  if (!result) return;
  state.focus = null;
  state.pendingRedeemableRewards = result.redeemableRewards || [];
  state.modal = { type: "feedback" };
  state.igniteStage = "feedback";
  state.activeTab = "ignite";
  state.latestFeedback = {
    cardId: result.card.id,
    total: result.total,
    completedAfter: result.completedAfter
  };
  saveData();
}

function continueLater() {
  commitCurrentSession(false);
  state.focus = null;
  state.modal = null;
  state.igniteStage = "pre";
  state.activeTab = "tasks";
  saveData();
}

function timerEditSubtask() {
  const refs = getCurrentRefs();
  if (!refs) return;
  commitCurrentSession(false);
  state.focus = null;
  state.modal = {
    type: "sub-form",
    mode: "edit",
    taskId: refs.task.id,
    subTaskId: refs.subtask.id,
    afterTimer: true
  };
  saveData();
}

function commitCurrentSession(markCompleted) {
  const refs = getCurrentRefs();
  if (!refs || !state.focus) return null;

  const task = refs.task;
  const subtask = refs.subtask;
  const minutes = currentSessionMinutes();
  const before = progressOf(task);
  subtask.investedMinutes += minutes;
  subtask.status = markCompleted ? "completed" : "in_progress";
  subtask.startedAt = subtask.startedAt || nowISO();
  subtask.updatedAt = nowISO();
  if (markCompleted) subtask.completedAt = nowISO();
  task.updatedAt = nowISO();

  if (!markCompleted) return { minutes };

  const after = progressOf(task);
  const resultText = `今日成果卡已生成。\n你完成了：「${subtask.title}」\n本次投入：${formatMinutes(minutes)}\n已放入成长库。`;
  const emotionText = state.focus.hasIgnited
    ? `今天你不仅点燃了小火苗，\n还坚持了${formatMinutes(minutes)}，\n真的很棒！`
    : `今天你不仅开始了这个任务，\n还坚持了${formatMinutes(minutes)}，\n真的很棒！`;
  const card = {
    id: uid("card"),
    date: shortDate(),
    bigTaskId: task.id,
    bigTaskTitle: task.title,
    subTaskId: subtask.id,
    subTaskTitle: subtask.title,
    focusMinutes: minutes,
    abilityIds: Array.isArray(subtask.abilityIds) ? [...subtask.abilityIds] : [],
    progressBefore: before.percent,
    progressAfter: after.percent,
    resultText,
    emotionText,
    quoteText: pickQuote(),
    createdAt: nowISO()
  };
  state.growthCards.push(card);
  (subtask.abilityIds || []).forEach((abilityId) => {
    const ability = state.abilities.find((item) => item.id === abilityId);
    if (ability) {
      ability.totalMinutes += minutes;
      ability.updatedAt = nowISO();
    }
  });
  const redeemableRewards = recalculateRewards();
  return {
    card,
    total: after.total,
    completedAfter: after.completed,
    redeemableRewards
  };
}

function resetCurrentTask() {
  state.current = null;
  state.focus = null;
  state.igniteStage = "empty";
  state.hasIgnited = false;
  state.igniteRemaining = IGNITE_SECONDS;
}

function chooseMusicIgnite() {
  if (!state.settings.musicApp) {
    state.modal = { type: "music-bind-prompt" };
    return;
  }
  attemptOpenMusicApp();
  state.igniteStage = "music";
}

function attemptOpenMusicApp() {
  const musicApp = MUSIC_APPS.find((item) => item.name === state.settings.musicApp);
  state.igniteStage = "music";
  if (musicApp?.scheme) {
    try {
      window.location.href = musicApp.scheme;
    } catch {
      state.modal = { type: "notice", message: "请手动打开音乐软件。" };
    }
  } else {
    state.modal = { type: "notice", message: "请手动打开音乐软件。" };
  }
}

function clearStartTime(button) {
  const field = button.closest(".field");
  if (!field) return;
  const dateInput = field.querySelector('input[name="startDate"]');
  const timeInput = field.querySelector('input[name="startTime"]');
  if (dateInput) dateInput.value = "";
  if (timeInput) timeInput.value = "";
}

function closeFeedbackModal(destination) {
  const cardId = state.latestFeedback?.cardId;
  const hasRedeemableRewards = state.pendingRedeemableRewards.length > 0;
  state.modal = hasRedeemableRewards ? { type: "reward-redeemable" } : null;
  if (destination === "card" && !hasRedeemableRewards) {
    openGrowthCardDetail(cardId);
    return;
  }
  if (destination === "card" && hasRedeemableRewards) {
    state.latestFeedback.destinationAfterReward = { type: "card", cardId };
    return;
  }
  if (!hasRedeemableRewards) backToTasksFromFeedback();
}

function dismissRewardUnlocked(openRewards) {
  const destination = state.latestFeedback?.destinationAfterReward;
  state.pendingUnlockedRewards = [];
  state.modal = null;
  if (!state.latestFeedback) {
    state.activeTab = "me";
    state.meView = openRewards ? "rewards" : "rewards";
    return;
  }
  if (openRewards) {
    resetCurrentTask();
    state.latestFeedback = null;
    state.activeTab = "me";
    state.meView = "rewards";
    return;
  }
  if (destination?.type === "card") {
    openGrowthCardDetail(destination.cardId);
    return;
  }
  backToTasksFromFeedback();
}

function dismissRedeemableReward() {
  const destination = state.latestFeedback?.destinationAfterReward;
  state.pendingRedeemableRewards = [];
  state.modal = null;
  if (destination?.type === "card") {
    openGrowthCardDetail(destination.cardId);
    return;
  }
  backToTasksFromFeedback();
}

function viewUnlockedRewardDetail(rewardId) {
  state.pendingUnlockedRewards = [];
  state.pendingRedeemableRewards = [];
  state.modal = null;
  resetCurrentTask();
  state.latestFeedback = null;
  openRewardDetail(rewardId);
}

function openRewardDetail(rewardId) {
  state.selectedRewardId = rewardId;
  state.activeTab = "me";
  state.meView = "rewardDetail";
  state.modal = null;
}

function toggleGrowthManage() {
  state.growthManageMode = !state.growthManageMode;
  if (!state.growthManageMode) state.selectedGrowthCardIds = [];
}

function toggleGrowthSelect(cardId) {
  if (state.selectedGrowthCardIds.includes(cardId)) {
    state.selectedGrowthCardIds = state.selectedGrowthCardIds.filter((id) => id !== cardId);
  } else {
    state.selectedGrowthCardIds = [...state.selectedGrowthCardIds, cardId];
  }
}

function deleteSelectedGrowthCards() {
  const selected = new Set(state.selectedGrowthCardIds);
  state.growthCards = state.growthCards.filter((card) => !selected.has(card.id));
  state.selectedGrowthCardIds = [];
  state.growthManageMode = false;
  state.modal = null;
  saveData();
}

function requestNotificationPermission() {
  if (typeof Notification === "undefined") {
    state.settings.notificationPermission = "unsupported";
    state.modal = { type: "notice", message: "当前浏览器暂不支持网页通知。" };
    saveData();
    return;
  }

  Notification.requestPermission().then((permission) => {
    state.settings.notificationPermission = permission;
    if (permission === "granted") {
      state.modal = { type: "notice", message: "通知权限已开启。\n小火苗会在任务开始前 5 分钟提醒你。" };
    } else {
      state.modal = { type: "notice", message: "通知权限未开启。\n你可以在浏览器设置中重新允许通知。" };
    }
    saveData();
    render();
  });
}

function checkTaskReminders() {
  const now = Date.now();
  state.bigTasks.forEach((task) => {
    task.subtasks.forEach((subtask) => {
      if (!subtask.startDate || !subtask.startTime || subtask.status === "completed") return;
      const reminderId = `${subtask.id}-${subtask.startDate}-${subtask.startTime}`;
      if (state.reminderSentIds.includes(reminderId)) return;
      const start = new Date(`${subtask.startDate}T${subtask.startTime}:00`).getTime();
      if (Number.isNaN(start)) return;
      const reminderAt = start - 5 * 60 * 1000;
      if (now < reminderAt || now > start + 60 * 1000) return;
      state.reminderSentIds.push(reminderId);
      showTaskReminder(task, subtask);
    });
  });
}

function showTaskReminder(task, subtask) {
  const message = "你是否想要听一首歌并点燃小火苗？";
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    const notification = new Notification("小火苗", { body: message });
    notification.onclick = () => {
      window.focus();
      selectSubtask(task.id, subtask.id);
      render();
    };
    return;
  }
  state.modal = { type: "notice", message };
}

function openLowEnergy() {
  state.lowEnergyIndex = 0;
  state.igniteStage = "lowEnergy";
  state.modal = null;
}

function nextLowEnergy() {
  const candidates = lowEnergyCandidates();
  if (candidates.length === 0) return;
  state.lowEnergyIndex = (state.lowEnergyIndex + 1) % candidates.length;
}

function useLowEnergy(taskId, subTaskId) {
  selectSubtask(taskId, subTaskId);
}

function backToReady() {
  state.igniteStage = getCurrentRefs() ? "pre" : "empty";
}

function backToTasksFromFeedback() {
  resetCurrentTask();
  state.latestFeedback = null;
  state.activeTab = "tasks";
}

function openGrowthCardDetail(cardId) {
  state.selectedGrowthCardId = cardId;
  state.activeTab = "me";
  state.meView = "growthLibrary";
  state.modal = null;
  if (state.igniteStage === "feedback") {
    resetCurrentTask();
    state.latestFeedback = null;
  }
}

function openTaskFromProfile(taskId) {
  state.activeTab = "tasks";
  state.selectedGrowthCardId = null;
  if (!state.expandedTaskIds.includes(taskId)) state.expandedTaskIds.push(taskId);
}
