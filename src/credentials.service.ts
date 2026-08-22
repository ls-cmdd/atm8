import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export class CredentialsService {
  private masterKey: Buffer;

  constructor() {
    const keyString = process.env.MASTER_KEY || '12345678901234567890123456789012'; // 32 bytes fallback for sandbox
    if (keyString.length !== 32) {
      throw new Error('MASTER_KEY must be exactly 32 bytes long');
    }
    this.masterKey = Buffer.from(keyString, 'utf-8');
  }

  encrypt(text: string) {
    // Unique IV for every single encryption to avoid reuse vulnerabilities
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encrypted: string, ivHex: string, authTagHex: string) {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  mask(text: string) {
    if (text.length <= 4) return '****';
    return '*'.repeat(text.length - 4) + text.slice(-4);
  }
}
