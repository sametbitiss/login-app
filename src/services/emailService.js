'use strict';
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  async initTransporter() {
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        logger.info('Nodemailer: Özel SMTP sunucusu yapılandırıldı.');
      } else {
        // Otomatik test/geliştirme hesabı (Ethereal Email) oluştur
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass
          }
        });
        logger.info(`Nodemailer: Geliştirme SMTP test hesabı hazırlandı (${testAccount.user})`);
      }
    } catch (err) {
      logger.error('Nodemailer Transporter Başlatma Hatası: ' + err.message);
      // Fallback transport
      this.transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }

  /**
   * 6 Haneli OTP Doğrulama E-postası Gönderimi
   * @param {Object} params
   * @param {string} params.to - Alıcı e-posta adresi
   * @param {string} params.code - 6 haneli doğrulama kodu
   * @param {string} params.fullName - Kullanıcı ad soyad veya kullanıcı adı
   * @param {string} params.username - Kullanıcı adı
   */
  async sendOtpEmail({ to, code, fullName, username }) {
    if (!this.transporter) {
      await this.initTransporter();
    }

    const fromAddress = process.env.SMTP_FROM || '"Enterprise ERP Güvenlik" <security@enterprise-erp.com>';
    const userDisplayName = fullName || username || 'Kullanıcı';

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="UTF-8">
        <style>
          body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; }
          .email-container { max-width: 540px; margin: 30px auto; background: #131b2e; border: 1px solid #2d3748; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px; }
          .header p { margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 16px; font-weight: 600; color: #ffffff; margin-bottom: 12px; }
          .message { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
          .code-card { background: rgba(99, 102, 241, 0.1); border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
          .code-label { font-size: 12px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; margin: 0; text-shadow: 0 0 12px rgba(99,102,241,0.5); }
          .warning-box { background: rgba(244, 63, 94, 0.1); border-left: 4px solid #f43f5e; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #fda4af; margin-bottom: 24px; line-height: 1.5; }
          .footer { background: #0c111d; border-top: 1px solid #1e293b; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          .footer a { color: #818cf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Enterprise ERP</h1>
            <p>Güvenli Kimlik Doğrulama Servisi</p>
          </div>
          <div class="content">
            <div class="greeting">Sayın ${userDisplayName},</div>
            <div class="message">
              Enterprise ERP portalına giriş yapabilmeniz için oluşturulan 6 haneli tek kullanımlık doğrulama kodunuz aşağıdadır:
            </div>
            <div class="code-card">
              <div class="code-label">Giriş Doğrulama Kodunuz</div>
              <div class="otp-code">${code}</div>
            </div>
            <div class="warning-box">
              ⏱️ <strong>Dikkat:</strong> Bu doğrulama kodu güvenlik sebebiyle yalnızca <strong>1 dakika (60 saniye)</strong> geçerlidir. Süre dolduktan sonra kod geçersiz olacaktır.
            </div>
            <div class="message" style="font-size: 12px; margin-bottom: 0;">
              Eğer bu giriş talebini siz gerçekleştirmediyseniz, lütfen derhal sistem yöneticiniz ile iletişime geçiniz.
            </div>
          </div>
          <div class="footer">
            © 2026 Enterprise ERP Sistemi • Tüm Hakları Saklıdır.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: fromAddress,
      to,
      subject: `🔑 Enterprise ERP Giriş Doğrulama Kodu: ${code}`,
      text: `Sayın ${userDisplayName},\n\nEnterprise ERP portalına giriş için tek kullanımlık 6 haneli doğrulama kodunuz: ${code}\n\nBu kod 1 dakika (60 saniye) süreyle geçerlidir.\n\nEğer bu işlemi siz yapmadıysanız lütfen sistem yöneticinize haber veriniz.`,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      
      console.log(`\n======================================================`);
      console.log(`✉️  [E-POSTA GÖNDERİLDİ]`);
      console.log(`👤 Alıcı: ${to} (${userDisplayName})`);
      console.log(`🔑 6 Haneli Doğrulama Kodu: [ ${code} ]`);
      console.log(`⏳ Geçerlilik Süresi: 60 Saniye (1 Dakika)`);
      if (previewUrl) {
        console.log(`🌐 Canlı E-posta Önizleme Linki: ${previewUrl}`);
      }
      console.log(`======================================================\n`);

      logger.info(`OTP E-Postası Başarıyla Gönderildi -> ${to}`);
      return { success: true, messageId: info.messageId, previewUrl };
    } catch (error) {
      console.error('E-posta Gönderme Hatası:', error);
      logger.error('OTP E-Posta Gönderme Hatası: ' + error.message);
      // Fallback konsol logu sayesinde geliştirme/test ortamında asla bloklanmaz
      console.log(`\n⚠️  [FALLBACK] E-posta gönderilemedi ancak kod üretildi: [ ${code} ] -> Alıcı: ${to}\n`);
      return { success: true, fallback: true, code };
    }
  }
}

module.exports = new EmailService();
