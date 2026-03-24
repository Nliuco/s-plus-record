<script setup lang="ts">
type ViewMode = 'all' | 'sPlus' | 'notSPlus'

const props = defineProps<{
  viewMode: ViewMode
  searchQuery: string
  sortMenuOpen: boolean
  currentSortLabel: string
  listSortMode: string
  sortOptions: { value: string; label: string }[]
  singleSearchInsight: string | null
  onSortRootChange: (el: unknown) => void
}>()

const emit = defineEmits<{
  'update:viewMode': [value: ViewMode]
  'update:searchQuery': [value: string]
  'toggle-sort-menu': []
  'select-sort-mode': [value: string]
}>()

function onSortRootRef(el: unknown): void {
  props.onSortRootChange(el)
}
</script>

<template>
  <div class="list-controls">
    <div class="toolbar toolbar-filters">
      <div class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ active: viewMode === 'all' }"
          @click="emit('update:viewMode', 'all')"
        >
          全部英雄
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ active: viewMode === 'sPlus' }"
          @click="emit('update:viewMode', 'sPlus')"
        >
          仅 S+
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :class="{ active: viewMode === 'notSPlus' }"
          @click="emit('update:viewMode', 'notSPlus')"
        >
          非 S+
        </button>
      </div>
      <input
        :value="searchQuery"
        type="search"
        class="search-input"
        placeholder="名称 / 别名，或整段输入等级如 A+、S-、S+…"
        autocomplete="off"
        spellcheck="false"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div :ref="onSortRootRef" class="toolbar toolbar-sort">
      <span class="sort-label" id="sort-picker-label">排序</span>
      <div class="sort-picker">
        <button
          type="button"
          class="sort-trigger"
          :aria-expanded="sortMenuOpen"
          aria-haspopup="listbox"
          aria-labelledby="sort-picker-label"
          @click.stop="emit('toggle-sort-menu')"
        >
          <span class="sort-trigger-text">{{ currentSortLabel }}</span>
          <svg
            class="sort-chevron"
            :class="{ 'sort-chevron--open': sortMenuOpen }"
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <ul
          v-show="sortMenuOpen"
          class="sort-menu"
          role="listbox"
          aria-labelledby="sort-picker-label"
        >
          <li
            v-for="opt in sortOptions"
            :key="opt.value === '' ? '__default' : opt.value"
            role="option"
            :aria-selected="listSortMode === opt.value"
            class="sort-menu-item"
            :class="{ 'sort-menu-item--active': listSortMode === opt.value }"
            @click.stop="emit('select-sort-mode', opt.value)"
          >
            {{ opt.label }}
          </li>
        </ul>
      </div>
    </div>

    <p v-if="singleSearchInsight" class="insight">{{ singleSearchInsight }}</p>
  </div>
</template>

<style scoped>
.list-controls {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-width: 0;
  flex-shrink: 0;
  margin: 0.1rem 0 0.4rem;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.7rem;
  margin: 0;
  min-width: 0;
  flex-shrink: 0;
}
.toolbar-filters {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem 0.75rem;
}
@media (max-width: 520px) {
  .toolbar-filters {
    grid-template-columns: 1fr;
  }
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.tab {
  cursor: pointer;
  padding: 0.42rem 0.8rem;
  border: 1px solid var(--t-border);
  border-radius: 8px;
  background: var(--t-bg-base);
  color: var(--t-text-muted);
  font-size: 0.85rem;
  line-height: 1.25;
  min-height: 2.25rem;
  box-sizing: border-box;
}
.tab.active {
  border-color: var(--t-btn-primary);
  color: var(--t-accent-text);
  background: var(--t-bg-tab-active);
}
.search-input {
  width: 100%;
  min-width: 0;
  min-height: 2.25rem;
  box-sizing: border-box;
  padding: 0.42rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--t-border);
  background: var(--t-bg-input);
  color: var(--t-text);
  font-size: 0.875rem;
  line-height: 1.35;
}
.toolbar-sort {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.5rem 0.75rem;
}
.sort-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--t-text-sort);
  flex-shrink: 0;
  letter-spacing: 0.02em;
  line-height: 1.2;
  white-space: nowrap;
}
.sort-picker {
  position: relative;
  min-width: 0;
  width: 100%;
}
.sort-trigger {
  width: 100%;
  min-height: 2.25rem;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 0.42rem 0.8rem;
  border-radius: 10px;
  border: 1px solid var(--t-border-soft);
  background: var(--t-bg-sort-trigger);
  color: var(--t-text-2);
  font-size: 0.875rem;
  line-height: 1.35;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}
.sort-trigger:hover {
  border-color: var(--t-accent-42);
  background: var(--t-bg-row-hover);
}
.sort-trigger:focus-visible {
  outline: none;
  border-color: var(--t-accent-65);
  box-shadow: 0 0 0 2px var(--t-accent-35);
}
.sort-trigger-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sort-chevron {
  flex-shrink: 0;
  opacity: 0.5;
  color: var(--t-text-muted);
  transition: transform 0.2s ease, opacity 0.15s ease;
}
.sort-chevron--open {
  transform: rotate(180deg);
  opacity: 0.85;
}
.sort-menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 80;
  margin: 0;
  padding: 0.35rem;
  list-style: none;
  border-radius: 12px;
  border: 1px solid var(--t-border-soft);
  background: var(--t-bg-modal);
  box-shadow: var(--t-shadow-menu);
  max-height: min(52vh, 320px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--t-accent-45) transparent;
}
.sort-menu::-webkit-scrollbar {
  width: 6px;
}
.sort-menu::-webkit-scrollbar-thumb {
  background: var(--t-accent-45);
  border-radius: 999px;
}
.sort-menu-item {
  padding: 0.52rem 0.7rem;
  border-radius: 8px;
  font-size: 0.84rem;
  line-height: 1.35;
  color: var(--t-text-4);
  cursor: pointer;
  transition:
    background 0.12s ease,
    color 0.12s ease;
}
.sort-menu-item:hover {
  background: var(--t-bg-sort-item-hover);
  color: var(--t-text);
}
.sort-menu-item--active {
  background: var(--t-accent-22);
  color: var(--t-accent-text-2);
  font-weight: 600;
}
.sort-menu-item--active:hover {
  background: var(--t-accent-30);
  color: var(--t-accent-text);
}
.insight {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: var(--t-insight-bg);
  border: 1px solid var(--t-insight-border);
  color: var(--t-insight-text);
  font-size: 0.88rem;
  flex-shrink: 0;
}
</style>

