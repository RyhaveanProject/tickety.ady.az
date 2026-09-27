const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const h = require('../utils/helpers');

/* Azərbaycan hərflərini dəstəkləyən şrift tapılmazsa transliterasiya istifadə olunur */
function findFont() {
  const candidates = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}

async function generateTicketPdf(ticket, order) {
  const qrDataUrl = await QRCode.toDataURL(
    ticket.qrData || JSON.stringify({ pnr: ticket.pnr }),
    { margin: 1, width: 220 }
  );

  const font = findFont();
  const az = font ? (s) => s : (s) => h.translit(s);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      if (font) doc.registerFont('main', font);

      const setText = (size, color) => {
        doc.fillColor(color || '#0b2a4a');
        if (font) doc.font('main').fontSize(size);
        else doc.fontSize(size);
      };

      /* Başlıq */
      doc.rect(0, 0, doc.page.width, 92).fill('#00539b');
      doc.fillColor('#ffffff');
      if (font) doc.font('main').fontSize(26); else doc.fontSize(26);
      doc.text('ADY', 40, 26);
      if (font) doc.font('main').fontSize(10); else doc.fontSize(10);
      doc.fillColor('#ffd580').text(az('Azərbaycan Dəmir Yolları QSC'), 40, 60);
      doc.fillColor('#ffffff');
      doc.text(az('Elektron bilet'), 400, 40, { width: 160, align: 'right' });

      /* PNR */
      setText(11, '#4a5b6b');
      doc.text(az('PNR kodu'), 40, 112);
      setText(20, '#00539b');
      doc.text(ticket.pnr, 40, 128);

      /* QR */
      doc.image(qrDataUrl, doc.page.width - 190, 108, { width: 150 });

      /* Marşrut */
      let y = 190;
      setText(16);
      doc.text(az(ticket.fromName + ' — ' + ticket.toName), 40, y);
      y += 30;

      const rows = [
        [az('Qatar'), ticket.trainNumber + ' · ' + az(ticket.trainTitle || '')],
        [az('Tarix'), ticket.date],
        [az('Yola düşmə'), ticket.departTime],
        [az('Çatma'), ticket.arriveTime],
        [az('Vaqon / Yer'), ticket.wagon + ' / ' + ticket.seat],
        [az('Sinif'), az(ticket.className || ticket.classCode)],
        [az('Sərnişin'), az(ticket.passengerName)],
        [az('Sənəd'), ticket.passengerDoc || '—'],
        [az('Sifariş'), order ? order.orderNo : '—'],
        [az('Məbləğ'), ticket.price.toFixed(2) + ' ₼']
      ];

      const startY = y;
      doc.moveTo(40, startY - 8).lineTo(doc.page.width - 40, startY - 8).strokeColor('#dce6f0').stroke();

      rows.forEach((r, i) => {
        const ry = startY + i * 26;
        if (i % 2 === 0) {
          doc.rect(40, ry - 6, doc.page.width - 80, 24).fill('#f5f9fd');
        }
        setText(10, '#4a5b6b');
        doc.text(r[0], 48, ry, { width: 130 });
        setText(11, '#0b2a4a');
        doc.text(String(r[1] || ''), 190, ry, { width: doc.page.width - 240 });
      });

      /* Altlıq */
      const footerY = doc.page.height - 110;
      doc.moveTo(40, footerY).lineTo(doc.page.width - 40, footerY).strokeColor('#dce6f0').stroke();
      setText(9, '#6b7c8c');
      doc.text(az('Bu bilet elektron formadadır. Yola düşməzdən əvvəl QR kodu təqdim edin.'), 40, footerY + 12, { width: doc.page.width - 80 });
      doc.text(az('Məlumat üçün: 1822 · info@ady.az · ticket.ady.az'), 40, footerY + 32, { width: doc.page.width - 80 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = { generateTicketPdf };
