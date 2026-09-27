/**
 * Seed skripti — MongoDB-yə real saytdakı cədvəl və məzmunu yazır.
 * İstifadə:
 *   npm run seed          -> yoxdursa yaradır
 *   npm run seed:force    -> mövcud kolleksiyaları təmizləyib yenidən yaradır
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const Station = require('../models/Station');
const Train = require('../models/Train');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { News, Page, Destination, Faq, Setting, PromoCode } = require('../models/Content');
const { ensureTripsForDate } = require('../services/scheduleService');
const dayjs = require('dayjs');

/* ==================== STANSİYALAR ==================== */
const STATIONS = [
  { code: 'BAK', name: 'Bakı', nameEn: 'Baku', nameRu: 'Баку', region: 'Bakı', order: 1, isHub: true },
  { code: 'BIL', name: 'Biləcəri', nameEn: 'Bilajari', nameRu: 'Биляджары', region: 'Bakı', order: 2 },
  { code: 'XRD', name: 'Xırdalan', nameEn: 'Khirdalan', nameRu: 'Хырдалан', region: 'Abşeron', order: 3 },
  { code: 'SUM', name: 'Sumqayıt', nameEn: 'Sumgayit', nameRu: 'Сумгаит', region: 'Abşeron', order: 4 },
  { code: 'UCA', name: 'Ucar', nameEn: 'Ucar', nameRu: 'Уджар', region: 'Ucar', order: 5 },
  { code: 'LKI', name: 'Ləki', nameEn: 'Laki', nameRu: 'Ляки', region: 'Ağdaş', order: 6 },
  { code: 'YEV', name: 'Yevlax', nameEn: 'Yevlakh', nameRu: 'Евлах', region: 'Yevlax', order: 7 },
  { code: 'GOR', name: 'Goran', nameEn: 'Goran', nameRu: 'Горан', region: 'Goranboy', order: 8 },
  { code: 'GAN', name: 'Gəncə', nameEn: 'Ganja', nameRu: 'Гянджа', region: 'Gəncə', order: 9, isHub: true },
  { code: 'DEL', name: 'Dəllər', nameEn: 'Deller', nameRu: 'Делляр', region: 'Şəmkir', order: 10 },
  { code: 'GOV', name: 'Gövlar', nameEn: 'Govlar', nameRu: 'Говлар', region: 'Tovuz', order: 11 },
  { code: 'TOV', name: 'Tovuz', nameEn: 'Tovuz', nameRu: 'Тауз', region: 'Tovuz', order: 12 },
  { code: 'AGS', name: 'Ağstafa', nameEn: 'Aghstafa', nameRu: 'Агстафа', region: 'Ağstafa', order: 13 },
  { code: 'GAZ', name: 'Qazax', nameEn: 'Gazakh', nameRu: 'Газах', region: 'Qazax', order: 14 },
  { code: 'AJC', name: 'Astara', nameEn: 'Astara', nameRu: 'Астара', region: 'Astara', order: 20 },
  { code: 'LNK', name: 'Lənkəran', nameEn: 'Lankaran', nameRu: 'Ленкорань', region: 'Lənkəran', order: 21 },
  { code: 'SAL', name: 'Salyan', nameEn: 'Salyan', nameRu: 'Сальяны', region: 'Salyan', order: 22 },
  { code: 'SBN', name: 'Sabirabad', nameEn: 'Sabirabad', nameRu: 'Сабирабад', region: 'Sabirabad', order: 23 },
  { code: 'QGX', name: 'Qəbələ', nameEn: 'Gabala', nameRu: 'Габала', region: 'Qəbələ', order: 24 },
  { code: 'SIZ', name: 'Siyəzən', nameEn: 'Siyazan', nameRu: 'Сиазань', region: 'Siyəzən', order: 25 },
  { code: 'XAC', name: 'Xaçmaz', nameEn: 'Khachmaz', nameRu: 'Хачмаз', region: 'Xaçmaz', order: 26 },
  { code: 'QBA', name: 'Quba', nameEn: 'Guba', nameRu: 'Куба', region: 'Quba', order: 27 }
];

/* ==================== ABŞERON XƏTTİ QATARLARI (real cədvəl) ==================== */
const ABSHERON_TRAINS = [
  { number: '6001', bak: '06:20', bil: '06:34', xrd: '06:41', sum: null },
  { number: '6003', bak: '07:05', bil: '07:19', xrd: '07:27', sum: '07:45' },
  { number: '6005', bak: '07:20', bil: '07:34', xrd: '07:42', sum: '08:00' },
  { number: '6007', bak: '07:30', bil: '07:44', xrd: '07:51', sum: null },
  { number: '6009', bak: '07:45', bil: '07:59', xrd: '08:06', sum: null },
  { number: '6011', bak: '08:10', bil: '08:24', xrd: '08:31', sum: null },
  { number: '6013', bak: '08:30', bil: '08:44', xrd: '08:52', sum: '09:10' },
  { number: '6015', bak: '16:40', bil: '16:54', xrd: '17:01', sum: null },
  { number: '6017', bak: '17:00', bil: '17:14', xrd: '17:22', sum: '17:40' },
  { number: '6019', bak: '17:25', bil: '17:39', xrd: '17:47', sum: '18:05' },
  { number: '6021', bak: '17:47', bil: '18:01', xrd: '18:08', sum: null },
  { number: '6059', bak: '18:10', bil: '18:28', xrd: '18:39', sum: '18:58' },
  { number: '6023', bak: '18:25', bil: '18:39', xrd: '18:47', sum: '19:05' },
  { number: '6025', bak: '18:35', bil: '18:49', xrd: '18:57', sum: '19:15' },
  { number: '6027', bak: '18:45', bil: '18:59', xrd: '19:07', sum: '19:25' },
  { number: '6029', bak: '18:55', bil: '19:09', xrd: '19:16', sum: null },
  { number: '6061', bak: '19:15', bil: '19:33', xrd: '19:44', sum: '20:03' },
  { number: '6031', bak: '19:40', bil: '19:54', xrd: '20:02', sum: '20:20' },
  { number: '6033', bak: '20:20', bil: '20:34', xrd: '20:42', sum: '21:00' }
];

/* ==================== ÖLKƏDAXİLİ QATARLAR (real cədvəl) ==================== */
const DOMESTIC_TRAINS = [
  {
    number: '732',
    title: 'Bakı — Qazax sürətli qatarı',
    times: { BAK: '08:00', BIL: '08:16', UCA: '10:42', LKI: '10:56', YEV: '11:12', GOR: '11:29', GAN: '11:59', DEL: '12:23', GOV: '12:43', TOV: '12:58', AGS: '13:19', GAZ: '13:36' }
  },
  {
    number: '72',
    title: 'Bakı — Qazax qatarı',
    times: { BAK: '09:15', BIL: '09:34', UCA: '12:42', LKI: '12:56', YEV: '13:19', GOR: '13:41', GAN: '14:21', DEL: '14:49', GOV: '15:14', TOV: '15:32', AGS: '15:53', GAZ: '16:10' }
  },
  {
    number: '734',
    title: 'Bakı — Qazax axşam qatarı',
    times: { BAK: '18:00', BIL: '18:16', UCA: '20:42', LKI: '20:56', YEV: '21:12', GOR: '21:29', GAN: '21:59', DEL: '22:23', GOV: '22:43', TOV: '22:58', AGS: '23:19', GAZ: '23:36' }
  },
  {
    number: '702',
    title: 'Bakı — Gəncə sürətli qatarı',
    times: { BAK: '07:30', BIL: '07:46', UCA: '10:12', LKI: '10:26', YEV: '10:42', GOR: '10:59', GAN: '11:29' }
  },
  {
    number: '704',
    title: 'Bakı — Gəncə axşam qatarı',
    times: { BAK: '17:30', BIL: '17:46', UCA: '20:12', LKI: '20:26', YEV: '20:42', GOR: '20:59', GAN: '21:29' }
  }
];

/* ==================== SINIF TARİFLƏRİ ==================== */
const ABSHERON_CLASSES = [
  { code: 'seat', title: 'Oturma yeri', titleEn: 'Seating', titleRu: 'Сидячий', basePrice: 0.4, rows: 14, seatsPerRow: 4, wagons: 2, layout: 'sitting' }
];

const DOMESTIC_CLASSES = [
  { code: 'seat', title: 'Oturma (ekonom)', titleEn: 'Seating (economy)', titleRu: 'Сидячий (эконом)', basePrice: 2.05, rows: 14, seatsPerRow: 4, wagons: 2, layout: 'sitting' },
  { code: 'coupe', title: 'Kupe', titleEn: 'Coupe', titleRu: 'Купе', basePrice: 3.4, rows: 9, seatsPerRow: 4, wagons: 2, layout: 'coupe' },
  { code: 'lux', title: 'Lüks (SV)', titleEn: 'Lux (SV)', titleRu: 'Люкс (СВ)', basePrice: 5.2, rows: 4, seatsPerRow: 3, wagons: 1, layout: 'lux' }
];

/* ==================== MƏZMUN ==================== */
const PAGES = [
  {
    slug: 'gedis-haqqinin-qaytarilmasi',
    category: 'tariffs',
    order: 1,
    title: 'Gediş haqqının qaytarılması',
    excerpt: 'Biletin qaytarılması qaydaları və tutulan xidmət haqqı.',
    content: `<p>Bilet alındıqdan sonrakı <strong>15 dəqiqə</strong> ərzində geri qaytarılarsa, xidmət haqqı tutulmur. 15 dəqiqədən sonra qaytarıldıqda isə <strong>20 AZN</strong> xidmət haqqı tutulur.</p>
<h3>Qaytarma necə aparılır?</h3>
<ol>
<li>Şəxsi kabinetə daxil olun: <a href="/az/kabinet/biletler">Mənim biletlərim</a>.</li>
<li>Qaytarmaq istədiyiniz biletin yanındakı <strong>"Qaytar"</strong> düyməsini basın.</li>
<li>Tutulan xidmət haqqı ekranda göstərilir — təsdiqləyin.</li>
<li>Məbləğ kartınıza 3–10 iş günü ərzində qaytarılır.</li>
</ol>
<h3>Diqqət</h3>
<ul>
<li>Yola düşməyə 5 dəqiqə qalmış biletin qaytarılması mümkün deyil.</li>
<li>Artıq istifadə olunmuş bilet qaytarılmır.</li>
<li>Qaytarılan bilet üzrə yer dərhal satışa çıxarılır.</li>
</ul>`
  },
  {
    slug: 'odenis-usullari',
    category: 'tariffs',
    order: 2,
    title: 'Ödəniş üsulları',
    excerpt: 'Bank kartı, balans və digər ödəniş üsulları.',
    content: `<h3>Qəbul olunan ödəniş üsulları</h3>
<table>
<tr><th>Üsul</th><th>Təsvir</th></tr>
<tr><td>Bank kartı</td><td>Visa, Mastercard, MilliKart — 3D Secure təsdiqi ilə</td></tr>
<tr><td>Balans</td><td>Şəxsi kabinetdəki ön ödəniş balansından çıxılır</td></tr>
<tr><td>Ödəniş terminalı</td><td>Vağzal kassalarında nağd və ya kartla</td></tr>
</table>
<p>Bütün onlayn ödənişlər şifrələnmiş kanal (TLS) üzərindən aparılır. Kart məlumatlarınız sistemdə saxlanılmır — yalnız son 4 rəqəm qeyd olunur.</p>
<h3>Balansın artırılması</h3>
<p>"Balans artırılması" bölməsində istənilən məbləği (1–1000 AZN) kartla artıra bilərsiniz.</p>`
  },
  {
    slug: 'elektron-bilet',
    category: 'tariffs',
    order: 3,
    title: 'Elektron bilet satışına dair qaydalar',
    excerpt: 'Elektron gediş sənədlərinin satışı, qaytarılması və istifadəsi.',
    content: `<p>Elektron gediş sənədlərinin (biletlərin) satışı, qaytarılması və elektron bilet ilə gediş zamanı yolda dayanacaq edilməsi aşağıdakı qaydalarla tənzimlənir.</p>
<h3>1. Ümumi müddəalar</h3>
<p>Elektron bilet — sərnişinin adına, sənəd nömrəsinə və seçilmiş yerə bağlı unikal PNR koduna malik gediş sənədidir.</p>
<h3>2. Satış qaydaları</h3>
<ul>
<li>Satış yola düşmədən <strong>10 gün</strong> əvvəl açılır.</li>
<li>Satış yola düşmədən <strong>3 saat</strong> əvvəl bağlanır.</li>
<li>Bir sifarişdə maksimum <strong>4 bilet</strong> almaq olar.</li>
<li>Hər sərnişin üçün ad, soyad və sənəd nömrəsi mütləqdir.</li>
</ul>
<h3>3. Gediş</h3>
<p>Stansiyaya yola düşmədən 20 dəqiqə əvvəl gəlmək tövsiyə olunur. Bilet QR kodu oxuyucuya təqdim edilir.</p>
<h3>4. Qaytarılma</h3>
<p>15 dəqiqə ərzində xidmət haqqı tutulmadan, sonra isə 20 AZN xidmət haqqı ilə qaytarılır.</p>`
  },
  {
    slug: 'gedis-haqqi-tarifleri',
    category: 'tariffs',
    order: 4,
    title: 'Gediş haqqı tarifləri',
    excerpt: 'Abşeron xətti və ölkədaxili reyslər üzrə tariflər.',
    content: `<h3>Abşeron dairəvi xətti</h3>
<p>Vahid zona tarifi tətbiq olunur. Bakı → Sumqayıt istiqaməti üzrə qiymət dayanacaq sayına görə hesablanır.</p>
<table>
<tr><th>Marşrut</th><th>Oturma yeri</th></tr>
<tr><td>Bakı → Biləcəri</td><td>0.40 AZN</td></tr>
<tr><td>Bakı → Xırdalan</td><td>0.80 AZN</td></tr>
<tr><td>Bakı → Sumqayıt</td><td>1.20 AZN</td></tr>
</table>
<h3>Ölkədaxili reyslər</h3>
<p>Qiymət məsafə (stansiya sayı) və vaqon sinfinə görə hesablanır. Nümunə: Bakı → Gəncə oturma yeri 12.30 AZN-dən başlayır.</p>`
  },
  {
    slug: 'usaqlarla-seyahet',
    category: 'rules',
    order: 1,
    title: 'Uşaqlarla səyahət',
    excerpt: 'Uşaqların qatarla səyahət etməsi üçün qaydalar.',
    content: `<h3>Uşaq bileti</h3>
<ul>
<li><strong>0–5 yaş</strong>: bilet tələb olunmur (valideynin qucağında).</li>
<li><strong>6–10 yaş</strong>: uşaq bileti — gediş haqqının 50%-i.</li>
<li><strong>11 yaşdan yuxarı</strong>: tam qiymətli bilet.</li>
</ul>
<h3>Sənədlər</h3>
<p>Uşaq üçün doğum şəhadətnaməsi və ya şəxsiyyət vəsiqəsi təqdim olunmalıdır. 16 yaşadək uşaq yalnız böyük şəxsin müşayiəti ilə səyahət edə bilər.</p>
<h3>Tövsiyələr</h3>
<ul>
<li>Səfər üçün uşağın sevimli yeməklərini və içkisini götürün.</li>
<li>Uzun səfərlərdə uşağı tez-tez hərəkət etdirin.</li>
<li>Sanitariya qovşaqları hər vaqonda mövcuddur.</li>
</ul>`
  },
  {
    slug: 'el-yuklerinin-dasinmasi',
    category: 'rules',
    order: 2,
    title: 'Əl yüklərinin daşınması',
    excerpt: 'Qatarda əl yüklərinin daşınması qaydaları.',
    content: `<h3>Ümumi qaydalar</h3>
<ul>
<li>Ölçüsü 180 sm-ə qədər əl yükü — pulsuz.</li>
<li>Bir sərnişin üçün maksimum <strong>36 kq</strong> yük.</li>
<li>Ölçüsü 180–300 sm yük üçün əlavə haqq tutulur.</li>
</ul>
<h3>Qadağan olunan əşyalar</h3>
<ul>
<li>Partlayıcı, tez alışan və zəhərli maddələr</li>
<li>İyli və asan xarab olan məhsullar (açıq formada)</li>
<li>Odlu silah qanunvericiliklə müəyyən olunmuş qaydada istisna təşkil edir</li>
</ul>`
  },
  {
    slug: 'heyvanlarin-dasinmasi',
    category: 'rules',
    order: 3,
    title: 'Heyvanların daşınması',
    excerpt: 'Sərnişin qatarında heyvanların daşınmasına dair qaydalar.',
    content: `<h3>Xırda ev heyvanları</h3>
<ul>
<li>Xüsusi konteynerdə (ölçüsü 60×40×30 sm-ə qədər) pulsuz daşınır.</li>
<li>Heyvanın baytar pasportu və peyvənd şəhadətnaməsi olmalıdır.</li>
</ul>
<h3>İri itlər</h3>
<ul>
<li>Muzzalı və qısa qayışlı olmaqla, ayrıca vaqonun keçid hissəsində daşınır.</li>
<li>Yol haqqı — tam tarif.</li>
</ul>
<h3>Qaydalar</h3>
<ul>
<li>Heyvan qatarın digər sərnişinlərinə narahatlıq yaratmamalıdır.</li>
<li>Bələdçi itləri (sənədi olduqda) pulsuz daşınır.</li>
<li>Respublika əhəmiyyətli qatarlarda heyvan daşınması məhdudlaşdırıla bilər.</li>
</ul>`
  },
  {
    slug: 'haqqimizda',
    category: 'info',
    order: 1,
    title: 'Haqqımızda',
    excerpt: 'Azərbaycan Dəmir Yolları QSC haqqında məlumat.',
    content: `<p><strong>"Azərbaycan Dəmir Yolları" Qapalı Səhmdar Cəmiyyəti (ADY)</strong> ölkənin dəmir yolu nəqliyyatını idarə edən dövlət şirkətidir.</p>
<h3>Fəaliyyət istiqamətləri</h3>
<ul>
<li>Sərnişin daşınması (Abşeron xətti, ölkədaxili və beynəlxalq reyslər)</li>
<li>Yük daşınması və logistika</li>
<li>Dəmir yolu infrastrukturunun istismarı və inkişafı</li>
</ul>
<h3>Rəqəmsallaşma</h3>
<p>Xidmətlərin rəqəmsallaşması ilə əlaqədar kassaların fəaliyyəti mərhələli şəkildə dayandırılır. Bakı və Gəncə Dəmiryol vağzallarının kassaları fəaliyyətini davam etdirir.</p>
<h3>Əlaqə</h3>
<p>Bakı, Dilarə Əliyeva küç. 230 · +994 12 499 45 45 · info@ady.az</p>`
  },
  {
    slug: 'istifade-sertleri',
    category: 'legal',
    order: 1,
    title: 'İstifadə şərtləri',
    excerpt: 'Saytdan istifadə şərtləri və məxfilik siyasəti.',
    content: `<h3>1. Ümumi şərtlər</h3>
<p>Bu veb-saytdan istifadə etməklə siz aşağıdakı şərtləri qəbul etmiş olursunuz.</p>
<h3>2. İstifadəçi hesabı</h3>
<p>Hesab məlumatlarının təhlükəsizliyi istifadəçinin məsuliyyətindədir. Şübhəli giriş halında dərhal dəstək xidmətinə müraciət edin.</p>
<h3>3. Şəxsi məlumatların qorunması</h3>
<p>Şəxsi məlumatlar yalnız bilet satışı və müştəri xidmətləri məqsədi ilə emal olunur; üçüncü şəxslərə ötürülmür (qanunvericilikdə nəzərdə tutulmuş hallar istisna olmaqla).</p>
<h3>4. Məsuliyyət</h3>
<p>Qüvvədən düşmüş biletlərlə və ya səhv sənəd məlumatları ilə gediş cəhdlərinə görə məsuliyyət istifadəçinin üzərinə düşür.</p>
<h3>5. Dəyişikliklər</h3>
<p>ADY bu şərtləri əvvəlcədən xəbərdarlıq etmədən dəyişdirmək hüququnu saxlayır.</p>`
  }
];

const NEWS = [
  {
    slug: 'baki-qazax-surətli-qatar-xidmeti',
    title: 'ADY Bakı–Qazax istiqamətində sürətli qatar xidmətinə başlayır',
    excerpt: 'Yeni sürətli qatar xidməti Gəncə, Tovuz və Ağstafa üzərindən Qazaxa qədər uzanır.',
    image: 'https://sspark.genspark.ai/i/9WQBZ1jlc3WyhwJK?width=1280',
    sourceUrl: 'https://corp.ady.az/en/2/news/news/ady-launches-pioneering-high-speed-passenger-train-service-on-baku-gazakh-baku-route',
    content: `<p>ADY Bakı–Qazax–Bakı istiqamətində sürətli sərnişin qatarı xidmətini istifadəyə verib. Yeni xidmət Gəncə, Dəllər, Gövlar, Tovuz və Ağstafa stansiyaları üzərindən hərəkət edir.</p>
<p>Qatarlar 732, 72 və 734 nömrələri ilə hər gün hərəkət edir. Bakıdan yola düşmə saatları 08:00, 09:15 və 18:00-dır.</p>`
  },
  {
    slug: 'agstafa-istiqameti-qazaxa-uzadildi',
    title: 'Ağstafa istiqaməti 15 iyundan Qazaxa qədər uzadılıb',
    excerpt: 'Biletlər artıq satışdadır.',
    image: 'https://sspark.genspark.ai/i/9WQBZ1jlc3WyhwJK?width=1280',
    content: `<p>Ağstafa istiqaməti 15 iyundan etibarən Qazax stansiyasına qədər uzadılıb. Sərnişinlər artıq Bakı–Qazax marşrutu üzrə bilet əldə edə bilərlər.</p>`
  },
  {
    slug: 'kassalarin-feqaliyyeti-dayandirilir',
    title: 'Xidmətlərin rəqəmsallaşması: kassaların fəaliyyəti dayandırılır',
    excerpt: 'Bakı və Gəncə Dəmiryol vağzallarının kassaları fəaliyyətini davam etdirəcək.',
    image: 'https://sspark.genspark.ai/i/AXkodnjTKJ65QOLN?width=1280',
    content: `<p>Xidmətlərin rəqəmsallaşması ilə əlaqədar kassaların fəaliyyəti 15 iyuldan mərhələli şəkildə dayandırılır. Bakı və Gəncə Dəmiryol vağzallarının kassaları fəaliyyətini davam etdirəcək. Xoş səfərlər diləyirik!</p>`
  },
  {
    slug: 'ady-transport-logistic-munich',
    title: 'ADY "Transport Logistic Munich" sərgisində iştirak edib',
    excerpt: 'Sənaye liderləri ilə əsas görüşlər keçirilib.',
    image: 'https://sspark.genspark.ai/i/9WQBZ1jlc3WyhwJK?width=1280',
    content: `<p>ADY nümayəndə heyəti Münhendə keçirilən "Transport Logistic" beynəlxalq sərgisində iştirak edərək sənaye liderləri ilə görüşlər keçirib.</p>`
  },
  {
    slug: 'behreynle-emekdasliq',
    title: 'ADY Bəhreyn nəqliyyat qurumları ilə əməkdaşlıq perspektivlərini müzakirə edib',
    excerpt: 'Regional tranzit imkanları müzakirə olunub.',
    image: 'https://sspark.genspark.ai/i/AXkodnjTKJ65QOLN?width=1280',
    content: `<p>ADY və Bəhreyn Krallığının nəqliyyat-logistika qurumları arasında əməkdaşlıq perspektivləri, o cümlədən tranzit yük daşınması imkanları müzakirə olunub.</p>`
  },
  {
    slug: 'abseron-xettinde-yeni-dayanacaq',
    title: 'Abşeron xəttində yeni dayanacaq istifadəyə verildi',
    excerpt: 'Yeni dayanacaq sərnişin axınını rahatlaşdıracaq.',
    image: 'https://sspark.genspark.ai/i/9WQBZ1jlc3WyhwJK?width=1280',
    content: `<p>Abşeron dairəvi dəmir yolu xəttində yeni dayanacaq məntəqəsi istifadəyə verilib. Bu, sərnişin axınının bərabər paylanmasına imkan verəcək.</p>`
  }
];

const DESTINATIONS = [
  {
    slug: 'gence',
    title: 'Gəncə',
    summary: 'Azərbaycanın ikinci böyük şəhəri — qədim tarix və müasir memarlıq.',
    image: 'https://sspark.genspark.ai/i/yYYWNCe632bZGQbn?width=1280',
    stationCode: 'GAN',
    priceFrom: 12.3,
    order: 1,
    content: `<p>Gəncə Azərbaycanın ikinci böyük şəhəridir və zəngin tarixə malikdir. Şəhər Nizami Gəncəvinin vətəni kimi tanınır.</p>
<h3>Görməli yerlər</h3>
<ul>
<li>Nizami Gəncəvi məqbərəsi</li>
<li>Şah Abbas məscidi</li>
<li>Gəncə Dövlət Filarmoniyası</li>
<li>Xan bağı və Gəncəbulax</li>
</ul>
<h3>Necə çatmaq olar?</h3>
<p>Bakıdan Gəncəyə sürətli qatarlar (702, 704, 732) hər gün hərəkət edir. Yolda vaxt təxminən 4 saatdır.</p>`
  },
  {
    slug: 'sumqayit',
    title: 'Sumqayıt',
    summary: 'Abşeron yarımadasının sənaye mərkəzi və Xəzər sahilində şəhər.',
    image: 'https://sspark.genspark.ai/i/Hx7b0G0M1v8MEvLq?width=1280',
    stationCode: 'SUM',
    priceFrom: 1.2,
    order: 2,
    content: `<p>Sumqayıt Xəzər dənizinin sahilində yerləşən böyük şəhərdir. Bakıdan cəmi 30 km məsafədə yerləşir.</p>
<h3>Görməli yerlər</h3>
<ul>
<li>Sumqayıt bulvarı və Xəzər çimərlikləri</li>
<li>Şəhidlər Xiyabanı</li>
<li>Gənclik parkı</li>
</ul>
<p>Abşeron xətti qatarları ilə Bakıdan Sumqayıta 20–40 dəqiqəyə çatmaq olar.</p>`
  },
  {
    slug: 'qazax',
    title: 'Qazax',
    summary: 'Qərb bölgəsinin yaşıl təbiətli rayonu.',
    image: 'https://sspark.genspark.ai/i/yYYWNCe632bZGQbn?width=1280',
    stationCode: 'GAZ',
    priceFrom: 22.55,
    order: 3,
    content: `<p>Qazax rayonu Azərbaycanın qərbində, Gürcüstan sərhədi yaxınlığında yerləşir. Bölgə yaşıl təbiəti və gözəl mənzərələri ilə məşhurdur.</p>
<h3>Necə çatmaq olar?</h3>
<p>Bakı–Qazax sürətli qatarı (732) ilə qatar 5.5 saatda Qazax stansiyasına çatır.</p>`
  },
  {
    slug: 'astara',
    title: 'Astara',
    summary: 'Cənub bölgəsinin Xəzər sahilindəki gözəl şəhəri.',
    stationCode: 'AJC',
    priceFrom: 18.4,
    order: 4,
    content: `<p>Astara Azərbaycanın cənubunda, İran sərhədində yerləşir. Şəhər subtropik iqlimi və Xəzər sahilləri ilə tanınır.</p>`
  },
  {
    slug: 'qebele',
    title: 'Qəbələ',
    summary: 'Şəhər-dəniz mənzərəsi və dağ turizmi mərkəzi.',
    stationCode: 'QGX',
    priceFrom: 14.5,
    order: 5,
    content: `<p>Qəbələ Böyük Qafqaz dağlarının ətəyində yerləşir. Qış turizm mərkəzləri və kanat yolu ilə məşhurdur.</p>`
  },
  {
    slug: 'quba',
    title: 'Quba',
    summary: 'Alma diyarı — dağ və təbiət turizmi.',
    stationCode: 'QBA',
    priceFrom: 11.2,
    order: 6,
    content: `<p>Quba Azərbaycanın şimalında yerləşir və almaları ilə məşhurdur. Quba–Qusar zonası dağ turizminin əsas mərkəzidir.</p>`
  }
];

const FAQS = [
  { question: 'Bileti nə qədər əvvəl ala bilərəm?', answer: 'Onlayn bilet satışı yola düşmədən 10 gün əvvəl açılır və yola düşmədən 3 saat əvvəl bağlanır.', order: 1 },
  { question: 'Bir sifarişdə neçə bilet ala bilərəm?', answer: 'Bir sifarişdə maksimum 4 bilet almaq mümkündür.', order: 2 },
  { question: 'Hansı ödəniş üsulları mövcuddur?', answer: 'Visa, Mastercard, MilliKart bank kartları və şəxsi kabinetdəki balans vasitəsilə ödəniş edə bilərsiniz.', order: 3 },
  { question: 'Bileti necə qaytara bilərəm?', answer: 'Şəxsi kabinetdəki "Mənim biletlərim" bölməsindən "Qaytar" düyməsini basaraq bileti qaytara bilərsiniz. 15 dəqiqə ərzində qaytarılarsa xidmət haqqı tutulmur.', order: 4 },
  { question: 'Uşaqlar üçün bilet lazımdır?', answer: '0–5 yaşlı uşaqlar üçün bilet tələb olunmur, 6–10 yaş arası uşaqlar üçün gediş haqqının 50%-i ödənilir.', order: 5 },
  { question: 'Elektron bileti çap etmək lazımdır?', answer: 'Xeyr. Bilet QR kod şəklində telefonunuzda saxlanıla bilər — stansiyada QR kod oxuyucuya təqdim edilir.', order: 6 },
  { question: 'Biletimi necə yoxlaya bilərəm?', answer: 'Saytın "Bilet yoxlanışı" bölməsində PNR kodunu daxil edərək biletin etibarlılığını yoxlaya bilərsiniz.', order: 7 },
  { question: 'Gediş üçün hansı sənədlər tələb olunur?', answer: 'Bilet alınarkən göstərilən sənədin əslini (FİN kod, şəxsiyyət vəsiqəsi və ya pasport) gediş zamanı təqdim etməlisiniz.', order: 8 },
  { question: 'Yola düşməyə nə qədər qalmış stansiyada olmalıyam?', answer: 'Stansiyaya yola düşmədən ən azı 20 dəqiqə əvvəl gəlməyiniz tövsiyə olunur.', order: 9 },
  { question: 'Balansı necə artıra bilərəm?', answer: 'Şəxsi kabinetdəki "Balans artırılması" bölməsindən 1–1000 AZN aralığında məbləği kartla artıra bilərsiniz.', order: 10 }
];

/* ==================== SEED MƏNTİQİ ==================== */
function stopList(times, keys) {
  const stops = [];
  let prev = '';
  keys.forEach((key) => {
    const t = times[key];
    if (!t) return;
    stops.push({ stationCode: key, arrive: prev ? t : t, depart: t, dayOffset: 0 });
    prev = t;
  });
  // İlk stansiyada arrive = depart, aralıq stansiyalarda arrive/depart eynidir (sadələşdirilmiş cədvəl)
  return stops.map((s, i) => ({
    stationCode: s.stationCode,
    arrive: i === 0 ? '' : s.arrive,
    depart: s.depart,
    dayOffset: 0
  }));
}

async function seedStations(force) {
  if (force) await Station.deleteMany({});
  let created = 0;
  for (const s of STATIONS) {
    const exists = await Station.findOne({ code: s.code });
    if (!exists) {
      await Station.create(s);
      created++;
    }
  }
  return created;
}

async function seedTrains(force) {
  if (force) await Train.deleteMany({});
  let created = 0;

  // Abşeron xətti
  for (const t of ABSHERON_TRAINS) {
    const exists = await Train.findOne({ number: t.number });
    if (exists) continue;
    const times = { BAK: t.bak, BIL: t.bil, XRD: t.xrd };
    if (t.sum) times.SUM = t.sum;
    const keys = Object.keys(times);
    await Train.create({
      number: t.number,
      title: `Bakı — ${t.sum ? 'Sumqayıt' : 'Xırdalan'} elektrik qatarı`,
      titleEn: `Baku — ${t.sum ? 'Sumgayit' : 'Khirdalan'} electric train`,
      type: 'suburban',
      line: 'absheron',
      daysType: 'daily',
      stops: stopList(times, keys),
      classes: ABSHERON_CLASSES,
      color: '#00539b'
    });
    created++;
  }

  // Ölkədaxili
  for (const t of DOMESTIC_TRAINS) {
    const exists = await Train.findOne({ number: t.number });
    if (exists) continue;
    const keys = Object.keys(t.times);
    await Train.create({
      number: t.number,
      title: t.title,
      titleEn: t.title,
      type: 'express',
      line: 'domestic',
      daysType: 'daily',
      stops: stopList(t.times, keys),
      classes: DOMESTIC_CLASSES,
      color: '#f2a900'
    });
    created++;
  }

  return created;
}

async function seedUsers(force) {
  if (force) await User.deleteMany({});
  const list = [
    {
      firstName: 'Demo',
      lastName: 'İstifadəçi',
      email: 'user@ady.az',
      phone: '+994501234567',
      password: 'user123',
      role: 'user',
      docType: 'fin',
      docNumber: '5XY8ABC',
      balance: 50
    },
    {
      firstName: 'Admin',
      lastName: 'ADY',
      email: 'admin@ady.az',
      phone: '+994129994545',
      password: 'admin123',
      role: 'admin',
      docType: 'fin',
      docNumber: 'ADMIN01',
      balance: 0
    },
    {
      firstName: 'Aysel',
      lastName: 'Məmmədova',
      email: 'aysel@example.com',
      phone: '+994551112233',
      password: 'aysel123',
      role: 'user',
      docType: 'id',
      docNumber: 'AZE1234567',
      balance: 120
    }
  ];
  let created = 0;
  for (const u of list) {
    const exists = await User.findOne({ email: u.email });
    if (exists) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    await User.create({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      passwordHash,
      role: u.role,
      docType: u.docType,
      docNumber: u.docNumber,
      balance: u.balance,
      isVerified: true
    });
    created++;
  }
  return created;
}

async function seedContent(force) {
  const counts = { pages: 0, news: 0, destinations: 0, faqs: 0, settings: 0, promos: 0 };

  if (force) {
    await Page.deleteMany({});
    await News.deleteMany({});
    await Destination.deleteMany({});
    await Faq.deleteMany({});
    await Setting.deleteMany({});
    await PromoCode.deleteMany({});
  }

  for (const p of PAGES) {
    const exists = await Page.findOne({ slug: p.slug });
    if (!exists) {
      await Page.create(p);
      counts.pages++;
    }
  }

  let i = 0;
  for (const n of NEWS) {
    const exists = await News.findOne({ slug: n.slug });
    if (!exists) {
      await News.create({
        ...n,
        publishedAt: dayjs().subtract(i * 3 + 1, 'day').toDate(),
        isActive: true
      });
      counts.news++;
    }
    i++;
  }

  for (const d of DESTINATIONS) {
    const exists = await Destination.findOne({ slug: d.slug });
    if (!exists) {
      await Destination.create({ ...d, isActive: true });
      counts.destinations++;
    }
  }

  for (const f of FAQS) {
    const exists = await Faq.findOne({ question: f.question });
    if (!exists) {
      await Faq.create({ ...f, isActive: true });
      counts.faqs++;
    }
  }

  const settings = [
    { key: 'site_notice', value: 'Xidmətlərin rəqəmsallaşması ilə əlaqədar, kassaların fəaliyyəti 15 iyuldan mərhələli şəkildə dayandırılır.', description: 'Saytda göstərilən elan' },
    { key: 'max_tickets_per_order', value: 4, description: 'Bir sifarişdə maksimal bilet sayı' },
    { key: 'refund_service_fee', value: 20, description: 'Qaytarma xidmət haqqı (AZN)' },
    { key: 'free_refund_minutes', value: 15, description: 'Xidmət haqqı tutulmadan qaytarma müddəti (dəq)' },
    { key: 'sales_open_days_before', value: 10, description: 'Satışın açılma müddəti (gün)' },
    { key: 'sales_close_hours_before', value: 3, description: 'Satışın bağlanma müddəti (saat)' },
    { key: 'payment_gateway', value: 'demo', description: 'Ödəniş şlüzü rejimi' }
  ];
  for (const s of settings) {
    const exists = await Setting.findOne({ key: s.key });
    if (!exists) {
      await Setting.create(s);
      counts.settings++;
    }
  }

  const promos = [
    { code: 'ADY10', percent: 10, maxUses: 500, isActive: true },
    { code: 'YAY2026', percent: 15, maxUses: 200, isActive: true }
  ];
  for (const p of promos) {
    const exists = await PromoCode.findOne({ code: p.code });
    if (!exists) {
      await PromoCode.create({ ...p, expiresAt: dayjs().add(90, 'day').toDate() });
      counts.promos++;
    }
  }

  return counts;
}

async function seedTrips() {
  let total = 0;
  for (let d = 0; d < 11; d++) {
    const date = dayjs().add(d, 'day').format('YYYY-MM-DD');
    const trips = await ensureTripsForDate(date);
    total += trips.length;
  }
  return total;
}

async function runSeed({ force = false } = {}) {
  console.log('[seed] Başlanır' + (force ? ' (force rejimi — mövcud data silinir)' : '') + '...');

  const stations = await seedStations(force);
  const trains = await seedTrains(force);
  const users = await seedUsers(force);
  const content = await seedContent(force);
  const trips = await seedTrips();

  console.log('[seed] Nəticə:');
  console.log('   • Stansiya əlavə olundu:', stations);
  console.log('   • Qatar şablonu əlavə olundu:', trains);
  console.log('   • İstifadəçi əlavə olundu:', users);
  console.log('   • Səhifə:', content.pages, '| Xəbər:', content.news, '| İstiqamət:', content.destinations, '| FAQ:', content.faqs, '| Tənzimləmə:', content.settings, '| Promo:', content.promos);
  console.log('   • Reys (11 gün üçün):', trips);
  console.log('[seed] Tamamlandı ✓');
  console.log('\n   Demo giriş:');
  console.log('   • İstifadəçi: user@ady.az / user123');
  console.log('   • Admin:     admin@ady.az / admin123\n');

  return { stations, trains, users, content, trips };
}

/** Yalnız baza boşdursa seed edir (server.js tərəfindən çağırılır) */
async function runSeedIfEmpty() {
  const stationCount = await Station.countDocuments();
  const userCount = await User.countDocuments();
  if (stationCount > 0 && userCount > 0) {
    console.log('[seed] Baza artıq doludur — seed atlanıldı.');
    // Reyslərin olmasını təmin et
    await seedTrips();
    return null;
  }
  return runSeed({ force: false });
}

/* ==================== CLI ==================== */
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const force = process.argv.includes('--force');
      await runSeed({ force });
      await disconnectDB();
      process.exit(0);
    } catch (e) {
      console.error('[seed] Xəta:', e);
      process.exit(1);
    }
  })();
}

module.exports = { runSeed, runSeedIfEmpty, STATIONS, ABSHERON_TRAINS, DOMESTIC_TRAINS };
