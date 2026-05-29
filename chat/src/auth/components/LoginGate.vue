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
      :error="auth.error"
      @login="auth.startLogin(dependencies)"
      @register="openExternalLink(DC_HHHL_ORIGIN)"
    />
  </main>
  <RouterView v-else />
</template>

<script setup lang="ts">
import { watch } from 'vue';
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
let restored = false;
let callbackSessionInFlight: string | null = null;

async function handleAuthRoute(): Promise<void> {
  const session = typeof route.query.session === 'string' ? route.query.session : null;
  const isAuthCallback = route.name === 'auth-callback' || route.path === '/auth/callback';

  if (isAuthCallback && session != null && callbackSessionInFlight !== session) {
    callbackSessionInFlight = session;
    try {
      await auth.completeCallback(session, dependencies);
      restored = true;
      await router.replace('/');
    } catch {
      restored = true;
      await router.replace('/');
    }
    return;
  }

  if (!restored && !isAuthCallback) {
    restored = true;
    await auth.restore(dependencies);
  }
}

watch(
  () => [route.path, route.name, route.query.session],
  () => { void handleAuthRoute(); },
  { immediate: true },
);
</script>
