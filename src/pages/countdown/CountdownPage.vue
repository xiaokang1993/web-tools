<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'

type TimerMode = 'stopwatch' | 'countdown'
type TimerStatus = 'stopped' | 'running' | 'paused'

interface LapRecord {
  index: number
  elapsed: number
  diff: number
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

function statusClassOf(status: TimerStatus): string {
  if (status === 'running') return 'status-running'
  if (status === 'paused') return 'status-paused'
  return 'status-stopped'
}

// ===== 当前时间显示 =====
const currentTimeText = ref('00:00:00')
const currentDateText = ref('')
let clockTimer: ReturnType<typeof setInterval> | undefined

function refreshClock(): void {
  const now = new Date()
  currentTimeText.value = formatHMS(now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
  currentDateText.value = `${now.getFullYear()}年${pad2(now.getMonth() + 1)}月${pad2(now.getDate())}日 ${WEEKDAYS[now.getDay()]}`
}

// ===== 正向计时器 (Stopwatch) =====
const swElapsed = ref(0) // 已计秒数
const swRunning = ref(false)
let swTimer: ReturnType<typeof setInterval> | undefined

const swStatus = computed<TimerStatus>(() => {
  if (swRunning.value) return 'running'
  return swElapsed.value > 0 ? 'paused' : 'stopped'
})

const swDisplay = computed(() => formatHMS(swElapsed.value))

const laps = ref<LapRecord[]>([])
const lastLapElapsed = ref(0)

function stopwatchStart(): void {
  if (swRunning.value) return
  swRunning.value = true
  swTimer = setInterval(() => {
    swElapsed.value++
  }, 1000)
}

function stopwatchPause(): void {
  if (!swRunning.value) return
  swRunning.value = false
  clearInterval(swTimer)
}

function stopwatchReset(): void {
  swRunning.value = false
  clearInterval(swTimer)
  swElapsed.value = 0
  lastLapElapsed.value = 0
  laps.value = []
}

function stopwatchLap(): void {
  // 记录当前圈：本次与上一圈的差值
  const elapsed = swElapsed.value
  const diff = elapsed - lastLapElapsed.value
  if (diff <= 0) return
  laps.value.unshift({
    index: laps.value.length + 1,
    elapsed,
    diff
  })
  lastLapElapsed.value = elapsed
}

// ===== 倒计时器 (Countdown) =====
const cdHours = ref(0)
const cdMinutes = ref(5)
const cdSeconds = ref(0)
const cdTotal = ref(300) // 设定总秒数
const cdCurrent = ref(300) // 剩余秒数
const cdRunning = ref(false)
let cdTimer: ReturnType<typeof setInterval> | undefined

const cdStatus = computed<TimerStatus>(() => {
  if (cdRunning.value) return 'running'
  if (cdCurrent.value > 0 && cdCurrent.value < cdTotal.value) return 'paused'
  if (cdCurrent.value <= 0 && cdTotal.value > 0) return 'stopped'
  return 'stopped'
})

const cdStatusText = computed(() => {
  if (cdRunning.value) return '倒计时中'
  if (cdCurrent.value > 0 && cdCurrent.value < cdTotal.value) return '已暂停'
  if (cdCurrent.value <= 0 && cdTotal.value > 0) return '时间到！'
  return '已停止'
})

const swStatusText = computed(() => {
  if (swRunning.value) return '运行中'
  return swElapsed.value > 0 ? '已暂停' : '已停止'
})

const cdDisplay = computed(() => formatHMS(cdCurrent.value))
const cdCompleted = computed(() => cdCurrent.value <= 0 && cdTotal.value > 0)

function applyCountdownInputs(): void {
  if (cdRunning.value) return
  const h = Math.max(0, Math.min(23, Number(cdHours.value) || 0))
  const m = Math.max(0, Math.min(59, Number(cdMinutes.value) || 0))
  const s = Math.max(0, Math.min(59, Number(cdSeconds.value) || 0))
  cdHours.value = h
  cdMinutes.value = m
  cdSeconds.value = s
  cdTotal.value = h * 3600 + m * 60 + s
  cdCurrent.value = cdTotal.value
}

function countdownSet(): void {
  if (cdRunning.value) return
  applyCountdownInputs()
}

function countdownStart(): void {
  if (cdRunning.value) return
  if (cdCurrent.value <= 0) return
  cdRunning.value = true
  cdTimer = setInterval(() => {
    cdCurrent.value--
    if (cdCurrent.value <= 0) {
      cdRunning.value = false
      clearInterval(cdTimer)
      onCountdownComplete()
    }
  }, 1000)
}

function countdownPause(): void {
  if (!cdRunning.value) return
  cdRunning.value = false
  clearInterval(cdTimer)
}

function countdownReset(): void {
  cdRunning.value = false
  clearInterval(cdTimer)
  cdCurrent.value = cdTotal.value
}

// 倒计时预设
const PRESETS = [
  { label: '1 分钟', seconds: 60 },
  { label: '5 分钟', seconds: 300 },
  { label: '25 分钟 (番茄钟)', seconds: 25 * 60 }
] as const

function applyPreset(seconds: number): void {
  if (cdRunning.value) return
  cdHours.value = Math.floor(seconds / 3600)
  cdMinutes.value = Math.floor((seconds % 3600) / 60)
  cdSeconds.value = seconds % 60
  cdTotal.value = seconds
  cdCurrent.value = seconds
}

// ===== 完成提醒 =====
const alertVisible = ref(false)
const alertTitle = ref('')
const alertMessage = ref('')
let alertAutoCloseTimer: ReturnType<typeof setTimeout> | undefined

function showAlert(title: string, message: string): void {
  alertTitle.value = title
  alertMessage.value = message
  alertVisible.value = true
  clearTimeout(alertAutoCloseTimer)
  alertAutoCloseTimer = setTimeout(closeAlert, 5000)
}

function closeAlert(): void {
  alertVisible.value = false
  clearTimeout(alertAutoCloseTimer)
}

let audioCtx: AudioContext | null = null

function playNotificationSound(): void {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    const ctx = audioCtx
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)
    oscillator.frequency.setValueAtTime(800, ctx.currentTime)
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 1)
  } catch (e) {
    console.log('无法播放提示音:', e)
  }
}

const NOTIFY_ICON =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">⏰</text></svg>'

function showBrowserNotification(): void {
  if (!('Notification' in window)) return
  const fire = () => {
    new Notification('倒计时结束！', {
      body: '您设定的倒计时时间已到达',
      icon: NOTIFY_ICON
    })
  }
  if (Notification.permission === 'granted') {
    fire()
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') fire()
    })
  }
}

function onCountdownComplete(): void {
  playNotificationSound()
  showAlert('⏰ 倒计时结束！', '设定的时间已到达！')
  showBrowserNotification()
}

// ===== 模式切换 =====
const mode = ref<TimerMode>('stopwatch')

const modeButtonText = computed(() =>
  mode.value === 'stopwatch' ? '切换到倒计时模式' : '切换到正向计时模式'
)

function switchMode(): void {
  if (mode.value === 'stopwatch') {
    mode.value = 'countdown'
    stopwatchReset()
  } else {
    mode.value = 'stopwatch'
    countdownReset()
  }
}

// ===== 生命周期 =====
onMounted(() => {
  refreshClock()
  clockTimer = setInterval(refreshClock, 1000)
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
  applyCountdownInputs()
})

onUnmounted(() => {
  clearInterval(clockTimer)
  clearInterval(swTimer)
  clearInterval(cdTimer)
  clearTimeout(alertAutoCloseTimer)
  if (audioCtx) void audioCtx.close()
})
</script>

<template>
  <div class="countdown-page">
    <BackHome title="时间显示器" />

    <div class="container">
      <!-- 当前时间日期显示 -->
      <div class="current-time">
        <h1 class="time">{{ currentTimeText }}</h1>
        <div class="current-date">{{ currentDateText }}</div>
      </div>

      <!-- 模式切换按钮 -->
      <div class="mode-switch">
        <button class="btn btn-mode" @click="switchMode">{{ modeButtonText }}</button>
      </div>

      <!-- 正向计时器 -->
      <div v-if="mode === 'stopwatch'" class="timer-section">
        <h2>⏱️ 正向计时器</h2>
        <div class="timer-display">{{ swDisplay }}</div>
        <div class="status" :class="statusClassOf(swStatus)">{{ swStatusText }}</div>
        <div class="controls">
          <button class="btn btn-start" :disabled="swRunning" @click="stopwatchStart">开始</button>
          <button class="btn btn-pause" :disabled="!swRunning" @click="stopwatchPause">暂停</button>
          <button class="btn btn-lap" :disabled="!swRunning" @click="stopwatchLap">计圈</button>
          <button class="btn btn-reset" @click="stopwatchReset">重置</button>
        </div>

        <div v-if="laps.length" class="laps">
          <h3>计圈记录</h3>
          <ol>
            <li v-for="lap in laps" :key="lap.index">
              <span class="lap-index">#{{ lap.index }}</span>
              <span class="lap-diff">{{ formatHMS(lap.diff) }}</span>
              <span class="lap-elapsed">{{ formatHMS(lap.elapsed) }}</span>
            </li>
          </ol>
        </div>
      </div>

      <!-- 倒计时器 -->
      <div v-else class="timer-section">
        <h2>⏰ 倒计时器</h2>
        <div class="countdown-inputs">
          <div class="time-input-group">
            <label>时</label>
            <input
              v-model.number="cdHours"
              type="number"
              class="time-input"
              min="0"
              max="23"
              :disabled="cdRunning"
              @change="applyCountdownInputs"
            />
          </div>
          <div class="time-input-group">
            <label>分</label>
            <input
              v-model.number="cdMinutes"
              type="number"
              class="time-input"
              min="0"
              max="59"
              :disabled="cdRunning"
              @change="applyCountdownInputs"
            />
          </div>
          <div class="time-input-group">
            <label>秒</label>
            <input
              v-model.number="cdSeconds"
              type="number"
              class="time-input"
              min="0"
              max="59"
              :disabled="cdRunning"
              @change="applyCountdownInputs"
            />
          </div>
        </div>

        <div class="presets">
          <button
            v-for="preset in PRESETS"
            :key="preset.seconds"
            class="btn-preset"
            :disabled="cdRunning"
            @click="applyPreset(preset.seconds)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="timer-display" :class="{ 'timer-complete': cdCompleted }">
          {{ cdDisplay }}
        </div>
        <div class="status" :class="statusClassOf(cdStatus)">{{ cdStatusText }}</div>
        <div class="controls">
          <button class="btn btn-set" :disabled="cdRunning" @click="countdownSet">设定</button>
          <button class="btn btn-start" :disabled="cdRunning || cdCurrent <= 0" @click="countdownStart">
            开始
          </button>
          <button class="btn btn-pause" :disabled="!cdRunning" @click="countdownPause">暂停</button>
          <button class="btn btn-reset" @click="countdownReset">重置</button>
        </div>
      </div>
    </div>

    <!-- 完成提醒弹窗 -->
    <div v-if="alertVisible" class="alert-backdrop" @click.self="closeAlert">
      <div class="alert">
        <h3>{{ alertTitle }}</h3>
        <p>{{ alertMessage }}</p>
        <button class="btn btn-start" @click="closeAlert">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.countdown-page {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%);
  padding: 0 20px 40px;
  color: var(--fg);
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  text-align: center;
}

/* 当前时间日期 */
.current-time {
  margin-bottom: 32px;
  padding: 24px 0;
  border-bottom: 2px solid var(--border);
}

.current-time .time {
  font-size: clamp(3rem, 10vw, 6rem);
  font-weight: 300;
  margin: 0 0 8px;
  letter-spacing: 2px;
  color: var(--fg);
  font-family: 'Courier New', monospace;
}

.current-date {
  font-size: clamp(1rem, 3vw, 1.5rem);
  color: var(--muted);
  font-weight: 300;
}

/* 计时器区域 */
.timer-section {
  margin: 24px 0;
  padding: 24px;
  background: var(--bg);
  border-radius: 15px;
  border: 1px solid var(--border);
}

.timer-section h2 {
  font-size: clamp(1.25rem, 4vw, 2rem);
  margin: 0 0 16px;
  color: var(--warning);
}

.timer-display {
  font-size: clamp(2.75rem, 9vw, 5rem);
  font-weight: 300;
  margin: 16px 0;
  font-family: 'Courier New', monospace;
  letter-spacing: 3px;
  color: var(--success);
}

/* 倒计时输入 */
.countdown-inputs {
  margin: 16px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.time-input-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-input-group label {
  font-size: 1rem;
  color: var(--muted);
  min-width: 24px;
  text-align: right;
}

.time-input {
  width: 60px;
  height: 40px;
  font-size: 1.1rem;
  text-align: center;
  border: 2px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--fg);
  font-weight: bold;
}

.time-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 10px var(--accent-soft);
}

.time-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 预设按钮 */
.presets {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}

.btn-preset {
  padding: 8px 16px;
  font-size: 0.9rem;
  border: 1px solid var(--accent);
  border-radius: 20px;
  background: var(--accent-soft);
  color: var(--accent);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-preset:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.btn-preset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 按钮控制区 */
.controls {
  margin: 20px 0;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  padding: 12px 24px;
  font-size: 1rem;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  min-width: 90px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-start {
  background: linear-gradient(45deg, var(--success), #34d399);
  color: #fff;
}

.btn-start:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(16, 185, 129, 0.4);
}

.btn-pause {
  background: linear-gradient(45deg, var(--warning), #fbbf24);
  color: #fff;
}

.btn-pause:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(245, 158, 11, 0.4);
}

.btn-reset {
  background: linear-gradient(45deg, var(--error), #f87171);
  color: #fff;
}

.btn-reset:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(239, 68, 68, 0.4);
}

.btn-set {
  background: linear-gradient(45deg, var(--accent), #60a5fa);
  color: #fff;
}

.btn-set:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4);
}

.btn-lap {
  background: linear-gradient(45deg, #8b5cf6, #a78bfa);
  color: #fff;
}

.btn-lap:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 状态指示器 */
.status {
  font-size: 0.95rem;
  margin: 8px 0;
  padding: 6px 16px;
  border-radius: 20px;
  display: inline-block;
  font-weight: bold;
}

.status-stopped {
  background: rgba(239, 68, 68, 0.12);
  color: var(--error);
  border: 1px solid var(--error);
}

.status-running {
  background: rgba(16, 185, 129, 0.12);
  color: var(--success);
  border: 1px solid var(--success);
}

.status-paused {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warning);
  border: 1px solid var(--warning);
}

/* 模式切换 */
.mode-switch {
  margin: 24px 0;
  text-align: center;
}

.btn-mode {
  background: linear-gradient(45deg, #9c27b0, #e91e63);
  color: #fff;
  padding: 14px 28px;
  font-size: 1.05rem;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.btn-mode:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(156, 39, 176, 0.4);
}

/* 计圈记录 */
.laps {
  margin-top: 16px;
  text-align: left;
}

.laps h3 {
  font-size: 1rem;
  color: var(--muted);
  margin: 0 0 8px;
  text-align: center;
}

.laps ol {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}

.laps li {
  display: grid;
  grid-template-columns: 48px 1fr 1fr;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
}

.lap-index {
  color: var(--muted);
}

.lap-diff {
  color: var(--accent);
  font-weight: bold;
}

.lap-elapsed {
  color: var(--fg);
  text-align: right;
}

/* 完成动画 */
@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

.timer-complete {
  animation: pulse 0.5s ease-in-out infinite;
  color: var(--error) !important;
}

/* 提醒弹窗 */
.alert-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert {
  background: linear-gradient(45deg, var(--error), #f87171);
  color: #fff;
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  font-size: 1.25rem;
  font-weight: bold;
  z-index: 1000;
  text-align: center;
  min-width: 300px;
}

.alert h3 {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.alert p {
  margin: 0 0 16px;
  font-weight: normal;
  font-size: 1.1rem;
}

/* 响应式 */
@media (max-width: 600px) {
  .container {
    padding: 20px 12px;
    margin: 0;
  }

  .controls {
    gap: 8px;
  }

  .btn {
    padding: 10px 18px;
    font-size: 0.9rem;
    min-width: 72px;
  }

  .countdown-inputs {
    flex-direction: column;
    gap: 12px;
  }

  .time-input-group {
    margin: 0;
  }
}
</style>
