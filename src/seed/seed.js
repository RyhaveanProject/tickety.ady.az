/* ADY bilet portalı — ilkin məlumat bazası
   İstifadə: npm run seed   |   npm run seed:force   |   node src/seed/seed.js */
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const config = require('../config');
const { connectDatabase } = require('../config/db');
const { Station, Train, User, News, Page, Destination, Faq, Setting, Trip } = require('../models/index');
const { STATIONS, buildTrains } = require('../services/referenceData');

/* ==================== Səhifə mətnləri ==================== */
const PAGES = [
  {
    slug: 'gedis-haqqinin-qaytarilmasi', title: 'Gediş haqqının qaytarılması', group: 'tariffs', order: 1,
    excerpt: 'Biletin qaytarılması qaydaları və xidmət haqqı.',
    content: `<h2>Gediş haqqının qaytarılması</h2>
<p>Elektron biletin qaytarılması yalnız satışın bağlandığı vaxtdan əvvəl mümkündür. Satış qatarın yola düşməsindən üç saat əvvəl bağlanır.</p>
<h3>Qaytarma mərhələləri</h3>
<table class="data">
<thead><tr><th>Müraciət vaxtı</th><th>Tutulan xidmət haqqı</th></tr></thead>
<tbody>
<tr><td>Bilet alındıqdan sonra 15 dəqiqə ərzində</td><td>Tutulmur</td></tr>
<tr><td>Yola düşmədən 24 saatdan çox əvvəl</td><td>20 faiz</td></tr>
<tr><td>Yola düşmədən 24 saatdan az əvvəl</td><td>50 faiz</td></tr>
</tbody>
</table>
<p>Məbləğ bilet sahibinin şəxsi balans hesabına qaytarılır və növbəti alışlarda istifadə oluna bilər.</p>`
  },
  {
    slug: 'odenis-usullari', title: 'Ödəniş üsulları', group: 'tariffs', order: 2,
    excerpt: 'Bank kartı və şəxsi balans hesabı ilə ödəniş imkanları.',
    content: `<h2>Ödəniş üsulları</h2>
<p>Biletin dəyəri bank kartı və ya şəxsi balans hesabı vasitəsilə ödənilir. Ödəniş zamanı kart məlumatları daxil edilir və ödəniş təsdiqi 3-D Secure doğrulaması ilə tamamlanır.</p>
<h3>Dəstəklənən kartlar</h3>
<ul><li>Visa</li><li>Mastercard</li><li>MilliKart</li></ul>
<h3>Ödənişin mərhələləri</h3>
<ol>
<li>Kart məlumatlarının daxil edilməsi</li>
<li>Kart məlumatlarının yoxlanılması</li>
<li>3-D Secure doğrulama kodunun təsdiqi</li>
<li>Biletin elektron formada verilməsi</li>
</ol>
<p>Balans hesabı ilə alışda da kart məlumatları tələb olunur və ödəniş eyni doğrulama mərhələlərindən keçir.</p>`
  },
  {
    slug: 'elektron-bilet', title: 'Elektron bilet', group: 'tariffs', order: 3,
    excerpt: 'Elektron biletin alınması, istifadəsi və QR kod.',
    content: `<h2>Elektron bilet</h2>
<p>Elektron bilet alışdan sonra şəxsi kabinetdə yerləşir. Bilet PDF formatında yüklənə bilər və üzərində QR kod mövcuddur.</p>
<ul>
<li>Bilet yola düşməzdən əvvəl telefon və ya çap formasında təqdim edilir.</li>
<li>QR kod vaqon bələdçisi tərəfindən oxunur.</li>
<li>Bilet başqa şəxsə ötürülə bilməz.</li>
</ul>
<p>Bir sifarişdə maksimum dörd bilet alına bilər.</p>`
  },
  {
    slug: 'tarifler', title: 'Tariflər', group: 'tariffs', order: 4,
    excerpt: 'Reyslər üzrə gediş haqları və sinif fərqləri.',
    content: `<h2>Tariflər</h2>
<p>Gediş haqqı məsafəyə, qatarın növünə və vaqon sinfinə görə hesablanır.</p>
<table class="data">
<thead><tr><th>İstiqamət</th><th>Standart</th><th>Biznes</th><th>Birinci sinif</th></tr></thead>
<tbody>
<tr><td>Abşeron dairəvi xətti (Bakı — Sumqayıt)</td><td>1.20 ₼</td><td>2.40 ₼</td><td>—</td></tr>
<tr><td>Bakı — Gəncə</td><td>9.60 ₼</td><td>19.20 ₼</td><td>28.80 ₼</td></tr>
<tr><td>Bakı — Qazax</td><td>12.30 ₼</td><td>24.60 ₼</td><td>36.90 ₼</td></tr>
<tr><td>Bakı — Şəki</td><td>11.40 ₼</td><td>22.80 ₼</td><td>34.20 ₼</td></tr>
<tr><td>Bakı — Qəbələ</td><td>14.00 ₼</td><td>31.00 ₼</td><td>93.00 ₼</td></tr>
<tr><td>Bakı — Lənkəran</td><td>8.90 ₼</td><td>17.80 ₼</td><td>—</td></tr>
<tr><td>Bakı — Tbilisi (kupe: 81.00 ₼)</td><td>—</td><td>132.00 ₼</td><td>199.00 ₼</td></tr>
<tr><td>Tbilisi — Batumi</td><td>25.00 ₼</td><td>45.00 ₼</td><td>65.00 ₼</td></tr>
</tbody>
</table>`
  },
  {
    slug: 'usaqlarla-seyahet', title: 'Uşaqlarla səyahət', group: 'rules', order: 1,
    excerpt: 'Uşaqların qatarla daşınması qaydaları.',
    content: `<h2>Uşaqlarla səyahət</h2>
<ul>
<li>Altı yaşadək uşaqlar yetkin şəxsin müşayiəti ilə bilet almadan daşına bilər; ayrıca oturacaq yeri ayrılmır.</li>
<li>Altı yaşdan on dörd yaşadək uşaqlar üçün gediş haqqı tam tarifin yarısı həcmində hesablanır.</li>
<li>On dörd yaşdan yuxarı sərnişinlər üçün tam tarif tətbiq olunur.</li>
</ul>
<p>Uşağın daşınması üçün doğum haqqında şəhadətnamə və ya şəxsiyyət vəsiqəsi təqdim edilir.</p>`
  },
  {
    slug: 'el-yuklerinin-dasinmasi', title: 'Əl yüklərinin daşınması', group: 'rules', order: 2,
    excerpt: 'Sərnişinin yanında aparıla bilən yüklərin normaları.',
    content: `<h2>Əl yüklərinin daşınması</h2>
<p>Sərnişin yanında ölçüləri 36 × 28 × 60 santimetrdən, çəkisi 36 kiloqramdan çox olmayan əl yükü apara bilər.</p>
<ul>
<li>Əl yükü baqaj rəfində və ya oturacaq altında yerləşdirilir.</li>
<li>Yoldaşlar arasında bölüşdürülməyən yük üçün əlavə haqq tətbiq olunur.</li>
<li>Asanlıqla alışan, xarab olan və ya ətrafa zərər verə bilən əşyalar daşınmır.</li>
</ul>`
  },
  {
    slug: 'heyvanlarin-dasinmasi', title: 'Heyvanların daşınması', group: 'rules', order: 3,
    excerpt: 'Ev heyvanlarının qatarla daşınması şərtləri.',
    content: `<h2>Heyvanların daşınması</h2>
<p>Xırda ev heyvanları xüsusi qəfəsdə, sərnişinin yanında daşına bilər. Qəfəsin ölçüləri əl yükü normalarını aşmamalıdır.</p>
<ul>
<li>İri cins itlər yalnız ağızlıqla bağlı vəziyyətdə, separat vaqonda daşınır.</li>
<li>Bələdçi iti üçün ayrıca sənəd tələb olunur.</li>
<li>Heyvanın daşınması üçün baytar şəhadətnaməsi təqdim edilir.</li>
</ul>`
  },
  {
    slug: 'siqaret-cekilmesi', title: 'Siqaret çəkilməsi qadağandır', group: 'rules', order: 4,
    excerpt: 'Qatarlarda siqaret çəkmə qadağası.',
    content: `<h2>Siqaret çəkilməsi qadağandır</h2>
<p>Bütün vaqonlarda, o cümlədən keçidlərdə və tualetlərdə siqaret çəkmək qadağandır. Elektron siqaret və buxar cihazları da bu qadağaya aiddir.</p>`
  },
  {
    slug: 'haqqimizda', title: 'Haqqımızda', group: 'about', order: 1,
    excerpt: 'Azərbaycan Dəmir Yolları QSC haqqında məlumat.',
    content: `<h2>Haqqımızda</h2>
<p>Azərbaycan Dəmir Yolları QSC ölkənin əsas dəmir yolu daşıyıcısıdır. Şirkət sərnişin daşımalarını ölkə daxilində və beynəlxalq istiqamətlərdə həyata keçirir.</p>
<h3>Əsas göstəricilər</h3>
<ul>
<li>Abşeron dairəvi xətti üzrə günün bütün saatlarında reyslər</li>
<li>Ölkədaxili sürətli qatarlar — Gəncə, Qazax, Şəki, Qəbələ, Lənkəran</li>
<li>Beynəlxalq istiqamətlər — Tbilisi, Batumi</li>
</ul>
<p>Elektron bilet xidməti ilə bilet almaq, yer seçmək və ödəniş etmək tam onlayn həyata keçirilir.</p>`
  },
  {
    slug: 'istifade-sertleri', title: 'İstifadə şərtləri', group: 'about', order: 2,
    excerpt: 'Portalın istifadə şərtləri.',
    content: `<h2>İstifadə şərtləri</h2>
<p>Portalda qeydiyyatdan keçərkən daxil edilən məlumatların doğruluğuna görə istifadəçi məsuliyyət daşıyır.</p>
<ul>
<li>Sərnişin bilet üzərində göstərilən sənədlə qatara minməlidir.</li>
<li>Bir istifadəçi hesabı bir şəxsə məxsusdur.</li>
<li>Ödəniş zamanı daxil edilən kart məlumatları yalnız ödənişin aparılması üçün işlənir.</li>
</ul>`
  }
];

/* ==================== Xəbərlər ==================== */
const NEWS = [
  {
    slug: 'kassa-emeliyyatlari-dayandirilir',
    title: 'Kassa əməliyyatları tədricən dayandırılır',
    excerpt: 'Bu gündən etibarən kassa əməliyyatları tədricən dayandırılır. Bakı və Gəncə vağzalının kassaları istisna olmaqla.',
    publishedAt: new Date('2026-07-15'),
    sourceUrl: 'https://ticket.ady.az/az'
  },
  {
    slug: 'baki-qazax-suratli-qatar',
    title: 'Bakı — Qazax sürətli qatar xidmətinə başlayır',
    excerpt: 'Yeni sürətli qatar Bakıdan Qazaxa gündəlik reyslərlə hərəkət edəcək.',
    publishedAt: new Date('2026-05-20'),
    sourceUrl: 'https://ticket.ady.az/az/hereket-cedveli'
  },
  {
    slug: 'abseron-xetti-yenilenir',
    title: 'Abşeron dairəvi xəttində vaqonlar yenilənir',
    excerpt: 'Xətt üzrə yeni vaqonlar istifadəyə verilir və reyslərin sayı artırılır.',
    publishedAt: new Date('2026-04-08'),
    sourceUrl: 'https://ticket.ady.az/az/hereket-cedveli'
  },
  {
    slug: 'tbisi-reysi-berpa-olunur',
    title: 'Bakı — Tbilisi reysi bərpa olunur',
    excerpt: 'Beynəlxalq reys həftənin müəyyən günlərində hərəkət edəcək.',
    publishedAt: new Date('2026-03-12'),
    sourceUrl: 'https://ticket.ady.az/az/populyar-istiqametler'
  },
  {
    slug: 'elektron-bilet-yenilik',
    title: 'Elektron bilet xidmətində yenilik',
    excerpt: 'Biletlər artıq QR kod formasında şəxsi kabinetdə yüklənə bilər.',
    publishedAt: new Date('2026-02-02'),
    sourceUrl: 'https://ticket.ady.az/az/tarifler-ve-odenis'
  },
  {
    slug: 'usaqlarla-seyahet-qaydalari',
    title: 'Uşaqlarla səyahət qaydalarına dair məlumat',
    excerpt: 'Uşaqların qatarla daşınması üçün yenilənmiş qaydalar açıqlanıb.',
    publishedAt: new Date('2026-01-18'),
    sourceUrl: 'https://ticket.ady.az/az/dasima-qaydalari/usaqlarla-seyahet'
  }
];

/* ==================== Populyar istiqamətlər ==================== */
const DESTINATIONS = [
  {
    slug: 'gence', title: 'Gəncə', stationCode: 'GNC', priceFrom: 9.6, order: 1,
    summary: 'Azərbaycanın ikinci böyük şəhəri — sürətli qatarlarla rahat gediş.',
    image: 'https://ticket.ady.az/resized/resize0x213/center/pages/3165/xeyyam.png',
    content: '<p>Gəncəyə sürətli qatarlar gündəlik reyslərlə hərəkət edir. Şəhər dəmir yolu vağzalı mərkəzə yaxın məsafədə yerləşir.</p>'
  },
  {
    slug: 'sumqayit', title: 'Sumqayıt', stationCode: 'SUM', priceFrom: 1.2, order: 2,
    summary: 'Abşeron dairəvi xətti ilə günün bütün saatlarında reyslər.',
    image: 'https://ticket.ady.az/resized/resize0x213/center/pages/3063/fiziki-kart.png',
    content: '<p>Sumqayıta Bakıdan elektrik qatarları ilə gediş təxminən 30 dəqiqə çəkir.</p>'
  },
  {
    slug: 'qebele', title: 'Qəbələ', stationCode: 'QBA', priceFrom: 14, order: 3,
    summary: 'Dağ mənzərəli istirahət mərkəzləri və təbiət.',
    image: 'https://ticket.ady.az/resized/resize0x213/center/pages/557/frame-980-1.png',
    content: '<p>Qəbələyə həftənin müəyyən günlərində sürətli qatarlar hərəkət edir.</p>'
  },
  {
    slug: 'lan keran', title: 'Lənkəran', stationCode: 'LNK', priceFrom: 8.9, order: 4,
    summary: 'Cənub istiqamətində sürətli qatar reysləri.',
    image: 'https://ticket.ady.az/resized/resize0x213/center/pages/558/canta-sayt-illustrasiya.png',
    content: '<p>Lənkərana sürətli qatarlar gündəlik olaraq hərəkət edir.</p>'
  },
  {
    slug: 'seki', title: 'Şəki', stationCode: 'SHE', priceFrom: 11.4, order: 5,
    summary: 'Tarixi memarlıq abidələri ilə məşhur istiqamət.',
    image: 'https://ticket.ady.az/resized/resize0x213/center/pages/559/group-5711-1.png',
    content: '<p>Şəkiyə sürətli qatarlar həftədə üç gün hərəkət edir.</p>'
  },
  {
    slug: 'tbilisi', title: 'Tbilisi', stationCode: 'TBN', priceFrom: 81, order: 6,
    summary: 'Beynəlxalq istiqamət — kupe və biznes vaqonları.',
    image: 'https://ticket.ady.az/resized/resize1920/center/pages/4/veb-sayt-banner-2.jpg',
    content: '<p>Bakı — Tbilisi beynəlxalq qatarı həftənin dörd günü hərəkət edir.</p>'
  }
];

/* ==================== Suallar ==================== */
const FAQS = [
  { question: 'Bileti nə vaxt almaq olar?', answer: 'Bilet satışı qatarın yola düşməsindən on gün əvvəl açılır və yola düşmədən üç saat əvvəl bağlanır.', order: 1 },
  { question: 'Bir sifarişdə neçə bilet alına bilər?', answer: 'Bir sifarişdə maksimum dörd bilet almaq mümkündür. Daha çox bilet üçün ayrıca sifariş yaratmaq lazımdır.', order: 2 },
  { question: 'Bilet necə əldə edilir?', answer: 'Ödəniş təsdiqləndikdən sonra bilet şəxsi kabinetə düşür. Onu PDF formatında yükləmək və ya telefonda QR kod kimi təqdim etmək olar.', order: 3 },
  { question: 'Ödəniş hansı üsullarla aparılır?', answer: 'Bank kartı və ya şəxsi balans hesabı ilə ödəniş mümkündür. Ödəniş 3-D Secure doğrulaması ilə tamamlanır.', order: 4 },
  { question: 'Bileti qaytarmaq olar?', answer: 'Bəli. Satış bağlanana qədər bileti qaytarmaq mümkündür. Qaytarma zamanı xidmət haqqı tutulur və məbləğ balansa əlavə olunur.', order: 5 },
  { question: 'Uşaq üçün bilet lazımdır?', answer: 'Altı yaşadək uşaqlar bilet almadan daşına bilər. Altı yaşdan on dörd yaşadək uşaqlar üçün gediş haqqının yarısı ödənilir.', order: 6 }
];

/* ==================== İcra ==================== */
async function seedStations() {
  const ops = STATIONS.map((s) => ({
    updateOne: {
      filter: { code: s.code },
      update: { $set: { ...s, active: true, source: 'reference' } },
      upsert: true
    }
  }));
  const r = await Station.bulkWrite(ops);
  return r.upsertedCount + r.modifiedCount;
}

async function seedTrains() {
  const adminOwned = new Set((await Train.find({ source: 'admin' }).select('number').lean()).map((t) => t.number));
  const trains = buildTrains().filter((t) => !adminOwned.has(t.number));
  const ops = trains.map((t) => ({
    updateOne: {
      filter: { number: t.number },
      update: {
        $set: {
          ...t,
          active: true,
          source: 'reference',
          sourceUrl: config.liveSourceUrl + '/az/hereket-cedveli',
          lastSyncedAt: new Date()
        }
      },
      upsert: true
    }
  }));
  const r = await Train.bulkWrite(ops);
  return r.upsertedCount + r.modifiedCount;
}

async function seedContent() {
  let count = 0;

  for (const p of PAGES) {
    await Page.updateOne({ slug: p.slug }, { $set: { ...p, active: true } }, { upsert: true });
    count += 1;
  }

  for (const n of NEWS) {
    await News.updateOne(
      { slug: n.slug },
      {
        $set: {
          ...n,
          active: true,
          content: n.content || ('<p>' + n.excerpt + '</p>'),
          image: n.image || ''
        }
      },
      { upsert: true }
    );
    count += 1;
  }

  for (const d of DESTINATIONS) {
    await Destination.updateOne({ slug: d.slug }, { $set: { ...d, active: true } }, { upsert: true });
    count += 1;
  }

  if ((await Faq.countDocuments()) === 0) {
    await Faq.insertMany(FAQS.map((f) => ({ ...f, active: true })));
    count += FAQS.length;
  }

  await Setting.updateOne(
    { key: 'site' },
    {
      $set: {
        value: {
          name: config.site.name,
          fullName: config.site.fullName,
          supportPhone: config.site.supportPhone,
          supportEmail: config.site.supportEmail,
          address: config.site.address,
          currency: config.site.currency
        }
      }
    },
    { upsert: true }
  );

  return count;
}

/* ==================== İdarəçi hesabı ==================== */
async function seedAdmin() {
  const email = config.adminEmail;
  const password = config.adminPassword;

  if (!email || !password) {
    return { created: false, reason: 'environment' };
  }

  const hashed = await bcrypt.hash(password, 10);
  let user = await User.findOne({ email }).select('+password');

  if (user) {
    user.password = hashed;
    user.role = 'admin';
    user.managedFromEnv = true;
    user.firstName = user.firstName || config.adminFirstName;
    user.lastName = user.lastName || config.adminLastName;
    await user.save();
    return { created: true, updated: true, email };
  }

  user = await User.create({
    firstName: config.adminFirstName,
    lastName: config.adminLastName,
    email,
    phone: config.adminPhones[0] || '',
    password: hashed,
    role: 'admin',
    managedFromEnv: true,
    locale: config.defaultLocale
  });

  return { created: true, updated: false, email };
}

/* Telefon nömrəsi ilə giriş üçün mövcud hesabı idarəçiyə çevirir */
async function promoteByPhone() {
  if (!config.adminPhones.length) return 0;
  const r = await User.updateMany(
    { phone: { $in: config.adminPhones }, role: { $ne: 'admin' } },
    { $set: { role: 'admin', managedFromEnv: true } }
  );
  return r.modifiedCount || 0;
}

async function seedAll(options) {
  const force = !!(options && options.force);
  const result = {};

  result.stations = await seedStations();
  result.trains = await seedTrains();

  if (force) {
    await Promise.all([
      Page.deleteMany({}),
      News.deleteMany({}),
      Destination.deleteMany({}),
      Faq.deleteMany({}),
      Trip.deleteMany({})
    ]);
  }

  result.content = await seedContent();
  result.admin = await seedAdmin();
  result.promoted = await promoteByPhone();

  return result;
}

async function main() {
  const force = process.argv.indexOf('--force') > -1;
  await connectDatabase();
  const result = await seedAll({ force });
  console.log('[seed] tamamlandı', JSON.stringify(result, null, 2));
  if (!result.admin.created) {
    console.log('[seed] İdarəçi hesabı yaradılmadı: ADMIN_EMAIL və ADMIN_PASSWORD mühit dəyişənləri təyin edilməlidir.');
  }
  await mongoose.connection.close();
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[seed] xəta:', e);
    process.exit(1);
  });
}

module.exports = { seedAll, PAGES, NEWS, DESTINATIONS, FAQS };
