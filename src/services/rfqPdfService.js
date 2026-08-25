const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class RfqPdfService {
  /**
   * Generates a formal, black & white / grayscale enterprise RFQ proposal document
   * strictly formatted to fit on a single A4 page, and pipes it directly to the Express response stream.
   */
  generatePdf(rfqData, resStream) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 24, bottom: 20, left: 26, right: 26 },
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title: `Satın Alma Teklif Formu - ${rfqData.rfqNo || 'RFQ'}`,
        Author: 'Enterprise ERP System',
        Subject: 'RFQ Satın Alma Teklif ve Değerlendirme Belgesi'
      }
    });

    const fontRegular = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
    const fontBold = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf';
    const fontItalic = '/usr/share/fonts/truetype/liberation/LiberationSans-Italic.ttf';

    if (fs.existsSync(fontRegular)) {
      doc.registerFont('Regular', fontRegular);
      doc.registerFont('Bold', fontBold);
      doc.registerFont('Italic', fontItalic);
    } else {
      doc.registerFont('Regular', 'Helvetica');
      doc.registerFont('Bold', 'Helvetica-Bold');
      doc.registerFont('Italic', 'Helvetica-Oblique');
    }

    doc.pipe(resStream);

    const startX = 26;
    const pageWidth = 543.28; // 595.28 - (26 * 2)
    let currentY = 24;

    // ==================== 1. TOP HEADER & COMPANY / DOCUMENT BOX ====================
    doc.lineWidth(1.5).rect(startX, currentY, pageWidth, 66).stroke('#000000');
    doc.lineWidth(0.5).rect(startX + 2, currentY + 2, pageWidth - 4, 62).stroke('#000000');

    // Left: Company Info
    doc.font('Bold').fontSize(11).fillColor('#000000')
       .text('ENTERPRISE ERP SANAYİ VE TİCARET A.Ş.', startX + 10, currentY + 8, { width: 330 });
    doc.font('Regular').fontSize(7.5).fillColor('#333333')
       .text('Satın Alma, Tedarik Zinciri ve Malzeme Yönetimi Direktörlüğü', startX + 10, currentY + 22)
       .text('Organize Sanayi Bölgesi 4. Cadde No:12 / İstanbul • Tel: +90 (212) 555 0100', startX + 10, currentY + 33)
       .text('Vergi Dairesi: Marmara Kurumlar • VKN: 3450987612 • Web: www.enterprise-erp.com', startX + 10, currentY + 44);

    // Vertical divider
    doc.lineWidth(1).moveTo(startX + 355, currentY).lineTo(startX + 355, currentY + 66).stroke('#000000');

    // Right: Document Meta
    const rightX = startX + 360;
    doc.font('Bold').fontSize(8.5).fillColor('#000000')
       .text('SATIN ALMA TEKLİF FORMU', rightX, currentY + 6, { width: 175, align: 'center' });
    doc.lineWidth(0.5).moveTo(rightX, currentY + 17).lineTo(startX + pageWidth - 4, currentY + 17).stroke('#666666');

    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text('Teklif No:', rightX + 4, currentY + 21)
       .text('Tarih:', rightX + 4, currentY + 32)
       .text('Geçerlilik:', rightX + 4, currentY + 43)
       .text('Durum:', rightX + 4, currentY + 54);

    const statusLabel = rfqData.status === 'Accepted'
      ? 'KABUL EDİLDİ (SİPARİŞ)'
      : (rfqData.status === 'Rejected' ? 'REDDEDİLDİ' : 'BEKLEMEDE (ALINDI)');

    doc.font('Regular').fontSize(7.5).fillColor('#000000')
       .text(rfqData.rfqNo || 'RFQ-2026-0001', rightX + 58, currentY + 21)
       .text(rfqData.rfqDate || (rfqData.createdAt ? new Date(rfqData.createdAt).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR')), rightX + 58, currentY + 32)
       .text(rfqData.validUntil ? new Date(rfqData.validUntil).toLocaleDateString('tr-TR') : '—', rightX + 58, currentY + 43);
    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text(statusLabel, rightX + 58, currentY + 54);

    currentY += 71;

    // Helper: Section Banner
    function drawSectionHeader(title, y) {
      doc.lineWidth(1).rect(startX, y, pageWidth, 14).fillAndStroke('#000000', '#000000');
      doc.font('Bold').fontSize(8).fillColor('#FFFFFF').text(title, startX + 8, y + 3);
      return y + 15;
    }

    // ==================== 2. TEDARİKÇİ VE FİRMA BİLGİLERİ ====================
    currentY = drawSectionHeader('1. TEDARİKÇİ VE FİRMA BİLGİLERİ', currentY);

    const supplierBoxHeight = 56;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, supplierBoxHeight).stroke('#000000');
    doc.lineWidth(0.5).moveTo(startX + 270, currentY).lineTo(startX + 270, currentY + supplierBoxHeight).stroke('#CCCCCC');

    const sup = rfqData.tedarikci || rfqData.supplier || {};
    const sLeftX = startX + 6;
    const sRightX = startX + 276;

    // Left Column
    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text('Firma Unvanı:', sLeftX, currentY + 4)
       .text('Ticari / Kısa Ad:', sLeftX, currentY + 14)
       .text('Tedarikçi Kodu:', sLeftX, currentY + 24)
       .text('Vergi No / Dairesi:', sLeftX, currentY + 34)
       .text('Performans Skoru:', sLeftX, currentY + 44);

    doc.font('Regular').fontSize(7.5).fillColor('#111111')
       .text(rfqData.supplierName || sup.firmaAdi || '—', sLeftX + 85, currentY + 4, { width: 175 })
       .text(sup.ticariAd || rfqData.supplierName || '—', sLeftX + 85, currentY + 14)
       .text(rfqData.supplierCode || sup.tedarikciKodu || 'TED-000', sLeftX + 85, currentY + 24)
       .text(`${sup.vergiNo || rfqData.supplierTaxNo || '—'} / ${sup.vergiDairesi || rfqData.supplierTaxOffice || '—'}`, sLeftX + 85, currentY + 34)
       .text(`${sup.performansSkoru || rfqData.supplierRating || 85} / 100 (Kalite: %${sup.kaliteSkoru || 85})`, sLeftX + 85, currentY + 44);

    // Right Column
    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text('Satış Temsilcisi:', sRightX, currentY + 4)
       .text('Telefon / GSM:', sRightX, currentY + 14)
       .text('E-posta:', sRightX, currentY + 24)
       .text('Adres & Şehir:', sRightX, currentY + 34)
       .text('Banka / IBAN:', sRightX, currentY + 44);

    doc.font('Regular').fontSize(7.5).fillColor('#111111')
       .text(sup.ilgiliKisi || 'Firma Satış Temsilcisi', sRightX + 75, currentY + 4)
       .text(`${sup.telefon || '—'} / ${sup.gsm || '—'}`, sRightX + 75, currentY + 14)
       .text(sup.eposta || '—', sRightX + 75, currentY + 24)
       .text(`${sup.adres || '—'}, ${sup.sehir || rfqData.supplierCity || '—'} / ${sup.ulke || 'Türkiye'}`, sRightX + 75, currentY + 34, { width: 180 })
       .text(sup.bankaBilgileri || 'TR------------------------', sRightX + 75, currentY + 44, { width: 180 });

    currentY += supplierBoxHeight + 5;

    // ==================== 3. TİCARİ VE TESLİMAT ŞARTLARI ====================
    currentY = drawSectionHeader('2. TİCARİ VE TESLİMAT ŞARTLARI', currentY);

    const termsBoxHeight = 28;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, termsBoxHeight).stroke('#000000');

    // 4 columns
    const colW = pageWidth / 4;
    for (let i = 1; i < 4; i++) {
      doc.lineWidth(0.5).moveTo(startX + (i * colW), currentY).lineTo(startX + (i * colW), currentY + termsBoxHeight).stroke('#CCCCCC');
    }

    // Col 1: Delivery Days
    doc.font('Bold').fontSize(6.8).fillColor('#555555').text('TESLİM SÜRESİ', startX + 6, currentY + 3);
    doc.font('Bold').fontSize(8).fillColor('#000000').text(`${rfqData.deliveryDays || 5} İş Günü`, startX + 6, currentY + 14);

    // Col 2: Payment Term
    const termFormatted = rfqData.paymentTerm === 'Pesin'
      ? 'Peşin Ödeme'
      : (rfqData.paymentTerm === 'Vadeli_30'
        ? '30 Gün Vadeli'
        : (rfqData.paymentTerm === 'Vadeli_60'
          ? '60 Gün Vadeli'
          : (rfqData.paymentTerm === 'Vadeli_90' ? '90 Gün Vadeli' : (rfqData.paymentTerm || '30 Gün Vadeli'))));

    doc.font('Bold').fontSize(6.8).fillColor('#555555').text('ÖDEME VADESİ', startX + colW + 6, currentY + 3);
    doc.font('Bold').fontSize(8).fillColor('#000000').text(termFormatted, startX + colW + 6, currentY + 14);

    // Col 3: Delivery Place
    doc.font('Bold').fontSize(6.8).fillColor('#555555').text('TESLİM YERİ / AMBAR', startX + (2 * colW) + 6, currentY + 3);
    doc.font('Bold').fontSize(8).fillColor('#000000').text(rfqData.deliveryPlace || 'Ana Hammadde Ambarı', startX + (2 * colW) + 6, currentY + 14, { width: colW - 12 });

    // Col 4: Currency & VAT Status
    doc.font('Bold').fontSize(6.8).fillColor('#555555').text('PARA BİRİMİ & KDV', startX + (3 * colW) + 6, currentY + 3);
    doc.font('Bold').fontSize(8).fillColor('#000000').text(`${rfqData.currency || 'TRY'} • KDV ${rfqData.vatStatus || 'Hariç'}`, startX + (3 * colW) + 6, currentY + 14);

    currentY += termsBoxHeight + 5;

    // ==================== 4. TEKLİF KALEMLERİ VE FİYAT TABLOSU ====================
    currentY = drawSectionHeader('3. TEKLİF KALEMLERİ VE FİYAT DETAYLARI', currentY);

    const tableCols = [
      { key: 'index', label: '#', width: 22, align: 'center' },
      { key: 'reqNo', label: 'Talep No', width: 72, align: 'left' },
      { key: 'code', label: 'Malzeme Kodu', width: 66, align: 'left' },
      { key: 'name', label: 'Malzeme Adı / Açıklama', width: 132, align: 'left' },
      { key: 'reqQty', label: 'Talep', width: 40, align: 'right' },
      { key: 'offQty', label: 'Teklif', width: 40, align: 'right' },
      { key: 'unit', label: 'Birim', width: 30, align: 'center' },
      { key: 'price', label: 'Birim Fiyat', width: 50, align: 'right' },
      { key: 'disc', label: 'İsk.', width: 28, align: 'center' },
      { key: 'vat', label: 'KDV', width: 28, align: 'center' },
      { key: 'total', label: 'Net Tutar', width: 67.28, align: 'right' }
    ];

    // Table Header
    const thHeight = 15;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, thHeight).fillAndStroke('#E5E7EB', '#000000');

    let curX = startX;
    tableCols.forEach(col => {
      doc.font('Bold').fontSize(6.8).fillColor('#000000')
         .text(col.label, curX + 2, currentY + 3.5, { width: col.width - 4, align: col.align });
      curX += col.width;
    });

    currentY += thHeight;

    // Table Rows
    const items = (rfqData.itemsData && Array.isArray(rfqData.itemsData) && rfqData.itemsData.length > 0)
      ? rfqData.itemsData
      : (rfqData.stokKarti ? [{
          talepNo: 'TALEP-001',
          stokKodu: rfqData.stokKarti.stokKodu,
          ad: rfqData.stokKarti.ad,
          talepEdilenMiktar: rfqData.talepEdilenMiktar || 1,
          teklifEdilenMiktar: rfqData.talepEdilenMiktar || 1,
          birim: rfqData.stokKarti.birim || 'Adet',
          birimFiyat: rfqData.teklifEdilenBirimFiyat || 0,
          iskontoOrani: 0,
          kdvOrani: 20,
          netAmount: rfqData.totalPrice || 0
        }] : []);

    const rowHeight = 16;
    const currSymbol = rfqData.currency === 'USD' ? '$' : (rfqData.currency === 'EUR' ? '€' : '₺');

    items.forEach((it, idx) => {
      doc.lineWidth(0.5).rect(startX, currentY, pageWidth, rowHeight).stroke('#000000');

      let x = startX;
      const linePrice = parseFloat(it.birimFiyat || it.unitPrice || 0);
      const lineReqQty = parseFloat(it.talepEdilenMiktar || it.requestedQuantity || it.teklifEdilenMiktar || 1);
      const lineOffQty = parseFloat(it.teklifEdilenMiktar || it.miktar || it.quantity || 1);
      const lineDisc = parseFloat(it.iskontoOrani || it.discountRate || 0);
      const lineVat = parseFloat(it.kdvOrani || it.vatRate || 20);
      const lineNet = parseFloat(it.netAmount || it.netTutar || (lineOffQty * linePrice * (1 - lineDisc / 100)));

      const rowVals = [
        { val: (idx + 1).toString(), width: 22, align: 'center', bold: false },
        { val: it.talepNo || ('TALEP-#' + (it.talepId || '1')), width: 72, align: 'left', bold: true },
        { val: it.stokKodu || it.stockCode || 'STK-000', width: 66, align: 'left', bold: false },
        { val: it.ad || it.productName || 'Malzeme', width: 132, align: 'left', bold: true },
        { val: lineReqQty.toLocaleString('tr-TR'), width: 40, align: 'right', bold: false },
        { val: lineOffQty.toLocaleString('tr-TR'), width: 40, align: 'right', bold: true },
        { val: it.birim || it.unit || 'Adet', width: 30, align: 'center', bold: false },
        { val: `${linePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, width: 50, align: 'right', bold: false },
        { val: lineDisc > 0 ? `%${lineDisc}` : '%0', width: 28, align: 'center', bold: false },
        { val: `%${lineVat}`, width: 28, align: 'center', bold: false },
        { val: `${lineNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, width: 67.28, align: 'right', bold: true }
      ];

      rowVals.forEach(cell => {
        doc.font(cell.bold ? 'Bold' : 'Regular').fontSize(7).fillColor('#000000')
           .text(cell.val, x + 2, currentY + 4, { width: cell.width - 4, align: cell.align });
        x += cell.width;
      });

      currentY += rowHeight;
    });

    currentY += 5;

    // ==================== 5. MALİ ÖZET & NOTLAR ====================
    const summaryBoxWidth = 230;
    const summaryBoxHeight = 58;
    const notesBoxWidth = pageWidth - summaryBoxWidth - 8;

    // Left: Notes Box
    doc.lineWidth(0.75).rect(startX, currentY, notesBoxWidth, summaryBoxHeight).stroke('#000000');
    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text('TEKLİF NOTLARI VE TİCARİ AÇIKLAMALAR:', startX + 6, currentY + 5);
    doc.font('Regular').fontSize(7.2).fillColor('#222222')
       .text(rfqData.notes || 'İşbu teklif yukarıda belirtilen şartlar ve geçerlilik süresi dahilinde geçerlidir. Malzemeler ambar teslimi kabul kriterlerine uygun olarak teslim edilecektir.', startX + 6, currentY + 16, { width: notesBoxWidth - 12 });

    if (rfqData.currency !== 'TRY' && rfqData.currency !== 'TL') {
      doc.font('Bold').fontSize(7).fillColor('#000000')
         .text(`💱 Kur Bilgisi: 1 ${rfqData.currency} = ₺ ${(rfqData.exchangeRate || 1).toFixed(4)} | TL Hacmi: ₺ ${(rfqData.totalPriceTRY || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`, startX + 6, currentY + 44, { width: notesBoxWidth - 12 });
    }

    // Right: Financial Totals Box
    const sumX = startX + notesBoxWidth + 8;
    doc.lineWidth(1).rect(sumX, currentY, summaryBoxWidth, summaryBoxHeight).stroke('#000000');

    const subtotal = parseFloat(rfqData.subtotal || 0);
    const discount = parseFloat(rfqData.discount || 0);
    const vat = parseFloat(rfqData.vat || 0);
    const grandTotal = parseFloat(rfqData.totalPrice || 0);

    doc.font('Regular').fontSize(7.5).fillColor('#000000')
       .text('Ara Toplam:', sumX + 8, currentY + 5)
       .text('Toplam İskonto:', sumX + 8, currentY + 16)
       .text('Hesaplanan KDV:', sumX + 8, currentY + 27);

    doc.font('Bold').fontSize(7.5).fillColor('#000000')
       .text(`${subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, sumX + 110, currentY + 5, { width: 110, align: 'right' })
       .text(`-${discount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, sumX + 110, currentY + 16, { width: 110, align: 'right' })
       .text(`+${vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, sumX + 110, currentY + 27, { width: 110, align: 'right' });

    // Grand Total Line
    doc.lineWidth(0.75).moveTo(sumX + 4, currentY + 38).lineTo(sumX + summaryBoxWidth - 4, currentY + 38).stroke('#000000');
    doc.font('Bold').fontSize(9).fillColor('#000000')
       .text('GENEL TOPLAM:', sumX + 8, currentY + 42)
       .text(`${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}`, sumX + 90, currentY + 42, { width: 130, align: 'right' });

    currentY += summaryBoxHeight + 8;

    // ==================== 6. ONAY VE İMZA ALANI ====================
    currentY = drawSectionHeader('4. ONAY VE İMZA ALANI', currentY);

    const signBoxHeight = 52;
    const signColWidth = (pageWidth - 10) / 3;

    for (let i = 0; i < 3; i++) {
      const sBoxX = startX + (i * (signColWidth + 5));
      doc.lineWidth(0.75).rect(sBoxX, currentY, signColWidth, signBoxHeight).stroke('#000000');

      let signTitle = '';
      let signSub = '';
      if (i === 0) {
        signTitle = 'Tedarikçi Firma Yetkilisi';
        signSub = 'Kaşe / İmza / Tarih';
      } else if (i === 1) {
        signTitle = 'Satın Alma Sorumlusu';
        signSub = 'İnceleyen & Onaylayan';
      } else {
        signTitle = 'Satın Alma / Fabrika Müdürü';
        signSub = 'Yönetim Onayı / İmza';
      }

      doc.font('Bold').fontSize(7.5).fillColor('#000000').text(signTitle, sBoxX + 4, currentY + 4, { width: signColWidth - 8, align: 'center' });
      doc.font('Regular').fontSize(6.5).fillColor('#555555').text(signSub, sBoxX + 4, currentY + 14, { width: signColWidth - 8, align: 'center' });
      doc.lineWidth(0.5).moveTo(sBoxX + 14, currentY + 39).lineTo(sBoxX + signColWidth - 14, currentY + 39).stroke('#888888');
      doc.font('Italic').fontSize(6).fillColor('#666666').text('İmza', sBoxX + 4, currentY + 41, { width: signColWidth - 8, align: 'center' });
    }

    // ==================== 7. FOOTER ====================
    doc.font('Regular').fontSize(6.5).fillColor('#555555')
       .text(`İşbu belge Enterprise ERP Kurumsal Bilgi Sistemi tarafından elektronik olarak üretilmiştir. • Belge Referansı: ${rfqData.rfqNo} • Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, startX, 790, { width: pageWidth, align: 'center', lineBreak: false });

    doc.end();
  }
}

module.exports = new RfqPdfService();
