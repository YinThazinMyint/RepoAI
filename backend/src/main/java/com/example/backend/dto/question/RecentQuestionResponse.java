package com.example.backend.dto.question;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class RecentQuestionResponse {

    private Long id;
    private Long repositoryId;
    private String repositoryName;
    private String questionText;
    private String answerText;
    private Instant respondedAt;
}
