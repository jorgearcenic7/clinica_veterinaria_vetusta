import { validateUploadFile } from "./utils.js";

export async function uploadPetImage(supabase, ownerId, petId, file) {
  console.log("selected file", file);
  validateUploadFile(file, "image");
  const safeName = safeFileName(file.name);
  const filePath = `${ownerId}/${petId}/${Date.now()}-${safeName}`;
  console.log("upload path", filePath);
  const { data, error } = await supabase.storage.from("pet-images").upload(filePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  console.log("upload result", data, error);

  if (error) {
    console.error("upload image error", error);
    throw error;
  }

  const signedUrl = await signedPetImageUrl(supabase, filePath);

  if (!signedUrl) {
    throw new Error("La imagen se subió, pero Supabase no permite leerla. Revisa las políticas del bucket pet-images.");
  }

  return filePath;
}

export async function uploadPetDocumentFile(supabase, petId, file) {
  validateUploadFile(file, "document");
  const safeName = safeFileName(file.name);
  const filePath = `${petId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("pet-documents").upload(filePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { fileUrl: filePath, filePath };
}

export async function logDocumentUpload(supabase, documentItem, file) {
  const { error } = await supabase.from("document_upload_logs").insert({
    document_id: documentItem.id,
    pet_id: documentItem.pet_id,
    uploaded_by: documentItem.uploaded_by,
    source: documentItem.source,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
  });

  if (error) {
    console.warn("Document upload log error:", error.message);
  }
}

export async function removePetDocumentFile(supabase, filePath) {
  if (!filePath || filePath.startsWith("http")) {
    return;
  }

  const { error } = await supabase.storage.from("pet-documents").remove([filePath]);

  if (error) {
    console.warn("Document file delete error:", error.message);
  }
}

export async function signedPetImageUrl(supabase, imagePath) {
  if (!imagePath) {
    return "";
  }

  if (imagePath.startsWith("http")) {
    console.error("signed url error", new Error("pets.image_url debe ser un path relativo del bucket pet-images, no una URL pública."));
    return "";
  }

  const candidates = candidatePetImagePaths(imagePath);

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage.from("pet-images").createSignedUrl(candidate, 3600);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.error("signed url error", error);
    }
  }

  return "";
}

export async function signedPetDocumentUrl(supabase, filePath) {
  if (!filePath) {
    return "";
  }

  if (filePath.startsWith("http")) {
    return filePath;
  }

  const { data, error } = await supabase.storage.from("pet-documents").createSignedUrl(filePath, 3600);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

function safeFileName(fileName) {
  return String(fileName || "archivo")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "archivo";
}

function candidatePetImagePaths(imagePath) {
  const value = String(imagePath || "").trim();

  if (!value) {
    return [];
  }

  const candidates = [value];
  const parts = value.split("/");

  if (parts.length === 3) {
    candidates.push(`pets/${parts[1]}/${parts[2]}`);
  }

  if (!value.startsWith("pets/") && parts.length >= 2) {
    candidates.push(`pets/${value}`);
  }

  if (value.startsWith("pets/")) {
    candidates.push(value.replace(/^pets\//, ""));
  }

  return [...new Set(candidates)];
}
