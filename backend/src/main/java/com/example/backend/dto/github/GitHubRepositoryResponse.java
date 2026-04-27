package com.example.backend.dto.github;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class GitHubRepositoryResponse {

    private Long id;
    private String fullName;
    private String htmlUrl;
    private String language;
    private String name;
    private boolean isPrivate;
}
