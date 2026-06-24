import { Link } from "expo-router";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { CATALOG_STATS, getEssentialDocuments } from "@doc-solid/documents";

export default function HomeScreen() {
  const essential = getEssentialDocuments().slice(0, 6);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Doc Solid</Text>
      <Text style={styles.subtitle}>
        {CATALOG_STATS.total}+ documents for business, individuals, and organizations
      </Text>

      <View style={styles.statsRow}>
        <Stat label="Business" value={CATALOG_STATS.business} />
        <Stat label="Individual" value={CATALOG_STATS.individual} />
        <Stat label="Organization" value={CATALOG_STATS.organization} />
      </View>

      <Link href="/documents" asChild>
        <Pressable style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Browse Documents</Text>
        </Pressable>
      </Link>

      <Link href="/portal" asChild>
        <Pressable style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>My Files</Text>
        </Pressable>
      </Link>

      <Text style={styles.sectionTitle}>Essential Documents</Text>
      {essential.map((doc) => (
        <View key={doc.id} style={styles.docCard}>
          <Text style={styles.docName}>{doc.name}</Text>
          <Text style={styles.docDesc}>{doc.description}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 15, color: "#64748b", marginTop: 8, marginBottom: 20 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#2563eb" },
  statLabel: { fontSize: 12, color: "#64748b" },
  primaryBtn: { backgroundColor: "#2563eb", borderRadius: 10, padding: 14, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryBtn: { backgroundColor: "#fff", borderRadius: 10, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 24 },
  secondaryBtnText: { color: "#0f172a", fontWeight: "600", fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  docCard: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  docName: { fontWeight: "600", fontSize: 15 },
  docDesc: { color: "#64748b", fontSize: 13, marginTop: 4 },
});
