import { useState, useEffect, useCallback } from "react";
import { uploadImage } from "../services/cloudinaryService";
import {
  createMarker,
  getMarkers,
  deleteMarker,
} from "../services/firestoreService";

/**
 * Normaliza um documento do Firestore para o formato consumido pelo mapa.
 * Mantém `coordinate` para uso direto no <Marker /> do react-native-maps.
 */
function toMapMarker(doc) {
  return {
    id: doc.id,
    imageUrl: doc.imageUrl,
    publicId: doc.publicId ?? null,
    coordinate: {
      latitude: doc.latitude,
      longitude: doc.longitude,
    },
    createdAt: doc.createdAt ?? new Date(),
  };
}

/**
 * Centraliza o estado e as operações dos marcadores:
 * - carrega os marcadores persistidos ao montar (RF03);
 * - faz upload no Cloudinary + grava no Firestore ao salvar (RF01/RF02);
 * - exclui do Firestore e do estado local (RF06).
 */
export function useMarkers() {
  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true); // carga inicial
  const [saving, setSaving] = useState(false); // upload em andamento
  const [error, setError] = useState(null);

  const loadMarkers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const docs = await getMarkers();
      setMarkers(docs.map(toMapMarker));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkers();
  }, [loadMarkers]);

  /**
   * Pipeline de captura: envia a foto ao Cloudinary, persiste no Firestore e
   * adiciona ao estado local. Retorna o marcador criado.
   *
   * @param {string} photoUri
   * @param {{ latitude: number, longitude: number }} coordinate
   */
  const saveMarker = useCallback(async (photoUri, coordinate) => {
    setSaving(true);
    setError(null);
    try {
      const { secure_url, public_id } = await uploadImage(photoUri);

      const id = await createMarker({
        imageUrl: secure_url,
        publicId: public_id,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });

      const newMarker = {
        id,
        imageUrl: secure_url,
        publicId: public_id,
        coordinate,
        createdAt: new Date(),
      };

      setMarkers((prev) => [newMarker, ...prev]);
      return newMarker;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * Remove um marcador do Firestore e do estado local (RF06).
   * @param {string} id
   */
  const removeMarker = useCallback(async (id) => {
    try {
      await deleteMarker(id);
      setMarkers((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return { markers, loading, saving, error, saveMarker, removeMarker, reload: loadMarkers };
}
