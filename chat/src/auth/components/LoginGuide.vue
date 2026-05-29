<template>
  <section
    class="app-panel"
    aria-labelledby="login-guide-title"
  >
    <p class="app-eyebrow">
      dc.hhhl.cc
    </p>
    <h1 id="login-guide-title">
      {{ i18n.t('auth.loginTitle') }}
    </h1>
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
      <button
        class="app-button app-button-secondary"
        type="button"
        @click="$emit('register')"
      >
        dc.hhhl.cc
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
  register: [];
}>();
</script>
