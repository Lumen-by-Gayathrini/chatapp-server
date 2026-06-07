import mongoose, { type Model, Schema, type Types } from "mongoose";

export interface IAdmin {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminSchema = new Schema<IAdmin>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

// §7.4: { email: 1 } unique (declared via field `unique` above).

export const Admin: Model<IAdmin> =
  (mongoose.models.Admin as Model<IAdmin>) ?? mongoose.model<IAdmin>("Admin", adminSchema);
