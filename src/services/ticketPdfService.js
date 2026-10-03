/* ADY bilet portalı — kassa qəbzi formatında bilet PDF (image 1-ə 1:1 uyğunlaşdırılmış).
   - Tam enli mavi başlıq (ADY QSC adı, alt başlıq, "57")
   - "Elektron bilet (məxəsi qəbz) nömrəsi / E-ticket number" solda, böyük qırmızı PNR sağda
   - QR kod sağ yuxarı küncdə (sənədin üstünə düşmür)
   - Sərnişin adı və sənəd nömrəsi
   - 5 sütunlu data cədvəli (tarix, stansiyalar, çatma, e-qeydiyyat)
   - 4 sütunlu qatar/vaqon/yer/sinif cərgəsi
   - 4 sütunlu tarif/əmsal/cəmi/ödəniş cərgəsi
   - Sonda qaydalar bloku (1:1 image 1) */
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const h = require('../utils/helpers');

function findFonts() {
  const candidates = [
    { reg: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' },
    { reg: path.join(__dirname, '..', '..', 'public', 'assets', 'fonts', 'DejaVuSans.ttf'),
      bold: path.join(__dirname, '..', '..', 'public', 'assets', 'fonts', 'DejaVuSans-Bold.ttf') }
  ];
  for (const c of candidates) {
    if (fs.existsSync(c.reg) && fs.existsSync(c.bold)) return c;
  }
  return null;
}

function fmtDate(iso) {
  if (!iso) return '';
  if (iso.indexOf('-') === 2) return iso;
  if (iso.length === 10) return iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4);
  return iso;
}

function ticketQrUrl(ticket, locale) {
  const envBase = (config.siteUrl || process.env.SITE_URL || '').replace(/\/$/, '');
  const lang = locale || 'az';
  if (envBase) return envBase + '/' + lang + '/bilet-goruntule/' + ticket.pnr;
  return '/' + lang + '/bilet-goruntule/' + ticket.pnr;
}

async function generateTicketPdf(ticket, order, options) {
  const locale = (options && options.locale) || 'az';
  const qrUrl = ticketQrUrl(ticket, locale);
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { margin: 1, width: 240 });

  const fonts = findFonts();
  const az = fonts ? (s) => String(s == null ? '' : s) : (s) => h.translit(s);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (fonts) {
        doc.registerFont('main', fonts.reg);
        doc.registerFont('bold', fonts.bold);
      }

      const W = doc.page.width;
      const H = doc.page.height;
      const M = 28;
      const contentW = W - M * 2;

      const useFont = (kind, sz, color) => {
        if (fonts) doc.font(kind || 'main');
        doc.fontSize(sz);
        doc.fillColor(color || '#1f2937');
      };

      /* === 1) Başlıq zolağı (tam enli, mavi) === */
      doc.rect(0, 0, W, 64).fill('#00539b');
      doc.fillColor('#ffffff');
      useFont('bold', 13, '#ffffff');
      doc.text(
        az('"Azərbaycan Dəmir Yolları" Qapalı Səhmdar Cəmiyyətinin Sərnişin Daşımanın üzrə Avtomatlaşdırılmış İdarəetmə Sistemi'),
        M, 12, { width: contentW, align: 'center' }
      );
      useFont('main', 10, '#ffffff');
      doc.text(az('"Azərbaycan Dəmir Yolları" QSC 57'), M, 42, { width: contentW, align: 'center' });

      /* === 2) QR — sağ yuxarı künc === */
      const qrSize = 90;
      const qrX = W - M - qrSize;
      const qrY = 76;
      doc.image(qrDataUrl, qrX, qrY, { width: qrSize, height: qrSize });

      /* === 3) Qəbz № — sağda, QR-in solunda === */
      const blockY = 80;
      const leftW = 220;
      const leftX = M;
      const rightX = M + leftW + 16;
      const rightW = qrX - rightX - 6;

      useFont('bold', 10, '#1f2937');
      doc.text(az('Elektron bilet (məxəsi qəbz)'), leftX, blockY, { width: leftW });
      doc.text(az('nömrəsi'), leftX, blockY + 12, { width: leftW });
      useFont('main', 9, '#6b7280');
      doc.text('E-ticket number', leftX, blockY + 24, { width: leftW });

      useFont('bold', 32, '#dc2626');
      doc.text(String(ticket.pnr || order.orderNo || '—'), rightX, blockY + 4, { width: rightW, align: 'left' });

      /* === 4) Sərnişin === */
      const passY = blockY + 56;
      useFont('bold', 10, '#1f2937');
      doc.text(az('Sərnişinin A/A, Ata adı'), leftX, passY, { width: leftW });
      useFont('main', 9, '#6b7280');
      doc.text('Surname, name, father name', leftX, passY + 12, { width: leftW });
      useFont('bold', 12, '#dc2626');
      doc.text(az(ticket.passengerName || '—'), rightX, passY + 4, { width: rightW });

      /* === 5) Sənəd === */
      const docY = passY + 34;
      useFont('bold', 10, '#1f2937');
      doc.text(az('Şəxsiyyəti təsdiq edən sənədin'), leftX, docY, { width: leftW });
      doc.text(az('seriyası və nömrəsi'), leftX, docY + 11, { width: leftW });
      useFont('main', 9, '#6b7280');
      doc.text('Document number', leftX, docY + 23, { width: leftW });
      useFont('bold', 12, '#dc2626');
      doc.text(ticket.passengerDoc || '—', rightX, docY + 6, { width: rightW });

      /* === 6) 5 sütunlu başlıq cərgəsi === */
      const tableTop = Math.max(docY + 50, qrY + qrSize + 8);
      const cw = contentW / 5;
      doc.rect(M, tableTop, contentW, 30).fill('#dde5ef');
      const heads5 = [
        { h: 'Yola düşmə tarixi və vaxtı', s: 'Departure date/time' },
        { h: 'Yola düşmə stansiyası', s: 'Departure station' },
        { h: 'Təyinat stansiyası', s: 'Arrive station' },
        { h: 'Çatma tarixi və vaxtı', s: 'Arrival date time' },
        { h: 'Səfərlər üçün vaxt keçmə', s: 'E-registration date time' }
      ];
      heads5.forEach((c, i) => {
        useFont('bold', 8, '#1f2937');
        doc.text(az(c.h), M + i * cw + 4, tableTop + 4, { width: cw - 8 });
        useFont('main', 7, '#4b5563');
        doc.text(c.s, M + i * cw + 4, tableTop + 16, { width: cw - 8 });
      });

      /* === 7) 5 sütunlu dəyər cərgəsi === */
      const row1Y = tableTop + 30;
      doc.rect(M, row1Y, contentW, 28).strokeColor('#9ca3af').stroke();
      const depFull = (ticket.date || '') + ' ' + (ticket.arriveDate || '');
      const arrFull = (ticket.arriveDate || ticket.date || '') + ' ' + (ticket.arriveTime || '');
      const eReg = order && order.orderNo ? order.orderNo : (ticket.date || '');
      const vals5 = [
        fmtDate((ticket.date || '') + ' ' + (ticket.departTime || '')),
        az(ticket.fromName || ticket.fromCode || ''),
        az(ticket.toName || ticket.toCode || ''),
        (ticket.arriveDate && ticket.arriveDate !== ticket.date)
          ? fmtDate(ticket.arriveDate + ' ' + (ticket.arriveTime || ''))
          : fmtDate((ticket.date || '') + ' ' + (ticket.arriveTime || '')),
        eReg
      ];
      vals5.forEach((v, i) => {
        useFont('bold', 11, '#dc2626');
        doc.text(v, M + i * cw + 4, row1Y + 7, { width: cw - 8 });
      });

      /* === 8) Qatar / Vaqon / Yer / Sinif === */
      const row2Y = row1Y + 28;
      /* Eni 4 hissəyə bölürük: 1-ci daha geniş (qatar+adı) */
      const wTrain = Math.round(contentW * 0.45);
      const wEach = Math.round((contentW - wTrain) / 3);
      doc.rect(M, row2Y, contentW, 26).fill('#eef2f8');
      doc.rect(M, row2Y, contentW, 26).strokeColor('#9ca3af').stroke();
      const heads2 = [az('Qatarın nömrəsi və kateqoriyası'), az('Vaqon'), az('Yer'), az('Sinif və xidmət sinfi')];
      const trainName = ticket.trainTitle || '';
      const trainLabel = (trainName ? trainName + ' · ' : '') + (ticket.trainNumber || '');
      const sinif = ticket.className || ticket.classCode || '—';
      const vals2 = [trainLabel, String(ticket.wagon || '—'), String(ticket.seat || '—'), sinif];
      [wTrain, wEach, wEach, wEach].forEach((w, i) => {
        const x = M + (i === 0 ? 0 : (i === 1 ? wTrain : (i === 2 ? wTrain + wEach : wTrain + wEach * 2)));
        useFont('bold', 7, '#1f2937');
        doc.text(heads2[i], x + 4, row2Y + 3, { width: w - 8 });
        useFont('bold', 10, '#dc2626');
        doc.text(vals2[i], x + 4, row2Y + 13, { width: w - 8 });
      });

      /* === 9) Tarif cərgəsi === */
      const fareY = row2Y + 26;
      const wFare = Math.round(contentW * 0.27);
      const wCoef = Math.round(contentW * 0.16);
      const wTotal = Math.round(contentW * 0.27);
      const wPay = contentW - wFare - wCoef - wTotal;
      doc.rect(M, fareY, contentW, 26).fill('#dde5ef');
      const fareHeads = [
        { x: M, w: wFare, h: az('Tarif'), s: 'Fare' },
        { x: M + wFare, w: wCoef, h: az('Əmsal.Koэф'), s: 'Xidmət' },
        { x: M + wFare + wCoef, w: wTotal, h: az('Cəmi / Full price'), s: '' },
        { x: M + wFare + wCoef + wTotal, w: wPay, h: az('Ödəniş növü / Pay method'), s: '' }
      ];
      fareHeads.forEach((c) => {
        useFont('bold', 8, '#1f2937');
        doc.text(c.h, c.x + 4, fareY + 3, { width: c.w - 8 });
        if (c.s) { useFont('main', 7, '#4b5563'); doc.text(c.s, c.x + 4, fareY + 14, { width: c.w - 8 }); }
      });
      const total = ticket.price || 0;
      const pay = (order && order.method === 'balance') ? 'Balans / Balance' : 'Bank kartı / Card';
      const fareVals = [
        Number(total).toFixed(2),
        ticket.classCode === 'first' ? '× 1' : ticket.classCode === 'business' ? '× 0.75' : '× 0.5',
        Number(total).toFixed(2) + ' AZN',
        pay
      ];
      doc.rect(M, fareY + 26, contentW, 26).strokeColor('#9ca3af').stroke();
      fareHeads.forEach((c, i) => {
        useFont('bold', 11, '#dc2626');
        doc.text(fareVals[i], c.x + 4, fareY + 32, { width: c.w - 8 });
      });

      /* === 10) Qaydalar bloku === */
      const rulesTop = fareY + 52;
      const rulesH = H - M - rulesTop;
      doc.rect(M, rulesTop, contentW, rulesH).strokeColor('#9ca3af').stroke();
      doc.fillColor('#ffffff').rect(M + 0.5, rulesTop + 0.5, contentW - 1, rulesH - 1).fill();

      const ruleLines = [
        az('Elektron bilet çap edin və ya mobil cihazınızda yaddaşında saxlayın.'),
        'Print the electronic ticket or save it on your mobile device.',
        az('Qatarı qeydiyyatdan keçirmək üçün sərnişinin istifadəsinə verilmiş pasportunuza sahib şəxs məlumatlar olmalıdır.'),
        'During check-in, the original international passport specified on the ticket must be presented.',
        az('1 Yanvar 2026-cı ildən etibarən Gürcüstana daxil olan sərnişinlər üçün şəxsiyyət vəsiqəsi ilə səyahət etmək olmaz.'),
        'Starting from January 1, 2026, Travel insurance is required for foreign citizens entering Georgia.',
        '',
        az('Qeydiyyat qatarın yola düşməsindən 1 (bir) saat əvvəl başlayır və yola düşməsindən 10 (on) dəqiqə əvvəl qurtarır.'),
        'Check-in starts 1 hour before the train departure and ends 10 minutes before departure.',
        '',
        az('Üç yaşına qədər sərnişin: Standart 36 kq, Comfort 23 kq, Birinci sinif 30 kq.'),
        'Hand luggage weight allowance: Standard — 36 kg, Comfort — 23 kg, First class — 30 kg.',
        az('Komfort sinfində və Luks sinif üçün ayrıca yer olunması qənnanidır. 100 cm-dən (40 + 42 + 28 sm) yığış çantaya malik olmalıdır.'),
        'For Comfort, Comfort+ and Luxury class coaches, the total dimensions of carry-on luggage (height + width + height) must not exceed 130 cm (60 + 42 + 28 cm).',
        az('Standart sinfi üçün sərnişinlərə də yükləri bilməklə 100 cm-dən artıq qadağandır.'),
        'For Standart class coaches, the total dimensions of carry-on luggage (height + width + height) must not exceed 100 cm.',
        az('Beynəlxalq bilet qaytarma şərtlərinə uyğun olaraq 20 AZN məbləğdə xidmət haqqı tutulur.'),
        'When an international ticket is refunded, a service fee of 20 AZN is charged.'
      ];

      let yy = rulesTop + 6;
      ruleLines.forEach((line) => {
        if (yy > H - M - 4) return;
        if (!line) { yy += 3; return; }
        useFont('main', 8, '#1f2937');
        doc.text(line, M + 6, yy, { width: contentW - 12 });
        yy = doc.y + 1;
      });

      /* Altlıq */
      useFont('main', 7, '#6b7280');
      doc.text(az('Bu bilet elektron formadadır. Yola düşməzdən əvvəl QR kodu təqdim edin. · ') + qrUrl, M, H - M + 2, { width: contentW, align: 'center' });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateTicketPdf, ticketQrUrl };
