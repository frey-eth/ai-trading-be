export class UserLoginDto {
  walletAddress: string;
  signature: string;
  message: string; // The message that was signed (should include nonce)
  region?: string;
}
