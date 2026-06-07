import type { Types } from "mongoose";
import { Contact } from "../../models/contact.model";
import { User, type IUser } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { toContactDto, type ContactDto } from "../../lib/serialize";
import type { HydratedDocument } from "mongoose";
import { listContacts } from "../contacts/contacts.service";

export async function listUserContacts(userId: string): Promise<ContactDto[]> {
  const user = await User.findById(userId).lean();
  if (!user) throw AppError.notFound("User not found");
  return listContacts(userId);
}

/** Ensure a directed contact (owner → target) exists; returns its DTO either way. */
async function ensureContact(
  ownerId: string | Types.ObjectId,
  target: HydratedDocument<IUser>,
): Promise<ContactDto> {
  const existing = await Contact.findOne({ ownerId, contactUserId: target._id });
  if (existing) return toContactDto(existing, target);
  const contact = await Contact.create({ ownerId, contactUserId: target._id });
  return toContactDto(contact, target);
}

export async function addUserContact(
  userId: string,
  contactUserId: string,
  reciprocal = false,
): Promise<ContactDto[]> {
  if (userId === contactUserId) {
    throw AppError.validation("A user cannot be their own contact");
  }
  const [owner, target] = await Promise.all([
    User.findById(userId),
    User.findById(contactUserId),
  ]);
  if (!owner || !target) throw AppError.notFound("User not found");

  const result = [await ensureContact(owner._id, target)];
  if (reciprocal) {
    result.push(await ensureContact(target._id, owner));
  }
  return result;
}

export async function removeUserContact(userId: string, contactId: string): Promise<void> {
  const result = await Contact.deleteOne({ _id: contactId, ownerId: userId });
  if (result.deletedCount === 0) throw AppError.notFound("Contact not found");
}
