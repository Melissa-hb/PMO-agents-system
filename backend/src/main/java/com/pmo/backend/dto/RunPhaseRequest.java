package com.pmo.backend.dto;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

public record RunPhaseRequest(
        Integer iteration,
        JsonNode comments,
        String externalFileUrl,
        String pmoType,
        String comentarioConsultor,
        String predictivaFileUrl,
        String agilFileUrl,
        List<String> predictivaFileUrls,
        List<String> agilFileUrls
) {
}
