import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Doc Solid" }} />
      <Stack.Screen name="documents/index" options={{ title: "Documents" }} />
      <Stack.Screen name="portal/index" options={{ title: "My Files" }} />
    </Stack>
  );
}
