package com.pmo.backend.service.ai;

/**
 * Con Gemini el modelo se identifica con su nombre directo (ej. "gemini-2.5-pro"), sin
 * prefijo de vendor. El campo es texto libre en el panel de admin, no una lista cerrada;
 * verifica que estos defaults existan en el catalogo actual de Gemini
 * (https://ai.google.dev/gemini-api/docs/models) antes de confiar en ellos en produccion.
 */
public final class AiModelDefaults {
    // Alias "-latest" en vez de una version fechada: Google los mueve automaticamente al
    // modelo recomendado vigente, evitando que un nombre fijo quede deprecado con el tiempo
    // (verificado: gemini-2.5-flash ya devuelve 404 "no longer available to new users").
    // Flash / Flash-Lite en vez de Pro: el modelo global es el segundo intento cuando falla el de
    // la fase, y no conviene que un error temporal escale al modelo mas caro.
    public static final String DEFAULT_MODEL = "gemini-flash-latest";
    public static final String DEFAULT_FALLBACK_MODEL = "gemini-flash-lite-latest";

    private AiModelDefaults() {
    }

    /** Extrae el vendor de un slug con formato "vendor/modelo"; si no lo tiene, retorna el nombre tal cual. */
    public static String vendorOf(String modelSlug) {
        if (modelSlug == null || modelSlug.isBlank()) return "unknown";
        int slash = modelSlug.indexOf('/');
        return slash > 0 ? modelSlug.substring(0, slash) : "gemini";
    }
}
