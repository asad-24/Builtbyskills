import Image from "next/image"
import { getTrackOverview } from "@/lib/courses/catalog"

export function CourseArtwork({ slug, image, title, showTitle = false, priority = false }: {
  slug: string
  image?: string | null
  title: string
  showTitle?: boolean
  priority?: boolean
}) {
  const track = getTrackOverview(slug)
  const src = track?.image ?? image
  return (
    <div className="overflow-hidden bg-[#02062C]">
      <div className="relative aspect-[3/2]">
        {src ? <Image src={src} alt={`${title} thumbnail`} fill sizes="(min-width: 1280px) 560px, (min-width: 768px) 50vw, 100vw" className="object-cover" preload={priority} /> : null}
      </div>
      {showTitle ? <div className="border-t border-white/10 px-5 py-5 text-lg font-bold uppercase tracking-wide text-white">{track?.title ?? title}</div> : null}
    </div>
  )
}
