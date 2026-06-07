import { Media } from "../../models/media.model";
import { getStorageAdapter } from "../../lib/storage";

export interface MediaUploadResult {
  mediaId: string;
  url: string;
}

export async function uploadMedia(
  ownerId: string,
  file: Express.Multer.File,
): Promise<MediaUploadResult> {
  const stored = await getStorageAdapter().save({
    buffer: file.buffer,
    contentType: file.mimetype,
    filename: file.originalname,
  });
  const media = await Media.create({
    ownerId,
    url: stored.url,
    contentType: file.mimetype,
    sizeBytes: file.size,
  });
  return { mediaId: media._id.toString(), url: stored.url };
}
