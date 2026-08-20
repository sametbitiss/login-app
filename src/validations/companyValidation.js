/**
 * Validation rules for Company & Firm Profile Settings
 */

const validateCompanyProfile = (req) => {
  const {
    unvan,
    vergiNo,
    mersisNo,
    ticaretSicilNo,
    telefon,
    eposta,
    webSitesi
  } = req.body;

  const errors = [];

  // 1. Unvan Validation (Required)
  if (!unvan || unvan.trim().length < 3) {
    errors.push('Resmi Şirket Unvanı en az 3 karakter olmalıdır.');
  }

  // 2. Vergi Numarası Validation (Optional, 10 Digits)
  if (vergiNo && vergiNo.trim() !== '') {
    const vNo = vergiNo.trim();
    if (!/^\d{10}$/.test(vNo)) {
      errors.push('Vergi Numarası tam olarak 10 haneli rakamlardan oluşmalıdır.');
    }
  }

  // 3. Mersis Numarası Validation (Optional, 16 Digits)
  if (mersisNo && mersisNo.trim() !== '') {
    const mNo = mersisNo.trim();
    if (!/^\d{16}$/.test(mNo)) {
      errors.push('Mersis Numarası tam olarak 16 haneli rakamlardan oluşmalıdır.');
    }
  }

  // 4. Ticaret Sicil No Validation (Optional, 3-15 chars)
  if (ticaretSicilNo && ticaretSicilNo.trim() !== '') {
    const tsNo = ticaretSicilNo.trim();
    if (!/^[a-zA-Z0-9\s\.\-\/]{3,15}$/.test(tsNo)) {
      errors.push('Ticaret Sicil No 3 ile 15 karakter arasında olmalıdır.');
    }
  }

  // 5. Telefon Numarası Validation (Optional, minimum 10 digits)
  if (telefon && telefon.trim() !== '') {
    const tel = telefon.trim();
    const digitCount = tel.replace(/\D/g, '').length;
    if (digitCount < 10 || digitCount > 15 || !/^\+?[\d\s\(\)\-]{10,20}$/.test(tel)) {
      errors.push('Telefon numarası alanına geçerli bir telefon formatı giriniz (Örn: +90 (224) 444 0 377).');
    }
  }

  // 6. E-Posta Validation (Optional, valid email regex)
  if (eposta && eposta.trim() !== '') {
    const email = eposta.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Lütfen geçerli bir e-posta adresi giriniz (Örn: satis@enterprise-erp.com.tr).');
    }
  }

  // 7. Web Sitesi Validation (Optional, valid URL/domain)
  if (webSitesi && webSitesi.trim() !== '') {
    const web = webSitesi.trim();
    const urlRegex = /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/.*)?$/i;
    if (!urlRegex.test(web)) {
      errors.push('Lütfen geçerli bir web sitesi adresi giriniz (Örn: www.enterprise-erp.com.tr veya https://example.com).');
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
