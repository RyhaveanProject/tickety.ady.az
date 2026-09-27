const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { transliterate } = require('../utils/helpers');
const config = require('../config');

/**
 * Bilet PDF-i yaradır.
 * Azərbaycan hərfləri (ə, ı, ğ, ş, ç, ö, ü) üçün DejaVu Sans şrifti
 * layihə daxilindən (public/assets/fonts) istifadə olunur. Şrift tapılmasa,
 * köhnə davranışa (Helvetica + transliterasiya) keçir.
 */
const FONT_DIRS = [
  path.join(__dirname, '..', '..', 'public', 'assets', 'fonts'),
  '/usr/share/fonts/truetype/dejavu'
];

function locateFont(fileName) {
  for (let i = 0; i < FONT_DIRS.length; i++) {
    const p = path.join(FONT_DIRS[i], fileName);
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) { /* davam et */ }
  }
  return null;
}

const REG_PATH = locateFont('DejaVuSans.ttf');
const BOLD_PATH = locateFont('DejaVuSans-Bold.ttf');
const HAS_UNICODE = Boolean(REG_PATH && BOLD_PATH);

const F = HAS_UNICODE ? 'Ady' : 'Helvetica';
const FB = HAS_UNICODE ? 'AdyBold' : 'Helvetica-Bold';

function tx(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return HAS_UNICODE ? s : transliterate(s);
}

async function generateTicketPdf(order, tickets) {
  return new Promise(async (resolve, reject) => {
    try {
      const W = 595.28;
      const H = 420;
      const doc = new PDFDocument({ size: [W, H], margin: 0 });

      if (HAS_UNICODE) {
        doc.registerFont('Ady', REG_PATH);
        doc.registerFont('AdyBold', BOLD_PATH);
      }

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (let i = 0; i < tickets.length; i++) {
        const t = tickets[i];
        if (i > 0) doc.addPage({ size: [W, H], margin: 0 });

        // Fon
        doc.rect(0, 0, W, H).fill('#ffffff');
        doc.rect(0, 0, W, 74).fill('#00539b');
        doc.rect(0, 74, W, 4).fill('#f2a900');

        // Başlıq
        doc.fillColor('#ffffff').font(FB).fontSize(20).text('ADY', 30, 22);
        doc.font(F).fontSize(9).text(tx('Azərbaycan Dəmir Yolları QSC'), 30, 46);
        doc.font(FB).fontSize(12).text(tx('Elektron bilet / Electronic ticket'), W - 330, 30, { width: 300, align: 'right' });
        doc.font(F).fontSize(9).text('ticket.ady.az', W - 330, 48, { width: 300, align: 'right' });

        // QR kod
        const qrDataUrl = await QRCode.toDataURL(t.qrData || t.pnr, { margin: 1, width: 220 });
        const qrBuf = Buffer.from(qrDataUrl.split(',')[1], 'base64');
        doc.image(qrBuf, W - 150, 100, { width: 120, height: 120 });
        doc.font(F).fontSize(8).fillColor('#555').text('PNR: ' + t.pnr, W - 150, 224, { width: 120, align: 'center' });

        // Marşrut
        doc.fillColor('#00539b').font(FB).fontSize(16);
        doc.text(tx(order.fromName), 30, 100, { width: 240 });
        doc.fillColor('#f2a900').fontSize(13).text('>', 0, 104, { width: W - 30, align: 'left' });
        doc.fillColor('#00539b').text(tx(order.toName), 30, 124, { width: 240 });
        doc.fillColor('#666').font(F).fontSize(10).text(tx('Marşrut / Route'), 30, 148);

        // Cədvəl
        const rows = [
          [tx('Qatar / Train'), order.trainNumber + '  ' + tx(order.trainTitle || '')],
          [tx('Tarix / Date'), order.date],
          [tx('Yola düşmə / Departure'), order.departTime],
          [tx('Çatma / Arrival'), order.arriveTime],
          [tx('Vaqon / Coach'), String(t.wagon)],
          [tx('Yer / Seat'), String(t.seat)],
          [tx('Sinif / Class'), tx(t.className || t.classCode)],
          [tx('Sərnişin / Passenger'), tx(t.passengerName)],
          [tx('Sənəd / Document'), tx(t.docNumber)],
          [tx('Qiymət / Price'), t.price.toFixed(2) + ' AZN']
        ];

        let y = 178;
        doc.fontSize(9);
        rows.forEach((row, idx) => {
          if (idx % 2 === 0) doc.rect(30, y - 3, 400, 17).fill('#f4f7fb');
          doc.fillColor('#667').font(F).text(row[0], 36, y, { width: 150 });
          doc.fillColor('#111').font(FB).text(String(row[1]), 190, y, { width: 240 });
          y += 17;
        });

        // Alt hissə
        doc.rect(0, H - 46, W, 46).fill('#eef3f9');
        doc.fillColor('#555').font(F).fontSize(7.5).text(
          tx('Sifariş / Order: ') + order.orderNo + tx('   |   Ümumi məbləğ / Total: ') +
          order.total.toFixed(2) + ' AZN   |   ' + config.site.supportPhone +
          '   |   ' + config.site.supportEmail,
          30, H - 32, { width: W - 60, align: 'center' }
        );

        // Kəsik xətti
        doc.dash(3, { space: 3 }).moveTo(W - 30, 90).lineTo(W - 30, H - 60).stroke('#ccc').undash();
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateTicketPdf, HAS_UNICODE };
