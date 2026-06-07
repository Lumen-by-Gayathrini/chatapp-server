import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { toUserDto, type UserDto } from "../../lib/serialize";
import type { UpdateMeInput } from "./profile.validation";

export async function getMe(userId: string): Promise<UserDto> {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("User not found");
  return toUserDto(user);
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<UserDto> {
  const update: Partial<Pick<UpdateMeInput, "displayName" | "avatarUrl">> = {};
  if (input.displayName !== undefined) update.displayName = input.displayName;
  if (input.avatarUrl !== undefined) update.avatarUrl = input.avatarUrl;

  const user = await User.findByIdAndUpdate(userId, update, { new: true });
  if (!user) throw AppError.notFound("User not found");
  return toUserDto(user);
}
