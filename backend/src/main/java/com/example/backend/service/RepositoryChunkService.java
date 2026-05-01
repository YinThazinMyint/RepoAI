package com.example.backend.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Slf4j
public class RepositoryChunkService {

    private final JdbcTemplate jdbcTemplate;
    private final OpenAiService openAiService;

    @Value("${rag.chunk.max-chars:3000}")
    private int maxChunkChars;

    @Value("${rag.chunk.overlap-chars:400}")
    private int overlapChars;

    @Value("${rag.retrieval.top-k:6}")
    private int defaultTopK;

    @Transactional
    public void indexRepository(Long repositoryId, List<RepositorySourceFile> files) {
        if (repositoryId == null || files == null || files.isEmpty()) {
            return;
        }

        if (!openAiService.isConfigured()) {
            log.info("Skipping repository {} RAG indexing because OpenAI is not configured.", repositoryId);
            return;
        }

        try {
            jdbcTemplate.update("DELETE FROM repository_chunks WHERE repository_id = ?", repositoryId);
            int inserted = 0;
            for (RepositorySourceFile file : files) {
                List<String> chunks = splitIntoChunks(file.content());
                for (int index = 0; index < chunks.size(); index++) {
                    List<Double> embedding = openAiService.generateEmbedding(buildEmbeddingInput(file.path(), chunks.get(index)));
                    jdbcTemplate.update("""
                            INSERT INTO repository_chunks(repository_id, file_path, chunk_index, content, embedding)
                            VALUES (?, ?, ?, ?, CAST(? AS vector))
                            """,
                            repositoryId,
                            file.path(),
                            index,
                            chunks.get(index),
                            toVectorLiteral(embedding)
                    );
                    inserted++;
                }
            }
            log.info("Indexed {} RAG chunks for repository {}.", inserted, repositoryId);
        } catch (DataAccessException exception) {
            log.warn("Repository {} RAG indexing failed because pgvector storage is unavailable: {}", repositoryId, exception.getMessage());
        } catch (Exception exception) {
            log.warn("Repository {} RAG indexing failed: {}", repositoryId, exception.getMessage());
        }
    }

    public List<RetrievedChunk> findRelevantChunks(Long repositoryId, String questionText) {
        return findRelevantChunks(repositoryId, questionText, defaultTopK);
    }

    public boolean hasIndexedChunks(Long repositoryId) {
        return countIndexedChunks(repositoryId) > 0;
    }

    public int countIndexedChunks(Long repositoryId) {
        if (repositoryId == null) {
            return 0;
        }

        try {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM repository_chunks WHERE repository_id = ?",
                    Integer.class,
                    repositoryId
            );
            return count != null ? count : 0;
        } catch (DataAccessException exception) {
            log.warn("Unable to check RAG chunks for repository {}: {}", repositoryId, exception.getMessage());
            return 0;
        }
    }

    public void deleteRepositoryChunks(Long repositoryId) {
        if (repositoryId == null) {
            return;
        }

        try {
            jdbcTemplate.update("DELETE FROM repository_chunks WHERE repository_id = ?", repositoryId);
        } catch (DataAccessException exception) {
            log.warn("Unable to delete RAG chunks for repository {}: {}", repositoryId, exception.getMessage());
        }
    }

    public List<RetrievedChunk> findRelevantChunks(Long repositoryId, String questionText, int topK) {
        if (repositoryId == null || !StringUtils.hasText(questionText) || !openAiService.isConfigured()) {
            return List.of();
        }

        try {
            String questionVector = toVectorLiteral(openAiService.generateEmbedding(questionText));
            return jdbcTemplate.query("""
                            SELECT file_path, chunk_index, content, 1 - (embedding <=> CAST(? AS vector)) AS score
                            FROM repository_chunks
                            WHERE repository_id = ?
                            ORDER BY embedding <=> CAST(? AS vector)
                            LIMIT ?
                            """,
                    (resultSet, rowNum) -> new RetrievedChunk(
                            resultSet.getString("file_path"),
                            resultSet.getInt("chunk_index"),
                            resultSet.getString("content"),
                            resultSet.getDouble("score")
                    ),
                    questionVector,
                    repositoryId,
                    questionVector,
                    Math.max(1, topK)
            );
        } catch (DataAccessException exception) {
            log.warn("Unable to retrieve RAG chunks for repository {}: {}", repositoryId, exception.getMessage());
            throw new IllegalStateException("Vector database retrieval failed. Check PostgreSQL pgvector setup.", exception);
        } catch (Exception exception) {
            log.warn("Unable to create question embedding for repository {}: {}", repositoryId, exception.getMessage());
            throw new IllegalStateException("OpenAI embeddings failed. Check the OpenAI API key and embedding model.", exception);
        }
    }

    private List<String> splitIntoChunks(String content) {
        if (!StringUtils.hasText(content)) {
            return List.of();
        }

        int safeMax = Math.max(500, maxChunkChars);
        int safeOverlap = Math.min(Math.max(0, overlapChars), safeMax / 2);
        List<String> chunks = new ArrayList<>();
        String normalizedContent = content.replace("\r\n", "\n").trim();

        int start = 0;
        while (start < normalizedContent.length()) {
            int end = Math.min(start + safeMax, normalizedContent.length());
            int adjustedEnd = findLineBreakBefore(normalizedContent, start, end);
            String chunk = normalizedContent.substring(start, adjustedEnd).trim();
            if (StringUtils.hasText(chunk)) {
                chunks.add(chunk);
            }

            if (adjustedEnd >= normalizedContent.length()) {
                break;
            }
            start = Math.max(adjustedEnd - safeOverlap, start + 1);
        }

        return chunks;
    }

    private int findLineBreakBefore(String content, int start, int end) {
        if (end >= content.length()) {
            return content.length();
        }

        int lineBreak = content.lastIndexOf('\n', end);
        if (lineBreak > start + (maxChunkChars / 2)) {
            return lineBreak;
        }
        return end;
    }

    private String buildEmbeddingInput(String path, String content) {
        return "File: %s\n\n%s".formatted(path, content);
    }

    private String toVectorLiteral(List<Double> embedding) {
        return "[" + String.join(",", embedding.stream()
                .map(value -> String.format(Locale.ROOT, "%.8f", value))
                .toList()) + "]";
    }

    public record RetrievedChunk(String filePath, int chunkIndex, String content, double score) {
    }
}
