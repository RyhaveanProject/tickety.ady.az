/* ==========================================================================
   Başlanğıc məlumatlarının qurulması:
   1) İdarəçi hesabı (env-dən; env boşdursa təhlükəsiz standart hesab)
   2) ADY rəsmi saytının strukturuna uyğun məzmun (səhifələr, istiqamətlər,
      FAQ, əlavə stansiyalar)
   ========================================================================== */
const config = require('../config');
const {
  User, Page, Destination, Faq, Station
} = require('../models/index');
const ady = require('../config/adyContent');

/* Standart idarəçi hesabı — Render Environment-də ADMIN_EMAIL / ADMIN_PASSWORD
   təyin olunmadıqda istifadə olunur ki, idarəetmə panelinə giriş mümkün olsun. */
const DEFAULT_ADMIN_EMAIL = 'admin@ady.az';
const DEFAULT_ADMIN_PASSWORD = 'Ady2026!Admin';

async function ensureAdmin() {
  const email = String(config.adminEmail || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(config.adminPassword || DEFAULT_ADMIN_PASSWORD);
  if (!email || !password) return null;

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      firstName: config.adminFirstName || 'Sistem',
      lastName: config.adminLastName || 'İdarəçi',
      email,
      phone: (config.adminPhones && config.adminPhones[0]) || '',
      password: await User.hashPassword(password),
      role: 'admin',
      managedFromEnv: true,
      locale: 'az'
    });
    console.log('[admin] idarəçi hesabı yaradıldı: ' + email);
  } else if (user.role !== 'admin') {
    user.role = 'admin';
    await user.save();
    console.log('[admin] mövcud hesab idarəçi roluna keçirildi: ' + email);
  }

  /* Giriş üçün yalnız env dəyəri verildikdə şifrə yenilənir */
  if (config.adminPassword && !(await user.comparePasswordSources(password))) {
    user.password = await User.hashPassword(password);
    user.managedFromEnv = true;
    await user.save();
    console.log('[admin] şifrə Render Environment-dən yeniləndi');
  }

  return user;
}

async function seedAdyContent() {
  const adySlugs = ady.DESTINATIONS.map((d) => d.slug);

  /* İstiqamətlər — rəsmi saytdakı yeddi populyar istiqamət */
  for (const d of ady.DESTINATIONS) {
    await Destination.updateOne(
      { slug: d.slug },
      {
        $set: {
          slug: d.slug,
          title: d.title,
          summary: d.summary,
          content: d.content,
          image: d.image,
          stationCode: d.stationCode,
          priceFrom: d.priceFrom,
          durationText: d.durationText,
          distanceKm: d.distanceKm,
          order: d.order,
          active: true
        }
      },
      { upsert: true }
    );
  }
  /* Köhnə nümunə istiqamətlər gizlədilir ki, siyahı rəsmi saytla üst-üstə düşsün */
  await Destination.updateMany({ slug: { $nin: adySlugs } }, { $set: { active: false } });

  /* Tarif səhifələri */
  for (const p of ady.TARIFF_PAGES) {
    await Page.updateOne(
      { slug: p.slug },
      { $set: { slug: p.slug, title: p.title, group: p.group, order: p.order, excerpt: p.excerpt, content: p.content, active: true } },
      { upsert: true }
    );
  }

  /* Sualım var / stansiya bölmə səhifələri */
  const sectionPages = [
    { slug: 'suallar', title: 'Suallar', group: 'sualim', order: 1, excerpt: 'Tez-tez verilən suallar.', content: '' },
    { slug: 'stansiya-ve-vagzallar', title: 'Stansiya və dayanacaqlar', group: 'stansiya', order: 1, excerpt: 'Stansiya və dayanacaqların istifadəyə verilmə tarixləri.', content: ady.STATIONS_HTML },
    { slug: 'mexfilik-siyaseti', title: 'Məxfilik siyasəti', group: 'about', order: 3,
      excerpt: 'İstifadəçi məlumatlarının qorunması qaydaları.',
      content: '<h2>Məxfilik siyasəti</h2><p>Qeydiyyat zamanı daxil edilən şəxsi məlumatlar yalnız bilet satışı və sərnişin daşınması məqsədləri üçün işlənir, üçüncü şəxslərə ötürülmür. Məlumatlar MongoDB verilənlər bazasında saxlanılır.</p>' },
    { slug: 'marsrutlar', title: 'Marşrutlar', group: 'stansiya', order: 2, excerpt: 'Qatarların hərəkət etdiyi marşrutlar və dayanacaqlar.', content: ady.ROUTES_HTML }
  ];
  for (const p of sectionPages) {
    await Page.updateOne({ slug: p.slug }, { $set: Object.assign({ active: true }, p) }, { upsert: true });
  }

  /* FAQ — suallar bölməsi */
  for (const f of ady.FAQS) {
    await Faq.updateOne(
      { question: f.question },
      { $set: { question: f.question, answer: f.answer, order: f.order, active: true } },
      { upsert: true }
    );
  }

  /* Əlavə stansiyalar */
  for (const s of ady.EXTRA_STATIONS) {
    await Station.updateOne({ code: s.code }, { $set: Object.assign({ active: true, source: 'ady' }, s) }, { upsert: true });
  }

  console.log('[seed] ADY məzmunu hazırdır — ' + ady.DESTINATIONS.length + ' istiqamət, '
    + ady.TARIFF_PAGES.length + ' tarif səhifəsi, ' + ady.FAQS.length + ' sual');
}

async function bootstrap() {
  try {
    await ensureAdmin();
  } catch (e) {
    console.warn('[admin] hesab yaradıla bilmədi:', e.message);
  }
  try {
    await seedAdyContent();
  } catch (e) {
    console.warn('[seed] ADY məzmunu yazıla bilmədi:', e.message);
  }
}

module.exports = {
  bootstrap,
  ensureAdmin,
  seedAdyContent,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD
};
