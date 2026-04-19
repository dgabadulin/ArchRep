/**
 * Плоский список бизнес-функций → дерево для ECharts treemap.
 */
export function flatBusinessFunctionsToTreemap(rows) {
  if (!rows?.length) {
    return { name: 'Бизнес-способности', value: 1, children: [] }
  }

  const byId = new Map()
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      name: (r.name || r.code || `#${r.id}`).trim(),
      code: r.code,
      parent_id: r.parent_id,
      children: [],
    })
  }

  const roots = []
  for (const r of rows) {
    const node = byId.get(r.id)
    const pid = r.parent_id
    if (pid != null && byId.has(pid)) {
      byId.get(pid).children.push(node)
    } else {
      roots.push(node)
    }
  }

  if (roots.length === 0) {
    return {
      name: 'Бизнес-способности',
      children: rows.map((r) => ({
        name: (r.name || r.code || `#${r.id}`).trim(),
        value: 1,
        id: r.id,
        code: r.code,
      })),
    }
  }

  function setValue(n) {
    if (!n.children.length) {
      n.value = 1
      return 1
    }
    let s = 0
    for (const c of n.children) {
      s += setValue(c)
    }
    n.value = Math.max(s, 1)
    return n.value
  }
  for (const root of roots) {
    setValue(root)
  }

  function toEcharts(n) {
    const o = {
      name: n.name,
      value: n.value,
      id: n.id,
      code: n.code,
    }
    if (n.children.length) {
      o.children = n.children.map(toEcharts)
    }
    return o
  }

  const children = roots.map(toEcharts)
  if (children.length === 1) {
    return children[0]
  }
  let total = 0
  for (const c of children) {
    total += c.value || 1
  }
  return {
    name: 'Бизнес-способности',
    value: Math.max(total, 1),
    children,
  }
}

/**
 * Мягкий перенос только по пробелам (без рубки слова), для полноэкранного режима.
 * Не комбинировать с overflow: 'break' в ECharts — иначе в узких плитках получаются «столбики» по 1–2 буквы.
 */
function wrapLabelAtSpaces(str, maxPerLine) {
  const s = String(str || '').trim()
  if (!s || s.length <= maxPerLine) return s
  const lines = []
  let rest = s
  while (rest.length > 0) {
    if (rest.length <= maxPerLine) {
      lines.push(rest)
      break
    }
    const slice = rest.slice(0, maxPerLine + 1)
    const lastSpace = slice.lastIndexOf(' ')
    if (lastSpace > 0) {
      lines.push(rest.slice(0, lastSpace).trim())
      rest = rest.slice(lastSpace).trim()
    } else {
      lines.push(rest)
      break
    }
  }
  return lines.filter(Boolean).join('\n')
}

export function treemapOptionFromTree(tree, { titleText, compact = false } = {}) {
  const fontLeaf = compact ? 8 : 12
  const fontUpper = compact ? 8 : 11
  const lineHLeaf = Math.max(9, Math.round(fontLeaf * 1.25))
  const lineHUpper = Math.max(9, Math.round(fontUpper * 1.25))

  const labelCompact = {
    show: true,
    formatter: '{b}',
    fontSize: fontLeaf,
    lineHeight: lineHLeaf,
    color: '#1a1917',
    overflow: 'truncate',
    ellipsis: '…',
    width: '100%',
    padding: [0, 1, 0, 1],
  }
  const labelFull = {
    show: true,
    formatter(p) {
      const name = p?.name ?? p?.data?.name ?? ''
      return wrapLabelAtSpaces(name, 26)
    },
    fontSize: fontLeaf,
    lineHeight: lineHLeaf,
    color: '#1a1917',
    overflow: 'none',
    width: '96%',
    padding: [1, 2, 1, 2],
  }

  const upperCompact = {
    show: true,
    formatter: '{b}',
    height: 22,
    fontSize: fontUpper,
    lineHeight: lineHUpper,
    color: '#2d2a26',
    overflow: 'truncate',
    ellipsis: '…',
    width: '100%',
    padding: [0, 1, 0, 1],
  }
  const upperFull = {
    show: true,
    height: 34,
    formatter(p) {
      const name = p?.name ?? p?.data?.name ?? ''
      return wrapLabelAtSpaces(name, 32)
    },
    fontSize: fontUpper,
    lineHeight: lineHUpper,
    color: '#2d2a26',
    overflow: 'none',
    width: '96%',
    padding: [1, 2, 1, 2],
  }

  const itemStyle = compact
    ? { borderColor: '#fff', borderWidth: 1, gapWidth: 1 }
    : { borderColor: '#fff', borderWidth: 2, gapWidth: 2 }

  return {
    title: titleText
      ? {
          text: titleText,
          left: 'center',
          top: 8,
          textStyle: { fontSize: 14, color: '#2d2a26' },
        }
      : undefined,
    tooltip: {
      trigger: 'item',
      formatter(info) {
        const { name, value, data } = info
        const lines = [String(name), `Вес (узлов в поддереве): ${value}`]
        if (data?.code) lines.push(`Код: ${data.code}`)
        return lines.join('\n')
      },
    },
    series: [
      {
        type: 'treemap',
        roam: false,
        nodeClick: 'zoomToNode',
        breadcrumb: {
          show: true,
          height: 32,
          left: 'center',
          top: 'bottom',
          emptyItemWidth: 28,
          itemStyle: {
            color: '#f5f0e8',
            borderColor: '#d4c4b0',
            borderWidth: 1,
            shadowBlur: 0,
            shadowColor: 'transparent',
          },
          emphasis: {
            itemStyle: {
              color: '#e8dfd0',
              borderColor: '#cb997e',
              shadowBlur: 0,
            },
            textStyle: {
              color: '#5c3d2e',
              fontWeight: 600,
            },
          },
          textStyle: {
            color: '#2d2a26',
            fontSize: 12,
            fontWeight: 500,
          },
        },
        label: compact ? labelCompact : labelFull,
        upperLabel: compact ? upperCompact : upperFull,
        itemStyle,
        colorSaturation: [0.35, 0.65],
        color: ['#e2efda', '#c5e0b4', '#a9d18e', '#8fbc6f', '#70ad47', '#548235'],
        data: [tree],
      },
    ],
  }
}
