<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CryptoJS from 'crypto-js'
import * as XLSX from 'xlsx'
import BackHome from '@/components/BackHome.vue'

interface GiftData {
  name: string
  amount: number
  type: string
  remarks: string
  timestamp: string
}

interface GiftRecord {
  id: number
  eventId: number
  encryptedData: string
  data: GiftData | null
}

interface GiftEvent {
  id?: number
  name: string
  startDateTime: string
  endDateTime: string
  passwordHash: string
}

const ITEMS_PER_PAGE = 12

let db: IDBDatabase | null = null
const allEvents = ref<GiftEvent[]>([])
const currentEvent = ref<GiftEvent | null>(null)
const currentPassword = ref('')
const gifts = ref<GiftRecord[]>([])
const currentPage = ref(1)
const isSpeechEnabled = ref(true)
const showMainScreen = ref(false)
const eventDropdownOpen = ref(false)

const modalVisible = ref(false)
const modalTitle = ref('')
const modalContent = ref('')
const modalActions = ref<{ text: string; class: string; handler?: () => void; keepOpen?: boolean }[]>([])

const newEventName = ref('')
const newStartDate = ref('')
const newStartTime = ref('')
const newEndDate = ref('')
const newEndTime = ref('')
const newPassword = ref('')

const guestName = ref('')
const giftAmount = ref('')
const paymentType = ref('现金')
const remarks = ref('')
const searchName = ref('')

const formGiftName = ref('')
const formAmount = ref('')
const formRemarks = ref('')
const selectedEventId = ref<number | null>(null)

const totalPages = computed(() => Math.ceil(gifts.value.length / ITEMS_PER_PAGE) || 1)
const pageItems = computed(() =>
  gifts.value.slice((currentPage.value - 1) * ITEMS_PER_PAGE, currentPage.value * ITEMS_PER_PAGE)
)
const pageSubtotal = computed(() =>
  pageItems.value.reduce((sum, g) => sum + (g.data?.amount ?? 0), 0)
)
const totalAmount = computed(() => gifts.value.reduce((sum, g) => sum + (g.data?.amount ?? 0), 0))
const totalGivers = computed(() => gifts.value.length)

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount)

const encryptData = (data: GiftData, key: string) =>
  CryptoJS.AES.encrypt(JSON.stringify(data), key).toString()

const decryptData = (ciphertext: string, key: string): GiftData | null => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, key)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    return result ? (JSON.parse(result) as GiftData) : null
  } catch {
    return null
  }
}

const hashPassword = (password: string) => CryptoJS.SHA256(password).toString()

const showModal = (title: string, content: string, actions: { text: string; class: string; handler?: () => void; keepOpen?: boolean }[]) => {
  modalTitle.value = title
  modalContent.value = content
  modalActions.value = actions
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const showAlert = (title: string, message: string) => {
  showModal(title, `<p>${message}</p>`, [{ text: '确定', class: 'bg-red-500 text-white px-4 py-2 rounded', handler: closeModal }])
}

const initDB = () => {
  const request = indexedDB.open('GiftRegistryDB', 1)
  request.onerror = () => console.error('Database error')
  request.onsuccess = (e) => {
    db = (e.target as IDBOpenDBRequest).result as IDBDatabase
    loadEvents()
  }
  request.onupgradeneeded = (e) => {
    const database = (e.target as IDBOpenDBRequest).result as IDBDatabase
    database.createObjectStore('events', { keyPath: 'id', autoIncrement: true })
    const giftStore = database.createObjectStore('gifts', { keyPath: 'id', autoIncrement: true })
    giftStore.createIndex('eventId', 'eventId', { unique: false })
  }
}

const loadEvents = () => {
  if (!db) return
  const request = db.transaction(['events'], 'readonly').objectStore('events').getAll()
  request.onsuccess = () => {
    allEvents.value = request.result as GiftEvent[]
  }
}

const createEvent = () => {
  const startDateTime = `${newStartDate.value}T${newStartTime.value}`
  const endDateTime = `${newEndDate.value}T${newEndTime.value}`
  if (new Date(startDateTime) >= new Date(endDateTime)) {
    showAlert('错误', '开始时间必须早于结束时间。')
    return
  }
  const newEvent: GiftEvent = {
    name: newEventName.value,
    startDateTime,
    endDateTime,
    passwordHash: hashPassword(newPassword.value)
  }
  if (!db) return
  const request = db.transaction(['events'], 'readwrite').objectStore('events').add(newEvent)
  request.onsuccess = () => {
    currentEvent.value = { ...newEvent, id: request.result as number }
    currentPassword.value = newPassword.value
    loadEvents()
    startSession()
  }
}

const unlockEvent = (eventId: number) => {
  showModal('输入管理密码', `<input type="password" id="modal-password" class="w-full p-2 border rounded" placeholder="请输入密码">`, [
    { text: '取消', class: 'bg-gray-200 px-4 py-2 rounded hover:bg-gray-300', handler: closeModal },
    {
      text: '确认',
      class: 'bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700',
      keepOpen: true,
      handler: () => {
        const input = document.getElementById('modal-password') as HTMLInputElement | null
        const password = input?.value ?? ''
        const event = allEvents.value.find((e) => e.id === eventId)
        if (event && event.passwordHash === hashPassword(password)) {
          currentEvent.value = event
          currentPassword.value = password
          closeModal()
          startSession()
        } else {
          showAlert('错误', '密码错误！')
        }
      }
    }
  ])
  setTimeout(() => {
    const input = document.getElementById('modal-password') as HTMLInputElement | null
    input?.focus()
  }, 100)
}

const startSession = () => {
  loadGiftsForCurrentEvent()
  showMainScreen.value = true
}

const loadGiftsForCurrentEvent = () => {
  if (!db || !currentEvent.value?.id) return
  const index = db.transaction(['gifts'], 'readonly').objectStore('gifts').index('eventId')
  const request = index.getAll(currentEvent.value.id)
  request.onsuccess = () => {
    const encrypted = request.result as GiftRecord[]
    gifts.value = encrypted
      .map((g) => ({ ...g, data: decryptData(g.encryptedData, currentPassword.value) }))
      .filter((g) => g.data !== null)
    currentPage.value = Math.ceil(gifts.value.length / ITEMS_PER_PAGE) || 1
  }
}

const handleAddGift = () => {
  const name = guestName.value.trim()
  const amountStr = giftAmount.value
  const type = paymentType.value
  const remarksVal = remarks.value.trim()

  if (!name || !amountStr) {
    showAlert('信息不完整', '请输入姓名、金额并选择收款类型。')
    return
  }
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount < 0) {
    showAlert('金额无效', '请输入一个有效的非负金额。')
    return
  }

  showModal('请确认录入信息', `<div class="space-y-3 text-left">
    <p><strong>来宾姓名:</strong> <span class="text-lg">${name}</span></p>
    <p><strong>数字金额:</strong> <span class="text-red-600 font-bold text-xl">${formatCurrency(amount)}</span></p>
    <p><strong>大写金额:</strong> <span class="text-red-600 font-bold text-xl">${amountToChinese(amount)}</span></p>
    <p class="mt-4 text-sm text-gray-600 border-t pt-3">请仔细核对以上信息是否正确无误。</p>
  </div>`, [
    { text: '返回修改', class: 'bg-gray-300 px-4 py-2 rounded', handler: closeModal },
    { text: '确认提交', class: 'bg-red-600 text-white px-4 py-2 rounded', handler: () => { closeModal(); checkDuplicateAndSave(name, amount, type, remarksVal) } }
  ])
}

const checkDuplicateAndSave = (name: string, amount: number, type: string, remarksVal: string) => {
  const duplicate = gifts.value.some((g) => g.data?.name === name && g.data?.amount === amount)
  if (duplicate) {
    showModal('重复记录警告', `已存在 ${name} 金额为 ${amount} 的记录，是否仍要提交？`, [
      { text: '取消', class: 'bg-gray-300 px-4 py-2 rounded', handler: closeModal },
      { text: '仍要提交', class: 'bg-red-600 text-white px-4 py-2 rounded', handler: () => { closeModal(); finalSaveAction(name, amount, type, remarksVal) } }
    ])
  } else {
    finalSaveAction(name, amount, type, remarksVal)
  }
}

const finalSaveAction = (name: string, amount: number, type: string, remarksVal: string) => {
  if (!db || !currentEvent.value) return
  const now = new Date()
  if (now < new Date(currentEvent.value.startDateTime) || now > new Date(currentEvent.value.endDateTime)) {
    showAlert('录入已截止', `此事项的有效录入时间为 ${currentEvent.value.startDateTime.replace('T', ' ')} 至 ${currentEvent.value.endDateTime.replace('T', ' ')}。`)
    return
  }
  const giftData: GiftData = { name, amount, type, remarks: remarksVal, timestamp: new Date().toISOString() }
  const encryptedData = encryptData(giftData, currentPassword.value)
  const newRecord = { eventId: currentEvent.value.id, encryptedData }
  const request = db.transaction(['gifts'], 'readwrite').objectStore('gifts').add(newRecord)
  request.onsuccess = () => {
    guestName.value = ''
    giftAmount.value = ''
    remarks.value = ''
    paymentType.value = '现金'
    speakGift(name, amount)
    loadGiftsForCurrentEvent()
  }
}

const deleteCurrentEvent = () => {
  if (!currentEvent.value || !db) return
  showModal(`删除确认`, `<p>此操作将永久删除事项 “<strong>${currentEvent.value.name}</strong>” 及其所有礼金记录，且无法恢复。</p>
    <p class="mt-4">请输入管理密码以确认：</p>
    <input type="password" id="delete-confirm-password" class="w-full p-2 border rounded mt-2">`, [
    { text: '取消', class: 'bg-gray-300 px-4 py-2 rounded hover:bg-gray-400', handler: closeModal },
    {
      text: '确认删除',
      class: 'bg-red-700 text-white px-4 py-2 rounded hover:bg-red-800',
      keepOpen: true,
      handler: () => {
        const input = document.getElementById('delete-confirm-password') as HTMLInputElement | null
        const password = input?.value ?? ''
        if (hashPassword(password) !== currentEvent.value?.passwordHash) {
          showAlert('错误', '管理密码错误，删除操作已取消。')
          return
        }
        if (!db || !currentEvent.value?.id) return
        const transaction = db.transaction(['events', 'gifts'], 'readwrite')
        const eventsStore = transaction.objectStore('events')
        const giftsStore = transaction.objectStore('gifts')
        const giftsIndex = giftsStore.index('eventId')
        eventsStore.delete(currentEvent.value.id)
        const cursorReq = giftsIndex.openCursor(IDBKeyRange.only(currentEvent.value.id))
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null
          if (cursor) {
            giftsStore.delete(cursor.primaryKey)
            cursor.continue()
          }
        }
        transaction.oncomplete = () => {
          closeModal()
          showAlert('成功', `事项 “${currentEvent.value?.name}” 已被成功删除。`)
          showMainScreen.value = false
          loadEvents()
        }
      }
    }
  ])
  setTimeout(() => {
    const input = document.getElementById('delete-confirm-password') as HTMLInputElement | null
    input?.focus()
  }, 100)
}

const prevPage = () => {
  if (currentPage.value > 1) currentPage.value--
}
const nextPage = () => {
  if (currentPage.value < totalPages.value) currentPage.value++
}

const switchToEvent = (eventId: number) => {
  eventDropdownOpen.value = false
  unlockEvent(eventId)
}

const backToSetup = () => {
  eventDropdownOpen.value = false
  showMainScreen.value = false
  currentEvent.value = null
  currentPassword.value = ''
  gifts.value = []
}

const handleSearch = () => {
  const term = searchName.value.trim()
  if (!term) {
    loadGiftsForCurrentEvent()
    return
  }
  const results = gifts.value.filter((g) => g.data?.name.includes(term))
  if (results.length === 0) {
    showAlert('查找结果', `没有找到姓名为 “${term}” 的记录。`)
  } else {
    const html = results.map((r) => `<div class="p-2 border-b">
      <p><strong>姓名:</strong> ${r.data?.name}</p>
      <p><strong>金额:</strong> ${r.data?.amount.toFixed(2)} 元 (${r.data?.type})</p>
      ${r.data?.remarks ? `<p><strong>备注:</strong> ${r.data.remarks}</p>` : ''}
    </div>`).join('')
    showModal(`查找 “${term}” 的结果`, `<div class="max-h-60 overflow-y-auto">${html}</div>`, [{ text: '关闭', class: 'bg-gray-300 px-4 py-2 rounded', handler: closeModal }])
  }
}

const exportToExcel = () => {
  const data = gifts.value.map((g) => ({
    姓名: g.data?.name ?? '',
    金额: g.data?.amount ?? 0,
    收款类型: g.data?.type ?? '',
    备注: g.data?.remarks ?? '',
    录入时间: new Date(g.data?.timestamp ?? '').toLocaleString()
  }))
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '礼金明细')
  XLSX.writeFile(workbook, `${currentEvent.value?.name ?? '礼金'}_礼金明细.xlsx`)
}

const showStatistics = () => {
  const stats = {
    totalAmount: totalAmount.value,
    totalGivers: totalGivers.value,
    byType: { 现金: 0, 支付宝: 0, 微信: 0, 其他: 0 } as Record<string, number>
  }
  gifts.value.forEach((g) => {
    if (g.data && stats.byType[g.data.type] !== undefined) {
      stats.byType[g.data.type] += g.data.amount
    }
  })
  const byTypeHtml = Object.entries(stats.byType)
    .map(([type, amount]) => `<li class="flex justify-between"><span>${type}:</span> <span>${formatCurrency(amount)}</span></li>`)
    .join('')
  showModal('礼金统计', `<div class="space-y-4 text-gray-800">
    <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg">
      <span class="font-bold text-lg">总送礼人数:</span>
      <span class="font-bold text-lg text-red-600">${stats.totalGivers} 人</span>
    </div>
    <div class="flex justify-between items-center p-3 bg-red-50 rounded-lg">
      <span class="font-bold text-lg">总礼金金额:</span>
      <span class="font-bold text-lg text-red-600">${formatCurrency(stats.totalAmount)}</span>
    </div>
    <div class="border-t pt-4 mt-4">
      <h4 class="font-semibold text-md mb-2">按收款方式统计:</h4>
      <ul class="space-y-2">${byTypeHtml}</ul>
    </div>
  </div>`, [{ text: '关闭', class: 'bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500', handler: closeModal }])
}

const prepareForPrint = () => {
  window.print()
}

const speakGift = (name: string, amount: number) => {
  if (isSpeechEnabled.value && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(`${name}贺礼${amount}元整`)
    utterance.lang = 'zh-CN'
    speechSynthesis.speak(utterance)
  }
}

const amountToChinese = (n: number | string): string => {
  const num = typeof n === 'number' ? n : parseFloat(n)
  if (isNaN(num)) return ''
  if (num === 0) return '零元整'
  const unit = '京亿万仟佰拾兆万仟佰拾亿仟佰拾万仟佰拾元角分'
  let s = num.toString()
  if (s.indexOf('.') > -1) {
    s = (num * 100).toFixed(0)
  } else {
    s += '00'
  }
  if (s.length > unit.length) return '金额过大'
  const unitSlice = unit.slice(unit.length - s.length)
  let str = ''
  for (let i = 0; i < s.length; i++) {
    str += '零壹贰叁肆伍陆柒捌玖'.charAt(parseInt(s.charAt(i))) + unitSlice.charAt(i)
  }
  return str
    .replace(/零(仟|佰|拾|角)/g, '零')
    .replace(/(零)+/g, '零')
    .replace(/零(兆|万|亿|元)/g, '$1')
    .replace(/(兆|亿)万/g, '$1')
    .replace(/(京|兆)亿/g, '$1')
    .replace(/(京)兆/g, '$1')
    .replace(/(亿)万/g, '$1')
    .replace(/(京|兆|亿|仟|佰|拾)(万?)(.)/g, '$1$2$3')
    .replace(/零元/g, '元')
    .replace(/零分/g, '')
    .replace(/零角/g, '零')
    .replace(/元$/g, '元整')
    .replace(/角$/g, '角整')
}

const setDefaultTimes = () => {
  const now = new Date()
  const pad = (num: number) => num.toString().padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  newStartDate.value = dateStr
  newStartTime.value = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  newEndDate.value = dateStr
  newEndTime.value = '23:59'
}

onMounted(() => {
  initDB()
  setDefaultTimes()
  document.addEventListener('click', () => {
    if (eventDropdownOpen.value) eventDropdownOpen.value = false
  })
})
</script>

<template>
  <BackHome title="电子礼簿系统" />
  <div class="gift-root">
    <!-- 设置界面 -->
    <div v-if="!showMainScreen" class="setup-screen">
      <h1 class="text-3xl font-bold text-center text-red-700 mb-6">电子礼簿系统</h1>
      <div v-if="allEvents.length > 0" class="mb-8">
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">选择事项</h2>
        <div class="flex items-center space-x-4">
          <select v-model.number="selectedEventId" class="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-red-500">
            <option :value="null">请选择一个事项</option>
            <option v-for="ev in allEvents" :key="ev.id" :value="ev.id">{{ ev.name }}</option>
          </select>
          <button class="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700" @click="selectedEventId && unlockEvent(selectedEventId)">进入</button>
        </div>
      </div>
      <div>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">或 创建新事项</h2>
        <form class="space-y-4" @submit.prevent="createEvent">
          <input v-model="newEventName" type="text" placeholder="事项名称" required class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" />
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">开始时间</label>
              <div class="flex gap-2">
                <input v-model="newStartDate" type="date" required class="w-full p-3 border rounded-lg" />
                <input v-model="newStartTime" type="time" required class="w-full p-3 border rounded-lg" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">结束时间</label>
              <div class="flex gap-2">
                <input v-model="newEndDate" type="date" required class="w-full p-3 border rounded-lg" />
                <input v-model="newEndTime" type="time" required class="w-full p-3 border rounded-lg" />
              </div>
            </div>
          </div>
          <input v-model="newPassword" type="password" placeholder="设置管理密码" required class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" />
          <button type="submit" class="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 font-bold">创建并进入</button>
        </form>
      </div>
    </div>

    <!-- 主界面 -->
    <div v-else class="main-screen">
      <div class="flex justify-between items-center mb-4 relative">
        <div class="cursor-pointer group" @click.stop="eventDropdownOpen = !eventDropdownOpen">
          <h1 class="text-3xl font-bold text-red-700 group-hover:text-red-800">{{ currentEvent?.name }}</h1>
          <svg class="w-6 h-6 text-red-700 inline" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <div v-if="eventDropdownOpen" class="absolute top-full left-0 mt-2 w-72 bg-white rounded-md shadow-lg z-10">
            <a v-for="ev in allEvents.filter(e => e.id !== currentEvent?.id)" :key="ev.id" href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-red-100" @click.prevent="switchToEvent(ev.id!)">{{ ev.name }}</a>
            <div v-if="allEvents.length > 1" class="border-t border-gray-200 my-1" />
            <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-red-100" @click.prevent="backToSetup">返回主页 / 创建新事项</a>
            <div class="border-t border-gray-200 my-1" />
            <a href="#" class="block px-4 py-2 text-sm text-red-600 font-semibold hover:bg-red-100" @click.prevent="deleteCurrentEvent">删除当前项目</a>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 录入区 -->
        <div class="lg:col-span-1 bg-white p-6 rounded-lg shadow-lg">
          <h2 class="text-2xl font-bold mb-4 text-center border-b pb-2">礼金录入</h2>
          <form class="space-y-4" @submit.prevent="handleAddGift">
            <input v-model="guestName" type="text" placeholder="姓名" required class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" />
            <input v-model="giftAmount" type="number" placeholder="金额 (元)" required min="0" step="0.01" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">收款类型</label>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label v-for="t in ['现金','支付宝','微信','其他']" :key="t" class="flex items-center space-x-2 cursor-pointer">
                  <input v-model="paymentType" :value="t" type="radio" class="text-red-600 focus:ring-red-500" /> <span>{{ t }}</span>
                </label>
              </div>
            </div>
            <textarea v-model="remarks" placeholder="备注 (选填)" rows="3" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" />
            <button type="submit" class="w-full bg-red-600 text-white font-bold p-4 rounded-lg hover:bg-red-700 text-lg">确认录入</button>
          </form>
          <div class="mt-6 pt-6 border-t">
            <h3 class="text-xl font-semibold mb-3">功能区</h3>
            <div class="space-y-3">
              <input v-model="searchName" type="text" placeholder="按姓名查找..." class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-red-500" @keyup.enter="handleSearch" />
              <button class="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700" @click="prepareForPrint">打印/另存为PDF</button>
              <button class="w-full border border-red-600 text-red-600 p-3 rounded-lg hover:bg-red-50" @click="exportToExcel">导出为 Excel</button>
              <button class="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700" @click="showStatistics">查看统计</button>
              <label class="flex items-center justify-between bg-gray-100 p-3 rounded-lg cursor-pointer">
                <span class="font-medium text-gray-700">语音播报</span>
                <input v-model="isSpeechEnabled" type="checkbox" class="w-5 h-5 text-red-600" />
              </label>
            </div>
          </div>
        </div>

        <!-- 展示区 -->
        <div class="lg:col-span-2">
          <div class="gift-book-frame">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-y-2">
              <div class="flex items-center flex-wrap gap-x-4">
                <div><span class="font-bold text-md">本页小计:</span> <span class="text-xl font-bold text-red-500">{{ formatCurrency(pageSubtotal) }}</span></div>
                <div><span class="font-bold text-md">总金额:</span> <span class="text-xl font-bold text-red-500">{{ formatCurrency(totalAmount) }}</span></div>
                <div><span class="font-bold text-md">总人数:</span> <span class="text-xl font-bold text-red-500">{{ totalGivers }}</span></div>
              </div>
              <div class="flex items-center space-x-2">
                <button :disabled="currentPage === 1" class="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 disabled:bg-gray-300" @click="prevPage">&lt;</button>
                <span class="font-bold text-lg">第 {{ currentPage }} / {{ totalPages }} 页</span>
                <button :disabled="currentPage === totalPages" class="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 disabled:bg-gray-300" @click="nextPage">&gt;</button>
              </div>
            </div>
            <div class="gift-book-content">
              <div class="gift-book-row">
                <div v-for="i in ITEMS_PER_PAGE" :key="`name-${i}`" class="book-cell name-cell">
                  {{ pageItems[i - 1]?.data?.name ?? '' }}
                </div>
              </div>
              <div class="gift-book-row flex-1">
                <div v-for="i in ITEMS_PER_PAGE" :key="`type-${i}`" class="book-cell type-cell">贺 礼</div>
              </div>
              <div class="gift-book-row">
                <div v-for="i in ITEMS_PER_PAGE" :key="`amt-${i}`" class="book-cell amount-cell">
                  <template v-if="pageItems[i - 1]?.data">
                    <div class="amount-chinese">{{ amountToChinese(pageItems[i - 1].data!.amount) }}</div>
                    <div class="amount-numeric">¥{{ pageItems[i - 1].data!.amount }}</div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模态框 -->
    <div v-if="modalVisible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click.self="closeModal">
      <div class="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 class="text-xl font-bold mb-4 text-center" v-html="modalTitle" />
        <div v-html="modalContent" />
        <div class="mt-6 flex justify-end space-x-3">
          <button v-for="(action, i) in modalActions" :key="i" :class="action.class" @click="() => { if (!action.keepOpen) closeModal(); action.handler?.() }">{{ action.text }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gift-root {
  background: #f3f4f6;
  min-height: calc(100vh - 49px);
  padding: 16px;
}
.setup-screen {
  background: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  max-width: 640px;
  margin: 0 auto;
}
.gift-book-frame {
  border: 4px solid #c00;
  padding: 22px;
  border-radius: 10px;
  background-color: #fff2f2;
  display: flex;
  flex-direction: column;
}
.gift-book-content {
  display: flex;
  flex-direction: column;
  border-top: 2px solid #ffaaaa;
}
.gift-book-row {
  display: flex;
}
.book-cell {
  border: 1px solid #ffaaaa;
  padding: 8px;
  text-align: center;
  flex: 1;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.name-cell {
  font-weight: bold;
}
.type-cell {
  background: #fff8f8;
}
.amount-cell {
  flex-direction: column;
}
.amount-chinese {
  font-size: 13px;
  color: #c00;
}
.amount-numeric {
  font-weight: bold;
  color: #c00;
}
</style>
