<template>
  <section class="side-panel">
    <h2>{{ i18n.t('settings.diagnostics') }}</h2>

    <section class="diagnostics-section">
      <div class="diagnostics-section__header">
        <h3>{{ i18n.t('settings.diagnosticsSafeSummary') }}</h3>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="copyDiagnostics(safeDiagnostics)"
        >
          {{ i18n.t('settings.diagnosticsCopySafe') }}
        </button>
      </div>
      <pre class="diagnostics-output">{{ safeDiagnostics }}</pre>
    </section>

    <section
      v-if="detailConfirmed"
      class="diagnostics-section"
    >
      <div class="diagnostics-section__header">
        <h3>{{ i18n.t('settings.diagnosticsDevelopmentDetails') }}</h3>
        <button
          class="app-button app-button-secondary"
          type="button"
          @click="copyDiagnostics(detailedDiagnostics)"
        >
          {{ i18n.t('settings.diagnosticsCopyDetailed') }}
        </button>
      </div>
      <pre class="diagnostics-output">{{ detailedDiagnostics }}</pre>
    </section>

    <div
      v-else
      class="diagnostics-detail-gate"
    >
      <button
        v-if="!isConfirmingDetail"
        class="app-button app-button-secondary"
        type="button"
        @click="isConfirmingDetail = true"
      >
        {{ i18n.t('settings.diagnosticsShowDetails') }}
      </button>
      <template v-else>
        <p>{{ i18n.t('settings.diagnosticsDetailsNotice') }}</p>
        <button
          class="app-button"
          type="button"
          @click="confirmDetail"
        >
          {{ i18n.t('settings.diagnosticsConfirmDetails') }}
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { i18n } from '@/i18n';

const props = defineProps<{
  safeDiagnostics: string;
  detailedDiagnostics: string;
  detailConfirmed: boolean;
}>();

const emit = defineEmits<{
  'confirm-detail': [];
}>();

const isConfirmingDetail = ref(false);

async function copyDiagnostics(value: string): Promise<void> {
  try {
    await globalThis.navigator?.clipboard?.writeText(value);
  } catch {
    // Copy support is optional; diagnostics remain visible for manual selection.
  }
}

function confirmDetail(): void {
  emit('confirm-detail');
  isConfirmingDetail.value = false;
}

watch(
  () => props.detailConfirmed,
  (detailConfirmed) => {
    if (!detailConfirmed) {
      isConfirmingDetail.value = false;
    }
  },
);
</script>
