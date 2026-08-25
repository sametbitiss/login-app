const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class RfqPdfService {
  /**
   * Generates a formal, black & white / grayscale enterprise RFQ proposal document
   * strictly formatted to fill the full A4 page harmoniously with zero text overlap,
   * wide warehouse column, and pipes it directly to the Express response stream.
   */
  generatePdf(rfqData, resStream) {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 32, bottom: 28, left: 32, right: 32 },
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

    const startX = 32;
    const pageWidth = 531.28; // 595.28 - 64
    let currentY = 32;

    // Currency Display (Use TL for Turkish Lira to avoid font glyph issues, $ for USD, EUR for EUR)
    const currCode = rfqData.currency || 'TRY';
    const currDisplay = (currCode === 'TRY' || currCode === 'TL') ? 'TL' : (currCode === 'USD' ? '$' : (currCode === 'EUR' ? 'EUR' : currCode));

    // ==================== 1. TOP HEADER & COMPANY / DOCUMENT BOX ====================
    const headerHeight = 84;
    doc.lineWidth(1.5).rect(startX, currentY, pageWidth, headerHeight).stroke('#000000');
    doc.lineWidth(0.5).rect(startX + 2.5, currentY + 2.5, pageWidth - 5, headerHeight - 5).stroke('#000000');

    // Left: Company Info
    doc.font('Bold').fontSize(12.5).fillColor('#000000')
      .text('ENTERPRISE ERP SANAYİ VE TİCARET A.Ş.', startX + 14, currentY + 12, { width: 330, lineBreak: false, ellipsis: true });
    doc.font('Regular').fontSize(8.5).fillColor('#333333')
      .text('Satın Alma, Tedarik Zinciri ve Malzeme Yönetimi Direktörlüğü', startX + 14, currentY + 30, { width: 330, lineBreak: false })
      .text('Organize Sanayi Bölgesi 4. Cadde No:12 / İstanbul • Tel: +90 (212) 555 0100', startX + 14, currentY + 44, { width: 330, lineBreak: false })
      .text('Vergi Dairesi: Marmara Kurumlar • VKN: 3450987612 • Web: www.enterprise-erp.com', startX + 14, currentY + 58, { width: 330, lineBreak: false });

    // Vertical divider
    doc.lineWidth(1).moveTo(startX + 352, currentY).lineTo(startX + 352, currentY + headerHeight).stroke('#000000');

    // Right: Document Meta Box
    const rightX = startX + 356;
    const metaValX = rightX + 66;
    const metaValW = (startX + pageWidth - 6) - metaValX;

    doc.font('Bold').fontSize(9.5).fillColor('#000000')
      .text('SATIN ALMA TEKLİF FORMU', rightX, currentY + 8, { width: 170, align: 'center' });
    doc.lineWidth(0.75).moveTo(rightX + 6, currentY + 22).lineTo(startX + pageWidth - 6, currentY + 22).stroke('#000000');

    doc.font('Bold').fontSize(8).fillColor('#000000')
      .text('Teklif No:', rightX + 8, currentY + 27)
      .text('Tarih:', rightX + 8, currentY + 41)
      .text('Geçerlilik:', rightX + 8, currentY + 55)
      .text('Durum:', rightX + 8, currentY + 69);

    const statusLabel = rfqData.status === 'Accepted'
      ? 'KABUL EDİLDİ (SİPARİŞ)'
      : (rfqData.status === 'Rejected' ? 'REDDEDİLDİ' : 'BEKLEMEDE (ALINDI)');

    doc.font('Regular').fontSize(8).fillColor('#000000')
      .text(rfqData.rfqNo || 'RFQ-2026-0001', metaValX, currentY + 27, { width: metaValW, lineBreak: false, ellipsis: true })
      .text(rfqData.rfqDate || (rfqData.createdAt ? new Date(rfqData.createdAt).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR')), metaValX, currentY + 41, { width: metaValW, lineBreak: false })
      .text(rfqData.validUntil ? new Date(rfqData.validUntil).toLocaleDateString('tr-TR') : '—', metaValX, currentY + 55, { width: metaValW, lineBreak: false });
    doc.font('Bold').fontSize(8).fillColor('#000000')
      .text(statusLabel, metaValX, currentY + 69, { width: metaValW, lineBreak: false, ellipsis: true });

    currentY += headerHeight + 14;

    // Helper: Section Banner
    function drawSectionHeader(title, y) {
      doc.lineWidth(1).rect(startX, y, pageWidth, 17).fillAndStroke('#000000', '#000000');
      doc.font('Bold').fontSize(8.5).fillColor('#FFFFFF').text(title, startX + 10, y + 4.5);
      return y + 17;
    }

    // ==================== 2. TEDARİKÇİ VE FİRMA BİLGİLERİ ====================
    currentY = drawSectionHeader('1. TEDARİKÇİ VE FİRMA BİLGİLERİ', currentY);

    const supplierBoxHeight = 84;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, supplierBoxHeight).stroke('#000000');
    doc.lineWidth(0.5).moveTo(startX + 265, currentY).lineTo(startX + 265, currentY + supplierBoxHeight).stroke('#CCCCCC');

    const sup = rfqData.tedarikci || rfqData.supplier || {};
    const sLeftX = startX + 10;
    const sRightX = startX + 275;

    // 4 rows with 19 pt height per row
    // Row 1
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Firma Unvanı:', sLeftX, currentY + 8);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(rfqData.supplierName || sup.firmaAdi || '—', sLeftX + 85, currentY + 8, { width: 165, lineBreak: false, ellipsis: true });
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Satış Yetkilisi:', sRightX, currentY + 8);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(sup.ilgiliKisi || 'Firma Satış Temsilcisi', sRightX + 85, currentY + 8, { width: 165, lineBreak: false, ellipsis: true });

    // Row 2
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Tedarikçi Kodu:', sLeftX, currentY + 26);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(rfqData.supplierCode || sup.tedarikciKodu || 'TED-000', sLeftX + 85, currentY + 26, { width: 165, lineBreak: false, ellipsis: true });
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Telefon / GSM:', sRightX, currentY + 26);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(`${sup.telefon || '—'} / ${sup.gsm || '—'}`, sRightX + 85, currentY + 26, { width: 165, lineBreak: false, ellipsis: true });

    // Row 3
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Vergi No / VD:', sLeftX, currentY + 44);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(`${sup.vergiNo || rfqData.supplierTaxNo || '—'} / ${sup.vergiDairesi || rfqData.supplierTaxOffice || '—'}`, sLeftX + 85, currentY + 44, { width: 165, lineBreak: false, ellipsis: true });
    doc.font('Bold').fontSize(8).fillColor('#000000').text('E-posta Adresi:', sRightX, currentY + 44);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(sup.eposta || '—', sRightX + 85, currentY + 44, { width: 165, lineBreak: false, ellipsis: true });

    // Row 4
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Kalite & Skor:', sLeftX, currentY + 62);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(`${sup.performansSkoru || rfqData.supplierRating || 85} / 100 (Kalite Notu: %${sup.kaliteSkoru || 85})`, sLeftX + 85, currentY + 62, { width: 165, lineBreak: false, ellipsis: true });
    doc.font('Bold').fontSize(8).fillColor('#000000').text('Adres & Şehir:', sRightX, currentY + 62);
    doc.font('Regular').fontSize(8).fillColor('#111111').text(`${sup.adres || '—'}, ${sup.sehir || rfqData.supplierCity || '—'} / ${sup.ulke || 'Türkiye'}`, sRightX + 85, currentY + 62, { width: 165, lineBreak: false, ellipsis: true });

    currentY += supplierBoxHeight + 14;

    // ==================== 3. TİCARİ VE TESLİMAT ŞARTLARI ====================
    currentY = drawSectionHeader('2. TİCARİ VE TESLİMAT ŞARTLARI', currentY);

    const termsBoxHeight = 48;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, termsBoxHeight).stroke('#000000');

    // Proportionate Columns: 100pt + 115pt + 185pt + 131.28pt = 531.28pt
    const termsCols = [
      { w: 100, x: startX },
      { w: 115, x: startX + 100 },
      { w: 185, x: startX + 215 },
      { w: 131.28, x: startX + 400 }
    ];

    // Draw dividers
    for (let i = 1; i < 4; i++) {
      doc.lineWidth(0.5).moveTo(termsCols[i].x, currentY).lineTo(termsCols[i].x, currentY + termsBoxHeight).stroke('#CCCCCC');
    }

    // Col 1: Delivery Days
    doc.font('Bold').fontSize(7.2).fillColor('#555555').text('TESLİM SÜRESİ', termsCols[0].x + 8, currentY + 7, { width: termsCols[0].w - 16, lineBreak: false });
    doc.font('Bold').fontSize(9).fillColor('#000000').text(`${rfqData.deliveryDays || 5} İş Günü`, termsCols[0].x + 8, currentY + 23, { width: termsCols[0].w - 16, lineBreak: false, ellipsis: true });

    // Col 2: Payment Term
    const termFormatted = rfqData.paymentTerm === 'Pesin'
      ? 'Peşin Ödeme'
      : (rfqData.paymentTerm === 'Vadeli_30'
        ? '30 Gün Vadeli'
        : (rfqData.paymentTerm === 'Vadeli_60'
          ? '60 Gün Vadeli'
          : (rfqData.paymentTerm === 'Vadeli_90' ? '90 Gün Vadeli' : (rfqData.paymentTerm || '30 Gün Vadeli'))));

    doc.font('Bold').fontSize(7.2).fillColor('#555555').text('ÖDEME VADESİ', termsCols[1].x + 8, currentY + 7, { width: termsCols[1].w - 16, lineBreak: false });
    doc.font('Bold').fontSize(9).fillColor('#000000').text(termFormatted, termsCols[1].x + 8, currentY + 23, { width: termsCols[1].w - 16, lineBreak: false, ellipsis: true });

    // Col 3: Delivery Place (WIDE 185pt COLUMN - Accommodates warehouse location comfortably)
    doc.font('Bold').fontSize(7.2).fillColor('#555555').text('TESLİM YERİ / AMBAR', termsCols[2].x + 8, currentY + 7, { width: termsCols[2].w - 16, lineBreak: false });
    doc.font('Bold').fontSize(8.5).fillColor('#000000').text(rfqData.deliveryPlace || 'Ana Hammadde & Üretim Ambarı', termsCols[2].x + 8, currentY + 22, { width: termsCols[2].w - 16, height: 22 });

    // Col 4: Currency & VAT Status
    doc.font('Bold').fontSize(7.2).fillColor('#555555').text('PARA BİRİMİ & KDV', termsCols[3].x + 8, currentY + 7, { width: termsCols[3].w - 16, lineBreak: false });
    doc.font('Bold').fontSize(9).fillColor('#000000').text(`${currCode} • KDV ${rfqData.vatStatus || 'Hariç'}`, termsCols[3].x + 8, currentY + 23, { width: termsCols[3].w - 16, lineBreak: false, ellipsis: true });

    currentY += termsBoxHeight + 14;

    // ==================== 4. TEKLİF KALEMLERİ VE FİYAT TABLOSU ====================
    currentY = drawSectionHeader('3. TEKLİF KALEMLERİ VE FİYAT DETAYLARI', currentY);

    const tableCols = [
      { key: 'index', label: '#', width: 22, align: 'center' },
      { key: 'reqNo', label: 'Talep No', width: 72, align: 'left' },
      { key: 'code', label: 'Malzeme Kodu', width: 66, align: 'left' },
      { key: 'name', label: 'Malzeme Adı / Tanımı', width: 128, align: 'left' },
      { key: 'reqQty', label: 'Talep', width: 36, align: 'right' },
      { key: 'offQty', label: 'Teklif', width: 36, align: 'right' },
      { key: 'unit', label: 'Birim', width: 26, align: 'center' },
      { key: 'price', label: 'Birim Fiyat', width: 48, align: 'right' },
      { key: 'disc', label: 'İsk.', width: 24, align: 'center' },
      { key: 'vat', label: 'KDV', width: 24, align: 'center' },
      { key: 'total', label: 'Net Tutar', width: 49.28, align: 'right' }
    ];

    // Table Header
    const thHeight = 18;
    doc.lineWidth(0.75).rect(startX, currentY, pageWidth, thHeight).fillAndStroke('#E5E7EB', '#000000');

    let curX = startX;
    tableCols.forEach((col, cIdx) => {
      doc.font('Bold').fontSize(7.2).fillColor('#000000')
        .text(col.label, curX + 2, currentY + 5, { width: col.width - 4, align: col.align, lineBreak: false });
      if (cIdx > 0) {
        doc.lineWidth(0.5).moveTo(curX, currentY).lineTo(curX, currentY + thHeight).stroke('#000000');
      }
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

    const rowHeight = 24;

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
        { val: it.ad || it.productName || 'Malzeme', width: 128, align: 'left', bold: true },
        { val: lineReqQty.toLocaleString('tr-TR'), width: 36, align: 'right', bold: false },
        { val: lineOffQty.toLocaleString('tr-TR'), width: 36, align: 'right', bold: true },
        { val: it.birim || it.unit || 'Adet', width: 26, align: 'center', bold: false },
        { val: `${linePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, width: 48, align: 'right', bold: false },
        { val: lineDisc > 0 ? `%${lineDisc}` : '%0', width: 24, align: 'center', bold: false },
        { val: `%${lineVat}`, width: 24, align: 'center', bold: false },
        { val: `${lineNet.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, width: 49.28, align: 'right', bold: true }
      ];

      rowVals.forEach((cell, cIdx) => {
        doc.font(cell.bold ? 'Bold' : 'Regular').fontSize(7.6).fillColor('#000000')
          .text(cell.val, x + 2, currentY + 7, { width: cell.width - 4, align: cell.align, lineBreak: false, ellipsis: true });
        if (cIdx > 0) {
          doc.lineWidth(0.5).moveTo(x, currentY).lineTo(x, currentY + rowHeight).stroke('#E5E7EB');
        }
        x += cell.width;
      });

      currentY += rowHeight;
    });

    currentY += 14;

    // ==================== 5. MALİ ÖZET & NOTLAR ====================
    const summaryBoxWidth = 235;
    const summaryBoxHeight = 88;
    const notesBoxWidth = pageWidth - summaryBoxWidth - 10;

    // Left: Notes Box
    doc.lineWidth(0.75).rect(startX, currentY, notesBoxWidth, summaryBoxHeight).stroke('#000000');
    doc.font('Bold').fontSize(8.2).fillColor('#000000')
      .text('TEKLİF NOTLARI VE TİCARİ AÇIKLAMALAR:', startX + 8, currentY + 8);
    doc.font('Regular').fontSize(7.8).fillColor('#222222')
      .text(rfqData.notes || 'İşbu teklif yukarıda belirtilen şartlar ve geçerlilik süresi dahilinde geçerlidir. Malzemeler ambar teslimi kabul kriterlerine uygun olarak teslim edilecektir.', startX + 8, currentY + 22, { width: notesBoxWidth - 16, height: 42 });

    if (rfqData.currency !== 'TRY' && rfqData.currency !== 'TL') {
      const rateTypeLabel = rfqData.isRateLocked ? 'Kilitli Sipariş Kuru' : 'Anlık Piyasa Kuru';
      const tryVolLabel = rfqData.isRateLocked ? 'Kilitli TL Tutarı' : 'Tahmini TL Tutarı';
      doc.font('Bold').fontSize(7.5).fillColor('#000000')
        .text(`${rateTypeLabel}: 1 ${rfqData.currency} = ${parseFloat(rfqData.exchangeRate || 1).toFixed(4)} TL | ${tryVolLabel}: ${parseFloat(rfqData.totalPriceTRY || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`, startX + 8, currentY + 68, { width: notesBoxWidth - 16, lineBreak: false });
    }

    // Right: Financial Totals Box
    const sumX = startX + notesBoxWidth + 10;
    doc.lineWidth(1).rect(sumX, currentY, summaryBoxWidth, summaryBoxHeight).stroke('#000000');

    const subtotal = parseFloat(rfqData.subtotal || 0);
    const discount = parseFloat(rfqData.discount || 0);
    const vat = parseFloat(rfqData.vat || 0);
    const grandTotal = parseFloat(rfqData.totalPrice || 0);

    doc.font('Regular').fontSize(8.2).fillColor('#000000')
      .text('Ara Toplam:', sumX + 10, currentY + 8)
      .text('Toplam İskonto:', sumX + 10, currentY + 25)
      .text('Hesaplanan KDV:', sumX + 10, currentY + 42);

    doc.font('Bold').fontSize(8.2).fillColor('#000000')
      .text(`${subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, sumX + 100, currentY + 8, { width: 125, align: 'right', lineBreak: false })
      .text(`-${discount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, sumX + 100, currentY + 25, { width: 125, align: 'right', lineBreak: false })
      .text(`+${vat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, sumX + 100, currentY + 42, { width: 125, align: 'right', lineBreak: false });

    // Grand Total Line
    doc.lineWidth(0.75).moveTo(sumX + 6, currentY + 58).lineTo(sumX + summaryBoxWidth - 6, currentY + 58).stroke('#000000');
    doc.font('Bold').fontSize(9.5).fillColor('#000000')
      .text('GENEL TOPLAM:', sumX + 10, currentY + 66)
      .text(`${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currDisplay}`, sumX + 85, currentY + 66, { width: 140, align: 'right', lineBreak: false });

    currentY += summaryBoxHeight + 16;

    // ==================== 6. ONAY VE İMZA ALANI ====================
    currentY = drawSectionHeader('4. ONAY VE İMZA ALANI', currentY);

    const signBoxHeight = 100;
    const signColWidth = (pageWidth - 12) / 3;

    for (let i = 0; i < 3; i++) {
      const sBoxX = startX + (i * (signColWidth + 6));
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

      doc.font('Bold').fontSize(8.2).fillColor('#000000').text(signTitle, sBoxX + 6, currentY + 8, { width: signColWidth - 12, align: 'center', lineBreak: false });
      doc.font('Regular').fontSize(7.2).fillColor('#555555').text(signSub, sBoxX + 6, currentY + 22, { width: signColWidth - 12, align: 'center', lineBreak: false });

      // Stamp Box & Signature Line
      doc.lineWidth(0.5).moveTo(sBoxX + 16, currentY + 76).lineTo(sBoxX + signColWidth - 16, currentY + 76).stroke('#888888');
      doc.font('Italic').fontSize(6.8).fillColor('#666666').text('Yetkili İmza & Resmi Kaşe', sBoxX + 6, currentY + 80, { width: signColWidth - 12, align: 'center', lineBreak: false });
    }

    // ==================== 7. FOOTER ====================
    doc.lineWidth(0.5).moveTo(startX, 792).lineTo(startX + pageWidth, 792).stroke('#CCCCCC');
    doc.font('Regular').fontSize(7).fillColor('#555555')
      .text(`İşbu resmi belge Enterprise ERP Kurumsal Bilgi Sistemi tarafından elektronik olarak üretilmiştir. • Belge No: ${rfqData.rfqNo} • Yazdırma Tarihi: ${new Date().toLocaleString('tr-TR')}`, startX, 797, { width: pageWidth, align: 'center', lineBreak: false });

    doc.end();
  }
}

module.exports = new RfqPdfService();
