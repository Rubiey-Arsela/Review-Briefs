import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import type { AppEnv } from './lib/types'
import briefsRoutes from './routes/briefs'
import dailyLogRoutes from './routes/daily_log'
import entitiesRoutes from './routes/entities'
import sourceCheckRoutes from './routes/source_check'

const app = new Hono<AppEnv>()

app.use('/api/*', cors())

app.route('/api/briefs', briefsRoutes)
app.route('/api/daily-log', dailyLogRoutes)
app.route('/api/entities', entitiesRoutes)
app.route('/api/source-check', sourceCheckRoutes)

app.use('/static/*', serveStatic({ root: './public' }))

app.get('/', (c) => {
  return c.html(INDEX_HTML)
})

// Fallback: serve the SPA shell for any non-API route (client-side routing)
app.get('*', (c) => {
  return c.html(INDEX_HTML)
})

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maida Vale — Brief QA & Continuity Desk</title>
  <link rel="icon" href="data:,">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/styles.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            teal: {
              950: '#122a28',
              900: '#1c3f3c',
              800: '#295650',
              700: '#33685f',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-50 text-slate-800">
  <div id="app"></div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/dayjs@1.11.10/dayjs.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.7.2/mammoth.browser.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.js"></script>
  <script>
    if (window['pdfjsLib']) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js'
    }
  </script>
  <script src="/static/api.js"></script>
  <script src="/static/parser.js"></script>
  <script src="/static/app.js"></script>
</body>
</html>`

export default app
