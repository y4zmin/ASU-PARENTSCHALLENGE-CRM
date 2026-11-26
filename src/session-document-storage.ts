import { supabase } from './supabase'

const bucket = supabase.storage.from('session-documents')

export async function listSessionDocuments(sessionId: string) {
  const files: { name: string; path: string; updatedAt: string | null }[] = []
  const limit = 100
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await bucket.list(sessionId, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error
    for (const item of data) {
      if (item.id && !item.name.startsWith('.')) {
        files.push({ name: item.name, path: `${sessionId}/${item.name}`, updatedAt: item.updated_at })
      }
    }
    if (data.length < limit) break
  }
  return files.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export async function getSessionDocumentLink(path: string, download = false): Promise<string> {
  const { data, error } = await bucket.createSignedUrl(path, 15 * 60, { download })
  if (error || !data?.signedUrl) throw error ?? new Error('Document link unavailable')
  return data.signedUrl
}
