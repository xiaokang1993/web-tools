<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'

interface SearchResult {
  id: string
  name: string
  artist: string[] | string
  album: string
  source: string
  pic_id: string
  lyric_id: string
}

interface LyricLine {
  time: number
  text: string
}

const API_BASE = 'https://music-api.gdstudio.xyz/api.php'

const searchInput = ref('')
const sourceSelect = ref('netease')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const searchError = ref('')

const currentPlaylist = ref<SearchResult[]>([])
const currentIndex = ref(-1)
const currentLyrics = ref<LyricLine[]>([])
const activeLyricIndex = ref(-1)
const isPlaying = ref(false)
const qualitySelect = ref('320')
const volumeValue = ref(80)

const audioPlayer = ref<HTMLAudioElement | null>(null)
const currentTitle = ref('未选择歌曲')
const currentArtist = ref('请搜索并选择要播放的歌曲')
const currentCover = ref('')
const progressPercent = ref(0)
const currentTimeText = ref('0:00')
const totalTimeText = ref('0:00')

const notification = ref({ visible: false, message: '', type: 'info' })
let notifyTimer: ReturnType<typeof setTimeout> | undefined

const QUALITY_TEXT: Record<string, string> = {
  '128': '标准音质',
  '192': '较高音质',
  '320': '高品质',
  '740': '无损音质',
  '999': 'Hi-Res音质'
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const showNotification = (message: string, type = 'info') => {
  notification.value = { visible: true, message, type }
  clearTimeout(notifyTimer)
  notifyTimer = setTimeout(() => {
    notification.value.visible = false
  }, 3000)
}

const defaultCover = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjIwIiBoZWlnaHQ9IjIyMCIgdmlld0JveD0iMCAwIDIyMCAyMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMjAiIGhlaWdodD0iMjIwIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHJ4PSIyMCIvPgo8cGF0aCBkPSJNMTEwIDcwTDE0MCAxMTBIMTIwVjE1MEg5MFYxMTBINzBMMTEwIDcwWiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjMpIi8+Cjwvc3ZnPgo='

const searchMusic = async () => {
  const keyword = searchInput.value.trim()
  if (!keyword) {
    showNotification('请输入搜索关键词', 'warning')
    return
  }
  isSearching.value = true
  searchError.value = ''
  searchResults.value = []
  try {
    const res = await fetch(`${API_BASE}?types=search&source=${sourceSelect.value}&name=${encodeURIComponent(keyword)}&count=30`)
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      searchResults.value = data as SearchResult[]
      currentPlaylist.value = data as SearchResult[]
    } else {
      searchError.value = '未找到相关歌曲，请尝试其他关键词'
    }
  } catch {
    searchError.value = '网络连接失败，请检查网络后重试'
  } finally {
    isSearching.value = false
  }
}

const getAlbumCoverUrl = async (song: SearchResult): Promise<string> => {
  if (!song.pic_id) return defaultCover
  try {
    const res = await fetch(`${API_BASE}?types=pic&source=${song.source}&id=${song.pic_id}&size=300`)
    const data = await res.json()
    return data?.url ?? defaultCover
  } catch {
    return defaultCover
  }
}

const playSong = async (index: number) => {
  if (index < 0 || index >= currentPlaylist.value.length) return
  currentIndex.value = index
  const song = currentPlaylist.value[index]
  currentTitle.value = song.name
  const artistStr = Array.isArray(song.artist) ? song.artist.join(' / ') : song.artist
  currentArtist.value = `${artistStr} · ${song.album}`
  currentCover.value = defaultCover
  showNotification('正在加载音乐...', 'info')
  try {
    const urlRes = await fetch(`${API_BASE}?types=url&source=${song.source}&id=${song.id}&br=${qualitySelect.value}`)
    const urlData = await urlRes.json()
    const player = audioPlayer.value
    if (urlData?.url && player) {
      player.src = urlData.url
      player.load()
      loadLyrics(song)
      currentCover.value = await getAlbumCoverUrl(song)
      await player.play()
      showNotification(`开始播放 (${QUALITY_TEXT[urlData.br ?? qualitySelect.value] ?? qualitySelect.value + 'K'})`, 'success')
    } else {
      showNotification('无法获取音乐链接，请尝试其他歌曲或更换音质', 'error')
    }
  } catch {
    showNotification('播放失败，请检查网络连接', 'error')
  }
}

const loadLyrics = async (song: SearchResult) => {
  try {
    const res = await fetch(`${API_BASE}?types=lyric&source=${song.source}&id=${song.lyric_id || song.id}`)
    const data = await res.json()
    if (data?.lyric) {
      parseLyrics(data.lyric)
    } else {
      currentLyrics.value = [{ time: 0, text: '暂无歌词' }]
    }
  } catch {
    currentLyrics.value = [{ time: 0, text: '歌词加载失败' }]
  }
}

const parseLyrics = (lrcText: string) => {
  const lines = lrcText.split('\n')
  const result: LyricLine[] = []
  for (const line of lines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/)
    if (match) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const ms = parseInt(match[3].padEnd(3, '0'), 10)
      const text = match[4].trim()
      if (text) result.push({ time: minutes * 60 + seconds + ms / 1000, text })
    }
  }
  result.sort((a, b) => a.time - b.time)
  currentLyrics.value = result.length > 0 ? result : [{ time: 0, text: '暂无歌词' }]
}

const updateLyricHighlight = () => {
  const player = audioPlayer.value
  if (!player) return
  const t = player.currentTime
  let idx = -1
  for (let i = 0; i < currentLyrics.value.length; i++) {
    if (currentLyrics.value[i].time <= t) idx = i
    else break
  }
  if (idx !== activeLyricIndex.value) {
    activeLyricIndex.value = idx
    const el = document.getElementById(`lyric-line-${idx}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

const togglePlay = () => {
  const player = audioPlayer.value
  if (!player) return
  if (player.src) {
    if (isPlaying.value) player.pause()
    else player.play()
  } else {
    showNotification('请先选择要播放的歌曲', 'warning')
  }
}

const previousSong = () => {
  if (currentIndex.value > 0) playSong(currentIndex.value - 1)
  else showNotification('已经是第一首歌曲', 'info')
}
const nextSong = () => {
  if (currentIndex.value < currentPlaylist.value.length - 1) playSong(currentIndex.value + 1)
  else showNotification('已经是最后一首歌曲', 'info')
}

const seekTo = (e: MouseEvent) => {
  const player = audioPlayer.value
  if (!player || !player.duration) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  player.currentTime = percent * player.duration
}

const setVolume = (value: number) => {
  const player = audioPlayer.value
  if (!player) return
  player.volume = value / 100
}

const downloadSong = async (index: number) => {
  const song = currentPlaylist.value[index]
  try {
    const res = await fetch(`${API_BASE}?types=url&source=${song.source}&id=${song.id}&br=${qualitySelect.value}`)
    const data = await res.json()
    if (data?.url) {
      const link = document.createElement('a')
      link.href = data.url
      link.download = `${song.name}.mp3`
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showNotification('开始下载音乐文件', 'success')
    } else {
      showNotification('无法获取下载链接', 'error')
    }
  } catch {
    showNotification('下载失败，请稍后重试', 'error')
  }
}

const onTimeUpdate = () => {
  const player = audioPlayer.value
  if (!player || !player.duration) return
  progressPercent.value = (player.currentTime / player.duration) * 100
  currentTimeText.value = formatTime(player.currentTime)
  updateLyricHighlight()
}
const onLoadedMetadata = () => {
  const player = audioPlayer.value
  if (player?.duration) totalTimeText.value = formatTime(player.duration)
}
const onEnded = () => nextSong()
const onPlay = () => { isPlaying.value = true }
const onPause = () => { isPlaying.value = false }

const onKeydown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName
  if (e.code === 'Space' && tag !== 'INPUT') { e.preventDefault(); togglePlay() }
  else if (e.code === 'ArrowLeft' && tag !== 'INPUT') { e.preventDefault(); previousSong() }
  else if (e.code === 'ArrowRight' && tag !== 'INPUT') { e.preventDefault(); nextSong() }
}

onMounted(() => {
  const player = audioPlayer.value
  if (player) {
    player.addEventListener('timeupdate', onTimeUpdate)
    player.addEventListener('loadedmetadata', onLoadedMetadata)
    player.addEventListener('ended', onEnded)
    player.addEventListener('play', onPlay)
    player.addEventListener('pause', onPause)
    player.volume = 0.8
  }
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  const player = audioPlayer.value
  if (player) {
    player.removeEventListener('timeupdate', onTimeUpdate)
    player.removeEventListener('loadedmetadata', onLoadedMetadata)
    player.removeEventListener('ended', onEnded)
    player.removeEventListener('play', onPlay)
    player.removeEventListener('pause', onPause)
  }
  document.removeEventListener('keydown', onKeydown)
})

const artistText = (a: string[] | string) => Array.isArray(a) ? a.join(' / ') : a
</script>

<template>
  <BackHome title="云音乐" />
  <div class="music-root">
    <nav class="navbar">
      <div class="nav-container">
        <div class="logo">🎵 <span>云音乐</span></div>
        <div class="search-wrapper">
          <input v-model="searchInput" type="text" placeholder="搜索音乐、歌手、专辑..." class="search-input" @keyup.enter="searchMusic" />
          <select v-model="sourceSelect" class="source-select">
            <option value="netease">网易云</option>
            <option value="tencent">QQ音乐</option>
            <option value="kuwo">酷我</option>
            <option value="kugou">酷狗</option>
            <option value="migu">咪咕</option>
          </select>
          <button class="search-btn" @click="searchMusic">🔍</button>
        </div>
      </div>
    </nav>

    <div class="main-container">
      <div class="content-section">
        <h2 class="section-title">📋 搜索结果</h2>
        <div class="search-results">
          <div v-if="isSearching" class="loading">正在搜索音乐...</div>
          <div v-else-if="searchError" class="error">{{ searchError }}</div>
          <div v-else-if="searchResults.length === 0" class="empty-state">
            <div>在上方搜索框输入关键词开始搜索音乐</div>
          </div>
          <div
            v-for="(song, index) in searchResults"
            :key="`${song.id}-${index}`"
            :class="['song-item', { active: index === currentIndex }]"
            @click="playSong(index)"
          >
            <div class="song-index">{{ (index + 1).toString().padStart(2, '0') }}</div>
            <div class="song-info">
              <div class="song-name">{{ song.name }}</div>
              <div class="song-artist">{{ artistText(song.artist) }} · {{ song.album }}</div>
            </div>
            <button class="action-btn" @click.stop="downloadSong(index)" title="下载">⬇</button>
          </div>
        </div>
      </div>

      <div class="player-section">
        <div class="current-song">
          <img class="current-cover" :src="currentCover || defaultCover" alt="封面" />
          <div class="current-info">
            <h3>{{ currentTitle }}</h3>
            <p>{{ currentArtist }}</p>
          </div>
        </div>

        <div class="player-controls">
          <button class="ctrl-btn small" @click="previousSong">⏮</button>
          <button class="ctrl-btn play-btn" @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</button>
          <button class="ctrl-btn small" @click="nextSong">⏭</button>
        </div>

        <div class="progress-container">
          <div class="progress-bar" @click="seekTo">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <div class="time-info">
            <span>{{ currentTimeText }}</span>
            <span>{{ totalTimeText }}</span>
          </div>
        </div>

        <div class="quality-container">
          <span>音质</span>
          <select v-model="qualitySelect" class="quality-select">
            <option value="128">标准 128K</option>
            <option value="192">较高 192K</option>
            <option value="320">高品质 320K</option>
            <option value="740">无损 FLAC</option>
            <option value="999">Hi-Res</option>
          </select>
        </div>

        <div class="volume-container">
          <span>🔊</span>
          <input type="range" min="0" max="100" v-model.number="volumeValue" class="volume-slider" @input="setVolume(volumeValue)" />
        </div>

        <audio ref="audioPlayer" preload="metadata"></audio>
      </div>

      <div class="lyrics-section">
        <h2 class="section-title">📜 歌词</h2>
        <div class="lyrics-container">
          <div
            v-for="(line, i) in currentLyrics"
            :id="`lyric-line-${i}`"
            :key="i"
            :class="['lyric-line', { active: i === activeLyricIndex }]"
            @click="audioPlayer && (audioPlayer.currentTime = line.time)"
          >{{ line.text }}</div>
        </div>
      </div>
    </div>

    <Transition name="notify">
      <div v-if="notification.visible" :class="['notification', notification.type]">
        {{ notification.message }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.music-root {
  background: #0c0c0c;
  color: #fff;
  min-height: calc(100vh - 49px);
  position: relative;
}
.navbar {
  background: rgba(0, 0, 0, 0.8);
  padding: 12px 24px;
  border-bottom: 1px solid #222;
}
.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.logo {
  font-size: 20px;
  font-weight: bold;
}
.search-wrapper {
  display: flex;
  flex: 1;
  max-width: 600px;
  gap: 8px;
}
.search-input {
  flex: 1;
  padding: 8px 12px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  border-radius: 8px;
  outline: none;
}
.source-select, .quality-select {
  padding: 8px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #fff;
  border-radius: 8px;
}
.search-btn {
  padding: 8px 16px;
  background: var(--accent);
  border: none;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
}
.main-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 400px 1fr;
  gap: 24px;
}
@media (max-width: 900px) {
  .main-container {
    grid-template-columns: 1fr;
  }
}
.section-title {
  font-size: 16px;
  margin: 0 0 16px;
  color: #aaa;
}
.search-results {
  background: #161616;
  border-radius: 12px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}
.loading, .error, .empty-state {
  text-align: center;
  padding: 48px 16px;
  color: #666;
}
.song-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.song-item:hover {
  background: #222;
}
.song-item.active {
  background: var(--accent);
}
.song-index {
  color: #666;
  width: 30px;
}
.song-info {
  flex: 1;
  min-width: 0;
}
.song-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.song-artist {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.action-btn {
  background: transparent;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: pointer;
}
.player-section {
  background: #161616;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}
.current-song {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.current-cover {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  object-fit: cover;
  background: #222;
}
.current-info h3 {
  margin: 0;
  font-size: 18px;
}
.current-info p {
  margin: 4px 0 0;
  color: #888;
  font-size: 14px;
}
.player-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 20px;
}
.ctrl-btn {
  background: #222;
  border: none;
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.15s;
}
.ctrl-btn.small {
  width: 40px;
  height: 40px;
}
.ctrl-btn.play-btn {
  width: 56px;
  height: 56px;
  font-size: 22px;
  background: var(--accent);
}
.ctrl-btn:hover {
  background: #333;
}
.progress-container {
  margin-bottom: 16px;
}
.progress-bar {
  height: 6px;
  background: #222;
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.1s;
}
.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
.quality-container, .volume-container {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  margin-bottom: 12px;
  font-size: 14px;
}
.volume-slider {
  width: 120px;
}
.lyrics-section {
  background: #161616;
  border-radius: 12px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}
.lyric-line {
  padding: 8px;
  text-align: center;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}
.lyric-line:hover {
  color: #aaa;
}
.lyric-line.active {
  color: var(--accent);
  font-weight: bold;
  transform: scale(1.05);
}
.notification {
  position: fixed;
  top: 100px;
  right: 30px;
  color: white;
  padding: 12px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  max-width: 300px;
  font-size: 14px;
}
.notification.success { background: rgba(76, 175, 80, 0.9); }
.notification.error { background: rgba(244, 67, 54, 0.9); }
.notification.warning { background: rgba(255, 152, 0, 0.9); }
.notification.info { background: rgba(33, 150, 243, 0.9); }
.notify-enter-active, .notify-leave-active {
  transition: transform 0.3s ease;
}
.notify-enter-from, .notify-leave-to {
  transform: translateX(400px);
}
</style>
