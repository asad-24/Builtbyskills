export type TrackOverview = {
  slug: string
  title: string
  image: string
  summary: string
  project: string
  modules: { title: string; topics: string[] }[]
}

export const trackOverviews: TrackOverview[] = [
  {
    slug: "amazon", title: "Amazon Success Course", image: "/img/courses/amazon.webp",
    summary: "Build practical marketplace skills, from product research and sourcing to listings, fulfillment, and day-to-day seller operations.",
    project: "Prepare a product research report, an optimized listing, and a seller operations checklist for your portfolio.",
    modules: [
      { title: "Marketplace foundations", topics: ["Amazon business models and seller workflows", "Seller Central navigation and account health", "Understanding marketplace fees and product margins"] },
      { title: "Product research & sourcing", topics: ["Demand, competition, and product selection", "Supplier research and sourcing fundamentals", "Costing, profitability, and inventory planning"] },
      { title: "Listings & fulfillment", topics: ["Keyword research, product titles, and listing content", "Product imagery and listing optimization", "FBA and FBM workflows, shipments, and order management"] },
      { title: "Seller operations & client work", topics: ["Performance reporting and account handling", "Customer service and operational checklists", "Packaging Amazon virtual assistant services"] },
    ],
  },
  {
    slug: "digital-marketing", title: "Digital Marketing", image: "/img/courses/digital-marketing.webp",
    summary: "Plan, launch, and improve digital campaigns with a practical approach to audience research, creative strategy, paid media, and reporting.",
    project: "Build a campaign plan with audience research, ad creatives, a testing budget, and a client-ready performance report.",
    modules: [
      { title: "Strategy & audience research", topics: ["Marketing objectives and the customer journey", "Audience research and competitor analysis", "Content planning and campaign briefs"] },
      { title: "Content & brand presence", topics: ["Social media strategy and content calendars", "Creative formats, messaging, and calls to action", "Search visibility and SEO fundamentals"] },
      { title: "Paid campaigns & tracking", topics: ["Meta Ads Manager and campaign structure", "Audience targeting, creatives, and budget planning", "Pixel, event tracking, and retargeting fundamentals"] },
      { title: "Optimization & client reporting", topics: ["Reading campaign metrics and performance reports", "Testing creatives and improving budget allocation", "Presenting results and managing client campaigns"] },
    ],
  },
  {
    slug: "ebay", title: "eBay Complete Course", image: "/img/courses/ebay.webp",
    summary: "Learn the workflows behind a well-managed eBay business, including sourcing, product listings, shipping, customer service, and seller performance.",
    project: "Create a product sourcing shortlist, sample marketplace listings, and an order management workflow.",
    modules: [
      { title: "Seller foundations", topics: ["Marketplace navigation and store setup", "Seller standards and account management", "Fees, pricing, and profit calculations"] },
      { title: "Product research & sourcing", topics: ["Researching demand and competing listings", "Evaluating suppliers and product opportunities", "Inventory and pricing decisions"] },
      { title: "Listings & order management", topics: ["Titles, item specifics, photography, and descriptions", "Listing optimization and store organization", "Order processing, shipping, and tracking"] },
      { title: "Customer experience & growth", topics: ["Buyer communication and returns workflows", "Seller performance and sales reporting", "Preparing an eBay virtual assistant service offer"] },
    ],
  },
  {
    slug: "graphic-design", title: "Graphic Designing", image: "/img/courses/graphic-design.webp",
    summary: "Develop a strong design foundation and learn to turn a brief into clear visual communication for brands, social media, and your portfolio.",
    project: "Create a small brand identity and a coordinated social media campaign, presented as a polished portfolio case study.",
    modules: [
      { title: "Design foundations", topics: ["Composition, visual hierarchy, and spacing", "Color theory and typography", "Understanding briefs and visual references"] },
      { title: "Tools & production workflow", topics: ["Photoshop layers, selections, and masks", "Photo editing, retouching, and image preparation", "Illustrator fundamentals and vector artwork"] },
      { title: "Brand & marketing design", topics: ["Logo concepts and brand identity basics", "Social media creatives and campaign assets", "Print layouts and export preparation"] },
      { title: "Portfolio & client delivery", topics: ["Presenting concepts and responding to feedback", "Organizing source files and final deliverables", "Building case studies and a freelance design offer"] },
    ],
  },
  {
    slug: "shopify", title: "Shopify Complete Course", image: "/img/courses/shopify.webp",
    summary: "Learn how to build and manage an online store, with practical guidance on product research, storefront design, operations, and launch planning.",
    project: "Build a demonstration storefront with product pages, collections, store policies, and a launch checklist.",
    modules: [
      { title: "Ecommerce & product strategy", topics: ["Store models and customer research", "Product selection and competitor analysis", "Pricing, margins, and sourcing fundamentals"] },
      { title: "Store setup & design", topics: ["Shopify navigation and store configuration", "Themes, branding, and mobile-friendly layouts", "Product pages, collections, and navigation"] },
      { title: "Operations & launch", topics: ["Payment and shipping configuration", "Store policies and order management", "Testing the customer journey before launch"] },
      { title: "Marketing & store improvement", topics: ["Traffic sources and advertising fundamentals", "Conversion basics and store analytics", "Presenting a store project to potential clients"] },
    ],
  },
]

// Admin-created course slugs include a unique suffix; skill slugs use short names.
export function getTrackOverview(slug: string): TrackOverview | undefined {
  const normalized = slug.toLowerCase()
  const key = /^(graphic-design|graphic-designing)(-|$)/.test(normalized)
    ? "graphic-design"
    : /^(digital-marketing|meta-ads)(-|$)/.test(normalized) ? "digital-marketing" : normalized
  return trackOverviews.find(track => key === track.slug || key.startsWith(`${track.slug}-`))
}

export function getTrackDetailsHref(slug: string) {
  return `/courses/${getTrackOverview(slug)?.slug ?? encodeURIComponent(slug)}`
}
