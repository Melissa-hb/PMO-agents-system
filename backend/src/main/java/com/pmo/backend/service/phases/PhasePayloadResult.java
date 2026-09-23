package com.pmo.backend.service.phases;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * @param staticContext texto fijo (igual para todos los proyectos) que se coloca justo despues
 *                      del prompt de sistema y ANTES del JSON de entrada. Al quedar como prefijo
 *                      identico entre llamadas, Gemini puede reutilizarlo de su cache implicita y
 *                      cobrarlo con descuento. Null si la fase no tiene contexto fijo.
 */
public record PhasePayloadResult(ObjectNode metadata, ObjectNode payload, JsonNode comments, List<FileRef> fileUrls,
                                 String staticContext) {

    public PhasePayloadResult(ObjectNode metadata, ObjectNode payload, JsonNode comments, List<FileRef> fileUrls) {
        this(metadata, payload, comments, fileUrls, null);
    }
}
