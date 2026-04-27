package com.example.backend.repository;

import com.example.backend.entity.Documentation;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentationRepository extends JpaRepository<Documentation, Long> {

    List<Documentation> findAllByOrderByUpdatedAtDesc();

    List<Documentation> findByRepositoryIdOrderByUpdatedAtDesc(Long repositoryId);
}
