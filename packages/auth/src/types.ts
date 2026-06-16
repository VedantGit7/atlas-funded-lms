export type AuthPrincipalBridge = {
  id: string;
  email: string;
  emailNormalized: string;
  globalStatus: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
};

export type SessionSafeIdentity = {
  authenticated: true;
  email: string;
  emailNormalized: string;
  mfaEnabled: boolean;
  globalStatus: string;
};

export type AnonymousIdentity = {
  authenticated: false;
};

export type AuthIdentity = SessionSafeIdentity | AnonymousIdentity;
