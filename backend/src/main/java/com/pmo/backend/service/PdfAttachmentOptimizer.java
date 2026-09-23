package com.pmo.backend.service;

import java.io.ByteArrayOutputStream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.pmo.backend.service.phases.FileRef.PdfPolicy;

/**
 * Decide como enviar un PDF a Gemini para pagar menos tokens sin perder lo que el agente necesita.
 * Gemini cobra ~258 tokens por pagina de PDF; el texto plano cuesta ~1 token cada 4 caracteres.
 * <ul>
 *   <li>Texto disperso (presentaciones, formatos): el texto extraido es mas barato que las paginas,
 *       asi que se envia como texto, salvo en documentos visuales (preferLayout).</li>
 *   <li>Texto denso o escaneado: se envia como PDF (el texto costaria mas o no existe).</li>
 *   <li>Documentos largos: solo las primeras {@code maxPages} paginas, con una nota.</li>
 * </ul>
 * Todo es local (PDFBox), sin llamadas a la IA.
 */
@Component
public class PdfAttachmentOptimizer {

    private static final Logger log = LoggerFactory.getLogger(PdfAttachmentOptimizer.class);

    /** Por debajo de esto la pagina es escaneada/imagen: el texto no representa el contenido. */
    private static final int MIN_TEXT_CHARS_PER_PAGE = 100;
    /** Por debajo de esto el texto (~chars/4 tokens) es claramente mas barato que 258 tokens/pagina. */
    private static final int MAX_SPARSE_CHARS_PER_PAGE = 600;

    public enum Mode { PDF, TEXT }

    /**
     * @param mode        como se envia
     * @param pdfBytes    bytes a enviar si mode=PDF (posiblemente recortado)
     * @param text        texto a enviar si mode=TEXT (o texto de respaldo si el PDF no cabe)
     * @param totalPages  paginas del documento original
     * @param sentPages   paginas incluidas en el PDF enviado
     * @param note        nota para el agente (vacia si no hubo cambios)
     */
    public record Prepared(Mode mode, byte[] pdfBytes, String text, int totalPages, int sentPages, String note) {
    }

    public Prepared prepare(byte[] original, PdfPolicy policy) {
        try (PDDocument doc = Loader.loadPDF(original)) {
            int pages = doc.getNumberOfPages();
            String text = new PDFTextStripper().getText(doc).replaceAll("[ \\t]+", " ").replaceAll("\\n{3,}", "\n\n").trim();
            int charsPerPage = pages > 0 ? text.length() / pages : 0;

            boolean sparseText = charsPerPage >= MIN_TEXT_CHARS_PER_PAGE && charsPerPage <= MAX_SPARSE_CHARS_PER_PAGE;
            if (sparseText && !policy.preferLayout()) {
                return new Prepared(Mode.TEXT, null, text, pages, pages,
                        "Contenido enviado como texto extraído del PDF (" + pages + " páginas) para reducir costo.");
            }

            Integer maxPages = policy.maxPages();
            if (maxPages != null && pages > maxPages) {
                for (int i = pages - 1; i >= maxPages; i--) doc.removePage(i);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                doc.save(out);
                return new Prepared(Mode.PDF, out.toByteArray(), text, pages, maxPages,
                        "El documento tiene " + pages + " páginas; se envían solo las primeras " + maxPages
                                + ". Considéralo al evaluar su completitud.");
            }
            return new Prepared(Mode.PDF, original, text, pages, pages, "");
        } catch (Exception e) {
            // PDF protegido o dañado: se envia tal cual, como antes.
            log.warn("[pdf-optimizer] No se pudo analizar el PDF, se envía sin cambios: {}", e.getMessage());
            return new Prepared(Mode.PDF, original, null, -1, -1, "");
        }
    }
}
