import nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configurar transporter con credenciales SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Enviar email con contraseña temporal (SIMPLE - no seguro)
   */
  async sendPasswordResetEmail(email: string, password: string): Promise<void> {
    try {
      const mailOptions = {
        from: `"TasteBox" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'TasteBox - Recuperación de Contraseña',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff6b35;">🔐 Recuperación de Contraseña</h2>
            <p>Hola,</p>
            <p>Has solicitado recuperar tu contraseña para TasteBox.</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Tu nueva contraseña temporal es:</strong></p>
              <p style="font-size: 18px; color: #ff6b35; margin: 10px 0;"><code>${password}</code></p>
            </div>
            <p><strong>⚠️ Iniciá sesión con esta contraseña temporal y cambiala desde tu perfil.</strong></p>
            <p>Si no solicitaste este email, ignóralo.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">TasteBox - Tu recetario digital</p>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email de recuperación enviado a: ${email}`);
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      throw new Error('Error al enviar email de recuperación');
    }
  }

  /**
   * Verificar configuración SMTP
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Conexión SMTP verificada');
      return true;
    } catch (error) {
      console.error('❌ Error en configuración SMTP:', error);
      return false;
    }
  }
}

export default new EmailService();
