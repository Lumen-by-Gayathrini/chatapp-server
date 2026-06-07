import { Contact } from "../../models/contact.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { toContactDto, type ContactDto } from "../../lib/serialize";
import type { AddContactInput, UpdateContactInput } from "./contacts.validation";

export async function listContacts(ownerId: string): Promise<ContactDto[]> {
  const contacts = await Contact.find({ ownerId }).sort({ createdAt: 1 });
  if (contacts.length === 0) return [];

  const users = await User.find({ _id: { $in: contacts.map((c) => c.contactUserId) } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return contacts
    .map((c) => {
      const user = byId.get(c.contactUserId.toString());
      return user ? toContactDto(c, user) : null;
    })
    .filter((c): c is ContactDto => c !== null)
    .sort((a, b) => (a.alias ?? a.user.displayName).localeCompare(b.alias ?? b.user.displayName));
}

export async function addContact(ownerId: string, input: AddContactInput): Promise<ContactDto> {
  const target = input.userId
    ? await User.findById(input.userId)
    : await User.findOne({ username: input.username!.toLowerCase() });

  if (!target) throw AppError.notFound("User not found");
  if (target._id.toString() === ownerId) {
    throw AppError.validation("You cannot add yourself as a contact");
  }

  const existing = await Contact.findOne({ ownerId, contactUserId: target._id });
  if (existing) throw AppError.duplicateContact();

  try {
    const contact = await Contact.create({ ownerId, contactUserId: target._id });
    return toContactDto(contact, target);
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw AppError.duplicateContact();
    throw err;
  }
}

export async function updateContact(
  ownerId: string,
  contactId: string,
  input: UpdateContactInput,
): Promise<ContactDto> {
  const contact = await Contact.findOne({ _id: contactId, ownerId });
  if (!contact) throw AppError.notFound("Contact not found");

  contact.alias = input.alias ?? null;
  await contact.save();

  const user = await User.findById(contact.contactUserId);
  if (!user) throw AppError.notFound("Contact user not found");
  return toContactDto(contact, user);
}

export async function removeContact(ownerId: string, contactId: string): Promise<void> {
  const result = await Contact.deleteOne({ _id: contactId, ownerId });
  if (result.deletedCount === 0) throw AppError.notFound("Contact not found");
}
