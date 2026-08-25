'use strict';

const {
  UretimEmri,
  UretimEmriOperasyon,
  RotaOperasyon,
  IsMerkezi,
  UrunRecetesi,
  StokKarti,
  StokHareketi,
  sequelize
} = require('../../models');
const { Op } = require('sequelize');
const { ValidationError, NotFoundError } = require('../utils/appError');

class ProductionService {
  /**
   * Bir iş emri onaylandığında veya başlatıldığında, ürünün rotasındaki adımlara
   * göre alt operasyon iş emirlerini (UretimEmriOperasyon) parçalayarak oluşturur.
   */
  async createWorkOrderOperations(order, transaction = null) {
    const runInTx = async (t) => {
      const stockId = order.stokId;
      const plannedQty = parseFloat(order.planlananMiktar || 1);
      const unit = order.birim || 'Adet';

      // Mevcut operasyonlar varsa tekrar oluşturma
      const existingOps = await UretimEmriOperasyon.findAll({
        where: { uretimEmriId: order.id },
        transaction: t
      });
      if (existingOps.length > 0) {
        return existingOps;
      }

      // Ürünün aktif rotasını çek
      const routingOperations = await RotaOperasyon.findAll({
        where: { stokId: stockId, durum: 'Active' },
        include: [{ model: IsMerkezi, as: 'isMerkeziKarti' }],
        order: [['operasyonSira', 'ASC'], ['id', 'ASC']],
        transaction: t
      });

      const allWorkCenters = await IsMerkezi.findAll({ transaction: t });
      const createdOps = [];

      if (routingOperations.length > 0) {
        let prevOpId = null;

        for (let i = 0; i < routingOperations.length; i++) {
          const rota = routingOperations[i];
          const isFirstStep = i === 0;
          const isMerkeziText = rota.isMerkezi || (rota.isMerkeziKarti ? rota.isMerkeziKarti.isMerkeziAdi : null);
          
          // Eşleşen iş merkezi ID'sini tespit et
          let matchedWcId = rota.isMerkeziId;
          if (!matchedWcId && isMerkeziText) {
            const foundWc = allWorkCenters.find(w => 
              isMerkeziText.includes(w.isMerkeziKodu) || 
              isMerkeziText.includes(w.isMerkeziAdi) ||
              w.isMerkeziAdi === isMerkeziText
            );
            if (foundWc) matchedWcId = foundWc.id;
          }
          if (!matchedWcId && allWorkCenters.length > 0) {
            matchedWcId = allWorkCenters[0].id;
          }

          const setupMin = parseFloat(rota.hazirlikSuresiDakika || 15);
          const unitRunMin = parseFloat(rota.calismaSuresiDakikaBirim || 5);
          const totalEstMinutes = parseFloat((setupMin + (unitRunMin * plannedQty)).toFixed(2));

          const opCode = rota.operasyonKodu || `OPS-${rota.operasyonSira || (i + 1) * 10}`;
          const opSubNo = `${order.isEmriNo}/OP-${String(rota.operasyonSira || (i + 1) * 10).padStart(2, '0')}`;

          const newOp = await UretimEmriOperasyon.create({
            uretimEmriId: order.id,
            isEmriNo: opSubNo,
            stokId: stockId,
            rotaOperasyonId: rota.id,
            operasyonSira: rota.operasyonSira || (i + 1) * 10,
            operasyonKodu: opCode,
            operasyonAdi: rota.operasyonAdi || `Operasyon ${i + 1}`,
            isMerkeziId: matchedWcId,
            isMerkezi: isMerkeziText || (allWorkCenters.find(w => w.id === matchedWcId)?.isMerkeziAdi || 'Genel İstasyon'),
            planlananMiktar: plannedQty,
            tamamlananMiktar: 0,
            fireMiktari: 0,
            birim: unit,
            hazirlikSuresiDakika: setupMin,
            calismaSuresiDakikaBirim: unitRunMin,
            toplamTahminiDakika: totalEstMinutes,
            // İlk adım hemen başlatılabilir (Ready), sonraki adımlar önceki adım tamamlanana kadar kilitli (Waiting_Previous_Op)
            durum: isFirstStep ? 'Ready' : 'Waiting_Previous_Op',
            oncekiOperasyonId: prevOpId,
            sonrakiOperasyonId: null,
            notlar: `[Rota Operasyonu #${rota.operasyonSira}] ${rota.talimatlar || ''}`.trim()
          }, { transaction: t });

          if (prevOpId && createdOps[i - 1]) {
            await createdOps[i - 1].update({ sonrakiOperasyonId: newOp.id }, { transaction: t });
          }

          prevOpId = newOp.id;
          createdOps.push(newOp);
        }
      } else {
        // Rotası tanımlı olmayan ürünler için tek adım oluştur
        let defaultWc = allWorkCenters[0] || null;
        if (order.isMerkezi) {
          const found = allWorkCenters.find(w => 
            order.isMerkezi.includes(w.isMerkeziKodu) || 
            order.isMerkezi.includes(w.isMerkeziAdi)
          );
          if (found) defaultWc = found;
        }

        const defaultOp = await UretimEmriOperasyon.create({
          uretimEmriId: order.id,
          isEmriNo: `${order.isEmriNo}/OP-10`,
          stokId: stockId,
          rotaOperasyonId: null,
          operasyonSira: 10,
          operasyonKodu: 'OPS-10',
          operasyonAdi: 'Genel İmalat & Montaj Operasyonu',
          isMerkeziId: defaultWc ? defaultWc.id : null,
          isMerkezi: defaultWc ? `[${defaultWc.isMerkeziKodu}] ${defaultWc.isMerkeziAdi}` : (order.isMerkezi || 'Genel Montaj'),
          planlananMiktar: plannedQty,
          tamamlananMiktar: 0,
          fireMiktari: 0,
          birim: unit,
          hazirlikSuresiDakika: 15,
          calismaSuresiDakikaBirim: 5,
          toplamTahminiDakika: parseFloat((15 + (5 * plannedQty)).toFixed(2)),
          durum: 'Ready',
          oncekiOperasyonId: null,
          sonrakiOperasyonId: null,
          notlar: order.notlar || 'Genel İmalat Adımı'
        }, { transaction: t });

        createdOps.push(defaultOp);
      }

      if (createdOps.length > 0) {
        const totalDurationHours = createdOps.reduce((sum, o) => sum + (parseFloat(o.toplamTahminiDakika || 0) / 60), 0);
        await order.update({ tahminiSaat: parseFloat(totalDurationHours.toFixed(2)) }, { transaction: t });
      }

      return createdOps;
    };

    if (transaction) {
      return await runInTx(transaction);
    } else {
      return await sequelize.transaction(runInTx);
    }
  }

  /**
   * MES Terminali: Bir iş adımını / operasyonunu başlatır.
   * Önceki adım tamamlanmamışsa kesinlikle başlatmaya izin vermez!
   */
  async startMESJob(opOrOrderId, workCenterId, currentUser = null) {
    return await sequelize.transaction(async (t) => {
      // 1. Önce UretimEmriOperasyon olarak ara, yoksa UretimEmri olarak dene
      let op = await UretimEmriOperasyon.findByPk(opOrOrderId, {
        include: [
          { model: UretimEmri, as: 'uretimEmri' },
          { model: UretimEmriOperasyon, as: 'oncekiOperasyon' },
          { model: IsMerkezi, as: 'isMerkeziKarti' },
          { model: StokKarti, as: 'stokKarti' }
        ],
        transaction: t
      });

      if (!op) {
        // Eğer sipariş ID'si verilmişse ve operasyonları varsa ilk başlatılabilir adımı al
        const ops = await UretimEmriOperasyon.findAll({
          where: { uretimEmriId: opOrOrderId },
          order: [['operasyonSira', 'ASC']],
          transaction: t
        });
        if (ops.length > 0) {
          op = ops.find(o => o.durum === 'Ready') || ops[0];
        }
      }

      if (!op) {
        throw new NotFoundError('Başlatılacak operasyon iş adımı bulunamadı.');
      }

      // 2. BAĞIMLILIK KONTROLÜ: Önceki operasyon tamamlanmış mı?
      if (op.durum === 'Waiting_Previous_Op') {
        const prevOpName = op.oncekiOperasyon ? `"${op.oncekiOperasyon.operasyonAdi}" (Adım #${op.oncekiOperasyon.operasyonSira})` : 'Önceki Adım';
        throw new ValidationError(`⛔ Bu işlem başlatılamaz! Önceki adım olan ${prevOpName} henüz tamamlanmamıştır. Lütfen önce önceki istasyondaki işlemi bitiriniz.`);
      }

      if (op.oncekiOperasyonId) {
        const prevOp = await UretimEmriOperasyon.findByPk(op.oncekiOperasyonId, { transaction: t });
        if (prevOp && prevOp.durum !== 'Completed') {
          throw new ValidationError(`⛔ Bu işlem başlatılamaz! Önceki adım olan "${prevOp.operasyonAdi}" henüz tamamlanmamıştır. (Mevcut Durum: ${prevOp.durum})`);
        }
      }

      // 3. İŞ MERKEZİ MEŞGULİYET KONTROLÜ
      const targetWcId = workCenterId || op.isMerkeziId;
      if (targetWcId) {
        const runningOnStation = await UretimEmriOperasyon.findOne({
          where: {
            isMerkeziId: targetWcId,
            durum: { [Op.in]: ['In_Production'] },
            id: { [Op.ne]: op.id }
          },
          transaction: t
        });
        if (runningOnStation) {
          throw new ValidationError(`⚠️ Bu iş merkezi şu anda meşguldür! İstasyon üzerinde zaten "${runningOnStation.isEmriNo} - ${runningOnStation.operasyonAdi}" işi devam etmektedir.`);
        }
      }

      // 4. Operasyonu ve Ana İş Emrini 'In_Production' yap
      const now = new Date();
      const userFullName = currentUser ? (currentUser.fullName || `${currentUser.ad || ''} ${currentUser.soyad || ''}`.trim() || currentUser.kullaniciAdi) : 'Operatör';

      let effectiveStartDate = now;
      let opNotes = op.notlar || '';

      // Eğer duraklatılmış (Paused) bir iş yeniden başlatılıyorsa:
      if (op.durum === 'Paused') {
        let previousWorkedSeconds = 0;
        const matches = opNotes.match(/GECEN:(\d+)s/g);
        if (matches && matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          const numMatch = lastMatch.match(/GECEN:(\d+)s/);
          if (numMatch) previousWorkedSeconds = parseInt(numMatch[1], 10);
        } else if (op.gerceklesenBaslangicTarihi) {
          previousWorkedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(op.gerceklesenBaslangicTarihi).getTime()) / 1000));
        }

        // Yeni başlangıç zamanını, önceden çalışılan süre kadar geriye çekerek zaman damgasını ayarla
        effectiveStartDate = new Date(now.getTime() - (previousWorkedSeconds * 1000));
        opNotes += (opNotes ? '\n' : '') + `[İŞE DEVAM EDİLDİ - ${now.toLocaleTimeString('tr-TR')}]: ${userFullName} tarafından duraklatma sonrası işe devam edildi.`;
      } else {
        // İlk kez başlatılıyorsa
        effectiveStartDate = op.gerceklesenBaslangicTarihi || now;
        opNotes += (opNotes ? '\n' : '') + `[İŞ BAŞLATILDI - ${now.toLocaleTimeString('tr-TR')}]: ${userFullName} tarafından istasyonda üretime alındı.`;
      }

      await op.update({
        durum: 'In_Production',
        gerceklesenBaslangicTarihi: effectiveStartDate,
        operatorId: currentUser ? currentUser.id : op.operatorId,
        operatorAdi: userFullName,
        isMerkeziId: targetWcId || op.isMerkeziId,
        notlar: opNotes
      }, { transaction: t });

      // Ana iş emrini de In_Production yap
      if (op.uretimEmri) {
        await op.uretimEmri.update({
          durum: 'In_Production',
          gerceklesenBaslangicTarihi: op.uretimEmri.gerceklesenBaslangicTarihi || effectiveStartDate,
          uretimYonetici: userFullName
        }, { transaction: t });
      }

      // İş merkezini aktif yap
      if (targetWcId) {
        const wc = await IsMerkezi.findByPk(targetWcId, { transaction: t });
        if (wc && !['Maintenance', 'Bakımda', 'Bakim'].includes(wc.durum)) {
          await wc.update({ durum: 'Active' }, { transaction: t });
        }
      }

      return op;
    });
  }

  /**
   * MES Terminali: Çalışan iş adımını duraklatır.
   */
  async pauseMESJob(opOrOrderId, workCenterId, reason, notes, currentUser = null) {
    return await sequelize.transaction(async (t) => {
      let op = await UretimEmriOperasyon.findByPk(opOrOrderId, {
        include: [{ model: UretimEmri, as: 'uretimEmri' }],
        transaction: t
      });

      if (!op) {
        // Fallback: search running op for work order
        op = await UretimEmriOperasyon.findOne({
          where: { uretimEmriId: opOrOrderId, durum: 'In_Production' },
          include: [{ model: UretimEmri, as: 'uretimEmri' }],
          transaction: t
        });
      }

      if (!op) throw new NotFoundError('Duraklatılacak aktif operasyon bulunamadı.');

      const pauseDate = new Date();
      let activeWorkedSeconds = 0;
      if (op.gerceklesenBaslangicTarihi) {
        activeWorkedSeconds = Math.max(0, Math.floor((pauseDate.getTime() - new Date(op.gerceklesenBaslangicTarihi).getTime()) / 1000));
      }

      let opNotes = op.notlar || '';
      opNotes += (opNotes ? '\n' : '') + `[DURAKLATILDI: ${reason} - ${pauseDate.toLocaleTimeString('tr-TR')} - GECEN:${activeWorkedSeconds}s]: ${notes}`;

      await op.update({
        durum: 'Paused',
        notlar: opNotes
      }, { transaction: t });

      return op;
    });
  }

  /**
   * MES Terminali: İş adımını tamamlar.
   * Bir sonraki operasyon adımını otomatik olarak kilitli durumdan (Waiting_Previous_Op)
   * başlatılabilir (Ready) durumuna geçirir (Cascade Unlock).
   * Eğer son adım ise ana iş emrini 'Completed' yapar ve mamul stok artışını gerçekleştirir.
   */
  async completeMESJob(opOrOrderId, completedQty, scrapQty = 0, currentUser = null, notes = '') {
    return await sequelize.transaction(async (t) => {
      let op = await UretimEmriOperasyon.findByPk(opOrOrderId, {
        include: [
          { model: UretimEmri, as: 'uretimEmri' },
          { model: StokKarti, as: 'stokKarti' },
          { model: IsMerkezi, as: 'isMerkeziKarti' }
        ],
        transaction: t
      });

      if (!op) {
        op = await UretimEmriOperasyon.findOne({
          where: {
            uretimEmriId: opOrOrderId,
            durum: { [Op.in]: ['In_Production', 'Paused', 'Ready'] }
          },
          include: [
            { model: UretimEmri, as: 'uretimEmri' },
            { model: StokKarti, as: 'stokKarti' },
            { model: IsMerkezi, as: 'isMerkeziKarti' }
          ],
          order: [['operasyonSira', 'ASC']],
          transaction: t
        });
      }

      if (!op) throw new NotFoundError('Tamamlanacak operasyon iş adımı bulunamadı.');

      const additionalCompleted = parseFloat(completedQty) || parseFloat(op.planlananMiktar) || 1;
      const additionalScrap = parseFloat(scrapQty) || 0;
      const finishTime = new Date();

      let opNotes = op.notlar || '';
      if (notes && notes.trim()) {
        opNotes += (opNotes ? '\n' : '') + `[MES TAMAMLANDI - ${finishTime.toLocaleTimeString('tr-TR')}]: ${notes.trim()}`;
      }

      // 1. Mevcut operasyonu Completed yap
      await op.update({
        durum: 'Completed',
        tamamlananMiktar: additionalCompleted,
        fireMiktari: additionalScrap,
        gerceklesenBitisTarihi: finishTime,
        notlar: opNotes
      }, { transaction: t });

      // 2. KASKAD İLERLEME (CASCADE UNLOCK): Sonraki operasyon adımını aktive et
      let nextOp = null;
      if (op.sonrakiOperasyonId) {
        nextOp = await UretimEmriOperasyon.findByPk(op.sonrakiOperasyonId, { transaction: t });
      }
      if (!nextOp) {
        nextOp = await UretimEmriOperasyon.findOne({
          where: {
            uretimEmriId: op.uretimEmriId,
            operasyonSira: { [Op.gt]: op.operasyonSira },
            durum: { [Op.in]: ['Waiting_Previous_Op', 'Ready'] }
          },
          order: [['operasyonSira', 'ASC']],
          transaction: t
        });
      }

      let isFinalStep = false;

      if (nextOp) {
        // Sonraki adımın kilidini aç -> Ready yap
        await nextOp.update({
          durum: 'Ready',
          notlar: (nextOp.notlar || '') + `\n[ÖNCEKİ ADIM TAMAMLANDI - ${finishTime.toLocaleTimeString('tr-TR')}]: ${op.operasyonAdi} adımı tamamlandı, bu adım başlatılabilir hale geldi.`
        }, { transaction: t });
      } else {
        // Bu son adımdı! Tüm operasyonlar bitti mi kontrol et
        const remainingUnfinishedOps = await UretimEmriOperasyon.count({
          where: {
            uretimEmriId: op.uretimEmriId,
            durum: { [Op.ne]: 'Completed' }
          },
          transaction: t
        });

        if (remainingUnfinishedOps === 0) {
          isFinalStep = true;
        }
      }

      // 3. EĞER SON ADIM İSE: Ana iş emrini tamamla ve nihai mamul stoku artır
      if (isFinalStep && op.uretimEmri) {
        const order = op.uretimEmri;

        // Backflushing: Reçetedeki hammadde bileşenlerini stoktan düş
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

        // Mamul stokunu artır
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
            notlar: `Üretim Girişi (Nihai Mamul): ${order.isEmriNo} — ${order.uretimBasligi}`,
            yapanKullaniciId: currentUser ? currentUser.id : null
          }, { transaction: t });
        }

        await order.update({
          tamamlananMiktar: additionalCompleted,
          fireMiktari: additionalScrap,
          durum: 'Completed',
          gerceklesenBitisTarihi: finishTime,
          notlar: (order.notlar || '') + `\n[TÜM OPERASYONLAR TAMAMLANDI - ${finishTime.toLocaleTimeString('tr-TR')}]: ${additionalCompleted} birim nihai mamul stoka eklendi.`
        }, { transaction: t });
      }

      return {
        completedOp: op,
        unlockedNextOp: nextOp,
        isFinalStep
      };
    });
  }
}

module.exports = new ProductionService();
