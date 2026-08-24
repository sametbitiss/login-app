const {
  UretimEmri,
  UrunRecetesi,
  StokKarti,
  StokHareketi,
  sequelize
} = require('../../models');

class ProductionService {
  async startMESJob(orderId, workCenterId, currentUser = null) {
    return await sequelize.transaction(async (t) => {
      const order = await UretimEmri.findByPk(orderId, { transaction: t });
      if (!order) throw new Error('İş emri bulunamadı.');

      const startTime = new Date();
      let notlar = order.notlar || '';
      // If there was a pause tag, remove it
      notlar = notlar.replace(/\[DURAKLATILDI[^\]]*\][^\n]*/g, '').trim();
      notlar += (notlar ? '\n' : '') + `[İŞ BAŞLATILDI - ${startTime.toLocaleTimeString('tr-TR')}]: Üretim operatör tarafından başlatıldı.`;

      await order.update({
        durum: 'In_Production',
        gerceklesenBaslangicTarihi: order.gerceklesenBaslangicTarihi || startTime,
        uretimYonetici: currentUser ? (currentUser.fullName || `${currentUser.ad || ''} ${currentUser.soyad || ''}`.trim() || currentUser.kullaniciAdi) : order.uretimYonetici,
        notlar
      }, { transaction: t });

      if (workCenterId) {
        const { IsMerkezi } = require('../../models');
        const wc = await IsMerkezi.findByPk(workCenterId, { transaction: t });
        if (wc && wc.durum !== 'Maintenance') {
          await wc.update({ durum: 'Active' }, { transaction: t });
        }
      }

      return order;
    });
  }

  async pauseMESJob(orderId, workCenterId, reason, notes, currentUser = null) {
    return await sequelize.transaction(async (t) => {
      const order = await UretimEmri.findByPk(orderId, { transaction: t });
      if (!order) throw new Error('İş emri bulunamadı.');

      const pauseTime = new Date().toLocaleTimeString('tr-TR');
      let notlar = order.notlar || '';
      notlar += (notlar ? '\n' : '') + `[DURAKLATILDI: ${reason} - ${pauseTime}]: ${notes}`;

      await order.update({
        notlar
      }, { transaction: t });

      return order;
    });
  }

  async recordProductionOutput(orderId, completedQty, scrapQty = 0, currentUser = null, notes = '') {
    return await sequelize.transaction(async (t) => {
      const order = await UretimEmri.findByPk(orderId, {
        include: [{ model: StokKarti, as: 'stokKarti' }],
        transaction: t
      });

      if (!order) {
        throw new Error('İş emri bulunamadı.');
      }

      const additionalCompleted = parseFloat(completedQty) || 0;
      const additionalScrap = parseFloat(scrapQty) || 0;

      const newCompletedTotal = parseFloat(order.tamamlananMiktar || 0) + additionalCompleted;
      const newScrapTotal = parseFloat(order.fireMiktari || 0) + additionalScrap;

      const bomItems = await UrunRecetesi.findAll({
        where: { mamulStokId: order.stokId, kalemTuru: 'Material' },
        transaction: t
      });

      for (const bom of bomItems) {
        if (!bom.bilesenStokId) continue;
        const scrapMult = 1 + (parseFloat(bom.fireOrani || 0) / 100);
        const requiredMaterialQty = parseFloat(bom.gerekliMiktar) * additionalCompleted * scrapMult;

        const componentItem = await StokKarti.findByPk(bom.bilesenStokId, { transaction: t });
        if (componentItem) {
          const oldStock = parseFloat(componentItem.mevcutStok || 0);
          const newStock = Math.max(0, oldStock - requiredMaterialQty);
          await componentItem.update({ mevcutStok: newStock }, { transaction: t });

          await StokHareketi.create({
            hareketNo: `MOV-BF-${Date.now().toString().slice(-6)}`,
            stokId: componentItem.id,
            hareketTuru: 'Outbound',
            miktar: requiredMaterialQty,
            birim: componentItem.birim,
            referansNo: order.isEmriNo,
            notlar: `Üretim Düşümü (Backflushing): ${order.isEmriNo} — ${order.uretimBasligi}`,
            yapanKullaniciId: currentUser ? currentUser.id : null
          }, { transaction: t });
        }
      }

      const finishedItem = await StokKarti.findByPk(order.stokId, { transaction: t });
      if (finishedItem) {
        const oldFinishedStock = parseFloat(finishedItem.mevcutStok || 0);
        await finishedItem.update({ mevcutStok: oldFinishedStock + additionalCompleted }, { transaction: t });

        await StokHareketi.create({
          hareketNo: `MOV-PRD-${Date.now().toString().slice(-6)}`,
          stokId: finishedItem.id,
          hareketTuru: 'Inbound',
          miktar: additionalCompleted,
          birim: finishedItem.birim,
          referansNo: order.isEmriNo,
          notlar: `Üretim Girişi (Mamul): ${order.isEmriNo} — ${order.uretimBasligi}`,
          yapanKullaniciId: currentUser ? currentUser.id : null
        }, { transaction: t });
      }

      const plannedQty = parseFloat(order.planlananMiktar);
      let newStatus = order.durum;
      if (newCompletedTotal >= plannedQty || additionalCompleted >= plannedQty) {
        newStatus = 'Completed';
      } else if (additionalCompleted > 0 && order.durum === 'Planned') {
        newStatus = 'In_Production';
      }

      let updatedNotlar = order.notlar || '';
      if (notes && notes.trim()) {
        updatedNotlar += (updatedNotlar ? '\n' : '') + `[MES TAMAMLANDI - ${new Date().toLocaleTimeString('tr-TR')}]: ${notes.trim()}`;
      }

      await order.update({
        tamamlananMiktar: newCompletedTotal,
        fireMiktari: newScrapTotal,
        durum: newStatus,
        gerceklesenBitisTarihi: newStatus === 'Completed' ? new Date() : order.gerceklesenBitisTarihi,
        notlar: updatedNotlar
      }, { transaction: t });

      return order;
    });
  }
}

module.exports = new ProductionService();
