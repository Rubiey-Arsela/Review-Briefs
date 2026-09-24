// Thin API client wrapper around axios for the Brief QA & Continuity Desk.
const API = {
  async listBriefs() {
    const { data } = await axios.get('/api/briefs')
    return data.briefs
  },
  async getBrief(id) {
    const { data } = await axios.get(`/api/briefs/${id}`)
    return data
  },
  async createBrief(payload) {
    const { data } = await axios.post('/api/briefs', payload)
    return data
  },
  async updateBrief(id, payload) {
    const { data } = await axios.put(`/api/briefs/${id}`, payload)
    return data
  },
  async deleteBrief(id) {
    const { data } = await axios.delete(`/api/briefs/${id}`)
    return data
  },
  async uploadBriefFile(id, file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`/api/briefs/${id}/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  briefFileUrl(id) {
    return `/api/briefs/${id}/file`
  },
  async saveRows(briefId, rows) {
    const { data } = await axios.put(`/api/briefs/${briefId}/rows`, { rows })
    return data
  },
  async addRow(briefId, row) {
    const { data } = await axios.post(`/api/briefs/${briefId}/rows`, row)
    return data
  },
  async updateRow(rowId, row) {
    const { data } = await axios.put(`/api/briefs/rows/${rowId}`, row)
    return data
  },
  async deleteRow(rowId) {
    const { data } = await axios.delete(`/api/briefs/rows/${rowId}`)
    return data
  },
  async runCheck(briefId) {
    const { data } = await axios.post(`/api/briefs/${briefId}/check`)
    return data
  },
  async getCompliance(briefId) {
    const { data } = await axios.get(`/api/briefs/${briefId}/compliance`)
    return data.issues
  },
  async getRedundancy(briefId) {
    const { data } = await axios.get(`/api/briefs/${briefId}/redundancy`)
    return data.matches
  },

  // Deep Fact-Check reports (multi-source, topic-grouped — see fact_check_reports migration)
  async listFactCheckReports(briefId) {
    const { data } = await axios.get(`/api/briefs/${briefId}/fact-check-reports`)
    return data.reports
  },
  async getFactCheckReport(briefId, reportId) {
    const { data } = await axios.get(`/api/briefs/${briefId}/fact-check-reports/${reportId}`)
    return data.report
  },
  async deleteFactCheckReport(briefId, reportId) {
    const { data } = await axios.delete(`/api/briefs/${briefId}/fact-check-reports/${reportId}`)
    return data
  },

  // Daily log
  async listDailyLog(params) {
    // Returns { entries, sweep, today } — GET auto-triggers the once-per-day
    // watchlist sweep server-side (see src/lib/sweep.ts), so `sweep` tells the UI
    // what just happened (ran / already-done-today / new entries found).
    const { data } = await axios.get('/api/daily-log', { params })
    return data
  },
  async runDailyLogSweep() {
    const { data } = await axios.post('/api/daily-log/sweep')
    return data.sweep
  },
  async createDailyLog(payload) {
    const { data } = await axios.post('/api/daily-log', payload)
    return data
  },
  async updateDailyLog(id, payload) {
    const { data } = await axios.put(`/api/daily-log/${id}`, payload)
    return data
  },
  async deleteDailyLog(id) {
    const { data } = await axios.delete(`/api/daily-log/${id}`)
    return data
  },

  // Entities
  async listEntities() {
    const { data } = await axios.get('/api/entities')
    return data.entities
  },
  async createEntity(payload) {
    const { data } = await axios.post('/api/entities', payload)
    return data
  },
  async updateEntity(id, payload) {
    const { data } = await axios.put(`/api/entities/${id}`, payload)
    return data
  },
  async deleteEntity(id) {
    const { data } = await axios.delete(`/api/entities/${id}`)
    return data
  },

  // Source check
  async sourceLinks(headline) {
    const { data } = await axios.get('/api/source-check/links', { params: { headline } })
    return data.links
  },
  async sourceFeed(outlet) {
    const { data } = await axios.get('/api/source-check/feed', { params: { outlet } })
    return data
  },
}
