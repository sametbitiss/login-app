const PERMISSION_MODULES = [
  {
    id: 'admin',
    name: '🛡️ Sistem Yönetimi & Güvenlik',
    permissions: [
      { key: 'admin_dashboard', label: '📊 Kontrol Paneli & Analitik', desc: 'Yönetim özet paneli ve sistem metriklerini izleme' },
      { key: 'admin_users', label: '👥 Kullanıcı Hesapları', desc: 'Sistem kullanıcı listesini, unvan ve profillerini görüntüleme' },
      { key: 'admin_users_add', label: '➕ Yeni Kullanıcı Ekleme', desc: 'Sisteme yeni personel hesabı tanımlama' },
      { key: 'admin_roles', label: '🔐 Rol & Yetki Matrisi', desc: 'Sistem rolleri ve modül bazlı yetki matrisini yönetme' },
      { key: 'admin_settings', label: '⚙️ Sistem Parametreleri', desc: 'Bakım modu, sistem yapılandırması ve genel ayarlar' },
      { key: 'admin_logs', label: '📜 İşlem Günlüğü (Audit Log)', desc: 'Tüm modüllerdeki ekleme, güncelleme ve silme denetim izleri' }
    ]
  },
  {
    id: 'stock',
    name: '📦 Stok & Depo Yönetimi',
    permissions: [
      { key: 'stock_items', label: '📋 Stok Kartları Listesi', desc: 'Tüm malzeme, mamul ve hammadde kartlarını listeleme ve arama' },
      { key: 'stock_items_add', label: '➕ Yeni Stok Kartı Ekleme', desc: 'Sisteme yeni malzeme veya ürün kartı tanımlama' },
      { key: 'stock_warehouses', label: '🏬 Depo & Lokasyon Yönetimi', desc: 'Fiziki depoları, koridor, raf ve göz lokasyonlarını yönetme' },
      { key: 'stock_transfers', label: '🔄 Depolar Arası Transferler', desc: 'Depolar ve lokasyonlar arası malzeme sevk fişi kesme' },
      { key: 'stock_counting', label: '📊 Stok Sayım İşlemleri', desc: 'Fiziksel envanter sayım fişi başlatma ve mutabakat kaydı' },
      { key: 'stock_goods_receipt', label: '📥 Mal Kabul İşlemleri', desc: 'Gelen malzeme teslim alma ve ambar kabul kayıtları' },
      { key: 'stock_alerts', label: '⚠️ Kritik Stok & Rezerve Uyarısı', desc: 'Asgari stok seviyesi altındaki ve rezerve ürünleri izleme' },
      { key: 'stock_analytics', label: '📈 Stok Analitiği & Raporlama', desc: 'Envanter değeri, stok devir hızı ve depo doluluk raporları' }
    ]
  },
  {
    id: 'sales',
    name: '🛍️ Satış Yönetimi',
    permissions: [
      { key: 'sales_orders', label: '📋 Satış Siparişleri', desc: 'Müşteri sipariş listesini ve teslimat durumlarını görüntüleme' },
      { key: 'sales_orders_add', label: '➕ Yeni Sipariş Oluşturma', desc: 'Müşterilere yeni satış siparişi girme ve kalem tanımlama' },
      { key: 'sales_quotes', label: '📝 Satış Teklifleri', desc: 'Müşteri teklifleri oluşturma, fiyat verme ve revizyon takibi' },
      { key: 'sales_dispatches', label: '🚚 Sevk & İrsaliye Yönetimi', desc: 'Depodan sevkiyat çıkarma ve resmi sevk irsaliyesi düzenleme' },
      { key: 'sales_invoices', label: '🧾 Satış Faturaları', desc: 'E-Fatura/A4 fatura oluşturma ve muhasebeleşme kayıtları' },
      { key: 'sales_customers', label: '👥 Müşteri Cari Hesapları', desc: 'Müşteri kartları, bakiyeler ve cari hesap ekstreleri' },
      { key: 'sales_analytics', label: '📊 Satış Analitiği & Performans', desc: 'Satış cirosu, temsilci ve bölge performans raporları' }
    ]
  },
  {
    id: 'purchase',
    name: '💳 Satın Alma Yönetimi',
    permissions: [
      { key: 'purchase_orders', label: '📦 Satın Alma Siparişleri', desc: 'Tedarikçi sipariş listesi ve sipariş durum takibi' },
      { key: 'purchase_requisitions', label: '📋 Satın Alma Talepleri', desc: 'Departman içi malzeme ve hizmet talep fişleri oluşturma' },
      { key: 'purchase_rfq', label: '📑 Teklif Talepleri (RFQ)', desc: 'Tedarikçilerden fiyat teklifi toplama ve karşılaştırma' },
      { key: 'purchase_suppliers', label: '🏢 Tedarikçi Cari Yönetimi', desc: 'Tedarikçi firma kartları, vergi ve adres kayıtları' },
      { key: 'purchase_receipts', label: '📥 Mal Kabul Kayıtları', desc: 'Gelen tedarikçi teslimatlarını ambar kabul ile eşleştirme' },
      { key: 'purchase_invoices', label: '🧾 Satın Alma Faturaları', desc: 'Gelen tedarikçi faturaları ve borç cari kayıtları' },
      { key: 'purchase_analytics', label: '📊 Satın Alma Analitiği', desc: 'Tedarikçi harcama, fiyat değişim ve maliyet analizleri' }
    ]
  },
  {
    id: 'production',
    name: '🏭 Üretim Planlama & İmalat',
    permissions: [
      { key: 'production_orders', label: '🛠️ Üretim İş Emirleri', desc: 'Fabrika imalat iş emirlerini listeleme ve durum izleme' },
      { key: 'production_bom', label: '📑 Ürün Reçeteleri (BOM)', desc: 'Mamul ürün reçetesi (BOM) ve hammadde ihtiyaç katsayıları' },
      { key: 'production_routing', label: '🔄 Rota & Operasyon Planlama', desc: 'İş merkezi tezgah rotaları, istasyonlar ve işlem süreleri' },
      { key: 'production_mrp', label: '📊 Malzeme İhtiyaç Planlaması (MRP)', desc: 'Net malzeme ve satın alma gereksinimi hesaplama motoru' },
      { key: 'production_requisitions', label: '📦 Üretim İçin Malzeme Talebi', desc: 'Fabrika sahası imalatı için depodan hammadde çıkış talebi' }
    ]
  },
  {
    id: 'quality',
    name: '🔬 Kalite Kontrol & Güvence',
    permissions: [
      { key: 'quality_dashboard', label: '📊 Kalite Özet Paneli', desc: 'Giriş/proses kabul-ret oranları ve kalite KPI paneli' },
      { key: 'quality_inspections', label: '🔍 Giriş, Proses ve Final Muayeneleri', desc: 'IQC, IPQC ve FQC kalite test kayıtları ve karar süreci' },
      { key: 'quality_ncr', label: '⚠️ Uygunsuzluk Yönetimi (NCR)', desc: 'Hatalı malzeme tespiti, karantina ve fiziki karar yönetimi' },
      { key: 'quality_capa', label: '🛠️ Düzeltici & Önleyici Faaliyetler (CAPA)', desc: '5-Why kök neden analizi ve aksiyon planlama takibi' },
      { key: 'quality_traceability', label: '🌳 Lot / Seri Soyağacı İzlenebilirlik', desc: 'Tedarikçiden müşteriye uçtan uca lot ve seri takip soyağacı' },
      { key: 'quality_equipment', label: '📏 Ölçüm Cihazı Kalibrasyon Takibi', desc: 'Terazi, kumpas ve cihaz periyodik kalibrasyon kayıtları' },
      { key: 'quality_documents', label: '📜 ISO Kalite Belge & Doküman Yönetimi', desc: 'ISO prosedürleri, talimatlar ve form arşivi' }
    ]
  }
];

const DEFAULT_ROLE_MATRIX = {
  Admin: {
    admin_dashboard: true, admin_users: true, admin_users_add: true, admin_roles: true, admin_settings: true, admin_logs: true,
    stock_items: true, stock_items_add: true, stock_warehouses: true, stock_transfers: true, stock_counting: true, stock_goods_receipt: true, stock_alerts: true, stock_analytics: true,
    sales_orders: true, sales_orders_add: true, sales_quotes: true, sales_dispatches: true, sales_invoices: true, sales_customers: true, sales_analytics: true,
    purchase_orders: true, purchase_requisitions: true, purchase_rfq: true, purchase_suppliers: true, purchase_receipts: true, purchase_invoices: true, purchase_analytics: true,
    production_orders: true, production_bom: true, production_routing: true, production_mrp: true, production_requisitions: true,
    quality_dashboard: true, quality_inspections: true, quality_ncr: true, quality_capa: true, quality_traceability: true, quality_equipment: true, quality_documents: true
  },
  Stock_Manager: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: true, stock_warehouses: true, stock_transfers: true, stock_counting: true, stock_goods_receipt: true, stock_alerts: true, stock_analytics: true,
    sales_orders: true, sales_orders_add: false, sales_quotes: false, sales_dispatches: true, sales_invoices: false, sales_customers: false, sales_analytics: false,
    purchase_orders: true, purchase_requisitions: true, purchase_rfq: false, purchase_suppliers: false, purchase_receipts: true, purchase_invoices: false, purchase_analytics: false,
    production_orders: true, production_bom: false, production_routing: false, production_mrp: false, production_requisitions: true,
    quality_dashboard: false, quality_inspections: true, quality_ncr: true, quality_capa: false, quality_traceability: true, quality_equipment: false, quality_documents: false
  },
  Sales_Manager: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: false, stock_warehouses: false, stock_transfers: false, stock_counting: false, stock_goods_receipt: false, stock_alerts: true, stock_analytics: false,
    sales_orders: true, sales_orders_add: true, sales_quotes: true, sales_dispatches: true, sales_invoices: true, sales_customers: true, sales_analytics: true,
    purchase_orders: false, purchase_requisitions: true, purchase_rfq: false, purchase_suppliers: false, purchase_receipts: false, purchase_invoices: false, purchase_analytics: false,
    production_orders: true, production_bom: false, production_routing: false, production_mrp: false, production_requisitions: false,
    quality_dashboard: false, quality_inspections: false, quality_ncr: false, quality_capa: false, quality_traceability: false, quality_equipment: false, quality_documents: false
  },
  Purchase_Manager: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: true, stock_warehouses: false, stock_transfers: false, stock_counting: false, stock_goods_receipt: true, stock_alerts: true, stock_analytics: false,
    sales_orders: false, sales_orders_add: false, sales_quotes: false, sales_dispatches: false, sales_invoices: false, sales_customers: false, sales_analytics: false,
    purchase_orders: true, purchase_requisitions: true, purchase_rfq: true, purchase_suppliers: true, purchase_receipts: true, purchase_invoices: true, purchase_analytics: true,
    production_orders: false, production_bom: true, production_routing: false, production_mrp: true, production_requisitions: false,
    quality_dashboard: false, quality_inspections: true, quality_ncr: true, quality_capa: false, quality_traceability: false, quality_equipment: false, quality_documents: false
  },
  Production_Manager: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: false, stock_warehouses: false, stock_transfers: true, stock_counting: false, stock_goods_receipt: false, stock_alerts: true, stock_analytics: false,
    sales_orders: true, sales_orders_add: false, sales_quotes: false, sales_dispatches: false, sales_invoices: false, sales_customers: false, sales_analytics: false,
    purchase_orders: false, purchase_requisitions: true, purchase_rfq: false, purchase_suppliers: false, purchase_receipts: false, purchase_invoices: false, purchase_analytics: false,
    production_orders: true, production_bom: true, production_routing: true, production_mrp: true, production_requisitions: true,
    quality_dashboard: false, quality_inspections: true, quality_ncr: true, quality_capa: true, quality_traceability: true, quality_equipment: false, quality_documents: false
  },
  Quality_Manager: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: false, stock_warehouses: false, stock_transfers: false, stock_counting: true, stock_goods_receipt: true, stock_alerts: true, stock_analytics: false,
    sales_orders: false, sales_orders_add: false, sales_quotes: false, sales_dispatches: false, sales_invoices: false, sales_customers: false, sales_analytics: false,
    purchase_orders: false, purchase_requisitions: true, purchase_rfq: false, purchase_suppliers: false, purchase_receipts: true, purchase_invoices: false, purchase_analytics: false,
    production_orders: true, production_bom: true, production_routing: false, production_mrp: false, production_requisitions: false,
    quality_dashboard: true, quality_inspections: true, quality_ncr: true, quality_capa: true, quality_traceability: true, quality_equipment: true, quality_documents: true
  },
  Employee: {
    admin_dashboard: false, admin_users: false, admin_users_add: false, admin_roles: false, admin_settings: false, admin_logs: false,
    stock_items: true, stock_items_add: false, stock_warehouses: false, stock_transfers: false, stock_counting: false, stock_goods_receipt: false, stock_alerts: false, stock_analytics: false,
    sales_orders: false, sales_orders_add: false, sales_quotes: false, sales_dispatches: false, sales_invoices: false, sales_customers: false, sales_analytics: false,
    purchase_orders: false, purchase_requisitions: true, purchase_rfq: false, purchase_suppliers: false, purchase_receipts: false, purchase_invoices: false, purchase_analytics: false,
    production_orders: false, production_bom: false, production_routing: false, production_mrp: false, production_requisitions: false,
    quality_dashboard: false, quality_inspections: false, quality_ncr: false, quality_capa: false, quality_traceability: false, quality_equipment: false, quality_documents: false
  }
};

const DEFAULT_ROLES = [
  { key: 'Admin', label: 'Sistem Yöneticisi & Admin', department: 'Sistem Yönetimi', description: 'Tüm modüllere ve sistem parametrelerine tam yetkili üst yönetici', isSystem: true },
  { key: 'Stock_Manager', label: 'Stok & Depo Yöneticisi', department: 'Stok & Depo', description: 'Depo, lokasyon, fiziki sayım ve transfer işlemlerini yöneten birim yöneticisi', isSystem: false },
  { key: 'Sales_Manager', label: 'Satış & Pazarlama Müdürü', department: 'Satış & Pazarlama', description: 'Satış teklif, sipariş, sevkiyat ve müşteri cari hesap yöneticisi', isSystem: false },
  { key: 'Purchase_Manager', label: 'Satın Alma Yöneticisi', department: 'Satın Alma', description: 'Tedarikçi ilişkileri, satın alma sipariş ve RFQ teklif yöneticisi', isSystem: false },
  { key: 'Production_Manager', label: 'Üretim & İmalat Müdürü', department: 'Üretim & İmalat', description: 'Fabrika imalat iş emirleri, reçete (BOM) ve MRP planlama yöneticisi', isSystem: false },
  { key: 'Quality_Manager', label: 'Kalite Kontrol & Güvence Müdürü', department: 'Kalite Kontrol', description: 'Giriş/proses muayeneleri, NCR uygunsuzluk ve CAPA aksiyon yöneticisi', isSystem: false },
  { key: 'Employee', label: 'Departman Uzman Personel', department: 'Genel', description: 'Standart operasyonel kayıt ve izleme yetkisine sahip personel', isSystem: false }
];

module.exports = {
  PERMISSION_MODULES,
  DEFAULT_ROLE_MATRIX,
  DEFAULT_ROLES
};
