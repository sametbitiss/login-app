const validateStockCreate = (req) => {
  const { stockCode, name, category, unit, currency, status } = req.body || {};
  const errors = [];

  if (!stockCode || stockCode.trim().length === 0) {
    errors.push('Stok kodu zorunludur.');
  }

  if (!name || name.trim().length === 0) {
    errors.push('Stok adı (Ürün adı) zorunludur.');
  } else if (name.trim().length > 200) {
    errors.push('Stok adı en fazla 200 karakter olabilir.');
  }

  const validCategories = ['Hammadde', 'Yari_Mamul', 'Mamul', 'Ticari_Mal', 'Hizmet', 'Diger'];
  if (!category || category.trim().length === 0) {
    errors.push('Kategori seçilmesi zorunludur.');
  } else if (!validCategories.includes(category)) {
    errors.push('Geçersiz stok kategorisi seçildi.');
  }

  const validUnits = ['Adet', 'Kg', 'Lt', 'Mt', 'M2', 'M3', 'Paket', 'Koli', 'Ton', 'Set'];
  if (!unit || unit.trim().length === 0) {
    errors.push('Birim seçilmesi zorunludur.');
  } else if (!validUnits.includes(unit)) {
    errors.push('Geçersiz birim seçildi.');
  }

  const validCurrencies = ['TRY', 'USD', 'EUR'];
  if (!currency || currency.trim().length === 0) {
    errors.push('Para birimi seçilmesi zorunludur.');
  } else if (!validCurrencies.includes(currency)) {
    errors.push('Geçersiz para birimi seçildi.');
  }

  const validStatuses = ['Active', 'Passive', 'Discontinued'];
  if (!status || status.trim().length === 0) {
    errors.push('Durum seçilmesi zorunludur.');
  } else if (!validStatuses.includes(status)) {
    errors.push('Geçersiz durum seçildi.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = { validateStockCreate };
