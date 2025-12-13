/**
 * SSH Key Generator Utility
 * Generates ED25519 and RSA SSH key pairs for secure project authentication
 *
 * Security Features:
 * - Uses ssh-keygen subprocess (industry standard)
 * - Temporary files deleted immediately after generation
 * - SHA-256 fingerprinting for key identification
 * - Format validation for both public and private keys
 */

import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import Logger from './Logger';

const execAsync = promisify(exec);

export interface ISshKeyPair {
  publicKey: string;
  privateKey: string;
  fingerprint: string;
  keyType: 'ed25519' | 'rsa';
}

export class SshKeyGenerator {
  /**
   * Generate ED25519 SSH key pair (Recommended for 2025)
   *
   * Ed25519 advantages:
   * - Faster than RSA (~100ms vs 2-5 seconds)
   * - More secure (256-bit security equivalent)
   * - Smaller key size (68 chars vs 544+ chars)
   * - Resistant to timing attacks
   * - Supported by GitHub, GitLab, Bitbucket
   *
   * @param comment - Comment for the SSH key (e.g., "deploy-center-ProjectName")
   * @returns Promise<ISshKeyPair> - Generated key pair with fingerprint
   */
  public static async GenerateEd25519KeyPair(
    comment: string = 'deploy-center'
  ): Promise<ISshKeyPair> {
    const keyFileName = `temp-key-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const keyPath = path.join(__dirname, keyFileName);

    try {
      Logger.Debug('Generating ED25519 SSH key pair', { comment });

      // Generate key using ssh-keygen
      // -t ed25519: Key type
      // -f: Output file path
      // -N "": No passphrase (keys are encrypted in database)
      // -C: Comment
      // -m PEM: Use PEM format (compatible with older OpenSSL/Git)
      const command = `ssh-keygen -t ed25519 -m PEM -f "${keyPath}" -N "" -C "${comment}"`;
      console.log({
        command,
      });
      await execAsync(command, { timeout: 10000 });

      // Read generated keys
      const privateKey = await fs.readFile(keyPath, 'utf-8');
      const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf-8');

      // Generate SHA-256 fingerprint
      const fingerprint = this.GenerateFingerprint(publicKey);

      // Log key format for debugging
      const keyFirstLine = privateKey.split('\n')[0] || '';
      Logger.Info('ED25519 key pair generated successfully', {
        fingerprint: fingerprint.substring(0, 16) + '...',
        keySize: privateKey.length,
        comment,
        keyFormat: keyFirstLine,
        isPemFormat: keyFirstLine.includes('EC PRIVATE KEY'),
        isOpenSshFormat: keyFirstLine.includes('OPENSSH PRIVATE KEY'),
      });

      return {
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
        fingerprint,
        keyType: 'ed25519',
      };
    } catch (error) {
      Logger.Error('Failed to generate ED25519 key pair', error as Error, { comment });
      throw new Error(`SSH key generation failed: ${(error as Error).message}`);
    } finally {
      // Cleanup temporary files (critical for security)
      try {
        await fs.remove(keyPath);
        await fs.remove(`${keyPath}.pub`);
      } catch (cleanupError) {
        Logger.Warn('Failed to cleanup temporary key files', { keyPath });
      }
    }
  }

  /**
   * Generate RSA SSH key pair (Legacy support)
   *
   * Use this for compatibility with older systems that don't support ED25519.
   * RSA is still secure with 4096-bit keys, but slower to generate.
   *
   * @param bits - Key size (2048, 3072, or 4096 recommended)
   * @param comment - Comment for the SSH key
   * @returns Promise<ISshKeyPair> - Generated key pair with fingerprint
   */
  public static async GenerateRsaKeyPair(
    bits: number = 4096,
    comment: string = 'deploy-center'
  ): Promise<ISshKeyPair> {
    // Validate key size
    if (bits < 2048) {
      throw new Error('RSA key size must be at least 2048 bits for security');
    }

    const tempDir = os.tmpdir();
    const keyFileName = `temp-key-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const keyPath = path.join(tempDir, keyFileName);

    try {
      Logger.Debug('Generating RSA SSH key pair', { bits, comment });

      // Generate RSA key
      // -m PEM: Use PEM format (compatible with older OpenSSL/Git)
      const command = `ssh-keygen -t rsa -b ${bits} -m PEM -f "${keyPath}" -N "" -C "${comment}"`;

      await execAsync(command, { timeout: 30000 }); // RSA takes longer

      const privateKey = await fs.readFile(keyPath, 'utf-8');
      const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf-8');
      const fingerprint = this.GenerateFingerprint(publicKey);

      // Log key format for debugging
      const keyFirstLine = privateKey.split('\n')[0] || '';
      Logger.Info('RSA key pair generated successfully', {
        fingerprint: fingerprint.substring(0, 16) + '...',
        bits,
        keySize: privateKey.length,
        comment,
        keyFormat: keyFirstLine,
        isPemFormat: keyFirstLine.includes('RSA PRIVATE KEY'),
        isOpenSshFormat: keyFirstLine.includes('OPENSSH PRIVATE KEY'),
      });

      return {
        publicKey: publicKey.trim(),
        privateKey: privateKey.trim(),
        fingerprint,
        keyType: 'rsa',
      };
    } catch (error) {
      Logger.Error('Failed to generate RSA key pair', error as Error, { bits, comment });
      throw new Error(`SSH key generation failed: ${(error as Error).message}`);
    } finally {
      // Cleanup
      try {
        await fs.remove(keyPath);
        await fs.remove(`${keyPath}.pub`);
      } catch (cleanupError) {
        Logger.Warn('Failed to cleanup temporary key files', { keyPath });
      }
    }
  }

  /**
   * Generate SHA-256 fingerprint of SSH public key
   *
   * This fingerprint is used for:
   * - Unique identification of keys
   * - Verifying key integrity
   * - Displaying key info in UI
   *
   * @param publicKey - SSH public key string
   * @returns Hex-encoded SHA-256 hash
   */
  public static GenerateFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(publicKey.trim());
    return hash.digest('hex');
  }

  /**
   * Validate SSH private key format
   *
   * Supports:
   * - OpenSSH format (-----BEGIN OPENSSH PRIVATE KEY-----)
   * - RSA format (-----BEGIN RSA PRIVATE KEY-----)
   *
   * @param privateKey - Private key string to validate
   * @returns true if valid format, false otherwise
   */
  public static ValidatePrivateKey(privateKey: string): boolean {
    const patterns = [
      /-----BEGIN OPENSSH PRIVATE KEY-----/,  // OpenSSH format
      /-----BEGIN RSA PRIVATE KEY-----/,       // RSA PEM format
      /-----BEGIN EC PRIVATE KEY-----/,        // EC (ED25519) PEM format
      /-----BEGIN PRIVATE KEY-----/,           // PKCS#8 format
    ];

    return patterns.some(pattern => pattern.test(privateKey));
  }

  /**
   * Validate SSH public key format
   *
   * Expected format: "<algorithm> <base64-key> <comment>"
   * Examples:
   * - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIxxxxxxx deploy-center
   * - ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQxxxxxxx deploy-center
   *
   * @param publicKey - Public key string to validate
   * @returns true if valid format, false otherwise
   */
  public static ValidatePublicKey(publicKey: string): boolean {
    const pattern =
      /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521) [A-Za-z0-9+\/=]+ ?.*$/;
    return pattern.test(publicKey.trim());
  }

  /**
   * Extract key type from public key
   *
   * @param publicKey - SSH public key string
   * @returns Key type or null if invalid
   */
  public static ExtractKeyType(publicKey: string): 'ed25519' | 'rsa' | null {
    if (publicKey.startsWith('ssh-ed25519')) {
      return 'ed25519';
    } else if (publicKey.startsWith('ssh-rsa')) {
      return 'rsa';
    }
    return null;
  }

  /**
   * Check if ssh-keygen is available on the system
   *
   * @returns Promise<boolean> - true if available, false otherwise
   */
  public static async CheckSshKeygenAvailable(): Promise<boolean> {
    try {
      await execAsync('ssh-keygen -V', { timeout: 5000 });
      return true;
    } catch (error) {
      Logger.Error('ssh-keygen not found', error as Error);
      return false;
    }
  }
}

export default SshKeyGenerator;
