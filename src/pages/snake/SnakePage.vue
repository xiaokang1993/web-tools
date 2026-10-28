<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useLocalStorage } from '@/composables/useLocalStorage'

type Dir = 'up' | 'down' | 'left' | 'right'
interface Point { x: number; y: number }

const speed = ref(5)
const obstacleEnabled = ref(true)
const bonusEnabled = ref(true)
const difficulty = ref<'easy' | 'normal' | 'hard'>('normal')
const gridSize = ref(20)

const snake = ref<Point[]>([{ x: 10, y: 10 }])
const food = ref<Point>({ x: 5, y: 5 })
const bonusFood = ref<Point | null>(null)
const obstacles = ref<Point[]>([])
const direction = ref<Dir>('right')
const nextDirection = ref<Dir>('right')
const score = ref(0)
const level = ref(1)
const isPaused = ref(false)
const isGameOver = ref(false)
const gameActive = ref(false)
const highScore = useLocalStorage<number>('snake-high-score', 0)
const showSettings = ref(false)

let gameLoop: ReturnType<typeof setInterval> | undefined
let bonusTimer: ReturnType<typeof setTimeout> | undefined
let rafId: number | undefined
let lastTime = 0

const gameSpeed = computed(() => Math.max(80, 250 - speed.value * 20))

const cells = computed(() => {
  const grid: ('empty' | 'snake-head' | 'snake' | 'food' | 'bonus' | 'obstacle')[] = []
  for (let y = 0; y < gridSize.value; y++) {
    for (let x = 0; x < gridSize.value; x++) {
      if (snake.value[0]?.x === x && snake.value[0]?.y === y) grid.push('snake-head')
      else if (snake.value.some((s) => s.x === x && s.y === y)) grid.push('snake')
      else if (food.value.x === x && food.value.y === y) grid.push('food')
      else if (bonusFood.value?.x === x && bonusFood.value?.y === y) grid.push('bonus')
      else if (obstacles.value.some((o) => o.x === x && o.y === y)) grid.push('obstacle')
      else grid.push('empty')
    }
  }
  return grid
})

const isOccupied = (x: number, y: number): boolean => {
  if (snake.value.some((s) => s.x === x && s.y === y)) return true
  if (food.value.x === x && food.value.y === y) return true
  if (bonusFood.value?.x === x && bonusFood.value?.y === y) return true
  if (obstacles.value.some((o) => o.x === x && o.y === y)) return true
  return false
}

const findEmptySpot = (): Point => {
  let p: Point
  do {
    p = { x: Math.floor(Math.random() * gridSize.value), y: Math.floor(Math.random() * gridSize.value) }
  } while (isOccupied(p.x, p.y))
  return p
}

const generateFood = () => { food.value = findEmptySpot() }

const generateBonusFood = () => {
  bonusFood.value = findEmptySpot()
  clearTimeout(bonusTimer)
  bonusTimer = setTimeout(() => { bonusFood.value = null }, 5000)
}

const updateObstacles = () => {
  const count = obstacleEnabled.value ? Math.floor(level.value / 2) + 1 : 0
  while (obstacles.value.length < count) {
    obstacles.value.push(findEmptySpot())
  }
  while (obstacles.value.length > count) {
    obstacles.value.pop()
  }
}

const moveSnake = () => {
  direction.value = nextDirection.value
  const head = { ...snake.value[0] }
  if (direction.value === 'up') head.y--
  else if (direction.value === 'down') head.y++
  else if (direction.value === 'left') head.x--
  else head.x++

  snake.value.unshift(head)

  const ateFood = head.x === food.value.x && head.y === food.value.y
  const ateBonus = bonusFood.value && head.x === bonusFood.value.x && head.y === bonusFood.value.y

  if (ateFood) {
    score.value += 10
    generateFood()
    if (score.value % 100 === 0) levelUp()
    if (bonusEnabled.value && Math.random() < 0.3) generateBonusFood()
  } else if (ateBonus) {
    score.value += 30
    bonusFood.value = null
    clearTimeout(bonusTimer)
  } else {
    snake.value.pop()
  }
}

const checkCollisions = () => {
  const head = snake.value[0]
  if (head.x < 0 || head.x >= gridSize.value || head.y < 0 || head.y >= gridSize.value) return true
  for (let i = 3; i < snake.value.length; i++) {
    if (head.x === snake.value[i].x && head.y === snake.value[i].y) return true
  }
  if (obstacles.value.some((o) => o.x === head.x && o.y === head.y)) return true
  return false
}

const levelUp = () => {
  level.value++
  const inc = { easy: 15, normal: 20, hard: 25 }[difficulty.value]
  speed.value = Math.min(10, speed.value + Math.floor(inc / 10))
  updateObstacles()
}

const step = () => {
  moveSnake()
  if (checkCollisions()) {
    gameOver()
    return
  }
  updateObstacles()
  const bonusChance = { easy: 0.1, normal: 0.05, hard: 0.02 }[difficulty.value]
  if (bonusEnabled.value && !bonusFood.value && Math.random() < bonusChance) generateBonusFood()
}

const render = (time: number) => {
  if (!gameActive.value || isPaused.value || isGameOver.value) {
    rafId = requestAnimationFrame(render)
    return
  }
  if (time - lastTime > gameSpeed.value) {
    lastTime = time
    step()
  }
  rafId = requestAnimationFrame(render)
}

const startGame = () => {
  initGame()
  gameActive.value = true
  isPaused.value = false
  lastTime = 0
}

const initGame = () => {
  snake.value = [{ x: Math.floor(gridSize.value / 2), y: Math.floor(gridSize.value / 2) }]
  direction.value = 'right'
  nextDirection.value = 'right'
  score.value = 0
  level.value = 1
  isPaused.value = false
  isGameOver.value = false
  bonusFood.value = null
  obstacles.value = []
  generateFood()
  updateObstacles()
}

const pauseGame = () => {
  if (gameActive.value && !isGameOver.value) isPaused.value = !isPaused.value
}

const resetGame = () => {
  gameActive.value = false
  initGame()
}

const gameOver = () => {
  isGameOver.value = true
  gameActive.value = false
  if (score.value > highScore.value) highScore.value = score.value
  clearTimeout(bonusTimer)
}

const onKeydown = (e: KeyboardEvent) => {
  if (!gameActive.value || isGameOver.value) return
  const key = e.key
  if (key === 'ArrowUp' && direction.value !== 'down') nextDirection.value = 'up'
  else if (key === 'ArrowDown' && direction.value !== 'up') nextDirection.value = 'down'
  else if (key === 'ArrowLeft' && direction.value !== 'right') nextDirection.value = 'left'
  else if (key === 'ArrowRight' && direction.value !== 'left') nextDirection.value = 'right'
  else if (key === ' ') { e.preventDefault(); pauseGame() }
  if (key.startsWith('Arrow')) e.preventDefault()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  rafId = requestAnimationFrame(render)
  initGame()
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (rafId) cancelAnimationFrame(rafId)
  clearTimeout(bonusTimer)
})
</script>

<template>
  <BackHome title="贪吃蛇" />
  <div class="snake-root">
    <header class="game-header">
      <h1>🐍 贪吃蛇</h1>
      <p class="subtitle">经典游戏，现代体验</p>
    </header>

    <div class="game-info">
      <div class="info-item"><span class="label">得分</span> <span class="value">{{ score }}</span></div>
      <div class="info-item"><span class="label">最高分</span> <span class="value">{{ highScore }}</span></div>
      <div class="info-item"><span class="label">等级</span> <span class="value">{{ level }}</span></div>
    </div>

    <div class="game-board-container">
      <div class="game-board" :style="{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gridTemplateRows: `repeat(${gridSize}, 1fr)` }">
        <div
          v-for="(cell, i) in cells"
          :key="i"
          :class="['cell', cell]"
        ></div>
      </div>

      <div v-if="isGameOver" class="overlay">
        <div class="overlay-content">
          <h2>游戏结束</h2>
          <p>最终得分: {{ score }}</p>
          <p v-if="score >= highScore">🏆 新纪录！</p>
          <button class="btn btn-primary" @click="startGame">重新开始</button>
        </div>
      </div>

      <div v-if="!gameActive && !isGameOver" class="overlay">
        <div class="overlay-content">
          <h2>准备开始</h2>
          <button class="btn btn-primary" @click="startGame">开始游戏</button>
        </div>
      </div>
    </div>

    <div class="controls">
      <button class="btn btn-primary" @click="startGame">开始</button>
      <button class="btn" :disabled="!gameActive" @click="pauseGame">{{ isPaused ? '继续' : '暂停' }}</button>
      <button class="btn" @click="resetGame">重置</button>
      <button class="btn" @click="showSettings = true">设置</button>
    </div>

    <div class="instructions">
      <div class="instructions-title">游戏说明</div>
      <ul>
        <li>使用 ↑ ↓ ← → 方向键控制移动</li>
        <li>空格键暂停/继续</li>
        <li>吃红色食物 +10 分，金色奖励食物 +30 分</li>
        <li>每 100 分升一级，速度加快</li>
        <li>碰到墙壁、身体或障碍物游戏结束</li>
      </ul>
    </div>

    <div v-if="showSettings" class="modal" @click.self="showSettings = false">
      <div class="modal-content">
        <h2>游戏设置</h2>
        <div class="setting-item">
          <label>游戏速度</label>
          <input type="range" min="1" max="10" v-model.number="speed" />
          <span>{{ speed }}</span>
        </div>
        <div class="setting-item">
          <label>障碍物</label>
          <input type="checkbox" v-model="obstacleEnabled" />
        </div>
        <div class="setting-item">
          <label>奖励食物</label>
          <input type="checkbox" v-model="bonusEnabled" />
        </div>
        <div class="setting-item">
          <label>难度</label>
          <select v-model="difficulty">
            <option value="easy">简单</option>
            <option value="normal">普通</option>
            <option value="hard">困难</option>
          </select>
        </div>
        <div class="setting-item">
          <label>网格大小</label>
          <select v-model.number="gridSize">
            <option :value="15">小 (15×15)</option>
            <option :value="20">中 (20×20)</option>
            <option :value="25">大 (25×25)</option>
          </select>
        </div>
        <button class="btn btn-primary" @click="showSettings = false; resetGame()">保存并重置</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snake-root {
  background: #212529;
  min-height: calc(100vh - 49px);
  color: #f8f9fa;
  padding: 16px;
}
.game-header {
  text-align: center;
  margin-bottom: 16px;
}
.game-header h1 {
  margin: 0;
  font-size: 28px;
}
.subtitle {
  color: #6c757d;
  margin: 4px 0 0;
}
.game-info {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-bottom: 16px;
}
.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.info-item .label {
  font-size: 12px;
  color: #6c757d;
}
.info-item .value {
  font-size: 24px;
  font-weight: bold;
}
.game-board-container {
  position: relative;
  max-width: 500px;
  margin: 0 auto;
  aspect-ratio: 1;
}
.game-board {
  display: grid;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  border: 2px solid #495057;
  border-radius: 8px;
  overflow: hidden;
}
.cell {
  border: 1px solid rgba(255, 255, 255, 0.03);
}
.cell.snake-head {
  background: #4cc9f0;
  box-shadow: 0 0 8px rgba(76, 201, 240, 0.7);
  border-radius: 4px;
}
.cell.snake {
  background: #4361ee;
  border-radius: 3px;
}
.cell.food {
  background: #f72585;
  border-radius: 50%;
}
.cell.bonus {
  background: #ffd700;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.7);
}
.cell.obstacle {
  background: #6c757d;
  border-radius: 2px;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.overlay-content {
  text-align: center;
}
.overlay-content h2 {
  margin: 0 0 16px;
  font-size: 28px;
}
.overlay-content p {
  margin: 4px 0;
}
.controls {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}
.btn {
  padding: 8px 20px;
  border: 1px solid #495057;
  background: #343a40;
  color: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
}
.instructions {
  max-width: 500px;
  margin: 16px auto 0;
  padding: 16px;
  background: #1a1a1a;
  border-radius: 8px;
}
.instructions-title {
  font-weight: bold;
  margin-bottom: 8px;
}
.instructions ul {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  color: #adb5bd;
}
.instructions li {
  margin: 4px 0;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #1e293b;
  padding: 24px;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
}
.modal-content h2 {
  margin: 0 0 16px;
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #334155;
}
.setting-item label {
  flex: 1;
}
.setting-item input[type="range"] {
  flex: 1;
  max-width: 120px;
}
.setting-item select {
  background: #334155;
  color: #fff;
  border: 1px solid #475569;
  border-radius: 4px;
  padding: 4px;
}
</style>
