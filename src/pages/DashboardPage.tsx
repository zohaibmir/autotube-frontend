import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '@components/DashboardLayout'

// ── Lazy page imports — each route becomes its own JS chunk ──────────────────
const DashboardHome     = lazy(() => import('./dashboard/DashboardHome'))
const JobsList          = lazy(() => import('./dashboard/JobsList'))
const JobDetail         = lazy(() => import('./dashboard/JobDetail'))
const NewJob            = lazy(() => import('./dashboard/NewJob'))
const ChannelsPage      = lazy(() => import('./dashboard/ChannelsPage'))
const ChannelDetailPage = lazy(() => import('./dashboard/ChannelDetailPage'))
const Settings          = lazy(() => import('./dashboard/Settings'))
const Billing           = lazy(() => import('./dashboard/Billing'))
const QueuePage         = lazy(() => import('./dashboard/QueuePage'))
const AnalyticsPage     = lazy(() => import('./dashboard/AnalyticsPage'))
const SocialPage        = lazy(() => import('./dashboard/SocialPage'))
const StudioPage        = lazy(() => import('./dashboard/StudioPage'))
const CustomStudioPage  = lazy(() => import('./dashboard/CustomStudioPage'))
const CalendarPage      = lazy(() => import('./dashboard/CalendarPage'))
const KidsPage          = lazy(() => import('./dashboard/KidsPage'))
const AdminPage         = lazy(() => import('./dashboard/AdminPage'))
const CommunityPage     = lazy(() => import('./dashboard/CommunityPage'))
const ShortsPage        = lazy(() => import('./dashboard/ShortsPage'))
const CreateLayout      = lazy(() => import('./create/CreateLayout'))
const IdeasPage         = lazy(() => import('./create/IdeasPage'))
const ScriptPage        = lazy(() => import('./create/ScriptPage'))
const SeoPage           = lazy(() => import('./create/SeoPage'))
const ThumbnailPage     = lazy(() => import('./create/ThumbnailPage'))
const SubmitPage        = lazy(() => import('./create/SubmitPage'))

// ── Page loading skeleton ─────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-6 max-w-[1200px]" aria-busy="true" aria-label="Loading page">
      <div className="h-6 w-48 bg-[#F5F5F5] rounded animate-pulse mb-2" />
      <div className="h-3 w-72 bg-[#F5F5F5] rounded animate-pulse mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-[#F5F5F5] rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-[#F5F5F5] rounded-lg animate-pulse" />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/jobs" element={<JobsList />} />
          <Route path="/jobs/new" element={<NewJob />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
          <Route path="/channels" element={<ChannelsPage />} />
          <Route path="/channels/:slug" element={<ChannelDetailPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/studio/custom" element={<CustomStudioPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/kids" element={<KidsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/shorts" element={<ShortsPage />} />
          <Route path="/create" element={<CreateLayout />}>
            <Route index element={<IdeasPage />} />
            <Route path="ideas" element={<IdeasPage />} />
            <Route path="script" element={<ScriptPage />} />
            <Route path="seo" element={<SeoPage />} />
            <Route path="thumbnail" element={<ThumbnailPage />} />
            <Route path="submit" element={<SubmitPage />} />
          </Route>
        </Routes>
      </Suspense>
    </DashboardLayout>
  )
}
