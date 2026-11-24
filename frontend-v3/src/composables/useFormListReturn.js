import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { searchFromQuery, pageFromQuery, listRoute } from '../utils/listSearchQuery'

/**
 * Возврат с формы на список с сохранением `?search=` и `?page=` из текущего маршрута (issue #135).
 * @param {string} listPath — путь списка, напр. `/systems`
 */
export function useFormListReturn(listPath) {
  const route = useRoute()
  const listSearch = computed(() => searchFromQuery(route.query))
  const listPage = computed(() => pageFromQuery(route.query))
  const listRouteLocation = computed(() => listRoute(
    listPath,
    listSearch.value,
    listPage.value > 1 ? { page: listPage.value } : {},
  ))

  function routeWithListSearch(path, extraQuery = {}) {
    const page = listPage.value
    const withPage = page > 1 && extraQuery.page == null ? { page, ...extraQuery } : { ...extraQuery }
    return listRoute(path, listSearch.value, withPage)
  }

  return { listRouteLocation, listSearch, listPage, routeWithListSearch }
}
