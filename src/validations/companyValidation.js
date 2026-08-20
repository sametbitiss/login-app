/**
 * Strict & Pure Numeric Validation Rules for Company & Firm Profile Settings
 */

const validateCompanyProfile = (req) => {
  let {
    unvan,
    vergiNo,
    mersisNo,
    ticaretSicilNo,
    telefon,
    eposta,
    webSitesi
  } = req.body;

  const errors = [];

  // Sanitize values
  unvan = (unvan || '').trim();
  vergiNo = (vergiNo || '').trim();
  mersisNo = (mersisNo || '').trim();
  ticaretSicilNo = (ticaretSicilNo || '').trim();
  telefon = (telefon || '').trim();
  eposta = (eposta || '').trim();
  webSitesi = (webSitesi || '').trim();

  // 1. Unvan Validation (Required, at least 3 chars)
  if (!unvan || unvan.length < 3) {
    errors.push('Resmi Şirket Unvanı zorunludur ve en az 3 karakter olmalıdır.');
  }

  // 2. Kurumsal Web Sitesi Validation (Multi-level TLD support: .com, .com.tr, .co.uk)
  if (webSitesi !== '') {
    const domainRegex = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+(\/.*)?$/;
    if (!domainRegex.test(webSitesi)) {
      errors.push('Kurumsal Web Sitesi geçerli bir web sitesi veya domain adresi olmalıdır (Örn: www.enterprise-erp.com.tr veya enterprise-erp.com).');
    }
  }

  // 3. Vergi Numarası Validation (Strictly 10 Numeric Digits Only)
  if (vergiNo !== '') {
    if (!/^\d{10}$/.test(vergiNo)) {
      errors.push('Vergi Numarası sadece rakamlardan oluşmalı ve tam 10 haneli olmalıdır (Örn: 1234567890).');
    }
  }

  // 4. Mersis Numarası Validation (Strictly 16 Numeric Digits Only)
  if (mersisNo !== '') {
    if (!/^\d{16}$/.test(mersisNo)) {
      errors.push('Mersis Numarası sadece rakamlardan oluşmalı ve tam 16 haneli olmalıdır (Örn: 0123456789000015).');
    }
  }

  // 5. Ticaret Sicil No Validation (Strictly 4-12 Numeric Digits Only)
  if (ticaretSicilNo !== '') {
    if (!/^\d{4,12}$/.test(ticaretSicilNo)) {
      errors.push('Ticaret Sicil Numarası sadece rakamlardan oluşmalı ve 4 ile 12 haneli olmalıdır (Örn: 123456).');
    }
  }

  // 6. Telefon Numarası Validation (Strictly 7-11 Numeric Digits Only, NO letters, NO symbols!)
  if (telefon !== '') {
    if (!/^\d{7,11}$/.test(telefon)) {
      errors.push('Telefon numarası alanına kesinlikle sadece rakam girilmelidir (7 ile 11 haneli rakam. Örn: 02244440377 veya 4440377).');
    }
  }

  // 7. Kurumsal E-Posta Adresi Validation (Strict Email Pattern)
  if (eposta !== '') {
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(eposta)) {
      errors.push('Kurumsal E-Posta adresi geçerli ve eksiksiz olmalıdır (Örn: satis@enterprise-erp.com.tr).');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateCompanyProfile
};
