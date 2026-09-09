insert into public.profiles (id, full_name, email, phone, whatsapp, role, status)
values
  ('00000000-0000-4000-8000-000000000001', 'Builtbyskills Admin', 'admin@example.com', '+920000000000', '+920000000000', 'super_admin', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'Ayesha Khan', 'instructor@example.com', '+920000000001', '+920000000001', 'instructor', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'Ali Raza', 'student1@example.com', '+920000000002', '+920000000002', 'student', 'active'),
  ('00000000-0000-4000-8000-000000000004', 'Sara Ahmed', 'student2@example.com', '+920000000003', '+920000000003', 'student', 'active')
on conflict (email) do nothing;

insert into public.courses (
  id, title, slug, short_description, description, thumbnail_url, category, level,
  duration_text, price, currency, status, featured, instructor_id, outcomes, requirements
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Shopify and TikTok Ads',
    'shopify-and-tiktok-ads',
    'Build Shopify stores, test products, and run TikTok Ads for Pakistan and UAE markets.',
    'A practical ecommerce course covering Shopify setup, product research, creatives, TikTok advertising, testing, optimization, scaling, and long-term store stability for Pakistan and UAE markets.',
    '/img/course-shopify.png',
    'Ecommerce',
    'Beginner to Intermediate',
    '8 weeks',
    45000,
    'PKR',
    'published',
    true,
    '00000000-0000-4000-8000-000000000002',
    array['Launch a professional Shopify store','Understand product testing and TikTok Ads','Optimize campaigns and scale budgets responsibly'],
    array['Basic computer skills','Internet connection','Willingness to practice']
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Graphic Design and Photoshop',
    'graphic-design-and-photoshop',
    'Learn Photoshop, typography, social media design, print design, and portfolio creation.',
    'A hands-on graphic design course covering design fundamentals, Photoshop workflow, selections, layers, masks, editing, typography, social media creatives, print design, and portfolio-ready final projects.',
    '/img/course-graphic-design.png',
    'Design',
    'Beginner',
    '6 weeks',
    30000,
    'PKR',
    'published',
    true,
    '00000000-0000-4000-8000-000000000002',
    array['Create client-ready social posts','Edit photos confidently','Build a beginner portfolio'],
    array['Laptop or desktop','Adobe Photoshop access']
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'eBay Virtual Assistant',
    'ebay-virtual-assistant',
    'Learn product research, listing optimization, account management, client outreach, and retention.',
    'A practical eBay VA track focused on product research, listing optimization, shipment creation, account management, brand approvals, client acquisition, pricing, negotiation, and retention.',
    '/img/course-ebay.png',
    'Marketplace',
    'Beginner to Intermediate',
    '7 weeks',
    35000,
    'PKR',
    'published',
    false,
    '00000000-0000-4000-8000-000000000002',
    array['Manage eBay seller workflows','Prepare listings and shipments','Pitch and retain VA clients'],
    array['Basic marketplace understanding','English reading skills']
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Amazon Virtual Assistant',
    'amazon-virtual-assistant',
    'Master product research, listings, FBA shipments, Seller Central, tools, and freelancing.',
    'A complete Amazon VA program with product research, listing optimization, FBA shipment creation, Seller Central account management, brand approval strategies, case studies, tools, resources, and freelancing opportunities.',
    '/img/course-amazon.png',
    'Marketplace',
    'Beginner to Intermediate',
    '8 weeks',
    40000,
    'PKR',
    'published',
    false,
    '00000000-0000-4000-8000-000000000002',
    array['Understand Amazon Seller Central','Create optimized listings','Build a VA service offer'],
    array['Computer literacy','Commitment to practical assignments']
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'Digital Marketing with Meta Ads',
    'digital-marketing-with-meta-ads',
    'Plan creatives, launch Meta campaigns, track events, optimize, retarget, report, and manage clients.',
    'A career-focused digital marketing course covering creative preparation, Meta Ads Manager, audience research, campaign launch, Pixel and event tracking, optimization, retargeting, advanced ads, reporting, and client campaign management.',
    '/img/course-meta-ads.png',
    'Marketing',
    'Beginner to Intermediate',
    '8 weeks',
    40000,
    'PKR',
    'published',
    true,
    '00000000-0000-4000-8000-000000000002',
    array['Launch Meta ad campaigns','Read performance reports','Build a client acquisition workflow'],
    array['Facebook account','Basic marketing interest']
  )
on conflict (slug) do nothing;

insert into public.instructor_courses (instructor_id, course_id, assigned_by)
select '00000000-0000-4000-8000-000000000002', id, '00000000-0000-4000-8000-000000000001'
from public.courses
on conflict (instructor_id, course_id) do nothing;

insert into public.course_sections (id, course_id, title, description, position)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Shopify Store Foundation', 'Store setup, professional design, and product research.', 1),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'TikTok Ads Testing and Scaling', 'Ad account setup, testing, optimization, scaling, and stability.', 2),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Photoshop Essentials', 'Interface, selections, layers, masks, and editing workflow.', 1),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'eBay VA Operations', 'Research, listings, shipment creation, account management, and approvals.', 1),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'Amazon Seller Central', 'Research, listing optimization, FBA shipments, and account management.', 1),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000005', 'Meta Ads Foundations', 'Creative preparation, Ads Manager, targeting, launch, and tracking.', 1)
on conflict (course_id, position) do nothing;

insert into public.lessons (section_id, title, slug, description, lesson_type, duration_seconds, position, is_preview, status)
values
  ('20000000-0000-4000-8000-000000000001', 'Shopify Store Setup', 'shopify-store-setup', 'Prepare a clean Shopify foundation.', 'video', 1800, 1, true, 'published'),
  ('20000000-0000-4000-8000-000000000001', 'Winning Product Research', 'winning-product-research', 'Find and validate ecommerce product ideas.', 'video', 2400, 2, false, 'published'),
  ('20000000-0000-4000-8000-000000000002', 'TikTok Ads Testing Strategy', 'tiktok-ads-testing-strategy', 'Set up practical product testing campaigns.', 'video', 2100, 1, false, 'published'),
  ('20000000-0000-4000-8000-000000000003', 'Photoshop Interface and Layers', 'photoshop-interface-and-layers', 'Understand workspace, layers, and masks.', 'video', 1900, 1, true, 'published'),
  ('20000000-0000-4000-8000-000000000004', 'Listing Optimization Basics', 'listing-optimization-basics', 'Improve listing titles, keywords, and presentation.', 'video', 1800, 1, false, 'published'),
  ('20000000-0000-4000-8000-000000000005', 'FBA Shipment Creation', 'fba-shipment-creation', 'Understand shipment workflow and common mistakes.', 'video', 2000, 1, false, 'published'),
  ('20000000-0000-4000-8000-000000000006', 'Campaign Creation and Launch', 'campaign-creation-and-launch', 'Launch a Meta campaign from brief to publish.', 'video', 2200, 1, true, 'published')
on conflict (section_id, slug) do nothing;

insert into public.payment_methods (method_type, display_name, account_title, account_number, bank_name, instructions, is_active)
values
  ('bank_transfer', 'Bank Transfer', 'Builtbyskills Academy', '0000-000000-000000', 'Your Bank Name', 'Use your full name as transaction reference.', true),
  ('easypaisa', 'Easypaisa', 'Builtbyskills Academy', '0300-0000000', null, 'Send payment and upload a clear screenshot.', true),
  ('jazzcash', 'JazzCash', 'Builtbyskills Academy', '0300-0000001', null, 'Send payment and upload a clear screenshot.', true)
on conflict do nothing;

insert into public.enrollments (student_id, course_id, status, enrolled_at, starts_at, expires_at, assigned_by)
values
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'active', now(), now(), now() + interval '90 days', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', 'pending', null, null, null, '00000000-0000-4000-8000-000000000001')
on conflict (student_id, course_id) do nothing;

insert into public.live_classes (course_id, instructor_id, title, description, meeting_provider, meeting_url, starts_at, ends_at, status)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Shopify Product Testing Clinic',
  'Live walkthrough of product testing decisions.',
  'zoom',
  'https://zoom.us/j/example',
  now() + interval '7 days',
  now() + interval '7 days 90 minutes',
  'scheduled'
);

insert into public.announcements (course_id, author_id, title, content, is_published, published_at)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'Welcome to your Shopify batch',
  'Please complete the store setup checklist before the first live class.',
  true,
  now()
);

insert into public.payment_submissions (student_id, course_id, amount, currency, transaction_reference, status, submitted_at)
values
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', 40000, 'PKR', 'DEMO-PENDING-001', 'pending', now()),
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 45000, 'PKR', 'DEMO-APPROVED-001', 'approved', now() - interval '3 days');
