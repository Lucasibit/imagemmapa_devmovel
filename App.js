import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Image,
  Modal,
  StatusBar,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

import { useMarkers } from "./src/hooks/useMarkers";
import { formatTime } from "./src/utils/format";

const { width, height } = Dimensions.get("window");

export default function App() {
  const [location, setLocation] = useState(null);
  // Estado e operações dos marcadores (Cloudinary + Firestore) ficam no hook.
  const { markers, loading, saving, error, saveMarker, removeMarker } = useMarkers();
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);

  const cameraRef = useRef(null);
  const mapRef = useRef(null);
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const previewScale = useRef(new Animated.Value(0.8)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermission(status === "granted");

    if (status !== "granted") return;

    // 1️⃣ Tenta a última localização conhecida — instantâneo
    const last = await Location.getLastKnownPositionAsync({});
    if (last) {
      setLocation(last.coords);
    }

    // 2️⃣ Busca a localização atual em background (mais precisa)
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // mais rápido que High
    });

    setLocation(current.coords);

    // Anima o mapa suavemente para a posição refinada
    mapRef.current?.animateToRegion(
      {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      600
    );
  })();
}, []);


  const handleCameraButton = async () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert(
          "Permissão necessária",
          "Por favor, conceda permissão à câmera nas configurações do app."
        );
        return;
      }
    }

    setSelectedMarker(null);
    setCapturedPhoto(null);
    setCameraVisible(true);
  };

const takePicture = async () => {
  if (!cameraRef.current) return;

  try {
    // Flash de obturador
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
      base64: false,
    });

    const currentLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const coordinate = {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
    };

    // Fecha a câmera; o overlay de "saving" indica o upload em andamento.
    setCameraVisible(false);

    // Centraliza o mapa na posição da captura.
    mapRef.current?.animateToRegion(
      { ...coordinate, latitudeDelta: 0.005, longitudeDelta: 0.005 },
      800
    );

    // Upload no Cloudinary + gravação no Firestore (RF01/RF02).
    const newMarker = await saveMarker(photo.uri, coordinate);

    // Exibe o preview do marker recém-criado.
    setSelectedMarker(newMarker);
    showPreviewAnimation();
  } catch (err) {
    Alert.alert(
      "Erro",
      err?.message || "Não foi possível capturar e salvar a foto."
    );
  }
};

// Toque longo no marker: confirma e executa a exclusão (RF05/RF06).
const handleMarkerLongPress = (marker) => {
  Alert.alert(
    "Excluir marcador",
    "Deseja realmente excluir este marcador?",
    [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMarker(marker.id);
            // Fecha o preview caso o marker excluído esteja aberto.
            if (selectedMarker?.id === marker.id) {
              closePreview();
            }
          } catch (err) {
            Alert.alert("Erro", err?.message || "Não foi possível excluir.");
          }
        },
      },
    ]
  );
};
  const showPreviewAnimation = () => {
    previewOpacity.setValue(0);
    previewScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(previewScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleMarkerPress = (marker) => {
    setSelectedMarker(marker);
    showPreviewAnimation();

    mapRef.current?.animateToRegion(
      {
        latitude: marker.coordinate.latitude,
        longitude: marker.coordinate.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      },
      500
    );
  };

  const closePreview = () => {
    Animated.parallel([
      Animated.timing(previewOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(previewScale, {
        toValue: 0.8,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setSelectedMarker(null));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* MAP */}
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          onPress={() => selectedMarker && closePreview()}
        >
          {markers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={marker.coordinate}
              onPress={() => handleMarkerPress(marker)}
              onLongPress={() => handleMarkerLongPress(marker)}
            >
              <View style={styles.markerContainer}>
                <View style={styles.markerBubble}>
                  <Image
                    source={{ uri: marker.imageUrl }}
                    style={styles.markerThumbnail}
                  />
                </View>
                <View style={styles.markerPin} />
                <View style={styles.markerDot} />
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>📍 Obtendo localização...</Text>
        </View>
      )}

      {/* PHOTO PREVIEW POPUP */}
      {selectedMarker && (
        <Animated.View
          style={[
            styles.previewContainer,
            {
              opacity: previewOpacity,
              transform: [{ scale: previewScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={closePreview}
          >
            <Text style={styles.previewCloseTxt}>✕</Text>
          </TouchableOpacity>

          <Image
            source={{ uri: selectedMarker.imageUrl }}
            style={styles.previewImage}
            resizeMode="cover"
          />

          <View style={styles.previewFooter}>
            <Text style={styles.previewTime}>
              🕐 {formatTime(selectedMarker.createdAt)}
            </Text>
          </View>

          {/* Little arrow pointing down */}
          <View style={styles.previewArrow} />
        </Animated.View>
      )}

      {/* UPLOAD OVERLAY (enquanto envia ao Cloudinary / salva no Firestore) */}
      {saving && (
        <View style={styles.savingOverlay} pointerEvents="auto">
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color="#4ade80" />
            <Text style={styles.savingText}>Enviando foto…</Text>
          </View>
        </View>
      )}

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📸 FotoMapa</Text>
        <View style={styles.headerBadge}>
          {loading ? (
            <ActivityIndicator size="small" color="#052e16" />
          ) : (
            <Text style={styles.headerBadgeText}>
              {markers.length} foto{markers.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* ERROR BANNER (ex.: falha ao carregar marcadores no início) */}
      {error && !saving && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {error}</Text>
        </View>
      )}

      {/* CAMERA BUTTON */}
      <Animated.View
        style={[
          styles.cameraButtonWrapper,
          { transform: [{ scale: buttonScale }] },
        ]}
      >
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleCameraButton}
          activeOpacity={0.85}
        >
          <View style={styles.cameraButtonInner}>
            <Text style={styles.cameraButtonIcon}>📷</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.cameraButtonLabel}>Tirar foto</Text>
      </Animated.View>

      {/* CAMERA MODAL */}
      <Modal
        visible={cameraVisible}
        animationType="slide"
        statusBarTranslucent
      >
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
          />
          {/* Overlay como irmão da câmera (CameraView não aceita filhos). */}
          <View style={styles.cameraOverlay}>
              {/* Top bar */}
              <View style={styles.cameraTopBar}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setCameraVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>✕ Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.cameraHint}>Encaixe o momento</Text>
                <View style={{ width: 90 }} />
              </View>

              {/* Viewfinder corners */}
              <View style={styles.viewfinderWrapper}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>

              {/* Bottom bar with shutter */}
              <View style={styles.cameraBottomBar}>
                <View style={styles.shutterWrapper}>
                  <TouchableOpacity
                    style={styles.shutterButton}
                    onPress={takePicture}
                    activeOpacity={0.8}
                  >
                    <View style={styles.shutterButtonInner} />
                  </TouchableOpacity>
                  <Text style={styles.shutterLabel}>Fotografar</Text>
                </View>
              </View>

              {/* Flash overlay */}
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "#fff", opacity: flashOpacity },
                ]}
              />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PREVIEW_W = 150;
const PREVIEW_H = 195;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f0f14",
  },

  // ── MAP ──────────────────────────────────────────────────────────────
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f0f14",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  // ── HEADER ───────────────────────────────────────────────────────────
  header: {
    position: "absolute",
    top: 52,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15,15,20,0.82)",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    // Glassmorphism shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerBadge: {
    backgroundColor: "#4ade80",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerBadgeText: {
    color: "#052e16",
    fontSize: 12,
    fontWeight: "700",
  },

  // ── MARKER ───────────────────────────────────────────────────────────
  markerContainer: {
    alignItems: "center",
  },
  markerBubble: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  markerThumbnail: {
    width: "100%",
    height: "100%",
  },
  markerPin: {
    width: 3,
    height: 10,
    backgroundColor: "#fff",
    marginTop: -1,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
    marginTop: -1,
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },

  // ── PHOTO PREVIEW ────────────────────────────────────────────────────
  previewContainer: {
    position: "absolute",
    top: 130,
    right: 20,
    width: PREVIEW_W,
    height: PREVIEW_H,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  previewCloseBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCloseTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  previewImage: {
    width: PREVIEW_W,
    height: PREVIEW_H - 32,
  },
  previewFooter: {
    height: 32,
    backgroundColor: "#0f0f14",
    alignItems: "center",
    justifyContent: "center",
  },
  previewTime: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  previewArrow: {
    position: "absolute",
    bottom: -10,
    left: PREVIEW_W / 2 - 10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#0f0f14",
  },

  // ── UPLOAD OVERLAY ───────────────────────────────────────────────────
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  savingCard: {
    backgroundColor: "rgba(15,15,20,0.95)",
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  savingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 12,
    letterSpacing: 0.3,
  },

  // ── ERROR BANNER ─────────────────────────────────────────────────────
  errorBanner: {
    position: "absolute",
    bottom: 140,
    left: 20,
    right: 20,
    backgroundColor: "rgba(220,38,38,0.92)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorBannerText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  // ── CAMERA BUTTON ────────────────────────────────────────────────────
  cameraButtonWrapper: {
    position: "absolute",
    bottom: 44,
    alignSelf: "center",
    alignItems: "center",
  },
  cameraButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#4ade80",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4ade80",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 14,
  },
  cameraButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#052e16",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(74,222,128,0.3)",
  },
  cameraButtonIcon: {
    fontSize: 26,
  },
  cameraButtonLabel: {
    marginTop: 8,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    opacity: 0.7,
  },

  // ── CAMERA MODAL ─────────────────────────────────────────────────────
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cameraHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  // Viewfinder corners
  viewfinderWrapper: {
    width: 220,
    height: 220,
    alignSelf: "center",
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#4ade80",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },

  cameraBottomBar: {
    paddingBottom: 56,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
  },
  shutterWrapper: {
    alignItems: "center",
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButtonInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
  },
  shutterLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 10,
    letterSpacing: 0.5,
  },
});