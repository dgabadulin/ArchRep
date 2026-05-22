import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { searchFromQuery, listRoute } from '../utils/listSearchQuery'

/**
 * Возврат с формы на список с сохранением `?search=` из текущего маршрута.
 * @param {string} listPath — путь списка, напр. `/systems`
 */
export function useFormListReturn(listPath) {
  const route = useRoute()
  const listSearch = computed(() => searchFromQuery(route.query))
  const listRouteLocation = computed(() => listRoute(listPath, listSearch.value))

  function routeWithListSearch(path, extraQuery = {}) {
    return listRoute(path, listSearch.value, extraQuery)
  }

  return { listRouteLocation, listSearch, routeWithListSearch }
}
