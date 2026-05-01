package com.example.backend.repository;

import com.example.backend.entity.AIQuestion;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AIQuestionRepository extends JpaRepository<AIQuestion, Long> {

    List<AIQuestion> findTop10ByOrderByRespondedAtDesc();

    List<AIQuestion> findTop10ByRepositoryIdInOrderByRespondedAtDesc(List<Long> repositoryIds);

    List<AIQuestion> findByRepositoryIdOrderByRespondedAtDesc(Long repositoryId);

    long countByRepositoryIdIn(List<Long> repositoryIds);
}
