import type { DocumentPacket, PacketItem, UserProfile } from "@/lib/profile/types";
import { maxPacketItems, maxPackets } from "@/lib/subscription/plans";

export type { PacketItem };

export function getPackets(profile: UserProfile): DocumentPacket[] {
  return profile.library?.packets ?? [];
}

/** Ordered contents — merges legacy templateIds + savedLocalIds when items is empty. */
export function normalizePacketItems(packet: DocumentPacket): PacketItem[] {
  if (packet.items?.length) return packet.items;
  return [
    ...packet.templateIds.map((id) => ({ type: "template" as const, id })),
    ...packet.savedLocalIds.map((id) => ({ type: "saved" as const, id })),
  ];
}

function syncPacketArrays(packet: DocumentPacket, items: PacketItem[]): DocumentPacket {
  return {
    ...packet,
    items,
    templateIds: items.filter((i) => i.type === "template").map((i) => i.id),
    savedLocalIds: items.filter((i) => i.type === "saved").map((i) => i.id),
    updatedAt: new Date().toISOString(),
  };
}

export function createPacketId(): string {
  return `pkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createPacket(
  profile: UserProfile,
  name: string,
  description?: string
): { packet?: DocumentPacket; error?: string } {
  const packets = getPackets(profile);
  const limit = maxPackets(profile.subscription);
  if (packets.length >= limit) {
    return {
      error: limit === Infinity
        ? "Could not create packet"
        : `Free plan allows ${limit} packets. Upgrade to Pro for unlimited.`,
    };
  }
  const now = new Date().toISOString();
  return {
    packet: {
      id: createPacketId(),
      name: name.trim(),
      description: description?.trim(),
      templateIds: [],
      savedLocalIds: [],
      items: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function addTemplateToPacket(
  profile: UserProfile,
  packetId: string,
  templateId: string
): { packets: DocumentPacket[]; error?: string } {
  const packets = getPackets(profile);
  const packet = packets.find((p) => p.id === packetId);
  if (!packet) return { packets, error: "Packet not found" };

  const items = normalizePacketItems(packet);
  const itemLimit = maxPacketItems(profile.subscription);
  if (items.length >= itemLimit) {
    return {
      packets,
      error: itemLimit === Infinity
        ? "Packet is full"
        : `Free plan allows ${itemLimit} items per packet. Upgrade to Pro for more.`,
    };
  }
  if (items.some((i) => i.type === "template" && i.id === templateId)) return { packets };

  return {
    packets: packets.map((p) =>
      p.id === packetId
        ? syncPacketArrays(p, [...items, { type: "template", id: templateId }])
        : p
    ),
  };
}

export function addSavedDocToPacket(
  profile: UserProfile,
  packetId: string,
  localId: string
): { packets: DocumentPacket[]; error?: string } {
  const packets = getPackets(profile);
  const packet = packets.find((p) => p.id === packetId);
  if (!packet) return { packets, error: "Packet not found" };

  const items = normalizePacketItems(packet);
  const itemLimit = maxPacketItems(profile.subscription);
  if (items.length >= itemLimit) {
    return {
      packets,
      error: itemLimit === Infinity
        ? "Packet is full"
        : `Free plan allows ${itemLimit} items per packet. Upgrade to Pro for more.`,
    };
  }
  if (items.some((i) => i.type === "saved" && i.id === localId)) return { packets };

  return {
    packets: packets.map((p) =>
      p.id === packetId
        ? syncPacketArrays(p, [...items, { type: "saved", id: localId }])
        : p
    ),
  };
}

export function removePacketItem(
  profile: UserProfile,
  packetId: string,
  item: { type: "template"; id: string } | { type: "saved"; id: string }
): DocumentPacket[] {
  return getPackets(profile).map((p) => {
    if (p.id !== packetId) return p;
    const items = normalizePacketItems(p).filter(
      (i) => !(i.type === item.type && i.id === item.id)
    );
    return syncPacketArrays(p, items);
  });
}

export function movePacketItem(
  profile: UserProfile,
  packetId: string,
  index: number,
  direction: "up" | "down"
): DocumentPacket[] {
  return getPackets(profile).map((p) => {
    if (p.id !== packetId) return p;
    const items = [...normalizePacketItems(p)];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return p;
    const current = items[index];
    const swap = items[target];
    if (!current || !swap) return p;
    items[index] = swap;
    items[target] = current;
    return syncPacketArrays(p, items);
  });
}

export function deletePacket(profile: UserProfile, packetId: string): DocumentPacket[] {
  return getPackets(profile).filter((p) => p.id !== packetId);
}

export function updatePacket(
  profile: UserProfile,
  packetId: string,
  updates: Partial<Pick<DocumentPacket, "name" | "description">>
): DocumentPacket[] {
  return getPackets(profile).map((p) =>
    p.id === packetId
      ? { ...p, ...updates, updatedAt: new Date().toISOString() }
      : p
  );
}
