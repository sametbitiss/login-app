const bcrypt = require('bcrypt');
const {
  User,
  SystemSetting,
  StockItem,
  SaleOrder,
  PurchaseOrder,
  ProductionOrder,
  BOMItem,
  RoutingOperation,
  Warehouse,
  StockLocation,
  StockLot,
  StockMovement,
  StockCounting
} = require('../../models');

async function seedInitialData() {
  try {
    // 1. Seed System Settings
    const defaultSettings = [
      { key: 'company_name', value: 'Enterprise ERP Sistemleri A.Ş.', description: 'Kurum resmi ticari unvanı', category: 'General' },
      { key: 'session_timeout_hours', value: '8', description: 'JWT Oturum geçerlilik süresi (Saat)', category: 'Security' },
      { key: 'maintenance_mode', value: 'false', description: 'Sistem Bakım Modu (true/false)', category: 'System' },
      { key: 'min_password_length', value: '6', description: 'Minimum şifre karakter uzunluğu', category: 'Security' }
    ];

    for (const setting of defaultSettings) {
      await SystemSetting.findOrCreate({
        where: { key: setting.key },
        defaults: setting
      });
    }

    // 2. Seed Users
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedStockPassword = await bcrypt.hash('stok123456', 10);
    const hashedSalesPassword = await bcrypt.hash('satis123456', 10);
    const hashedPurchasePassword = await bcrypt.hash('satinalma123456', 10);
    const hashedProductionPassword = await bcrypt.hash('uretim123456', 10);

    let [adminUser] = await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        username: 'admin',
        password: hashedAdminPassword,
        email: 'admin@enterprise-erp.com',
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        phone: '+90 (212) 555 0001',
        department: 'Sistem Yönetimi',
        title: 'Sistem Yöneticisi & Admin',
        role: 'Admin',
        status: 'Active'
      }
    });

    let [stockUser] = await User.findOrCreate({
      where: { username: 'stok_yoneticisi' },
      defaults: {
        username: 'stok_yoneticisi',
        password: hashedStockPassword,
        email: 'stok@enterprise-erp.com',
        firstName: 'Murat',
        lastName: 'Kaya',
        phone: '+90 (212) 555 0002',
        department: 'Stok & Depo Yönetimi',
        title: 'Depo ve Envanter Sorumlusu',
        role: 'Stock_Manager',
        status: 'Active'
      }
    });

    let [salesUser] = await User.findOrCreate({
      where: { username: 'satis_yoneticisi' },
      defaults: {
        username: 'satis_yoneticisi',
        password: hashedSalesPassword,
        email: 'satis@enterprise-erp.com',
        firstName: 'Selin',
        lastName: 'Demir',
        phone: '+90 (212) 555 0003',
        department: 'Satış Yönetimi',
        title: 'Kıdemli Satış Yöneticisi',
        role: 'Sales_Manager',
        status: 'Active'
      }
    });

    let [purchaseUser] = await User.findOrCreate({
      where: { username: 'satinalma_yoneticisi' },
      defaults: {
        username: 'satinalma_yoneticisi',
        password: hashedPurchasePassword,
        email: 'satinalma@enterprise-erp.com',
        firstName: 'Caner',
        lastName: 'Öztürk',
        phone: '+90 (212) 555 0004',
        department: 'Satın Alma Yönetimi',
        title: 'Satın Alma Sorumlusu',
        role: 'Purchase_Manager',
        status: 'Active'
      }
    });

    let [productionUser] = await User.findOrCreate({
      where: { username: 'uretim_yoneticisi' },
      defaults: {
        username: 'uretim_yoneticisi',
        password: hashedProductionPassword,
        email: 'uretim@enterprise-erp.com',
        firstName: 'Oğuz',
        lastName: 'Aydın',
        phone: '+90 (212) 555 0005',
        department: 'Üretim Planlama',
        title: 'Üretim ve Planlama Müdürü',
        role: 'Production_Manager',
        status: 'Active'
      }
    });

    // 3. Seed Sample Warehouses if empty
    const whCount = await Warehouse.count();
    let wh1, wh2;
    if (whCount === 0) {
      wh1 = await Warehouse.create({
        warehouseCode: 'DEP-001',
        name: 'Ana Hammadde & Üretim Ambarı',
        type: 'Hammadde',
        city: 'İstanbul',
        address: 'Organize Sanayi Bölgesi 2. Cadde No: 4 Dudullu / İstanbul',
        managerName: 'Murat Kaya',
        status: 'Active'
      });

      wh2 = await Warehouse.create({
        warehouseCode: 'DEP-002',
        name: 'Gebze Sevkiyat & Lojistik Deposu',
        type: 'Sevkiyat',
        city: 'Kocaeli',
        address: 'Gebze Plastikçiler OSB 14. Sokak No: 8 Gebze / Kocaeli',
        managerName: 'Hasan Yılmaz',
        status: 'Active'
      });

      await StockLocation.bulkCreate([
        { locationCode: 'LOC-1-A-04-02', warehouseId: wh1.id, aisle: 'Koridor-A', shelf: 'Raf-04', bin: 'Göz-02', capacity: 2000 },
        { locationCode: 'LOC-1-B-02-01', warehouseId: wh1.id, aisle: 'Koridor-B', shelf: 'Raf-02', bin: 'Göz-01', capacity: 1500 },
        { locationCode: 'LOC-2-C-01-05', warehouseId: wh2.id, aisle: 'Koridor-C', shelf: 'Raf-01', bin: 'Göz-05', capacity: 5000 }
      ]);
    } else {
      wh1 = await Warehouse.findOne({ where: { warehouseCode: 'DEP-001' } });
      wh2 = await Warehouse.findOne({ where: { warehouseCode: 'DEP-002' } });
    }

    // 4. Seed Sample Stock Data (Clean distinction between Hammadde & Mamul)
    let stockItem1 = await StockItem.findOne({ where: { stockCode: 'STK-0001' } });
    if (!stockItem1) {
      stockItem1 = await StockItem.create({
        stockCode: 'STK-0001',
        barcode: '8690123456789',
        name: 'Paslanmaz Çelik Cıvata M8x50',
        description: '316 Kalite Paslanmaz Çelik Sanayi Tipi Cıvata (Hammadde Girdisi)',
        category: 'Hammadde',
        unit: 'Adet',
        brand: 'Norm Cıvata',
        model: 'M8x50-A4',
        currentStock: 1500,
        minStock: 200,
        maxStock: 5000,
        purchasePrice: 4.50,
        salePrice: 8.75,
        currency: 'TRY',
        taxRate: 20,
        warehouseLocation: 'Depo-A / Raf-04',
        supplier: 'Norm Bağlantı Elemanları A.Ş.',
        status: 'Active',
        createdBy: adminUser.id
      });
    }

    let stockItem2 = await StockItem.findOne({ where: { stockCode: 'STK-0002' } });
    if (!stockItem2) {
      stockItem2 = await StockItem.create({
        stockCode: 'STK-0002',
        barcode: '8690123456790',
        name: 'Endüstriyel Paslanmaz Jeneratör Şasisi',
        description: 'Fabrikada üretilen ve satışı yapılan nihai mamul ürün',
        category: 'Mamul',
        unit: 'Adet',
        brand: 'Enterprise ERP',
        model: 'GEN-SHASI-2026',
        currentStock: 12,
        minStock: 5,
        maxStock: 50,
        purchasePrice: 12000.00,
        salePrice: 24500.00,
        currency: 'TRY',
        taxRate: 20,
        warehouseLocation: 'Depo-B / Raf-12',
        supplier: 'İç Üretim (Fabrika)',
        status: 'Active',
        createdBy: adminUser.id
      });
    }

    let stockItem3 = await StockItem.findOne({ where: { stockCode: 'STK-0003' } });
    if (!stockItem3) {
      stockItem3 = await StockItem.create({
        stockCode: 'STK-0003',
        barcode: '8690123456791',
        name: '2mm Paslanmaz Çelik Sac Plaka 1200x2400',
        description: 'Lazer kesim ve büküm için ham sac plaka (Hammadde)',
        category: 'Hammadde',
        unit: 'Adet',
        brand: 'Erdemir',
        model: '304-SAC-2MM',
        currentStock: 350,
        minStock: 50,
        maxStock: 1000,
        purchasePrice: 450.00,
        salePrice: 750.00,
        currency: 'TRY',
        taxRate: 20,
        warehouseLocation: 'Depo-A / Raf-01',
        supplier: 'Erdemir Çelik A.Ş.',
        status: 'Active',
        createdBy: adminUser.id
      });
    }

    let stockItem4 = await StockItem.findOne({ where: { stockCode: 'STK-0004' } });
    if (!stockItem4) {
      stockItem4 = await StockItem.create({
        stockCode: 'STK-0004',
        barcode: '8690123456792',
        name: 'Bosch Professional Akülü Vidalama',
        description: 'GSR 18V-50 Kömürsüz Matkap (Ticari Mamul)',
        category: 'Ticari_Mal',
        unit: 'Adet',
        brand: 'Bosch',
        model: 'GSR 18V-50',
        currentStock: 45,
        minStock: 10,
        maxStock: 100,
        purchasePrice: 3200.00,
        salePrice: 4850.00,
        currency: 'TRY',
        taxRate: 20,
        warehouseLocation: 'Depo-B / Raf-08',
        supplier: 'Bosch A.Ş.',
        status: 'Active',
        createdBy: adminUser.id
      });
    }

    // 5. Seed Sample Sales Orders if empty (Selling Finished Goods `stockItem2`)
    const salesCount = await SaleOrder.count();
    if (salesCount === 0 && stockItem2) {
      await SaleOrder.bulkCreate([
        {
          orderNo: 'SAT-2026-0001',
          customerName: 'Mega İnşaat ve Sanayi A.Ş.',
          customerTaxNo: '6120345678',
          customerEmail: 'satinalma@megainsaat.com',
          customerPhone: '+90 (212) 555 1234',
          orderDate: '2026-08-01',
          deliveryDate: '2026-08-10',
          paymentTerm: 'Vadeli_30',
          status: 'Approved',
          priority: 'High',
          stockItemId: stockItem2.id,
          quantity: 2,
          unitPrice: 24500.00,
          discountRate: 5,
          taxRate: 20,
          subtotal: 49000.00,
          discountAmount: 2450.00,
          taxAmount: 9310.00,
          totalAmount: 55860.00,
          currency: 'TRY',
          shippingAddress: 'Organize Sanayi Bölgesi 4. Cadde No: 12 Ümraniye / İstanbul',
          billingAddress: 'Maslak Mah. Büyükdere Cad. No: 142 Şişli / İstanbul',
          salesRep: 'Selin Demir',
          notes: 'Müşteri acil sevk talep ediyor.',
          createdBy: salesUser.id
        }
      ]);
    }

    // 6. Seed Sample Purchase Orders if empty (Purchasing Raw Material `stockItem1`)
    const purchaseCount = await PurchaseOrder.count();
    if (purchaseCount === 0 && stockItem1) {
      await PurchaseOrder.bulkCreate([
        {
          orderNo: 'SATIN-2026-0001',
          supplierName: 'Norm Bağlantı Elemanları San. ve Tic. A.Ş.',
          supplierTaxNo: '6320987654',
          supplierContactPerson: 'Mehmet Kaplan',
          supplierEmail: 'siparis@normcivata.com.tr',
          supplierPhone: '+90 (232) 376 0000',
          orderDate: '2026-08-02',
          expectedDeliveryDate: '2026-08-12',
          paymentTerm: 'Vadeli_60',
          status: 'Ordered',
          priority: 'Normal',
          stockItemId: stockItem1.id,
          quantity: 1000,
          unitPrice: 4.50,
          discountRate: 10,
          taxRate: 20,
          subtotal: 4500.00,
          discountAmount: 450.00,
          taxAmount: 810.00,
          totalAmount: 4860.00,
          currency: 'TRY',
          deliveryWarehouse: 'Depo-A (Hammadde Ambarı)',
          purchasingAgent: 'Caner Öztürk',
          notes: 'Toplu ham madde alımı.',
          createdBy: purchaseUser.id
        }
      ]);
    }

    // 7. Seed Sample Production Orders if empty (Manufacturing Finished Good `stockItem2`)
    const productionCount = await ProductionOrder.count();
    if (productionCount === 0 && stockItem2) {
      await ProductionOrder.bulkCreate([
        {
          workOrderNo: 'URETIM-2026-0001',
          productionTitle: 'Paslanmaz Bağlantı Şasisi İmalatı',
          stockItemId: stockItem2.id,
          plannedQuantity: 10,
          completedQuantity: 0,
          scrapQuantity: 0,
          unit: 'Adet',
          status: 'In_Production',
          priority: 'High',
          workCenter: 'İstasyon-2 (Kaynak & Sac İşleme)',
          plannedStartDate: '2026-08-03',
          plannedEndDate: '2026-08-15',
          actualStartDate: '2026-08-03',
          estimatedHours: 24.0,
          actualHours: 12.5,
          bomNotes: '4x STK-0001 Cıvata, 1x STK-0003 Sac Plaka',
          productionManager: 'Oğuz Aydın',
          notes: 'Seri imalat üretimi.',
          createdBy: productionUser.id
        }
      ]);
    }

    // 8. Seed Sample BOM Items if empty (Finished Good `stockItem2` requires Raw Material `stockItem1` & `stockItem3`)
    const bomCount = await BOMItem.count();
    if (bomCount === 0 && stockItem1 && stockItem2 && stockItem3) {
      await BOMItem.bulkCreate([
        {
          bomCode: 'BOM-2026-0001',
          finishedStockItemId: stockItem2.id,
          componentStockItemId: stockItem1.id,
          quantityRequired: 8.0,
          unit: 'Adet',
          scrapPercentage: 1.0,
          notes: '1 adet şasi montajı için 8 adet paslanmaz cıvata gerekir.'
        },
        {
          bomCode: 'BOM-2026-0002',
          finishedStockItemId: stockItem2.id,
          componentStockItemId: stockItem3.id,
          quantityRequired: 1.0,
          unit: 'Adet',
          scrapPercentage: 2.0,
          notes: '1 adet şasi gövdesi için 1 adet paslanmaz sac plaka kesilir.'
        }
      ]);
    }
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

module.exports = seedInitialData;
