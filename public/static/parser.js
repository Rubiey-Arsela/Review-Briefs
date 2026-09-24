// Client-side document parsing for Word (.docx) and PDF uploads.
// Runs entirely in the browser (mammoth.js + pdf.js) — only the extracted
// text/rows are sent to the Worker, since Cloudflare Pages cannot run heavy
// parsing at the edge.
//
// Word parsing: mammoth converts .docx -> HTML, then we walk each <table>
// looking for your 4-column format (Headline / Summary / Near-term Impact &
// Strategic Implications / Regulatory-Policy Changes). This is precise
// because the column boundaries are real table cells.
//
// PDF parsing: pdf.js extracts a flat text stream (tables are NOT structured
// in a PDF the way they are in a docx). We reconstruct rows heuristically
// using the "Positive./Negative./Neutral./Mixed." opener as an anchor for
// where the Impact cell starts, and blank-line / heading patterns to guess
// section (sector) breaks. This is best-effort — please review parsed rows
// before running checks, especially column boundaries.

const Parser = {
  async parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase()
    if (ext === 'docx') {
      return await this.parseDocx(file)
    } else if (ext === 'pdf') {
      return await this.parsePdf(file)
    } else if (ext === 'doc') {
      throw new Error('Legacy .doc is not supported — please save as .docx and re-upload.')
    } else {
      throw new Error(`Unsupported file type ".${ext}" — please upload .docx or .pdf.`)
    }
  },

  async parseDocx(file) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    const html = result.value
    const rawTextResult = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    const rawText = rawTextResult.value

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const tables = Array.from(doc.querySelectorAll('table'))

    const rows = []
    let currentSector = 'Other'

    // Walk the body in document order so we can pick up sector headings
    // (plain paragraphs like "1. Property Sector") that precede each table.
    const bodyNodes = Array.from(doc.body.childNodes)
    for (const node of bodyNodes) {
      if (node.nodeType === 1 && /^H[1-6]$/.test(node.tagName)) {
        const text = node.textContent.trim()
        if (text) currentSector = guessSector(text)
      } else if (node.nodeType === 1 && node.tagName === 'P') {
        const text = node.textContent.trim()
        const sectorGuess = guessSectorFromHeadingLine(text)
        if (sectorGuess) currentSector = sectorGuess
      } else if (node.nodeType === 1 && node.tagName === 'TABLE') {
        const tableRows = Array.from(node.querySelectorAll('tr'))
        for (const tr of tableRows) {
          const cells = Array.from(tr.querySelectorAll('td,th')).map((td) => td.textContent.trim())
          if (cells.length < 2) continue
          // Skip header rows like "Headline | Summary | Near term Impact..."
          if (/headline/i.test(cells[0]) && /summary/i.test(cells[1] || '')) continue
          if (cells.every((c) => !c)) continue

          const [headlineCell, summaryCell, impactCell, regulatoryCell] = [
            cells[0] || '',
            cells[1] || '',
            cells[2] || '',
            cells[3] || '',
          ]
          const { headline, sourceName, sourceDate } = splitHeadlineAndSource(headlineCell)
          const { grade, text: impactText } = splitImpactGrade(impactCell)

          if (!headline) continue

          rows.push({
            sector: currentSector,
            headline,
            source_name: sourceName,
            source_date: sourceDate,
            source_url: null,
            summary: summaryCell,
            impact_grade: grade,
            impact_text: impactText,
            regulatory_text: regulatoryCell && regulatoryCell !== '-' ? regulatoryCell : null,
          })
        }
      }
    }

    return {
      rows,
      raw_text: rawText,
      parse_confidence: rows.length > 0 ? 'high' : 'low',
      warnings: rows.length === 0 ? ['No table rows detected — the document may use a different structure. Review and add rows manually.'] : [],
    }
  },

  async parsePdf(file) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''
    const lines = []
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const content = await page.getTextContent()
      let lastY = null
      let currentLine = []
      for (const item of content.items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) {
          if (currentLine.length) lines.push(currentLine.join(' ').trim())
          currentLine = []
        }
        currentLine.push(item.str)
        lastY = item.transform[5]
      }
      if (currentLine.length) lines.push(currentLine.join(' ').trim())
      lines.push('') // page break marker
    }
    fullText = lines.join('\n')

    const rows = extractRowsFromPlainText(lines)

    return {
      rows,
      raw_text: fullText,
      parse_confidence: rows.length > 0 ? 'medium' : 'low',
      warnings: [
        'PDF parsing is best-effort: column boundaries (Headline/Summary/Impact/Regulatory) are reconstructed from text patterns, not real table cells. Please review each row before running checks.',
        ...(rows.length === 0 ? ['No rows could be reconstructed automatically — please add rows manually or re-export from Word.'] : []),
      ],
    }
  },
}

// --- Heuristic helpers ------------------------------------------------------

const SECTOR_KEYWORDS = [
  ['global', 'Global'],
  ['asia pacific', 'Asia Pacific'],
  ['malaysia macro', 'Malaysia Macro'],
  ['macroeconom', 'Malaysia Macro'],
  ['port', 'Ports/Infrastructure/Logistics'],
  ['infrastructure', 'Ports/Infrastructure/Logistics'],
  ['logistic', 'Ports/Infrastructure/Logistics'],
  ['automotive', 'Automotive/Services'],
  ['agricultur', 'Agriculture/Food Security'],
  ['food security', 'Agriculture/Food Security'],
  ['energy', 'Energy/Power/Sustainability'],
  ['power', 'Energy/Power/Sustainability'],
  ['sustainab', 'Energy/Power/Sustainability'],
  ['digital', 'Digital Economy/Technology/Data Centres'],
  ['data centre', 'Digital Economy/Technology/Data Centres'],
  ['data center', 'Digital Economy/Technology/Data Centres'],
  ['technology', 'Digital Economy/Technology/Data Centres'],
  ['propert', 'Property'],
  ['aviation', 'Aviation'],
  ['banking', 'Banking/Financial Services'],
  ['financial services', 'Banking/Financial Services'],
  ['watchlist', 'Watchlist'],
  ['speed read', 'Speed Read'],
]

function guessSector(headingText) {
  const lower = headingText.toLowerCase()
  for (const [kw, sector] of SECTOR_KEYWORDS) {
    if (lower.includes(kw)) return sector
  }
  return 'Other'
}

// Matches lines like "1. Property Sector" or "5. Energy" that act as section
// headers even when not styled as a Word heading.
function guessSectorFromHeadingLine(text) {
  if (!text) return null
  const m = text.match(/^\d+[.)]\s*(.+)$/)
  if (!m) return null
  const candidate = m[1].trim()
  if (candidate.split(' ').length > 6) return null // too long to be a section title
  const lower = candidate.toLowerCase()
  for (const [kw, sector] of SECTOR_KEYWORDS) {
    if (lower.includes(kw)) return sector
  }
  return null
}

// Headline cells typically look like:
//   "Headline text in bold."
//   "(The Star, 22 Sept 2026)"
// mammoth flattens bold runs into the same text node, so source is usually on
// its own line within the cell — split on the parenthetical pattern.
function splitHeadlineAndSource(cellText) {
  const sourceMatch = cellText.match(/\(([^()]+),\s*([0-9]{1,2}\s+\w+\.?\s*[0-9]{2,4})\)\s*$/)
  if (sourceMatch) {
    const headline = cellText.slice(0, cellText.lastIndexOf(sourceMatch[0])).trim()
    return { headline: stripLeadingRefTags(headline), sourceName: sourceMatch[1].trim(), sourceDate: sourceMatch[2].trim() }
  }
  // fallback: try splitting on newline if mammoth preserved a <br>
  const parts = cellText.split('\n').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    const paren = last.match(/^\(([^,]+),\s*(.+)\)$/)
    if (paren) {
      return { headline: stripLeadingRefTags(parts.slice(0, -1).join(' ')), sourceName: paren[1].trim(), sourceDate: paren[2].replace(')', '').trim() }
    }
  }
  return { headline: stripLeadingRefTags(cellText.trim()), sourceName: null, sourceDate: null }
}

function stripLeadingRefTags(text) {
  return text.replace(/^\s*(\[[A-Za-z0-9]+\]\s*)+/, '').trim()
}

function splitImpactGrade(cellText) {
  const match = cellText.trim().match(/^([A-Za-z]+)\.\s*([\s\S]*)$/)
  const validGrades = ['Positive', 'Negative', 'Neutral', 'Mixed']
  if (match && validGrades.includes(match[1])) {
    return { grade: match[1], text: cellText.trim() }
  }
  return { grade: null, text: cellText.trim() || null }
}

// Best-effort PDF row reconstruction: scan lines for the Impact-opener pattern
// ("Positive.", "Negative.", "Neutral.", "Mixed.") which anchors the end of a
// news item's headline+summary block and the start of its impact statement.
function extractRowsFromPlainText(lines) {
  const rows = []
  let currentSector = 'Other'
  let buffer = []

  const flush = () => {
    if (buffer.length === 0) return
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim()
    buffer = []
    if (!joined) return

    const impactMatch = joined.match(/\b(Positive|Negative|Neutral|Mixed)\.\s+([\s\S]+)$/)
    let headlineSummary = joined
    let grade = null
    let impactText = null
    if (impactMatch) {
      headlineSummary = joined.slice(0, joined.lastIndexOf(impactMatch[0])).trim()
      grade = impactMatch[1]
      impactText = `${impactMatch[1]}. ${impactMatch[2]}`.trim()
    }

    const sourceMatch = headlineSummary.match(/\(([^()]+),\s*([0-9]{1,2}\s+\w+\.?\s*[0-9]{2,4})\)/)
    let headline = headlineSummary
    let summary = null
    let sourceName = null
    let sourceDate = null
    if (sourceMatch) {
      const idx = headlineSummary.indexOf(sourceMatch[0])
      headline = headlineSummary.slice(0, idx).trim()
      summary = headlineSummary.slice(idx + sourceMatch[0].length).trim() || null
      sourceName = sourceMatch[1].trim()
      sourceDate = sourceMatch[2].trim()
    }

    if (headline && headline.length > 8) {
      rows.push({
        sector: currentSector,
        headline: stripLeadingRefTags(headline),
        source_name: sourceName,
        source_date: sourceDate,
        source_url: null,
        summary,
        impact_grade: grade,
        impact_text: impactText,
        regulatory_text: null,
      })
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const headingSector = guessSectorFromHeadingLine(trimmed) || (trimmed.length < 40 ? guessSector(trimmed) : null)
    if (headingSector && headingSector !== 'Other' && trimmed.split(' ').length <= 6) {
      flush()
      currentSector = headingSector
      continue
    }

    buffer.push(trimmed)
    // If this line ends an impact statement (grade + full stop somewhere, and
    // ends with a full stop), treat it as the end of one row.
    if (/\b(Positive|Negative|Neutral|Mixed)\./.test(buffer.join(' ')) && /[.!?]\s*$/.test(trimmed)) {
      flush()
    }
  }
  flush()

  return rows
}
