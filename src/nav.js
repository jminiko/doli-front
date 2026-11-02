export function href(entry) {
  if (!entry || entry.heading) return null
  const screen = entry.screen || entry.id
  let url
  if (entry.mode === 'home' || entry.systemPage === 'dashboard') url = '/'
  else if (entry.systemPage === 'modules') url = '/modules'
  else if (entry.systemPage === 'translate') url = '/translate'
  else if (entry.mode === 'create') url = `/screens/${screen}/new`
  else if (entry.systemPage || entry.mode === 'system') url = `/system/${screen}`
  else url = `/screens/${screen}`
  if (entry.query) url += `?${entry.query}`
  return url
}

function sameQuery(expected, actual) {
  const left = new URLSearchParams(expected || '')
  const right = new URLSearchParams(actual || '')
  const keys = new Set([...left.keys(), ...right.keys()])
  for (const key of keys) {
    if (key === 'lang' || key === 'id' || key === 'row') continue
    if ((left.get(key) || '') !== (right.get(key) || '')) return false
  }
  return true
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
  const currentPath = String(path || '').split('?')[0]
  const currentQuery = String(path || '').includes('?') ? String(path).split('?')[1] : ''
  const targetPath = target.split('?')[0]
  if (entry.mode === 'create') return currentPath === targetPath
  if (targetPath === '/') return currentPath === '/'
  if (entry.query) return currentPath === targetPath && sameQuery(entry.query, currentQuery)
  if (currentPath === targetPath) return true
  if ((entry.mode === 'list' || entry.target === 'list') && currentPath.startsWith(`${targetPath}/`) && !currentPath.endsWith('/new')) return true
  return false
}
