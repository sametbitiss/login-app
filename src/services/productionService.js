const {
  UretimEmri,
  UrunRecetesi,
  StokKarti,
  StokHareketi,
  sequelize
} = require('../../models');

class ProductionService {
  async recordProductionOutput(orderId, completedQty, scrapQty = 0, currentUser = null) {
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

      const newCompletedTotal = parseFloat(order.tamamlananMiktar) + additionalCompleted;
      const newScrapTotal = parseFloat(order.fireMiktari) + additionalScrap;

      const bomItems = await UrunRecetesi.findAll({
        where: { mamulStokId: order.stokId },
        transaction: t
      });

      for (const bom of bomItems) {
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
      if (newCompletedTotal >= plannedQty) {
        newStatus = 'Completed';
      } else if (additionalCompleted > 0 && order.durum === 'Planned') {
        newStatus = 'In_Production';
      }

      await order.update({
        tamamlananMiktar: newCompletedTotal,
        fireMiktari: newScrapTotal,
        durum: newStatus,
        gerceklesenBitisTarihi: newStatus === 'Completed' ? new Date() : order.gerceklesenBitisTarihi
      }, { transaction: t });

      return order;
    });
  }
}

module.exports = new ProductionService();
