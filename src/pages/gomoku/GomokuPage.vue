<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'

type Player = 'black' | 'white'
interface Move { row: number; col: number; player: Player }

const BOARD_SIZE = 15
const CELL_SIZE = 40
const PADDING = 20

const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
const board = ref<(Player | null)[][]>([])
const currentPlayer = ref<Player>('black')
const gameEnded = ref(false)
const moveHistory = ref<Move[]>([])
const soundEnabled = ref(true)
const gameStatus = ref('等待开始...')
const showModal = ref(false)
const winnerMessage = ref('')
const hoverPos = ref<{ row: number; col: number } | null>(null)

const totalSize = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2

const initBoard = () => {
  board.value = Array.from({ length: BOARD_SIZE }, () => Array<Player | null>(BOARD_SIZE).fill(null))
  gameEnded.value = false
  moveHistory.value = []
  currentPlayer.value = 'black'
  gameStatus.value = '黑方走棋'
  drawBoard()
}

const drawBoard = () => {
  const c = ctx
  if (!c) return
  c.clearRect(0, 0, totalSize, totalSize)
  c.fillStyle = '#d4a574'
  c.fillRect(0, 0, totalSize, totalSize)
  c.strokeStyle = '#8b6914'
  c.lineWidth = 1
  for (let i = 0; i < BOARD_SIZE; i++) {
    const pos = PADDING + i * CELL_SIZE
    c.beginPath(); c.moveTo(pos, PADDING); c.lineTo(pos, totalSize - PADDING); c.stroke()
    c.beginPath(); c.moveTo(PADDING, pos); c.lineTo(totalSize - PADDING, pos); c.stroke()
  }
  const stars = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]
  c.fillStyle = '#8b6914'
  stars.forEach(([r, cc]) => {
    c.beginPath()
    c.arc(PADDING + cc * CELL_SIZE, PADDING + r * CELL_SIZE, 4, 0, Math.PI * 2)
    c.fill()
  })
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board.value[r][c]) drawPiece(r, c, board.value[r][c]!)
    }
  }
  if (hoverPos.value) drawHoverPiece(hoverPos.value.row, hoverPos.value.col)
}

const drawPiece = (row: number, col: number, color: Player) => {
  if (!ctx) return
  const x = PADDING + col * CELL_SIZE
  const y = PADDING + row * CELL_SIZE
  const radius = CELL_SIZE * 0.4
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 5
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 2
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  const gradient = ctx.createRadialGradient(x - radius / 3, y - radius / 3, 0, x, y, radius)
  if (color === 'black') {
    gradient.addColorStop(0, '#4a4a4a')
    gradient.addColorStop(1, '#000000')
  } else {
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(1, '#e0e0e0')
  }
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.restore()
  if (moveHistory.value.length > 0) {
    const last = moveHistory.value[moveHistory.value.length - 1]
    if (last.row === row && last.col === col) {
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, radius + 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

const drawHoverPiece = (row: number, col: number) => {
  if (!ctx) return
  const x = PADDING + col * CELL_SIZE
  const y = PADDING + row * CELL_SIZE
  const radius = CELL_SIZE * 0.4
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = currentPlayer.value === 'black' ? '#000000' : '#ffffff'
  ctx.fill()
  ctx.restore()
}

const isValidMove = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && !board.value[row][col]

const isInBounds = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE

const checkWin = (row: number, col: number): boolean => {
  const player = board.value[row][col]
  if (!player) return false
  const directions = [[[0, 1], [0, -1]], [[1, 0], [-1, 0]], [[1, 1], [-1, -1]], [[1, -1], [-1, 1]]]
  for (const [d1, d2] of directions) {
    let count = 1
    for (let i = 1; i < 5; i++) {
      const nr = row + d1[0] * i, nc = col + d1[1] * i
      if (isInBounds(nr, nc) && board.value[nr][nc] === player) count++
      else break
    }
    for (let i = 1; i < 5; i++) {
      const nr = row + d2[0] * i, nc = col + d2[1] * i
      if (isInBounds(nr, nc) && board.value[nr][nc] === player) count++
      else break
    }
    if (count >= 5) return true
  }
  return false
}

const playSound = () => {
  try {
    const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.frequency.value = 800
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ac.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + 0.1)
  } catch {
    // 忽略
  }
}

const makeMove = (row: number, col: number) => {
  board.value[row][col] = currentPlayer.value
  moveHistory.value.push({ row, col, player: currentPlayer.value })
  drawBoard()
  if (soundEnabled.value) playSound()
  if (checkWin(row, col)) {
    endGame(currentPlayer.value)
    return
  }
  if (moveHistory.value.length === BOARD_SIZE * BOARD_SIZE) {
    endGame('draw' as Player)
    return
  }
  currentPlayer.value = currentPlayer.value === 'black' ? 'white' : 'black'
  gameStatus.value = `${currentPlayer.value === 'black' ? '黑方' : '白方'}走棋`
}

const handleClick = (e: MouseEvent) => {
  if (gameEnded.value || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const scale = totalSize / rect.width
  const x = (e.clientX - rect.left) * scale
  const y = (e.clientY - rect.top) * scale
  const col = Math.round((x - PADDING) / CELL_SIZE)
  const row = Math.round((y - PADDING) / CELL_SIZE)
  if (isValidMove(row, col)) makeMove(row, col)
}

const handleMouseMove = (e: MouseEvent) => {
  if (gameEnded.value || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const scale = totalSize / rect.width
  const x = (e.clientX - rect.left) * scale
  const y = (e.clientY - rect.top) * scale
  const col = Math.round((x - PADDING) / CELL_SIZE)
  const row = Math.round((y - PADDING) / CELL_SIZE)
  if (isValidMove(row, col)) {
    hoverPos.value = { row, col }
    drawBoard()
    canvasRef.value.style.cursor = 'pointer'
  } else {
    hoverPos.value = null
    drawBoard()
    canvasRef.value.style.cursor = 'default'
  }
}

const clearHover = () => {
  hoverPos.value = null
  drawBoard()
}

const endGame = (winner: Player) => {
  gameEnded.value = true
  let msg: string
  if (winner === ('draw' as Player)) msg = '平局！双方势均力敌！'
  else msg = `${winner === 'black' ? '黑方' : '白方'}获胜！`
  gameStatus.value = msg
  winnerMessage.value = msg
  setTimeout(() => { showModal.value = true }, 500)
}

const newGame = () => {
  showModal.value = false
  initBoard()
}

const undo = () => {
  if (moveHistory.value.length === 0 || gameEnded.value) return
  const last = moveHistory.value.pop()!
  board.value[last.row][last.col] = null
  currentPlayer.value = last.player
  drawBoard()
  gameStatus.value = `${currentPlayer.value === 'black' ? '黑方' : '白方'}走棋`
}

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
}

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.width = totalSize
    canvasRef.value.height = totalSize
    ctx = canvasRef.value.getContext('2d')
    initBoard()
  }
})
onUnmounted(() => { ctx = null })
</script>

<template>
  <BackHome title="五子棋" />
  <div class="gomoku-root">
    <header class="game-header">
      <h1>五子棋</h1>
      <div class="game-info">
        <div class="current-player">
          <span class="player-label">当前玩家</span>
          <div :class="['piece', currentPlayer]"></div>
        </div>
        <div class="game-status">{{ gameStatus }}</div>
      </div>
    </header>

    <main class="game-main">
      <div class="board-container">
        <canvas ref="canvasRef" @click="handleClick" @mousemove="handleMouseMove" @mouseleave="clearHover"></canvas>
      </div>
    </main>

    <footer class="game-controls">
      <button class="btn btn-primary" @click="newGame">新游戏</button>
      <button class="btn btn-secondary" :disabled="moveHistory.length === 0" @click="undo">悔棋</button>
      <button class="btn btn-secondary" @click="toggleSound">音效 {{ soundEnabled ? '开' : '关' }}</button>
    </footer>

    <div v-if="showModal" class="modal" @click.self="showModal = false">
      <div class="modal-content">
        <h2>游戏结束</h2>
        <p>{{ winnerMessage }}</p>
        <button class="btn btn-primary" @click="newGame">再来一局</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gomoku-root {
  background: #1f2937;
  min-height: calc(100vh - 49px);
  color: #f3f4f6;
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
.game-info {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 8px;
}
.current-player {
  display: flex;
  align-items: center;
  gap: 8px;
}
.player-label {
  font-size: 14px;
  color: #9ca3af;
}
.piece {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.piece.black { background: #000; }
.piece.white { background: #fff; }
.game-status {
  font-size: 16px;
  font-weight: bold;
}
.game-main {
  display: flex;
  justify-content: center;
}
.board-container {
  max-width: 100%;
}
canvas {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}
.game-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}
.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-secondary {
  background: #374151;
  color: #f3f4f6;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal-content {
  background: #1f2937;
  padding: 32px;
  border-radius: 12px;
  text-align: center;
  max-width: 400px;
}
.modal-content h2 {
  margin: 0 0 12px;
}
.modal-content p {
  margin: 0 0 24px;
  font-size: 18px;
}
</style>
