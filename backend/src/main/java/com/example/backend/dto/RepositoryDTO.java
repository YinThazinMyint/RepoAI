package com.example.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RepositoryDTO {

    private String githubUrl;
    private String zipFile;
    private String name;
    private String description;
    private String language;
    private String techStack;
    private String repositoryVisibility;
    private String questionText;
    private String documentationType;
    private String diagramType;
}
