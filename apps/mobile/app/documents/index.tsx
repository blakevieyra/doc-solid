import { ScrollView, Text, StyleSheet, View } from "react-native";
import { getCatalog } from "@doc-solid/documents";

export default function DocumentsScreen() {
  const catalog = getCatalog();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.count}>{catalog.length} document types</Text>
      {catalog.map((doc) => (
        <View key={doc.id} style={styles.card}>
          <Text style={styles.name}>{doc.name}</Text>
          <Text style={styles.desc}>{doc.description}</Text>
          <View style={styles.tags}>
            <Text style={styles.tag}>{doc.domain}</Text>
            <Text style={styles.tag}>{doc.priority}</Text>
            {doc.hasFullTemplate && <Text style={[styles.tag, styles.ready]}>Ready</Text>}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fb" },
  content: { padding: 16 },
  count: { color: "#64748b", marginBottom: 12 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#e2e8f0" },
  name: { fontWeight: "600", fontSize: 15 },
  desc: { color: "#64748b", fontSize: 13, marginTop: 4 },
  tags: { flexDirection: "row", gap: 6, marginTop: 8 },
  tag: { fontSize: 11, backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  ready: { backgroundColor: "#dcfce7", color: "#166534" },
});
