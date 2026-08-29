export type Role = "ADMIN" | "OPERATOR";

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  assignedElectionId: string | null;
  pollingPlaceId: string | null;
}

export interface Election {
  id: string;
  name: string;
  city: string;
  electionDate: string;
  timezone: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  requireConfirmation: boolean;
  resetDelaySeconds: number;
  brandName?: string | null;
  brandSubtitle?: string | null;
  brandLogoData?: string | null;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandBackgroundColor?: string;
  brandSurfaceColor?: string;
  brandTextColor?: string;
  tvTickerText?: string | null;
  tvPublicEnabled?: boolean;
  tvAccessToken?: string | null;
  tvShowClock?: boolean;
  tvShowTotal?: boolean;
  tvShowUpdatedAt?: boolean;
}

export interface Candidate {
  id: string;
  electionId?: string;
  name: string;
  listLabel: string | null;
  party: string | null;
  ballotNumber: string | null;
  colorHex: string;
  isNoResponse: boolean;
  active?: boolean;
  sortOrder?: number;
  votes?: number;
  percentage?: number;
}

export interface Place {
  id: string;
  electionId?: string;
  name: string;
  code: string | null;
  active?: boolean;
}

export interface Operator {
  id: string;
  name: string;
  username: string;
  active: boolean;
  assignedElectionId: string | null;
  pollingPlaceId: string | null;
  pollingPlace?: { id?: string; name: string } | null;
  assignedElection?: { id: string; name: string } | null;
}

export interface TvElection {
  id: string;
  name: string;
  city: string;
  electionDate: string;
  timezone: string;
  status: "DRAFT" | "ACTIVE" | "CLOSED";
  brandName: string | null;
  brandSubtitle: string | null;
  brandLogoData: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandBackgroundColor: string;
  brandSurfaceColor: string;
  brandTextColor: string;
  tvTickerText: string | null;
  tvShowClock: boolean;
  tvShowTotal: boolean;
  tvShowUpdatedAt: boolean;
}

export interface TvData {
  election: TvElection;
  total: number;
  candidates: (Candidate & { votes: number; percentage: number })[];
  hourly: { hourLabel: string; total: number; candidates: { candidateId: string; votes: number }[] }[];
  updatedAt: string;
}

export interface TransmissionConfig {
  brandName: string | null;
  brandSubtitle: string | null;
  brandLogoData: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandBackgroundColor: string;
  brandSurfaceColor: string;
  brandTextColor: string;
  tvTickerText: string | null;
  tvPublicEnabled: boolean;
  tvAccessToken: string | null;
  tvShowClock: boolean;
  tvShowTotal: boolean;
  tvShowUpdatedAt: boolean;
}
