export interface BanInfo {
  isPermanentBan: boolean;
  bannedUntil: string | null;
  banReason: string;
}

export function buildBanInfoFromUser(user: {
  isPermanentBan?: boolean;
  bannedUntil?: string | null;
  banReason?: string | null;
}): BanInfo | null {
  if (user.isPermanentBan) {
    return {
      isPermanentBan: true,
      bannedUntil: null,
      banReason: user.banReason ?? 'Sebep belirtilmedi',
    };
  }

  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return {
      isPermanentBan: false,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason ?? 'Sebep belirtilmedi',
    };
  }

  return null;
}

export function buildBanInfoFromError(data: Record<string, unknown> | undefined): BanInfo | null {
  if (!data || data.error !== 'USER_BANNED') return null;

  return {
    isPermanentBan: !!data.isPermanentBan,
    bannedUntil: (data.bannedUntil as string | null | undefined) ?? null,
    banReason: (data.banReason as string | undefined) ?? 'Sebep belirtilmedi',
  };
}

export function isBanActive(banInfo: BanInfo | null | undefined): boolean {
  if (!banInfo) return false;
  if (banInfo.isPermanentBan) return true;
  return !!banInfo.bannedUntil && new Date(banInfo.bannedUntil) > new Date();
}
