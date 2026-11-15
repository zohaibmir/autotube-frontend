import type { ReactNode } from 'react'
import { Loader2, FileVideo, CheckCircle2, Archive, UploadCloud } from 'lucide-react'

// One status vocabulary for Studio. Kept as a component (not a map inside the list) so the drawer,
// the list and the upload tray cannot drift into three different colour/word choices for "draft".
export type AssetStatus = 'uploading' | 'draft' | 'ready' | 'archived'

const META: Record<AssetStatus, { label: string; icon: ReactNode; pill: string }> = {
  uploading: {
    label: 'Uploading',
    icon: <Loader2 size={12} strokeWidth={1.8} className="animate-spin" />,
    pill: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  },
  draft: {
    label: 'Draft',
    icon: <FileVideo size={12} strokeWidth={1.8} />,
    pill: 'bg-[#FAFAFA] text-[#525252] border-[#E5E5E5]',
  },
  ready: {
    label: 'Ready',
    icon: <CheckCircle2 size={12} strokeWidth={1.8} />,
    pill: 'bg-[#F5F5F5] text-[#0A0A0A] border-[#D4D4D4]',
  },
  archived: {
    label: 'Archived',
    icon: <Archive size={12} strokeWidth={1.8} />,
    pill: 'bg-[#FAFAFA] text-[#A3A3A3] border-[#E5E5E5]',
  },
}

export default function StatusChip({ status }: { status: AssetStatus | string }) {
  const meta = META[(status as AssetStatus) in META ? (status as AssetStatus) : 'draft']
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.pill}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  )
}

export function UploadingChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#2563EB]">
      <UploadCloud size={12} strokeWidth={1.8} />
      Uploading
    </span>
  )
}
