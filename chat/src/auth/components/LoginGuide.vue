<template>
  <section
    class="app-panel"
    aria-labelledby="login-guide-title"
  >
    <div class="app-heading-row">
      <img
        class="app-heading-logo"
        src="https://dc.hhhl.cc/client-assets/icon.png"
        alt="HHHL Logo"
        width="45"
        height="45"
      >
      <h1 id="login-guide-title">
        {{ i18n.t('auth.loginTitle') }}
      </h1>
    </div>
    <p class="app-copy">
      {{ i18n.t('auth.loginBody') }}
    </p>
    <p
      v-if="error != null"
      class="chat-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="app-actions">
      <button
        class="app-button"
        type="button"
        @click="$emit('login')"
      >
        {{ i18n.t('auth.loginAction') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';

defineProps<{
  error?: string | null;
}>();

defineEmits<{
  login: [];
}>();
</script>
