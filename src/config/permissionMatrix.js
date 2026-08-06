const PERMISSION_MODULES = [
  {
    id: 'stock',
    name: '📦 Stok & Depo Yönetimi',
    permissions: [
      { key: 'stock_view', label: 'Stok Kartları & Analitik İzleme', desc: 'Stok listesini ve stok analitiğini görme' },
      { key: 'stock_manage', label: 'Stok Kartı Ekleme / Düzenleme', desc: 'Yeni stok kartı açma ve detay değiştirme' },
      { key: 'warehouse_manage', label: 'Depo & Lokasyon Yönetimi', desc: 'Depo ve koridor/raf lokasyonu tanımlama' },
      { key: 'stock_transfer', label: 'Depolar Arası Transfer & Sevk', desc: 'Depolar arası malzeme transferi yapma' },
      { key: 'stock_counting', label: 'Envanter Fiziksel Sayımı', desc: 'Fiziksel sayım fişi başlatma ve mutabakat' }
    ]
  },
  {
    id: 'sales',
    name: '💼 Satış & Pazarlama',
    permissions: [
      { key: 'sales_view', label: 'Satış Siparişleri & Analitik İzleme', desc: 'Satış raporlarını ve sipariş listesini görme' },
      { key: 'sales_create', label: 'Teklif & Sipariş Oluşturma', desc: 'Müşteriye teklif verme ve sipariş açma' },
      { key: 'sales_approve', label: 'Yönetsel Satış & İskonto Onayı', desc: 'Limit üstü satış ve özel teklif onaylama' },
      { key: 'sales_dispatch', label: 'Sevkiyat & İrsaliye / Fatura', desc: 'Sevkiyat yapma ve fatura oluşturma' },
      { key: 'customer_manage', label: 'Cari Müşteri & Fiyat Listesi', desc: 'Müşteri kartı açma ve özel fiyat tanımlama' }
    ]
  },
  {
    id: 'purchase',
    name: '🛒 Satın Alma Yönetimi',
    permissions: [
      { key: 'purchase_view', label: 'Satın Alma Siparişleri & Analitik', desc: 'Satın alma raporlarını ve siparişleri görme' },
      { key: 'purchase_request', label: 'Satın Alma Talebi Açma', desc: 'Departman adına malzeme/hizmet talep etme' },
      { key: 'purchase_rfq', label: 'Teklif Yönetimi & RFQ', desc: 'Tedarikçiden teklif alma ve karşılaştırma' },
      { key: 'purchase_approve', label: 'Yönetsel Satın Alma Bütçe Onayı', desc: '50.000 TL üzeri satın alma siparişi onaylama' },
      { key: 'supplier_manage', label: 'Tedarikçi Kartları Yönetimi', desc: 'Tedarikçi firma ve cari hesap tanımlama' }
    ]
  },
  {
    id: 'production',
    name: '🏭 Üretim & İmalat Yönetimi',
    permissions: [
      { key: 'production_view', label: 'Üretim Analitiği & İş Emirleri', desc: 'Fabrika imalat raporlarını ve iş emirlerini görme' },
      { key: 'production_order_manage', label: 'İş Emri Oluşturma & Düzenleme', desc: 'Fabrikaya yeni iş emri açma' },
      { key: 'production_mrp', label: 'MRP Hesaplama Çalıştırma', desc: 'Malzeme ihtiyaç planlama motorunu tetikleme' },
      { key: 'production_bom', label: 'BOM Reçete & Rotalama Yönetimi', desc: 'Ürün reçetesi (BOM) ve tezgah rotası girme' },
      { key: 'production_mes', label: 'MES Saha Terminali Üretim Sonu', desc: 'Sahadan üretilen miktar ve backflushing bildirimi' }
    ]
  },
  {
    id: 'quality',
    name: '🛡️ Kalite Kontrol & Güvence',
    permissions: [
      { key: 'quality_view', label: 'Kalite Analitiği & Özet Paneli', desc: 'Kalite kabul/ret oranları ve özet raporları izleme' },
      { key: 'quality_inspection', label: 'Giriş, Proses ve Final Muayeneleri', desc: 'IQC, IPQC ve FQC muayene kayıtları ve karar verme' },
      { key: 'quality_ncr', label: 'Uygunsuzluk Yönetimi (NCR)', desc: 'NCR açma, karantinalama ve fiziki karar belirleme' },
      { key: 'quality_capa', label: 'Düzeltici ve Önleyici Faaliyet (CAPA)', desc: '5-Why kök neden analizi ve aksiyon planlama' },
      { key: 'quality_traceability', label: 'Lot/Seri Soyağacı İzlenebilirlik', desc: 'Tedarikçi ➔ Üretim ➔ Müşteri uçtan uca lot takibi' },
      { key: 'quality_equipment', label: 'Ölçüm Cihazı Kalibrasyon Takibi', desc: 'Kumpas/terazi kalibrasyon periyotları ve bakım takibi' },
      { key: 'quality_documents', label: 'ISO Kalite Belgeleri & Dokümanlar', desc: 'ISO prosedürleri, talimatlar ve form arşivi' }
    ]
  },
  {
    id: 'admin',
    name: '⚙️ Sistem Yönetimi & Güvenlik',
    permissions: [
      { key: 'admin_users', label: 'Kullanıcı Hesapları & Şifre Sıfırlama', desc: 'Sistem kullanıcılarını yönetme ve şifre değiştirme' },
      { key: 'admin_roles', label: 'Rol & Yetki Matrisi Yönetimi', desc: 'Hangi rolün hangi modülü görebileceğini belirleme' },
      { key: 'admin_settings', label: 'Sistem Ayarları & Audit Logları', desc: 'Bakım modu, parametreler ve güvenlik audit kayıtları' }
    ]
  }
];

const DEFAULT_ROLE_MATRIX = {
  Admin: {
    stock_view: true, stock_manage: true, warehouse_manage: true, stock_transfer: true, stock_counting: true,
    sales_view: true, sales_create: true, sales_approve: true, sales_dispatch: true, customer_manage: true,
    purchase_view: true, purchase_request: true, purchase_rfq: true, purchase_approve: true, supplier_manage: true,
    production_view: true, production_order_manage: true, production_mrp: true, production_bom: true, production_mes: true,
    admin_users: true, admin_roles: true, admin_settings: true
  },
  Stock_Manager: {
    stock_view: true, stock_manage: true, warehouse_manage: true, stock_transfer: true, stock_counting: true,
    sales_view: false, sales_create: false, sales_approve: false, sales_dispatch: true, customer_manage: false,
    purchase_view: true, purchase_request: true, purchase_rfq: false, purchase_approve: false, supplier_manage: false,
    production_view: true, production_order_manage: false, production_mrp: false, production_bom: false, production_mes: true,
    admin_users: false, admin_roles: false, admin_settings: false
  },
  Sales_Manager: {
    stock_view: true, stock_manage: false, warehouse_manage: false, stock_transfer: false, stock_counting: false,
    sales_view: true, sales_create: true, sales_approve: true, sales_dispatch: true, customer_manage: true,
    purchase_view: true, purchase_request: true, purchase_rfq: false, purchase_approve: false, supplier_manage: false,
    production_view: true, production_order_manage: false, production_mrp: false, production_bom: false, production_mes: false,
    admin_users: false, admin_roles: false, admin_settings: false
  },
  Purchase_Manager: {
    stock_view: true, stock_manage: true, warehouse_manage: false, stock_transfer: false, stock_counting: false,
    sales_view: false, sales_create: false, sales_approve: false, sales_dispatch: false, customer_manage: false,
    purchase_view: true, purchase_request: true, purchase_rfq: true, purchase_approve: true, supplier_manage: true,
    production_view: true, production_order_manage: false, production_mrp: true, production_bom: false, production_mes: false,
    admin_users: false, admin_roles: false, admin_settings: false
  },
  Production_Manager: {
    stock_view: true, stock_manage: false, warehouse_manage: false, stock_transfer: true, stock_counting: false,
    sales_view: true, sales_create: false, sales_approve: false, sales_dispatch: false, customer_manage: false,
    purchase_view: true, purchase_request: true, purchase_rfq: false, purchase_approve: false, supplier_manage: false,
    production_view: true, production_order_manage: true, production_mrp: true, production_bom: true, production_mes: true,
    admin_users: false, admin_roles: false, admin_settings: false
  },
  Quality_Manager: {
    stock_view: true, stock_manage: true, warehouse_manage: false, stock_transfer: false, stock_counting: true,
    sales_view: false, sales_create: false, sales_approve: false, sales_dispatch: false, customer_manage: false,
    purchase_view: true, purchase_request: true, purchase_rfq: false, purchase_approve: false, supplier_manage: false,
    production_view: true, production_order_manage: false, production_mrp: false, production_bom: true, production_mes: true,
    admin_users: false, admin_roles: false, admin_settings: false
  },
  Employee: {
    stock_view: true, stock_manage: false, warehouse_manage: false, stock_transfer: false, stock_counting: false,
    sales_view: false, sales_create: false, sales_approve: false, sales_dispatch: false, customer_manage: false,
    purchase_view: false, purchase_request: true, purchase_rfq: false, purchase_approve: false, supplier_manage: false,
    production_view: false, production_order_manage: false, production_mrp: false, production_bom: false, production_mes: false,
    admin_users: false, admin_roles: false, admin_settings: false
  }
};

module.exports = {
  PERMISSION_MODULES,
  DEFAULT_ROLE_MATRIX
};
