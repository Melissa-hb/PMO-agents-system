package com.pmo.backend.service.phases;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

public record PhasePayloadResult(ObjectNode metadata, ObjectNode payload, JsonNode comments, List<FileRef> fileUrls) {
}
