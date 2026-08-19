const bcrypt = require('bcrypt');
const {
  Kullanici,
  SistemAyari,
  StokKarti,
  SatisSiparisi,
  SatinAlmaSiparisi,
  Tedarikci,
  SatinAlmaTeklifTalebi,
  MalKabul,
  SatinAlmaTalebi,
  UretimEmri,
  UrunRecetesi,
  RotaOperasyon,
  Depo,
  StokLokasyonu,
  StokPartisi,
  StokHareketi,
  StokSayimi,
  KaliteMuayene,
  KaliteUygunsuzluk,
  KaliteDof,
  KaliteEkipmani,
  KaliteDokumani,
  DenetimKaydi
} = require('../../models');

async function seedInitialData() {
  try {
    // 1. Seed System Settings
    const defaultSettings = [
      { anahtar: 'company_name', deger: 'Enterprise ERP Sistemleri A.Ş.', aciklama: 'Kurum resmi ticari unvanı', kategori: 'General' },
      { anahtar: 'session_timeout_hours', deger: '8', aciklama: 'JWT Oturum geçerlilik süresi (Saat)', kategori: 'Security' },
      { anahtar: 'maintenance_mode', deger: 'false', aciklama: 'Sistem Bakım Modu (true/false)', kategori: 'System' },
      { anahtar: 'min_password_length', deger: '6', aciklama: 'Minimum şifre karakter uzunluğu', kategori: 'Security' }
    ];

    for (const setting of defaultSettings) {
      await SistemAyari.findOrCreate({
        where: { anahtar: setting.anahtar },
        defaults: setting
      });
    }

    // 2. Seed Admin User
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    let [adminUser] = await Kullanici.findOrCreate({
      where: { kullaniciAdi: 'admin' },
      defaults: {
        kullaniciAdi: 'admin',
        sifre: hashedAdminPassword,
        eposta: 'admin@enterprise-erp.com',
        ad: 'Ahmet',
        soyad: 'Yılmaz',
        telefon: '+90 (212) 555 0001',
        departman: 'Sistem Yönetimi',
        unvan: 'Sistem Yöneticisi & Admin',
        rol: 'Admin',
        durum: 'Active'
      }
    });

    // 3. Seed Sample Warehouses
    const whCount = await Depo.count();
    let wh1, wh2;
    if (whCount === 0) {
      wh1 = await Depo.create({
        depoKodu: 'DEP-001',
        ad: 'Ana Hammadde & Üretim Ambarı',
        tur: 'Hammadde',
        sehir: 'İstanbul',
        adres: 'Organize Sanayi Bölgesi 2. Cadde No: 4 Dudullu / İstanbul',
        sorumluAdi: 'Murat Kaya',
        durum: 'Active'
      });

      wh2 = await Depo.create({
        depoKodu: 'DEP-002',
        ad: 'Gebze Sevkiyat & Lojistik Deposu',
        tur: 'Sevkiyat',
        sehir: 'Kocaeli',
        adres: 'Gebze Plastikçiler OSB 14. Sokak No: 8 Gebze / Kocaeli',
        sorumluAdi: 'Hasan Yılmaz',
        durum: 'Active'
      });

      await StokLokasyonu.bulkCreate([
        { lokasyonKodu: 'LOC-1-A-04-02', depoId: wh1.id, koridor: 'Koridor-A', raf: 'Raf-04', goz: 'Göz-02', kapasite: 2000 },
        { lokasyonKodu: 'LOC-1-B-02-01', depoId: wh1.id, koridor: 'Koridor-B', raf: 'Raf-02', goz: 'Göz-01', kapasite: 1500 },
        { lokasyonKodu: 'LOC-2-C-01-05', depoId: wh2.id, koridor: 'Koridor-C', raf: 'Raf-01', goz: 'Göz-05', kapasite: 5000 }
      ]);
    } else {
      wh1 = await Depo.findOne({ where: { depoKodu: 'DEP-001' } });
      wh2 = await Depo.findOne({ where: { depoKodu: 'DEP-002' } });
    }

    // 4. Seed Sample Stock Data
    let stockItem1 = await StokKarti.findOne({ where: { stokKodu: 'STK-0001' } });
    if (!stockItem1) {
      stockItem1 = await StokKarti.create({
        stokKodu: 'STK-0001',
        barkod: '8690123456789',
        ad: 'Paslanmaz Çelik Cıvata M8x50',
        aciklama: '316 Kalite Paslanmaz Çelik Sanayi Tipi Cıvata (Hammadde Girdisi)',
        kategori: 'Hammadde',
        birim: 'Adet',
        marka: 'Norm Cıvata',
        model: 'M8x50-A4',
        mevcutStok: 1500,
        asgariStok: 200,
        azamiStok: 5000,
        alisFiyati: 4.50,
        satisFiyati: 8.75,
        paraBirimi: 'TRY',
        kdvOrani: 20,
        depoLokasyonu: 'Depo-A / Raf-04',
        tedarikci: 'Norm Bağlantı Elemanları A.Ş.',
        durum: 'Active',
        olusturanId: adminUser.id
      });
    }

    let stockItem2 = await StokKarti.findOne({ where: { stokKodu: 'STK-0002' } });
    if (!stockItem2) {
      stockItem2 = await StokKarti.create({
        stokKodu: 'STK-0002',
        barkod: '8690123456790',
        ad: 'Endüstriyel Paslanmaz Jeneratör Şasisi',
        aciklama: 'Fabrikada üretilen ve satışı yapılan nihai mamul ürün',
        kategori: 'Mamul',
        birim: 'Adet',
        marka: 'Enterprise ERP',
        model: 'GEN-SHASI-2026',
        mevcutStok: 12,
        asgariStok: 5,
        azamiStok: 50,
        alisFiyati: 12000.00,
        satisFiyati: 24500.00,
        paraBirimi: 'TRY',
        kdvOrani: 20,
        depoLokasyonu: 'Depo-B / Raf-12',
        tedarikci: 'İç Üretim (Fabrika)',
        durum: 'Active',
        olusturanId: adminUser.id
      });
    }

    let stockItem3 = await StokKarti.findOne({ where: { stokKodu: 'STK-0003' } });
    if (!stockItem3) {
      stockItem3 = await StokKarti.create({
        stokKodu: 'STK-0003',
        barkod: '8690123456791',
        ad: '2mm Paslanmaz Çelik Sac Plaka 1200x2400',
        aciklama: 'Lazer kesim ve büküm için ham sac plaka (Hammadde)',
        kategori: 'Hammadde',
        birim: 'Adet',
        marka: 'Erdemir',
        model: '304-SAC-2MM',
        mevcutStok: 350,
        asgariStok: 50,
        azamiStok: 1000,
        alisFiyati: 450.00,
        satisFiyati: 750.00,
        paraBirimi: 'TRY',
        kdvOrani: 20,
        depoLokasyonu: 'Depo-A / Raf-01',
        tedarikci: 'Erdemir Çelik A.Ş.',
        durum: 'Active',
        olusturanId: adminUser.id
      });
    }

    let stockItem4 = await StokKarti.findOne({ where: { stokKodu: 'STK-0004' } });
    if (!stockItem4) {
      stockItem4 = await StokKarti.create({
        stokKodu: 'STK-0004',
        barkod: '8690123456792',
        ad: 'Bosch Professional Akülü Vidalama',
        aciklama: 'GSR 18V-50 Kömürsüz Matkap (Ticari Mamul)',
        kategori: 'Ticari_Mal',
        birim: 'Adet',
        marka: 'Bosch',
        model: 'GSR 18V-50',
        mevcutStok: 45,
        asgariStok: 10,
        azamiStok: 100,
        alisFiyati: 3200.00,
        satisFiyati: 4850.00,
        paraBirimi: 'TRY',
        kdvOrani: 20,
        depoLokasyonu: 'Depo-B / Raf-08',
        tedarikci: 'Bosch A.Ş.',
        durum: 'Active',
        olusturanId: adminUser.id
      });
    }

    // 5. Seed Sample Sales Orders
    const salesCount = await SatisSiparisi.count();
    if (salesCount === 0 && stockItem2) {
      await SatisSiparisi.bulkCreate([
        {
          siparisNo: 'SAT-2026-0001',
          musteriAdi: 'Mega İnşaat ve Sanayi A.Ş.',
          musteriVergiNo: '6120345678',
          musteriEposta: 'satinalma@megainsaat.com',
          musteriTelefon: '+90 (212) 555 1234',
          siparisTarihi: '2026-08-01',
          teslimTarihi: '2026-08-10',
          odemeVadesi: 'Vadeli_30',
          durum: 'Approved',
          oncelik: 'High',
          stokId: stockItem2.id,
          miktar: 2,
          birimFiyat: 24500.00,
          iskontoOrani: 5,
          kdvOrani: 20,
          araToplam: 49000.00,
          iskontoTutari: 2450.00,
          kdvTutari: 9310.00,
          toplamTutar: 55860.00,
          paraBirimi: 'TRY',
          teslimatAdresi: 'Organize Sanayi Bölgesi 4. Cadde No: 12 Ümraniye / İstanbul',
          faturaAdresi: 'Maslak Mah. Büyükdere Cad. No: 142 Şişli / İstanbul',
          satisTemsilcisi: 'Selin Demir',
          notlar: 'Müşteri acil sevk talep ediyor.',
          olusturanId: salesUser.id
        }
      ]);
    }

    // 6. Seed Sample Purchase Orders
    const purchaseCount = await SatinAlmaSiparisi.count();
    if (purchaseCount === 0 && stockItem1) {
      await SatinAlmaSiparisi.bulkCreate([
        {
          siparisNo: 'SATIN-2026-0001',
          tedarikciAdi: 'Norm Bağlantı Elemanları San. ve Tic. A.Ş.',
          tedarikciVergiNo: '6320987654',
          tedarikciIlgiliKisi: 'Mehmet Kaplan',
          tedarikciEposta: 'siparis@normcivata.com.tr',
          tedarikciTelefon: '+90 (232) 376 0000',
          siparisTarihi: '2026-08-02',
          beklenenTeslimTarihi: '2026-08-12',
          odemeVadesi: 'Vadeli_60',
          durum: 'Ordered',
          oncelik: 'Normal',
          stokId: stockItem1.id,
          miktar: 1000,
          birimFiyat: 4.50,
          iskontoOrani: 10,
          kdvOrani: 20,
          araToplam: 4500.00,
          iskontoTutari: 450.00,
          kdvTutari: 810.00,
          toplamTutar: 4860.00,
          paraBirimi: 'TRY',
          teslimDeposu: 'Depo-A (Hammadde Ambarı)',
          satinAlmaci: 'Caner Öztürk',
          notlar: 'Toplu ham madde alımı.',
          olusturanId: purchaseUser.id
        }
      ]);
    }

    // 7. Seed Sample Production Orders
    const productionCount = await UretimEmri.count();
    if (productionCount === 0 && stockItem2) {
      await UretimEmri.bulkCreate([
        {
          isEmriNo: 'URETIM-2026-0001',
          uretimBasligi: 'Paslanmaz Bağlantı Şasisi İmalatı',
          stokId: stockItem2.id,
          planlananMiktar: 10,
          tamamlananMiktar: 0,
          fireMiktari: 0,
          birim: 'Adet',
          durum: 'In_Production',
          oncelik: 'High',
          isMerkezi: 'İstasyon-2 (Kaynak & Sac İşleme)',
          planlananBaslangicTarihi: '2026-08-03',
          planlananBitisTarihi: '2026-08-15',
          gerceklesenBaslangicTarihi: '2026-08-03',
          tahminiSaat: 24.0,
          gerceklesenSaat: 12.5,
          receteNotlari: '4x STK-0001 Cıvata, 1x STK-0003 Sac Plaka',
          uretimYonetici: 'Oğuz Aydın',
          notlar: 'Seri imalat üretimi.',
          olusturanId: productionUser.id
        }
      ]);
    }

    // 8. Seed Sample BOM Items
    const bomCount = await UrunRecetesi.count();
    if (bomCount === 0 && stockItem1 && stockItem2 && stockItem3) {
      await UrunRecetesi.bulkCreate([
        {
          receteKodu: 'BOM-2026-0001',
          mamulStokId: stockItem2.id,
          bilesenStokId: stockItem1.id,
          gerekliMiktar: 8.0,
          birim: 'Adet',
          fireOrani: 1.0,
          notlar: '1 adet şasi montajı için 8 adet paslanmaz cıvata gerekir.'
        },
        {
          receteKodu: 'BOM-2026-0002',
          mamulStokId: stockItem2.id,
          bilesenStokId: stockItem3.id,
          gerekliMiktar: 1.0,
          birim: 'Adet',
          fireOrani: 2.0,
          notlar: '1 adet şasi gövdesi için 1 adet paslanmaz sac plaka kesilir.'
        }
      ]);
    }

    // 9. Seed Sample Suppliers
    const supplierCount = await Tedarikci.count();
    let sup1, sup2;
    if (supplierCount === 0) {
      sup1 = await Tedarikci.create({
        tedarikciKodu: 'TED-2026-0001',
        firmaAdi: 'Norm Bağlantı Elemanları San. ve Tic. A.Ş.',
        vergiNo: '6320987654',
        vergiDairesi: 'İzmir Atatürk',
        ilgiliKisi: 'Mehmet Kaplan',
        eposta: 'siparis@normcivata.com.tr',
        telefon: '+90 (232) 376 0000',
        sehir: 'İzmir',
        odemeVadesi: 'Vadeli_60',
        kategori: 'Hammadde',
        performansSkoru: 4.8,
        zamanindaTeslimatOrani: 97.5,
        kaliteSkoru: 99.0,
        durum: 'Active',
        olusturanId: purchaseUser.id
      });

      sup2 = await Tedarikci.create({
        tedarikciKodu: 'TED-2026-0002',
        firmaAdi: 'Erdemir Çelik A.Ş.',
        vergiNo: '3450912384',
        vergiDairesi: 'Zonguldak Ereğli',
        ilgiliKisi: 'Ayşe Yıldız',
        eposta: 'satis@erdemir.com.tr',
        telefon: '+90 (372) 323 0000',
        sehir: 'Zonguldak',
        odemeVadesi: 'Vadeli_30',
        kategori: 'Hammadde',
        performansSkoru: 4.6,
        zamanindaTeslimatOrani: 94.0,
        kaliteSkoru: 98.5,
        durum: 'Active',
        olusturanId: purchaseUser.id
      });
    } else {
      sup1 = await Tedarikci.findOne({ where: { tedarikciKodu: 'TED-2026-0001' } });
      sup2 = await Tedarikci.findOne({ where: { tedarikciKodu: 'TED-2026-0002' } });
    }

    // 10. Seed Sample RFQs
    const rfqCount = await SatinAlmaTeklifTalebi.count();
    if (rfqCount === 0 && stockItem1 && sup1) {
      await SatinAlmaTeklifTalebi.bulkCreate([
        {
          teklifTalepNo: 'RFQ-2026-0001',
          tedarikciId: sup1.id,
          tedarikciAdi: sup1.firmaAdi,
          stokId: stockItem1.id,
          talepEdilenMiktar: 2000,
          teklifEdilenBirimFiyat: 4.20,
          teklifEdilenToplamFiyat: 8400.00,
          paraBirimi: 'TRY',
          teslimSuresiGun: 5,
          odemeVadesi: 'Vadeli_60',
          gecerlilikBitis: '2026-08-30',
          kaliteNotu: 'TSE Paslanmazlık Garantili',
          durum: 'Received',
          kazananMi: false,
          talepEden: 'Caner Öztürk',
          olusturanId: purchaseUser.id
        },
        {
          teklifTalepNo: 'RFQ-2026-0002',
          tedarikciId: sup2 ? sup2.id : sup1.id,
          tedarikciAdi: sup2 ? sup2.firmaAdi : 'Erdemir Çelik Sanayi A.Ş.',
          stokId: stockItem1.id,
          talepEdilenMiktar: 2000,
          teklifEdilenBirimFiyat: 3.85,
          teklifEdilenToplamFiyat: 7700.00,
          paraBirimi: 'TRY',
          teslimSuresiGun: 3,
          odemeVadesi: 'Vadeli_30',
          gecerlilikBitis: '2026-08-28',
          kaliteNotu: 'A-Segment Birinci Sınıf Üretim',
          durum: 'Received',
          kazananMi: false,
          talepEden: 'Caner Öztürk',
          olusturanId: purchaseUser.id
        }
      ]);
    }

    // 11. Seed Sample Goods Receipts
    const grnCount = await MalKabul.count();
    const firstPo = await SatinAlmaSiparisi.findOne();
    if (grnCount === 0 && firstPo && stockItem1) {
      await MalKabul.create({
        malKabulNo: 'GRN-2026-0001',
        satinAlmaSiparisId: firstPo.id,
        tedarikciId: sup1 ? sup1.id : null,
        stokId: stockItem1.id,
        siparisMiktari: firstPo.miktar,
        teslimAlinanMiktar: firstPo.miktar,
        kabulEdilenMiktar: firstPo.miktar,
        reddedilenMiktar: 0,
        kabulTarihi: '2026-08-05',
        irsaliyeNo: 'IRS-2026-9901',
        kaliteDurumu: 'Approved',
        kabulEdenAdi: 'Murat Kaya',
        kaliteNotlari: 'Sertifika ve miktar kontrolü yapıldı, uygun.',
        depoLokasyonu: 'Depo-A (Hammadde Ambarı)',
        durum: 'Completed',
        kabulEdenId: purchaseUser.id
      });
    }

    // 12. Seed Sample Purchase Requisitions
    const reqCount = await SatinAlmaTalebi.count();
    if (reqCount === 0 && stockItem1) {
      await SatinAlmaTalebi.bulkCreate([
        {
          talepNo: 'TALEP-2026-0001',
          kaynakModul: 'Production',
          stokId: stockItem1.id,
          talepEdilenMiktar: 500,
          birim: 'Adet',
          aciliyet: 'Urgent',
          durum: 'Pending',
          talepEdenAdi: 'Oğuz Aydın',
          notlar: 'Üretim Emri URETIM-2026-0001 için eksik hammadde tamamlanacak.',
          olusturanId: productionUser.id
        },
        {
          talepNo: 'TALEP-2026-0002',
          kaynakModul: 'Stock',
          stokId: stockItem3 ? stockItem3.id : stockItem1.id,
          talepEdilenMiktar: 100,
          birim: 'Adet',
          aciliyet: 'Normal',
          durum: 'Approved',
          talepEdenAdi: 'Murat Kaya',
          notlar: 'Kritik stok seviyesinin altına düştüğü için otomatik oluşturuldu.',
          olusturanId: stockUser.id
        }
      ]);
    }

    // 13. Seed Quality Inspections
    const inspectionCount = await KaliteMuayene.count();
    const sampleStockItem = await StokKarti.findOne();

    if (inspectionCount === 0 && sampleStockItem) {
      await KaliteMuayene.bulkCreate([
        {
          muayeneNo: 'IQC-2026-0001',
          tur: 'Incoming',
          stokId: sampleStockItem.id,
          partiNo: 'LOT-2026-A101',
          tedarikciId: sup1 ? sup1.id : null,
          numuneMiktari: 100,
          kabulMiktari: 98,
          redMiktari: 2,
          karar: 'Accepted',
          denetciAdi: 'Selin Arslan (Kalite Uzmanı)',
          hataKategorisi: 'Yüzey Çiziği',
          notlar: 'Çap ve tolerans ölçümleri uygun. %2 oranında hafif yüzey çizik tespit edildi, kabul edildi.'
        }
      ]);
    }

    // 14. Seed Quality Non-Conformances
    const ncrCount = await KaliteUygunsuzluk.count();
    if (ncrCount === 0 && sampleStockItem) {
      const ncr1 = await KaliteUygunsuzluk.create({
        uygunsuzlukNo: 'NCR-2026-0001',
        baslik: 'Tedarikçi Hammadde Tolerans Aşımı',
        tur: 'Supplier_Defect',
        ciddiyet: 'Major',
        durum: 'Action_Required',
        stokId: sampleStockItem.id,
        partiNo: 'LOT-2026-A101',
        etkilenenMiktar: 15,
        tespitEden: 'Selin Arslan',
        atananKisi: 'Satın Alma & Tedarikçi İlişkileri',
        aciklama: 'Gelen mil parçalarında çap ölçüsü 0.05mm tolerans dışı çıkmıştır.',
        kararVeIslem: 'ReturnToSupplier'
      });

      const capaCount = await KaliteDof.count();
      if (capaCount === 0) {
        await KaliteDof.create({
          dofNo: 'CAPA-2026-0001',
          uygunsuzlukId: ncr1.id,
          baslik: 'Tedarikçi Talaşlı İmalat Kalibrasyon Kontrolü',
          kokNedenYontemi: '5_Why',
          kokNedenAciklamasi: 'Tedarikçi CNC tezgahındaki kesici uç aşınması zamanında fark edilmediği için ölçü kaçıklığı oluşmuş.',
          duzelticiFaaliyet: 'Hatalı parti tedarikçiye iade edildi ve yenisi talep edildi.',
          onleyiciFaaliyet: 'Tedarikçiden her parti sevkiyat öncesi CNC takım ölçüm raporu (CMM) talep edilecek.',
          hedefTarih: '2026-08-25',
          durum: 'In_Progress',
          atananKisi: 'Kalite Güvence Müdürü',
          onaylayanKisi: 'Selin Arslan'
        });
      }
    }

    // 15. Seed Quality Equipment
    const equipCount = await KaliteEkipmani.count();
    if (equipCount === 0) {
      await KaliteEkipmani.bulkCreate([
        {
          ekipmanKodu: 'CAL-001',
          ad: 'Dijital Kumpas 0-150mm',
          kategori: 'Dimension',
          markaModel: 'Mitutoyo 500-196-30',
          seriNo: 'MT-8849201',
          kalibrasyonPeriyoduAy: 12,
          sonKalibrasyonTarihi: '2025-09-10',
          gelecekKalibrasyonTarihi: '2026-09-10',
          durum: 'Valid',
          kalibrasyonLaboratuvari: 'TÜBİTAK UME Kalibrasyon Lab',
          notlar: 'İmalat sahası hassas ölçümlerinde kullanılmaktadır.'
        }
      ]);
    }

    // 16. Seed Quality Documents
    const docCount = await KaliteDokumani.count();
    if (docCount === 0) {
      await KaliteDokumani.bulkCreate([
        {
          dokumanKodu: 'PR-KAL-001',
          baslik: 'Giriş Kalite Kontrol Prosedürü',
          kategori: 'Procedure',
          revizyonNo: 'Rev.03',
          gecerlilikTarihi: '2026-01-15',
          sorumlu: 'Selin Arslan (Kalite Yöneticisi)',
          durum: 'Active',
          dosyaYolu: '/docs/PR-KAL-001.pdf',
          aciklama: 'Tedarikçilerden gelen tüm malzeme ve parçaların kabul kıstaslarını kapsar.'
        }
      ]);
    }

    // 17. Seed Audit Logs
    const logCount = await DenetimKaydi.count();
    if (logCount === 0) {
      await DenetimKaydi.bulkCreate([
        {
          kullaniciId: 1,
          kullaniciAdi: 'admin',
          islem: 'UPDATE',
          varlik: 'SistemAyari',
          varlikId: '1',
          detaylar: 'Ahmet Yılmaz (admin) — Sistem güvenlik parametresi "maintenance_mode" pasif konumuna alındı.',
          ipAdresi: '127.0.0.1'
        }
      ]);
    }
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

module.exports = seedInitialData;
