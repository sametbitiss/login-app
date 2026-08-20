/**
 * Refined & Robust Validation Rules for Company & Firm Profile Settings
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

  // 1. Unvan Validation (Required)
  if (!unvan || unvan.length < 3) {
    errors.push('Resmi Şirket Unvanı zorunludur ve en az 3 karakter olmalıdır.');
  }

  // 2. Kurumsal Web Sitesi Validation
  if (webSitesi !== '') {
    // Matches example.com, www.example.com, https://www.example.com.tr, etc.
    const domainRegex = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(\/.*)?$/;
    if (!domainRegex.test(webSitesi)) {
      errors.push('Kurumsal Web Sitesi geçerli bir alan adı veya URL formatında olmalıdır (Örn: www.enterprise-erp.com.tr veya enterprise-erp.com).');
    }
  }

  // 3. Vergi Numarası Validation (10 Digits)
  if (vergiNo !== '') {
    if (!/^\d{10}$/.test(vergiNo)) {
      errors.push('Vergi Numarası tam olarak 10 haneli rakamlardan oluşmalıdır (Örn: 1234567890).');
    }
  }

  // 4. Mersis Numarası Validation (16 Digits)
  if (mersisNo !== '') {
    if (!/^\d{16}$/.test(mersisNo)) {
      errors.push('Mersis Numarası tam olarak 16 haneli rakamlardan oluşmalıdır (Örn: 0123456789000015).');
    }
  }

  // 5. Ticaret Sicil No Validation (4-20 Alphanumeric/Hyphen + Turkish Chars)
  if (ticaretSicilNo !== '') {
    if (!/^[a-zA-Z0-9çğıöşüÇĞİÖŞÜ\s\.\-\/]{4,20}$/u.test(ticaretSicilNo)) {
      errors.push('Ticaret Sicil Numarası en az 4 karakterden ve geçerli sicil karakterlerinden oluşmalıdır (Örn: 123456 veya 345678-0).');
    }
  }

  // 6. Kurumsal Telefon Numarası Validation (Türkiye ve Uluslararası Formatlar + 444 / 0850 Santral)
  if (telefon !== '') {
    const cleanTel = telefon.replace(/[\s\(\)\-\.]/g, '');
    const phoneRegex = /^(\+?90|0)?(444\d{4}|850\d{7}|[1-9]\d{9})$/;
    
    if (!phoneRegex.test(cleanTel)) {
      errors.push('Telefon numarası geçerli bir Türkiye kurumsal veya uluslararası formatta olmalıdır (Örn: +90 (224) 444 0 377, 0850 123 45 67 veya 444 0 377).');
    }
  }

  // 7. Kurumsal E-Posta Adresi Validation (Strict Email Rules)
  if (eposta !== '') {
    const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(eposta)) {
      errors.push('Kurumsal E-Posta adresi geçerli ve eksiksiz bir e-posta formatında olmalıdır (Örn: satis@enterprise-erp.com.tr).');
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
