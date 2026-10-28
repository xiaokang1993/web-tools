<script setup lang="ts">
import { computed, ref } from 'vue'
import BackHome from '@/components/BackHome.vue'
import CopyButton from '@/components/CopyButton.vue'

// ===== JSON 格式化 =====
const jsonInput = ref('')
const jsonOutput = ref('')
function formatJSON() {
  try {
    const obj = JSON.parse(jsonInput.value) as unknown
    jsonOutput.value = JSON.stringify(obj, null, 4)
  } catch (e) {
    jsonOutput.value = '无效的 JSON: ' + (e as Error).message
  }
}

// ===== 颜色选择器 =====
const colorValue = ref('#000000')
const colorRGB = computed(() => {
  const hex = colorValue.value.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
})
const colorOutput = computed(() => `${colorValue.value} / ${colorRGB.value}`)

// ===== 正则表达式测试 =====
const regexPattern = ref('')
const regexText = ref('')
const regexOutput = ref('')
function testRegex() {
  try {
    const regex = new RegExp(regexPattern.value)
    const result = regex.test(regexText.value)
    regexOutput.value = result ? '匹配成功' : '匹配失败'
  } catch (e) {
    regexOutput.value = '无效的正则表达式: ' + (e as Error).message
  }
}

// ===== Base64 编码/解码 =====
const base64Input = ref('')
const base64Output = ref('')
function encodeBase64() {
  try {
    base64Output.value = btoa(unescape(encodeURIComponent(base64Input.value)))
  } catch (e) {
    base64Output.value = '编码失败: ' + (e as Error).message
  }
}
function decodeBase64() {
  try {
    base64Output.value = decodeURIComponent(escape(atob(base64Input.value)))
  } catch (e) {
    base64Output.value = '无效的 Base64 字符串: ' + (e as Error).message
  }
}

// ===== 时间戳转换 =====
const timestampInput = ref('')
const timestampOutput = ref('')
function convertTimestamp() {
  const raw = timestampInput.value.trim()
  if (!raw) {
    timestampOutput.value = '请输入时间戳'
    return
  }
  const num = Number(raw)
  if (Number.isNaN(num)) {
    timestampOutput.value = '无效的时间戳'
    return
  }
  // 自动识别秒/毫秒：< 1e12 视为秒
  const ms = raw.length < 13 || num < 1e12 ? num * 1000 : num
  const date = new Date(ms)
  timestampOutput.value = date.toString()
}

// ===== HTML 实体编码/解码 =====
const htmlInput = ref('')
const htmlOutput = ref('')
function encodeHTML() {
  htmlOutput.value = htmlInput.value.replace(
    /[\u00A0-\u9999<>&]/gim,
    (i: string) => `&#${i.charCodeAt(0)};`,
  )
}
function decodeHTML() {
  htmlOutput.value = htmlInput.value.replace(/&#(\d+);/g, (_match, num: string) =>
    String.fromCharCode(Number(num)),
  )
}
</script>

<template>
  <BackHome title="开发者工具箱" />
  <div class="container">
    <!-- JSON 格式化 -->
    <div class="tool-card">
      <h2>JSON 格式化</h2>
      <p>格式化 JSON 字符串，使其易于阅读。</p>
      <textarea v-model="jsonInput" placeholder="输入 JSON 字符串..."></textarea>
      <button @click="formatJSON">格式化</button>
      <div class="output">
        <div class="output-text">{{ jsonOutput }}</div>
        <CopyButton v-if="jsonOutput" :text="jsonOutput" />
      </div>
    </div>

    <!-- 颜色选择器 -->
    <div class="tool-card">
      <h2>颜色选择器</h2>
      <p>选择颜色并获取其 HEX / RGB 值。</p>
      <input v-model="colorValue" type="color" class="color-picker" />
      <div class="output">
        <div class="output-text">{{ colorOutput }}</div>
        <CopyButton v-if="colorOutput" :text="colorOutput" />
      </div>
    </div>

    <!-- 正则表达式测试 -->
    <div class="tool-card">
      <h2>正则表达式测试</h2>
      <p>测试正则表达式是否匹配文本。</p>
      <input v-model="regexPattern" type="text" class="text-input" placeholder="输入正则表达式..." />
      <textarea v-model="regexText" placeholder="输入测试文本..."></textarea>
      <button @click="testRegex">测试</button>
      <div class="output">
        <div class="output-text">{{ regexOutput }}</div>
        <CopyButton v-if="regexOutput" :text="regexOutput" />
      </div>
    </div>

    <!-- Base64 编码/解码 -->
    <div class="tool-card">
      <h2>Base64 编码/解码</h2>
      <p>编码或解码文本为 Base64（支持中文）。</p>
      <textarea v-model="base64Input" placeholder="输入文本..."></textarea>
      <div class="button-row">
        <button @click="encodeBase64">编码</button>
        <button @click="decodeBase64">解码</button>
      </div>
      <div class="output">
        <div class="output-text">{{ base64Output }}</div>
        <CopyButton v-if="base64Output" :text="base64Output" />
      </div>
    </div>

    <!-- 时间戳转换 -->
    <div class="tool-card">
      <h2>时间戳转换</h2>
      <p>将时间戳转换为可读的日期格式（自动识别秒/毫秒）。</p>
      <input v-model="timestampInput" type="number" class="text-input" placeholder="输入时间戳..." />
      <button @click="convertTimestamp">转换</button>
      <div class="output">
        <div class="output-text">{{ timestampOutput }}</div>
        <CopyButton v-if="timestampOutput" :text="timestampOutput" />
      </div>
    </div>

    <!-- HTML 实体编码/解码 -->
    <div class="tool-card">
      <h2>HTML 实体编码/解码</h2>
      <p>编码或解码 HTML 实体字符。</p>
      <textarea v-model="htmlInput" placeholder="输入 HTML 文本..."></textarea>
      <div class="button-row">
        <button @click="encodeHTML">编码</button>
        <button @click="decodeHTML">解码</button>
      </div>
      <div class="output">
        <div class="output-text">{{ htmlOutput }}</div>
        <CopyButton v-if="htmlOutput" :text="htmlOutput" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  padding: 20px;
}

.tool-card {
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  padding: 20px;
  width: 320px;
  max-width: 100%;
  transition: transform 0.2s;
}

.tool-card:hover {
  transform: translateY(-5px);
}

.tool-card h2 {
  margin-top: 0;
  color: var(--accent);
  font-size: 1.25rem;
}

.tool-card p {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 4px 0 12px;
}

.tool-card textarea,
.tool-card .text-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  color: var(--fg);
  font-size: 14px;
  font-family: inherit;
}

.tool-card textarea {
  height: 100px;
  margin: 10px 0;
  resize: vertical;
}

.tool-card .text-input {
  margin: 10px 0;
}

.tool-card button {
  background-color: var(--accent);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: opacity 0.15s;
}

.tool-card button:hover {
  opacity: 0.85;
}

.button-row {
  display: flex;
  gap: 10px;
  margin: 10px 0;
}

.color-picker {
  width: 100%;
  height: 40px;
  border: none;
  border-radius: 4px;
  margin: 10px 0;
  cursor: pointer;
  background: none;
}

.output {
  background-color: var(--accent-soft);
  border: 1px solid var(--border);
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
  min-height: 50px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.output-text {
  word-break: break-all;
  white-space: pre-wrap;
  flex: 1;
  color: var(--fg);
}
</style>
