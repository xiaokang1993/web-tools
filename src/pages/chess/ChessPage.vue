<script setup lang="ts">
import { computed, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useTheme } from '@/composables/useTheme'

type Color = 'red' | 'black'
type PieceType = 'king' | 'advisor' | 'bishop' | 'knight' | 'rook' | 'cannon' | 'pawn'

interface Piece {
  color: Color
  type: PieceType
}

interface Position {
  row: number
  col: number
}

interface Move {
  from: Position
  to: Position
  piece: Piece
  captured: Piece | null
}

const { isDark, toggle } = useTheme()

const PIECE_CHARS: Record<Color, Record<PieceType, string>> = {
  red: { king: '帅', advisor: '仕', bishop: '相', knight: '马', rook: '车', cannon: '炮', pawn: '兵' },
  black: { king: '将', advisor: '士', bishop: '象', knight: '馬', rook: '車', cannon: '砲', pawn: '卒' }
}

const board = ref<(Piece | null)[][]>([])
const currentPlayer = ref<Color>('red')
const selectedPiece = ref<Position | null>(null)
const history = ref<Move[]>([])
const undoCount = ref(0)
const maxUndo = 10
const isFlipped = ref(false)
const isAiEnabled = ref(false)
const gameStateText = ref('正常进行')
const validMoves = ref<Position[]>([])
const showRules = ref(false)
const winner = ref<Color | null>(null)

const currentTurnText = computed(() => currentPlayer.value === 'red' ? '红方' : '黑方')

const initBoard = (): (Piece | null)[][] => {
  const b: (Piece | null)[][] = Array.from({ length: 10 }, () => Array<Piece | null>(9).fill(null))
  b[0] = ['rook', 'knight', 'bishop', 'advisor', 'king', 'advisor', 'bishop', 'knight', 'rook']
    .map((t) => ({ color: 'red' as Color, type: t as PieceType }))
  b[2][1] = { color: 'red', type: 'cannon' }
  b[2][7] = { color: 'red', type: 'cannon' }
  for (let i = 0; i < 9; i += 2) b[3][i] = { color: 'red', type: 'pawn' }
  b[9] = ['rook', 'knight', 'bishop', 'advisor', 'king', 'advisor', 'bishop', 'knight', 'rook']
    .map((t) => ({ color: 'black' as Color, type: t as PieceType }))
  b[7][1] = { color: 'black', type: 'cannon' }
  b[7][7] = { color: 'black', type: 'cannon' }
  for (let i = 0; i < 9; i += 2) b[6][i] = { color: 'black', type: 'pawn' }
  return b
}

const findKing = (color: Color): Position | null => {
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const p = board.value[row][col]
      if (p && p.color === color && p.type === 'king') return { row, col }
    }
  }
  return null
}

const canMove = (piece: Piece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
  if (fromRow === toRow && fromCol === toCol) return false
  const target = board.value[toRow][toCol]
  if (target && target.color === piece.color) return false

  switch (piece.type) {
    case 'king': {
      const inRed = piece.color === 'red' && toRow <= 2 && toCol >= 3 && toCol <= 5
      const inBlack = piece.color === 'black' && toRow >= 7 && toCol >= 3 && toCol <= 5
      if (!inRed && !inBlack) return false
      return Math.abs(toRow - fromRow) + Math.abs(toCol - fromCol) === 1
    }
    case 'advisor': {
      const inRed = piece.color === 'red' && toRow <= 2 && toCol >= 3 && toCol <= 5
      const inBlack = piece.color === 'black' && toRow >= 7 && toCol >= 3 && toCol <= 5
      if (!inRed && !inBlack) return false
      return Math.abs(toRow - fromRow) === 1 && Math.abs(toCol - fromCol) === 1
    }
    case 'bishop': {
      if ((piece.color === 'red' && toRow > 4) || (piece.color === 'black' && toRow < 5)) return false
      if (Math.abs(toRow - fromRow) !== 2 || Math.abs(toCol - fromCol) !== 2) return false
      const midRow = (fromRow + toRow) / 2
      const midCol = (fromCol + toCol) / 2
      return !board.value[midRow][midCol]
    }
    case 'knight': {
      const rd = Math.abs(toRow - fromRow)
      const cd = Math.abs(toCol - fromCol)
      if (!((rd === 1 && cd === 2) || (rd === 2 && cd === 1))) return false
      if (rd === 1) return !board.value[fromRow][(fromCol + toCol) / 2]
      return !board.value[(fromRow + toRow) / 2][fromCol]
    }
    case 'rook': {
      if (fromRow !== toRow && fromCol !== toCol) return false
      if (fromRow === toRow) {
        const [s, e] = [Math.min(fromCol, toCol), Math.max(fromCol, toCol)]
        for (let c = s + 1; c < e; c++) if (board.value[fromRow][c]) return false
      } else {
        const [s, e] = [Math.min(fromRow, toRow), Math.max(fromRow, toRow)]
        for (let r = s + 1; r < e; r++) if (board.value[r][fromCol]) return false
      }
      return true
    }
    case 'cannon': {
      if (fromRow !== toRow && fromCol !== toCol) return false
      let count = 0
      if (fromRow === toRow) {
        const [s, e] = [Math.min(fromCol, toCol), Math.max(fromCol, toCol)]
        for (let c = s + 1; c < e; c++) if (board.value[fromRow][c]) count++
      } else {
        const [s, e] = [Math.min(fromRow, toRow), Math.max(fromRow, toRow)]
        for (let r = s + 1; r < e; r++) if (board.value[r][fromCol]) count++
      }
      return target ? count === 1 : count === 0
    }
    case 'pawn': {
      const rd = toRow - fromRow
      const cd = Math.abs(toCol - fromCol)
      if (cd > 1 || (piece.color === 'red' ? rd > 0 : rd < 0)) return false
      if ((piece.color === 'red' && fromRow < 5 && rd === 0) || (piece.color === 'black' && fromRow > 4 && rd === 0)) return false
      return Math.abs(rd) + cd === 1
    }
  }
  return false
}

const isKingInCheck = (color: Color): boolean => {
  const kp = findKing(color)
  if (!kp) return true
  const opp = color === 'red' ? 'black' : 'red'
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const p = board.value[row][col]
      if (p && p.color === opp && canMove(p, row, col, kp.row, kp.col)) return true
    }
  }
  return false
}

const isCheckmated = (color: Color): boolean => {
  const kp = findKing(color)
  if (!kp) return true
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const p = board.value[row][col]
      if (p && p.color === color) {
        for (let toRow = 0; toRow < 10; toRow++) {
          for (let toCol = 0; toCol < 9; toCol++) {
            if (canMove(p, row, col, toRow, toCol)) {
              const orig = board.value[toRow][toCol]
              board.value[toRow][toCol] = p
              board.value[row][col] = null
              const still = isKingInCheck(color)
              board.value[row][col] = p
              board.value[toRow][toCol] = orig
              if (!still) return false
            }
          }
        }
      }
    }
  }
  return true
}

const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
  const move: Move = {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    piece: { ...board.value[fromRow][fromCol]! },
    captured: board.value[toRow][toCol] ? { ...board.value[toRow][toCol]! } : null
  }
  history.value.push(move)
  undoCount.value = 0
  board.value[toRow][toCol] = board.value[fromRow][fromCol]
  board.value[fromRow][fromCol] = null
  currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red'

  const opp = currentPlayer.value
  if (isKingInCheck(opp)) {
    if (isCheckmated(opp)) {
      winner.value = opp === 'red' ? 'black' : 'red'
      gameStateText.value = `${winner.value === 'red' ? '红' : '黑'}方获胜`
    } else {
      gameStateText.value = `将军！${opp === 'red' ? '红' : '黑'}方请解将`
    }
  } else {
    gameStateText.value = '正常进行'
  }
}

const handleCellClick = (row: number, col: number) => {
  if (winner.value) return
  if (isAiEnabled.value && currentPlayer.value === 'black') return

  const actualRow = isFlipped.value ? 9 - row : row
  const actualCol = isFlipped.value ? 8 - col : col
  const piece = board.value[actualRow][actualCol]

  if (piece && piece.color === currentPlayer.value) {
    selectedPiece.value = { row: actualRow, col: actualCol }
    validMoves.value = []
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        if (canMove(piece, actualRow, actualCol, r, c)) validMoves.value.push({ row: r, col: c })
      }
    }
    return
  }

  if (selectedPiece.value) {
    const { row: fr, col: fc } = selectedPiece.value
    if (canMove(board.value[fr][fc]!, fr, fc, actualRow, actualCol)) {
      makeMove(fr, fc, actualRow, actualCol)
      selectedPiece.value = null
      validMoves.value = []
      if (isAiEnabled.value && !winner.value && currentPlayer.value === 'black') {
        setTimeout(makeAiMove, 500)
      }
    } else {
      selectedPiece.value = null
      validMoves.value = []
    }
  }
}

const makeAiMove = () => {
  if (currentPlayer.value !== 'black' || winner.value) return
  const moves: { fromRow: number; fromCol: number; toRow: number; toCol: number }[] = []
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const p = board.value[row][col]
      if (p && p.color === 'black') {
        for (let toRow = 0; toRow < 10; toRow++) {
          for (let toCol = 0; toCol < 9; toCol++) {
            if (canMove(p, row, col, toRow, toCol)) {
              moves.push({ fromRow: row, fromCol: col, toRow, toCol })
            }
          }
        }
      }
    }
  }
  if (moves.length === 0) {
    winner.value = 'red'
    gameStateText.value = '红方获胜'
    return
  }
  const m = moves[Math.floor(Math.random() * moves.length)]
  makeMove(m.fromRow, m.fromCol, m.toRow, m.toCol)
}

const undoMove = () => {
  if (history.value.length === 0 || undoCount.value >= maxUndo) return
  const last = history.value.pop()!
  undoCount.value++
  board.value[last.from.row][last.from.col] = last.piece
  board.value[last.to.row][last.to.col] = last.captured
  currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red'
  winner.value = null
  gameStateText.value = '正常进行'
}

const flipBoard = () => { isFlipped.value = !isFlipped.value }

const toggleAi = () => {
  isAiEnabled.value = !isAiEnabled.value
  if (isAiEnabled.value && currentPlayer.value === 'black') setTimeout(makeAiMove, 500)
}

const initGame = () => {
  board.value = initBoard()
  currentPlayer.value = 'red'
  selectedPiece.value = null
  history.value = []
  undoCount.value = 0
  validMoves.value = []
  winner.value = null
  gameStateText.value = '正常进行'
}

const downloadPGN = () => {
  let pgn = `[Event "Chinese Chess"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n\n`
  let num = 1
  history.value.forEach((m, i) => {
    if (i % 2 === 0) { pgn += `${num}. `; num++ }
    const sym = PIECE_CHARS[m.piece.color][m.piece.type]
    const from = `${String.fromCharCode(97 + m.from.col)}${10 - m.from.row}`
    const to = `${String.fromCharCode(97 + m.to.col)}${10 - m.to.row}`
    pgn += `${sym}${from}-${to} `
  })
  pgn += '*'
  const blob = new Blob([pgn], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chess_${Date.now()}.pgn`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const getPiece = (displayRow: number, displayCol: number): Piece | null => {
  const r = isFlipped.value ? 9 - displayRow : displayRow
  const c = isFlipped.value ? 8 - displayCol : displayCol
  return board.value[r][c]
}

const isSelected = (displayRow: number, displayCol: number) => {
  if (!selectedPiece.value) return false
  const r = isFlipped.value ? 9 - displayRow : displayRow
  const c = isFlipped.value ? 8 - displayCol : displayCol
  return selectedPiece.value.row === r && selectedPiece.value.col === c
}

const isValidMove = (displayRow: number, displayCol: number) => {
  const r = isFlipped.value ? 9 - displayRow : displayRow
  const c = isFlipped.value ? 8 - displayCol : displayCol
  return validMoves.value.some((m) => m.row === r && m.col === c)
}

initGame()
</script>

<template>
  <BackHome title="中国象棋" />
  <div class="chess-root" :class="{ dark: isDark }">
    <header class="game-header">
      <h1>中国象棋</h1>
      <div class="game-info">
        <div class="status-item"><span>当前回合:</span> <span :class="currentPlayer === 'red' ? 'red-turn' : 'black-turn'">{{ currentTurnText }}</span></div>
        <div class="status-item"><span>游戏状态:</span> <span>{{ gameStateText }}</span></div>
        <div class="status-item"><span>悔棋:</span> <span>{{ undoCount }}/{{ maxUndo }}</span></div>
      </div>
    </header>

    <div class="chessboard-container">
      <div class="chessboard">
        <div class="board-lines">
          <div v-for="i in 10" :key="`h-${i}`" class="line-h" :style="{ top: `${(i - 1) * 11.11}%` }"></div>
          <div v-for="i in 9" :key="`v-${i}`" class="line-v" :style="{ left: `${(i - 1) * 12.5}%` }"></div>
          <div class="palace" style="top: 0%; left: 37.5%; width: 25%; height: 33.33%"></div>
          <div class="palace" style="top: 66.67%; left: 37.5%; width: 25%; height: 33.33%"></div>
        </div>
        <div class="river">楚 河 汉 界</div>
        <div
          v-for="r in 10"
          :key="`row-${r}`"
          class="cell-row"
        >
          <div
            v-for="c in 9"
            :key="`cell-${r}-${c}`"
            class="cell"
            :style="{ top: `${(r - 1) * 11.11}%`, left: `${(c - 1) * 12.5}%` }"
            @click="handleCellClick(r - 1, c - 1)"
          >
            <div v-if="isValidMove(r - 1, c - 1)" class="move-point"></div>
            <div
              v-if="getPiece(r - 1, c - 1)"
              :class="['chess-piece', getPiece(r - 1, c - 1)!.color, { selected: isSelected(r - 1, c - 1) }]"
            >
              {{ PIECE_CHARS[getPiece(r - 1, c - 1)!.color][getPiece(r - 1, c - 1)!.type] }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="controls">
      <button @click="flipBoard">棋盘翻转</button>
      <button :disabled="history.length === 0" @click="undoMove">悔棋</button>
      <button @click="initGame">新游戏</button>
      <button @click="toggleAi">人机: {{ isAiEnabled ? '开' : '关' }}</button>
      <button @click="downloadPGN">下载棋谱</button>
      <button @click="toggle">{{ isDark ? '☀️' : '🌙' }}</button>
      <button @click="showRules = true">游戏规则</button>
    </div>

    <div v-if="showRules" class="rules-modal" @click.self="showRules = false">
      <div class="rules-content">
        <button class="close-btn" @click="showRules = false">×</button>
        <h1>中国象棋规则</h1>
        <div class="rule-section">
          <h2>棋子走法</h2>
          <p><strong>将/帅:</strong> 九宫内直线一步</p>
          <p><strong>士/仕:</strong> 九宫内斜线一步</p>
          <p><strong>象/相:</strong> 走"田"字，不能过河，塞象眼</p>
          <p><strong>马:</strong> 走"日"字，蹩马腿</p>
          <p><strong>车:</strong> 横平竖直任意步</p>
          <p><strong>炮:</strong> 移动同车，吃子需隔一子</p>
          <p><strong>兵/卒:</strong> 过河前只能向前，过河后可左右</p>
        </div>
        <div class="rule-section">
          <h2>胜负</h2>
          <p>将死对方将/帅即胜。将帅不能照面。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chess-root {
  background: #f5f5f5;
  min-height: calc(100vh - 49px);
  padding: 16px;
}
.chess-root.dark {
  background: #1a1a1a;
}
.game-header {
  text-align: center;
  margin-bottom: 16px;
}
.game-header h1 {
  margin: 0;
  color: #c00;
}
.game-info {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 8px;
  font-size: 14px;
}
.status-item span:last-child {
  font-weight: bold;
}
.red-turn { color: #c00; }
.black-turn { color: #333; }
.chessboard-container {
  max-width: 540px;
  margin: 0 auto;
}
.chessboard {
  position: relative;
  width: 100%;
  aspect-ratio: 9 / 10;
  background: #e8d0a9;
  border: 3px solid #b8860b;
  border-radius: 8px;
}
.board-lines {
  position: absolute;
  inset: 0;
}
.line-h {
  position: absolute;
  left: 6.25%;
  width: 87.5%;
  height: 1px;
  background: #b8860b;
}
.line-v {
  position: absolute;
  top: 5.55%;
  height: 88.88%;
  width: 1px;
  background: #b8860b;
}
.palace {
  position: absolute;
  border: 1px solid #b8860b;
  border-top: none;
  border-bottom: none;
}
.river {
  position: absolute;
  top: 44.44%;
  left: 0;
  width: 100%;
  height: 11.11%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b8860b;
  font-size: 18px;
  letter-spacing: 8px;
}
.cell-row {
  position: absolute;
  inset: 0;
}
.cell {
  position: absolute;
  width: 12.5%;
  height: 11.11%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.chess-piece {
  width: 80%;
  height: 80%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.15s;
  position: relative;
}
.chess-piece.red {
  background: linear-gradient(to bottom, #ff4500, #d32f2f);
  color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
}
.chess-piece.black {
  background: linear-gradient(to bottom, #333, #1a1a1a);
  color: #fff;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.5);
}
.chess-piece.selected {
  transform: scale(1.1);
  box-shadow: 0 0 10px 4px rgba(0, 255, 0, 0.5);
}
.move-point {
  width: 30%;
  height: 30%;
  border-radius: 50%;
  background: rgba(0, 255, 0, 0.3);
  border: 2px solid rgba(0, 255, 0, 0.6);
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 540px;
  margin: 16px auto;
}
.controls button {
  padding: 8px 16px;
  border: 1px solid #b8860b;
  background: transparent;
  color: #b8860b;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.controls button:hover:not(:disabled) {
  background: #b8860b;
  color: #fff;
}
.rules-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.rules-content {
  background: #fff;
  padding: 32px;
  border-radius: 12px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
}
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
}
.rule-section {
  margin-bottom: 16px;
}
.rule-section h2 {
  color: #c00;
  margin-bottom: 8px;
}
.rule-section p {
  margin: 4px 0;
  font-size: 14px;
}
</style>
