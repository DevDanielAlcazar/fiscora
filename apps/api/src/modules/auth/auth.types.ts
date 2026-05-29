export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId?: string;
}
