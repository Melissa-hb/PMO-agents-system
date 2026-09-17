package com.pmo.backend.web;

import java.util.UUID;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pmo.backend.dto.RunPhaseRequest;
import com.pmo.backend.dto.RunPhaseResponse;
import com.pmo.backend.service.PmoAgentService;

/** Reemplaza la Edge Function `pmo-agent` (POST /functions/v1/pmo-agent). */
@RestController
@RequestMapping("/api/projects/{projectId}/phases/{phaseNumber}")
public class PmoAgentController {

    private final PmoAgentService pmoAgentService;

    public PmoAgentController(PmoAgentService pmoAgentService) {
        this.pmoAgentService = pmoAgentService;
    }

    @PostMapping("/run")
    public RunPhaseResponse run(@PathVariable UUID projectId, @PathVariable int phaseNumber, @RequestBody(required = false) RunPhaseRequest request) {
        RunPhaseRequest effective = request != null ? request
                : new RunPhaseRequest(1, null, null, null, null, null, null, null, null);
        return pmoAgentService.runPhase(projectId, phaseNumber, effective);
    }
}
