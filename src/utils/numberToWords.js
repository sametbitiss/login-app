function convertNumberToTurkishWords(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Yalnız Sıfır Türk Lirası';
  
  const numVal = parseFloat(amount);
  const units = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const tens = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const hundreds = ['', 'Yüz', 'İki Yüz', 'Üç Yüz', 'Dört Yüz', 'Beş Yüz', 'Altı Yüz', 'Yedi Yüz', 'Sekiz Yüz', 'Dokuz Yüz'];

  let num = Math.floor(Math.abs(numVal));
  let kurus = Math.round((Math.abs(numVal) - num) * 100);

  if (num === 0 && kurus === 0) return 'Yalnız Sıfır Türk Lirası';

  function convertGroup(n) {
    let res = '';
    let h = Math.floor(n / 100);
    let t = Math.floor((n % 100) / 10);
    let u = n % 10;
    if (h > 0) res += (h === 1 ? 'Yüz' : hundreds[h]) + ' ';
    if (t > 0) res += tens[t] + ' ';
    if (u > 0) res += units[u] + ' ';
    return res.trim();
  }

  let result = '';
  let billions = Math.floor(num / 1000000000);
  let millions = Math.floor((num % 1000000000) / 1000000);
  let thousands = Math.floor((num % 1000000) / 1000);
  let ones = num % 1000;

  if (billions > 0) result += convertGroup(billions) + ' Milyar ';
  if (millions > 0) result += convertGroup(millions) + ' Milyon ';
  if (thousands > 0) {
    if (thousands === 1) result += 'Bin ';
    else result += convertGroup(thousands) + ' Bin ';
  }
  if (ones > 0) result += convertGroup(ones);

  let output = 'Yalnız ' + (result.trim() || 'Sıfır') + ' Türk Lirası';
  if (kurus > 0) {
    output += ' ' + convertGroup(kurus) + ' Kuruş';
  }
  return output;
}

module.exports = convertNumberToTurkishWords;
