import mongoose, { type HydratedDocument, type Types } from "mongoose";
import { Conversation, type IConversation } from "../../models/conversation.model";
import { Message } from "../../models/message.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import { toConversationDto, type ConversationDto } from "../../lib/serialize";

type ConversationDoc = HydratedDocument<IConversation>;

/** The other participant's id (1:1 conversations have exactly two participants). */
export function peerIdOf(conversation: IConversation, callerId: string): Types.ObjectId {
  const peer = conversation.participants.find((p) => p.userId.toString() !== callerId);
  if (!peer) throw AppError.internal("Conversation has no peer participant");
  return peer.userId;
}

/** Load a conversation the caller participates in, or throw 404. Shared with messages/sync. */
export async function findParticipantConversation(
  conversationId: string,
  callerId: string,
): Promise<ConversationDoc> {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    "participants.userId": callerId,
  });
  if (!conversation) throw AppError.notFound("Conversation not found");
  return conversation;
}

export async function listConversations(callerId: string): Promise<ConversationDto[]> {
  const conversations = await Conversation.find({ "participants.userId": callerId }).sort({
    lastMessageAt: -1,
  });
  if (conversations.length === 0) return [];

  const peerIds = conversations.map((c) => peerIdOf(c, callerId));
  const users = await User.find({ _id: { $in: peerIds } });
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return conversations
    .map((c) => {
      const peer = byId.get(peerIdOf(c, callerId).toString());
      return peer ? toConversationDto(c, callerId, peer) : null;
    })
    .filter((c): c is ConversationDto => c !== null);
}

export interface CreateConversationResult {
  conversation: ConversationDto;
  created: boolean;
}

export async function createConversation(
  callerId: string,
  peerUserId: string,
): Promise<CreateConversationResult> {
  if (peerUserId === callerId) {
    throw AppError.validation("You cannot start a conversation with yourself");
  }
  const peer = await User.findById(peerUserId);
  if (!peer) throw AppError.notFound("User not found");

  // Idempotent: return the existing 1:1 conversation if one exists (TDD §15.1).
  const existing = await Conversation.findOne({
    "participants.userId": { $all: [callerId, peerUserId] },
  });
  if (existing) {
    return { conversation: toConversationDto(existing, callerId, peer), created: false };
  }

  const created = await Conversation.create({
    participants: [{ userId: callerId }, { userId: peerUserId }],
  });
  return { conversation: toConversationDto(created, callerId, peer), created: true };
}

export async function deleteConversation(callerId: string, conversationId: string): Promise<void> {
  const conversation = await findParticipantConversation(conversationId, callerId);
  await Message.deleteMany({ conversationId: conversation._id });
  await conversation.deleteOne();
}

export async function markRead(
  callerId: string,
  conversationId: string,
  upTo?: string,
): Promise<void> {
  await findParticipantConversation(conversationId, callerId);
  const lastReadAt = upTo ? new Date(upTo) : new Date();
  // arrayFilters are not cast by Mongoose — compare ObjectId to ObjectId explicitly.
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { "participants.$[p].unreadCount": 0, "participants.$[p].lastReadAt": lastReadAt } },
    { arrayFilters: [{ "p.userId": new mongoose.Types.ObjectId(callerId) }] },
  );
}
