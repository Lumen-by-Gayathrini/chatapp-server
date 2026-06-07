import { randomUUID } from "node:crypto";
import { Conversation } from "../../models/conversation.model";
import { Message } from "../../models/message.model";
import { User } from "../../models/user.model";
import { AppError } from "../../lib/errors";
import {
  toConversationDto,
  toMessageDto,
  type ConversationDto,
  type MessageDto,
} from "../../lib/serialize";
import { listConversations } from "../conversations/conversations.service";
import { sendMessage } from "../messages/messages.service";
import type { SendMessageResult } from "../messages/messages.service";

export interface EnsureConversationResult {
  conversation: ConversationDto;
  created: boolean;
}

/** Ensure a 1:1 conversation exists between two participants (TDD §6.4). */
export async function ensureConversation(
  participantIds: [string, string],
): Promise<EnsureConversationResult> {
  const [a, b] = participantIds;
  if (a === b) throw AppError.validation("Participants must be distinct");

  const users = await User.find({ _id: { $in: [a, b] } });
  if (users.length !== 2) throw AppError.notFound("One or more participants not found");
  const viewer = users.find((u) => u._id.toString() === a)!;
  const peer = users.find((u) => u._id.toString() === b)!;

  const existing = await Conversation.findOne({ "participants.userId": { $all: [a, b] } });
  if (existing) {
    return { conversation: toConversationDto(existing, a, peer), created: false };
  }
  const created = await Conversation.create({ participants: [{ userId: a }, { userId: b }] });
  // Touch viewer to satisfy the unused lint and document perspective.
  void viewer;
  return { conversation: toConversationDto(created, a, peer), created: true };
}

export function listUserConversations(userId: string): Promise<ConversationDto[]> {
  return listConversations(userId);
}

export interface AdminMessagesPage {
  messages: MessageDto[];
  nextCursor: string | null;
}

/** Read any conversation's messages (admin monitoring; no participant restriction). */
export async function getConversationMessages(
  conversationId: string,
  query: { since?: string; limit?: number },
): Promise<AdminMessagesPage> {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw AppError.notFound("Conversation not found");

  const limit = query.limit ?? 50;
  let docs;
  if (query.since) {
    docs = await Message.find({ conversationId, sentAt: { $gt: new Date(query.since) } })
      .sort({ sentAt: 1 })
      .limit(limit);
  } else {
    docs = (await Message.find({ conversationId }).sort({ sentAt: -1 }).limit(limit)).reverse();
  }
  const nextCursor = docs.length
    ? docs[docs.length - 1].sentAt.toISOString()
    : (query.since ?? null);
  return { messages: docs.map(toMessageDto), nextCursor };
}

/**
 * Chat simulation (TDD §6.4) — send a message **as** a participant. Authz: `asUserId`
 * must be a participant of the conversation. Reuses the normal send path so unread +
 * lastMessage update exactly as a real send (the simulated party is indistinguishable).
 */
export async function simulateMessage(
  conversationId: string,
  input: { asUserId: string; type: "TEXT" | "IMAGE"; text?: string; mediaId?: string; clientId?: string },
): Promise<SendMessageResult> {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw AppError.notFound("Conversation not found");

  const isParticipant = conversation.participants.some(
    (p) => p.userId.toString() === input.asUserId,
  );
  if (!isParticipant) {
    throw AppError.forbidden("asUserId must be a participant of the conversation");
  }

  return sendMessage(input.asUserId, conversationId, {
    clientId: input.clientId ?? randomUUID(),
    type: input.type,
    text: input.text,
    mediaId: input.mediaId,
  });
}
