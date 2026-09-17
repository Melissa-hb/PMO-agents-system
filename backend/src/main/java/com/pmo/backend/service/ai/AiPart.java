package com.pmo.backend.service.ai;

import lombok.Builder;
import lombok.Getter;

/**
 * Equivalente a los "parts" del payload que usaba Gemini y que aiModels.ts sigue reutilizando
 * como formato interno neutral antes de traducir a OpenAI/Anthropic. Un part es texto plano
 * o un adjunto binario (PDF/imagen) referenciado por URL y, opcionalmente, ya en base64.
 */
@Getter
@Builder
public class AiPart {
    private String text;

    private String mimeType;
    private String base64Data;
    private String sourceUrl;
    private String filename;

    public static AiPart ofText(String text) {
        return AiPart.builder().text(text).build();
    }

    public boolean isInlineData() {
        return mimeType != null && base64Data != null;
    }
}
