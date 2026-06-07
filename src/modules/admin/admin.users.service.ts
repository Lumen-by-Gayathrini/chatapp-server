import { RefreshToken } from "../../models/refreshToken.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { hashPassword } from "../../lib/password";
import { toUserDto, type UserDto } from "../../lib/serialize";

export async function listUsers(): Promise<UserDto[]> {
  const users = await User.find().sort({ createdAt: 1 });
  return users.map(toUserDto);
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<UserDto> {
  const username = input.username.toLowerCase();
  if (await User.findOne({ username }).lean()) {
    throw AppError.conflict("Username is already taken");
  }
  const user = await User.create({
    username,
    displayName: input.displayName,
    passwordHash: await hashPassword(input.password),
  });
  return toUserDto(user);
}

export async function getUser(id: string): Promise<UserDto> {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound("User not found");
  return toUserDto(user);
}

export async function updateUser(
  id: string,
  input: { displayName?: string; status?: "ACTIVE" | "INACTIVE" },
): Promise<UserDto> {
  const update: Record<string, unknown> = {};
  if (input.displayName !== undefined) update.displayName = input.displayName;
  if (input.status !== undefined) update.status = input.status;

  const user = await User.findByIdAndUpdate(id, update, { new: true });
  if (!user) throw AppError.notFound("User not found");

  // Deactivating a user invalidates their sessions.
  if (input.status === "INACTIVE") {
    await RefreshToken.updateMany({ userId: id, revokedAt: null }, { revokedAt: new Date() });
  }
  return toUserDto(user);
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound("User not found");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  // Force re-login everywhere.
  await RefreshToken.updateMany({ userId: id, revokedAt: null }, { revokedAt: new Date() });
}
