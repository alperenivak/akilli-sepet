export interface BanCheckInput {
  bannedUntil: Date | null;
  banReason: string | null;
  isPermanentBan: boolean;
}

export interface ActiveBanInfo {
  isBanned: true;
  isPermanent: boolean;
  bannedUntil?: Date;
  banReason: string;
}

export function getActiveBan(user: BanCheckInput): ActiveBanInfo | { isBanned: false } {
  if (user.isPermanentBan) {
    return {
      isBanned: true,
      isPermanent: true,
      banReason: user.banReason ?? 'Sebep belirtilmedi',
    };
  }

  if (user.bannedUntil && user.bannedUntil > new Date()) {
    return {
      isBanned: true,
      isPermanent: false,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason ?? 'Sebep belirtilmedi',
    };
  }

  return { isBanned: false };
}

export function buildUserBannedException(ban: ActiveBanInfo) {
  return {
    statusCode: 403,
    error: 'USER_BANNED',
    message: ban.isPermanent
      ? 'Hesabiniz kalici olarak kisitlandi'
      : 'Hesabiniz gecici olarak kisitlandi',
    isPermanentBan: ban.isPermanent,
    bannedUntil: ban.bannedUntil?.toISOString() ?? null,
    banReason: ban.banReason,
  };
}
