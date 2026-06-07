import { Conversation } from "../../models/conversation.model";
import { Message } from "../../models/message.model";
import { User } from "../../models/user.model";
import {
  toConversationDto,
  toMessageDto,
  type ConversationDto,
  type MessageDto,
} from "../../lib/serialize";
import { peerIdOf } from "../conversations/conversations.service";

const MAX_SYNC_MESSAGES = 200;

export interface SyncResult {
  conversations: ConversationDto[];
  messages: MessageDto[];
  serverTime: string;
}

/**
 * Polling sync (TDD §5.6). Returns everything visible to the caller that changed since
 * the cursor: changed conversations (with unread + lastMessage) and new messages across
 * the caller's threads. The client advances its cursor to `serverTime`.
 */
export async function getSync(callerId: string, since?: string): Promise<SyncResult> {
  const sinceDate = since ? new Date(since) : null;

  // All of the caller's conversations (ids needed for the message window).
  const allConversations = await Conversation.find({ "participants.userId": callerId }).sort({
    lastMessageAt: -1,
  });

  const changed = sinceDate
    ? allConversations.filter((c) => c.lastMessageAt && c.lastMessageAt > sinceDate)
    : allConversations;

  let conversations: ConversationDto[] = [];
  if (changed.length > 0) {
    const users = await User.find({ _id: { $in: changed.map((c) => peerIdOf(c, callerId)) } });
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    conversations = changed
      .map((c) => {
        const peer = byId.get(peerIdOf(c, callerId).toString());
        return peer ? toConversationDto(c, callerId, peer) : null;
      })
      .filter((c): c is ConversationDto => c !== null);
  }

  // New messages since the cursor across all of the caller's conversations.
  let messages: MessageDto[] = [];
  if (sinceDate && allConversations.length > 0) {
    const docs = await Message.find({
      conversationId: { $in: allConversations.map((c) => c._id) },
      sentAt: { $gt: sinceDate },
    })
      .sort({ sentAt: 1 })
      .limit(MAX_SYNC_MESSAGES);
    messages = docs.map(toMessageDto);
  }

  return { conversations, messages, serverTime: new Date().toISOString() };
}
