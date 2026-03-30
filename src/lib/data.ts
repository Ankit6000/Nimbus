export type SectionKey =
  | "photos"
  | "videos"
  | "drive"
  | "passwords"
  | "notes"
  | "messages"
  | "mail";

export type PhotoItem = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "video";
  takenAt: string;
  source: string;
};

export type DriveItem = {
  id: string;
  name: string;
  size: number;
  type: "folder" | "document" | "archive" | "sheet" | "image" | "video";
  updatedAt: string;
};

export type PasswordItem = {
  id: string;
  label: string;
  username: string;
  updatedAt: string;
  encryptedBytes: number;
};

export type NoteItem = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  size: number;
};

export type MessageItem = {
  id: string;
  contact: string;
  channel: string;
  updatedAt: string;
  size: number;
};

export type MailItem = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  size: number;
  unread: boolean;
};

export type PortalUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  roleLabel: string;
  assignedChannels: number;
  managedPools: Array<{
    id: string;
    totalBytes: number;
    usedBytes: number;
    kind: "google";
  }>;
  icloud: {
    lastSync: string | null;
    newItemsWaiting: number;
    accounts: Array<{
      id: string;
      label: string;
      appleEmail: string;
      status: string;
      lastSync: string | null;
    }>;
  };
  sections: {
    photos: PhotoItem[];
    videos: PhotoItem[];
    drive: DriveItem[];
    passwords: PasswordItem[];
    notes: NoteItem[];
    messages: MessageItem[];
    mail: MailItem[];
  };
};

export type AdminManagedMember = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  roleLabel: string;
  createdAt: string;
  hiddenAccounts: Array<{
    id: string;
    label: string;
    email: string;
    kind: "google";
    status: string;
    totalBytes: number;
    usedBytes: number;
    hasRefreshToken: boolean;
    savedPassword: string | null;
  }>;
  appleAccounts: Array<{
    id: string;
    label: string;
    appleEmail: string;
    status: string;
    lastSync: string | null;
  }>;
};

export type AdminAuditEntry = {
  id: string;
  actorLabel: string;
  targetLabel: string | null;
  action: string;
  details: string | null;
  createdAt: string;
};

export type HiddenAccountSyncSummary = {
  id: string;
  label: string;
  email: string;
  hasRefreshToken: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncMessage: string | null;
  lastItemCount: number;
};

export type UploadHistoryEntry = {
  id: string;
  title: string;
  source: string;
  size: number;
  occurredAt: string;
  section: "photos" | "videos" | "drive";
};

export const sectionMeta: Record<
  SectionKey,
  {
    title: string;
    description: string;
    accent: string;
  }
> = {
  photos: {
    title: "Photos",
    description: "Image library shown as a visual gallery inside your vault.",
    accent: "from-[#c55c32] to-[#efc7b4]",
  },
  videos: {
    title: "Videos",
    description: "Video library with motion previews where available.",
    accent: "from-[#3e5ecf] to-[#b6c6ff]",
  },
  drive: {
    title: "Files",
    description: "Full file browser across your vault library, including photos and videos.",
    accent: "from-[#436b5c] to-[#9ec3aa]",
  },
  passwords: {
    title: "Passwords",
    description: "Encrypted credentials stored in the vault itself, not pulled from Keychain.",
    accent: "from-[#76321a] to-[#d89e74]",
  },
  notes: {
    title: "Notes",
    description: "Private notes captured in the vault or imported from approved sources.",
    accent: "from-[#b89132] to-[#f4ddb2]",
  },
  messages: {
    title: "Messages",
    description: "Imported message archives and conversation snapshots managed by the portal.",
    accent: "from-[#7a5ef8] to-[#c2b3ff]",
  },
  mail: {
    title: "Mail",
    description: "Mailboxes aggregated behind the scenes inside your vault.",
    accent: "from-[#285ea8] to-[#acd2ff]",
  },
};
