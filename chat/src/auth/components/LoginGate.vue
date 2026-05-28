<template>
  <main
    v-if="auth.status === 'authorizing' || auth.status === 'idle'"
    class="app-shell"
    aria-live="polite"
  >
    <section class="app-panel">
      <p class="app-copy">
        {{ i18n.t('common.loading') }}
      </p>
    </section>
  </main>
  <main
    v-else-if="auth.needsLogin"
    class="app-shell"
  >
    <LoginGuide
      @login="auth.startLogin(dependencies)"
      @register="openExternalLink(DC_HHHL_ORIGIN)"
    />
  </main>
  <RouterView v-else />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DC_HHHL_ORIGIN } from '@/shared/config';
import { i18n } from '@/i18n';
import { openExternalLink } from '@/telegram/telegram';
import { createAuthDependencies, useAuthStore } from '../authStore';
import LoginGuide from './LoginGuide.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const dependencies = createAuthDependencies();

onMounted(async () => {
  const session = typeof route.query.session === 'string' ? route.query.session : null;

  if (route.name === 'auth-callback' && session != null) {
    await auth.completeCallback(session, dependencies);
    await router.replace('/');
    return;
  }

  await auth.restore(dependencies);
});
</script>
