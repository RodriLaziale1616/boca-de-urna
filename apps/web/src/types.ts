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
