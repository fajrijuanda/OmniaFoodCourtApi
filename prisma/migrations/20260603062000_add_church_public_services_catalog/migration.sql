-- Ensure the public-services catalog includes Church without reseeding existing tenant data.
DO $$
DECLARE
  public_industry_id TEXT;
  church_sub_id TEXT := 'sub_church_public_services';
BEGIN
  SELECT id
  INTO public_industry_id
  FROM industries
  WHERE slug IN ('public-services', 'layanan-publik', 'desa-layanan-publik')
     OR slug LIKE '%layanan-publik%'
  ORDER BY sort_order ASC
  LIMIT 1;

  IF public_industry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM sub_industries WHERE slug IN ('church', 'desa-layanan-publik-church') OR name = 'Church'
  ) THEN
    INSERT INTO sub_industries (
      id,
      industry_id,
      name,
      slug,
      need,
      offer,
      sort_order,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      church_sub_id,
      public_industry_id,
      'Church',
      'desa-layanan-publik-church',
      'Data jemaat, jadwal ibadah, pelayanan, aset, dan donasi.',
      'Member CRM, event calendar, volunteer roster, donation tracking.',
      COALESCE((SELECT MAX(sort_order) + 1 FROM sub_industries WHERE industry_id = public_industry_id), 0),
      true,
      NOW(),
      NOW()
    );

    INSERT INTO features (id, sub_industry_id, name, description, sort_order, is_active, created_at, updated_at)
    VALUES
      ('feat_church_core', church_sub_id, 'Core workflow sub-industri', 'Workflow utama Church.', 0, true, NOW(), NOW()),
      ('feat_church_member_crm', church_sub_id, 'Member CRM', 'Data jemaat dan segmentasi pelayanan.', 1, true, NOW(), NOW()),
      ('feat_church_event_calendar', church_sub_id, 'Event calendar', 'Jadwal ibadah dan kegiatan gereja.', 2, true, NOW(), NOW()),
      ('feat_church_volunteer_roster', church_sub_id, 'Volunteer roster', 'Penjadwalan tim pelayanan.', 3, true, NOW(), NOW()),
      ('feat_church_donation_tracking', church_sub_id, 'Donation tracking', 'Pencatatan donasi dan laporan.', 4, true, NOW(), NOW()),
      ('feat_church_owner_dashboard', church_sub_id, 'Owner dashboard & KPI', 'Ringkasan operasional dan metrik.', 5, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tiers (id, sub_industry_id, name, slug, price, cadence, description, fit, limits_json, sort_order, highlight, is_active, created_at, updated_at)
    VALUES
      ('tier_church_starter', church_sub_id, 'Starter', 'church-starter', 'Rp499rb', '/ bulan', 'Mulai digitalisasi data jemaat dan kegiatan.', 'Komunitas kecil.', '[]'::jsonb, 0, false, true, NOW(), NOW()),
      ('tier_church_growth', church_sub_id, 'Growth', 'church-growth', 'Rp999rb', '/ bulan', 'Workflow pelayanan dan donasi lebih lengkap.', 'Gereja bertumbuh.', '[]'::jsonb, 1, true, true, NOW(), NOW()),
      ('tier_church_business', church_sub_id, 'Business', 'church-business', 'Rp2jt+', '/ bulan', 'Dashboard dan kontrol lintas pelayanan.', 'Multi ministry.', '[]'::jsonb, 2, false, true, NOW(), NOW()),
      ('tier_church_enterprise', church_sub_id, 'Enterprise', 'church-enterprise', 'Custom', '/ bulan', 'Kebutuhan enterprise dan integrasi khusus.', 'Organisasi besar.', '[]'::jsonb, 3, false, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO tier_features (id, tier_id, feature_id, included)
    SELECT 'tf_' || t.id || '_' || f.id, t.id, f.id, true
    FROM tiers t
    CROSS JOIN features f
    WHERE t.sub_industry_id = church_sub_id
      AND f.sub_industry_id = church_sub_id
    ON CONFLICT (tier_id, feature_id) DO NOTHING;
  END IF;
END $$;
