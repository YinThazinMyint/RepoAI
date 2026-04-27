package com.example.backend.dto.repository;

import com.example.backend.entity.AIQuestion;
import com.example.backend.entity.Diagram;
import com.example.backend.entity.Documentation;
import com.example.backend.entity.Repository;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class RepositoryDetailResponse {

    private Repository repository;
    private List<AIQuestion> questions;
    private List<Documentation> docs;
    private List<Diagram> diagrams;
}
