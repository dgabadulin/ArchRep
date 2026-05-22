import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchFromQuery, listQueryWithSearch, listRoute } from '../utils/listSearchQuery'

/**
 * Поиск списка, синхронизированный с `?search=` в URL.
 * @returns {{ search: import('vue').Ref<string>, linkTo: (path: string, extraQuery?: object) => object }}
 */
export function useListSearch() {
  const route = useRoute()
  const router = useRouter()
  const search = ref(searchFromQuery(route.query))
  let syncingFromRoute = false

  watch(
    () => route.query.search,
    () => {
      const next = searchFromQuery(route.query)
      if (next === search.value) return
      syncingFromRoute = true
      search.value = next
      syncingFromRoute = false
    },
  )

  watch(search, (v) => {
    if (syncingFromRoute) return
    const current = searchFromQuery(route.query)
    if ((v ?? '') === current) return
    router.replace({ query: listQueryWithSearch(v, route.query) })
  })

  function linkTo(path, extraQuery = {}) {
    return listRoute(path, search.value, extraQuery)
  }

  return { search, linkTo }
}
