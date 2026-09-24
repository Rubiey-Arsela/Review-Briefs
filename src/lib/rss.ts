// Minimal RSS/Atom parsing without external dependencies (Workers-safe: no DOM,
// pure regex/string scanning — good enough for headline/link/pubDate extraction).

export interface FeedItem {
  title: string
  link: string
  pubDate: string | null
}

export function parseRssItems(xml: string, limit = 25): FeedItem[] {
  const items: FeedItem[] = []
  // RSS 2.0 <item>...</item> or Atom <entry>...</entry>
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []

  for (const block of itemBlocks) {
    if (items.length >= limit) break
    const title = extractTag(block, 'title')
    let link = extractTag(block, 'link')
    // Atom sometimes uses <link href="..."/>
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href="([^"]+)"/i)
      if (hrefMatch) link = hrefMatch[1]
    }
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated')

    if (title && link) {
      items.push({ title: decodeEntities(title).trim(), link: link.trim(), pubDate: pubDate ? pubDate.trim() : null })
    }
  }
  return items
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!match) return null
  let content = match[1]
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  if (cdataMatch) content = cdataMatch[1]
  return content
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
