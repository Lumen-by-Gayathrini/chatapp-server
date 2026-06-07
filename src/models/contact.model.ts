import mongoose, { type Model, Schema, type Types } from "mongoose";

export interface IContact {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  contactUserId: Types.ObjectId;
  alias: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContact>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contactUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    alias: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

// §7.4: { ownerId: 1, contactUserId: 1 } unique — dedupe contacts.
contactSchema.index({ ownerId: 1, contactUserId: 1 }, { unique: true });

export const Contact: Model<IContact> =
  (mongoose.models.Contact as Model<IContact>) ??
  mongoose.model<IContact>("Contact", contactSchema);
