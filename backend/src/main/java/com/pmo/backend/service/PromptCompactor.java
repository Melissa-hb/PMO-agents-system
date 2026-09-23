package com.pmo.backend.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

/**
 * Compacta el formato de los prompts antes de enviarlos, sin cambiar su contenido: quita espacios
 * al final de linea, saltos de linea de Windows, lineas vacias repetidas y el relleno de las tablas markdown, y minifica los
 * bloques ```json``` que sean JSON valido (los ejemplos con placeholders se dejan como estan).
 * Los prompts guardados en configuracion_agentes no se modifican. Es determinista, asi que no
 * rompe la cache implicita de Gemini.
 */
@Component
public class PromptCompactor {

    private static final Pattern JSON_FENCE = Pattern.compile("(```(?:json)?)[ \\t]*\\n(.*?)\\n[ \\t]*```", Pattern.DOTALL);
    private static final Pattern TABLE_CELL_PADDING = Pattern.compile("[ \\t]*\\|[ \\t]*");
    private static final Pattern EXTRA_BLANK_LINES = Pattern.compile("\\n{3,}");

    private final ObjectMapper objectMapper;

    public PromptCompactor(ObjectMapper objectMapper) {
        // Copia propia que conserva los numeros tal cual estan escritos (p. ej. 0.00 no pasa a 0.0:
        // en los esquemas de los prompts el numero de decimales es informacion).
        this.objectMapper = objectMapper.copy()
                .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
                .setNodeFactory(JsonNodeFactory.withExactBigDecimals(true));
    }

    public String compact(String text) {
        if (text == null || text.isEmpty()) return text;
        // Los prompts guardados traen saltos de linea de Windows (\r\n); se normalizan a \n.
        text = text.replace("\r\n", "\n").replace('\r', '\n');

        Matcher m = JSON_FENCE.matcher(text);
        StringBuilder minified = new StringBuilder();
        while (m.find()) {
            String replacement = m.group(0);
            try {
                replacement = m.group(1) + "\n" + objectMapper.writeValueAsString(objectMapper.readTree(m.group(2))) + "\n```";
            } catch (Exception ignored) {
                // Ejemplo con placeholders o comentarios: no es JSON valido, se conserva tal cual.
            }
            m.appendReplacement(minified, Matcher.quoteReplacement(replacement));
        }
        m.appendTail(minified);

        StringBuilder out = new StringBuilder(minified.length());
        for (String line : minified.toString().split("\n", -1)) {
            out.append(line.stripLeading().startsWith("|")
                    ? TABLE_CELL_PADDING.matcher(line).replaceAll("|")
                    : line.stripTrailing()).append('\n');
        }
        return EXTRA_BLANK_LINES.matcher(out).replaceAll("\n\n").strip();
    }
}
