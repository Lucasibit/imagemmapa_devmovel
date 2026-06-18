
const CLOUD_NAME = "dflcryepi";
const UPLOAD_PRESET = "expo_markers";

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;


export async function uploadImage(photoUri) {
  if (!photoUri) {
    throw new Error("uploadImage: photoUri é obrigatório.");
  }

  const formData = new FormData();
  // No React Native o "file" é descrito por { uri, type, name }.
  formData.append("file", {
    uri: photoUri,
    type: "image/jpeg",
    name: `marker_${Date.now()}.jpg`,
  });
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.secure_url) {
      const reason = data?.error?.message || "Resposta inválida do Cloudinary.";
      throw new Error(reason);
    }

    return { secure_url: data.secure_url, public_id: data.public_id };
  } catch (error) {
    console.error("[cloudinaryService.uploadImage]", error);
    throw new Error("Falha ao enviar a imagem para o Cloudinary.");
  }
}
