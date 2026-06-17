import { Audio } from "expo-av";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Voice() {
  const [recording, setRecording] = useState(null);
  const [recordings, setRecordings] = useState([]);
  const [sound, setSound] = useState(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const startRecording = async () => {
    try {
      const permission =
        await Audio.requestPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Microphone permission is needed"
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } =
        await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

      setRecording(recording);

      Alert.alert("Recording Started");
    } catch (error) {
      console.log(error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      setRecordings((prev) => [
        {
          id: Date.now().toString(),
          uri,
          title: `Recording ${prev.length + 1}`,
        },
        ...prev,
      ]);

      setRecording(null);

      Alert.alert(
        "Success",
        "Recording Saved"
      );
    } catch (error) {
      console.log(error);
    }
  };

  const playRecording = async (uri) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: playbackObject } =
        await Audio.Sound.createAsync({
          uri,
        });

      setSound(playbackObject);

      await playbackObject.playAsync();
    } catch (error) {
      console.log(error);

      Alert.alert(
        "Error",
        "Unable to play recording"
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <Text style={styles.headerTag}>
          VOICE HUB
        </Text>

        <Text style={styles.headerTitle}>
          Voice Notes
        </Text>

        <Text style={styles.headerSubtitle}>
          Record and replay your audio notes
        </Text>
      </View>

      {/* Recording Button */}

      {!recording ? (
        <TouchableOpacity
          style={styles.recordButton}
          onPress={startRecording}
        >
          <Text style={styles.buttonText}>
            🎤 Start Recording
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.stopButton}
          onPress={stopRecording}
        >
          <Text style={styles.buttonText}>
            ⏹ Stop Recording
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>
        My Recordings
      </Text>

      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 30,
        }}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            No recordings yet
          </Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              playRecording(item.uri)
            }
          >
            <View>
              <Text style={styles.recordingTitle}>
                🎵 {item.title}
              </Text>

              <Text style={styles.recordingSub}>
                Tap to Play
              </Text>
            </View>

            <Text style={styles.playIcon}>
              ▶
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  header: {
    backgroundColor: "#0B2D52",
    paddingTop: 70,
    paddingHorizontal: 25,
    paddingBottom: 60,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  headerTag: {
    color: "#F59E0B",
    fontWeight: "700",
    letterSpacing: 1,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
    marginTop: 8,
  },

  headerSubtitle: {
    color: "#D1D5DB",
    marginTop: 8,
  },

  recordButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 20,
    marginTop: -25,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    elevation: 4,
  },

  stopButton: {
    backgroundColor: "#EF4444",
    marginHorizontal: 20,
    marginTop: -25,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    elevation: 4,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 26,
    fontWeight: "bold",
    margin: 20,
    color: "#111827",
  },

  emptyText: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 50,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2,
  },

  recordingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },

  recordingSub: {
    color: "#6B7280",
    marginTop: 4,
  },

  playIcon: {
    color: "#10B981",
    fontSize: 24,
    fontWeight: "bold",
  },
});