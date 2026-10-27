/**
 * MfaChallenge Model — v3.0.1 / SEC-C3.
 *
 * A short-lived, single-use proof that the password step of a login succeeded
 * for a user with two-factor authentication enabled. The raw token only lives
 * in the httpOnly `mfa_pending` cookie; the DB stores its SHA-256 hash.
 */

import { DataTypes, Model, Optional } from 'sequelize';
import DatabaseConnection from '@Database/DatabaseConnection';

export interface IMfaChallengeAttributes {
  Id: number;
  UserId: number;
  TokenHash: string;
  ExpiresAt: Date;
  ConsumedAt: Date | null;
  Attempts: number;
  IpAddress: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

export type TMfaChallengeCreation = Optional<
  IMfaChallengeAttributes,
  'Id' | 'ConsumedAt' | 'Attempts' | 'IpAddress' | 'CreatedAt' | 'UpdatedAt'
>;

export class MfaChallenge extends Model<IMfaChallengeAttributes, TMfaChallengeCreation> {
  declare Id: number;
  declare UserId: number;
  declare TokenHash: string;
  declare ExpiresAt: Date;
  declare ConsumedAt: Date | null;
  declare Attempts: number;
  declare IpAddress: string | null;
  declare readonly CreatedAt: Date;
  declare readonly UpdatedAt: Date;
}

MfaChallenge.init(
  {
    Id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'Id',
    },
    UserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'UserId',
    },
    TokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'TokenHash',
    },
    ExpiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'ExpiresAt',
    },
    ConsumedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ConsumedAt',
    },
    Attempts: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'Attempts',
    },
    IpAddress: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'IpAddress',
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt',
    },
    UpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'UpdatedAt',
    },
  },
  {
    sequelize: DatabaseConnection.GetInstance(),
    tableName: 'MfaChallenges',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: 'UpdatedAt',
    indexes: [
      { name: 'idx_mfa_challenges_token_hash', unique: true, fields: ['TokenHash'] },
      { name: 'idx_mfa_challenges_user_id', fields: ['UserId'] },
      { name: 'idx_mfa_challenges_expires_at', fields: ['ExpiresAt'] },
    ],
  }
);

export default MfaChallenge;
