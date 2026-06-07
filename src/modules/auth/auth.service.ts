import { Admin } from "../../models/admin.model";
import { RefreshToken } from "../../models/refreshToken.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { comparePassword, hashPassword } from "../../lib/password";
import { signAccessToken, signAdminToken } from "../../lib/jwt";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "../../lib/refreshToken";
import { toAdminDto, toUserDto, type AdminDto, type UserDto } from "../../lib/serialize";
import type { AdminLoginInput, LoginInput, RefreshInput, RegisterInput } from "./auth.validation";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: UserDto;
}

/** Issue a new access token and persist a fresh (hashed) refresh token. */
async function issueTokens(userId: string): Promise<TokenPair> {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
  });
  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const username = input.username.toLowerCase();
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    throw AppError.conflict("Username is already taken");
  }
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({ username, passwordHash, displayName: input.displayName });
  const tokens = await issueTokens(user._id.toString());
  return { user: toUserDto(user), ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await User.findOne({ username: input.username.toLowerCase() });
  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw AppError.invalidCredentials();
  }
  if (user.status !== "ACTIVE") {
    throw AppError.forbidden("This account has been deactivated");
  }
  const tokens = await issueTokens(user._id.toString());
  return { user: toUserDto(user), ...tokens };
}

export async function refresh(input: RefreshInput): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(input.refreshToken);
  const record = await RefreshToken.findOne({ tokenHash });
  if (!record || record.revokedAt) {
    throw AppError.unauthenticated("Invalid refresh token");
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw AppError.unauthenticated("Refresh token expired");
  }
  // Rotate: revoke the presented token, then issue a fresh pair.
  record.revokedAt = new Date();
  await record.save();
  return issueTokens(record.userId.toString());
}

export async function logout(input: RefreshInput): Promise<void> {
  const tokenHash = hashRefreshToken(input.refreshToken);
  // Idempotent — revoking an unknown/already-revoked token is a no-op.
  await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}

export interface AdminLoginResult {
  admin: AdminDto;
  accessToken: string;
}

export async function adminLogin(input: AdminLoginInput): Promise<AdminLoginResult> {
  const admin = await Admin.findOne({ email: input.email.toLowerCase() });
  if (!admin || !(await comparePassword(input.password, admin.passwordHash))) {
    throw AppError.invalidCredentials();
  }
  return { admin: toAdminDto(admin), accessToken: signAdminToken(admin._id.toString()) };
}
