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

// Returned by GET /admin/users — a user row with aggregated grind stats.
export interface AdminUser {
  id: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
  sessionCount: number;
  totalGold: number; // copper
}

export interface DashboardSummary {
  totalGold: number;
  totalHours: number;
  goldPerHour: number;
  favoriteDungeon: string | null;
}

// Each value is also the Omise source `type`. PromptPay is QR; every other
// channel is an off-site redirect (authorize_uri). Keep in sync with the
// backend DONATION_CHANNELS list.
export type DonationChannel =
  | 'promptpay'
  | 'truemoney'
  | 'mobile_banking_scb'
  | 'mobile_banking_kbank'
  | 'mobile_banking_bay'
  | 'mobile_banking_bbl'
  | 'mobile_banking_ktb'
  | 'rabbit_linepay'
  | 'shopeepay'
  | 'grabpay';
export type DonationStatus = 'pending' | 'successful' | 'failed' | 'expired';

// Returned by POST /donations — everything the client needs to collect payment.
// `amount` is in satang (฿1 = 100 satang), same as everywhere else on the wire.
export interface DonationCharge {
  id: string;
  status: DonationStatus;
  channel: DonationChannel;
  amount: number;
  displayName: string;
  provider: string; // 'omise' | 'beam' | 'manual' — drives the client flow
  qrImageUri: string | null; // PromptPay QR
  authorizeUri: string | null; // redirect target (TrueMoney, mobile banking, e-wallets)
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
  provider?: string; // which provider created it ('manual' rows are settled by an admin)
  status: DonationStatus;
  hide_amount?: boolean; // amount withheld from the public wall
  created_at: string;
  paid_at: string | null;
}

// Thank-you wall entry (GET /donations/wall).
export interface DonationWallEntry {
  display_name: string;
  amount: number | null; // satang; null when the donor hid their amount
  message: string | null;
  paid_at: string | null;
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  is_admin: boolean;
  body: string;
  image_url: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  // Present on detail responses (GET /tickets/:id).
  ticket_messages?: TicketMessage[];
  // Present on admin responses — who opened the ticket.
  profiles?: { username: string | null } | null;
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
