package com.pmo.backend.service.phases;

/**
 * Adjunto que se envia a la IA.
 *
 * @param pdfPolicy como optimizar el PDF antes de enviarlo (null = se envia tal cual).
 */
public record FileRef(String url, String type, String label, PdfPolicy pdfPolicy) {

    public FileRef(String url, String type, String label) {
        this(url, type, label, null);
    }

    /**
     * @param maxPages      paginas maximas a enviar como PDF (null = sin limite).
     * @param preferLayout  true si el documento es visual (organigrama, mapa de procesos...) y
     *                      nunca debe reemplazarse por su texto extraido.
     */
    public record PdfPolicy(Integer maxPages, boolean preferLayout) {
    }
}
