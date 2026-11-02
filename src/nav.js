export function href(entry) {
  if (!entry || entry.heading) return null
  const screen = entry.screen || entry.id
  if (entry.mode === 'home' || entry.systemPage === 'dashboard') return '/'
  if (entry.systemPage === 'modules') return '/modules'
  if (entry.systemPage === 'translate') return '/translate'
  if (entry.mode === 'create') return `/screens/${screen}/new`
  if (entry.systemPage || entry.mode === 'system') return `/system/${screen}`
  return `/screens/${screen}`
}

export function groupOpen(group, path) {
  if (!group) return false
  if (matches(group.link, path)) return true
  return (group.entries || []).some((entry) => matches(entry, path))
}

export function menuFolds(group) {
  const entries = group?.entries || []
  if (group?.fold === 'section') return entries.length > 0
  return entries.some((entry) => entry.level > 1 || entry.heading)
}

export function visibleEntries(group, path) {
  const entries = group?.entries || []
  const open = groupOpen(group, path)
  const primary = entries.find((entry) => !entry.heading && entry.level <= 1 && entry.mode === 'list')
  return entries.filter((entry, index) => {
    if ((group.fold || 'deep') === 'section') {
      if (!open) return false
    } else if (!open) {
      return entry.level <= 1 && !entry.heading
    }
    if (entry.level <= 1) return true
    let parent = null
    for (let i = index - 1; i >= 0; i -= 1) {
      if (entries[i].level < entry.level) {
        parent = entries[i]
        break
      }
    }
    if (!parent || parent.heading || parent.id === primary?.id) return true
    const start = entries.indexOf(parent)
    const branch = [parent]
    for (let i = start + 1; i < entries.length; i += 1) {
      if (entries[i].level <= parent.level) break
      branch.push(entries[i])
    }
    return branch.some((item) => matches(item, path))
  })
}

export function matches(entry, path) {
  const target = href(entry)
  if (!target) return false
  if (entry.mode === 'create') return path === target
  if (target === '/') return path === '/'
  if (path === target) return true
  if ((entry.mode === 'list' || entry.target === 'list') && path.startsWith(`${target}/`) && !path.endsWith('/new')) return true
  return false
}
