import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { applyTelegramTheme, i18n } from './i18n';
import router from './router';
import { getTelegramLaunchContext } from './telegram/telegram';
import './styles/base.css';
import './styles/telegram.css';
import './styles/components.css';

applyTelegramTheme(getTelegramLaunchContext().themeParams);

const app = createApp(App);

app.provide('i18n', i18n);
app.use(createPinia());
app.use(router);
app.mount('#app');
