import { Text, StyleSheet, View } from "react-native";

export default function PortalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Files</Text>
      <Text style={styles.desc}>
        Documents saved on this device sync to the cloud when online.
        SQLite local storage coming in next sprint.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f8f9fb" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  desc: { color: "#64748b", lineHeight: 22 },
});
