const validateSaleCreate = (req) => {
  const { customerName, orderDate, stockItemId, quantity, unitPrice, paymentTerm, status, currency } = req.body || {};
  const errors = [];

  if (!customerName || customerName.trim().length === 0) {
    errors.push('Müşteri ticari unvanı zorunludur.');
  }

  if (!orderDate || orderDate.trim().length === 0) {
    errors.push('Sipariş tarihi zorunludur.');
  }

  if (!stockItemId || String(stockItemId).trim().length === 0) {
    errors.push('Stok kartı seçilmesi zorunludur.');
  }

  const parsedQty = parseFloat(quantity);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    errors.push('Sipariş miktarı sıfırdan büyük geçerli bir sayı olmalıdır.');
  }

  const parsedPrice = parseFloat(unitPrice);
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    errors.push('Birim fiyat negatif olamaz.');
  }

  const validPaymentTerms = ['Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'];
  if (!paymentTerm || !validPaymentTerms.includes(paymentTerm)) {
    errors.push('Geçerli bir ödeme koşulu seçiniz.');
  }

  const validStatuses = ['Draft', 'Pending_Approval', 'Approved', 'Preparing', 'Shipped', 'Completed', 'Cancelled'];
  if (!status || !validStatuses.includes(status)) {
    errors.push('Geçerli bir sipariş durumu seçiniz.');
  }

  const validCurrencies = ['TRY', 'USD', 'EUR'];
  if (!currency || !validCurrencies.includes(currency)) {
    errors.push('Geçerli bir para birimi seçiniz.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = { validateSaleCreate };
