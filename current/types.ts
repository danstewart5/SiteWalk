export const TRADES = [
  "General",
  "Plumbing",
  "Electrical",
  "Framing",
  "Concrete",
  "HVAC",
  "Roofing",
  "Finishing",
  "Sitework",
] as const;

export type Trade = (typeof TRADES)[number];

export type RfiStatus = "Open" | "Answered";
export type SubmittalStatus = "Pending" | "Approved";
export type ChangeStatus = "Pending" | "Approved" | "Rejected";
export type SafetyType =
  | "Near-Miss"
  | "Minor Incident"
  | "Injury"
  | "Equipment/Property Damage"
  | "Hazard Observed";
export type Weather =
  | "Clear"
  | "Cloudy"
  | "Rain"
  | "Snow"
  | "High Wind"
  | "Extreme Heat/Cold";

export type PreferredChannel = "sms" | "email" | "both";
export type NoticeStatus = "queued" | "sent" | "failed" | "delivered" | "unrouted";
export type NoticeChannel = "sms" | "email";
export type RoutableKind = "punch" | "rfi" | "change";

export type View =
  | "home"
  | "walk"
  | "rfis"
  | "logs"
  | "submittals"
  | "safety"
  | "punch"
  | "changes"
  | "clock"
  | "trades"
  | "report"
  | "more"
  | "pipeline";

export type Rfi = {
  id: string;
  question: string;
  trade: string;
  recipient: string;
  status: RfiStatus;
  answer: string;
  photo: string | null;
  createdAt: string;
  answeredAt?: string;
  notifiedAt?: string | null;
  notificationStatus?: NoticeStatus | null;
};

export type DailyLog = {
  id: string;
  date: string;
  weather: Weather;
  crewCount: string;
  trades: string;
  delays: string;
  notes: string;
  createdAt: string;
};

export type Submittal = {
  id: string;
  item: string;
  trade: string;
  recipient: string;
  dueDate: string;
  status: SubmittalStatus;
  createdAt: string;
  approvedAt?: string;
};

export type SafetyEntry = {
  id: string;
  type: SafetyType;
  desc: string;
  person: string;
  action: string;
  photo: string | null;
  createdAt: string;
};

export type PunchItem = {
  id: string;
  item: string;
  location: string;
  trade: string;
  photo: string | null;
  done: boolean;
  createdAt: string;
  notifiedAt?: string | null;
  notificationStatus?: NoticeStatus | null;
};

export type ChangeOrder = {
  id: string;
  description: string;
  amount: string;
  trade: string;
  status: ChangeStatus;
  createdAt: string;
  notifiedAt?: string | null;
  notificationStatus?: NoticeStatus | null;
};

export type TradeContact = {
  id: string;
  company: string;
  trade: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
  preferredChannel: PreferredChannel;
  siteId: string;
};

export type TradeNotice = {
  id: string;
  itemId: string;
  itemType: RoutableKind;
  tradeId: string;
  tradeName: string;
  company: string;
  channel: NoticeChannel;
  to: string;
  body: string;
  status: NoticeStatus;
  timestamp: string;
  retryCount: number;
  error?: string;
};

export type JobSite = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  active: boolean;
};

export type ClockEvent = {
  id: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  type: "in" | "out";
  isManual: boolean;
  flagged: boolean;
  timestamp: string;
};

export type WalkNote = {
  id: string;
  body: string;
  tag: "Note" | "Punch" | "RFI" | "Safety";
  photo: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt: string;
};
