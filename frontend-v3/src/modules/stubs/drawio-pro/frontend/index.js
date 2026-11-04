/**
 * Заглушка `@isar/drawio-pro/frontend` для сборки без установленного пакета.
 * Реальный пакет отдаёт `createController`, `canShowButton`, `loadModuleInfo` и компоненты;
 * ядру из него нужны только Vue-компоненты (подключаются напрямую через alias).
 */
export const createController = null
export const canShowButton = () => false
export const loadModuleInfo = async () => null
export const adrFormSurface = () => null
export default { createController, canShowButton, loadModuleInfo, adrFormSurface }
