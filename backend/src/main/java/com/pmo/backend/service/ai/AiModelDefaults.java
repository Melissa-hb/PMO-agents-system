package com.pmo.backend.service.ai;

/**
 * Con OpenRouter cualquier modelo se identifica con un slug "vendor/modelo" (ej.
 * "anthropic/claude-opus-5"). El campo es texto libre en el panel de admin, no una lista
 * cerrada; estos defaults reflejan la eleccion del equipo para agentes (razonamiento y
 * planificacion como modelo principal, con un proveedor distinto como respaldo).
 */
public final class AiModelDefaults {
    public static final String DEFAULT_MODEL = "anthropic/claude-opus-5";
    public static final String DEFAULT_FALLBACK_MODEL = "openai/gpt-5.6-luna";

    private AiModelDefaults() {
    }

    /** Extrae el vendor del slug ("openai/gpt-4o" -> "openai"), solo para trazabilidad/metadata. */
    public static String vendorOf(String modelSlug) {
        if (modelSlug == null || modelSlug.isBlank()) return "unknown";
        int slash = modelSlug.indexOf('/');
        return slash > 0 ? modelSlug.substring(0, slash) : modelSlug;
    }
}
