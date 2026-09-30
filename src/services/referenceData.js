/* Rəsmi ADY hərəkət cədvəli əsasında stansiya, qatar və tarif bazası.
   Canlı mənbə oxuna bildikdə həmin məlumatlar tarif qiymətlərini yeniləyir. */
const { Station, Train, SyncLog } = require('../models/index');
const config = require('../config');

const STATIONS = [
  { code: 'BAK', name: 'Bakı', nameEn: 'Baku', region: 'Bakı', country: 'AZ', city: 'Bakı', isHub: true, order: 1 },
  { code: 'BIL', name: 'Biləcəri', nameEn: 'Bilajari', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 2 },
  { code: 'XRD', name: 'Xırdalan', nameEn: 'Khirdalan', region: 'Abşeron', country: 'AZ', city: 'Xırdalan', order: 3 },
  { code: 'SUM', name: 'Sumqayıt', nameEn: 'Sumgayit', region: 'Sumqayıt', country: 'AZ', city: 'Sumqayıt', order: 4 },
  { code: 'XAC', name: 'Xaçmaz', nameEn: 'Khachmaz', region: 'Xaçmaz', country: 'AZ', city: 'Xaçmaz', order: 10 },
  { code: 'QUB', name: 'Quba', nameEn: 'Guba', region: 'Quba', country: 'AZ', city: 'Quba', order: 11 },
  { code: 'QBA', name: 'Qəbələ', nameEn: 'Gabala', region: 'Qəbələ', country: 'AZ', city: 'Qəbələ', order: 12 },
  { code: 'SHE', name: 'Şəki', nameEn: 'Sheki', region: 'Şəki', country: 'AZ', city: 'Şəki', order: 13 },
  { code: 'ZAG', name: 'Zaqatala', nameEn: 'Zaqatala', region: 'Zaqatala', country: 'AZ', city: 'Zaqatala', order: 14 },
  { code: 'GNC', name: 'Gəncə', nameEn: 'Ganja', region: 'Gəncə', country: 'AZ', city: 'Gəncə', isHub: true, order: 20 },
  { code: 'QAZ', name: 'Qazax', nameEn: 'Gazakh', region: 'Qazax', country: 'AZ', city: 'Qazax', order: 21 },
  { code: 'AGM', name: 'Ağstafa', nameEn: 'Agstafa', region: 'Ağstafa', country: 'AZ', city: 'Ağstafa', order: 22 },
  { code: 'SAL', name: 'Salyan', nameEn: 'Salyan', region: 'Salyan', country: 'AZ', city: 'Salyan', order: 30 },
  { code: 'LNK', name: 'Lənkəran', nameEn: 'Lankaran', region: 'Lənkəran', country: 'AZ', city: 'Lənkəran', order: 31 },
  { code: 'AST', name: 'Astara', nameEn: 'Astara', region: 'Astara', country: 'AZ', city: 'Astara', order: 32 },
  { code: 'MSL', name: 'Masallı', nameEn: 'Masalli', region: 'Masallı', country: 'AZ', city: 'Masallı', order: 33 },
  { code: 'SIR', name: 'Sirvan', nameEn: 'Shirvan', region: 'Şirvan', country: 'AZ', city: 'Şirvan', order: 34 },
  { code: 'SAB', name: 'Sabirabad', nameEn: 'Sabirabad', region: 'Sabirabad', country: 'AZ', city: 'Sabirabad', order: 35 },
  { code: 'IMI', name: 'İmişli', nameEn: 'Imishli', region: 'İmişli', country: 'AZ', city: 'İmişli', order: 36 },
  { code: 'YEV', name: 'Yevlax', nameEn: 'Yevlakh', region: 'Yevlax', country: 'AZ', city: 'Yevlax', order: 23 },
  { code: 'MIN', name: 'Mingəçevir', nameEn: 'Mingachevir', region: 'Mingəçevir', country: 'AZ', city: 'Mingəçevir', order: 24 },
  { code: 'KUR', name: 'Kürdəmir', nameEn: 'Kurdamir', region: 'Kürdəmir', country: 'AZ', city: 'Kürdəmir', order: 37 },
  { code: 'HAJ', name: 'Hacıqabul', nameEn: 'Hajigabul', region: 'Hacıqabul', country: 'AZ', city: 'Hacıqabul', order: 38 },
  { code: 'ADK', name: 'Ağdaş', nameEn: 'Agdash', region: 'Ağdaş', country: 'AZ', city: 'Ağdaş', order: 25 },
  { code: 'TBN', name: 'Tbilisi', nameEn: 'Tbilisi', nameRu: 'Тбилиси', region: 'Tbilisi', country: 'GE', city: 'Tbilisi', isHub: true, order: 50 },
  { code: 'BTM', name: 'Batumi', nameEn: 'Batumi', nameRu: 'Батуми', region: 'Acarıstan', country: 'GE', city: 'Batumi', isHub: true, order: 51 },
  { code: 'GOR', name: 'Qori', nameEn: 'Gori', region: 'Şida Kartli', country: 'GE', city: 'Gori', order: 52 },
  { code: 'RST', name: 'Rustavi', nameEn: 'Rustavi', region: 'Kvemo Kartli', country: 'GE', city: 'Rustavi', order: 53 },
  { code: 'BOR', name: 'Borjomi', nameEn: 'Borjomi', region: 'Samtsxe-Cavaxeti', country: 'GE', city: 'Borjomi', order: 54 },
  { code: 'AKH', name: 'Axalkalaki', nameEn: 'Akhalkalaki', region: 'Samtsxe-Cavaxeti', country: 'GE', city: 'Axalkalaki', order: 55 },
  { code: 'ZUG', name: 'Zugdidi', nameEn: 'Zugdidi', region: 'Sameqrelo', country: 'GE', city: 'Zugdidi', order: 56 },
  { code: 'POT', name: 'Poti', nameEn: 'Poti', region: 'Sameqrelo', country: 'GE', city: 'Poti', order: 57 },
  { code: 'KUT', name: 'Kutaisi', nameEn: 'Kutaisi', region: 'İmereti', country: 'GE', city: 'Kutaisi', order: 58 },
  { code: 'TEL', name: 'Telavi', nameEn: 'Telavi', region: 'Kaxeti', country: 'GE', city: 'Telavi', order: 59 }
];

/* Abşeron dairəvi xətti — günün reysləri */
const ABSHERON_REYS = [
  ['6001', '06:10', '06:21', '06:29', '06:36'],
  ['6003', '06:50', '07:01', '07:09', '07:16'],
  ['6005', '07:30', '07:41', '07:49', '07:56'],
  ['6007', '08:10', '08:21', '08:29', '08:36'],
  ['6009', '08:50', '09:01', '09:09', '09:16'],
  ['6011', '09:30', '09:41', '09:49', '09:56'],
  ['6013', '10:10', '10:21', '10:29', '10:36'],
  ['6015', '11:00', '11:11', '11:19', '11:26'],
  ['6017', '12:00', '12:11', '12:19', '12:26'],
  ['6019', '13:00', '13:11', '13:19', '13:26'],
  ['6021', '14:00', '14:11', '14:19', '14:26'],
  ['6023', '15:00', '15:11', '15:19', '15:26'],
  ['6025', '16:00', '16:11', '16:19', '16:26'],
  ['6027', '17:00', '17:11', '17:19', '17:26'],
  ['6029', '17:50', '18:01', '18:09', '18:16'],
  ['6031', '18:40', '18:51', '18:59', '19:06'],
  ['6033', '19:30', '19:41', '19:49', '19:56'],
  ['6035', '20:20', '20:31', '20:39', '20:46'],
  ['6037', '21:10', '21:21', '21:29', '21:36'],
  ['6039', '22:00', '22:11', '22:19', '22:26'],
  ['6041', '06:30', '06:41', '06:49', '06:56'],
  ['6043', '07:50', '08:01', '08:09', '08:16'],
  ['6045', '09:10', '09:21', '09:29', '09:36'],
  ['6047', '10:40', '10:51', '10:59', '11:06'],
  ['6049', '12:40', '12:51', '12:59', '13:06'],
  ['6051', '14:40', '14:51', '14:59', '15:06'],
  ['6053', '16:40', '16:51', '16:59', '17:06'],
  ['6055', '18:10', '18:21', '18:29', '18:36'],
  ['6057', '19:00', '19:11', '19:19', '19:26'],
  ['6059', '20:50', '21:01', '21:09', '21:16'],
  ['6061', '22:40', '22:51', '22:59', '23:06']
];

function absheronTrains() {
  const allDays = [0, 1, 2, 3, 4, 5, 6];
  return ABSHERON_REYS.map((r) => ({
    number: r[0],
    title: 'Bakı — Sumqayıt (Abşeron dairəvi xətti)',
    type: 'suburban',
    line: 'absheron',
    from: 'BAK',
    to: 'SUM',
    weekdays: allDays,
    stops: [
      { code: 'BAK', name: 'Bakı', arrive: '', depart: r[1], distanceKm: 0 },
      { code: 'BIL', name: 'Biləcəri', arrive: '', depart: r[2], distanceKm: 12 },
      { code: 'XRD', name: 'Xırdalan', arrive: '', depart: r[3], distanceKm: 21 },
      { code: 'SUM', name: 'Sumqayıt', arrive: r[4], depart: '', distanceKm: 34 }
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 6, seatsPerWagon: 54, price: 1.2, multiplier: 1 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 2.4, multiplier: 2 }
    ],
    basePrice: 1.2,
    pricePerKm: 0.035
  }));
}

/* Ölkədaxili sürətli və sərnişin qatarları */
const DOMESTIC = [
  {
    number: '732', title: 'Bakı — Qazax sürətli qatarı', type: 'express', line: 'domestic', from: 'BAK', to: 'QAZ',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 460,
    stops: [
      ['BAK', 'Bakı', '', '08:00', 0], ['BIL', 'Biləcəri', '08:10', '08:12', 12],
      ['SUM', 'Sumqayıt', '08:33', '08:35', 34], ['HAJ', 'Hacıqabul', '09:40', '09:42', 118],
      ['KUR', 'Kürdəmir', '10:18', '10:20', 180], ['YEV', 'Yevlax', '11:05', '11:08', 265],
      ['GNC', 'Gəncə', '12:05', '12:10', 340], ['QAZ', 'Qazax', '13:05', '', 460]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 12.3 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 24.6 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 36.9 }
    ]
  },
  {
    number: '734', title: 'Bakı — Gəncə sürətli qatarı', type: 'express', line: 'domestic', from: 'BAK', to: 'GNC',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 340,
    stops: [
      ['BAK', 'Bakı', '', '16:30', 0], ['BIL', 'Biləcəri', '16:40', '16:42', 12],
      ['SUM', 'Sumqayıt', '17:03', '17:05', 34], ['HAJ', 'Hacıqabul', '18:05', '18:07', 118],
      ['KUR', 'Kürdəmir', '18:40', '18:42', 180], ['YEV', 'Yevlax', '19:25', '19:28', 265],
      ['GNC', 'Gəncə', '20:15', '', 340]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 9.6 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 19.2 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 28.8 }
    ]
  },
  {
    number: '736', title: 'Bakı — Şəki sürətli qatarı', type: 'express', line: 'domestic', from: 'BAK', to: 'SHE',
    weekdays: [1, 3, 5], distance: 380,
    stops: [
      ['BAK', 'Bakı', '', '07:40', 0], ['SUM', 'Sumqayıt', '08:12', '08:14', 34],
      ['YEV', 'Yevlax', '10:20', '10:24', 265], ['ADK', 'Ağdaş', '11:05', '11:07', 300],
      ['SHE', 'Şəki', '12:30', '', 380]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 11.4 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 22.8 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 34.2 }
    ]
  },
  {
    number: '738', title: 'Bakı — Zaqatala sürətli qatarı', type: 'express', line: 'domestic', from: 'BAK', to: 'ZAG',
    weekdays: [2, 6], distance: 460,
    stops: [
      ['BAK', 'Bakı', '', '07:20', 0], ['SUM', 'Sumqayıt', '07:52', '07:54', 34],
      ['YEV', 'Yevlax', '10:00', '10:04', 265], ['SHE', 'Şəki', '11:30', '11:34', 380],
      ['ZAG', 'Zaqatala', '12:50', '', 460]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 13.8 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 27.6 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 41.4 }
    ]
  },
  {
    number: '740', title: 'Bakı — Astara sərnişin qatarı', type: 'passenger', line: 'domestic', from: 'BAK', to: 'AST',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 310,
    stops: [
      ['BAK', 'Bakı', '', '18:20', 0], ['SIR', 'Şirvan', '19:45', '19:48', 120],
      ['SAL', 'Salyan', '20:40', '20:43', 175], ['MSL', 'Masallı', '21:50', '21:53', 250],
      ['LNK', 'Lənkəran', '22:40', '22:45', 280], ['AST', 'Astara', '23:40', '', 310]
    ],
    classes: [
      { code: 'plazkart', title: 'Platskart', wagonCount: 6, seatsPerWagon: 54, price: 8.5 },
      { code: 'coupe', title: 'Kupe', wagonCount: 3, seatsPerWagon: 36, price: 15.0 }
    ]
  },
  {
    number: '742', title: 'Bakı — Lənkəran sürətli qatarı', type: 'fast', line: 'domestic', from: 'BAK', to: 'LNK',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 280,
    stops: [
      ['BAK', 'Bakı', '', '15:40', 0], ['HAJ', 'Hacıqabul', '16:45', '16:47', 118],
      ['SIR', 'Şirvan', '17:10', '17:12', 120], ['SAL', 'Salyan', '18:05', '18:07', 175],
      ['LNK', 'Lənkəran', '19:30', '', 280]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 8.9 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 17.8 }
    ]
  },
  {
    number: '744', title: 'Bakı — Quba sürətli qatarı', type: 'fast', line: 'domestic', from: 'BAK', to: 'QUB',
    weekdays: [0, 2, 4, 6], distance: 165,
    stops: [
      ['BAK', 'Bakı', '', '09:20', 0], ['SUM', 'Sumqayıt', '09:52', '09:54', 34],
      ['XAC', 'Xaçmaz', '11:05', '11:07', 140], ['QUB', 'Quba', '11:50', '', 165]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 6.4 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 12.8 }
    ]
  },
  {
    number: '746', title: 'Bakı — Qəbələ sürətli qatarı', type: 'express', line: 'domestic', from: 'BAK', to: 'QBA',
    weekdays: [5, 6, 0], distance: 290,
    stops: [
      ['BAK', 'Bakı', '', '08:40', 0], ['SUM', 'Sumqayıt', '09:12', '09:14', 34],
      ['YEV', 'Yevlax', '11:00', '11:04', 265], ['QBA', 'Qəbələ', '12:40', '', 290]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 14.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 31.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 93.0 }
    ]
  },
  {
    number: '748', title: 'Bakı — Mingəçevir sürətli qatarı', type: 'fast', line: 'domestic', from: 'BAK', to: 'MIN',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 290,
    stops: [
      ['BAK', 'Bakı', '', '17:10', 0], ['SUM', 'Sumqayıt', '17:42', '17:44', 34],
      ['KUR', 'Kürdəmir', '19:10', '19:12', 180], ['YEV', 'Yevlax', '19:55', '19:58', 265],
      ['MIN', 'Mingəçevir', '20:45', '', 290]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 9.2 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 18.4 }
    ]
  }
];

/* Gürcüstan daxili və Bakı — Gürcüstan istiqamətləri */
const GEORGIA = [
  {
    number: '37', title: 'Bakı — Tbilisi beynəlxalq qatarı', type: 'international', line: 'georgia', from: 'BAK', to: 'TBN',
    weekdays: [0, 2, 4, 6], distance: 550,
    stops: [
      ['BAK', 'Bakı', '', '20:40', 0], ['GNC', 'Gəncə', '23:50', '23:55', 340],
      ['AGM', 'Ağstafa', '01:40', '01:45', 450], ['RST', 'Rustavi', '05:10', '05:15', 530],
      ['TBN', 'Tbilisi', '06:10', '', 550]
    ],
    classes: [
      { code: 'coupe', title: 'Kupe', wagonCount: 4, seatsPerWagon: 36, price: 81.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 132.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 199.0 }
    ]
  },
  {
    number: '38', title: 'Tbilisi — Bakı beynəlxalq qatarı', type: 'international', line: 'georgia', from: 'TBN', to: 'BAK',
    weekdays: [1, 3, 5, 0], distance: 550,
    stops: [
      ['TBN', 'Tbilisi', '', '20:35', 0], ['RST', 'Rustavi', '21:20', '21:22', 20],
      ['AGM', 'Ağstafa', '00:35', '00:40', 100], ['GNC', 'Gəncə', '02:40', '02:45', 210],
      ['BAK', 'Bakı', '06:00', '', 550]
    ],
    classes: [
      { code: 'coupe', title: 'Kupe', wagonCount: 4, seatsPerWagon: 36, price: 81.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 132.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 199.0 }
    ]
  },
  {
    number: '870', title: 'Tbilisi — Batumi sürətli qatarı', type: 'express', line: 'georgia', from: 'TBN', to: 'BTM',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 360,
    stops: [
      ['TBN', 'Tbilisi', '', '08:00', 0], ['GOR', 'Qori', '09:05', '09:07', 80],
      ['KUT', 'Kutaisi', '11:10', '11:15', 250], ['ZUG', 'Zugdidi', '12:20', '12:22', 320],
      ['BTM', 'Batumi', '13:30', '', 360]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 25.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 45.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 65.0 }
    ]
  },
  {
    number: '871', title: 'Batumi — Tbilisi sürətli qatarı', type: 'express', line: 'georgia', from: 'BTM', to: 'TBN',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 360,
    stops: [
      ['BTM', 'Batumi', '', '16:30', 0], ['ZUG', 'Zugdidi', '17:35', '17:37', 40],
      ['KUT', 'Kutaisi', '18:40', '18:45', 110], ['GOR', 'Qori', '20:45', '20:47', 280],
      ['TBN', 'Tbilisi', '21:50', '', 360]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 25.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 45.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 65.0 }
    ]
  },
  {
    number: '872', title: 'Tbilisi — Kutaisi regional qatarı', type: 'passenger', line: 'georgia', from: 'TBN', to: 'KUT',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 250,
    stops: [
      ['TBN', 'Tbilisi', '', '07:15', 0], ['GOR', 'Qori', '08:30', '08:33', 80],
      ['BOR', 'Borjomi', '09:50', '09:55', 160], ['KUT', 'Kutaisi', '11:40', '', 250]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 12.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 22.0 }
    ]
  },
  {
    number: '874', title: 'Tbilisi — Zugdidi regional qatarı', type: 'passenger', line: 'georgia', from: 'TBN', to: 'ZUG',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 320,
    stops: [
      ['TBN', 'Tbilisi', '', '09:40', 0], ['KUT', 'Kutaisi', '12:30', '12:35', 250],
      ['POT', 'Poti', '13:30', '13:32', 300], ['ZUG', 'Zugdidi', '14:20', '', 320]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 4, seatsPerWagon: 54, price: 14.0 },
      { code: 'business', title: 'Biznes', wagonCount: 2, seatsPerWagon: 36, price: 26.0 }
    ]
  },
  {
    number: '876', title: 'Tbilisi — Telavi regional qatarı', type: 'suburban', line: 'georgia', from: 'TBN', to: 'TEL',
    weekdays: [0, 1, 2, 3, 4, 5, 6], distance: 100,
    stops: [
      ['TBN', 'Tbilisi', '', '10:20', 0], ['TEL', 'Telavi', '12:05', '', 100]
    ],
    classes: [
      { code: 'standard', title: 'Standart', wagonCount: 3, seatsPerWagon: 54, price: 6.0 },
      { code: 'business', title: 'Biznes', wagonCount: 1, seatsPerWagon: 36, price: 11.0 }
    ]
  }
];

/* Bakı — Tbilisi — İstanbul (Gürcüstandan keçən beynəlxalq xətt) */
const INTERNATIONAL = [
  {
    number: '377', title: 'Bakı — Tbilisi — Qars beynəlxalq qatarı', type: 'international', line: 'international', from: 'BAK', to: 'TBN',
    weekdays: [1, 4], distance: 550,
    stops: [
      ['BAK', 'Bakı', '', '20:40', 0], ['GNC', 'Gəncə', '23:50', '23:55', 340],
      ['AGM', 'Ağstafa', '01:40', '01:45', 450], ['AKH', 'Axalkalaki', '03:30', '04:00', 520],
      ['TBN', 'Tbilisi', '06:10', '', 550]
    ],
    classes: [
      { code: 'coupe', title: 'Kupe', wagonCount: 4, seatsPerWagon: 36, price: 81.0 },
      { code: 'first', title: 'Birinci sinif', wagonCount: 1, seatsPerWagon: 24, price: 210.0 }
    ]
  }
];

const BAKU_TBILISI_UNTIL = '2029-12-31';

function isBakuTbilisi(t) {
  const codes = (t.stops || []).map((s) => s[0]);
  return codes.indexOf('BAK') > -1 && codes.indexOf('TBN') > -1;
}

function buildTrains() {
  const list = [];

  absheronTrains().forEach((t) => list.push(t));

  DOMESTIC.forEach((t) => {
    list.push({
      number: t.number,
      title: t.title,
      type: t.type,
      line: t.line,
      from: t.from,
      to: t.to,
      weekdays: t.weekdays,
      stops: t.stops.map((s) => ({ code: s[0], name: s[1], arrive: s[2], depart: s[3], distanceKm: s[4], dayOffset: s[2] && s[3] && s[2] < s[3] && s[4] > 200 ? 1 : 0 })),
      classes: t.classes.map((c) => ({ ...c, multiplier: 1 })),
      basePrice: t.classes[0].price,
      pricePerKm: 0.035
    });
  });

  GEORGIA.concat(INTERNATIONAL).forEach((t) => {
    list.push({
      number: t.number,
      title: t.title,
      type: t.type,
      line: t.line,
      from: t.from,
      to: t.to,
      weekdays: t.weekdays,
      stops: t.stops.map((s) => ({ code: s[0], name: s[1], arrive: s[2], depart: s[3], distanceKm: s[4] })),
      classes: t.classes.map((c) => ({ ...c, multiplier: 1 })),
      basePrice: t.classes[0].price,
      pricePerKm: 0.06,
      /* Bakı — Tbilisi reysləri 2029-cu ilin sonunadək hərəkət edir və bilet satışı həmin tarixədək açıqdır */
      ...(isBakuTbilisi(t) ? { validUntil: BAKU_TBILISI_UNTIL, advanceSaleUntil: BAKU_TBILISI_UNTIL } : {})
    });
  });

  return list;
}

async function ensureReferenceData() {
  const stationOps = STATIONS.map((s) => ({
    updateOne: {
      filter: { code: s.code },
      update: { $set: { ...s, source: 'reference', active: true } },
      upsert: true
    }
  }));
  await Station.bulkWrite(stationOps);

  /* Admin panelindən yaradılmış/redaktə olunmuş qatarlar yenidən yazılmır */
  const adminOwned = new Set((await Train.find({ source: 'admin' }).select('number').lean()).map((t) => t.number));
  const trains = buildTrains().filter((t) => !adminOwned.has(t.number));
  const trainOps = trains.map((t) => ({
    updateOne: {
      filter: { number: t.number },
      update: {
        $set: {
          ...t,
          active: true,
          source: 'reference',
          sourceUrl: config.liveSourceUrl + '/az/hereket-cedveli'
        }
      },
      upsert: true
    }
  }));
  await Train.bulkWrite(trainOps);

  /* Bakı — Tbilisi reyslərində əvvəlcədən yaradılmış gələcək reyslərin qiymətini yenilə */
  try {
    const scheduleService = require('./scheduleService');
    for (const t of trains.filter((x) => x.advanceSaleUntil)) {
      await scheduleService.refreshFutureTrips(t);
    }
  } catch (e) {
    console.warn('[ref] gələcək reyslər yenilənmədi:', e.message);
  }

  return { stations: STATIONS.length, trains: trains.length };
}

/* Canlı oxuma nəticəsini tətbiq edir və jurnal yazır */
async function syncReferenceData(live, triggeredBy) {
  const log = await SyncLog.create({
    source: 'ticket.ady.az',
    status: live && live.status === 'blocked' ? 'blocked' : 'running',
    httpStatus: live && live.pages && live.pages.length ? live.pages[0].status : 0,
    triggeredBy: triggeredBy || 'system',
    message: (live && live.message) || '',
    details: { pages: (live && live.pages) || [] }
  });

  try {
    const ref = await ensureReferenceData();

    /* Canlı səhifədən tarif oxuna bildiksə qiymətləri yenilə */
    let fares = 0;
    if (live && live.fares && live.fares.length) {
      const prices = live.fares
        .map((f) => Number(String(f).replace(/[^\d.,]/g, '').replace(',', '.')))
        .filter((n) => n > 0 && n < 500)
        .sort((a, b) => a - b);
      if (prices.length) {
        await Train.updateMany(
          { line: 'absheron' },
          { $set: { 'classes.0.price': prices[0], basePrice: prices[0], lastSyncedAt: new Date() } }
        );
        fares = prices.length;
      }
    }

    log.status = live && live.status === 'blocked' ? 'blocked' : 'success';
    log.finishedAt = new Date();
    log.stationsUpserted = ref.stations;
    log.trainsUpserted = ref.trains;
    log.faresUpserted = fares;
    log.scannedLines = ['absheron', 'domestic', 'georgia', 'international'];
    if (!log.message) log.message = 'Məlumat bazası yeniləndi.';
    await log.save();

    return {
      logId: log._id,
      status: log.status,
      stations: ref.stations,
      trains: ref.trains,
      fares
    };
  } catch (e) {
    log.status = 'failed';
    log.message = e.message;
    log.finishedAt = new Date();
    await log.save();
    throw e;
  }
}

module.exports = {
  STATIONS,
  ABSHERON_REYS,
  DOMESTIC,
  GEORGIA,
  INTERNATIONAL,
  buildTrains,
  ensureReferenceData,
  syncReferenceData
};
