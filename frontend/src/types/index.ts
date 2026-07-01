export interface GameClass {
  id: string;
  name: string;
  parent_class: string | null;
  created_at: string;
}

export interface Character {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  level: number;
  created_at: string;
  classes: GameClass;
}

export interface Dungeon {
  id: string;
  name: string;
  dragon_core_cost: number | null;
  average_duration: number | null;
  image_url: string | null;
}

export interface Item {
  id: string;
  name: string;
  icon_url: string | null;
  rarity: string | null;
  default_price: number;
}

export interface SessionDrop {
  id: string;
  session_id: string;
  item_id: string;
  quantity: number;
  price_each: number;
  items?: Item;
}

export interface Session {
  id: string;
  user_id: string;
  character_id: string;
  dungeon_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  gold_earned: number;
  gold_dropped: number;
  created_at: string;
  characters: Character;
  dungeons: Dungeon | null;
  session_drops?: SessionDrop[];
}

export interface DashboardSummary {
  totalGold: number;
  totalHours: number;
  goldPerHour: number;
  favoriteDungeon: string | null;
}

export type DonationChannel = 'promptpay' | 'truemoney';
export type DonationStatus = 'pending' | 'successful' | 'failed' | 'expired';

// Returned by POST /donations — everything the client needs to collect payment.
// `amount` is in satang (฿1 = 100 satang), same as everywhere else on the wire.
export interface DonationCharge {
  id: string;
  status: DonationStatus;
  channel: DonationChannel;
  amount: number;
  displayName: string;
  qrImageUri: string | null; // PromptPay QR
  authorizeUri: string | null; // TrueMoney redirect
  expiresAt: string | null;
}

// A stored donation row (GET /donations/:id, /donations/me).
export interface Donation {
  id: string;
  user_id: string;
  display_name: string;
  message: string | null;
  amount: number; // satang
  currency: string;
  channel: DonationChannel;
  status: DonationStatus;
  created_at: string;
  paid_at: string | null;
}

// Thank-you wall entry (GET /donations/wall).
export interface DonationWallEntry {
  display_name: string;
  amount: number; // satang
  message: string | null;
  paid_at: string | null;
}

export interface DungeonStats {
  dungeonId: string;
  dungeonName: string;
  totalSessions: number;
  totalGold: number;
  totalMinutes: number;
  goldPerHour: number;
  dragonCoreCost: number | null;
  goldPerCore: number | null;
}
