<script setup lang="ts">
import { computed } from 'vue'
import { championSquareImgUrl } from '@renderer/utils/ddragon'

const props = defineProps<{
  ddragonVersion: string
  imageKey: string
  name: string
}>()

const src = computed(() => championSquareImgUrl(props.ddragonVersion, props.imageKey))
</script>

<template>
  <img class="avatar" :src="src" :alt="name" width="40" height="40" loading="lazy" />
</template>

<style scoped>
.avatar {
  border-radius: 8px;
  object-fit: cover;
  background: var(--t-avatar-bg);
}
</style>
