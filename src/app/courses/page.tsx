import { CourseCard, PublicNotice } from "@/components/public/public-ui"
import { PublicPageShell } from "@/components/public/site-shell"
import { getPublicCourses } from "@/features/admin/data"

export const metadata = {
  title: "Courses | Builtbyskills",
  description: "Explore practical Builtbyskills courses in digital marketing, Shopify, Amazon, eBay, and graphic design.",
}

export default async function CoursesPage() {
  const result = await getPublicCourses()

  return (
    <PublicPageShell>
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-lime-700">Course catalog</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Choose Your Track</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Practical courses with live classes, recorded lessons, resources, and mentorship.
          </p>
        </div>
        {!result.ok ? (
          <div className="mt-8">
            <PublicNotice title="Course catalog setup needed" message={result.message} />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {result.data.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </main>
    </PublicPageShell>
  )
}
