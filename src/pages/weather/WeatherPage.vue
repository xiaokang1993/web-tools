<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'
import { useDebounce } from '@/composables/useDebounce'
import { useLocalStorage } from '@/composables/useLocalStorage'

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search'
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast'

interface GeoCity {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

interface WeatherInfo {
  icon: string
  desc: string
  bg: string
}

interface ForecastDay {
  dayName: string
  icon: string
  desc: string
  min: number
  max: number
}

interface WeatherState {
  cityName: string
  temperature: number
  condition: string
  icon: string
  windSpeed: number
  humidity: number
  visibility: number
  feelsLike: number
  forecast: ForecastDay[]
}

const WEATHER_CODES: Record<number, WeatherInfo> = {
  0: { icon: '☀️', desc: '晴朗', bg: 'var(--bg-sunny)' },
  1: { icon: '🌤️', desc: '多云', bg: 'var(--bg-sunny)' },
  2: { icon: '⛅', desc: '阴天', bg: 'var(--bg-cloudy)' },
  3: { icon: '☁️', desc: '阴', bg: 'var(--bg-cloudy)' },
  45: { icon: '🌫️', desc: '雾', bg: 'var(--bg-cloudy)' },
  48: { icon: '🌫️', desc: '雾凇', bg: 'var(--bg-cloudy)' },
  51: { icon: '🌧️', desc: '毛毛雨', bg: 'var(--bg-rainy)' },
  53: { icon: '🌧️', desc: '中雨', bg: 'var(--bg-rainy)' },
  55: { icon: '🌧️', desc: '大雨', bg: 'var(--bg-rainy)' },
  61: { icon: '🌧️', desc: '小雨', bg: 'var(--bg-rainy)' },
  63: { icon: '🌧️', desc: '中雨', bg: 'var(--bg-rainy)' },
  65: { icon: '🌧️', desc: '大雨', bg: 'var(--bg-rainy)' },
  71: { icon: '❄️', desc: '小雪', bg: 'var(--bg-cloudy)' },
  73: { icon: '❄️', desc: '中雪', bg: 'var(--bg-cloudy)' },
  75: { icon: '❄️', desc: '大雪', bg: 'var(--bg-cloudy)' },
  95: { icon: '⛈️', desc: '雷雨', bg: 'var(--bg-rainy)' },
}

const DEFAULT_WEATHER_INFO: WeatherInfo = { icon: '❓', desc: '未知', bg: 'var(--bg-sunny)' }

function getWeatherInfo(code: number): WeatherInfo {
  return WEATHER_CODES[code] ?? DEFAULT_WEATHER_INFO
}

const searchInput = ref('')
const suggestions = ref<GeoCity[]>([])
const showSuggestions = ref(false)
const loading = ref(false)
const errorMsg = ref('')

const weather = ref<WeatherState>({
  cityName: '北京',
  temperature: 0,
  condition: '--',
  icon: '☀️',
  windSpeed: 0,
  humidity: 0,
  visibility: 0,
  feelsLike: 0,
  forecast: [],
})

const background = ref('var(--bg-sunny)')

// 增强功能：收藏城市与最近搜索
interface SavedCity {
  name: string
  country: string
  latitude: number
  longitude: number
}

const favorites = useLocalStorage<SavedCity[]>('weather-favorites', [])
const recentSearches = useLocalStorage<SavedCity[]>('weather-recent', [])

function isFavorite(city: SavedCity): boolean {
  return favorites.value.some(
    (c) => c.latitude === city.latitude && c.longitude === city.longitude,
  )
}

const currentFavorite = computed(() => {
  const c = lastSelected.value
  if (!c) return false
  return isFavorite({
    name: c.name,
    country: c.country,
    latitude: c.latitude,
    longitude: c.longitude,
  })
})

const lastSelected = ref<SavedCity | null>(null)

function toggleFavorite(): void {
  if (!lastSelected.value) return
  const city = lastSelected.value
  if (currentFavorite.value) {
    favorites.value = favorites.value.filter(
      (c) => !(c.latitude === city.latitude && c.longitude === city.longitude),
    )
  } else {
    favorites.value = [...favorites.value, city]
  }
}

function pushRecent(city: SavedCity): void {
  const filtered = recentSearches.value.filter(
    (c) => !(c.latitude === city.latitude && c.longitude === city.longitude),
  )
  recentSearches.value = [city, ...filtered].slice(0, 5)
}

// 城市搜索
async function searchCity(query: string): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  try {
    const res = await fetch(
      `${GEO_API}?name=${encodeURIComponent(trimmed)}&count=5&language=zh&format=json`,
    )
    const data = (await res.json()) as { results?: GeoCity[] }
    if (data.results) {
      suggestions.value = data.results
      showSuggestions.value = true
    } else {
      suggestions.value = []
      showSuggestions.value = false
    }
  } catch (err) {
    console.error('Search error:', err)
  }
}

const debouncedSearch = useDebounce((val: string) => {
  void searchCity(val)
}, 500)

function onInput(): void {
  debouncedSearch(searchInput.value)
}

async function selectCity(city: GeoCity): Promise<void> {
  showSuggestions.value = false
  searchInput.value = city.name
  const saved: SavedCity = {
    name: city.name,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
  }
  lastSelected.value = saved
  pushRecent(saved)
  await fetchWeather(city.latitude, city.longitude, city.name)
}

async function selectSaved(city: SavedCity): Promise<void> {
  lastSelected.value = city
  searchInput.value = city.name
  pushRecent(city)
  await fetchWeather(city.latitude, city.longitude, city.name)
}

// 获取天气
async function fetchWeather(lat: number, lon: number, cityName: string): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(
      `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=relativehumidity_2m,visibility,apparent_temperature&timezone=auto`,
    )
    const data = (await res.json()) as {
      current_weather: {
        temperature: number
        weathercode: number
        windspeed: number
      }
      hourly: {
        relativehumidity_2m: number[]
        visibility: number[]
        apparent_temperature: number[]
      }
      daily: {
        weathercode: number[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
      }
    }
    updateUI(data, cityName)
  } catch (err) {
    errorMsg.value = '获取天气信息失败，请稍后重试'
    console.error(err)
  } finally {
    loading.value = false
  }
}

function updateUI(
  data: {
    current_weather: { temperature: number; weathercode: number; windspeed: number }
    hourly: {
      relativehumidity_2m: number[]
      visibility: number[]
      apparent_temperature: number[]
    }
    daily: {
      weathercode: number[]
      temperature_2m_max: number[]
      temperature_2m_min: number[]
    }
  },
  cityName: string,
): void {
  const current = data.current_weather
  const info = getWeatherInfo(current.weathercode)

  // 取当前小时的数据
  const hourIndex = new Date().getHours()
  const safeHour = Math.min(hourIndex, data.hourly.relativehumidity_2m.length - 1)

  const forecast: ForecastDay[] = []
  for (let i = 1; i <= 3; i++) {
    const code = data.daily.weathercode[i]
    const dayInfo = getWeatherInfo(code)
    const date = new Date()
    date.setDate(date.getDate() + i)
    forecast.push({
      dayName: date.toLocaleDateString('zh-CN', { weekday: 'short' }),
      icon: dayInfo.icon,
      desc: dayInfo.desc,
      min: Math.round(data.daily.temperature_2m_min[i]),
      max: Math.round(data.daily.temperature_2m_max[i]),
    })
  }

  weather.value = {
    cityName,
    temperature: Math.round(current.temperature),
    condition: info.desc,
    icon: info.icon,
    windSpeed: current.windspeed,
    humidity: data.hourly.relativehumidity_2m[safeHour],
    visibility: data.hourly.visibility[safeHour] / 1000,
    feelsLike: Math.round(data.hourly.apparent_temperature[safeHour]),
    forecast,
  }

  background.value = info.bg
}

// 浏览器定位
function useGeolocation(): void {
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持定位功能'
    return
  }
  loading.value = true
  errorMsg.value = ''
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords
      // 通过反向地理编码获取城市名
      try {
        const res = await fetch(
          `${GEO_API}?latitude=${latitude}&longitude=${longitude}&count=1&language=zh&format=json`,
        )
        const data = (await res.json()) as { results?: GeoCity[] }
        if (data.results && data.results.length > 0) {
          const city = data.results[0]
          const saved: SavedCity = {
            name: city.name,
            country: city.country,
            latitude: city.latitude,
            longitude: city.longitude,
          }
          lastSelected.value = saved
          searchInput.value = city.name
          pushRecent(saved)
          await fetchWeather(city.latitude, city.longitude, city.name)
        } else {
          // 直接用坐标请求天气
          await fetchWeather(latitude, longitude, '当前位置')
          lastSelected.value = {
            name: '当前位置',
            country: '',
            latitude,
            longitude,
          }
        }
      } catch (err) {
        errorMsg.value = '定位解析失败，请稍后重试'
        console.error(err)
      } finally {
        loading.value = false
      }
    },
    (err) => {
      loading.value = false
      const msgMap: Record<number, string> = {
        1: '定位权限被拒绝',
        2: '定位不可用',
        3: '定位超时',
      }
      errorMsg.value = msgMap[err.code] ?? '定位失败'
    },
    { enableHighAccuracy: true, timeout: 10000 },
  )
}

// 点击外部关闭建议
function onDocumentClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (!target.closest('.search-box')) {
    showSuggestions.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  // 默认加载北京天气
  void fetchWeather(39.9042, 116.4074, '北京')
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})
</script>
<template>
  <BackHome title="实时天气" />
  <div class="weather-page" :style="{ background }">
    <div class="container">
      <!-- 搜索区 -->
      <div class="search-box">
        <input
          v-model="searchInput"
          type="text"
          class="search-input"
          placeholder="输入城市名称 (如: 北京, Shanghai)..."
          @input="onInput"
          @keyup.enter="searchCity(searchInput)"
        />
        <button class="search-btn" type="button" @click="searchCity(searchInput)">🔍</button>
        <button
          class="geo-btn"
          type="button"
          title="使用当前位置"
          @click="useGeolocation"
        >
          📍
        </button>

        <div v-if="showSuggestions && suggestions.length" class="suggestions">
          <div
            v-for="city in suggestions"
            :key="city.id"
            class="suggestion-item"
            @click="selectCity(city)"
          >
            {{ city.name }}
            <small class="suggestion-sub">
              {{ city.admin1 ? `${city.admin1} · ` : '' }}{{ city.country }}
            </small>
          </div>
        </div>
      </div>

      <!-- 收藏栏 -->
      <div v-if="favorites.length > 0" class="favorites-bar">
        <span class="favorites-label">收藏</span>
        <button
          v-for="c in favorites"
          :key="`${c.latitude}-${c.longitude}`"
          class="chip"
          type="button"
          @click="selectSaved(c)"
        >
          ⭐ {{ c.name }}
        </button>
      </div>

      <!-- 最近搜索 -->
      <div v-if="recentSearches.length > 0" class="recent-bar">
        <span class="favorites-label">最近</span>
        <button
          v-for="c in recentSearches"
          :key="`r-${c.latitude}-${c.longitude}`"
          class="chip chip-recent"
          type="button"
          @click="selectSaved(c)"
        >
          {{ c.name }}
        </button>
      </div>

      <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      <div v-if="loading" class="loading">加载中...</div>

      <div class="weather-content" :class="{ loading: loading }">
        <div class="weather-main">
          <div class="city-row">
            <h2 class="city-name">{{ weather.cityName }}</h2>
            <button
              v-if="lastSelected"
              class="fav-btn"
              type="button"
              :title="currentFavorite ? '取消收藏' : '添加收藏'"
              @click="toggleFavorite"
            >
              {{ currentFavorite ? '★' : '☆' }}
            </button>
          </div>
          <div class="weather-icon">{{ weather.icon }}</div>
          <div class="temperature">{{ weather.temperature }}</div>
          <div class="condition">{{ weather.condition }}</div>
        </div>

        <div class="details-grid">
          <div class="detail-item">
            <span class="detail-icon">💧</span>
            <div class="detail-info">
              <span class="detail-label">湿度</span>
              <span class="detail-value">{{ weather.humidity }}%</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-icon">💨</span>
            <div class="detail-info">
              <span class="detail-label">风速</span>
              <span class="detail-value">{{ weather.windSpeed }} km/h</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-icon">🌡️</span>
            <div class="detail-info">
              <span class="detail-label">体感</span>
              <span class="detail-value">{{ weather.feelsLike }}°</span>
            </div>
          </div>
          <div class="detail-item">
            <span class="detail-icon">👁️</span>
            <div class="detail-info">
              <span class="detail-label">能见度</span>
              <span class="detail-value">{{ weather.visibility }} km</span>
            </div>
          </div>
        </div>

        <div class="forecast">
          <div class="forecast-title">未来 3 天预报</div>
          <div class="forecast-list">
            <div v-for="(f, i) in weather.forecast" :key="i" class="forecast-item">
              <span class="forecast-day">{{ f.dayName }}</span>
              <span class="forecast-icon">{{ f.icon }}</span>
              <span class="forecast-temp">{{ f.min }}° / {{ f.max }}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.weather-page {
  min-height: calc(100vh - 49px);
  background: var(--bg-sunny);
  transition: background 1s ease;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px 16px;
}

:root {
  --bg-sunny: linear-gradient(135deg, #56ccf2 0%, #2f80ed 100%);
  --bg-cloudy: linear-gradient(135deg, #bbd2c5 0%, #536976 100%);
  --bg-rainy: linear-gradient(135deg, #4b6cb7 0%, #182848 100%);
}

html.dark .weather-page {
  --bg-sunny: linear-gradient(135deg, #1f3a5f 0%, #0d1b2a 100%);
  --bg-cloudy: linear-gradient(135deg, #3a4756 0%, #1e2a36 100%);
  --bg-rainy: linear-gradient(135deg, #2a3258 0%, #11182a 100%);
}

.container {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border-radius: 30px;
  padding: 30px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: slideup 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  color: #fff;
}

html.dark .container {
  background: rgba(20, 22, 30, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Search */
.search-box {
  position: relative;
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
  padding: 15px 80px 15px 20px;
  border-radius: 25px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: all 0.3s;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.7);
}

.search-input:focus {
  background: rgba(255, 255, 255, 0.3);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

html.dark .search-input {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.search-btn,
.geo-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #fff;
  padding: 10px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: transform 0.2s;
}

.search-btn {
  right: 44px;
}

.geo-btn {
  right: 5px;
}

.search-btn:hover,
.geo-btn:hover {
  transform: translateY(-50%) scale(1.1);
}

/* Favorites / Recent */
.favorites-bar,
.recent-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.favorites-label {
  font-size: 0.75rem;
  opacity: 0.75;
  margin-right: 4px;
}

.chip {
  padding: 4px 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.chip:hover {
  background: rgba(255, 255, 255, 0.25);
}

.chip-recent {
  border-color: rgba(255, 255, 255, 0.18);
}

/* Main Weather */
.weather-main {
  text-align: center;
  margin-bottom: 40px;
}

.city-row {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.city-name {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.fav-btn {
  background: none;
  border: none;
  color: #ffd54f;
  font-size: 1.4rem;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.2s;
}

.fav-btn:hover {
  transform: scale(1.2);
}

.weather-icon {
  font-size: 5rem;
  margin: 10px 0;
  animation: float 3s ease-in-out infinite;
  display: inline-block;
}

.temperature {
  font-size: 4.5rem;
  font-weight: 300;
  margin-bottom: 10px;
  position: relative;
  display: inline-block;
}

.temperature::after {
  content: '°';
  position: absolute;
  top: 0;
  right: -20px;
  font-size: 2.5rem;
}

.condition {
  font-size: 1.2rem;
  opacity: 0.9;
  text-transform: capitalize;
}

/* Details Grid */
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 30px;
}

.detail-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: transform 0.2s, background 0.2s;
}

.detail-item:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.15);
}

.detail-icon {
  font-size: 1.5rem;
}

.detail-info {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: 0.8rem;
  opacity: 0.7;
}

.detail-value {
  font-weight: 600;
  font-size: 1.1rem;
}

/* Forecast */
.forecast {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 20px;
}

.forecast-title {
  font-size: 0.9rem;
  margin-bottom: 15px;
  opacity: 0.8;
}

.forecast-list {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.forecast-item {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex: 1;
}

.forecast-day {
  font-size: 0.8rem;
  opacity: 0.8;
}

.forecast-icon {
  font-size: 1.5rem;
}

.forecast-temp {
  font-weight: 600;
  font-size: 0.9rem;
}

/* Loading & Error */
.loading {
  text-align: center;
  font-size: 1.1rem;
  padding: 10px 0;
  opacity: 0.85;
}

.error-msg {
  background: rgba(255, 59, 48, 0.8);
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.weather-content {
  transition: opacity 0.3s;
}

.weather-content.loading {
  opacity: 0.5;
}

/* Suggestion Box */
.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 15px;
  margin-top: 5px;
  overflow: hidden;
  color: #333;
  z-index: 10;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
}

html.dark .suggestions {
  background: rgba(30, 32, 42, 0.98);
  color: #e4e6eb;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
}

.suggestion-item {
  padding: 12px 20px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

html.dark .suggestion-item {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

html.dark .suggestion-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.suggestion-sub {
  color: #888;
  font-size: 0.75rem;
}

html.dark .suggestion-sub {
  color: #9aa0a8;
}

@keyframes slideup {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 420px) {
  .container {
    padding: 22px 18px;
  }
  .temperature {
    font-size: 3.8rem;
  }
}
</style>
