import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/home/HomePage.vue'),
    meta: { keepAlive: true }
  },
  {
    path: '/calculator',
    name: 'calculator',
    component: () => import('@/pages/calculator/CalculatorPage.vue')
  },
  {
    path: '/toolbox',
    name: 'toolbox',
    component: () => import('@/pages/toolbox/ToolboxPage.vue')
  },
  {
    path: '/todo',
    name: 'todo',
    component: () => import('@/pages/todo/TodoPage.vue')
  },
  {
    path: '/json-diff',
    name: 'json-diff',
    component: () => import('@/pages/json-diff/JsonDiffPage.vue')
  },
  {
    path: '/weather',
    name: 'weather',
    component: () => import('@/pages/weather/WeatherPage.vue')
  },
  {
    path: '/countdown',
    name: 'countdown',
    component: () => import('@/pages/countdown/CountdownPage.vue')
  },
  {
    path: '/reader',
    name: 'reader',
    component: () => import('@/pages/reader/ReaderPage.vue')
  },
  {
    path: '/gift-book',
    name: 'gift-book',
    component: () => import('@/pages/gift-book/GiftBookPage.vue')
  },
  {
    path: '/netease-music',
    name: 'netease-music',
    component: () => import('@/pages/netease-music/NeteaseMusicPage.vue')
  },
  {
    path: '/music-player',
    name: 'music-player',
    component: () => import('@/pages/music-player/MusicPlayerPage.vue')
  },
  {
    path: '/chess',
    name: 'chess',
    component: () => import('@/pages/chess/ChessPage.vue')
  },
  {
    path: '/gomoku',
    name: 'gomoku',
    component: () => import('@/pages/gomoku/GomokuPage.vue')
  },
  {
    path: '/snake',
    name: 'snake',
    component: () => import('@/pages/snake/SnakePage.vue')
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router
