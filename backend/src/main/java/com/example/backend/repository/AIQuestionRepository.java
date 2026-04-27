package com.example.backend.repository;

import com.example.backend.entity.AIQuestion;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AIQuestionRepository extends JpaRepository<AIQuestion, Long> {

    List<AIQuestion> findTop10ByOrderByRespondedAtDesc();

    List<AIQuestion> findByRepositoryIdOrderByRespondedAtDesc(Long repositoryId);
}
