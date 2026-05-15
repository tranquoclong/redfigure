
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'CUSTOMER';
  emailMarketingOptOut?: boolean;

  passwordSet?: boolean;
}

export interface UserProfile extends User {
  cccd?: string;
  phone?: string;
  mst?: string;
  companyName?: string;
}

export interface AuthTokens {
  accessToken: string;
  user: User;
}
