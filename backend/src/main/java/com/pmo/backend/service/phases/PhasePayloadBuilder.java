package com.pmo.backend.service.phases;

public interface PhasePayloadBuilder {
    int phaseNumber();

    PhasePayloadResult build(PhasePayloadContext ctx);
}
