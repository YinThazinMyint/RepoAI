package com.example.backend.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@RequiredArgsConstructor
@Slf4j
public class DatabaseSchemaConfig {

    private final JdbcTemplate jdbcTemplate;

    @Bean
    ApplicationRunner allowZipRepositoriesWithoutGithubUrl() {
        return args -> {
            jdbcTemplate.execute("ALTER TABLE repositories ALTER COLUMN github_url DROP NOT NULL");
            jdbcTemplate.execute("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS description varchar(1000)");
            jdbcTemplate.execute("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS file_count integer");
            jdbcTemplate.execute("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS lines_of_code bigint");
            jdbcTemplate.execute("ALTER TABLE repositories ADD COLUMN IF NOT EXISTS owner_user_id bigint");
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_generation_count integer DEFAULT 0 NOT NULL");
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_generation_window_start timestamp with time zone");
            markUnscannedReadyRepositoriesAsError();
            configureVectorStorage();
        };
    }

    private void markUnscannedReadyRepositoriesAsError() {
        jdbcTemplate.execute("""
                UPDATE repositories
                SET status = 'ERROR'
                WHERE status = 'READY'
                  AND (file_count IS NULL OR lines_of_code IS NULL)
                """);
    }

    private void configureVectorStorage() {
        try {
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
            jdbcTemplate.execute("""
                    CREATE TABLE IF NOT EXISTS repository_chunks (
                        id bigserial PRIMARY KEY,
                        repository_id bigint NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
                        file_path varchar(1000) NOT NULL,
                        chunk_index integer NOT NULL,
                        content text NOT NULL,
                        embedding vector(1536) NOT NULL,
                        created_at timestamp with time zone DEFAULT now(),
                        updated_at timestamp with time zone DEFAULT now()
                    )
                    """);
            jdbcTemplate.execute("""
                    CREATE INDEX IF NOT EXISTS repository_chunks_repository_id_idx
                    ON repository_chunks(repository_id)
                    """);
        } catch (DataAccessException exception) {
            log.warn("pgvector repository chunk storage is not available yet: {}", exception.getMessage());
        }
    }
}
