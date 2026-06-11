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
    />
  </main>
  <RouterView
    v-else
    v-slot="routerView"
  >
    <Transition
      :name="typeof routerView.route.meta.transition === 'string' ? routerView.route.meta.transition : 'route-fade'"
      mode="out-in"
    >
      <component
        :is="routerView.Component"
        :key="routerView.route.path"
      />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/settings/settingsStore';
import { createAuthDependencies, useAuthStore } from '../authStore';
import LoginGuide from './LoginGuide.vue';

const auth = useAuthStore();
const settings = useSettingsStore();
const route = useRoute();
const router = useRouter();
const dependencies = createAuthDependencies();
let restored = false;
let callbackSessionInFlight: string | null = null;
let syncedToken: string | null = null;

function syncSettingsAfterAuthorization(): void {
  if (!auth.isAuthorized || auth.token == null || syncedToken === auth.token) {
    return;
  }

  syncedToken = auth.token;
  void settings.syncAfterLogin();
}

function resolveSession(querySession: unknown): string | null {
  if (typeof querySession === 'string' && querySession !== '') {
    return querySession;
  }

  if (Array.isArray(querySession)) {
    const session = querySession.find((value) => typeof value === 'string' && value !== '');
    return typeof session === 'string' ? session : null;
  }

  return null;
}

async function handleAuthRoute(): Promise<void> {
  await router.isReady();

  const session = resolveSession(route.query.session);
  const isAuthCallback = route.name === 'auth-callback' || route.path === '/auth/callback';

  if (isAuthCallback && session != null && callbackSessionInFlight !== session) {
    callbackSessionInFlight = session;
    try {
      await auth.completeCallback(session, dependencies);
      syncSettingsAfterAuthorization();
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
    syncSettingsAfterAuthorization();
  }
}

watch(
  () => [route.path, route.name, route.query.session],
  () => { void handleAuthRoute(); },
  { immediate: true },
);
</script>
