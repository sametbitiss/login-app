const validateProductionOrderCreate = (req) => {
  const { productionTitle, stockItemId, plannedQuantity, workCenter, plannedStartDate, plannedEndDate } = req.body || {};
  const errors = [];

  if (!productionTitle || productionTitle.trim().length < 3) {
    errors.push('Üretim başlığı en az 3 karakter olmalıdır.');
  }

  if (!stockItemId) {
    errors.push('Üretilecek nihai ürün / stok kartı seçimi zorunludur.');
  }

  const qty = parseFloat(plannedQuantity);
  if (isNaN(qty) || qty <= 0) {
    errors.push('Planlanan üretim miktarı 0\'dan büyük bir sayı olmalıdır.');
  }

  if (!workCenter || workCenter.trim().length === 0) {
    errors.push('İş merkezi / istasyon seçimi zorunludur.');
  }

  if (!plannedStartDate) {
    errors.push('Planlanan başlama tarihi zorunludur.');
  }

  if (!plannedEndDate) {
    errors.push('Planlanan bitiş tarihi zorunludur.');
  }

  if (plannedStartDate && plannedEndDate && new Date(plannedStartDate) > new Date(plannedEndDate)) {
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
