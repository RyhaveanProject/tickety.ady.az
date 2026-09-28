/* ==========================================================================
   ADY rəsmi portalı (ticket.ady.az) strukturuna uyğun məzmun bazası.
   Bütün mətnlər, qiymətlər, məsafələr və linklər rəsmi saytdan götürülüb.
   ========================================================================== */

/* ---------------- Populyar istiqamətlər (rəsmi saytdakı kartlar) ---------- */
const DESTINATIONS = [
  {
    slug: 'baki-tbilisi-baki-qatari',
    title: 'Bakı-Tbilisi',
    stationCode: 'TBN',
    priceFrom: 66,
    durationText: '9 saat 31 dəqiqə',
    distanceKm: 550,
    order: 1,
    image: '/assets/ady/dest-tbilisi.svg',
    summary: 'Beynəlxalq marşrut üzrə yataq tipli qatar. Qardabani və Tbilisi stansiyalarında dayanacaq.',
    content: `
<p>Bakı–Tbilisi–Bakı marşrutu üzrə hərəkət edən beynəlxalq sərnişin qatarı “Stadler” şirkətinin yataq tipli vaqonları ilə xidmət göstərir.</p>
<p>Azərbaycan ərazisində Bakı, Biləcəri, Yevlax, Gəncə, Ağstafa və Böyük Kəsik, Gürcüstan ərazisində isə Qardabani və Tbilisi stansiyalarında dayanacaq verilir.</p>
<h3>Qədim Tbilisi</h3>
<p>V əsrə gedib çıxan bu tarixi məhəllədə Narikala qalası, Abanotubani kükürd hamamları, Sioni və Metexi kilsələri yerləşir. Daş döşəməli küçələri, taxta eyvanları və rəngli fasadları ilə bu məhəllə Tbilisinin digər hissələrindən vizual olaraq kəskin şəkildə fərqlənir.</p>
<h3>“Fabrika”</h3>
<p>Sovet dövründə palto fabrikası kimi istifadə edilən 5.000 kv.m-lik bu kompleks 2017-ci ildə yenidən dizayn edilərək 30-dan çox kafe, studiya, mağaza və hostelin fəaliyyət göstərdiyi açıq həyətli kreativ məkana çevrilib. “Fabrika” şəhər mərkəzindən 15 dəqiqəlik piyada məsafədə yerləşir.</p>
<h3>Sameba kafedral kilsəsi</h3>
<p>Kilsələri, monastırları, qalaları və kafedralları ilə diqqət çəkən Tbilisinin 1995-2004-cü illərdə tikilmiş kafedralı tarixi Avlabari rayonunda Elia təpəsində yerləşir. Onun əsas özəlliyi dünyanın üçüncü ən hündür pravoslav kilsəsi olmasıdır.</p>
<h3>Narikala qalası</h3>
<p>4-cü əsrə aid, Tbilisi qalası kimi də tanınan Narikala qalası valehedici görünüşə malikdir. Şəhərin çoxəsrlik tarixinə işıq tutan qalanın içərisində Müqəddəs Nikolay kilsəsi yerləşir. Şəhərə açılan panoramik mənzərəsi ilə Narikala qalası Tbilisinin simvolik elementlərindən biridir.</p>
<h3>“Gürcüstanın xronikası” abidəsi</h3>
<p>Bu abidəni ziyarət edərkən Tbilisinin fərqli tərəflərini görəcəksiniz. Bu memorial “gürcü Stounhenci” kimi də tanınır. Abidədə Gürcüstanın tarixi, məşhur ədəbi əsərləri və xristianlığın ölkədəki rolu əks olunub. Bir tərəfdən sovet memarlığına, digər tərəfdən isə Tbilisi su anbarına açılan mənzərəsi ilə bura şəhərin izdihamından qaçmaq üçün idealdır.</p>`
  },
  {
    slug: 'baki-qebele-baki-qatari',
    title: 'Bakı-Qəbələ',
    stationCode: 'QBA',
    priceFrom: 12,
    durationText: '3 saat 29 dəqiqə',
    distanceKm: 309,
    order: 2,
    image: '/assets/ady/dest-qebele.svg',
    summary: '“Stadler” ikimərtəbəli sərnişin qatarı. Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Ağdaş və Qəbələ.',
    content: `
<p>Bakı–Qəbələ–Bakı marşrutu üzrə “Stadler” şirkətinin oturacaq tipli ikimərtəbəli sərnişin qatarı hərəkət edir. Qatar Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Ağdaş və Qəbələ dayanacaqlarında dayanır.</p>
<p>İlk 4-lük Qəbələnin tarixi abidələrinə aiddir.</p>
<h3>Qəbələ Arxeoloji Mərkəzi</h3>
<p>Burada regionun zəngin tarixi haqqında məlumat əldə edə və areoloji qazıntılar zamanı tapılmış eksponatları görə bilərsiniz.</p>
<h3>Çuxur Qəbələ</h3>
<p>Burada 2000 ildən çox tarixi olan qədim Qəbələ şəhərinin arxeoloji qalıqlarını görmək mümkündür.</p>
<h3>Çotari kilsəsi</h3>
<p>Nic qəsəbəsində yerləşir. Yerli sakinlərin vəsaiti hesabına 1723-cü ildə inşa edilmişdir. Kilsə yenidən bərpa edilərək 2006-cı ildə Alban-Udi xristian dini icmasının istifadəsinə verilib.</p>
<h3>Müqəddəs Məryəm Ana məbədi</h3>
<p>Bu məbəd Azərbaycanın multikultural dəyərlərini əks etdirən mühüm tarixi abidədir. 2020-ci ildə bərpa olunaraq Alban-Udi icmasının əsas ibadət və mədəniyyət mərkəzinə çevrilib.</p>
<h3>Tufandağ</h3>
<p>Hündürlüyü 4191 metrdir. Yay gəzintiləri üçün ideal məkandır. Burada dağların möhtəşəm mənzərəsini təqdim edən kanat yolu mövcuddur.</p>
<h3>Tufandağ Qış-Yay Turizm İstirahət Kompleksi</h3>
<p>Hündürlüyü 4191 metr olan Tufandağın ətəyində yerləşən Komleks ölkənin yay və qış turizminin mərkəzlərindən biridir. Bura Qəbələ şəhərindən 4 km aralıda yerləşir. İlin bütün fəsillərində fəaliyyət göstərən Azərbaycanın ən böyük dağ-xizək mərkəzlərindən biridir. Kompleks müxtəlif çətinlik dərəcəli xizək yolları, 4 kanat xətti, 5 ulduzlu otel və yayda haykinq, kvadrosikl kimi fəaliyyətlərlə qonaqlara yüksək səviyyəli istirahət təklif edir.</p>
<h3>Nohur gölü</h3>
<p>Meşə və dağlarla əhatə olunmuş sakit bir məkandır. Qayıqla gəzinti, piknik və fotoqrafiya üçün mükəmməldir.</p>
<h3>Qəbələnd Əyləncə Parkı</h3>
<p>Azərbaycanın ən böyük əyləncə parkıdır. Burada ailələr və uşaqlar üçün çox sayda əyləncəli atraksionlar mövcuddur.</p>
<h3>Mucuq şəlaləsi</h3>
<p>Laza kəndi yaxınlığında, 1700 metr hündürlükdə yerləşir. Şəlalənin hündürlüyü 96 metrdir. Azərbaycandakı ən hündür şəlalə hesab olunur.</p>
<h3>Yeddi Gözəl şəlaləsi</h3>
<p>Meşəli dağlıq ərazidə gizlənmiş bu gözəl şəlalə yerli və xarici turistlərin tez-tez ziyarət etdiyi məkandır.</p>
<h3>Qəbələ Lavanda Tarlası-Essenso</h3>
<p>Çuxur Qəbələ kəndində yerləşən bu məkan lavanda ətirli sahələri ilə ziyarətçilərə unudulmaz təcrübə bəxş edir. Burada unikal fotosessiya imkanlarından yararlanmaq, təbii lavanda məhsullarını dadmaq mümkündür. Bura hər il mayın sonundan iyunun sonuna qədər ziyarətçiləri qəbul edir və ildə 1 dəfə möhtəşəm Lavanda Festivalına ev sahibliyi edir.</p>
<p><strong>Qəbələnin gəzməli yerlərini ADY-nin Bakı–Qəbələ–Bakı marşrutu ilə kəşf edə bilərsiniz!</strong></p>`
  },
  {
    slug: 'baki-agstafa-baki-qatari',
    title: 'Bakı-Ağstafa',
    stationCode: 'AGM',
    priceFrom: 14.5,
    durationText: '5 saat 15 dəqiqə',
    distanceKm: 459,
    order: 3,
    image: '/assets/ady/dest-agstafa.svg',
    summary: 'Oturacaq tipli birmərtəbəli ekspres qatar. Sərnişin tələbatından asılı olaraq həftəsonu və bayram günlərində hərəkət edir.',
    content: `
<p>Bakı–Ağstafa–Bakı marşrutu üzrə oturacaq tipli birmərtəbəli ekspres qatarı hərəkət edir.</p>
<p><strong>Qeyd:</strong> Bakı–Ağstafa–Bakı qatarı sərnişin tələbatından asılı olaraq həftəsonu və bayram günlərində hərəkət edir.</p>
<p>Qatar Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Yevlax, Goran, Gəncə, Dəllər, Qovlar, Tovuz və Ağstafa dayanacaqlarında dayanır.</p>
<p>İlk 2-lik Ağstafanın tarixi abidələrinə aiddir.</p>
<h3>Keşikçidağ monastır kompleksi</h3>
<p>VI əsrə aid qədim alban məbədləri ilə tanınan bu kompleks mağaralar və qayalıqlar üzərində yerləşir. Sirlərini hələ də qoruyan monastırın divar rəsmləri və ibadət yerləri ziyarətçilərə tarixin dərinliklərinə səyahət imkanı yaradır.</p>
<h3>Əyyub ağa məscidi</h3>
<p>XIX əsrdə Ağstafa rayonunun Dağ Kəsəmən kəndində tikilmiş tarixi-dini abidədir. Məscid kənd əhalisinin ibadət yeri olmaqla yanaşı, bölgənin mədəni irsinin də mühüm nümunəsidir. Hazırda qorunub saxlanılan məscid ziyarətçilər üçün açıqdır.</p>
<h3>Miniatür Azərbaycan parkı</h3>
<p>Ərazisi 2,5 hektar olan bu park ölkənin 70-dən çox tarixi abidəsinin kiçik maketlərini özündə birləşdirir. Park həm maarifləndiricidir, həm də ziyarətçilərə Azərbaycan irsini bir baxışda görmək imkanı yaradır.</p>
<h3>Qarayazı Dövlət Təbiət Qoruğu</h3>
<p>Kür çayı boyunca uzanan bu qoruq nadir tuqay meşələri və unikal ekosistemi ilə tanınır. Qafqaz cüyürü və digər vəhşi heyvanların təbii habitatı olan bu məkan ekoturizm və təbiət müşahidəsi üçün əlverişlidir.</p>
<h3>Ağstafaçay sahili</h3>
<p>Çayın sahili və Ağstafaçay su anbarı ətrafındakı mənzərəli ərazilər istirahət və balıqçılıq üçün çox əlverişlidir.</p>
<h3>Ağstafa Rayon Tarix-Diyarşünaslıq Muzeyi</h3>
<p>Bölgənin erkən tunc dövründən müasir dövrə qədər olan zəngin tarixini və etnoqrafiyasını əks etdirən minlərlə eksponatı nümayiş etdirir.</p>
<h3>Tatlı kəndi</h3>
<p>Təbiəti və kənd həyatı ilə seçilən Tatlı kəndi həm də arxeoloji tapıntıları ilə məşhurdur. Burada qədim kurqanlar, yaşayış yerləri və tarixi abidələr aşkar edilmişdir. Kəndin sakit mühiti və kənd təsərrüfatı ənənələri ziyarətçilər üçün maraqlı təcrübə təqdim edir.</p>
<p><strong>Ağstafanın gəzməli yerlərini ADY-nin Bakı–Ağstafa–Bakı istiqaməti ilə kəşf edə bilərsiniz!</strong></p>`
  },
  {
    slug: 'baki-gence-baki-qatari',
    title: 'Bakı-Gəncə',
    stationCode: 'GNC',
    priceFrom: 12.8,
    durationText: '3 saat 55 dəqiqə',
    distanceKm: 364,
    order: 4,
    image: '/assets/ady/dest-gence.svg',
    summary: 'Ölkənin ikinci böyük şəhərinə sürətli qatar. Bakı–Qazax marşrutunun əsas dayanacaqlarından biri.',
    content: `
<p>Gəncə Bakı–Qazax–Bakı marşrutu üzrə hərəkət edən “Stadler” oturacaq tipli birmərtəbəli sərnişin qatarının əsas dayanacaqlarından biridir.</p>
<p>İlk 5-lik Gəncənin tarixi abidələrinə aiddir.</p>
<h3>Nizami Gəncəvi məqbərəsi və muzeyi</h3>
<p>Məqbərə XIII-XIV əsrlərə aiddir. Hazırkı memarlıq kompleksi 1991-ci ildə yenidən bərpa edilib və 35 hektar genişliyində park kompleksi ilə əhatə olunub. Muzey də məqbərə ərazisindədir - burada böyük şairin həyat və yaradıcılığına həsr olunmuş əlyazma nüsxələri, illüstrasiyalar və şairin əsərlərinə dair ekspozisiyalar sərgilənir.</p>
<h3>Xan bağı</h3>
<p>Xan bağı Qafqazın ən qədim parklarından biridir. 1727-ci ilə aid Osmanlı mənbəsində Xan bağının sahəsinin 130 hektar olması və burada 479 çinar, 404 sərv, 3554 meyvə ağaclarının bitməsi göstərilib. Tarixən Gəncə bəylərbəylərinin və xanlarının istirahət guşəsi olan Xan bağı müxtəlif dövrlərdə “Sərdar bağı” və “Gəncə Mədəniyyət və İstirahət Parkı” adlandırılıb. Azərbaycanın müstəqlliyi bərpa edildikdən sonra parkın tarixi adı bərpa edilib. XVI əsrdə inşa edilən Gəncə qala divarlarının qalığı olan Şirəli bəy bürcü Xan bağının ərazisindədir.</p>
<h3>Gəncə Cümə məscidi-Şah Abbas məscidi</h3>
<p>XVII əsrə aid bu məscid klassik memarlığı ilə tanınır. Məscidin əsas binası dördbucaqlı formadadır. Əsas binanın yanındakı ikinci binada isə məscidin iki minarəsi yerləşir.</p>
<h3>Çökək hamam</h3>
<p>1606-cı ildə Şah Abbasın dövründə tikilmiş bu hamam memarlıq incisi sayılır. Qeyd edilir ki, “çökək” adı onun döşəməsinin yer səthindən nisbətən aşağıda yerləşməsindən gəlir. İki salonu, bir hovuzu və yarım gümbəzli strukturu ilə tarixi atmosfer yaradır.</p>
<h3>“İmamzadə” kompleksi</h3>
<p>Gəncənin “İmamzadə” məscidinin (“Göy günbəz”, “Göy məscid”, yaxud “Göy İmam” kimi də tanınır) tarixi 14-cü əsrdən tikilməyə başlayır. Məscid beşinci imam Məhəmməd əl-Baqirin oğlu İbrahimin qəbri üzərində inşa edilib. İllər keçdikcə bura ziyarətgaha, daha sonra isə kompleksə çevrilib. 2010-2016-cı illərdə kompleks əsaslı bərpa edilib. Türbənin tovuz quşunun əksi və çiçək naxışları ilə bəzədilmiş göy kirəmitli möhtəşəm günbəzinə xüsusilə diqqəti cəlb edir.</p>
<h3>Gəncə Tarix-Diyarşünaslıq Muzeyi</h3>
<p>1924-cü ildə təsis edilib və 30.000-dən çox eksponatı var. Gəncənin qədim zamanlardan müasir dövrə qədərki zəngin tarixini və mədəniyyətini əhatə edir. Muzey Cavad xanın nəticələrinin XIX əsrə aid tarixi mülkündə yerləşir.</p>
<h3>Göygöl Milli Parkı</h3>
<p>Şəhər mərkəzindən təxminən 50 km məsafədə yerləşir. Dağlıq ərazidə möhtəşəm gölləri və təbii mənzərələri ilə gəzinti üçün ideal məkandır.</p>
<h3>Heydər Əliyev Park Kompleksi</h3>
<p>450 hektar ərazidə yerləşən Qafqazın ən böyülk şəhər parkı 2014-cü ildə açılıb. Zəfər tağı, süni göl, amfiteatr və heykəlləri ilə diqqət çəkir. Parkın girişində yerləşən Zəfər tağı monumental abidəsinin eni 20 m, uzunluğu 50 m və hündürlüyü 38 metrdir. Buranın ən yüksək hissəsindən şəhərə panoramik mənzərə açılır.</p>
<h3>Butulkalı ev</h3>
<p>Gəncənin maraqlı tikililərindəndir. Evin divarları müxtəlif ölçülü rəngli şüşə parçaları ilə bəzədilib. Günəş işığı altında mozaika effekti yaradır və çox sayda foto həvəskarlarının diqqətini çəkir.</p>
<p><strong>Gəncənin gəzməli yerlərini ADY-nin Bakı–Gəncə–Bakı marşrutu ilə kəşf edə bilərsiniz!</strong></p>`
  },
  {
    slug: 'baki-qazax-baki-qatari',
    title: 'Bakı-Qazax',
    stationCode: 'QAZ',
    priceFrom: 14.5,
    durationText: '5 saat 35 dəqiqə',
    distanceKm: 469,
    order: 5,
    image: '/assets/ady/dest-qazax.svg',
    summary: '“Stadler” oturacaq tipli birmərtəbəli sərnişin qatarı ilə ən uzaq qərb istiqaməti.',
    content: `
<p>Bakı–Qazax–Bakı marşrutu üzrə hərəkət edən qatarların Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Ləki, Yevlax, Goran, Gəncə, Dəllər, Qovlar, Tovuz, Ağstafa və Qazax dayanacaqları var. Bu marşrut üzrə “Stadler” şirkətinin oturacaq tipli birmərtəbəli sərnişin qatarı hərəkət edir.</p>
<p>Qazaxın tarixi abidələrinə aiddir:</p>
<h3>Göyəzən dağı</h3>
<p>Qazaxın rəmzi hesab olunur. Unikal forması və landşaftı ilə həm turistlərin, həm də dağçıların diqqətini çəkir.</p>
<h3>Qırmızı körpü/Sınıq körpü</h3>
<p>XVII əsrə aid memarlıq nümunəsidir. Kür çayı üzərində salınmış bu qədim körpü Azərbaycanla Gürcüstanı birləşdirən mühüm ticarət yolunun üzərində yerləşir.</p>
<h3>Avey dağı və Avey monastrı</h3>
<p>Bura arxeoloji baxımdan xüsusi əhəmiyyət daşıyır. Buradakı qədim məbədlər və mağaralar Alban dövrünün izlərini bu günədək qoruyub saxlayır.</p>
<h3>Damcılı bulağı</h3>
<p>Avey dağının qayalıqlarında yerləşir, qayadan damcılı şəkildə həm bulaq suyu çıxır, həm də yağış yağdığı zaman şəlalə şəklində axaraq bənzərsiz mənzərə yaradır.</p>
<h3>Didivan qalası</h3>
<p>VI-VII əsrlərdə tikilib. Sıldırım qayalıqlar üzərində yerləşən bu qala qədim müdafiə istehkamı kimi bölgənin tarixinə işıq tutur.</p>
<h3>Didivan gölü</h3>
<p>Dağ ətəyində yerləşir. Sakit təbiəti, təmiz havası və ətraf mənzərəsi ilə dincəlmək və fotoqrafiya üçün ideal yerdir.</p>
<h3>Qazax Cümə məscidi</h3>
<p>XVIII əsrin sonlarında tikilib. Daşdan ucaldılmış möhtəşəm tikili bu gün də ziyarətçilərin maraqla gəldiyi məkanlardandır.</p>
<h3>İsrafil ağa hamamı</h3>
<p>XIX əsrdə inşa olunub. Şəhərin mərkəzində yerləşən bu tarixi hamam memarlıq üslubu, tağlı zalı və qədim ornamentləri ilə diqqət çəkir, həm də bölgənin mədəni irsini yaşadır.</p>
<p><strong>Qazaxın gəzməli yerlərini ADY-nin Bakı–Qazax–Bakı marşrutu ilə kəşf edə bilərsiniz!</strong></p>`
  },
  {
    slug: 'baki-tovuz-baki-qatari',
    title: 'Bakı-Tovuz',
    stationCode: 'TOV',
    priceFrom: 13.7,
    durationText: '4 saat 55 dəqiqə',
    distanceKm: 436,
    order: 6,
    image: '/assets/ady/dest-tovuz.svg',
    summary: 'Gəncə–Ağstafa xətti üzərində tarixi abidələrlə zəngin rayon.',
    content: `
<p>Tovuz rayonu Bakı–Qazax–Bakı və Bakı–Ağstafa–Bakı marşrutları üzrə hərəkət edən qatarların dayanacaqları sırasındadır.</p>
<p>İlk 4-lük Tovuzun tarixi abidələrinə aiddir.</p>
<h3>Göytəpə Arxeoloji Parkı</h3>
<p>E.ə VI minilliyə aid qədim yaşayış məskənidir. Buradakı tapıntılar Tovuzun minilliklərə söykənən tarixini sübut edir.</p>
<h3>Koroğlu qalası</h3>
<p>Əlibəyli kəndi yaxınlığında, sıldırım qayalıqlar üzərində yerləşən bu qala xalq qəhrəmanı Koroğlunun adı ilə bağlıdır. Bura müdafiə istehkamı kimi inşa edilib.</p>
<h3>Sultan körpüsü</h3>
<p>Şəmşəddil sultanı Sultan bəyin göstərişi ilə 1751-ci ildə Axınca çayının üzərində inşa olunub. Bu körpü vaxtilə 3 kəndi bir-birinə birləşdirib.</p>
<h3>Qala kompleksi</h3>
<p>Şəhərin girişində yerləşir, klassik üslubda lakin müasir dövrdə inşa edilib. Arxeoloji yaşayış məskənindən əldə edilən maddi-mədəniyyət nümunələri burada nümayiş etdirilir.</p>
<h3>Heydər Əliyev Parkı</h3>
<p>Tovuz şəhərinin ən böyük istirahət məkanıdır. Gözəl landşaftı, fəvvarələri və gəzinti yolları ilə həm yerli əhali, həm də qonaqlar üçün cəlbedici yerdir.</p>
<h3>Əsrik dərəsi</h3>
<p>Yaşıl meşələr və bulaqlarla zəngindir, yay istirahəti üçün ideal təbiət guşəsidir.</p>
<h3>Xınna dərəsi</h3>
<p>Sakitliyi, təmiz havası və dağ mənzərələri ilə tanınır, yürüş və foto turları üçün mükəmməl istiqamətlərdəndir.</p>
<h3>Kirən kəndi</h3>
<p>Bura təmiz havası və gözəl dağ mənzərələri ilə tanınır. Yaz aylarında yaylaları çobanyastığı çiçəkləri ilə örtülür.</p>
<p><strong>Tovuzun gəzməli yerlərini ADY-nin Bakı–Tovuz–Bakı istiqaməti ilə kəşf edə bilərsiniz!</strong></p>`
  },
  {
    slug: 'baki-yevlax-baki-qatari',
    title: 'Bakı-Yevlax',
    stationCode: 'YEV',
    priceFrom: 11.1,
    durationText: '3 saat 9 dəqiqə',
    distanceKm: 294,
    order: 7,
    image: '/assets/ady/dest-yevlax.svg',
    summary: 'Ölkədaxili reyslərin əsas qovşağı — Kür çayı sahilində qədim şəhər.',
    content: `
<p>Yevlax Bakı–Qazax–Bakı, Bakı–Ağstafa–Bakı və Gəncə–Qəbələ–Gəncə marşrutlarının qovşaq dayanacağıdır.</p>
<h3>Türyançay Dövlət Təbiət Qoruğu</h3>
<p>Yevlax və Ağdaş rayonlarının ərazisində yerləşir. Qoruq quru subtropik iqlim şəraitində yarımsəhra landşaftını, qonur ayı və çöl donuzu kimi vəhşi heyvanları qoruyur.</p>
<h3>Yevlax Sahil-Bulvar Parkı</h3>
<p>Kür çayının sağ sahilində yerləşir. 2500 metr uzunluğunda və 8 hektardan çox ərazidə qurulub.</p>
<h3>Yevlax Tarix-Diyarşünaslıq Muzeyi</h3>
<p>Muzeyin 3700-dən çox eksponatı var. Ən qədimləri eramızdan əvvəl II-III minilliyə aiddir.</p>
<p><strong>Yevlaxın gəzməli yerlərini ADY-nin Bakı–Yevlax–Bakı istiqaməti ilə kəşf edə bilərsiniz!</strong></p>`
  }
];

/* ---------------- Ana səhifədəki kartlar (rəsmi saytdan) ------------------ */
const HOME_CARDS = [
  {
    href: 'populyar-istiqametler',
    title: 'Populyar istiqamətlər',
    text: 'ADY ilə Azərbaycanı kəşf et',
    action: 'Ətraflı oxu',
    image: '/assets/ady/card-popular.svg'
  },
  {
    href: 'dasima-qaydalari/usaqlarla-seyahet',
    title: 'Uşaqlarla səyahət',
    text: 'Uşaqların qatarla səyahət etməsi üçün qaydalar.',
    action: 'Ətraflı oxu',
    image: '/assets/ady/card-children.svg'
  },
  {
    href: 'balans-artirilmasi',
    title: 'Fiziki kartın balansının artırılması',
    text: 'Vaxta qənaət üçün balansını indi artır.',
    action: 'Balansın artırılması',
    image: '/assets/ady/card-balance.svg'
  },
  {
    href: 'dasima-qaydalari/el-yuklerinin-dasinmasi',
    title: 'Əl yüklərinin daşınması',
    text: 'Qatarda əl yüklərinin daşınması qaydaları.',
    action: 'Ətraflı oxu',
    image: '/assets/ady/card-luggage.svg'
  },
  {
    href: 'dasima-qaydalari/heyvanlarin-dasinmasi',
    title: 'Heyvanların daşınması',
    text: 'Sərnişin qatarında heyvanların daşınmasına dair qaydalar.',
    action: 'Ətraflı oxu',
    image: '/assets/ady/card-pets.svg'
  }
];

/* ---------------- Bildirişlər -------------------------------------------- */
const NOTICE = 'Xidmətlərin rəqəmsallaşması ilə əlaqədar, kassaların fəaliyyəti 15 iyuldan mərhələli şəkildə dayandırılır. Bakı və Gəncə Dəmiryol vağzallarının kassaları fəaliyyətini davam etdirəcək. Xoş səfərlər diləyirik!';
const NOTICE_TICKER = 'Ağstafa reysi 15 iyundan etibarən Qazaxa qədər uzadılır. Biletlər artıq satışdadır!';

/* ---------------- FAQ (Sualım var) -------------------------------------- */
const FAQS = [
  {
    order: 1,
    question: 'Velosipedi və skuteri qatarda daşımaq mümkündürmü?',
    answer: 'Sərnişin qatarda əl yükünün pulsuz daşınması üçün müəyyən edilən çəki norması daxilində, əl yükləri üçün nəzərdə tutulmuş yerdə bir ədəd sökülüb-yığılan, mühərriksiz və batareyasız velosipedi (çexoluna yerləşdirməklə), həmçinin FLIRT markalı qatarların bir vaqonunda, velosiped üçün nəzərdə tutulmuş yerdə bir ədəd mühərriksiz və batareyasız velosipedi açıq vəziyyətdə pulsuz daşıya bilər. Bakı–Tbilisi–Bakı marşrutu üzrə hərəkət edən beynəlxalq sərnişin qatarında isə velosiped və skuterlərin (mühərrikli ya mühərriksiz) daşınmasına icazə verilmir.'
  },
  {
    order: 2,
    question: 'Bilet qaytarıldıqda xidmət haqqı tutulurmu?',
    answer: 'Bilet alındıqdan sonrakı 15 dəqiqə ərzində geri qaytarılarsa, xidmət haqqı tutulmur. 15 dəqiqədən sonra qaytarıldıqda isə 20 AZN xidmət haqqı tutulur. Biletin sənədləşdirilməsinə görə əvvəlcədən ödəniş tutulur və geri qaytarılmır.'
  },
  {
    order: 3,
    question: 'Kassalar fəaliyyətini davam etdirirmi?',
    answer: NOTICE
  },
  {
    order: 4,
    question: 'Beynəlxalq istiqamətdə bilet necə qaytarılır?',
    answer: 'Beynəlxalq istiqamətlərdə bilet və plaskartanın tam dəyəri geri qaytarılır — bilet qatarın yola düşməsinə ən azı 24 saat qalmış geri qaytarılmaq üçün təqdim edildikdə. Biletin dəyəri və plaskartanın dəyərinin 50%-i geri qaytarılır — bileti qatarın yola düşməsinə 24 saatdan 6 saatadək vaxt qalmış geri qaytarılmaq üçün təqdim edildikdə.'
  }
];

/* ---------------- Tarif səhifələri -------------------------------------- */
const FARE_ROWS = [
  { route: 'Bakı — Tbilisi', price: '66.00 ₼-dən', note: 'Yataq tipli beynəlxalq qatar' },
  { route: 'Bakı — Ağstafa', price: '14.50 ₼-dən', note: 'Oturacaq tipli ekspres qatar' },
  { route: 'Bakı — Qazax', price: '14.50 ₼-dən', note: 'Oturacaq tipli birmərtəbəli qatar' },
  { route: 'Bakı — Tovuz', price: '13.70 ₼-dən', note: 'Oturacaq tipli qatar' },
  { route: 'Bakı — Gəncə', price: '12.80 ₼-dən', note: 'Oturacaq tipli qatar' },
  { route: 'Bakı — Qəbələ', price: '12.00 ₼-dən', note: 'İkimərtəbəli sərnişin qatarı' },
  { route: 'Bakı — Yevlax', price: '11.10 ₼-dən', note: 'Ölkədaxili qatar' }
];

const FARE_TABLE_HTML = `
<h2>Gediş haqqı tarifləri</h2>
<p>Gediş haqqı məsafəyə, qatarın növünə və vaqon sinfinə görə hesablanır. Aşağıdakı cədvəldə Bakıdan hərəkət edən əsas istiqamətlər üzrə bilet qiymətləri göstərilmişdir.</p>
<table class="data">
<thead><tr><th>İstiqamət</th><th>Biletin qiyməti</th><th>Qatar növü</th></tr></thead>
<tbody>
${FARE_ROWS.map((r) => `<tr><td>${r.route}</td><td class="num">${r.price}</td><td>${r.note}</td></tr>`).join('\n')}
</tbody>
</table>
<h3>Qeydlər</h3>
<ul>
<li>Qiymətlər “-dən başlayaraq” göstərilib; dəqiq məbləğ seçilmiş reys, vaqon sinfi və sərnişin kateqoriyasına görə hesablanır.</li>
<li>Satış qatarın yola düşməsindən 3 saat əvvəl bağlanır.</li>
<li>Bir sifarişdə maksimum 4 bilet rəsmiləşdirilə bilər.</li>
<li>Bakı–Ağstafa–Bakı qatarı sərnişin tələbatından asılı olaraq həftəsonu və bayram günlərində hərəkət edir.</li>
</ul>`;

const REFUND_HTML = `
<h2>Beynəlxalq istiqamətlərdə</h2>
<ul>
<li><strong>Bilet və plaskartanın tam dəyəri geri qaytarılır</strong> — bilet qatarın yola düşməsinə ən azı 24 saat qalmış geri qaytarılmaq üçün təqdim edildikdə.</li>
<li><strong>Biletin dəyəri və plaskartanın dəyərinin 50%-i geri qaytarılır</strong> — bileti qatarın yola düşməsinə 24 saatdan 6 saatadək vaxt qalmış geri qaytarılmaq üçün təqdim edildikdə.</li>
<li><strong>Gedilməmiş məsafəyə görə (plaskarta istisna olmaqla) biletin dəyəri qaytarılır</strong> — sərnişin qatarın yola düşməsinə 6 saatdan az vaxt qalmış və ya qatar yola düşdükdən sonra ən gec 1 saat ərzində səfərdən imtina edərək bileti geri qaytarılmaq üçün təqdim etdikdə; sərnişin aralıq stansiyada səfərin davamından imtina etdikdə və qaldığı qatarın həmin stansiyaya çatmasından sonra ən gec 3 saat ərzində bileti geri qaytarmaq üçün təqdim etdikdə; bileti geri qaytarmaq üçün həmin stansiyada kassa yoxdursa, 10 gün ərzində Bakı və ya Gəncə Dəmiryol Vağzalında bileti qaytara bilər.</li>
</ul>
<h3>Geri qaytarma zamanı nəzərə alınan şərtlər</h3>
<h4>Yataq dəstindən istifadə haqqı</h4>
<p>Bilet qatar yola düşənədək geri qaytarıldıqda yataq dəstindən istifadə haqqı tam məbləğdə geri qaytarılır.</p>
<h4>Komisyon yığım</h4>
<p>Biletin sənədləşdirilməsinə görə əvvəlcədən ödənişi tutulur və geri qaytarılmır.</p>
<h4>Geri qaytarma əməliyyatına görə müəyyən edilən yığım</h4>
<p>Geri qaytarma əməliyyatı rəsmiləşdirilərkən müəyyən edilmiş məbləğdə yığım tutulur.</p>
<p>Bilet alındıqdan sonrakı 15 dəqiqə ərzində geri qaytarılarsa, xidmət haqqı tutulmur. 15 dəqiqədən sonra qaytarıldıqda isə 20 AZN xidmət haqqı tutulur.</p>`;

const PAYMENT_HTML = `
<h2>Ödəniş üsulları</h2>
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
<h3>Balans hesabı ilə ödəniş</h3>
<p>Fiziki kartın balansını onlayn artırmaq və bilet alışında balans hesabından istifadə etmək mümkündür. Balans hesabı ilə alışda da kart məlumatları tələb olunur və ödəniş eyni doğrulama mərhələlərindən keçir.</p>`;

/* ---------------- Tarif səhifələri siyahısı ----------------------------- */
const TARIFF_PAGES = [
  { slug: 'gedis-haqqi-tarifleri', title: 'Gediş haqqı tarifləri', group: 'tariffs', order: 1, excerpt: 'İstiqamətlər üzrə bilet qiymətləri və tarif qaydaları.', content: FARE_TABLE_HTML },
  { slug: 'gedis-haqqinin-qaytarilmasi', title: 'Gediş haqqının qaytarılması', group: 'tariffs', order: 2, excerpt: 'Biletin qaytarılması qaydaları, xidmət haqqı və komisyon yığım.', content: REFUND_HTML },
  { slug: 'odenis-usullari', title: 'Ödəniş üsulları', group: 'tariffs', order: 3, excerpt: 'Bank kartı və şəxsi balans hesabı ilə ödəniş imkanları.', content: PAYMENT_HTML }
];

/* ---------------- Stansiya və dayanacaqlar ------------------------------ */
const STATION_ROWS = [
  { name: 'Sumqayıt sərnişin stansiyası', first: '1958', rebuilt: '2015', extra: 'Yeni vağzal binası: 2018', link: 'https://president.az/articles/30737' },
  { name: 'Biləcəri stansiyası', first: '1952', rebuilt: '2015', link: 'https://president.az/articles/16118' },
  { name: 'Xırdalan stansiyası', first: '1952', rebuilt: '2015', link: 'https://president.az/articles/16118' },
  { name: 'Sabunçu stansiyası', first: '1880', rebuilt: '2019', link: 'https://president.az/articles/33166' },
  { name: 'Bakıxanov dayanacağı', first: '1926', rebuilt: '2019', link: 'https://president.az/articles/33166' },
  { name: 'Koroğlu dayanacağı', first: '1926', rebuilt: '2019', link: 'https://president.az/articles/33166' },
  { name: 'Keşlə dayanacağı', first: '1952', rebuilt: '2019', link: 'https://president.az/articles/33166' },
  { name: 'Zabrat-1 dayanacağı', first: '1933', rebuilt: '2019', link: 'https://president.az/articles/34846' },
  { name: 'Zabrat-2 stansiyası', first: '1934', rebuilt: '2019', link: 'https://president.az/articles/34846' },
  { name: 'Məmmədli dayanacağı', first: '2019', rebuilt: '2019', link: 'https://president.az/articles/34846' },
  { name: 'Pirşağı stansiyası', first: '1970', rebuilt: '2019', link: 'https://president.az/articles/34846' },
  { name: 'Görədil dayanacağı', first: '1971', rebuilt: '2020', link: 'https://president.az/articles/36206' },
  { name: 'Novxanı dayanacağı', first: '1971', rebuilt: '2020', link: 'https://president.az/articles/36206' },
  { name: 'Dərnəgül dayanacağı', first: '2026', rebuilt: '', link: 'https://sml.az/dernegul-dayanacagi' }
];

const STATIONS_HTML = `
<h2>Stansiya və dayanacaqlar</h2>
<p>Abşeron dairəvi dəmiryol xətti üzrə stansiya və dayanacaqların istifadəyə verilmə tarixləri aşağıdakı cədvəldə göstərilmişdir.</p>
<table class="data">
<thead><tr><th>Stansiya / dayanacaq</th><th>İlk istifadə ili</th><th>Yenidənqurmadan sonra</th><th>Mənbə</th></tr></thead>
<tbody>
${STATION_ROWS.map((s) => `<tr><td><strong>${s.name}</strong>${s.extra ? '<br><small>' + s.extra + '</small>' : ''}</td><td class="num">${s.first}</td><td class="num">${s.rebuilt || '—'}</td><td><a href="${s.link}" target="_blank" rel="noopener">Ətraflı</a></td></tr>`).join('\n')}
</tbody>
</table>`;

const ROUTES_HTML = `
<h2>Marşrutlar</h2>
<p>Hazırda ADY-nin qatarları bu marşrutlar üzrə hərəkət edir:</p>
<ol class="route-list">
<li><strong>Bakı–Qazax–Bakı</strong> marşrutu üzrə hərəkət edən qatarların Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Ləki, Yevlax, Goran, Gəncə, Dəllər, Qovlar, Tovuz, Ağstafa və Qazax dayanacaqları var. Bu marşrut üzrə “Stadler” şirkətinin oturacaq tipli birmərtəbəli sərnişin qatarı hərəkət edir.</li>
<li><strong>Bakı–Ağstafa–Bakı</strong> marşrutu üzrə hərəkət edən qatarların Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Yevlax, Goran, Gəncə, Dəllər, Qovlar, Tovuz və Ağstafa dayanacaqları var. Bu marşrut üzrə oturacaq tipli birmərtəbəli ekspres qatarı hərəkət edir.<br><strong>Qeyd:</strong> Bakı–Ağstafa–Bakı qatarı sərnişin tələbatından asılı olaraq həftəsonu və bayram günlərində hərəkət edir.</li>
<li><strong>Bakı–Qəbələ–Bakı</strong> marşrutu üzrə hərəkət edən qatarların Bakı, Dərnəgül, Biləcəri, Kürdəmir, Ucar, Ağdaş və Qəbələ dayanacaqları var. Bu marşrut üzrə “Stadler” şirkətinin oturacaq tipli ikimərtəbəli sərnişin qatarı hərəkət edir.</li>
<li><strong>Abşeron dairəvi dəmiryol xətti</strong> üzrə hərəkət edən qatarların Bakı, Biləcəri, Xırdalan, Keşlə, Koroğlu, Bakıxanov, Sabunçu, Zabrat-1, Zabrat-2, Məmmədli, Pirşağı, Görədil, Novxanı və Sumqayıt dayanacaqları var. Bu marşrut üzrə “Stadler” şirkətinin oturacaq tipli ikimərtəbəli sərnişin qatarı və ekspres qatar hərəkət edir.</li>
<li><strong>Gəncə–Qəbələ–Gəncə</strong> marşrutu üzrə hərəkət edən qatarların Gəncə, Goran, Yevlax, Ləki, Ağdaş, Qəbələ stansiya və dayanacaqları var. Bu marşrut üzrə “Stadler” şirkətinin oturacaq tipli birmərtəbəli sərnişin qatarı hərəkət edir.</li>
<li><strong>Bakı–Tbilisi–Bakı</strong> marşrutu üzrə hərəkət edən qatarlara Azərbaycan ərazisində Bakı, Biləcəri, Yevlax, Gəncə, Ağstafa və Böyük Kəsik stansiyalarında, Gürcüstan ərazisində isə Qardabani və Tbilisi stansiyalarında dayanacaq verilir. Bu marşrut üzrə “Stadler” şirkətinin yataq tipli sərnişin qatarı hərəkət edir.</li>
</ol>`;

/* ---------------- Bölmə səhifələri (sidebar + məzmun) ------------------- */
const SECTIONS = {
  sualim: {
    root: 'sualim-var',
    eyebrow: 'Sualım var',
    title: 'Sualım var',
    items: [
      { slug: 'suallar', title: 'Suallar' },
      { slug: 'elaqe', title: 'Bizimlə əlaqə', href: 'elaqe' },
      { slug: 'komek', title: 'Kömək', href: 'komek' }
    ]
  },
  stansiya: {
    root: 'stansiya-ve-vagzallar',
    eyebrow: 'Stansiyalar və dayanacaqlar',
    title: 'Stansiyalar və dayanacaqlar',
    items: [
      { slug: 'stansiya-ve-vagzallar', title: 'Stansiya və dayanacaqlar' },
      { slug: 'marsrutlar', title: 'Marşrutlar' }
    ]
  }
};

/* ---------------- Əlavə stansiyalar (rəsmi cədvəldə olub, bazada olmayan) */
const EXTRA_STATIONS = [
  { code: 'TOV', name: 'Tovuz', nameEn: 'Tovuz', region: 'Tovuz', country: 'AZ', city: 'Tovuz', order: 26 },
  { code: 'DAR', name: 'Dərnəgül', nameEn: 'Dernegul', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 5 },
  { code: 'UCA', name: 'Ucar', nameEn: 'Ujar', region: 'Ucar', country: 'AZ', city: 'Ucar', order: 27 },
  { code: 'LAK', name: 'Ləki', nameEn: 'Laki', region: 'Ağdaş', country: 'AZ', city: 'Ləki', order: 28 },
  { code: 'GOR2', name: 'Goran', nameEn: 'Goran', region: 'Goranboy', country: 'AZ', city: 'Goran', order: 29 },
  { code: 'DEL', name: 'Dəllər', nameEn: 'Dallar', region: 'Şəmkir', country: 'AZ', city: 'Dəllər', order: 39 },
  { code: 'QOV', name: 'Qovlar', nameEn: 'Qovlar', region: 'Tovuz', country: 'AZ', city: 'Qovlar', order: 40 },
  { code: 'SUM2', name: 'Sumqayıt', nameEn: 'Sumgayit', region: 'Sumqayıt', country: 'AZ', city: 'Sumqayıt', order: 41 },
  { code: 'SAB2', name: 'Sabunçu', nameEn: 'Sabunchu', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 6 },
  { code: 'KOR', name: 'Koroğlu', nameEn: 'Koroglu', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 7 },
  { code: 'BXK', name: 'Bakıxanov', nameEn: 'Bakikhanov', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 8 },
  { code: 'KES', name: 'Keşlə', nameEn: 'Keshla', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 9 },
  { code: 'ZAB1', name: 'Zabrat-1', nameEn: 'Zabrat-1', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 16 },
  { code: 'ZAB2', name: 'Zabrat-2', nameEn: 'Zabrat-2', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 17 },
  { code: 'MAM', name: 'Məmmədli', nameEn: 'Mammadli', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 18 },
  { code: 'PIR', name: 'Pirşağı', nameEn: 'Pirshagi', region: 'Bakı', country: 'AZ', city: 'Bakı', order: 19 }
];

module.exports = {
  DESTINATIONS,
  HOME_CARDS,
  NOTICE,
  NOTICE_TICKER,
  FAQS,
  TARIFF_PAGES,
  STATIONS_HTML,
  ROUTES_HTML,
  FARE_ROWS,
  SECTIONS,
  EXTRA_STATIONS
};
