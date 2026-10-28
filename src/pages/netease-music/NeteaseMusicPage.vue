<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useTheme } from '@/composables/useTheme'

interface LyricLine {
  time: number
  text: string
}

interface AudioTrack {
  name: string
  file: File
  url: string
}

const { isDark, toggle } = useTheme()

const audioFiles = ref<AudioTrack[]>([])
const lyricsFiles = ref<Record<string, File>>({})
const currentTrackIndex = ref(-1)
const lyricsData = ref<LyricLine[]>([])
const currentLyricLine = ref(-1)
const mobileView = ref<'playlist' | 'lyrics'>('playlist')
const fileInput = ref<HTMLInputElement | null>(null)
const audioPlayer = ref<HTMLAudioElement | null>(null)
const isDragOver = ref(false)
const onlineUrl = ref('')
const showOnlineConfig = ref(false)

const playlistText = computed(() => {
  if (audioFiles.value.length === 0) return '请选择本地音乐文件'
  return ''
})

const parseLrc = (text: string): LyricLine[] => {
  if (!text) return []
  const lines = text.split('\n')
  const result: LyricLine[] = []
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g
  for (const line of lines) {
    const textContent = line.replace(timeRegex, '').trim()
    if (textContent) {
      let match: RegExpExecArray | null
      timeRegex.lastIndex = 0
      while ((match = timeRegex.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10)
        const seconds = parseInt(match[2], 10)
        const ms = parseInt(match[3].padEnd(3, '0'), 10)
        result.push({ time: minutes * 60 + seconds + ms / 1000, text: textContent })
      }
    }
  }
  return result.sort((a, b) => a.time - b.time)
}

const displayLyrics = (lrcText: string) => {
  const parsed = parseLrc(lrcText)
  lyricsData.value = parsed.length > 0 ? parsed : lrcText.split('\n').map((t) => ({ time: 0, text: t }))
  currentLyricLine.value = -1
}

const loadLyricsForFile = async (track: AudioTrack) => {
  const baseName = track.name.split('.').slice(0, -1).join('.')
  const lrcFile = lyricsFiles.value[baseName]
  if (lrcFile) {
    const reader = new FileReader()
    reader.onload = () => displayLyrics(String(reader.result ?? ''))
    reader.readAsText(lrcFile)
  } else {
    lyricsData.value = [{ time: 0, text: '未找到歌词' }]
  }
}

const playAudio = (index: number) => {
  if (index < 0 || index >= audioFiles.value.length) return
  const player = audioPlayer.value
  if (!player) return
  currentTrackIndex.value = index
  const track = audioFiles.value[index]
  player.src = track.url
  player.load()
  player.play().catch(() => {})
  lyricsData.value = [{ time: 0, text: '...' }]
  loadLyricsForFile(track)
}

const playPrevious = () => {
  if (currentTrackIndex.value > 0) playAudio(currentTrackIndex.value - 1)
}

const playNext = () => {
  if (currentTrackIndex.value < audioFiles.value.length - 1) playAudio(currentTrackIndex.value + 1)
}

const onEnded = () => playNext()

const onTimeUpdate = () => {
  const player = audioPlayer.value
  if (!player || lyricsData.value.length === 0 || player.paused) return
  const t = player.currentTime
  let idx = -1
  for (let i = 0; i < lyricsData.value.length; i++) {
    const next = lyricsData.value[i + 1]
    if (t >= lyricsData.value[i].time && (!next || t < next.time)) {
      idx = i
      break
    }
  }
  if (idx !== -1 && idx !== currentLyricLine.value) {
    currentLyricLine.value = idx
  }
}

const processFiles = (files: FileList) => {
  if (files.length === 0) return
  let added = false
  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const baseName = file.name.split('.').slice(0, -1).join('.')
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma'].includes(ext)) {
      if (!audioFiles.value.some((f) => f.name === file.name)) {
        audioFiles.value.push({ name: file.name, file, url: URL.createObjectURL(file) })
        added = true
      }
    } else if (['lrc', 'txt'].includes(ext)) {
      lyricsFiles.value[baseName] = file
    }
  }
  if (added && audioFiles.value.length > 0 && currentTrackIndex.value === -1) {
    playAudio(0)
  }
}

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) processFiles(target.files)
  target.value = ''
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = false
  if (e.dataTransfer?.files) processFiles(e.dataTransfer.files)
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
  isDragOver.value = true
}

const onDragLeave = () => {
  isDragOver.value = false
}

const switchMobileView = (view: 'playlist' | 'lyrics') => {
  mobileView.value = view
}

onMounted(() => {
  const player = audioPlayer.value
  if (player) {
    player.addEventListener('ended', onEnded)
    player.addEventListener('timeupdate', onTimeUpdate)
  }
})
onUnmounted(() => {
  const player = audioPlayer.value
  if (player) {
    player.removeEventListener('ended', onEnded)
    player.removeEventListener('timeupdate', onTimeUpdate)
  }
  audioFiles.value.forEach((t) => URL.revokeObjectURL(t.url))
})

watch(currentLyricLine, (idx) => {
  if (idx < 0) return
  const el = document.getElementById(`lyric-line-${idx}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
})
</script>

<template>
  <BackHome title="音乐播放器" />
  <div class="music-root" :class="{ dark: isDark }">
    <div class="container">
      <div class="header">
        <button class="theme-btn" @click="toggle">{{ isDark ? '☀️' : '🌙' }}</button>
        <h1>音乐播放器</h1>
        <div class="warning">支持本地音乐与歌词同步</div>
      </div>

      <div
        class="file-input-area"
        :class="{ dragover: isDragOver }"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <input ref="fileInput" type="file" multiple accept="audio/*,.lrc,.txt" style="display: none" @change="onFileChange" />
        <label @click="fileInput?.click()" class="file-input-label">
          <span>📁 点击选择 或 拖放本地音乐文件至此</span>
        </label>
      </div>

      <div class="view-toggle">
        <button :class="{ active: mobileView === 'playlist' }" @click="switchMobileView('playlist')">播放列表</button>
        <button :class="{ active: mobileView === 'lyrics' }" @click="switchMobileView('lyrics')">歌词</button>
      </div>

      <div class="main-content">
        <div class="playlist" :class="{ 'mobile-hidden': mobileView !== 'playlist' }">
          <div v-if="audioFiles.length === 0" class="empty">{{ playlistText }}</div>
          <div
            v-for="(track, i) in audioFiles"
            :key="track.name"
            :class="['track-item', { current: i === currentTrackIndex }]"
            @click="playAudio(i)"
          >
            {{ track.name }}
          </div>
        </div>
        <div class="lyrics" :class="{ 'mobile-hidden': mobileView !== 'lyrics' }">
          <div v-if="lyricsData.length === 0" class="empty">歌词将在此处同步显示</div>
          <div
            v-for="(line, i) in lyricsData"
            :id="`lyric-line-${i}`"
            :key="i"
            :class="['lyric-line', { current: i === currentLyricLine }]"
          >
            {{ line.text || '&nbsp;' }}
          </div>
        </div>
      </div>

      <div class="controls">
        <button title="上一曲" @click="playPrevious">⏮</button>
        <audio ref="audioPlayer" controls></audio>
        <button title="下一曲" @click="playNext">⏭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-root {
  background: #0c0c0c;
  color: #fff;
  min-height: calc(100vh - 49px);
  padding: 16px;
}
.music-root.dark {
  background: #1a1a1a;
}
.container {
  max-width: 900px;
  margin: 0 auto;
}
.header {
  text-align: center;
  margin-bottom: 24px;
  position: relative;
}
.theme-btn {
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  border: 1px solid #333;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
}
.header h1 {
  margin: 0;
  font-size: 28px;
}
.warning {
  color: #888;
  font-size: 14px;
  margin-top: 4px;
}
.file-input-area {
  border: 2px dashed #333;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  margin-bottom: 16px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.file-input-area.dragover {
  border-color: var(--accent);
}
.file-input-label {
  cursor: pointer;
  display: inline-block;
}
.view-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.view-toggle button {
  padding: 6px 16px;
  border: 1px solid #333;
  background: transparent;
  color: #aaa;
  border-radius: 8px;
  cursor: pointer;
}
.view-toggle button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.main-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}
.playlist,
.lyrics {
  background: #161616;
  border-radius: 12px;
  padding: 12px;
  max-height: 360px;
  overflow-y: auto;
}
.empty {
  color: #666;
  text-align: center;
  padding: 32px 0;
}
.track-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track-item:hover {
  background: #222;
}
.track-item.current {
  background: var(--accent);
  color: #fff;
}
.lyric-line {
  padding: 6px 12px;
  text-align: center;
  color: #888;
  transition: all 0.2s;
}
.lyric-line.current {
  color: var(--accent);
  font-weight: bold;
  transform: scale(1.05);
}
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.controls button {
  background: transparent;
  border: 1px solid #333;
  color: #fff;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
}
.controls button:hover {
  border-color: var(--accent);
}
.controls audio {
  flex: 1;
  max-width: 500px;
}
@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  .mobile-hidden {
    display: none;
  }
}
</style>
