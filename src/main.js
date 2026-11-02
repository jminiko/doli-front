import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Home from './views/Home.vue'
import EntityList from './views/EntityList.vue'
import EntityCard from './views/EntityCard.vue'
import Modules from './views/Modules.vue'
import Translate from './views/Translate.vue'
import System from './views/System.vue'
import Login from './views/Login.vue'
import { ensureUser } from './api'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles.css'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: Login },
    { path: '/', component: Home },
    { path: '/screens/:id', component: EntityList },
    { path: '/screens/:id/new', component: EntityCard },
    { path: '/screens/:id/:rowId', component: EntityCard },
    { path: '/modules', component: Modules },
    { path: '/translate', component: Translate },
    { path: '/system/:id', component: System }
  ]
})

router.beforeEach(async (to) => {
  const user = await ensureUser()
  if (!user && to.path !== '/login') return '/login'
  if (user && to.path === '/login') return '/'
  return true
})

createApp(App).use(router).mount('#app')
