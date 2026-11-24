import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { searchFromQuery, pageFromQuery, focusFromQuery, listRoute } from '../utils/listSearchQuery'

/**
 * Возврат с формы на список с сохранением `?search=`, `?page=` и `?focus=` из текущего маршрута (issue #135).
 * @param {string} listPath — путь списка, напр. `/systems`
 */
export function useFormListReturn(listPath) {
  const route = useRoute()
  const listSearch = computed(() => searchFromQuery(route.query))
  const listPage = computed(() => pageFromQuery(route.query))
  const listFocus = computed(() => focusFromQuery(route.query))
  const listRouteLocation = computed(() => listRoute(
    listPath,
    listSearch.value,
    {
      ...(listPage.value > 1 ? { page: listPage.value } : {}),
      ...(listFocus.value ? { focus: listFocus.value } : {}),
    },
  ))

  function routeWithListSearch(path, extraQuery = {}) {
    const page = listPage.value
    const focus = listFocus.value
    const withPage = page > 1 && extraQuery.page == null ? { page, ...extraQuery } : { ...extraQuery }
    const withFocus = focus && withPage.focus == null ? { focus, ...withPage } : withPage
    return listRoute(path, listSearch.value, withFocus)
  }

  return { listRouteLocation, listSearch, listPage, listFocus, routeWithListSearch }
}
