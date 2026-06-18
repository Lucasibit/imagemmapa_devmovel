// Acesso à coleção "markers" no Firestore.
//
// Documento (modelo):
// {
//   imageUrl:  string,     // URL pública retornada pelo Cloudinary
//   publicId:  string,     // public_id do Cloudinary (auxilia exclusão futura)
//   latitude:  number,
//   longitude: number,
//   createdAt: timestamp,  // serverTimestamp()
// }
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "markers";

/**
 * Cria um novo marcador no Firestore.
 *
 * @param {{ imageUrl: string, latitude: number, longitude: number, publicId?: string }} data
 * @returns {Promise<string>} id do documento criado.
 */
export async function createMarker({ imageUrl, latitude, longitude, publicId = null }) {
  try {
    const ref = await addDoc(collection(db, COLLECTION), {
      imageUrl,
      publicId,
      latitude,
      longitude,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    console.error("[firestoreService.createMarker]", error);
    throw new Error("Não foi possível salvar o marcador no banco de dados.");
  }
}

/**
 * Recupera todos os marcadores salvos, do mais recente para o mais antigo.
 *
 * @returns {Promise<Array<{
 *   id: string,
 *   imageUrl: string,
 *   publicId: string|null,
 *   latitude: number,
 *   longitude: number,
 *   createdAt: Date|null,
 * }>>}
 */
export async function getMarkers() {
  try {
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        imageUrl: data.imageUrl,
        publicId: data.publicId ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        // serverTimestamp pode ainda não ter resolvido em leituras imediatas.
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    });
  } catch (error) {
    console.error("[firestoreService.getMarkers]", error);
    throw new Error("Não foi possível carregar os marcadores.");
  }
}

/**
 * Remove um marcador do Firestore pelo id.
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteMarker(id) {
  try {
    await deleteDoc(doc(db, COLLECTION, id));
  } catch (error) {
    console.error("[firestoreService.deleteMarker]", error);
    throw new Error("Não foi possível excluir o marcador.");
  }
}
