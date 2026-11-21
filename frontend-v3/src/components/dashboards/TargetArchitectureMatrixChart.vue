<template>
  <div class="ta-matrix-wrap" :class="{ compact }">
    <div v-if="loading" class="state">Загрузка матрицы…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <div v-else-if="!hasData" class="state empty">
      Нет данных целевой матрицы: не найдены связи систем с бизнес-функциями и продуктами.
    </div>
    <div v-else class="ta-matrix">
      <div v-if="showTitle" class="chart-title">Целевая архитектура</div>
      <div class="matrix-head">
        <div class="legend" aria-label="Легенда статусов систем">
          <span class="legend-item">
            <i class="legend-dot green" aria-hidden="true"></i>
            В промышленной или опытной эксплуатации
          </span>
          <span class="legend-item">
            <i class="legend-dot orange" aria-hidden="true"></i>
            Новая или планируемая
          </span>
          <span class="legend-item">
            <i class="legend-dot neutral" aria-hidden="true"></i>
            Прочее / статус не указан
          </span>
        </div>
        <span class="matrix-meta">{{ matrix.rowCount }} строк × {{ matrix.products.length }} продуктов</span>
      </div>

      <div class="matrix-scroll">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="cap-column" scope="col">Бизнес-способность</th>
              <th v-for="product in matrix.products" :key="product.id" scope="col" :title="product.name">
                {{ product.name }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in matrix.groups" :key="group.key">
              <tr class="group-row">
                <th :colspan="matrix.products.length + 1" scope="colgroup">{{ group.name }}</th>
              </tr>
              <tr v-for="row in group.rows" :key="row.id">
                <th class="cap-cell" scope="row" :title="row.name">{{ row.name }}</th>
                <td v-for="cell in row.cells" :key="cell.productId">
                  <div v-if="cell.systems.length" class="system-chips">
                    <span
                      v-for="system in cell.systems"
                      :key="system.id"
                      class="system-chip"
                      :class="`tone-${system.tone}`"
                      :title="systemTitle(system)"
                    >
                      {{ system.name }}
                    </span>
                  </div>
                  <span v-else class="cell-empty" aria-label="Нет систем">—</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="footnote">
        Целевая архитектура: связи систем с бизнес-функциями и продуктами из ИСАР.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { dashboardApi } from '../../api'
import { buildTargetArchitectureGroups } from './targetArchitectureMatrix.js'

const props = defineProps({
  /** Компактный режим (карточка на галерее). */
  compact: { type: Boolean, default: false },
  /** Показывать внутренний заголовок (в галерее и полном экране — заголовок снаружи). */
  showTitle: { type: Boolean, default: true },
})

const loading = ref(true)
const error = ref('')
const data = ref(null)

const matrix = computed(() => buildTargetArchitectureGroups(data.value))
const hasData = computed(() => matrix.value.products.length > 0 && matrix.value.rowCount > 0)

function systemTitle(system) {
  return system.status ? `${system.name} — ${system.status}` : String(system.name || '')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await dashboardApi.targetArchitectureMatrix()
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки матрицы'
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ta-matrix-wrap {
  width: 100%;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.5rem;
  box-sizing: border-box;
}

.state {
  padding: 1rem;
  text-align: center;
  color: var(--ar-muted);
  font-size: 0.9rem;
}

.state.error {
  color: var(--ar-danger);
}

.ta-matrix {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-title {
  font-weight: 600;
  color: var(--ar-text);
  margin-bottom: 0.4rem;
}

.matrix-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.45rem;
}

.legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  font-size: 0.78rem;
  color: var(--ar-muted);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}

.legend-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 3px;
  display: inline-block;
  border: 1px solid transparent;
}

.legend-dot.green {
  background: #e2efda;
  border-color: #70ad47;
}

.legend-dot.orange {
  background: #fce4d6;
  border-color: #ed7d31;
}

.legend-dot.neutral {
  background: #eef1f5;
  border-color: #9aa4b2;
}

.matrix-meta {
  font-size: 0.78rem;
  color: var(--ar-muted);
  white-space: nowrap;
}

.matrix-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--ar-border);
  border-radius: var(--ar-radius-sm);
  background: var(--ar-surface);
}

.matrix-table {
  border-collapse: separate;
  border-spacing: 0;
  width: max-content;
  min-width: 100%;
  font-size: 0.78rem;
  color: var(--ar-text);
}

.matrix-table th,
.matrix-table td {
  border-right: 1px solid var(--ar-border);
  border-bottom: 1px solid var(--ar-border);
  padding: 0.35rem 0.45rem;
  vertical-align: top;
}

.matrix-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--ar-table-head-bg);
  color: var(--ar-text);
  font-weight: 600;
  text-align: left;
  min-width: 9rem;
  max-width: 12rem;
  line-height: 1.25;
}

.matrix-table thead th.cap-column {
  left: 0;
  z-index: 3;
  min-width: 17rem;
  max-width: 22rem;
}

.cap-cell {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--ar-surface);
  text-align: left;
  font-weight: 500;
  min-width: 17rem;
  max-width: 22rem;
  line-height: 1.3;
}

.matrix-table tbody tr:hover > td,
.matrix-table tbody tr:hover > .cap-cell {
  background: var(--ar-table-row-hover, #f7f9fb);
}

.group-row th {
  position: static;
  background: var(--ar-table-head-bg);
  color: var(--ar-muted);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: left;
  padding-top: 0.45rem;
  padding-bottom: 0.45rem;
}

.matrix-table td {
  min-width: 9rem;
  max-width: 12rem;
}

.system-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.2rem;
}

.system-chip {
  display: inline-block;
  max-width: 100%;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  border: 1px solid transparent;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.system-chip.tone-green {
  background: #e2efda;
  border-color: #70ad47;
  color: #2f5b1f;
}

.system-chip.tone-orange {
  background: #fce4d6;
  border-color: #ed7d31;
  color: #8a3f12;
}

.system-chip.tone-neutral {
  background: #eef1f5;
  border-color: #9aa4b2;
  color: #4a5568;
}

.cell-empty {
  color: var(--ar-muted);
  opacity: 0.5;
}

.footnote {
  margin: 0.4rem 0 0;
  font-size: 0.72rem;
  color: var(--ar-muted);
}

.compact .matrix-table {
  font-size: 0.68rem;
}

.compact .matrix-table th,
.compact .matrix-table td {
  padding: 0.2rem 0.3rem;
}

.compact .matrix-table thead th,
.compact .cap-cell,
.compact .matrix-table td {
  min-width: 7rem;
  max-width: 9rem;
}

.compact .matrix-table thead th.cap-column,
.compact .cap-cell {
  min-width: 11rem;
  max-width: 14rem;
}

.compact .system-chip {
  padding: 0.05rem 0.2rem;
}

.compact .footnote {
  display: none;
}

@media (max-width: 720px) {
  .matrix-head {
    flex-direction: column;
    gap: 0.35rem;
  }
}
</style>
