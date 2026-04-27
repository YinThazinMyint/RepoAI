package com.example.backend.dto.documentation;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class DocumentationSummaryResponse {

    private Long id;
    private Long repositoryId;
    private String repositoryName;
    private String title;
    private String content;
    private Instant updatedAt;
}
