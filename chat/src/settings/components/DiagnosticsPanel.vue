<template>
  <section class="side-panel">
    <h2>{{ i18n.t('settings.diagnostics') }}</h2>
    <pre class="diagnostics-output">{{ diagnostics }}</pre>
  </section>
</template>

<script setup lang="ts">
import { i18n } from '@/i18n';

defineProps<{
  diagnostics: string;
}>();
</script>
