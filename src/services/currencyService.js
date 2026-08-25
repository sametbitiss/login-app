const https = require('https');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');

class CurrencyService {
  constructor() {
    this.cache = {
      rates: { TRY: 1.0, USD: 48.0, EUR: 56.0 },
      lastFetched: 0,
      ttlMs: 10 * 60 * 1000 // 10 minutes cache
    };
  }

  fetchJson(url, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'EnterpriseERP/2.0' }, timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Currency API Timeout')); });
    });
  }

  async getLiveRates() {
    const now = Date.now();
    if (now - this.cache.lastFetched < this.cache.ttlMs && this.cache.rates.USD && this.cache.rates.EUR) {
      return { ...this.cache.rates, isLive: true, cachedAt: new Date(this.cache.lastFetched) };
    }

    try {
      // Primary Live API: open.er-api.com
      const data = await this.fetchJson('https://open.er-api.com/v6/latest/USD', 3500);
      if (data && data.rates && data.rates.TRY) {
        const usdToTry = parseFloat(data.rates.TRY);
        const eurToTry = data.rates.EUR ? (usdToTry / parseFloat(data.rates.EUR)) : (usdToTry * 1.16);

        this.cache.rates = {
          TRY: 1.0,
          USD: Number(usdToTry.toFixed(4)),
          EUR: Number(eurToTry.toFixed(4))
        };
        this.cache.lastFetched = now;

        // Try to update DB DovizKuru asynchronously
        try {
          await exchangeRateRepository.create({ dovizKodu: 'USD', tryKuru: this.cache.rates.USD, kaynak: 'Live API (OpenER)' }, null);
          await exchangeRateRepository.create({ dovizKodu: 'EUR', tryKuru: this.cache.rates.EUR, kaynak: 'Live API (OpenER)' }, null);
        } catch (dbErr) {
          // Silent DB sync error
        }

        return { ...this.cache.rates, isLive: true, cachedAt: new Date(now) };
      }
    } catch (err1) {
      console.warn('Primary Currency API failed, attempting secondary:', err1.message);
      try {
        // Secondary Live API: api.exchangerate-api.com
        const data2 = await this.fetchJson('https://api.exchangerate-api.com/v4/latest/USD', 3500);
        if (data2 && data2.rates && data2.rates.TRY) {
          const usdToTry = parseFloat(data2.rates.TRY);
          const eurToTry = data2.rates.EUR ? (usdToTry / parseFloat(data2.rates.EUR)) : (usdToTry * 1.16);

          this.cache.rates = {
            TRY: 1.0,
            USD: Number(usdToTry.toFixed(4)),
            EUR: Number(eurToTry.toFixed(4))
          };
          this.cache.lastFetched = now;
          return { ...this.cache.rates, isLive: true, cachedAt: new Date(now) };
        }
      } catch (err2) {
        console.warn('Secondary Currency API failed, falling back to DB/default:', err2.message);
      }
    }

    // Fallback: Read from DB
    try {
      const dbRates = await exchangeRateRepository.getLatestRates();
      if (dbRates && dbRates.USD) {
        this.cache.rates = {
          TRY: 1.0,
          USD: parseFloat(dbRates.USD) || 48.0,
          EUR: parseFloat(dbRates.EUR) || 56.0
        };
        this.cache.lastFetched = now;
        return { ...this.cache.rates, isLive: false, cachedAt: new Date(now) };
      }
    } catch (e) {
      console.warn('DB Exchange rate fallback failed:', e.message);
    }

    return { ...this.cache.rates, isLive: false, cachedAt: new Date(now) };
  }

  convertToTRY(amount, currency = 'TRY', rates = null) {
    const num = parseFloat(amount) || 0;
    const curr = (currency || 'TRY').toUpperCase().trim();
    if (curr === 'TRY' || curr === 'TL') return num;

    const currentRates = rates || this.cache.rates;
    const rate = currentRates[curr] || (curr === 'USD' ? 48.0 : (curr === 'EUR' ? 56.0 : 1.0));
    return num * rate;
  }
}

module.exports = new CurrencyService();
