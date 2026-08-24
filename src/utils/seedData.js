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

    // 4. Sample stock, orders and recipes seeding disabled (user manages custom data)
    let stockItem1 = null, stockItem2 = null, stockItem3 = null, stockItem4 = null;

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
