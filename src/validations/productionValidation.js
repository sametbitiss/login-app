const validateProductionOrderCreate = (req) => {
  const { 
    productionTitle, 
    uretimBasligi, 
    stockItemId, 
    stockId, 
    plannedQuantity, 
    miktar, 
    plannedStartDate, 
    planlananBaslangicTarihi, 
    plannedEndDate, 
    planlananBitisTarihi 
  } = req.body || {};
  const errors = [];

  const title = uretimBasligi || productionTitle;
  // If title is missing, it will be auto-generated in controller, but if provided, must be valid
  if (title && title.trim().length > 0 && title.trim().length < 3) {
    errors.push('Üretim başlığı en az 3 karakter olmalıdır.');
  }

  const targetStockId = stockId || stockItemId;
  if (!targetStockId) {
    errors.push('Üretilecek nihai ürün / stok kartı seçimi zorunludur.');
  }

  const qty = parseFloat(plannedQuantity || miktar);
  if (isNaN(qty) || qty <= 0) {
    errors.push('Planlanan üretim miktarı 0\'dan büyük bir sayı olmalıdır.');
  }

  const startDate = plannedStartDate || planlananBaslangicTarihi;
  const endDate = plannedEndDate || planlananBitisTarihi;

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push('Planlanan başlama tarihi, bitiş tarihinden sonra olamaz.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateProductionOrderCreate
};
