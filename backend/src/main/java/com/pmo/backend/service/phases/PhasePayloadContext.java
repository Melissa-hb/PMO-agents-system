package com.pmo.backend.service.phases;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

public record PhasePayloadContext(
        UUID projectId,
        int iteration,
        JsonNode comments,
        String externalFileUrl,
        List<String> extraFileUrls,
        OffsetDateTime now,
        ObjectNode baseMetadata
) {
}
