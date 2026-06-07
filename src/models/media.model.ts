import mongoose, { type Model, Schema, type Types } from "mongoose";

/**
 * Uploaded media (Phase 5). A two-step flow (upload → reference by `mediaId` when
 * sending) needs the upload persisted so a later send — possibly on a different
 * serverless instance — can resolve `mediaId → url`. Small extension to the §7 model
 * set, required by the `{mediaId, url}` contract (TDD §5.5).
 */
export interface IMedia {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  url: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    url: { type: String, required: true },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
  },
  { timestamps: true },
);

export const Media: Model<IMedia> =
  (mongoose.models.Media as Model<IMedia>) ?? mongoose.model<IMedia>("Media", mediaSchema);
