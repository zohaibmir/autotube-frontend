import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, CheckCircle, XCircle, Loader, Clock, Eye, RotateCcw, X, ChevronLeft, ChevronRight, Trash2, Lock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useJobs, useJobAction } from '@hooks/useJobs'
import { jobsApi } from '@api/services'

const PAGE_SIZE = 25

type Status = 'all' | 'running' | 'done' | 'error' | 'interrupted'

const statusConfig: Record<string, { label: string; icon: React.ReactNode; pill: string }> = {
  queued:      { label: 'Queued',      icon: <Clock size={13} strokeWidth={1.5} />,                              pill: 'bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]' },
  running:     { label: 'Running',     icon: <Loader size={13} strokeWidth={1.5} className="animate-spin" />,   pill: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]' },
  done:        { label: 'Done',        icon: <CheckCircle size={13} strokeWidth={1.5} />,                       pill: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]' },
  error:       { label: 'Error',       icon: <XCircle size={13} strokeWidth={1.5} />,                           pill: 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]' },
  interrupted: { label: 'Interrupted', icon: <XCircle size={13} strokeWidth={1.5} />,                           pill: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]' },
}

export default function JobsList() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: allJobs = [], isLoading } = useJobs({
    search: search || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  })
  const { mutate: runAction } = useJobAction()
  const queryClient = useQueryClient()

  const { data: lockData } = useQuery({
    queryKey: ['pipeline-lock-status'],
    queryFn: () => jobsApi.lockStatus(),
    refetchInterval: 5000,
    staleTime: 4000,
  })

  const cancelMutation = useMutation({
    mutationFn: () => jobsApi.cancel(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline-lock-status'], exact: false }),
  })

  const isLocked = lockData?.status === 'running' || lockData?.locked === true

  const filtered = allJobs
    .filter((j: any) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        j.topic?.toLowerCase().includes(q) ||
        j.job_id?.toLowerCase().includes(q) ||
        j.channel_slug?.toLowerCase().includes(q)
      const matchStatus = statusFilter === 'all' || j.status === statusFilter
      return matchSearch && matchStatus
    })
    .sort((a: any, b: any) => {
      const ta = a.start_time ? new Date(a.start_time).getTime() : 0
      const tb = b.start_time ? new Date(b.start_time).getTime() : 0
      return tb - ta
    })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageJobs = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleStatus = (s: Status) => { setStatusFilter(s); setPage(1) }

  const toggleRow = (jobId: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(jobId) ? n.delete(jobId) : n.add(jobId); return n })

  const allPageSelected = pageJobs.length > 0 && pageJobs.every((j: any) => selected.has(j.job_id))
  const toggleAll = () =>
    setSelected((prev) => {
      if (allPageSelected) { const n = new Set(prev); pageJobs.forEach((j: any) => n.delete(j.job_id)); return n }
      const n = new Set(prev); pageJobs.forEach((j: any) => n.add(j.job_id)); return n
    })

  const selectedCancellable = [...selected].filter((id) => {
    const j = (allJobs as any[]).find((x) => x.job_id === id)
    return j?.status === 'running'
  })
  const selectedRetryable = [...selected].filter((id) => {
    const j = (allJobs as any[]).find((x) => x.job_id === id)
    return j?.status === 'error' || j?.status === 'interrupted'
  })

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Lock-status banner */}
      {isLocked && (
        <div className="mx-8 mb-2 flex items-center gap-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-md px-4 py-2.5">
          <Lock size={13} strokeWidth={1.5} className="text-[#2563EB] shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-medium text-[#1D4ED8]">Pipeline running</span>
            {lockData?.topic && (
              <span className="text-[12px] text-[#3B82F6] ml-2 truncate">{lockData.topic}</span>
            )}
            {lockData?.progress != null && (
              <span className="text-[11px] text-[#93C5FD] ml-2">{lockData.progress}%</span>
            )}
          </div>
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="text-[11px] font-medium text-[#BE123C] border border-[#FECACA] bg-white rounded px-2.5 py-1 hover:bg-[#FEF2F2] transition-colors disabled:opacity-40 shrink-0"
          >
            {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]">Jobs</h1>
          <p className="text-sm text-[#A3A3A3] mt-0.5">All video generation jobs across your channels.</p>
        </div>
        <Link
          to="/app/jobs/new"
          className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors"
        >
          <Plus size={14} strokeWidth={1.5} /> New Job
        </Link>
      </div>

      {/* Filters + Bulk actions */}
      <div className="px-8 pb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-grow max-w-xs">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              type="text"
              placeholder="Search topic or channel…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-[#E5E5E5] rounded-md text-sm bg-white focus:outline-none focus:border-[#A3A3A3] text-[#0A0A0A] placeholder:text-[#A3A3A3]"
            />
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'running', 'done', 'error', 'interrupted'] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => handleStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors border ${
                  statusFilter === s
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#A3A3A3]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0A0A0A] text-white rounded-md text-sm">
            <span className="font-medium">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {selectedRetryable.length > 0 && (
                <button
                  onClick={() => { selectedRetryable.forEach((id) => runAction({ jobId: id, action: 'retry' })); setSelected(new Set()) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
                >
                  <RotateCcw size={12} strokeWidth={1.5} /> Retry ({selectedRetryable.length})
                </button>
              )}
              {selectedCancellable.length > 0 && (
                <button
                  onClick={() => { selectedCancellable.forEach((id) => runAction({ jobId: id, action: 'cancel' })); setSelected(new Set()) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/80 hover:bg-red-500 text-xs font-medium transition-colors"
                >
                  <Trash2 size={12} strokeWidth={1.5} /> Cancel ({selectedCancellable.length})
                </button>
              )}
              <button
                onClick={() => setSelected(new Set())}
                className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
              >
                <X size={12} strokeWidth={1.5} /> Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="px-8 pb-12">
      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
            <tr>
              <th scope="col" className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleAll}
                  className="rounded border-[#D4D4D4] accent-[#0A0A0A] cursor-pointer"
                />
              </th>
              {['Topic', 'Type', 'Status', 'Progress', 'Created', 'Actions'].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 text-left text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <Loader size={18} strokeWidth={1.5} className="text-[#D4D4D4] animate-spin mx-auto" />
                </td>
              </tr>
            ) : pageJobs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <p className="text-[#A3A3A3] text-sm">
                    {allJobs.length === 0
                      ? 'No jobs yet — create your first job!'
                      : 'No jobs match your filter.'}
                  </p>
                  {allJobs.length === 0 && (
                    <Link
                      to="/app/jobs/new"
                      className="mt-4 bg-[#0A0A0A] text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
                    >
                      <Plus size={13} strokeWidth={1.5} /> Create Job
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              pageJobs.map((job: any) => {
                const sc = statusConfig[job.status] || statusConfig.error
                const label = job.topic?.replace(/^\[Short\]\s*/i, '') || job.job_id
                const isShort = /^\[short\]/i.test(job.topic || '')
                const isSelected = selected.has(job.job_id)
                return (
                  <tr
                    key={job.job_id}
                    className={`border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors ${isSelected ? 'bg-[#F5F5F5]' : ''}`}
                  >
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(job.job_id)}
                        className="rounded border-[#D4D4D4] accent-[#0A0A0A] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#0A0A0A] max-w-[240px] truncate" title={label}>{label}</td>
                    <td className="px-4 py-3 text-xs text-[#525252]">{isShort ? 'Short' : 'Long-form'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.pill}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-[#F5F5F5] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#0A0A0A] rounded-full transition-all"
                            style={{ width: `${job.progress || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#A3A3A3] tabular-nums">{job.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#A3A3A3] whitespace-nowrap">
                      {job.start_time ? new Date(job.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/app/jobs/${job.job_id}`} title="View job" aria-label="View job" className="text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors">
                          <Eye size={14} strokeWidth={1.5} />
                        </Link>
                        {(job.status === 'error' || job.status === 'interrupted') && (
                          <button title="Retry" aria-label="Retry job" className="text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
                            onClick={() => runAction({ jobId: job.job_id, action: 'retry' })}>
                            <RotateCcw size={14} strokeWidth={1.5} />
                          </button>
                        )}
                        {job.status === 'running' && (
                          <button title="Cancel" className="text-[#A3A3A3] hover:text-[#BE123C] transition-colors"
                            onClick={() => runAction({ jobId: job.job_id, action: 'cancel' })}>
                            <X size={14} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="px-8 flex items-center justify-between mt-4 text-sm text-[#A3A3A3]">
          <span>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} jobs
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="p-1.5 rounded-md hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#525252]"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 2)
              .reduce<(number | 'ellipsis')[]>((acc, n, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) + 1 < n) acc.push('ellipsis')
                acc.push(n)
                return acc
              }, [])
              .map((n, idx) =>
                n === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-1">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n as number)}
                    className={`w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                      safePage === n
                        ? 'bg-[#0A0A0A] text-white'
                        : 'hover:bg-[#F5F5F5] text-[#525252]'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="p-1.5 rounded-md hover:bg-[#F5F5F5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#525252]"
            >
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

