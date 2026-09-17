package com.pmo.backend.service;

import java.text.Normalizer;

/** Puerto exacto de la funcion safeName/normalizePath usada en varios hooks del frontend. */
public final class FileNameSanitizer {

    private FileNameSanitizer() {
    }

    public static String sanitize(String fileName) {
        String normalized = Normalizer.normalize(fileName, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^a-zA-Z0-9._-]", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_+|_+$", "");
        return normalized.isBlank() ? "archivo" : normalized;
    }
}
