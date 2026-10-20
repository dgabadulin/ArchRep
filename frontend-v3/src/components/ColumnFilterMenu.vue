<template>
  <Teleport to="body">
    <div
      v-if="anchor"
      ref="menuEl"
      class="col-filter-menu"
      :style="menuStyle"
      @click.stop
      @keydown.esc.prevent="$emit('cancel')"
    >
      <template v-if="filterType === 'text'">
        <label class="col-filter-label">Содержит</label>
        <input
          ref="textInput"
          v-model="textDraft"
          type="search"
          class="col-filter-input"
          placeholder="Текст для поиска…"
          @keydown.enter.prevent="confirm"
        />
      </template>

      <template v-else-if="filterType === 'enum' || filterType === 'bool'">
        <div class="col-filter-actions col-filter-actions-top">
          <button type="button" class="col-filter-link" @click="selectAll">Выбрать все</button>
          <button type="button" class="col-filter-link" @click="deselectAll">Снять все</button>
        </div>
        <div class="col-filter-list">
          <label v-for="val in distinctValues" :key="val" class="col-filter-item">
            <input
              type="checkbox"
              :checked="checkedSet.has(val)"
              @change="toggleValue(val, $event.target.checked)"
            />
            <span class="col-filter-item-text">{{ val }}</span>
          </label>
          <p v-if="distinctValues.length === 0" class="col-filter-empty">Нет значений</p>
        </div>
      </template>

      <div class="col-filter-footer">
        <button type="button" class="btn btn-primary btn-sm" @click="confirm">ОК</button>
        <button type="button" class="btn btn-secondary btn-sm" @click="$emit('cancel')">Отмена</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  filterType: { type: String, default: '' },
  initialText: { type: String, default: '' },
  initialChecked: { type: Array, default: () => [] },
  distinctValues: { type: Array, default: () => [] },
  /** HTMLElement заголовка колонки (th) — для позиционирования */
  anchor: { type: Object, default: null },
})

const emit = defineEmits(['ok', 'cancel'])

const textDraft = ref(props.initialText)
const checkedSet = ref(new Set(props.initialChecked))
const textInput = ref(null)
const menuEl = ref(null)
const menuStyle = ref({ visibility: 'hidden' })

const MENU_EST_HEIGHT = 320
const GAP = 2

function updatePosition() {
  const anchor = props.anchor
  const menu = menuEl.value
  if (!anchor) return

  const rect = anchor.getBoundingClientRect()
  const menuHeight = menu?.offsetHeight || MENU_EST_HEIGHT
  const spaceBelow = window.innerHeight - rect.bottom - GAP
  const spaceAbove = rect.top - GAP
  const openUp = spaceBelow < menuHeight && spaceAbove > spaceBelow

  const style = {
    position: 'fixed',
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
    left: 'auto',
    minWidth: '200px',
    maxWidth: `${Math.max(200, Math.min(280, rect.width))}px`,
    zIndex: 1000,
    visibility: 'visible',
  }

  if (openUp) {
    style.bottom = `${Math.max(8, window.innerHeight - rect.top + GAP)}px`
    style.top = 'auto'
  } else {
    style.top = `${Math.min(window.innerHeight - 8, rect.bottom + GAP)}px`
    style.bottom = 'auto'
    style.maxHeight = `${Math.max(120, spaceBelow)}px`
  }

  menuStyle.value = style
}

function schedulePositionUpdate() {
  nextTick(updatePosition)
}

onMounted(() => {
  schedulePositionUpdate()
  if (props.filterType === 'text') {
    nextTick(() => textInput.value?.focus())
  }
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onUnmounted(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})

watch(() => props.anchor, schedulePositionUpdate)
watch(() => props.distinctValues?.length, schedulePositionUpdate)

function toggleValue(val, checked) {
  const next = new Set(checkedSet.value)
  if (checked) next.add(val)
  else next.delete(val)
  checkedSet.value = next
}

function selectAll() {
  checkedSet.value = new Set(props.distinctValues)
}

function deselectAll() {
  checkedSet.value = new Set()
}

function confirm() {
  if (props.filterType === 'text') {
    emit('ok', { type: 'text', contains: textDraft.value })
    return
  }
  emit('ok', { type: props.filterType, checked: [...checkedSet.value] })
}
</script>

<style scoped>
.col-filter-menu {
  display: flex;
  flex-direction: column;
  background: var(--ar-surface);
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  box-shadow: var(--ar-shadow-card);
  padding: 0.5rem;
  text-transform: none;
  letter-spacing: normal;
  font-weight: normal;
  overflow: hidden;
}
.col-filter-label {
  display: block;
  font-size: 0.75rem;
  color: var(--ar-muted);
  margin-bottom: 0.35rem;
  flex-shrink: 0;
}
.col-filter-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  font-size: 0.875rem;
  background: var(--ar-surface);
  color: var(--ar-text);
  flex-shrink: 0;
}
.col-filter-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-shrink: 0;
}
.col-filter-actions-top {
  margin-top: 0;
  margin-bottom: 0.35rem;
}
.col-filter-link {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  color: var(--ar-link);
  cursor: pointer;
}
.col-filter-link:hover {
  text-decoration: underline;
}
.col-filter-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.col-filter-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.3rem 0;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--ar-text);
}
.col-filter-item-text {
  word-break: break-word;
}
.col-filter-empty {
  margin: 0.25rem 0;
  font-size: 0.85rem;
  color: var(--ar-muted);
}
.col-filter-footer {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.65rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--ar-border);
  flex-shrink: 0;
}
.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.85rem;
  min-width: auto;
}
</style>
