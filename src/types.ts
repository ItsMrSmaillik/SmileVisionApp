import { Timestamp } from 'firebase/firestore';

export interface AppState {
  theme: string;
  winnerPost: string;
  winnerImage?: string;
}

export interface NewsPost {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: Timestamp;
}

export interface Participant {
  id: string;
  email?: string;
  name: string;
  country: string;
  song: string;
  emoji: string;
  imageUrl?: string;
  createdAt: Timestamp;
  status?: 'pending' | 'approved' | 'rejected';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
