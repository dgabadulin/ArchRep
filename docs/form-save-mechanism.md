# Механизм сохранения экранных форм (issue #94)

GitHub: https://github.com/dgabadulin/ArchRep/issues/111

Единый контракт панели сохранения для страниц-форм сущностей: одна кнопка сохраняет и
шапку формы, и локальные черновики вкладок; страница не закрывается сама, а «Сохранить и
закрыть» — явный способ вернуться в реестр.

## Контракт кнопок

| Кнопка | Что делает |
|--------|------------|
| **Сохранить** | Сохраняет форму (включая черновики вкладок) и **остаётся** на странице. В режиме создания маршрут заменяется на карточку `/<ресурс>/:id/edit` — запись уже существует, вкладки и связи доступны. |
| **Сохранить и закрыть** | Сохраняет и уводит в реестр (с сохранением `?search=`). Для систем, открытых из архитектурного заключения, — возвращает в заключение. |
| **Отмена / К списку** | Уход без сохранения. Если есть правки, `useUnsavedGuard` спрашивает «сохранить перед переходом?»; при ошибке сохранения переход отменяется и данные не теряются. |
| *(нет права `*:write`)* | Кнопок сохранения нет — режим просмотра, остаётся только «К списку». |

Статусы в панели: «идёт сохранение» (кнопки блокируются) → «Сохранено ✓» (2,5 с) → «ошибка»
(текст остаётся в панели, сохранение можно повторить). Частичный успех (шапка сохранена,
операции вкладки — нет) трактуется как ошибка: страница остаётся, неприменённое возвращается
в черновик.

## Примитивы

| Файл | Назначение |
|------|------------|
| `frontend-v3/src/components/SaveBar.vue` | Панель: статус, «Сохранить», «Сохранить и закрыть», слоты `extra` (доп. действие, напр. «Удалить») и `cancel` (ссылка «Отмена/К списку»), проп `maxWidth` для узких форм (500 px). |
| `frontend-v3/src/composables/useFormDirty.js` | `useFormDirty(getForm, { snapshot? })` → `{ isDirty, markSaved }`. `markSaved()` вызывается после загрузки записи и после успешного сохранения; `isDirty` — сравнение снимка полей. |
| `frontend-v3/src/composables/useSaveStatus.js` | `useSaveStatus({ dirty })` → `{ saving, savedOk, submitError, startSaving, markSaved, markError }`. Держит таймер «Сохранено ✓» и снимает отметку при новой правке. |
| `frontend-v3/src/composables/useUnsavedGuard.js` | `useUnsavedGuard(isDirtyRef, saveFn)`: при уходе предлагает сохранить; при ошибке (`saveFn` бросает) переход отменяется. |
| `frontend-v3/src/composables/useCollectionDraft.js` | Локальный черновик коллекции вкладки (связи, техстек): копится в памяти и применяется тем же сохранением. |
| `frontend-v3/src/composables/useFormListReturn.js` | Возврат к списку с сохранением `?search=` и переходы `routeWithListSearch()`. |

## Шаблон формы

```js
// состояние
const { isDirty, markSaved } = useFormDirty(() => form.value) // или () => form для reactive
const { saving, savedOk, submitError, startSaving, markSaved: markSavedOk, markError } =
  useSaveStatus({ dirty: isDirty })

// загрузка: снимок-база после заполнения формы
async function load() { /* ... */ markSaved() }
onMounted(load)
watch(id, load)   // форма остаётся той же после перехода «создание → карточка»

async function submit(opts = {}) {
  if (!canWrite.value || saving.value) return false
  startSaving()
  try {
    let recordId = id.value
    if (isEdit.value) await api.updateEntity(id.value, body)
    else recordId = (await api.createEntity(body)).id

    markSaved()      // база снимка = только что сохранённое
    markSavedOk()    // отметка «Сохранено ✓»

    if (opts.skipNavigate) return true                       // guard: сохранить и остаться
    if (opts.close) { await router.push(listRouteLocation.value); return true }
    if (!isEdit.value) await router.replace(routeWithListSearch(`/<ресурс>/${recordId}/edit`))
    return true
  } catch (e) {
    markError(e.body?.error || e.message || 'Ошибка сохранения')
    return false    // не throw: guard отменит переход, страница останется
  }
}

useUnsavedGuard(computed(() => canWrite.value && isDirty.value), async () => {
  const ok = await submit({ skipNavigate: true })
  if (!ok) throw new Error('Не сохранено')
})
```

```html
<SaveBar
  :saving="saving" :saved="savedOk" :dirty="isDirty" :can-save="canWrite" :error="submitError"
  show-save-and-close max-width="500px"
  @save="submit()" @save-and-close="submit({ close: true })"
>
  <template #cancel>
    <router-link :to="listRouteLocation" class="btn btn-secondary">{{ canWrite ? 'Отмена' : 'К списку' }}</router-link>
  </template>
</SaveBar>
```

Порядок ветвей в `submit` важен: **`skipNavigate` → `close` → `!isEdit`**. Если проверить
«создание» раньше `close`, кнопка «Сохранить и закрыть» на форме создания молча останется на
странице (именно этот дефект был в архдолге и системах).

Формы с вкладками композируют «грязность»: `isDirty = headerDirty || draftDirty`
(см. `SystemForm.vue` — техстек, `GapForm.vue` — связи).

## Чек-лист для новой формы

1. `SaveBar` вместо собственного блока кнопок: `@save="submit()"`, `@save-and-close="submit({ close: true })"`.
2. `submit(opts)` возвращает `Promise<boolean>`; при ошибке — `markError(...)` и `false`, без `throw`.
3. `useFormDirty` + `markSaved()` после загрузки и после сохранения; для вкладок — `useCollectionDraft`.
4. `useUnsavedGuard` с `skipNavigate`.
5. После создания — `router.replace()` на карточку `/:id/edit`, уход в список только по `close`.
6. Узкая форма (`max-width: 500px`) — передать `max-width="500px"`, иначе панель растянется на всю ширину.

## Область применения

Механизм раскатан на все страницы-формы сущностей: системы, архитектурный долг, акторы,
бизнес-функции и бизнес-сервисы, орг. единицы, домены, сертификаты, веб-ресурсы, технологии,
интеграционные потоки, принципиальные решения (ADR), связи метамодели, роли администратора.

**Вне объёма:** `DecisionAppliedForm.vue` (архитектурные заключения) — своя линейная модель
сохранения (issue #74, инкременты и модалка «Сохранить и продолжить»); приведение к общему
контракту — отдельная задача. Модалки, справочники и страницы настроек — не экранные формы
сущностей.
