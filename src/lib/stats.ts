import { PortalUser, SectionKey } from "@/lib/data";

export function buildUserStats(user: PortalUser) {
  const totalStorage = user.managedPools.reduce((sum, pool) => sum + pool.totalBytes, 0);
  const usedStorage = user.managedPools.reduce((sum, pool) => sum + pool.usedBytes, 0);
  const freeStorage = Math.max(totalStorage - usedStorage, 0);

  const photosBytes = user.sections.photos.reduce((sum, item) => sum + item.size, 0);
  const videosBytes = user.sections.videos.reduce((sum, item) => sum + item.size, 0);
  const driveBytes = user.sections.drive.reduce((sum, item) => sum + item.size, 0);
  const passwordBytes = user.sections.passwords.reduce(
    (sum, item) => sum + item.encryptedBytes,
    0,
  );
  const notesBytes = user.sections.notes.reduce((sum, item) => sum + item.size, 0);
  const messagesBytes = user.sections.messages.reduce((sum, item) => sum + item.size, 0);
  const mailBytes = user.sections.mail.reduce((sum, item) => sum + item.size, 0);

  const bySection: Record<
    SectionKey,
    {
      used: number;
      count: number;
    }
  > = {
    photos: { used: photosBytes, count: user.sections.photos.length },
    videos: { used: videosBytes, count: user.sections.videos.length },
    drive: { used: driveBytes, count: user.sections.drive.length },
    passwords: { used: passwordBytes, count: user.sections.passwords.length },
    notes: { used: notesBytes, count: user.sections.notes.length },
    messages: { used: messagesBytes, count: user.sections.messages.length },
    mail: { used: mailBytes, count: user.sections.mail.length },
  };

  return {
    totalStorage,
    usedStorage,
    freeStorage,
    percentageUsed: totalStorage === 0 ? 0 : Math.round((usedStorage / totalStorage) * 100),
    photoCount: user.sections.photos.filter((item) => item.kind === "image").length,
    videoCount: user.sections.videos.length,
    mailCount: user.sections.mail.length,
    passwordCount: user.sections.passwords.length,
    bySection,
  };
}
